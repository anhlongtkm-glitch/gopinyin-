/* ═══════════════════════════════════════════════════════════════
   GOPINYIN — SERVER ĐỐI SOÁT CHUYỂN KHOẢN (tự động nâng cấp Pro)
   ───────────────────────────────────────────────────────────────
   Không cần cài thư viện gì (chỉ dùng http + fs + crypto của Node).
   Chạy:   WEBHOOK_SECRET=<khoa-bi-mat> node server/pro-server.js
   Mặc định: http://localhost:8787

   ⚠️ BẮT BUỘC ĐỌC — BẢO MẬT
   ─────────────────────────────────────────────────────────────
   Bản trước chạy được khi KHÔNG có WEBHOOK_SECRET → bất kỳ ai cũng POST
   JSON giả vào /webhook để tự mở Pro cho bất kỳ email nào.
   Nay server TỪ CHỐI KHỞI ĐỘNG nếu thiếu WEBHOOK_SECRET (fail-closed).
   Chỉ khi test ở máy local mới được bỏ qua bằng:
       ALLOW_INSECURE_WEBHOOK=1 node server/pro-server.js

   CÁCH NỐI VÀO APP (3 bước):
   1) Đưa server này lên Internet (VPS, Render, Railway, Fly.io…
      hoặc tạm thời:  npx cloudflared tunnel --url http://localhost:8787)
   2) Mở assets/gopinyin.js, đổi:
         const PRO_VERIFY_URL='';   →   const PRO_VERIFY_URL='https://api.ban.com/pro/status';
      (không có dấu / ở cuối)
   3) Vào cổng thanh toán (SePay / Casso / payOS…) tạo Webhook trỏ tới:
         https://api.ban.com/webhook
      Đặt header "Authorization: Apikey <WEBHOOK_SECRET>".
      Nếu cổng hỗ trợ chữ ký HMAC, đặt thêm HMAC_SECRET để server kiểm tra
      chữ ký trên RAW BODY (khuyến nghị — chống giả mạo tuyệt đối).

   LUỒNG HOẠT ĐỘNG:
   Khách quét VietQR (đã có sẵn số tiền + nội dung "GOPINYIN email")
     → tiền vào tài khoản Vietcombank
     → ngân hàng/cổng bắn webhook về /webhook
     → server kiểm tra khoá + số tiền, lưu hạn dùng theo gói
     → app đang mở tự hỏi /pro/status mỗi 5 giây
     → thấy paid:true → tự bật Pro, không cần khách bấm gì.

   LƯU Ý: file dữ liệu pro-paid.json chỉ để demo. Khi chạy thật, hãy thay
   bằng DB thật (Postgres/Mongo/Redis…) và gắn thêm tài khoản người dùng.
   ═══════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.WEBHOOK_SECRET || '';            // khoá webhook (BẮT BUỘC)
const HMAC_SECRET = process.env.HMAC_SECRET || '';          // tuỳ chọn: xác thực chữ ký
const ALLOW_INSECURE = process.env.ALLOW_INSECURE_WEBHOOK === '1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';    // chỉ dùng cho GET /pro/status
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'pro-paid.json');
const AI_KEY_GEMINI = process.env.AI_KEY_GEMINI || '';        // key AI giữ ở server (dùng cho proxy)
const AI_KEY_OPENROUTER = process.env.AI_KEY_OPENROUTER || '';
const AI_PROXY_TOKEN = process.env.AI_PROXY_TOKEN || '';      // nếu đặt, /api/ai yêu cầu Bearer token
const MAX_BODY = 256 * 1024;                                 // 256 KB là quá đủ cho 1 webhook
/* ★ Chấm phát âm: key Azure giữ ở server. Không đặt → /api/pron trả 501
   và app dùng đánh giá sơ bộ (không giả điểm). */
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'southeastasia';
const PRON_MAX_BODY = 4 * 1024 * 1024;                       // 4 MB (≈15s WAV 16k mono)

/* ── Gói + hạn dùng ──
   Gói tháng: 39.000đ / 31 ngày.
   Gói năm: 399.000đ / 365 ngày.
   Bản cũ có plan lifetime được giữ tương thích để không mất quyền cũ. */
const DAY = 24 * 60 * 60 * 1000;
const PLANS = {
  month:    { price: 39000,   ms: 31 * DAY },
  year:     { price: 399000,  ms: 365 * DAY },
  lifetime: { price: 399000,  ms: 0 }
};
function planOf(amount) {
  const n = Number(amount) || 0;
  if (n >= PLANS.year.price) return 'year';
  if (n >= PLANS.month.price) return 'month';
  return null;                     // chuyển thiếu tiền → KHÔNG kích hoạt
}

