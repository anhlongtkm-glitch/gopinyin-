// State and behavior owned by shared/help. Initialization is orchestrated by app/bootstrap.js.

import { retrySentence, skip } from "../features/typing/controls.js";

import { closeHistModal } from "../features/typing/history.js";

import { goPrevSentence } from "../features/typing/input.js";

import { state as domState } from "./dom.js";
import { rememberFocus, restoreFocus, trapTab } from "./focus.js";

/* ── ★ Modal hướng dẫn (nút 💡): giải thích toàn bộ cơ chế gõ + phím tắt ──
   Chỉ mở từ giao diện Luyện gõ (học câu) — không đặt trong game. */
export function openHelpModal() {
  const m = domState.$('helpModal');
  if (!m) return;
  rememberFocus(m);
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
  restoreFocus(m);
  if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
}

export function initializeHelp() {
  document.querySelectorAll('#helpBtn,[data-open-study-help]').forEach(button => { button.onclick = openHelpModal; });
  /* nút ✕ / nền mờ / "Đã hiểu" → đóng (gopinyin.js cũng đóng lại lần nữa, không sao) */
  document.querySelectorAll('#helpModal [data-close]').forEach(el => el.addEventListener('click', closeHelpModal));
  // Keep native Enter/Space on dialog buttons; the shared overlay guard
  // suppresses background lesson shortcuts without swallowing control keys.
  document.addEventListener('keydown', e => {
    const hm = domState.$('helpModal'),
      xm = domState.$('histModal');
    const open = hm && !hm.hidden ? 'help' : xm && !xm.hidden ? 'hist' : null;
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      open === 'help' ? closeHelpModal() : closeHistModal();
      return;
    }
    trapTab(e, open === 'help' ? hm : xm);
  }, true);
  domState.$('retrySentenceBtn').onclick = retrySentence;
  if (domState.$('prevSentenceBtn')) domState.$('prevSentenceBtn').onclick = goPrevSentence;
  domState.$('skipBtn').onclick = skip;
  /* ★ Side panel "Câu đã gõ": click để làm lại */
}
