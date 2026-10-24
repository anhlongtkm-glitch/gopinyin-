// State and behavior owned by features/ai/validation. Initialization is orchestrated by app/bootstrap.js.

import { callAi, buildAiPrompt } from "./client.js";

import { aiLsGet } from "./providers.js";

import { aiSetStatus } from "./session.js";

import { normalize } from "../../shared/language/normalization.js";

import { fixPinyin, sanitizeLatinInChinese } from "../../shared/language/pinyin.js";

export const state = {};

const aiValidationState = state;

/* ★ Lấy nghĩa tiếng Việt từ 1 hàng AI — AI hay ĐỔI TÊN trường hoặc bỏ trống
   (vi / vietnamese / nghia / meaning / dich / translation / vn / viText…) */
export function aiRowVi(x) {
  if (!x) return '';
  const keys = ['vi', 'vietnamese', 'nghia', 'nghiaViet', 'nghiaTiengViet', 'viText', 'viMeaning', 'meaning', 'dich', 'translation', 'trans', 'vn'];
  for (const k of keys) {
    const v = x[k];
    if (v == null) continue;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'object') {
      const s = v.text || v.vi || v.value || v.content;
      if (typeof s === 'string' && s.trim()) return s.trim();
    }
  }
  return '';
}
/* ★ Đếm chữ Hán (không tính dấu câu, khoảng trắng) */

/* ★ Đếm chữ Hán (không tính dấu câu, khoảng trắng) */
export function aiHanCount(zh) {
  return Array.from(String(zh || '').replace(/[^\u3400-\u9fff]/g, '')).length;
}
/* ★ Đếm âm tiết pinyin của cả chuỗi (viết liền hay cách đều đếm được —
   mỗi âm tiết pinyin luôn chứa đúng 1 nhóm nguyên âm). */

/* ★ Đếm âm tiết pinyin của cả chuỗi (viết liền hay cách đều đếm được —
   mỗi âm tiết pinyin luôn chứa đúng 1 nhóm nguyên âm). */
export function aiSyllableCount(py) {
  const t = normalize(String(py || '')).replace(/[^a-züv]/g, '');
  const groups = t.match(/[aeiouüv]+/g);
  return groups ? groups.length : 0;
}
/* ★ KIỂM TRA CƠ BẢN chất lượng 1 câu AI — loại bỏ câu lỗi nghiêm trọng:
   lệch số chữ Hán / âm tiết pinyin (AI ghép sai cặp hoặc bỏ sót âm tiết),
   thiếu nghĩa, pinyin còn số thanh… Câu ERHUA (có chữ 儿) được miễn kiểm tra
   đếm vì 儿 gộp vào âm tiết đứng trước ("玩意儿" = 3 chữ, "wán yìr" = 2 nhóm). */

/* ★ KIỂM TRA CƠ BẢN chất lượng 1 câu AI — loại bỏ câu lỗi nghiêm trọng:
   lệch số chữ Hán / âm tiết pinyin (AI ghép sai cặp hoặc bỏ sót âm tiết),
   thiếu nghĩa, pinyin còn số thanh… Câu ERHUA (có chữ 儿) được miễn kiểm tra
   đếm vì 儿 gộp vào âm tiết đứng trước ("玩意儿" = 3 chữ, "wán yìr" = 2 nhóm). */
