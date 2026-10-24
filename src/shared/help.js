// State and behavior owned by shared/help. Initialization is orchestrated by app/bootstrap.js.

import { retrySentence, skip } from "../features/typing/controls.js";

import { closeHistModal } from "../features/typing/history.js";

import { goPrevSentence } from "../features/typing/input.js";

import { state as domState } from "./dom.js";

/* ── ★ Modal hướng dẫn (nút 💡): giải thích toàn bộ cơ chế gõ + phím tắt ──
   Chỉ mở từ giao diện Luyện gõ (học câu) — không đặt trong game. */
export function openHelpModal() {
  const m = domState.$('helpModal');
  if (!m) return;
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  try {
    (m.querySelector('.modalClose') || m).focus();
  } catch (e) {}
}

export function closeHelpModal() {
  const m = domState.$('helpModal');
  if (!m || m.hidden) return;
  m.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
}

export function initializeHelp() {
  domState.$('helpBtn').onclick = openHelpModal;
  /* nút ✕ / nền mờ / "Đã hiểu" → đóng (gopinyin.js cũng đóng lại lần nữa, không sao) */
  document.querySelectorAll('#helpModal [data-close]').forEach(el => el.addEventListener('click', closeHelpModal));
  /* ★ Khi modal mở: nuốt phím để game / F1 / tra nghĩa không xử lý; Esc thì đóng */
  document.addEventListener('keydown', e => {
    const hm = domState.$('helpModal'),
      xm = domState.$('histModal');
    const open = hm && !hm.hidden ? 'help' : xm && !xm.hidden ? 'hist' : null;
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      open === 'help' ? closeHelpModal() : closeHistModal();
      return;
    }
    e.stopPropagation();
    if (e.key !== 'Tab') e.preventDefault();
  }, true);
  domState.$('retrySentenceBtn').onclick = retrySentence;
  if (domState.$('prevSentenceBtn')) domState.$('prevSentenceBtn').onclick = goPrevSentence;
  domState.$('skipBtn').onclick = skip;
  /* ★ Side panel "Câu đã gõ": click để làm lại */
}
