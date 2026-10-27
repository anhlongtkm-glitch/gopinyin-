// Optional AI and pronunciation API. Run: node server/pro-server.js
'use strict';
const http = require('http');
const crypto = require('crypto');
const { verifyAccount } = require('./account-auth');
const models = require('../src/data/ai-models.json');
const UPSTREAM_TIMEOUT = Math.max(1000, Number(process.env.UPSTREAM_TIMEOUT_MS) || 30000);
const GEMINI_MODEL = process.env.AI_MODEL_GEMINI || models.gemini[0];
const OPENROUTER_MODEL = process.env.AI_MODEL_OPENROUTER || models.openrouter[0];

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';    // Browser origin
const AI_KEY_GEMINI = process.env.AI_KEY_GEMINI || '';        // key AI giữ ở server (dùng cho proxy)
const AI_KEY_OPENROUTER = process.env.AI_KEY_OPENROUTER || '';
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
  res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
}
function json(res, code, data, withCors) {
  if (withCors) cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/* Đọc body có giới hạn kích thước; trả null nếu quá lớn */
function readBody(req) {
  return readBodyBig(req, MAX_BODY);
}

/* ── AI PROXY: app gửi prompt, server giữ key (AI_KEY_*) → client không lưu plaintext ── */
function aiUpstreamError(response, provider) {
  const limited = response.status === 429 || response.status === 402;
  const retryAfter = response.headers.get('Retry-After');
  return Object.assign(new Error(limited
    ? 'Đã hết lượt AI miễn phí hoặc dịch vụ đang bận. Đợi rồi bấm Thử lại; nội dung đã tạo vẫn học được.'
    : provider + ' chưa trả được bài học (HTTP ' + response.status + '). Chủ website cần kiểm tra model và cấu hình dịch vụ.'), {
    status: limited ? 429 : 502,
    retryAfter: limited ? retryAfter || '60' : null
  });
}
async function serverCallAi(provider,key,prompt,image,temperature=.9){
  if(provider==='openrouter'){
    const content=(image&&image.data)
      ? [{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:'+image.mime+';base64,'+image.data}}]
      : prompt;
    const resp=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(UPSTREAM_TIMEOUT),headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:OPENROUTER_MODEL,messages:[{role:'user',content:content}],temperature})});
    if(!resp.ok)throw aiUpstreamError(resp, 'OpenRouter');
    const d=await resp.json();
    const t=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
    if(!t)throw new Error('OpenRouter không trả nội dung.');
    return t;
  }
  const reqParts=[{text:prompt}];
  if(image&&image.data)reqParts.push({inline_data:{mime_type:image.mime,data:image.data}});
  const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(GEMINI_MODEL)+':generateContent',{method:'POST',signal:AbortSignal.timeout(UPSTREAM_TIMEOUT),headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:reqParts}],generationConfig:{temperature}})});
  if(!resp.ok)throw aiUpstreamError(resp, 'Gemini');
  const d=await resp.json();
  const parts=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts;
  const t=parts?parts.map(p=>p.text||'').join(''):'';
  if(!t)throw new Error('Gemini không trả nội dung.');
  return t;
}

/* Đọc body lớn hơn (audio chấm phát âm) — cùng dạng trả về như readBody */
function readBodyBig(req, limit) {
  // Vercel may have consumed the stream and supplied req.body already.
  let supplied;
  try { supplied = req.body; } catch { return Promise.resolve({ data: {}, raw: '' }); }
  if (supplied !== undefined) {
    const raw = Buffer.isBuffer(supplied) ? supplied.toString('utf8') : typeof supplied === 'string' ? supplied : JSON.stringify(supplied);
    if (Buffer.byteLength(raw) > (limit || PRON_MAX_BODY)) return Promise.resolve(null);
    try { return Promise.resolve({ data: JSON.parse(raw), raw }); } catch { return Promise.resolve({ data: {}, raw }); }
  }
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
    req.on('aborted', () => resolve(null));
  });
}

/* Rate limit service requests by IP. */
const HITS = new Map();
const RATE_WINDOW = 60 * 1000, RATE_MAX = 120;
function rateLimited(ip, maximum = RATE_MAX) {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now - rec.t0 > RATE_WINDOW) { HITS.set(ip, { t0: now, n: 1 }); return false; }
  rec.n++;
  return rec.n > maximum;
}
const ACTIVE = new Map();
let activeRequests = 0;
const USER_RATE = Math.max(1, Number(process.env.USER_RATE_PER_MINUTE) || RATE_MAX);
const MAX_ACTIVE = Math.max(1, Number(process.env.MAX_CONCURRENT_REQUESTS) || 20);
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of HITS) if (now - r.t0 > RATE_WINDOW * 2) HITS.delete(ip);
}, RATE_WINDOW).unref();

