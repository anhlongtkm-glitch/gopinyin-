// State and behavior owned by features/typing/answers. Initialization is orchestrated by app/bootstrap.js.

import { hanChars, hanSyllableList, hanziAnswer } from "./input.js";

import { currentRow, state as typingSessionState } from "./session.js";


import { state as domState } from "../../shared/dom.js";

import { normalize } from "../../shared/language/normalization.js";

import { fixPinyin } from "../../shared/language/pinyin.js";
import pinyinCorrections from "../../data/pinyin-corrections.json";

// One canonical syllable list serves typing, pronunciation and character alignment.
export function answerWords(q) {
  // Normalize before splitting: punctuation and apostrophes are boundaries,
  // never empty answer slots. fixPinyin also repairs old separated suffix-r.
  const original = String(q.py || '').trim();
  const corrected = pinyinCorrections[String(q.zh || '').trim() + '\t' + original] || original;
  const marked = fixPinyin(corrected).split(/\s+/).filter(Boolean);
  return {marked,plain:marked.map(syllable => normalize(syllable))};
}

export function currentTypingWordIndex() {
  const q = currentRow();
  if (!q) return -1;
  const total = answerWords(q).marked.length;
  if (typingSessionState.awaitingEnter) return Math.max(0, total - 1);
  /* Số chữ Hán ĐÃ gõ → âm tiết của chữ ĐANG gõ → sáng đúng chữ đó.
     Phải đếm theo chữ Hán rồi tra danh sách âm tiết cũng theo chữ Hán
     (bỏ dấu câu), nếu không câu có dấu câu sẽ sáng nhầm chữ. */
  const typed = hanChars(domState.$('pinyinInput').value).length;
  const list = hanSyllableList(q, hanziAnswer(q).length);
  const idx = typed < list.length ? list[typed] : Math.max(0, total - 1);
  if (idx < 0) return -1;
  return Math.min(Math.max(0, idx), Math.max(0, total - 1));
}

export function updateChineseHighlight() {
  const pairs = document.querySelectorAll('#chinese .hanzi-pair');
  const active = currentTypingWordIndex();
  pairs.forEach(el => {
    const a = Number(el.dataset.wordIndex || 0),
      b = Number(el.dataset.wordEnd != null ? el.dataset.wordEnd : el.dataset.wordIndex || 0);
    el.classList.toggle('active', a >= 0 && active >= a && active <= b);
    el.classList.toggle('done', b >= 0 && b < active);
  });
}

export function updateWrongBadge() {
  const b = domState.$('wrongBadge');
  if (b) b.textContent = typingSessionState.wrongIds.size;
}

/* ── Stats & Render ── */

/* ── Stats & Render ── */
export function currentTotal() {
  return typingSessionState.order.length;
}
/* ★ Hệ thống điểm mới:
   • Đúng  = số CÂU gõ đúng (hoàn thành)
   • Sai   = số CÂU có ít nhất 1 lần gõ sai (mỗi câu chỉ tính 1 lần, dù gõ sai nhiều ký tự)
   • Combo = chuỗi câu đúng liên tiếp hiện tại (sai là mất chuỗi)
   • Chính xác = Đúng / (Đúng + Sai) */