/* ── Kiểm tra cấu hình trước khi chạy ── */
if (!SECRET && !ALLOW_INSECURE) {
  console.error('\n✗ TỪ CHỐI KHỞI ĐỘNG: chưa đặt WEBHOOK_SECRET.\n');
  console.error('  Nếu không có khoá, bất kỳ ai cũng có thể POST giả vào /webhook');
  console.error('  để tự mở Pro miễn phí.\n');
  console.error('  Chạy đúng cách:');
  console.error('    WEBHOOK_SECRET=mot-chuoi-bi-mat-dai node server/pro-server.js\n');
  console.error('  Chỉ khi test ở máy local:');
  console.error('    ALLOW_INSECURE_WEBHOOK=1 node server/pro-server.js\n');
  process.exit(1);
}
if (!SECRET && ALLOW_INSECURE) {
  console.warn('\n⚠️  ĐANG CHẠY KHÔNG CÓ KHOÁ WEBHOOK — chỉ dùng để test local, TUYỆT ĐỐI không đưa lên Internet.\n');
}

/* ── Lưu trữ tạm bằng file JSON ── */
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
function saveDB(db) {
  try {
    /* ghi qua file tạm rồi rename → không bao giờ để lại file JSON hỏng */
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('Không ghi được DB:', e.message); }
}
/* Chuẩn hoá nội dung CK để so khớp: bỏ dấu cách, viết hoa, bỏ ký tự lạ */
function normNote(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9@._-]/g, '')
    .trim();
}
/* So sánh chuỗi an toàn với timing attack */
function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  if (A.length !== B.length) return false;
  try { return crypto.timingSafeEqual(A, B); } catch (e) { return false; }
}

/* ★ Kiểm tra trạng thái Pro từ DB (dùng chung cho /pro/status và /pro/content) */
function proStatusOf(rawNote) {
  const note = normNote(rawNote || '');
  if (!note) return { paid: false, error: 'missing note' };
  const db = loadDB();
  const hit = db[note];
  if (!hit) return { paid: false };
  const paid = hit.plan === 'lifetime' ? true : Number(hit.expiresAt || 0) > Date.now();
  return { paid, plan: hit.plan, at: hit.at, expiresAt: Number(hit.expiresAt || 0) };
}
/* ★ Nội dung Pro (HSK 4–9) — chỉ server giữ; đọc 1 lần rồi cache */
let __proContent = null;
function loadProContent() {
  if (__proContent) return __proContent;
  try { __proContent = JSON.parse(fs.readFileSync(path.join(__dirname, 'pro-content.json'), 'utf8')); }
  catch (e) { __proContent = {}; }
  return __proContent;
}