async function handleRequest(req, res) {
  let release = () => {};
  try {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const ip = (req.socket && req.socket.remoteAddress) || 'unknown';

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && ['/api/ai', '/api/pron'].includes(url.pathname)) {
    const account = await verifyAccount(req);
    if (!account.user) return json(res, account.status, { ok: false, error: account.error }, true);
    if (rateLimited('user:' + account.user.id, USER_RATE) || rateLimited('ip:' + ip, USER_RATE * 10)) {
      res.setHeader('Retry-After', '60');
      return json(res, 429, { ok: false, error: 'Bạn đã dùng hết lượt trong phút này. Vui lòng thử lại sau.' }, true);
    }
    const uid = account.user.id;
    if ((ACTIVE.get(uid) || 0) >= 2 || activeRequests >= MAX_ACTIVE) {
      res.setHeader('Retry-After', '3');
      return json(res, 429, { ok: false, error: 'Dịch vụ đang bận. Vui lòng thử lại sau.' }, true);
    }
    ACTIVE.set(uid, (ACTIVE.get(uid) || 0) + 1); activeRequests++;
    let released = false;
    release = () => { if (released) return; released = true; activeRequests--; const n = (ACTIVE.get(uid) || 1) - 1; if (n) ACTIVE.set(uid, n); else ACTIVE.delete(uid); };
  }

  /* ── 2b. AI PROXY: app gửi prompt, server giữ key (AI_KEY_*) → không lưu plaintext client ── */
  if (url.pathname === '/api/ai' && req.method === 'POST') {
    const parsed = await readBody(req);
    if (parsed === null) return json(res, 413, { ok: false, error: 'body too large' }, true);
    const { provider = 'gemini', prompt, image, temperature = .9 } = parsed.data || {};
    if (!['gemini','openrouter'].includes(provider) || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 50000 ||
      typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2 ||
      (image != null && (!['image/png','image/jpeg','image/webp'].includes(image.mime) || typeof image.data !== 'string'))) {
      return json(res, 400, { ok: false, error: 'Nội dung hoặc nhà cung cấp AI không hợp lệ.' }, true);
    }
    const key = provider === 'openrouter' ? AI_KEY_OPENROUTER : AI_KEY_GEMINI;
    if (!key) return json(res, 503, { ok: false, code: 'ai_not_configured', error: 'Dịch vụ AI của website chưa được cấu hình. Chủ website cần đặt ' + (provider === 'gemini' ? 'AI_KEY_GEMINI' : 'AI_KEY_OPENROUTER') + ' trên máy chủ rồi triển khai lại. Bạn không cần nhập API key cá nhân.' }, true);
    try {
      const text = await serverCallAi(provider, key, prompt, image, temperature);
      return json(res, 200, { ok: true, text }, true);
    } catch (e) {
      if (e.retryAfter) res.setHeader('Retry-After', e.retryAfter);
      return json(res, e.status || 502, { ok: false, error: e.status ? e.message : 'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi bấm Thử lại.' }, true);
    }
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
    if (body.mime !== 'audio/wav' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0 ||
      audioBuf.length < 44 || audioBuf.toString('ascii',0,4) !== 'RIFF' || audioBuf.toString('ascii',8,12) !== 'WAVE') {
      return json(res, 400, { ok: false, error: 'Cần bản ghi WAV hợp lệ.' }, true);
    }

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
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
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
  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, {
      ok: true, apiVersion: 1,
      accountConfigured: !!((process.env.SUPABASE_URL || process.env.GOPINYIN_SUPABASE_URL) && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.GOPINYIN_SUPABASE_PUBLISHABLE_KEY)),
      services: { gemini: !!AI_KEY_GEMINI, openrouter: !!AI_KEY_OPENROUTER, pronunciation: !!AZURE_SPEECH_KEY }
    }, true);
  }

  json(res, 404, { ok: false, error: 'not found' });
  } catch {
    if (!res.headersSent && !res.destroyed) json(res, 500, { ok: false, error: 'Không xử lý được yêu cầu. Vui lòng thử lại.' }, true);
  } finally { release(); }
}
module.exports = handleRequest;
const server = http.createServer(handleRequest);
server.requestTimeout = 45000;
server.headersTimeout = 15000;

if (require.main === module) server.listen(PORT, () => {
  console.log('GoPinyin API chạy tại http://localhost:' + PORT);
  console.log('  POST /api/ai        ← proxy AI (giữ key ở server)');
  console.log('  POST /api/pron      ← chấm phát âm (Azure) ' + (AZURE_SPEECH_KEY ? 'đã bật ✓' : 'CHƯA CẤU HÌNH → client tự đánh giá sơ bộ'));
});