export function aiItemOk(zh, py, vi) {
  if (!zh || !py || !vi) return false;
  if (/[1-5]/.test(py)) return false; // còn số thanh → chưa chuẩn hoá
  const han = aiHanCount(zh),
    syl = aiSyllableCount(py);
  if (han === 0 || syl === 0) return false;
  if (han !== syl && !zh.includes('儿')) return false; // lệch chữ–pinyin
  return true;
}
/* ═══════════════════════════════════════════════════════════
   ★ KIỂM TRA NGỮ NGHĨA: nghĩa tiếng Việt có ĐÚNG với chữ Hán không?
   aiItemOk() ở trên chỉ soát HÌNH THỨC (đủ trường, số chữ Hán = số âm tiết,
   không còn số thanh). Nó KHÔNG đọc nghĩa — nên câu sai nghĩa vẫn lọt, ví dụ:
      批量 (pī liàng) bị ghi "số lượng lớn"
      → sai: 批量 là "theo lô / hàng loạt / sản xuất hàng loạt".
        "số lượng lớn" phải là 大量 (dà liàng) hoặc 数量大.
   Bước dưới đây bổ sung kiểm tra NGỮ NGHĨA bằng chính AI, theo cách
   "tự dịch độc lập rồi đối chiếu" (self-consistency) — hiệu quả hơn hỏi
   thẳng "nghĩa này đúng không?" vì model có xu hướng gật đầu với chính nó:
     1) AI đọc chữ Hán và TỰ DỊCH (không nhìn nghĩa đã cho),
     2) so bản dịch của mình với nghĩa đã cho,
     3) chỉ khi lệch mới trả về nghĩa đúng.
   Không phụ thuộc từ điển offline: đã kiểm tra 批量 KHÔNG có trong gói
   41.621 mục của app, nên tra từ điển đơn thuần sẽ bỏ sót đúng lỗi này.
   ═══════════════════════════════════════════════════════════ */

export function aiVerifyEnabled() {
  try {
    return aiLsGet(aiValidationState.AI_VERIFY_KEY, '1') !== '0';
  } catch (e) {
    return true;
  }
}
/* Chuẩn hoá chữ Hán để ghép mục gốc ↔ mục AI trả về (bỏ dấu câu/khoảng trắng) */

/* Chuẩn hoá chữ Hán để ghép mục gốc ↔ mục AI trả về (bỏ dấu câu/khoảng trắng) */
export function aiZhKey(s) {
  return String(s || '').replace(/[^\u3400-\u9fff]/g, '');
}

export function buildVerifyPrompt(items) {
  const list = items.map((it, i) => i + 1 + '. zh: ' + it.zh + '  |  vi: ' + (it.vi || '(trống)')).join('\n');
  return ['Bạn là giáo viên tiếng Trung khó tính, chuyên soát lỗi NGHĨA Việt–Hán.', 'Dưới đây là danh sách mục (chữ Hán + nghĩa tiếng Việt) do một trợ lý khác tạo.', 'Với TỪNG mục, làm đúng thứ tự sau:', '  (1) Đọc chữ Hán ở "zh" và TỰ DỊCH sang tiếng Việt — KHÔNG nhìn trường "vi" trước.', '  (2) So bản dịch của bạn với nghĩa "vi" đã cho.', '  (3) Đánh giá ok = true CHỈ KHI nghĩa đã cho đúng và sát nghĩa. Ngược lại ok = false.', 'Coi là SAI (ok=false) khi:', '  - dịch lệch nghĩa hoặc nhầm từ gần nghĩa (ví dụ 批量 KHÔNG phải "số lượng lớn" mà là "theo lô, hàng loạt");', '  - dịch theo âm Hán-Việt thay vì nghĩa thật;', '  - quá chung chung, mất sắc thái quan trọng, hoặc thêm thắt điều chữ Hán không có;', '  - nghĩa tiếng Việt mô tả một từ khác với chữ Hán đang xét.', 'Khi ok=false, BẮT BUỘC điền "vi_dung" là nghĩa tiếng Việt ĐÚNG, ngắn gọn, tự nhiên.', 'BẮT BUỘC: chỉ trả về MẢNG JSON thuần, không giải thích, không markdown, không ```json.', 'Mỗi phần tử: {"zh":"giữ nguyên chữ Hán đã cho","ok":true|false,"vi_dung":"nghĩa đúng (chỉ khi ok=false)"}', 'DANH SÁCH CẦN SOÁT:', list].join('\n');
}
/* Đọc phản hồi soát lỗi → [{zh, ok, viDung}] */

