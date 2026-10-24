/* ═══════════════════════════════════════════════════════════════
   GOPINYIN — LUYỆN PHÁT ÂM (Pronunciation Practice)
   ───────────────────────────────────────────────────────────────
   Chế độ thứ hai của app: nói tiếng Trung bằng micro và nhận phản hồi
   theo từng chữ Hán. Dùng CHUNG kho câu / pinyin / nghĩa với màn Luyện gõ
   (không có bản sao dữ liệu nào).

   KIẾN TRÚC (tách lớp, không viết thành một component khổng lồ):
     · PronRepo      — lấy nội dung từ kho hiện có (bridge window.__gpBridge)
     · PronStore     — lưu tiến độ + lịch sử lượt nói
     · PronTts       — phát âm mẫu (speechSynthesis, zh-CN)
     · PronMic       — xin quyền, thu âm, đo mức âm lượng, phát lại bản ghi
     · PronAsr       — nhận dạng giọng nói (Web Speech API)
     · PronAssess    — căn chỉnh + chấm điểm (local) hoặc gọi server (chuẩn)
     · PronUI        — vẽ màn hình, trạng thái, kết quả

   ★ NGUYÊN TẮC TRUNG THỰC VỀ ĐIỂM SỐ (rất quan trọng):
     Web Speech API chỉ trả về VĂN BẢN nhận dạng. Vì vậy mặc định app chỉ
     báo "ĐỘ KHỚP NỘI DUNG" (bao nhiêu chữ Hán được nhận đúng) và ghi rõ
     đây là đánh giá SƠ BỘ, KHÔNG phải điểm phát âm chuyên dụng.
     Chỉ khi cấu hình dịch vụ chấm phát âm thật (Azure Pronunciation
     Assessment qua /api/pron) thì mới hiện "ĐIỂM PHÁT ÂM" + điểm từng âm.
     Tuyệt đối không suy ra điểm phát âm từ văn bản nhận dạng.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Hằng số ── */
  const GOOD = 75;                 // ngưỡng "phát âm tốt" (thang 100)
  const MIN_CONF = 0.55;           // dưới ngưỡng này → coi là "chưa đủ dữ liệu"
  const MAX_MS = 15000;            // tự dừng ghi âm sau 15 giây
  const SILENCE_MS = 1600;         // im lặng bao lâu thì tự kết thúc câu
  const SILENCE_RMS = 0.018;       // ngưỡng coi là "có tiếng"
  const STORE_PREFIX = 'gp:pron:v1:';
  const SETTINGS_KEY = 'gp:pron:settings';
  const RECENT_MAX = 60;           // số lượt nói giữ lại để tính chuỗi

  const TONE_TIP = {
    1: 'Thanh 1 — cao và ngang, giữ đều giọng.',
    2: 'Thanh 2 — giọng đi lên như đang hỏi lại.',
    3: 'Thanh 3 — hạ thấp rồi nâng lên (xuống rồi lên).',
    4: 'Thanh 4 — giọng đi xuống dứt khoát.',
    0: 'Thanh nhẹ — đọc nhẹ và ngắn, không nhấn.'
  };
  const TONE_MARK = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
  };

  /* ── Trạng thái ── */
  const S = {
    ready: false,
    items: [],          // [{id, zh, py, vi}]
    order: [],          // chỉ số theo bộ lọc
    index: 0,
    source: 'current',
    sources: [],
    settings: {
      rate: 1, voice: '', autoSample: false, autoNext: false,
      showPy: true, showHan: true, showVi: true, filter: 'all'
    },
    phase: 'idle',      // idle|requesting|recording|analyzing|result|error
    result: null,
    detailIdx: -1,
    sessionTries: 0,
    lastError: '',
    /* runtime */
    stream: null, rec: null, chunks: [], blobUrl: '',
    actx: null, analyser: null, freq: null, raf: 0,
    hasSpeech: false, lastLoud: 0, startedAt: 0,
    timer: 0, maxTimer: 0, silenceTimer: 0,
    asr: null, asrText: '', asrConf: null, asrErr: '', asrDone: null,
    busy: false, record: null,   // record = kết quả chấm của lượt hiện tại
    progress: null,
    serverAssess: null           // {ok:bool, note:string} — dò 1 lần
  };

  /* ── Tiện ích ── */
  const $ = (id) => document.getElementById(id);
  function B() { return window.__gpBridge || null; }
  function esc(s) { const b = B(); return b ? b.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(m, k, ms) { const b = B(); if (b) { try { b.toast(m, k, ms); return; } catch (e) { } } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function toneOf(syl) { for (const ch of String(syl || '')) { if (TONE_MARK[ch]) return TONE_MARK[ch]; } return 0; }
  function isHan(ch) { const b = B(); return b ? b.isHanChar(ch) : /[\u3400-\u9fff]/.test(ch); }
  function hanChars(s) { const b = B(); return b ? b.hanChars(s) : Array.from(String(s || '')).filter(isHan); }
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsJson(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }

  /* ═══════════════════════════════════════════════════════════
     PronRepo — nội dung lấy từ kho sẵn có
     ═══════════════════════════════════════════════════════════ */
  const PronRepo = {
    async sources() {
      const out = [];
      const b = B(); if (!b) return out;
      const cur = b.rows() || [];
      if (cur.length) out.push({ id: 'current', label: '📌 Bộ đang mở (' + cur.length + ' mục)' });
      let sets = [];
      try { sets = await b.dbGetAll(); } catch (e) { }
      for (const s of sets) {
        if (!s || !Array.isArray(s.rows) || !s.rows.length) continue;
        if (s.kind === 'ai' || String(s.id || '').startsWith('ai:')) continue;
        out.push({ id: 'ds:' + s.id, label: '💾 ' + (s.name || 'Bộ đã lưu') + ' (' + s.rows.length + ')' });
      }
      const H = b.hskData() || {};
      for (const k of Object.keys(H)) {
        const a = H[k];
        if (!Array.isArray(a) || !a.length) continue;
        const lvl = Number(String(k).replace(/[^0-9]/g, '')) || 0;
        if (!lvl) continue;   /* bỏ mảng meta HSK_DATA.hsk */
        out.push({ id: 'hsk:' + k, label: 'HSK ' + lvl + ' (' + a.length + ')' + (lvl >= 4 ? ' 🔒' : '') });
      }
      return out;
    },

    /* Danh mục cho MÀN CHỌN BỘ CÂU (giống Thư viện bên Luyện gõ).
       Trả về cấu trúc có sẵn số câu + cờ Pro để vẽ thẻ, không phải đoán
       từ chuỗi nhãn như sources(). */
    async catalog() {
      const out = { hsk: [], sets: [], current: null };
      const b = B(); if (!b) return out;
      const H = b.hskData() || {};
      const keys = Object.keys(H).sort((x, y) => {
        const n = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
        return n(x) - n(y);
      });
      for (const k of keys) {
        const a = H[k] || [];
        if (!Array.isArray(a) || !a.length) continue;
        const lvl = Number(String(k).replace(/[^0-9]/g, '')) || 0;
        /* ★ HSK_DATA.hsk là MẢNG META ([key, nhãn, số câu]), không phải một cấp
           → trước đây sinh ra thẻ "HSK 0 (9)" vô nghĩa. */
        if (!lvl) continue;
        /* ★ Tiến độ GÕ của đúng cấp này bên màn Luyện gõ (bộ 'vocab:hsk<N>') —
           để thẻ HSK hiện được "đã gõ x/N" ngay cả khi chưa luyện nói câu nào. */
        let typed = 0;
        try {
          const p = b.loadProgress ? b.loadProgress('vocab:' + k) : null;
          if (p) typed = Math.min(Math.max(p.mainIndex || 0, 0), a.length);
        } catch (e) { typed = 0; }
        out.hsk.push({ id: 'hsk:' + k, name: 'HSK ' + lvl, lvl, count: a.length, locked: lvl >= 4, done: typed });
      }
      const cur = b.rows() || [];
      if (cur.length) out.current = { id: 'current', name: 'Bộ đang mở', count: cur.length };
      let sets = [];
      try { sets = await b.dbGetAll(); } catch (e) { }
      for (const s of sets) {
        if (!s || !Array.isArray(s.rows) || !s.rows.length) continue;
        /* ★ D.1: bộ AI đã lưu (kind==='ai') CHỈ hiện ở màn "AI sinh câu",
           không hiện ở Luyện phát âm. (sources() đã lọc, catalog() cũng phải lọc.) */
        if (s.kind === 'ai' || String(s.id || '').startsWith('ai:')) continue;
        out.sets.push({ id: 'ds:' + s.id, name: s.name || 'Bộ đã lưu', count: s.rows.length, locked: false });
      }
      /* ★ Đã bỏ danh sách "Bộ câu của bạn (đã học)" — tiến độ nay hiện ngay
         trên từng thẻ HSK (xem out.hsk[].done + libCardHtml). */
      return out;
    },

    /* Khoá tiến độ: bộ đang mở dùng chung khoá với chính bộ đó trong thư viện,
       để tiến độ không bị tách làm hai khi mở từ hai nơi khác nhau. */
    keyOf(srcId) {
      if (srcId === 'current') {
        const b = B(); const d = b && b.activeDataset && b.activeDataset();
        return d && d.id ? 'ds:' + d.id : 'current';
      }
      return srcId;
    },

    async load(srcId) {
      const b = B(); if (!b) return [];
      let raw = [];
      if (srcId === 'current') {
        raw = (b.rows() || []).map((r, i) => ({ id: 'c' + i + ':' + (r.id != null ? r.id : i), zh: r.zh, py: r.py, vi: r.vi }));
      } else if (srcId.startsWith('ds:')) {
        const id = srcId.slice(3);
        let sets = [];
        try { sets = await b.dbGetAll(); } catch (e) { }
        const ds = sets.find(x => x && x.id === id);
        raw = (ds && ds.rows || []).map((r, i) => ({ id: 'd' + i + ':' + (r.id != null ? r.id : i), zh: r.zh, py: r.py, vi: r.vi }));
      } else if (srcId.startsWith('hsk:')) {
        const k = srcId.slice(4);
        const a = (b.hskData() || {})[k] || [];
        raw = a.map((x, i) => ({ id: 'h' + i, zh: x[0], py: x[1], vi: x[2] }));
      }
      /* chỉ giữ mục có chữ Hán thật (bỏ câu rỗng / không phải chữ Hán) */
      return raw.filter(it => it && hanChars(it.zh).length);
    },

    /* Âm tiết chuẩn ứng với từng chữ Hán của 1 mục */
    syllables(item) {
      const b = B(); if (!b) return [];
      const n = hanChars(item.zh).length;
      let marked = [];
      try { marked = b.answerWords(item).marked || []; } catch (e) { marked = []; }
      let map = [];
      try { map = b.hanSyllableList(item, n) || []; } catch (e) { map = []; }
      const out = [];
      for (let i = 0; i < n; i++) {
        const si = map[i];
        out.push(si != null && marked[si] ? marked[si] : (marked[i] || ''));
      }
      return out;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronStore — tiến độ + lịch sử
     Mỗi mục: {n: số lượt, best, last, good, at}
     Tiến độ tổng hợp KHÁC với lịch sử: nói lại 3 lần vẫn là 1 mục đã luyện.
     ═══════════════════════════════════════════════════════════ */
  const PronStore = {
    load(key) {
      const d = lsJson(STORE_PREFIX + key, null);
      if (!d || typeof d !== 'object') return { v: 1, byId: {}, index: 0, recent: [] };
      return { v: 1, byId: d.byId || {}, index: d.index || 0, recent: Array.isArray(d.recent) ? d.recent : [] };
    },
    save(key) {
      if (!S.progress) return;
      const p = S.progress;
      if (p.recent.length > RECENT_MAX) p.recent = p.recent.slice(-RECENT_MAX);
      lsSet(STORE_PREFIX + key, JSON.stringify(p));
    },
    rec(id) { return (S.progress && S.progress.byId[id]) || null; },
    add(item, score, good) {
      if (!S.progress) return;
      const id = item.id;
      const cur = S.progress.byId[id] || { n: 0, best: 0, last: 0, good: false, at: 0 };
      cur.n++;
      cur.last = score;
      cur.best = Math.max(cur.best || 0, score);
      cur.good = cur.best >= GOOD;
      cur.at = Date.now();
      S.progress.byId[id] = cur;
      S.progress.recent.push({ at: cur.at, id: id, score: score, good: good });
      PronStore.save(PronRepo.keyOf(S.source));
    },
    reset(key) {
      try { localStorage.removeItem(STORE_PREFIX + key); } catch (e) { }
      S.progress = { v: 1, byId: {}, index: 0, recent: [] };
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronTts — đọc câu mẫu
     ═══════════════════════════════════════════════════════════ */
  const PronTts = {
    supported() { return 'speechSynthesis' in window; },
    speak(text, opts) {
      if (!this.supported() || !text) return;
      const o = opts || {};
      try { window.speechSynthesis.cancel(); } catch (e) { }
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'zh-CN';
      u.rate = Number(o.rate) || S.settings.rate || 1;
      const v = this.pickVoice();
      if (v) u.voice = v;
      if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
      try { window.speechSynthesis.speak(u); } catch (e) { }
    },
    pickVoice() {
      if (!this.supported()) return null;
      let all = [];
      try { all = window.speechSynthesis.getVoices() || []; } catch (e) { return null; }
      const zh = all.filter(v => /^zh/i.test(v.lang || '') || /Chinese|Mandarin|Xiaoxiao|Yaoyao|Huihui|Yunxi|Yunjian|Kangkang/i.test(v.name || ''));
      if (!zh.length) return null;
      if (S.settings.voice) {
        const hit = zh.find(v => v.name === S.settings.voice);
        if (hit) return hit;
      }
      return zh.find(v => /CN|Hans|zh-CN/i.test((v.lang || '') + ' ' + (v.name || ''))) || zh[0];
    },
    voices() {
      if (!this.supported()) return [];
      let all = [];
      try { all = window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
      return all.filter(v => /^zh/i.test(v.lang || '') || /Chinese|Mandarin|Xiaoxiao|Yaoyao|Huihui|Yunxi|Yunjian|Kangkang/i.test(v.name || ''));
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronMic — quyền micro · thu âm · đo âm lượng · phát lại
     ═══════════════════════════════════════════════════════════ */
  const PronMic = {
    supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    async acquire() {
      /* ★ Dùng lại stream đang mở nếu còn sống.
         Người dùng phàn nàn: "mỗi lần sang một câu lại phải cấp quyền cho
         micro". Nguyên nhân là release() cũ DỪNG hết track sau MỖI lượt nói,
         nên lượt sau gọi lại getUserMedia → Chrome hỏi quyền lại (nhất là khi
         lần đầu chọn "Cho phép lần này"). Nay stream được giữ suốt phiên luyện,
         chỉ đóng khi rời màn hình. */
      if (S.stream && this.alive()) return S.stream;
      if (S.stream) { try { S.stream.getTracks().forEach(t => t.stop()); } catch (e) { } S.stream = null; }
      if (!this.supported()) throw new Error('no-mediadevices');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      S.stream = stream;
      /* Thiết bị bị rút / quyền bị thu hồi giữa phiên → lần sau xin lại */
      try {
        stream.getAudioTracks().forEach(t => {
          t.addEventListener('ended', () => { if (S.stream === stream) S.stream = null; });
        });
      } catch (e) { }
      return stream;
    },
    /* Stream còn dùng được không (track chưa kết thúc và vẫn "live") */
    alive() {
      if (!S.stream) return false;
      try {
        const ts = S.stream.getAudioTracks();
        return ts.length > 0 && ts.every(t => t.readyState === 'live' && t.enabled);
      } catch (e) { return false; }
    },
    /* Quyền micro đã được cấp vĩnh viễn cho origin này chưa (không phải hỏi lại) */
    async permission() {
      try {
        if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
        const st = await navigator.permissions.query({ name: 'microphone' });
        return st.state || 'unknown';
      } catch (e) { return 'unknown'; }
    },
    /* Bắt đầu đo âm lượng (vẽ sóng + phát hiện im lặng) */
    startMeter(stream) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        S.actx = new Ctx();
        const src = S.actx.createMediaStreamSource(stream);
        const an = S.actx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.75;
        src.connect(an);
        S.analyser = an;
        S.freq = new Uint8Array(an.frequencyBinCount);
        S.hasSpeech = false;
        S.lastLoud = Date.now();
        const loop = () => {
          if (!S.analyser) return;
          S.analyser.getByteFrequencyData(S.freq);
          let sum = 0;
          const n = Math.min(64, S.freq.length);
          for (let i = 0; i < n; i++) sum += S.freq[i];
          const rms = (sum / n) / 255;
          drawMeter(rms);
          if (rms > SILENCE_RMS) { S.hasSpeech = true; S.lastLoud = Date.now(); }
          /* tự kết thúc khi đã nói xong và im lặng đủ lâu */
          if (S.hasSpeech && Date.now() - S.lastLoud > SILENCE_MS) { stopRecording('silence'); return; }
          S.raf = requestAnimationFrame(loop);
        };
        S.raf = requestAnimationFrame(loop);
      } catch (e) { /* không đo được âm lượng thì vẫn ghi âm bình thường */ }
    },
    stopMeter() {
      if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
      if (S.actx) { try { S.actx.close(); } catch (e) { } S.actx = null; }
      S.analyser = null;
      drawMeter(0);
    },
    startRecorder(stream) {
      if (!window.MediaRecorder) return;
      try {
        S.chunks = [];
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => {
          try { return window.MediaRecorder.isTypeSupported(m); } catch (e) { return false; }
        });
        S.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        S.rec.ondataavailable = (e) => { if (e.data && e.data.size) S.chunks.push(e.data); };
        S.rec.onstop = () => {
          if (!S.chunks.length) return;
          try {
            const blob = new Blob(S.chunks, { type: S.chunks[0].type || 'audio/webm' });
            if (S.blobUrl) { try { URL.revokeObjectURL(S.blobUrl); } catch (e) { } }
            S.blobUrl = URL.createObjectURL(blob);
            const pb = $('pronPlayMineBtn');
            if (pb) pb.disabled = false;
          } catch (e) { }
        };
        S.rec.start();
      } catch (e) { S.rec = null; }
    },
    stopRecorder() { try { if (S.rec && S.rec.state !== 'inactive') S.rec.stop(); } catch (e) { } S.rec = null; },
    /* ★ release() = "nhả nhẹ": chỉ tắt đo âm lượng + dừng bản ghi, GIỮ track
       micro để lượt sau không phải xin quyền lại. Muốn đóng hẳn thì hardRelease(). */
    release() {
      this.stopMeter();
      this.stopRecorder();
    },
    /* Đóng micro thật — chỉ gọi khi rời màn luyện phát âm / rời trang */
    hardRelease() {
      this.stopMeter();
      this.stopRecorder();
      if (S.stream) { try { S.stream.getTracks().forEach(t => t.stop()); } catch (e) { } S.stream = null; }
    },
    playMine() {
      if (!S.blobUrl) return;
      const a = new Audio(S.blobUrl);
      a.play().catch(() => toast('Không phát lại được bản ghi này.', 'warn'));
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronAsr — nhận dạng giọng nói (chỉ để lấy NỘI DUNG đã nói)
     ═══════════════════════════════════════════════════════════ */
  const PronAsr = {
    Ctor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; },
    supported() { return !!this.Ctor(); },
    start() {
      S.asrText = ''; S.asrConf = null; S.asrErr = ''; S.asrDone = null;
      const C = this.Ctor();
      if (!C) return false;
      let r;
      try { r = new C(); } catch (e) { return false; }
      r.lang = 'zh-CN';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      S.asrDone = new Promise((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        r.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const alt = res[0] || {};
            if (res.isFinal) {
              S.asrText += (alt.transcript || '');
              if (typeof alt.confidence === 'number' && alt.confidence > 0) {
                S.asrConf = S.asrConf == null ? alt.confidence : Math.min(S.asrConf, alt.confidence);
              }
            } else {
              interim += alt.transcript || '';
            }
          }
          S.asrInterim = interim;
          const st = $('pronStatus');
          if (st && S.phase === 'recording' && interim) {
            st.dataset.interim = '1';
            st.innerHTML = '<span class="pronDot"></span>Đang nghe… <b class="pronInterim">' + esc(interim) + '</b>';
          }
        };
        r.onerror = (e) => {
          S.asrErr = (e && e.error) || 'unknown';
          if (S.asrErr === 'no-speech') { /* để onend xử lý */ }
          done();
        };
        r.onend = () => { done(); };
      });
      try { r.start(); } catch (e) { return false; }
      S.asr = r;
      return true;
    },
    stop() {
      if (!S.asr) return;
      try { S.asr.stop(); } catch (e) { }
      S.asr = null;
    },
    wait(ms) {
      if (!S.asrDone) return Promise.resolve();
      return Promise.race([S.asrDone, new Promise(r => setTimeout(r, ms || 2500))]);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronWav — chuyển bản ghi (webm/opus) sang WAV 16 kHz mono.
     Cần cho dịch vụ chấm phát âm: Azure chỉ nhận WAV PCM / OGG-OPUS,
     KHÔNG nhận webm. Chuyển ngay trong trình duyệt để không phải
     cài ffmpeg ở server.
     ═══════════════════════════════════════════════════════════ */
  const PronWav = {
    async encode(blob, rate) {
      const target = rate || 16000;
      const AC = window.AudioContext || window.webkitAudioContext;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC || !OAC) return null;
      let decoded = null;
      const tmp = new AC();
      try {
        decoded = await tmp.decodeAudioData(await blob.arrayBuffer());
      } catch (e) {
        try { tmp.close(); } catch (x) { }
        return null;
      }
      try { tmp.close(); } catch (e) { }
      try {
        const frames = Math.max(1, Math.ceil(decoded.duration * target));
        const off = new OAC(1, frames, target);
        const src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start(0);
        const rendered = await off.startRendering();
        return this.toWav(rendered);
      } catch (e) { return null; }
    },
    toWav(buffer) {
      const ch = buffer.getChannelData(0);
      const len = ch.length;
      const out = new ArrayBuffer(44 + len * 2);
      const v = new DataView(out);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE');
      w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      w(36, 'data'); v.setUint32(40, len * 2, true);
      let o = 44;
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
      return out;
    },
    toBase64(buf) {
      const bytes = new Uint8Array(buf);
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      }
      return btoa(s);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PronAssess — căn chỉnh chuỗi + chấm điểm
     ───────────────────────────────────────────────────────────
     Căn chỉnh bằng LCS (dãy con chung dài nhất) để xử lý được:
       · thiếu âm tiết (người nói bỏ chữ)
       · thừa âm tiết (nói thêm)
       · nhận nhầm âm tiết (thay thế)
     Không so khớp pinyin theo từng ký tự → tránh kết luận sai.
     ═══════════════════════════════════════════════════════════ */
  const PronAssess = {
    /* Trả về danh sách thao tác: match | sub | del | ins */
    align(exp, got) {
      const n = exp.length, m = got.length;
      const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i][j] = exp[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const raw = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (exp[i] === got[j]) { raw.push({ t: 'match', e: i, g: j }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { raw.push({ t: 'del', e: i }); i++; }
        else { raw.push({ t: 'ins', g: j }); j++; }
      }
      while (i < n) { raw.push({ t: 'del', e: i }); i++; }
      while (j < m) { raw.push({ t: 'ins', g: j }); j++; }
      /* gộp cặp "xoá + thêm" liền nhau thành "thay thế" (nhận nhầm âm) */
      const ops = [];
      for (let k = 0; k < raw.length; k++) {
        if (raw[k].t === 'del' && raw[k + 1] && raw[k + 1].t === 'ins') {
          ops.push({ t: 'sub', e: raw[k].e, g: raw[k + 1].g }); k++;
        } else ops.push(raw[k]);
      }
      return ops;
    },

    local(item, transcript, conf) {
      const exp = hanChars(item.zh);
      const got = hanChars(transcript);
      const syl = PronRepo.syllables(item);
      const base = {
        mode: 'local', transcript: transcript || '', scoreKind: 'content',
        total: exp.length, matched: 0, extra: 0, confidence: conf == null ? null : conf,
        chars: [], errors: [], notes: [], reliable: true
      };
      if (!exp.length) { base.reliable = false; base.notes.push('Mục này không có chữ Hán để chấm.'); return base; }
      if (!got.length) {
        base.reliable = false;
        base.score = 0;
        base.notes.push('Không nhận được chữ nào từ bản ghi.');
        base.chars = exp.map((ch, i) => ({ i, ch, py: syl[i] || '', tone: toneOf(syl[i]), status: 'unknown', got: '', score: null }));
        return base;
      }

      const ops = this.align(exp, got);
      const status = new Array(exp.length).fill('unknown');
      const gotFor = new Array(exp.length).fill('');
      let matched = 0, extra = 0;
      for (const op of ops) {
        if (op.t === 'match') { status[op.e] = 'good'; gotFor[op.e] = got[op.g]; matched++; }
        else if (op.t === 'sub') { status[op.e] = 'bad'; gotFor[op.e] = got[op.g]; }
        else if (op.t === 'del') { status[op.e] = 'bad'; gotFor[op.e] = ''; }
        else extra++;
      }

      /* Điểm: tỉ lệ chữ khớp trên độ dài chuỗi DÀI HƠN
         (vừa phạt thiếu chữ, vừa phạt nói thêm) */
      const denom = Math.max(exp.length, got.length);
      let score = Math.round(100 * matched / denom);

      /* Không đủ tin cậy → không kết luận chữ nào sai */
      const lowConf = conf != null && conf < MIN_CONF;
      const tooFew = matched / exp.length < 0.34;
      if (lowConf || tooFew) {
        base.reliable = false;
        for (let i = 0; i < status.length; i++) if (status[i] === 'bad') status[i] = 'unknown';
      }

      base.matched = matched;
      base.extra = extra;
      base.score = score;
      base.chars = exp.map((ch, i) => {
        const py = syl[i] || '';
        const st = status[i];
        let note = '';
        if (ch === '不' || ch === '一') note = '不/一 đổi thanh theo ngữ cảnh — không chấm thanh ở chữ này.';
        else if (st === 'bad' && gotFor[i]) note = 'Hệ thống nghe thành 「' + gotFor[i] + '」 — chú ý đọc đúng âm 「' + py + '」.';
        else if (st === 'bad' && !gotFor[i]) note = 'Chưa nghe được âm tiết này — đọc rõ và to hơn một chút.';
        else if (st === 'unknown') note = 'Chưa đủ dữ liệu để đánh giá chữ này.';
        return {
          i, ch, py, tone: toneOf(py), status: st, got: gotFor[i] || '',
          score: st === 'good' ? 100 : (st === 'bad' ? 0 : null), note
        };
      });

      /* Phân loại lỗi — chỉ nêu khi có bằng chứng */
      const missing = base.chars.filter(c => c.status === 'bad' && !c.got).length;
      const wrong = base.chars.filter(c => c.status === 'bad' && c.got).length;
      if (missing) base.errors.push({ type: 'missing', label: 'Thiếu âm tiết', count: missing });
      if (wrong) base.errors.push({ type: 'wrong', label: 'Nhận nhầm âm tiết', count: wrong });
      if (extra) base.errors.push({ type: 'extra', label: 'Nói thêm âm tiết', count: extra });
      if (!base.reliable) base.errors.push({ type: 'unknown', label: 'Chưa đủ dữ liệu để xác định lỗi', count: 1 });

      base.notes = base.notes.concat(this.remarks(base));
      return base;
    },

    /* Nhận xét sinh từ KẾT QUẢ THẬT, không phải câu khen/chê cố định */
    remarks(r) {
      const out = [];
      if (!r.reliable) {
        out.push('Chưa đủ dữ liệu để kết luận chi tiết. Hãy nói rõ hơn, chậm hơn và ở nơi yên tĩnh.');
        return out;
      }
      const pct = Math.round(100 * r.matched / Math.max(1, r.total));
      if (pct === 100) out.push('Nhận dạng đúng toàn bộ ' + r.total + ' chữ của câu.');
      else out.push('Nhận dạng đúng ' + r.matched + '/' + r.total + ' chữ (' + pct + '%).');
      const bad = r.chars.filter(c => c.status === 'bad');
      if (bad.length) {
        const list = bad.slice(0, 3).map(c => c.ch).join(' ');
        out.push('Chú ý các chữ được đánh dấu: ' + list + (bad.length > 3 ? '…' : '') + '.');
      }
      if (r.extra) out.push('Có ' + r.extra + ' âm tiết nói thêm ngoài câu mẫu.');
      return out;
    },

    /* Gọi dịch vụ chấm phát âm thật (nếu server đã cấu hình).
       Không cấu hình → trả null và app dùng đánh giá sơ bộ.
       Gửi JSON base64 để server không cần thư viện parse multipart. */
    async server(item, blob) {
      if (!blob) return null;
      if (S.serverAssess && S.serverAssess.ok === false) return null;
      try {
        /* Dịch vụ chấm phát âm cần WAV 16 kHz mono — chuyển ngay ở máy người dùng */
        const wav = await PronWav.encode(blob, 16000);
        if (!wav) return null;
        /* Cho phép đặt endpoint ở origin khác (vd. hosting tĩnh + API riêng):
           <script>window.PRON_API='https://api.example.com/pron'</script> */
        const url = (typeof window !== 'undefined' && window.PRON_API) || '/api/pron';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio: PronWav.toBase64(wav),
            mime: 'audio/wav',
            text: String(item.zh || '')
          })
        });
        if (res.status === 501 || res.status === 404) {
          S.serverAssess = { ok: false, note: 'Chưa cấu hình dịch vụ chấm phát âm.' };
          return null;
        }
        if (!res.ok) { S.serverAssess = { ok: false, note: 'Dịch vụ chấm phát âm lỗi ' + res.status }; return null; }
        const data = await res.json();
        if (!data || !data.ok || typeof data.pronScore !== 'number') {
          S.serverAssess = { ok: false, note: 'Dịch vụ không trả điểm phát âm.' };
          return null;
        }
        S.serverAssess = { ok: true, note: '' };
        return this.fromServer(item, data);
      } catch (e) {
        S.serverAssess = { ok: false, note: 'Không gọi được dịch vụ chấm phát âm.' };
        return null;
      }
    },

    fromServer(item, data) {
      const exp = hanChars(item.zh);
      const syl = PronRepo.syllables(item);
      const words = Array.isArray(data.words) ? data.words : [];
      const chars = exp.map((ch, i) => {
        const w = words[i] || null;
        const acc = w && typeof w.accuracy === 'number' ? w.accuracy : null;
        const err = w && w.errorType ? String(w.errorType) : '';
        let st = 'unknown';
        if (acc != null) st = acc >= GOOD ? 'good' : (acc >= 50 ? 'warn' : 'bad');
        return {
          i, ch, py: syl[i] || '', tone: toneOf(syl[i]), status: st,
          got: (w && w.text) || '', score: acc,
          note: err ? ('Lỗi: ' + err) : ''
        };
      });
      const errors = [];
      const tally = {};
      for (const w of words) {
        const t = w && w.errorType;
        if (t && t !== 'None' && t !== 'none') tally[t] = (tally[t] || 0) + 1;
      }
      for (const k of Object.keys(tally)) errors.push({ type: k, label: k, count: tally[k] });
      const r = {
        mode: 'server', scoreKind: 'pron', transcript: data.text || '',
        score: Math.round(data.pronScore),
        total: exp.length,
        matched: chars.filter(c => c.status === 'good').length,
        extra: 0, confidence: typeof data.confidence === 'number' ? data.confidence : null,
        accuracy: typeof data.accuracy === 'number' ? Math.round(data.accuracy) : null,
        fluency: typeof data.fluency === 'number' ? Math.round(data.fluency) : null,
        prosody: typeof data.prosody === 'number' ? Math.round(data.prosody) : null,
        chars, errors, reliable: true, notes: []
      };
      r.notes = this.remarks(r);
      return r;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Luồng ghi âm
     ═══════════════════════════════════════════════════════════ */
  function setPhase(p, msg) {
    S.phase = p;
    const btn = $('pronMicBtn');
    const st = $('pronStatus');
    if (btn) {
      btn.classList.toggle('is-rec', p === 'recording');
      btn.classList.toggle('is-busy', p === 'analyzing' || p === 'requesting');
      btn.disabled = (p === 'analyzing' || p === 'requesting');
      const txt = btn.querySelector('.pronMicTxt');
      const sub = btn.querySelector('.pronMicSub');
      if (txt) txt.textContent = p === 'recording' ? 'Đang nghe… bấm để dừng'
        : (p === 'analyzing' ? 'Đang phân tích…'
          : (p === 'requesting' ? 'Đang xin quyền micro…'
            : (S.result ? 'Nhấn để nói lại' : 'Nhấn để bắt đầu nói')));
      if (sub) sub.innerHTML = p === 'recording' ? 'hoặc nhấn <b>Enter</b> để dừng'
        : (p === 'idle' ? 'hoặc nhấn <b>Enter</b>' : '');
    }
    if (st) {
      st.className = 'pronStatus' + (p === 'error' ? ' is-err' : (p === 'result' ? ' is-ok' : (p === 'analyzing' ? ' is-busy' : '')));
      if (msg != null) st.innerHTML = msg;
      else if (p === 'idle') st.innerHTML = '';
    }
    const tm = $('pronTimer');
    if (tm) tm.classList.toggle('hidden', p !== 'recording');
    /* đổi trạng thái → vẽ lại "đường nền" (khi không ghi âm) hoặc để vòng lặp sóng tiếp quản */
    if (p !== 'recording') drawMeter(0);
  }

  function fmtSec(ms) { return (ms / 1000).toFixed(1) + 's'; }

  async function beginRecording() {
    if (S.busy) return;
    if (S.phase === 'recording') { stopRecording('manual'); return; }
    if (!S.items.length) return;

    if (!PronMic.supported()) {
      setPhase('error', '⚠️ Trình duyệt không cho truy cập micro trên trang này. Hãy mở bằng <b>Chrome</b> hoặc <b>Edge</b> qua <b>https</b> (hoặc localhost).');
      return;
    }
    if (!PronAsr.supported()) {
      setPhase('error', '⚠️ Trình duyệt này không hỗ trợ nhận dạng giọng nói (Web Speech API). Hãy dùng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính để luyện phát âm.');
      return;
    }

    setPhase('requesting', '🎙 Đang xin quyền micro…');
    let stream;
    try {
      stream = await PronMic.acquire();
    } catch (e) {
      const name = (e && e.name) || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPhase('error', '🚫 Micro chưa được cấp quyền. Bấm vào biểu tượng <b>🔒</b> cạnh thanh địa chỉ → cho phép <b>Micro</b>, rồi thử lại.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPhase('error', '🎧 Không tìm thấy micro nào trên máy. Hãy cắm tai nghe có micro hoặc kiểm tra thiết bị âm thanh.');
      } else {
        setPhase('error', '⚠️ Không mở được micro (' + esc(name || 'lỗi không rõ') + '). Kiểm tra lại thiết bị rồi thử lại.');
      }
      return;
    }

    /* lượt mới — không dùng lại âm thanh / kết quả của lượt trước */
    S.record = null;
    S.busy = false;
    /* Nhắc 1 lần: nếu quyền chỉ được cấp "lần này" thì lần sau mở trang vẫn
       phải cấp lại — hướng dẫn chọn "Cho phép mỗi khi truy cập trang web". */
    if (!S.permHintShown) {
      S.permHintShown = true;
      if (!isFileProto()) {
        PronMic.permission().then((p) => {
          if (p === 'prompt') toast('Mẹo: khi Chrome hỏi micro, chọn “Cho phép mỗi khi truy cập trang web” để không phải cấp lại lần sau.', 'warn', 6000);
        });
      }
    }
    PronMic.startRecorder(stream);
    PronMic.startMeter(stream);
    PronAsr.start();

    S.startedAt = Date.now();
    setPhase('recording', '<span class="pronDot"></span>Đang nghe… hãy nói câu ở trên.');
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(() => {
      const tm = $('pronTimer');
      if (tm) tm.textContent = fmtSec(Date.now() - S.startedAt);
    }, 100);
    if (S.maxTimer) clearTimeout(S.maxTimer);
    S.maxTimer = setTimeout(() => stopRecording('timeout'), MAX_MS);
  }

  async function stopRecording(reason) {
    if (S.phase !== 'recording') return;
    if (S.timer) { clearInterval(S.timer); S.timer = 0; }
    if (S.maxTimer) { clearTimeout(S.maxTimer); S.maxTimer = 0; }
    const dur = Date.now() - S.startedAt;
    const spoke = S.hasSpeech;

    PronMic.stopMeter();
    PronMic.stopRecorder();
    PronAsr.stop();
    setPhase('analyzing', '<span class="pronSpinner"></span>Đang phân tích phát âm…');

    /* chờ kết quả nhận dạng cuối cùng (tối đa 2.5s để không treo UI) */
    await PronAsr.wait(2500);

    const transcript = (S.asrText || '').trim();

    /* ★ Chỉ coi là "quá ngắn" khi KHÔNG có cả nội dung nhận dạng lẫn tín hiệu
       âm thanh. Người nói từ ngắn rất nhanh (0.3–0.4 giây) hoặc micro thu nhỏ
       vẫn phải được chấm bình thường — trước đây kiểm tra thời lượng trước nên
       các lượt này bị từ chối oan. */
    if (!transcript && dur < 450 && !spoke) {
      PronMic.release();
      S.busy = false;
      setPhase('error', '⏱ Âm thanh quá ngắn. Hãy bấm micro rồi nói cả câu ngay, đừng chờ.');
      return;
    }

    if (S.asrErr === 'not-allowed' || S.asrErr === 'service-not-allowed') {
      PronMic.release();
      setPhase('error', '🚫 Trình duyệt chặn nhận dạng giọng nói. Hãy cấp quyền micro và thử lại.');
      return;
    }
    if (S.asrErr === 'network') {
      PronMic.release();
      setPhase('error', '📡 Mất kết nối tới dịch vụ nhận dạng giọng nói. Kiểm tra mạng rồi thử lại.');
      return;
    }
    if (!transcript) {
      PronMic.release();
      setPhase('error', spoke
        ? '🔇 Chưa nghe rõ giọng nói của bạn. Hãy kiểm tra micro và thử nói lại trong môi trường yên tĩnh hơn.'
        : '🔇 Không phát hiện giọng nói. Hãy bấm micro rồi nói to, rõ hơn.');
      return;
    }

    await finishAssessment(transcript, S.asrConf);
  }

  async function finishAssessment(transcript, conf) {
    const item = currentItem();
    if (!item) { setPhase('idle'); return; }
    S.busy = true;

    /* 1) Thử dịch vụ chấm phát âm thật (nếu có cấu hình) */
    let result = null;
    try {
      const blob = S.chunks.length ? new Blob(S.chunks, { type: S.chunks[0].type || 'audio/webm' }) : null;
      result = await PronAssess.server(item, blob);
    } catch (e) { result = null; }

    /* 2) Không có → đánh giá sơ bộ độ khớp nội dung từ văn bản nhận dạng */
    if (!result) result = PronAssess.local(item, transcript, conf);

    S.result = result;
    S.sessionTries++;
    S.busy = false;
    PronMic.release();

    PronStore.add(item, result.score, result.score >= GOOD);
    S.record = result;
    renderStats();
    renderHanzi();
    renderResult();
    setPhase('result', '');
    updateMicLabel();

    if (S.settings.autoNext) {
      if (S.silenceTimer) clearTimeout(S.silenceTimer);
      S.silenceTimer = setTimeout(() => { if (S.phase === 'result' && S.settings.autoNext) nextItem(); }, 3600);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Điều hướng câu
     ═══════════════════════════════════════════════════════════ */
  function currentItem() { return S.items[S.order[S.index]] || null; }

  function rebuildOrder(keepId) {
    const f = S.settings.filter;
    const all = S.items.map((it, i) => i);
    const rec = (i) => PronStore.rec(S.items[i].id);
    let ord = all;
    if (f === 'new') ord = all.filter(i => !rec(i));
    else if (f === 'redo') ord = all.filter(i => { const r = rec(i); return r && r.best < GOOD; });
    else if (f === 'done') ord = all.filter(i => { const r = rec(i); return r && r.best >= GOOD; });
    S.order = ord.length ? ord : all;
    let idx = 0;
    if (keepId) {
      const k = S.order.findIndex(i => S.items[i].id === keepId);
      if (k >= 0) idx = k;
    }
    S.index = clamp(idx, 0, Math.max(0, S.order.length - 1));
  }

  function gotoItem(pos) {
    if (!S.order.length) return;
    const p = clamp(pos, 0, S.order.length - 1);
    if (p === S.index && S.record) return;
    S.index = p;
    S.result = null; S.record = null;
    hideDetail();
    PronMic.release();
    setPhase('idle', '');
    renderCard();
    renderResult();
    renderStats();
    saveIndex();
    if (S.settings.autoSample) setTimeout(() => PronTts.speak(currentItem() && currentItem().zh), 220);
  }

  function nextItem() {
    if (!S.order.length) return;
    if (S.index >= S.order.length - 1) {
      S.index = S.order.length;           // vượt cuối → hiện màn hoàn thành
      renderComplete();
      return;
    }
    gotoItem(S.index + 1);
  }

  function prevItem() { if (S.index > 0) gotoItem(S.index - 1); }

  function skipItem() {
    /* Bỏ qua KHÔNG tính là đã luyện thành công, nhưng vẫn ghi nhận đã xem */
    const it = currentItem();
    if (it) {
      const r = PronStore.rec(it.id);
      if (!r) {
        S.progress.byId[it.id] = { n: 0, best: 0, last: 0, good: false, at: Date.now(), skipped: true };
        PronStore.save(PronRepo.keyOf(S.source));
      }
    }
    toast('⏭ Đã bỏ qua — câu này không được tính là đã luyện tốt.', 'warn', 2400);
    nextItem();
    renderStats();
  }

  function saveIndex() {
    if (!S.progress) return;
    S.progress.index = S.index;
    PronStore.save(PronRepo.keyOf(S.source));
  }

  /* ═══════════════════════════════════════════════════════════
     Vẽ — thống kê
     ═══════════════════════════════════════════════════════════ */
  function stats() {
    const total = S.items.length;
    const byId = (S.progress && S.progress.byId) || {};
    let attempted = 0, good = 0, sumBest = 0, nBest = 0;
    for (const it of S.items) {
      const r = byId[it.id];
      if (!r || !r.n) continue;
      attempted++;
      sumBest += r.best || 0; nBest++;
      if ((r.best || 0) >= GOOD) good++;
    }
    const recent = (S.progress && S.progress.recent) || [];
    let streak = 0;
    for (let i = recent.length - 1; i >= 0; i--) { if (recent[i].good) streak++; else break; }
    return {
      total, attempted, good, need: Math.max(0, attempted - good),
      avg: nBest ? Math.round(sumBest / nBest) : 0,
      streak, tries: S.sessionTries
    };
  }

  function renderStats() {
    const s = stats();
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('pronProg', s.attempted + '/' + s.total);
    set('pronGood', s.good);
    set('pronNeed', s.need);
    set('pronStreak', s.streak);
    set('pronAvg', s.attempted ? s.avg : '—');
    set('pronTries', s.tries);
    const bar = $('pronBar');
    if (bar) bar.style.width = (s.total ? (100 * s.attempted / s.total) : 0) + '%';
    const info = $('pronInfo');
    if (info) {
      const src = (S.sources.find(x => x.id === S.source) || {}).label || '';
      info.textContent = src + ' • ' + s.total + ' câu • đã luyện ' + s.attempted + ' • đạt mục tiêu ' + s.good + ' (ngưỡng ' + GOOD + '/100)';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Vẽ — thẻ câu
     ═══════════════════════════════════════════════════════════ */
  function renderCard() {
    const it = currentItem();
    const area = $('pronArea'), comp = $('pronComplete');
    if (!area) return;
    if (!it) {
      area.classList.add('hidden');
      if (comp) comp.classList.remove('hidden');
      renderComplete();
      return;
    }
    area.classList.remove('hidden');
    if (comp) comp.classList.add('hidden');

    const viLine = $('pronViLine'), hanLine = $('pronHanLine'), pyLine = $('pronPyLine');
    if (viLine) viLine.classList.toggle('hidden', !S.settings.showVi);
    if (hanLine) hanLine.classList.toggle('hidden', !S.settings.showHan);
    if (pyLine) pyLine.classList.toggle('hidden', !S.settings.showPy);

    const vi = $('pronVi'); if (vi) vi.textContent = it.vi || '—';
    renderHanzi();
    const py = $('pronPy');
    if (py) py.textContent = it.py || '';
    updateMicLabel();
  }

  /* Chữ Hán từng chữ — bấm vào để xem chi tiết.
     Tách phần sinh HTML ra khỏi DOM để kiểm thử được bố cục (pinyin có bị
     gạch chân đè lên không, dấu câu có đứng đúng hàng chân chữ không). */
  function hanziHtml(zh, statusOf) {
    const chars = hanChars(zh);
    const it = currentItem();
    const syl = (it && String(it.zh) === String(zh)) ? PronRepo.syllables(it) : [];
    let out = '';
    let hi = 0;
    for (const ch of Array.from(String(zh || ''))) {
      /* ★ Dấu câu dùng CHUNG khung 3 dòng với chữ Hán, không còn là span rời
         bị align-items:flex-end đẩy xuống hàng chấm (dấu "。" từng trông như
         một chấm trạng thái lạc ở cuối câu). */
      if (!isHan(ch)) {
        if (/\s/.test(ch)) { out += '<span class="pronSpace" aria-hidden="true"></span>'; continue; }
        out += '<span class="pronChar is-punct" aria-hidden="true">'
          + '<span class="pronCharGlyph">' + esc(ch) + '</span>'
          + '<span class="pronCharPy"></span>'
          + '<span class="pronCharDot"></span>'
          + '</span>';
        continue;
      }
      const c = (statusOf || {})[hi] || null;
      const st = c ? c.status : 'idle';
      const py = syl[hi] || '';
      const label = st === 'good' ? 'tốt' : (st === 'warn' ? 'cần chú ý' : (st === 'bad' ? 'chưa tốt' : (st === 'unknown' ? 'chưa đánh giá' : 'chưa luyện')));
      out += '<button type="button" class="pronChar st-' + st + '" data-ci="' + hi + '"'
        + ' title="' + esc(ch + ' · ' + py + ' — ' + label) + '"'
        + ' aria-label="' + esc(ch + ', ' + py + ', ' + label) + '">'
        + '<span class="pronCharGlyph">' + esc(ch) + '</span>'
        + '<span class="pronCharPy">' + esc(py) + '</span>'
        + '<span class="pronCharDot" aria-hidden="true"></span>'
        + '</button>';
      hi++;
    }
    return out;
  }

  function renderHanzi() {
    const it = currentItem();
    const host = $('pronHanzi');
    if (!host || !it) return;
    const statusOf = {};
    if (S.result && S.result.chars) for (const c of S.result.chars) statusOf[c.i] = c;
    host.innerHTML = hanziHtml(it.zh, statusOf) || '<span class="pronPunct">—</span>';
  }

  function updateMicLabel() {
    const btn = $('pronMicBtn');
    if (!btn) return;
    if (S.phase === 'recording' || S.phase === 'analyzing' || S.phase === 'requesting') return;
    const txt = btn.querySelector('.pronMicTxt');
    const sub = btn.querySelector('.pronMicSub');
    if (txt) txt.textContent = S.result ? 'Nhấn để nói lại' : 'Nhấn để bắt đầu nói';
    if (sub) sub.innerHTML = 'hoặc nhấn <b>Enter</b>';
  }

  /* ═══════════════════════════════════════════════════════════
     Vẽ — kết quả
     ═══════════════════════════════════════════════════════════ */
  function verdict(score) {
    if (score >= 90) return { t: 'Rất tốt', cls: 'ok' };
    if (score >= GOOD) return { t: 'Khá tốt', cls: 'ok' };
    if (score >= 50) return { t: 'Cần luyện thêm', cls: 'warn' };
    return { t: 'Chưa khớp', cls: 'bad' };
  }

  function renderResult() {
    const host = $('pronResult');
    if (!host) return;
    const r = S.result;
    /* Có kết quả → thẻ câu thu về 1 cột trái, phân tích sang cột phải
       (trên máy tính). Nhờ vậy KHÔNG phải cuộn xuống mới thấy điểm. */
    const area = $('pronArea');
    if (area) area.classList.toggle('has-result', !!r);
    if (!r) { host.classList.add('hidden'); host.innerHTML = ''; return; }
    host.classList.remove('hidden');
    const v = verdict(r.score);
    const isPron = r.scoreKind === 'pron';
    const label = isPron ? 'Điểm phát âm' : 'Độ khớp nội dung';
    const confPct = r.confidence == null ? null : Math.round(r.confidence * 100);

    let chips = '<span class="pronChip ok">Khớp ' + r.matched + '/' + r.total + ' chữ</span>';
    if (confPct != null) chips += '<span class="pronChip">Độ tin cậy ' + confPct + '%</span>';
    if (isPron && r.accuracy != null) chips += '<span class="pronChip">Chính xác ' + r.accuracy + '</span>';
    if (isPron && r.fluency != null) chips += '<span class="pronChip">Trôi chảy ' + r.fluency + '</span>';
    if (!isPron && r.extra) chips += '<span class="pronChip warn">Thêm ' + r.extra + ' âm</span>';
    const badN = r.chars.filter(c => c.status === 'bad').length;
    if (badN) chips += '<span class="pronChip bad">' + badN + ' chữ cần sửa</span>';

    const errHtml = r.errors.length
      ? '<ul class="pronErrList">' + r.errors.map(e => '<li><b>' + esc(e.label) + '</b>' + (e.count > 1 ? ' ×' + e.count : '') + '</li>').join('') + '</ul>'
      : '';

    const noteHtml = r.notes.length
      ? '<div class="pronNote">' + r.notes.map(n => '<div>' + esc(n) + '</div>').join('') + '</div>'
      : '';

    const honest = isPron
      ? '<div class="pronHonest">✅ Điểm này do dịch vụ chấm phát âm chuyên dụng trả về (theo âm tiết).</div>'
      : '<div class="pronHonest">ℹ️ Đây là <b>đánh giá sơ bộ độ khớp nội dung</b> dựa trên nhận dạng giọng nói — <b>không phải</b> điểm phát âm chuyên dụng. Hệ thống chưa thể chấm thanh điệu hay khẩu hình khi chỉ có văn bản nhận dạng.</div>';

    host.innerHTML =
      '<div class="pronScoreWrap">'
      + '<div class="pronRing ' + v.cls + '" style="--p:' + clamp(r.score, 0, 100) + '">'
      + '<div class="pronRingIn"><b>' + r.score + '</b><span>/100</span></div></div>'
      + '<div class="pronScoreMeta">'
      + '<div class="pronScoreTitle ' + v.cls + '">' + v.t + ' <small>· ' + label + '</small></div>'
      + '<div class="pronChips">' + chips + '</div>'
      + '<div class="pronHeard">Hệ thống nghe được: <b>' + (r.transcript ? esc(r.transcript) : '—') + '</b></div>'
      + noteHtml
      + '</div></div>'
      + (errHtml ? '<div class="pronErrBlock"><span class="pronErrTitle">Lỗi phát hiện được</span>' + errHtml + '</div>' : '')
      + '<div class="pronLegend">'
      + '<span><i class="lg-good"></i>Phát âm tốt</span>'
      + '<span><i class="lg-warn"></i>Cần chú ý</span>'
      + '<span><i class="lg-bad"></i>Chưa tốt</span>'
      + '<span><i class="lg-unknown"></i>Chưa đủ dữ liệu</span>'
      + '</div>'
      + honest;
    /* ★ KHÔNG lặp lại nút điều hướng ở đây: thanh nút ngay dưới thẻ đã có
       "Câu trước / Nói lại / Bỏ qua / Câu tiếp" — hai bộ nút cùng chức năng
       sẽ gây rối (yêu cầu thiết kế). */

    /* Kết quả nằm dưới thẻ câu → cuộn tới để người dùng THẤY ngay,
       không phải tự mò xuống (chỉ cuộn khi chưa hiện đủ trong màn hình). */
    setTimeout(() => {
      try {
        const r2 = host.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        if (r2.top > vh - 140 || r2.top < 0) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) { }
    }, 90);
  }

  function renderComplete() {
    const comp = $('pronComplete'), msg = $('pronCompleteMsg');
    const s = stats();
    if (comp) comp.classList.remove('hidden');
    if (msg) {
      msg.innerHTML = s.total
        ? ('Bạn đã đi hết ' + s.total + ' câu của bộ này. Đã luyện <b>' + s.attempted + '</b> câu, đạt mục tiêu <b>' + s.good + '</b> câu (ngưỡng ' + GOOD + '/100).')
        : 'Chưa có câu nào trong bộ lọc hiện tại.';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Popover chi tiết từng chữ
     ═══════════════════════════════════════════════════════════ */
  function showDetail(ci) {
    const it = currentItem();
    const host = $('pronDetail');
    if (!it || !host) return;
    const chars = hanChars(it.zh);
    const ch = chars[ci];
    if (!ch) return;
    const syl = PronRepo.syllables(it);
    const py = syl[ci] || '';
    const c = (S.result && S.result.chars || []).find(x => x.i === ci) || null;
    const tone = toneOf(py);
    const stLabel = c ? ({ good: 'Phát âm tốt', warn: 'Cần chú ý', bad: 'Chưa tốt', unknown: 'Chưa đủ dữ liệu' }[c.status] || '—') : 'Chưa luyện';

    let html = '<div class="pronDetailHead"><b class="pronDetailCh">' + esc(ch) + '</b>'
      + '<div><div class="pronDetailPy">' + esc(py || '—') + '</div>'
      + '<div class="pronDetailTone">' + esc(TONE_TIP[tone] || '') + '</div></div>'
      + '<button type="button" class="pronDetailClose" data-pd="close" aria-label="Đóng">✕</button></div>';

    html += '<div class="pronDetailRows">'
      + '<div><span>Trạng thái</span><b class="st-' + (c ? c.status : 'idle') + '">' + esc(stLabel) + '</b></div>'
      + (c && c.got ? '<div><span>Hệ thống nghe thành</span><b>' + esc(c.got) + '</b></div>' : '')
      + (c && c.score != null ? '<div><span>Điểm chữ này</span><b>' + c.score + '/100</b></div>' : '')
      + '</div>';

    if (c && c.note) html += '<div class="pronDetailNote">' + esc(c.note) + '</div>';
    else if (!c) html += '<div class="pronDetailNote">Chưa có kết quả cho chữ này — hãy bấm micro và nói cả câu trước.</div>';

    html += '<div class="pronDetailActs">'
      + '<button type="button" class="btn secondary" data-pd="say">🔊 Nghe chữ này</button>'
      + '<button type="button" class="btn secondary" data-pd="close">Đóng</button>'
      + '</div>';

    host.innerHTML = html;
    host.classList.remove('hidden');
    S.detailIdx = ci;
    host.dataset.ci = String(ci);
  }

  function hideDetail() {
    const host = $('pronDetail');
    if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
    S.detailIdx = -1;
  }

  /* ═══════════════════════════════════════════════════════════
     Sóng âm thanh
     ═══════════════════════════════════════════════════════════ */
  function drawMeter(level) {
    const c = $('pronWave');
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const accent = (css.getPropertyValue('--primary-2') || '#1FC8A2').trim() || '#1FC8A2';
    const dim = (css.getPropertyValue('--line-2') || 'rgba(148,163,184,.22)').trim();
    const rr = (x, y, w, h, r) => {
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
      else ctx.fillRect(x, y, w, h);
    };
    /* Chưa ghi âm → chỉ một "đường nền" mảnh, không vẽ 48 cột nhỏ
       (trước đây trông như một đường kẻ đứt nằm giữa thẻ). */
    if (S.phase !== 'recording') {
      ctx.fillStyle = dim;
      ctx.globalAlpha = 0.5;
      rr(0, H / 2 - 1.5, W, 3, 1.5);
      ctx.globalAlpha = 1;
      return;
    }
    const bars = 48, gap = 3;
    const bw = (W - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i++) {
      /* hình bao mềm: giữa cao hơn hai đầu */
      const mid = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
      const wob = 0.55 + 0.45 * Math.abs(Math.sin((Date.now() / 160) + i * 0.7));
      let h = Math.max(2, (0.12 + level * 3.4) * (0.35 + mid) * wob * H * 0.9);
      h = Math.min(H - 2, h);
      const x = i * (bw + gap), y = (H - h) / 2;
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, level * 4);
      rr(x, y, bw, h, Math.min(bw / 2, 3));
    }
    ctx.globalAlpha = 1;
  }

  /* ═══════════════════════════════════════════════════════════
     Khởi động / nạp nguồn
     ═══════════════════════════════════════════════════════════ */
  function loadSettings() {
    const d = lsJson(SETTINGS_KEY, null);
    if (d && typeof d === 'object') {
      S.settings = Object.assign(S.settings, {
        rate: Number(d.rate) || 1,
        voice: d.voice || '',
        autoSample: !!d.autoSample,
        autoNext: !!d.autoNext,
        showPy: d.showPy !== false,
        showHan: d.showHan !== false,
        showVi: d.showVi !== false,
        filter: d.filter || 'all'
      });
    }
  }
  function saveSettings() { lsSet(SETTINGS_KEY, JSON.stringify(S.settings)); }

  function syncToolbar() {
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set('pronRate', String(S.settings.rate));
    set('pronFilter', S.settings.filter);
    const tgl = (id, on) => {
      const b = $(id); if (!b) return;
      b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    tgl('pronPyToggle', S.settings.showPy);
    tgl('pronHanToggle', S.settings.showHan);
    tgl('pronViToggle', S.settings.showVi);
    tgl('pronAutoSample', S.settings.autoSample);
    tgl('pronAutoNext', S.settings.autoNext);
  }

  function fillVoices() {
    const sel = $('pronVoice');
    if (!sel) return;
    const list = PronTts.voices();
    const cur = S.settings.voice;
    /* Rút gọn nhãn: tên giọng của Windows/Edge rất dài
       ("Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)") → trên
       điện thoại sẽ đẩy thanh công cụ rộng quá khung. */
    const label = (v) => {
      const n = String(v.name || '').replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Chinese.*$/i, '');
      return (n.length > 26 ? n.slice(0, 24) + '…' : n) + ' · ' + (v.lang || '');
    };
    sel.innerHTML = '<option value="">Giọng tự động</option>'
      + list.map(v => '<option value="' + esc(v.name) + '">' + esc(label(v)) + '</option>').join('');
    sel.value = list.some(v => v.name === cur) ? cur : '';
    if (!list.length) {
      sel.innerHTML = '<option value="">Giọng tự động</option>';
      sel.title = 'Trình duyệt chưa có giọng đọc tiếng Trung nào — hãy cài thêm gói giọng tiếng Trung.';
    }
  }

  async function fillSources() {
    const sel = $('pronSource');
    if (!sel) return;
    S.sources = await PronRepo.sources();
    if (!S.sources.length) {
      sel.innerHTML = '<option value="">Chưa có nội dung</option>';
      return;
    }
    const want = S.source;
    sel.innerHTML = S.sources.map(s => '<option value="' + esc(s.id) + '">' + esc(s.label) + '</option>').join('');
    const has = S.sources.some(s => s.id === want);
    sel.value = has ? want : S.sources[0].id;
    S.source = sel.value;
  }

  async function loadSource(srcId, keepId) {
    S.source = srcId;
    const key = PronRepo.keyOf(srcId);
    S.progress = PronStore.load(key);
    S.items = await PronRepo.load(srcId);
    S.result = null; S.record = null;
    S.index = 0;
    rebuildOrder(keepId);
    /* khôi phục đúng câu đang dừng lần trước */
    if (!keepId && S.progress && typeof S.progress.index === 'number') {
      S.index = clamp(S.progress.index, 0, Math.max(0, S.order.length - 1));
    }
    setPhase('idle', '');
    hideDetail();
    renderCard();
    renderResult();
    renderStats();
    /* ★ D.2: mới vào một chủ đề (keepId rỗng = vào mới, không phải khôi phục
       giữa chừng) → tự đọc to câu tiếng Trung ĐẦU TIÊN ĐÚNG 1 LẦN, không phụ
       thuộc nút "Tự nghe mẫu". Khôi phục giữa chừng (keepId) giữ nguyên behaviour
       cũ: chỉ đọc nếu người dùng bật "Tự nghe mẫu". */
    if (!keepId) {
      setTimeout(() => { const it = currentItem(); if (it && it.zh) PronTts.speak(it.zh, { rate: S.settings.rate }); }, 340);
    } else if (S.settings.autoSample) {
      setTimeout(() => { const it = currentItem(); if (it && it.zh) PronTts.speak(it.zh, { rate: S.settings.rate }); }, 300);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     CẢNH BÁO file:// — nguyên nhân thật của "hỏi quyền micro mỗi lần"
     Chrome KHÔNG lưu quyền micro cho origin `file://`. Vì vậy mỗi lần
     SpeechRecognition.start() (mỗi lượt nói) Chrome lại hỏi. Không có cách
     nào sửa bằng JavaScript — phải chạy qua http://localhost (hoặc https).
     Ở đây: dò xem máy có server nội bộ đang chạy không; nếu có thì chuyển
     hướng sang đó (1 lần / tab), nếu không thì hiện băng hướng dẫn.
     ═══════════════════════════════════════════════════════════ */
  const LOCAL_PORTS = [8080, 5500, 8090, 3000];
  const isFileProto = () => location.protocol === 'file:';

  function showFileWarn(show) {
    document.querySelectorAll('[data-filewarn]').forEach(el => el.classList.toggle('hidden', !show));
    /* Băng cảnh báo chiếm ~50px chiều cao → bỏ hàng gợi ý phím để nút micro
       không bị đẩy ra ngoài vùng nhìn (thẻ vẫn vừa đúng 1 khung hình). */
    const card = $('pronCard');
    if (card) card.classList.toggle('has-warn', !!show);
  }

  async function probePort(port) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1100);
      const r = await fetch('http://localhost:' + port + '/__gopinyin', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return '';
      const d = await r.json();
      return (d && d.app === 'gopinyin') ? ('http://localhost:' + port + '/') : '';
    } catch (e) { return ''; }
  }

  async function detectLocal() {
    for (const p of LOCAL_PORTS) {
      const u = await probePort(p);
      if (u) return u;
    }
    return '';
  }

  function syncFileWarn() {
    if (!isFileProto()) { showFileWarn(false); return; }
    showFileWarn(true);
    const goBtns = [...document.querySelectorAll('[data-filewarn-go]')];
    goBtns.forEach(b => { b.disabled = true; b.textContent = 'Đang tìm server nội bộ…'; });
    detectLocal().then(url => {
      goBtns.forEach(b => {
        if (url) {
          b.disabled = false;
          b.dataset.url = url;
          b.textContent = 'Chuyển sang ' + url.replace(/\/$/, '') + ' (giữ tiến độ)';
        } else {
          b.disabled = false;
          b.dataset.url = '';
          b.textContent = 'Xem cách chạy start.bat';
        }
      });
    });
  }

  /* Dồn toàn bộ localStorage của trang file:// lên server rồi mới chuyển địa chỉ,
     để KHÔNG mất tài khoản và tiến độ (localStorage gắn theo origin). */
  async function migrateAndGo(url) {
    const base = url.replace(/\/$/, '');
    let token = '';
    try {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) dump[k] = localStorage.getItem(k);
      }
      const r = await fetch(base + '/__import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dump })
      });
      if (r.ok) { const d = await r.json(); token = (d && d.token) || ''; }
    } catch (e) { token = ''; }
    location.replace(base + '/' + (token ? ('?import=' + encodeURIComponent(token)) : ''));
  }

  function wireFileWarn() {
    document.addEventListener('click', (e) => {
      const hide = e.target.closest('[data-filewarn-hide]');
      if (hide) { showFileWarn(false); return; }
      const go = e.target.closest('[data-filewarn-go]');
      if (!go) return;
      const url = go.dataset.url;
      if (url) { migrateAndGo(url); return; }
      /* Chưa có server → chỉ cách chạy */
      toast('Mở thư mục <b>gopinyin</b> → nháy đúp <b>start.bat</b> → trình duyệt tự mở http://localhost:8080', 'warn', 8000);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Màn CHỌN BỘ CÂU — vào đây trước, chọn cấp rồi mới luyện
     (giống luồng của màn Luyện gõ, để người dùng không bị ném thẳng
     vào một bộ câu ngẫu nhiên)
     ═══════════════════════════════════════════════════════════ */
  function libStats(id) {
    const p = PronStore.load(PronRepo.keyOf(id));
    let attempted = 0, good = 0;
    for (const k in p.byId) {
      const r = p.byId[k];
      if (!r || !r.n) continue;
      attempted++;
      if ((r.best || 0) >= GOOD) good++;
    }
    return { attempted, good, index: p.index || 0 };
  }

  /* ★ Thẻ cấp HSK: tiến độ LUYỆN NÓI (x/N + % + số câu đạt) hiện ngay trên thẻ.
     Chưa nói câu nào nhưng đã GÕ ở màn Luyện gõ → hiện tiến độ gõ (thanh xám)
     để người dùng vẫn thấy mình đã học tới đâu — thay cho khối
     "📖 Bộ câu của bạn (đã học)" đã bỏ. */
  function libCardHtml(x) {
    const s = libStats(x.id);
    const attempted = s.attempted;
    const done = x.done || 0;
    const pct = x.count ? Math.round(100 * (attempted || done) / x.count) : 0;
    /* thanh 5px: 1/301 vẫn phải thấy một vạch nhỏ */
    const w = (attempted || done) > 0 ? Math.max(pct, 2) : 0;
    const typedOnly = !attempted && done > 0;
    let meta;
    if (attempted) meta = (attempted + '/' + x.count + ' đã luyện · <b>' + s.good + '</b> đạt');
    else if (typedOnly) meta = ('Đã gõ ' + done + '/' + x.count + ' · chưa luyện nói');
    else meta = 'Chưa luyện câu nào';
    return '<button class="vocabCard' + (x.locked ? ' isLocked' : '') + '" type="button" data-psrc="' + esc(x.id) + '"'
      + ' title="' + esc((x.locked ? 'Mở khoá bằng gói Pro — ' : '') + 'Luyện nói ' + x.name + ' · ' + x.count + ' câu'
        + (done ? ' · đã gõ ' + done + '/' + x.count : '')) + '">'
      + (x.locked ? '<span class="vocabLock">🔒 Pro</span>' : '')
      + '<span class="vocabCard-title">' + esc(x.name) + '</span>'
      + '<span class="vocabCount">' + x.count + ' câu</span>'
      + '<span class="vocabProg' + (typedOnly ? ' isType' : '') + '"><i style="width:' + w + '%"></i></span>'
      + '<span class="vocabMeta">' + meta + '</span>'
      + '</button>';
  }

  async function renderLib() {
    const hskHost = $('pronLibHsk');
    const cat = await PronRepo.catalog();
    S.catalog = cat;

    if (hskHost) {
      hskHost.innerHTML = cat.hsk.length ? cat.hsk.map(libCardHtml).join('')
        : '<div class="vocabEmpty">Chưa nạp được dữ liệu HSK.</div>';
    }
    /* ★ Đã bỏ "📖 Bộ câu của bạn (đã học)" và "📖 Các câu đã làm": tiến độ
       (luyện nói + đã gõ) giờ hiện ngay trên từng thẻ HSK ở trên.
       Đã bỏ nút "Học tiếp bộ đang mở": kho câu dùng chung nhưng TIẾN ĐỘ
       luyện nói TÁCH RIÊNG khỏi Luyện gõ, nên người dùng chọn bộ ngay tại đây. */
  }

  async function startSource(srcId) {
    if (!srcId) return;
    if (srcId.startsWith('hsk:')) {
      const lvl = Number(srcId.slice(4).replace(/[^0-9]/g, '')) || 0;
      if (lvl >= 4 && window.__gpIsPro !== true) {
        toast('HSK 4–9 nằm trong gói Pro. Nâng cấp (hoặc dùng thử 7 ngày) để mở khoá nhé!', 'warn', 3600);
        if (typeof window.__gpOpenPro === 'function') window.__gpOpenPro();
        return;
      }
    }
    S.source = srcId;
    S.lastSource = srcId;
    await loadSource(srcId);
    syncToolbar();
    if (typeof window.showView === 'function') { try { window.showView('pronStudy'); return; } catch (e) { } }
    Pron.open();
  }

  /* ═══════════════════════════════════════════════════════════
     Gắn sự kiện
     ═══════════════════════════════════════════════════════════ */
  function wire() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };

    wireFileWarn();

    on('pronMicBtn', 'click', () => { if (S.phase === 'recording') stopRecording('manual'); else beginRecording(); });
    on('pronSampleBtn', 'click', () => {
      const it = currentItem(); if (!it) return;
      PronTts.speak(it.zh, { rate: S.settings.rate });
    });
    on('pronPlayMineBtn', 'click', () => PronMic.playMine());

    /* ── Màn chọn bộ câu ── */
    const pickClick = (e) => {
      const b = e.target.closest('[data-psrc]');
      if (!b) return;
      e.preventDefault();
      startSource(b.dataset.psrc);
    };
    on('pronLibHsk', 'click', pickClick);
    on('pronBackBtn', 'click', () => {
      PronMic.hardRelease();
      if (typeof window.showView === 'function') window.showView('pron');
    });

    on('pronPrevBtn', 'click', prevItem);
    on('pronRetryBtn', 'click', () => { S.result = null; S.record = null; renderResult(); renderHanzi(); setPhase('idle', ''); beginRecording(); });
    on('pronSkipBtn', 'click', skipItem);
    on('pronNextBtn', 'click', nextItem);
    on('pronRestartBtn', 'click', () => { S.index = 0; gotoItem(0); });
    on('pronResetBtn', 'click', async () => {
      const ok = await appConfirm('Xóa toàn bộ tiến độ luyện phát âm của bộ này?', { title: 'Xóa tiến độ', okText: 'Xóa', danger: true });
      if (!ok) return;
      PronStore.reset(PronRepo.keyOf(S.source));
      S.index = 0; S.result = null; S.record = null;
      rebuildOrder();
      renderCard(); renderResult(); renderStats();
      toast('Đã xóa tiến độ luyện phát âm của bộ này.', 'ok');
    });

    on('pronSource', 'change', async (e) => {
      const v = e.target.value;
      if (v && v.startsWith('hsk:')) {
        const lvl = Number(v.slice(4).replace(/[^0-9]/g, '')) || 0;
        if (lvl >= 4 && window.__gpIsPro !== true) {
          toast('HSK 4–9 nằm trong gói Pro. Nâng cấp (hoặc dùng thử 7 ngày) để mở khoá nhé!', 'warn', 3600);
          if (typeof window.__gpOpenPro === 'function') window.__gpOpenPro();
          e.target.value = S.source;
          return;
        }
      }
      PronMic.release();
      S.lastSource = v;
      await loadSource(v);
      syncToolbar();
    });

    on('pronFilter', 'change', (e) => {
      S.settings.filter = e.target.value; saveSettings();
      const keep = currentItem() && currentItem().id;
      rebuildOrder(keep);
      S.result = null; S.record = null;
      renderCard(); renderResult(); renderStats();
    });

    on('pronRate', 'change', (e) => { S.settings.rate = Number(e.target.value) || 1; saveSettings(); });
    on('pronVoice', 'change', (e) => { S.settings.voice = e.target.value; saveSettings(); });

    const tgl = (id, key) => on(id, 'click', () => {
      S.settings[key] = !S.settings[key];
      saveSettings(); syncToolbar();
      if (key === 'showPy' || key === 'showHan' || key === 'showVi') renderCard();
      if (key === 'autoSample' && S.settings.autoSample) {
        const it = currentItem(); if (it) PronTts.speak(it.zh, { rate: S.settings.rate });
      }
    });
    tgl('pronPyToggle', 'showPy');
    tgl('pronHanToggle', 'showHan');
    tgl('pronViToggle', 'showVi');
    tgl('pronAutoSample', 'autoSample');
    tgl('pronAutoNext', 'autoNext');

    /* bấm vào chữ Hán → chi tiết */
    const hz = $('pronHanzi');
    if (hz) hz.addEventListener('click', (e) => {
      const b = e.target.closest('.pronChar');
      if (!b) return;
      showDetail(Number(b.dataset.ci));
    });

    /* bấm ra ngoài popover → đóng (popover có màn chắn tối nên phải đóng được) */
    document.addEventListener('click', (e) => {
      const d = $('pronDetail');
      if (!d || d.classList.contains('hidden')) return;
      if (d.contains(e.target)) return;
      if (e.target.closest && e.target.closest('#pronHanzi .pronChar')) return;
      hideDetail();
    });

    /* nút trong popover + trong kết quả */
    const det = $('pronDetail');
    if (det) det.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pd]');
      if (!b) return;
      const act = b.dataset.pd;
      if (act === 'close') { hideDetail(); return; }
      if (act === 'say') {
        const ci = Number(det.dataset.ci);
        const it = currentItem();
        if (it) {
          const syl = PronRepo.syllables(it);
          PronTts.speak(syl[ci] || hanChars(it.zh)[ci] || '', { rate: 0.85 });
        }
      }
    });

    const res = $('pronResult');
    if (res) res.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pa]');
      if (!b) return;
      const act = b.dataset.pa;
      if (act === 'retry') { S.result = null; S.record = null; renderResult(); renderHanzi(); setPhase('idle', ''); beginRecording(); }
      else if (act === 'sample') { const it = currentItem(); if (it) PronTts.speak(it.zh, { rate: S.settings.rate }); }
      else if (act === 'next') nextItem();
    });

    /* giọng đọc có thể nạp sau khi trang xong */
    if (PronTts.supported()) {
      try { window.speechSynthesis.onvoiceschanged = () => fillVoices(); } catch (e) { }
    }

    /* Đóng micro khi rời trang / ẩn tab (không giữ đèn đỏ micro ngoài ý muốn) */
    window.addEventListener('pagehide', () => { try { PronMic.hardRelease(); } catch (e) { } });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && S.phase === 'recording') stopRecording('manual');
    });

    /* ── Phím tắt: chỉ khi đang ở màn luyện phát âm ── */
    document.addEventListener('keydown', (e) => {
      const card = $('pronCard');
      if (!card || card.classList.contains('hidden')) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      /* không cướp phím khi đang gõ ở ô nhập khác / mở hộp thoại */
      if (document.querySelector('.modal:not([hidden])')) return;
      const am = $('appModal');
      if (am && am.classList.contains('show')) return;
      const ae = document.activeElement;
      if (ae) {
        const tag = (ae.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || ae.isContentEditable) return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (S.phase === 'recording') stopRecording('manual'); else beginRecording();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        nextItem();
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        const it = currentItem(); if (it) PronTts.speak(it.zh, { rate: S.settings.rate });
        return;
      }
      if (e.key === 'Escape') hideDetail();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     API công khai
     ═══════════════════════════════════════════════════════════ */
  const Pron = {
    /* Màn CHỌN BỘ CÂU (view "pron") */
    async openLib() {
      if (!S.ready) {
        S.ready = true;
        loadSettings();
        wire();
        fillVoices();
      }
      document.body.classList.remove('studyFit');
      PronMic.hardRelease();
      syncFileWarn();
      await renderLib();
    },
    /* Màn LUYỆN (view "pronStudy") */
    async open() {
      if (!S.ready) {
        S.ready = true;
        loadSettings();
        wire();
        fillVoices();
      }
      /* Khoá trang đúng 1 khung hình — thẻ tự chia chiều cao, không phải cuộn */
      document.body.classList.add('studyFit');
      syncFileWarn();
      await fillSources();
      if (!S.items.length || S.lastSource !== S.source) {
        S.lastSource = S.source;
        await loadSource(S.source);
      }
      syncToolbar();
      drawMeter(0);
      renderStats();
      /* giọng đọc thường nạp trễ */
      setTimeout(fillVoices, 500);
    },
    /* Vào thẳng một bộ (dùng cho nút "Học tiếp" ở nơi khác) */
    start(srcId) { return startSource(srcId); },
    leave() {
      PronMic.hardRelease();
      PronAsr.stop();
      if (S.timer) { clearInterval(S.timer); S.timer = 0; }
      if (S.maxTimer) { clearTimeout(S.maxTimer); S.maxTimer = 0; }
      if (S.silenceTimer) { clearTimeout(S.silenceTimer); S.silenceTimer = 0; }
      if (S.phase === 'recording') setPhase('idle', '');
      hideDetail();
      document.body.classList.remove('studyFit');
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
    },
    /* dùng cho kiểm thử + tích hợp ngoài */
    _state: S,
    _assess: (item, transcript, conf) => PronAssess.local(item, transcript, conf),
    _align: (a, b) => PronAssess.align(a, b),
    _hanziHtml: (zh, st) => hanziHtml(zh, st || {}),
    _good: GOOD
  };

  window.__pron = Pron;
})();
