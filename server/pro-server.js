// Optional AI and pronunciation API. Run: node server/pro-server.js
'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';    // Browser origin
const AI_KEY_GEMINI = process.env.AI_KEY_GEMINI || '';        // key AI giữ ở server (dùng cho proxy)
const AI_KEY_OPENROUTER = process.env.AI_KEY_OPENROUTER || '';
const AI_PROXY_TOKEN = process.env.AI_PROXY_TOKEN || '';      // nếu đặt, /api/ai yêu cầu Bearer token
const MAX_BODY = 256 * 1024;                                 // 256 KB AI request body
/* ★ Chấm phát âm: key Azure giữ ở server. Không đặt → /api/pron trả 501
   và app dùng đánh giá sơ bộ (không giả điểm). */
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'southeastasia';
const PRON_MAX_BODY = 4 * 1024 * 1024;                       // 4 MB (≈15s WAV 16k mono)

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  if (A.length !== B.length) return false;
  try { return crypto.timingSafeEqual(A, B); } catch (e) { return false; }
}

function cors(res) {
  /* CORS for the browser AI and pronunciation clients. */
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}
function json(res, code, data, withCors) {
  if (withCors) cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/* Đọc body có giới hạn kích thước; trả null nếu quá lớn */
function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    let tooBig = false;
    req.on('data', c => {
      if (tooBig) return;
      b += c;
      if (b.length > MAX_BODY) { tooBig = true; b = ''; }
    });
    req.on('end', () => {
      if (tooBig) return resolve(null);
      /* Giữ nguyên chuỗi body thô (b) để tính HMAC trên byte gốc —
         cổng thanh toán ký trên raw body, không phải JSON đã serialize lại. */
      let data = {};
      try { data = JSON.parse(b || '{}'); } catch (e) { data = {}; }
      resolve({ data, raw: b });
    });
    req.on('error', () => resolve(null));
  });
}

/* ── AI PROXY: app gửi prompt, server giữ key (AI_KEY_*) → client không lưu plaintext ── */
async function serverCallAi(provider,key,prompt,image){
  if(provider==='openrouter'){
    const content=(image&&image.data)
      ? [{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:'+image.mime+';base64,'+image.data}}]
      : prompt;
    const resp=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'meta-llama/llama-3.3-70b-instruct:free',messages:[{role:'user',content:content}],temperature:.9})});
    if(!resp.ok)throw new Error('OpenRouter lỗi '+resp.status);
    const d=await resp.json();
    const t=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
    if(!t)throw new Error('OpenRouter không trả nội dung.');
    return t;
  }
  const reqParts=[{text:prompt}];
  if(image&&image.data)reqParts.push({inline_data:{mime_type:image.mime,data:image.data}});
  const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:reqParts}],generationConfig:{temperature:.9}})});
  if(!resp.ok)throw new Error('Gemini lỗi '+resp.status);
  const d=await resp.json();
  const parts=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts;
  const t=parts?parts.map(p=>p.text||'').join(''):'';
  if(!t)throw new Error('Gemini không trả nội dung.');
  return t;
}

/* Đọc body lớn hơn (audio chấm phát âm) — cùng dạng trả về như readBody */
function readBodyBig(req, limit) {
  return new Promise(resolve => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', c => {
      if (tooBig) return;
      size += c.length;
      if (size > (limit || PRON_MAX_BODY)) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return resolve(null);
      const raw = Buffer.concat(chunks).toString('utf8');
      let data = {};
      try { data = JSON.parse(raw || '{}'); } catch (e) { data = {}; }
      resolve({ data, raw });
    });
    req.on('error', () => resolve(null));
  });
}