function cors(res) {
  /* ★ Chỉ các route app tĩnh gọi từ domain khác cần CORS: GET /pro/status và
     POST /api/pron (chấm phát âm). /webhook là server-to-server → KHÔNG mở CORS. */
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

/* ── Giới hạn tần suất đơn giản theo IP (chống dò /pro/status) ── */
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

  /* ── 1. WEBHOOK: ngân hàng / cổng thanh toán gọi vào đây ── */
  if (url.pathname === '/webhook' && req.method === 'POST') {
    if (SECRET) {
      const auth = req.headers.authorization || '';
      const token = auth.replace(/^(apikey|bearer)\s+/i, '').trim() || auth.trim();
      if (!safeEqual(token, SECRET)) {
        console.warn('[webhook] TỪ CHỐI — sai khoá từ', ip);
        return json(res, 401, { ok: false, error: 'unauthorized' });
      }
    }
    const parsed = await readBody(req);
    if (parsed === null) return json(res, 413, { ok: false, error: 'body too large' });
    const raw = parsed.data;
    const rawBody = parsed.raw;

    /* ★ Nếu cổng ký HMAC trên raw body → xác thực chữ ký (chống giả mạo tuyệt đối).
       Tính trên chuỗi body thô (rawBody), KHÔNG phải JSON.stringify(raw) — nếu không
       thứ tự key/khoảng trắng sẽ khác byte gốc và mọi webhook hợp lệ bị từ chối. */
    if (HMAC_SECRET) {
      const got = String(req.headers['x-signature'] || req.headers['x-hub-signature-256'] || '')
        .replace(/^sha256=/i, '').trim();
      const want = crypto.createHmac('sha256', HMAC_SECRET)
        .update(rawBody || '').digest('hex');
      if (!safeEqual(got, want)) {
        console.warn('[webhook] TỪ CHỐI — sai chữ ký HMAC từ', ip);
        return json(res, 401, { ok: false, error: 'bad signature' });
      }
    }

    const body = raw;
    /* Hỗ trợ nhiều cổng: SePay (content/transferAmount), Casso (data[]), payOS */
    const list = Array.isArray(body.data) ? body.data : [body];
    const saved = [], ignored = [];
    const db = loadDB();

    for (const tx of list) {
      const content = tx.content || tx.description || tx.transaction_content || tx.desc || '';
      const amount = tx.transferAmount || tx.amount || tx.transfer_amount || 0;
      /* chỉ nhận tiền vào */
      if (String(tx.transferType || tx.type || 'in').toLowerCase() === 'out') continue;
      const m = String(content).toUpperCase().match(/GOPINYIN[\s:_-]*([A-Z0-9@._-]+)/);
      if (!m) continue;
      const plan = planOf(amount);
      if (!plan) { ignored.push({ content, amount, reason: 'số tiền thấp hơn giá gói' }); continue; }

      const note = normNote('GOPINYIN ' + m[1]);
      const prev = db[note];
      let expiresAt = 0;
      if (plan === 'month') {
        /* ★ Gia hạn cộng dồn: còn hạn thì cộng tiếp, hết hạn thì tính từ hôm nay */
        const base = (prev && prev.plan === 'month' && Number(prev.expiresAt) > Date.now())
          ? Number(prev.expiresAt) : Date.now();
        expiresAt = base + PLANS.month.ms;
      } else if (plan === 'year') {
        const base = (prev && prev.plan === 'year' && Number(prev.expiresAt) > Date.now())
          ? Number(prev.expiresAt) : Date.now();
        expiresAt = base + PLANS.year.ms;
      } else if (prev && prev.plan === 'lifetime') {
        expiresAt = 0;                       /* dữ liệu cũ trọn đời → giữ nguyên */
      }
      db[note] = { note, amount: Number(amount), plan, at: Date.now(), expiresAt, raw: content };
      saved.push({ note, plan, expiresAt });
    }
    if (saved.length) saveDB(db);
    console.log('[webhook] ghi nhận:', saved.map(s => s.note + '/' + s.plan).join(', ') || 'không khớp nội dung');
    if (ignored.length) console.log('[webhook] bỏ qua:', JSON.stringify(ignored));
    return json(res, 200, { ok: true, saved, ignored });
  }

  /* ── 2. STATUS: app hỏi "đã nhận tiền chưa?" ── */
  if (url.pathname === '/pro/status' && req.method === 'GET') {
    if (rateLimited(ip)) return json(res, 429, { paid: false, error: 'too many requests' }, true);
    const note = normNote(url.searchParams.get('note') || '');
    const st = proStatusOf(note);
    if (st.error) return json(res, 400, { paid: false, error: st.error }, true);
    if (st.paid) console.log('[status] PAID', note);
    return json(res, 200, { paid: st.paid, plan: st.plan, at: st.at, expiresAt: st.expiresAt }, true);
  }

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

  /* ── 2c. PRO CONTENT: trả nội dung Pro (HSK 4–9) CHỈ sau khi xác thực ★ ──
     Nội dung không nằm trong JS tĩnh → không thể lấy nếu chưa trả tiền. */
  if (url.pathname === '/pro/content' && req.method === 'GET') {
    if (rateLimited(ip)) return json(res, 429, { paid: false, error: 'too many requests' }, true);
    const st = proStatusOf(url.searchParams.get('note') || '');
    if (!st.paid) return json(res, 403, { paid: false, error: 'not paid' }, true);
    const content = loadProContent();
    return json(res, 200, { paid: true, plan: st.plan, content }, true);
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
  console.log('Gopinyin pro-server chạy tại http://localhost:' + PORT);
  console.log('  POST /webhook       ← trỏ webhook SePay/Casso vào đây (cần Authorization)');
  console.log('  GET  /pro/status    ← app gọi để biết đã thanh toán chưa');
  console.log('  GET  /pro/content   ← trả nội dung Pro (HSK 4–9) sau khi xác thực');
  console.log('  POST /api/ai        ← proxy AI (giữ key ở server)');
  console.log('  POST /api/pron      ← chấm phát âm (Azure) ' + (AZURE_SPEECH_KEY ? 'đã bật ✓' : 'CHƯA CẤU HÌNH → client tự đánh giá sơ bộ'));
  console.log('  Khoá webhook: ' + (SECRET ? 'đã đặt ✓' : 'CHƯA ĐẶT ⚠'));
  console.log('  Chữ ký HMAC : ' + (HMAC_SECRET ? 'đã bật ✓' : 'tắt (khuyến nghị bật)'));
});
