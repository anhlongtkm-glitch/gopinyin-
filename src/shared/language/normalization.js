// State and behavior owned by shared/language/normalization. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const languageNormalizationState = state;

/* ── Utilities ── */
/* ★ Chuẩn hoá về chữ thường không dấu để SO KHỚP GÕ.
   NFD bóc được ă/â/ê/ô + mọi dấu thanh, NHƯNG ơ (U+01A1) và ư (U+01B0)
   KHÔNG có dạng phân rã → phải thay tường Minh. Nếu không, khi người dùng
   bật gõ tiếng Việt (Telex: "o"+"w"→"ơ"), ký tự này rơi vào [^a-z0-9\s]
   bị đổi thành KHOẢNG TRẮNG → so khớp báo SAI oan (Bug "w lúc đúng lúc sai"). */
export function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[ơƠ]/g, 'o').replace(/[ưƯ]/g, 'u').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
/* ★ Chuẩn hoá RIÊNG cho việc SO KHỚP GÕ: pinyin không có chữ "v", người dùng hay gõ
   "v" thay cho "ü" (nv → nǚ, lv → lǜ). Quy "v" → "u" để cả "nu" và "nv" đều đúng.
   (KHÔNG dùng cho đọc tiêu đề file — ở đó "v" là chữ thật trong "Việt".) */

/* ★ Chuẩn hoá RIÊNG cho việc SO KHỚP GÕ: pinyin không có chữ "v", người dùng hay gõ
   "v" thay cho "ü" (nv → nǚ, lv → lǜ). Quy "v" → "u" để cả "nu" và "nv" đều đúng.
   (KHÔNG dùng cho đọc tiêu đề file — ở đó "v" là chữ thật trong "Việt".) */
export function typingPlain(s) {
  return normalize(s).replace(/v/g, 'u');
}
/* ★ Bỏ chữ "w"/"y" đầu âm tiết nếu có (wo→o, yi→i, wen→en).
   Dùng khi người dùng bật gõ TIẾNG VIỆT: IME (Telex/VNI/UniKey) biến cặp
   nguyên âm+"w" thành ơ/ư nên chữ "w" ĐẦU âm tiết bị nuốt mất khỏi ô gõ
   → "wo" chỉ còn "o" và app từng báo sai oan. */

/* ★ Bỏ chữ "w"/"y" đầu âm tiết nếu có (wo→o, yi→i, wen→en).
   Dùng khi người dùng bật gõ TIẾNG VIỆT: IME (Telex/VNI/UniKey) biến cặp
   nguyên âm+"w" thành ơ/ư nên chữ "w" ĐẦU âm tiết bị nuốt mất khỏi ô gõ
   → "wo" chỉ còn "o" và app từng báo sai oan. */
export function noLeadingSemi(w) {
  return w && w.length > 1 && (w[0] === 'w' || w[0] === 'y') ? w.slice(1) : w;
}
/* So khớp 1 từ đã gõ với từ mong đợi — chấp nhận cả khi thiếu w/y đầu âm tiết. */

/* So khớp 1 từ đã gõ với từ mong đợi — chấp nhận cả khi thiếu w/y đầu âm tiết. */
export function wordMatches(typed, expected) {
  if (typed === expected) return true;
  if (expected.startsWith(typed)) return true;
  const s = noLeadingSemi(expected);
  return !!s && s.startsWith(typed);
}
/* Phát hiện chữ TIẾNG VIỆT trong ô gõ — dùng để nhắc người dùng tắt gõ
   tiếng Việt thay vì báo "ký tự sai".
   ★ CHỈ coi là tiếng Việt khi gặp ký tự mà PINYIN KHÔNG BAO GIỜ dùng:
     đ, ă, â, ê, ô, ơ, ư và các biến thể có dấu (chấm/hỏi/ngã/nặng…).
   ★ LƯU Ý: dấu HUYỀN (à ì ù) và SẮC (á í ú) CŨNG là dấu thanh PINYIN
     (gè, yào, bù, měi…) — app còn tự thêm dấu thanh khi gõ đúng từ, nên
     KHÔNG được coi chúng là tiếng Việt, nếu không mọi lần gõ sai cũng bị
     báo oan "đang bật gõ tiếng Việt". */

export function hasVietnameseChars(s) {
  const t = String(s || '');
  for (const ch of t) {
    if (languageNormalizationState.PINYIN_CHARS.test(ch)) continue; // chữ latin / dấu thanh pinyin → bỏ qua
    if (languageNormalizationState.VIET_CHARS.test(ch)) return true; // ký tự chỉ có trong tiếng Việt
  }
  return false;
}

/* ═══ THỐNG KÊ ĐIỂM YẾU (theo âm tiết) + TỐC ĐỘ — lưu localStorage toàn cục ═══ */

export function initializeLanguageNormalization() {
  /* Phát hiện chữ TIẾNG VIỆT trong ô gõ — dùng để nhắc người dùng tắt gõ
     tiếng Việt thay vì báo "ký tự sai".
     ★ CHỈ coi là tiếng Việt khi gặp ký tự mà PINYIN KHÔNG BAO GIỜ dùng:
       đ, ă, â, ê, ô, ơ, ư và các biến thể có dấu (chấm/hỏi/ngã/nặng…).
     ★ LƯU Ý: dấu HUYỀN (à ì ù) và SẮC (á í ú) CŨNG là dấu thanh PINYIN
       (gè, yào, bù, měi…) — app còn tự thêm dấu thanh khi gõ đúng từ, nên
       KHÔNG được coi chúng là tiếng Việt, nếu không mọi lần gõ sai cũng bị
       báo oan "đang bật gõ tiếng Việt". */
  languageNormalizationState.PINYIN_CHARS = /[a-z0-9āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]/;
  languageNormalizationState.VIET_CHARS = /[đđăâêôơưạảãẹẻẽịỉĩọỏõụủũỵỷỹằắẳẵặầấẩẫậềếểễệồốổỗộờớởỡợừứửữựĐĐĂÂÊÔƠƯẠẢÃẸẺẼỊỈĨỌỎÕỤỦŨỴỶỸẰẮẲẴẶẦẤẨẪẬỀẾỂỄỆỒỐỔỖỘỜỚỞỠỢỪỨỬỮỰ]/;
}