/* Rate limit service requests by IP. */
const HITS = new Map();
const RATE_WINDOW = 60 * 1000, RATE_MAX = 120;
function rateLimited(ip) {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now - rec.t0 > RATE_WINDOW) { HITS.set(ip, { t0: now, n: 1 }); return false; }
  rec.n++;
  return rec.n > RATE_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of HITS) if (now - r.t0 > RATE_WINDOW * 2) HITS.delete(ip);
}, RATE_WINDOW).unref();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const ip = (req.socket && req.socket.remoteAddress) || 'unknown';

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  /* ── 2b. AI PROXY: app gửi prompt, server giữ key (AI_KEY_*) → không lưu plaintext client ── */
  if (url.pathname === '/api/ai' && req.method === 'POST') {
    if (AI_PROXY_TOKEN) {
      const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!safeEqual(auth, AI_PROXY_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' }, true);
    }
    const parsed = await readBody(req);
    if (parsed === null) return json(res, 413, { ok: false, error: 'body too large' }, true);
    const { provider, prompt, image } = parsed.data || {};
    const key = provider === 'openrouter' ? AI_KEY_OPENROUTER : AI_KEY_GEMINI;
    if (!key) return json(res, 500, { ok: false, error: 'server chưa cấu hình key cho ' + provider }, true);
    try {
      const text = await serverCallAi(provider, key, prompt, image);
      return json(res, 200, { ok: true, text }, true);
    } catch (e) { return json(res, 502, { ok: false, error: (e && e.message) || String(e) }, true); }
  }

  /* ── 2d. PRONUNCIATION ASSESSMENT: chấm phát âm thật, key GIỮ Ở SERVER ★ ──
     App gửi: { audio: base64(WAV 16k mono), mime, text }
     Server gọi Azure Speech → trả điểm phát âm + điểm từng từ/âm tiết.

     VÌ SAO CẦN SERVER: key Azure là bí mật, không được nằm trong JS tĩnh.

     CHI PHÍ (tham khảo, tự kiểm tra lại trước khi dùng thật):
       Azure Speech — gói Free (F0): 5 giờ audio/tháng, tối đa 1 request đồng thời.
       Gói Standard (S0): tính theo giờ audio, khoảng vài USD/giờ.
       Mỗi lượt nói ở đây dài tối đa 15 giây → 1 giờ ≈ 240 lượt.
       Hạn mức/giá có thể đổi — xem trang giá của Azure trước khi bật.

     CẤU HÌNH (chỉ cần khi muốn điểm phát âm chuyên dụng):
       AZURE_SPEECH_KEY=<key>
       AZURE_SPEECH_REGION=southeastasia
       node server/pro-server.js
     Không cấu hình → trả 501 và app tự dùng đánh giá sơ bộ
     (độ khớp nội dung từ nhận dạng giọng nói) — KHÔNG giả điểm.

     LƯU Ý KỸ THUẬT: endpoint hội thoại của Azure chỉ nhận WAV PCM 16 kHz
     mono hoặc OGG-OPUS, KHÔNG nhận webm. App đã chuyển sang WAV ngay trong
     trình duyệt trước khi gửi lên. */
  if (url.pathname === '/api/pron' && req.method === 'POST') {
    if (!AZURE_SPEECH_KEY) {
      return json(res, 501, {
        ok: false,
        error: 'server chưa cấu hình AZURE_SPEECH_KEY — dùng đánh giá sơ bộ ở client',
        hint: 'Đặt biến môi trường AZURE_SPEECH_KEY và AZURE_SPEECH_REGION rồi chạy lại server.'
      }, true);
    }
    if (rateLimited(ip)) return json(res, 429, { ok: false, error: 'too many requests' }, true);
    const parsed = await readBodyBig(req, PRON_MAX_BODY);
    if (parsed === null) return json(res, 413, { ok: false, error: 'audio quá lớn (giới hạn 4 MB)' }, true);
    const body = parsed.data || {};
    const b64 = String(body.audio || '');
    const text = String(body.text || '').slice(0, 300);
    if (!b64) return json(res, 400, { ok: false, error: 'thiếu audio' }, true);
    if (!text) return json(res, 400, { ok: false, error: 'thiếu text tham chiếu' }, true);
    let audioBuf;
    try { audioBuf = Buffer.from(b64, 'base64'); }
    catch (e) { return json(res, 400, { ok: false, error: 'audio base64 không hợp lệ' }, true); }

    /* Cấu hình chấm điểm: thang 100, chấm tới âm tiết, bật nhận diện đọc nhầm */
    const cfg = Buffer.from(JSON.stringify({
      ReferenceText: text,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      EnableMiscue: true
    }), 'utf8').toString('base64');

    const ep = 'https://' + AZURE_SPEECH_REGION +
      '.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1' +
      '?language=zh-CN&format=detailed';
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Pronunciation-Assessment': cfg,
          'Accept': 'application/json'
        },
        body: audioBuf
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        return json(res, 502, { ok: false, error: 'Azure lỗi ' + r.status, detail: t.slice(0, 300) }, true);
      }
      const d = await r.json();
      const best = d && d.NBest && d.NBest[0];
      const pa = best && best.PronunciationAssessment;
      if (!pa) return json(res, 502, { ok: false, error: 'Azure không trả PronunciationAssessment' }, true);
      const words = (best.Words || []).map(w => ({
        text: w.Word,
        accuracy: w.PronunciationAssessment ? w.PronunciationAssessment.AccuracyScore : null,
        errorType: w.PronunciationAssessment ? w.PronunciationAssessment.ErrorType : '',
        syllables: (w.Syllables || []).map(s => ({
          text: s.Syllable,
          accuracy: s.PronunciationAssessment ? s.PronunciationAssessment.AccuracyScore : null
        }))
      }));
      return json(res, 200, {
        ok: true,
        text: best.Display || d.DisplayText || '',
        pronScore: pa.PronScore,
        accuracy: pa.AccuracyScore,
        fluency: pa.FluencyScore,
        completeness: pa.CompletenessScore,
        prosody: pa.ProsodyScore != null ? pa.ProsodyScore : null,
        confidence: typeof d.RecognitionStatus === 'string' && d.RecognitionStatus === 'Success' ? 1 : null,
        words
      }, true);
    } catch (e) {
      return json(res, 502, { ok: false, error: (e && e.message) || String(e) }, true);
    }
  }

  /* ── 3. Kiểm tra nhanh server sống (không lộ danh sách người đã trả tiền) ── */
  if (url.pathname === '/health') return json(res, 200, { ok: true });

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log('GoPinyin API chạy tại http://localhost:' + PORT);
  console.log('  POST /api/ai        ← proxy AI (giữ key ở server)');
  console.log('  POST /api/pron      ← chấm phát âm (Azure) ' + (AZURE_SPEECH_KEY ? 'đã bật ✓' : 'CHƯA CẤU HÌNH → client tự đánh giá sơ bộ'));
});