/* Đọc phản hồi soát lỗi → [{zh, ok, viDung}] */
export function parseVerifyResult(text) {
  if (!text) return [];
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const a = t.indexOf('['),
    b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  let arr = null;
  try {
    arr = JSON.parse(t);
  } catch (e) {}
  if (!Array.isArray(arr)) {
    const objs = t.match(/\{[^{}]*\}/g) || [];
    arr = objs.map(o => {
      try {
        return JSON.parse(o);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') continue;
    const zh = String(x.zh || x.chinese || x.han || '').trim();
    if (!zh) continue;
    const okRaw = x.ok;
    const ok = okRaw === true || okRaw === 'true' || okRaw === 1 || okRaw === '1';
    const viDung = String(x.vi_dung || x.viDung || x.dung || x.correct || x.vi_fix || '').trim();
    out.push({
      zh,
      ok,
      viDung
    });
  }
  return out;
}
/* Trả về danh sách ĐÃ SỬA nghĩa. Lỗi mạng/AI → trả nguyên bản (không chặn việc học). */

/* Trả về danh sách ĐÃ SỬA nghĩa. Lỗi mạng/AI → trả nguyên bản (không chặn việc học). */
export async function aiVerifyMeanings(items, provider, key) {
  if (!items || !items.length) return items;
  const res = await callAi(provider, key, buildVerifyPrompt(items), {
    temperature: 0.1
  });
  const rows = parseVerifyResult(res);
  if (!rows.length) return items;
  const fix = new Map();
  for (const r of rows) {
    if (r.ok) continue;
    if (r.viDung) fix.set(aiZhKey(r.zh), r.viDung);
  }
  if (!fix.size) return items;
  let n = 0;
  const out = items.map(it => {
    const f = fix.get(aiZhKey(it.zh));
    if (f && f !== it.vi) {
      n++;
      return {
        zh: it.zh,
        py: it.py,
        vi: f
      };
    }
    return it;
  });
  aiValidationState.aiVerifyFixedCount += n;
  return out;
}

export function parseAiSentences(text) {
  if (!text) return [];
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const a = t.indexOf('['),
    b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  let arr = null;
  try {
    arr = JSON.parse(t);
  } catch (e) {}
  if (!Array.isArray(arr)) {
    const objs = t.match(/\{[^{}]*\}/g) || [];
    arr = objs.map(o => {
      try {
        return JSON.parse(o);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  let skipped = 0;
  for (const x of arr) {
    if (!x) continue;
    let zh = String(x && x.zh || '').trim();
    const py = fixPinyin(x && (x.py || x.p) || '');
    const vi = aiRowVi(x);
    if (!zh || !/[\u3400-\u9fff]/.test(zh)) continue;
    // ★ Sửa câu có chữ Latin lẫn trong chữ Hán (vd Gemini trả "AAA" thay vì "A")
    const san = sanitizeLatinInChinese(zh, py);
    if (!san.ok) continue; // bỏ câu không sửa được, để AI tạo câu khác
    if (san.changed) {
      zh = san.zh;
    }
    const pyF = san.changed ? san.py : py;
    /* ★ Lọc chất lượng: câu lỗi cơ bản (lệnh chữ Hán–pinyin, thiếu nghĩa…)
       thì bỏ, không đưa vào bài học. */
    if (!aiItemOk(zh, pyF, vi)) {
      skipped++;
      continue;
    }
    out.push({
      zh,
      py: pyF,
      vi
    });
  }
  out.skipped = skipped;
  return out;
}

// ★ Gọi AI theo từng đợt nhỏ rồi lặp lại cho tới khi đủ số câu mong muốn
//   (API AI miễn phí thường trả thiếu câu → tự gọi lại, đồng thời tránh trùng lặp)

// ★ Gọi AI theo từng đợt nhỏ rồi lặp lại cho tới khi đủ số câu mong muốn
//   (API AI miễn phí thường trả thiếu câu → tự gọi lại, đồng thời tránh trùng lặp)
export async function aiCollect(provider, key, userText, target, level, seen, onProgress, kind) {
  const CHUNK = 10;
  const maxTries = Math.min(10, Math.ceil(target / CHUNK) + 6);
  let out = [],
    tries = 0,
    emptyTries = 0,
    failTries = 0,
    stopped = '',
    skipped = 0;
  while (out.length < target && tries < maxTries) {
    tries++;
    if (onProgress) onProgress(out.length, target, tries);
    try {
      const text = await callAi(provider, key, buildAiPrompt(userText, CHUNK, level, [...seen], kind));
      const parsed = parseAiSentences(text);
      const got = parsed.filter(x => !seen.has(x.zh));
      skipped += parsed.skipped || 0; // câu bị loại vì lỗi chất lượng
      if (!got.length) {
        emptyTries++;
        if (emptyTries >= 2) {
          stopped = 'AI không tạo thêm được câu mới';
          break;
        }
      } else {
        emptyTries = 0;
        got.forEach(x => seen.add(x.zh));
        out = out.concat(got);
      }
    } catch (e) {
      failTries++;
      if (!out.length && failTries >= 3) throw e; // lỗi liên tục mà chưa lấy được gì → báo lỗi
      if (failTries >= 5) {
        stopped = 'máy chủ AI lỗi liên tục';
        break;
      }
      await new Promise(r => setTimeout(r, 900)); // nghỉ chút rồi thử lại
    }
  }
  if (out.length > target) out = out.slice(0, target); // giữ đúng số câu đã chọn
  /* ★ SOÁT LẠI NGHĨA VIỆT ↔ CHỮ HÁN trước khi đưa vào bài học.
     Không có bước này thì nghĩa sai vẫn lọt (vd 批量 → "số lượng lớn").
     Lỗi mạng / AI không trả lời → giữ nguyên bản, KHÔNG chặn việc học. */
  if (out.length && aiVerifyEnabled()) {
    try {
      aiSetStatus('🔍 Đang soát lại nghĩa tiếng Việt cho khớp với chữ Hán…');
      out = await aiVerifyMeanings(out, provider, key);
      aiSetStatus('');
    } catch (e) {
      /* bỏ qua: thà học với nghĩa gốc còn hơn không có gì để học */try {
        aiSetStatus('');
      } catch (_) {}
    }
  }
  return {
    items: out,
    stopped: stopped,
    tries: tries,
    skipped: skipped
  };
}

// ★ AI viết thêm câu cho bộ đang học (không giới hạn số lượng)

export function initializeAiValidation() {
  /* ═══════════════════════════════════════════════════════════
     ★ KIỂM TRA NGỮ NGHĨA: nghĩa tiếng Việt có ĐÚNG với chữ Hán không?
     aiItemOk() ở trên chỉ soát HÌNH THỨC (đủ trường, số chữ Hán = số âm tiết,
     không còn số thanh). Nó KHÔNG đọc nghĩa — nên câu sai nghĩa vẫn lọt, ví dụ:
        批量 (pī liàng) bị ghi "số lượng lớn"
        → sai: 批量 là "theo lô / hàng loạt / sản xuất hàng loạt".
          "số lượng lớn" phải là 大量 (dà liàng) hoặc 数量大.
     Bước dưới đây bổ sung kiểm tra NGỮ NGHĨA bằng chính AI, theo cách
     "tự dịch độc lập rồi đối chiếu" (self-consistency) — hiệu quả hơn hỏi
     thẳng "nghĩa này đúng không?" vì model có xu hướng gật đầu với chính nó:
       1) AI đọc chữ Hán và TỰ DỊCH (không nhìn nghĩa đã cho),
       2) so bản dịch của mình với nghĩa đã cho,
       3) chỉ khi lệch mới trả về nghĩa đúng.
     Không phụ thuộc từ điển offline: đã kiểm tra 批量 KHÔNG có trong gói
     41.621 mục của app, nên tra từ điển đơn thuần sẽ bỏ sót đúng lỗi này.
     ═══════════════════════════════════════════════════════════ */
  aiValidationState.AI_VERIFY_KEY = 'gp:aiVerify';
  /* Đếm số nghĩa đã sửa trong lần tạo gần nhất (để báo cho người dùng) */
  aiValidationState.aiVerifyFixedCount = 0;
}
