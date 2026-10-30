// Local AI response validation and batched generation.
import { callAi, buildAiPrompt } from "./client.js";
import { normalize } from "../../shared/language/normalization.js";
import { fixPinyin, sanitizeLatinInChinese } from "../../shared/language/pinyin.js";
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

// Return the first usable batch so the learner can start without a fill-up
// request. Only an entirely unusable response gets one more attempt.
export async function aiCollect(provider, key, userText, target, level, seen, onProgress, kind, active = () => true) {
  const CHUNK = 10;
  const maxTries = 2;
  let out = [],
    tries = 0,
    emptyTries = 0,
    failure = null,
    stopped = '',
    skipped = 0;
  while (active() && out.length < target && tries < maxTries) {
    tries++;
    if (onProgress) onProgress(out.length, target, tries);
    try {
      // Keep prompts bounded in long lessons; deduplicate against the full set
      // locally, including repeated items inside a single response.
      const text = await callAi(provider, key, buildAiPrompt(userText, Math.min(CHUNK, target - out.length), level, [...seen].slice(-80), kind));
      if (!active()) break;
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
        const accepted = [];
        for (const item of got) {
          if (seen.has(item.zh)) continue;
          seen.add(item.zh);
          accepted.push(item);
          if (accepted.length >= target - out.length) break;
        }
        out = out.concat(accepted);
        break;
      }
    } catch (e) {
      if (!active()) break;
      // A failed request must not spend more free quota in an automatic retry loop.
      if (!out.length) throw e;
      failure = e;
      stopped = e.message;
      break;
    }
  }
  if (out.length > target) out = out.slice(0, target); // giữ đúng số câu đã chọn
  return {
    items: out,
    error: failure,
    stopped: stopped,
    tries: tries,
    skipped: skipped
  };
}
