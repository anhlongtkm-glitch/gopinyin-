// State and behavior owned by features/pronunciation/assessment. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { hanChars, toneOf } from "./utils.js";

import { state as pronunciationWavState } from "./wav.js";

export const state = {};

const pronunciationAssessmentState = state;

export function initializePronunciationAssessment() {
  /* ═══════════════════════════════════════════════════════════
     PronAssess — căn chỉnh chuỗi + chấm điểm
     ───────────────────────────────────────────────────────────
     Căn chỉnh bằng LCS (dãy con chung dài nhất) để xử lý được:
       · thiếu âm tiết (người nói bỏ chữ)
       · thừa âm tiết (nói thêm)
       · nhận nhầm âm tiết (thay thế)
     Không so khớp pinyin theo từng ký tự → tránh kết luận sai.
     ═══════════════════════════════════════════════════════════ */
  pronunciationAssessmentState.PronAssess = {
    /* Trả về danh sách thao tác: match | sub | del | ins */
    align(exp, got) {
      const n = exp.length,
        m = got.length;
      const dp = Array.from({
        length: n + 1
      }, () => new Int32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i][j] = exp[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const raw = [];
      let i = 0,
        j = 0;
      while (i < n && j < m) {
        if (exp[i] === got[j]) {
          raw.push({
            t: 'match',
            e: i,
            g: j
          });
          i++;
          j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          raw.push({
            t: 'del',
            e: i
          });
          i++;
        } else {
          raw.push({
            t: 'ins',
            g: j
          });
          j++;
        }
      }
      while (i < n) {
        raw.push({
          t: 'del',
          e: i
        });
        i++;
      }
      while (j < m) {
        raw.push({
          t: 'ins',
          g: j
        });
        j++;
      }
      /* gộp cặp "xoá + thêm" liền nhau thành "thay thế" (nhận nhầm âm) */
      const ops = [];
      for (let k = 0; k < raw.length; k++) {
        if (raw[k].t === 'del' && raw[k + 1] && raw[k + 1].t === 'ins') {
          ops.push({
            t: 'sub',
            e: raw[k].e,
            g: raw[k + 1].g
          });
          k++;
        } else ops.push(raw[k]);
      }
      return ops;
    },
    local(item, transcript, conf) {
      const exp = hanChars(item.zh);
      const got = hanChars(transcript);
      const syl = pronunciationRepositoryState.PronRepo.syllables(item);
      const base = {
        mode: 'local',
        transcript: transcript || '',
        scoreKind: 'content',
        total: exp.length,
        matched: 0,
        extra: 0,
        confidence: conf == null ? null : conf,
        chars: [],
        errors: [],
        notes: [],
        reliable: true
      };
      if (!exp.length) {
        base.reliable = false;
        base.notes.push('Mục này không có chữ Hán để chấm.');
        return base;
      }
      if (!got.length) {
        base.reliable = false;
        base.score = 0;
        base.notes.push('Không nhận được chữ nào từ bản ghi.');
        base.chars = exp.map((ch, i) => ({
          i,
          ch,
          py: syl[i] || '',
          tone: toneOf(syl[i]),
          status: 'unknown',
          got: '',
          score: null
        }));
        return base;
      }
      const ops = this.align(exp, got);
      const status = new Array(exp.length).fill('unknown');
      const gotFor = new Array(exp.length).fill('');
      let matched = 0,
        extra = 0;
      for (const op of ops) {
        if (op.t === 'match') {
          status[op.e] = 'good';
          gotFor[op.e] = got[op.g];
          matched++;
        } else if (op.t === 'sub') {
          status[op.e] = 'bad';
          gotFor[op.e] = got[op.g];
        } else if (op.t === 'del') {
          status[op.e] = 'bad';
          gotFor[op.e] = '';
        } else extra++;
      }

      /* Điểm: tỉ lệ chữ khớp trên độ dài chuỗi DÀI HƠN
         (vừa phạt thiếu chữ, vừa phạt nói thêm) */
      const denom = Math.max(exp.length, got.length);
      let score = Math.round(100 * matched / denom);

      /* Không đủ tin cậy → không kết luận chữ nào sai */
      const lowConf = conf != null && conf < pronunciationSessionState.MIN_CONF;
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
        if (ch === '不' || ch === '一') note = '不/一 đổi thanh theo ngữ cảnh — không chấm thanh ở chữ này.';else if (st === 'bad' && gotFor[i]) note = 'Hệ thống nghe thành 「' + gotFor[i] + '」 — chú ý đọc đúng âm 「' + py + '」.';else if (st === 'bad' && !gotFor[i]) note = 'Chưa nghe được âm tiết này — đọc rõ và to hơn một chút.';else if (st === 'unknown') note = 'Chưa đủ dữ liệu để đánh giá chữ này.';
        return {
          i,
          ch,
          py,
          tone: toneOf(py),
          status: st,
          got: gotFor[i] || '',
          score: st === 'good' ? 100 : st === 'bad' ? 0 : null,
          note
        };
      });

      /* Phân loại lỗi — chỉ nêu khi có bằng chứng */
      const missing = base.chars.filter(c => c.status === 'bad' && !c.got).length;
      const wrong = base.chars.filter(c => c.status === 'bad' && c.got).length;
      if (missing) base.errors.push({
        type: 'missing',
        label: 'Thiếu âm tiết',
        count: missing
      });
      if (wrong) base.errors.push({
        type: 'wrong',
        label: 'Nhận nhầm âm tiết',
        count: wrong
      });
      if (extra) base.errors.push({
        type: 'extra',
        label: 'Nói thêm âm tiết',
        count: extra
      });
      if (!base.reliable) base.errors.push({
        type: 'unknown',
        label: 'Chưa đủ dữ liệu để xác định lỗi',
        count: 1
      });
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
      if (pct === 100) out.push('Nhận dạng đúng toàn bộ ' + r.total + ' chữ của câu.');else out.push('Nhận dạng đúng ' + r.matched + '/' + r.total + ' chữ (' + pct + '%).');
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
      if (pronunciationSessionState.S.serverAssess && pronunciationSessionState.S.serverAssess.ok === false) return null;
      try {
        /* Dịch vụ chấm phát âm cần WAV 16 kHz mono — chuyển ngay ở máy người dùng */
        const wav = await pronunciationWavState.PronWav.encode(blob, 16000);
        if (!wav) return null;
        /* Cho phép đặt endpoint ở origin khác (vd. hosting tĩnh + API riêng):
           <script>window.PRON_API='https://api.example.com/pron'</script> */
        const url = typeof window !== 'undefined' && window.PRON_API || '/api/pron';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio: pronunciationWavState.PronWav.toBase64(wav),
            mime: 'audio/wav',
            text: String(item.zh || '')
          })
        });
        if (res.status === 501 || res.status === 404) {
          pronunciationSessionState.S.serverAssess = {
            ok: false,
            note: 'Chưa cấu hình dịch vụ chấm phát âm.'
          };
          return null;
        }
        if (!res.ok) {
          pronunciationSessionState.S.serverAssess = {
            ok: false,
            note: 'Dịch vụ chấm phát âm lỗi ' + res.status
          };
          return null;
        }
        const data = await res.json();
        if (!data || !data.ok || typeof data.pronScore !== 'number') {
          pronunciationSessionState.S.serverAssess = {
            ok: false,
            note: 'Dịch vụ không trả điểm phát âm.'
          };
          return null;
        }
        pronunciationSessionState.S.serverAssess = {
          ok: true,
          note: ''
        };
        return this.fromServer(item, data);
      } catch (e) {
        pronunciationSessionState.S.serverAssess = {
          ok: false,
          note: 'Không gọi được dịch vụ chấm phát âm.'
        };
        return null;
      }
    },
    fromServer(item, data) {
      const exp = hanChars(item.zh);
      const syl = pronunciationRepositoryState.PronRepo.syllables(item);
      const words = Array.isArray(data.words) ? data.words : [];
      const chars = exp.map((ch, i) => {
        const w = words[i] || null;
        const acc = w && typeof w.accuracy === 'number' ? w.accuracy : null;
        const err = w && w.errorType ? String(w.errorType) : '';
        let st = 'unknown';
        if (acc != null) st = acc >= pronunciationSessionState.GOOD ? 'good' : acc >= 50 ? 'warn' : 'bad';
        return {
          i,
          ch,
          py: syl[i] || '',
          tone: toneOf(syl[i]),
          status: st,
          got: w && w.text || '',
          score: acc,
          note: err ? 'Lỗi: ' + err : ''
        };
      });
      const errors = [];
      const tally = {};
      for (const w of words) {
        const t = w && w.errorType;
        if (t && t !== 'None' && t !== 'none') tally[t] = (tally[t] || 0) + 1;
      }
      for (const k of Object.keys(tally)) errors.push({
        type: k,
        label: k,
        count: tally[k]
      });
      const r = {
        mode: 'server',
        scoreKind: 'pron',
        transcript: data.text || '',
        score: Math.round(data.pronScore),
        total: exp.length,
        matched: chars.filter(c => c.status === 'good').length,
        extra: 0,
        confidence: typeof data.confidence === 'number' ? data.confidence : null,
        accuracy: typeof data.accuracy === 'number' ? Math.round(data.accuracy) : null,
        fluency: typeof data.fluency === 'number' ? Math.round(data.fluency) : null,
        prosody: typeof data.prosody === 'number' ? Math.round(data.prosody) : null,
        chars,
        errors,
        reliable: true,
        notes: []
      };
      r.notes = this.remarks(r);
      return r;
    }
  };
}
