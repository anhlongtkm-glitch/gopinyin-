// State and behavior owned by features/typing/events. Initialization is orchestrated by app/bootstrap.js.

import { hint } from "./controls.js";
import { studyOverlayOpen, canFocusStudyInput } from "../../shared/study/interactions.js";

import { handleAutoTyping, goNextAfterCorrect } from "./input.js";

import { state as typingSessionState } from "./session.js";

import { state as domState } from "../../shared/dom.js";

/* ★ Gõ sai → có HIỆU ỨNG LỖI (rung ô gõ + báo bằng chứng), ký tự sai vẫn
   KHÔNG vào ô gõ. Người dùng không bị "mất chữ" mà vẫn biết mình gõ sai. */
export function hanziInputShake() {
  const inp = domState.$('pinyinInput');
  inp.classList.remove('shakeBad');
  void inp.offsetWidth; // ép reflow để animation chạy lại
  inp.classList.add('shakeBad');
  setTimeout(() => inp.classList.remove('shakeBad'), 520);
}
/* ★ Bắt đầu gõ bằng IME tiếng Trung → dọn viền đỏ / thông báo lỗi cũ.
   Trước đây đang báo đỏ mà người dùng chuyển sang gõ pinyin (đang composition)
   thì viền đỏ vẫn nằm đó, trông như bị chặn dù thực ra chỉ là đang gõ dở. */

/* Game bắn chữ tự xử lý phím khi đang mở → nhường cho game, tránh xung đột.
   (isGameVisible() nằm trong IIFE của game, không truy cập được ở đây nên
    kiểm tra trực tiếp #gameCard cho chắc.) */
export function typingGameOpen() {
  const c = domState.$('gameCard');
  return !!(c && !c.classList.contains('hidden'));
}

export function typingModeActive() {
  const quiz = domState.$('quizArea');
  if (!quiz || quiz.classList.contains('hidden') || domState.$('appCard')?.classList.contains('hidden')) return false;
  /* Không cần dataset: nếu màn hình luyện gõ đang mở và game đã đóng thì
     phím tắt vẫn phải hoạt động (ví dụ đang xem lại câu, đã hết bộ câu…). */
  return !typingGameOpen();
}

export function initializeTypingEvents() {
  const feedback = domState.$('feedback'), feedbackRow = domState.$('typingFeedbackRow');
  if (feedback && feedbackRow) {
    const syncFeedback = () => { feedbackRow.hidden = feedback.classList.contains('hidden'); };
    new MutationObserver(syncFeedback).observe(feedback, {attributes:true, attributeFilter:['class']});
    syncFeedback();
  }
  /* ★ Bắt đầu gõ bằng IME tiếng Trung → dọn viền đỏ / thông báo lỗi cũ.
     Trước đây đang báo đỏ mà người dùng chuyển sang gõ pinyin (đang composition)
     thì viền đỏ vẫn nằm đó, trông như bị chặn dù thực ra chỉ là đang gõ dở. */
  domState.$('pinyinInput').addEventListener('compositionstart', () => {
    typingSessionState.composing = true;
    const inp = domState.$('pinyinInput');
    inp.classList.remove('bad', 'shakeBad');
    const fb = domState.$('feedback');
    if (fb && fb.classList.contains('bad') && !typingSessionState.awaitingEnter) {
      fb.className = 'feedback hidden';
      fb.innerHTML = '';
    }
  });
  domState.$('pinyinInput').addEventListener('compositionend', () => {
    typingSessionState.composing = false;
    handleAutoTyping();
  });
  // Keyboard commands are owned by the shared study shortcut controller.
  domState.$('pinyinInput').addEventListener('input', handleAutoTyping);
  domState.$('pinyinInput').addEventListener('paste', e => e.preventDefault());
  /* ★ Giữ ô gõ luôn có focus trong màn hình luyện gõ — khi người dùng bấm
     vào vùng trống hoặc dòng chữ Hán, focus quay lại ô gõ (nhưng không
     giành focus khi họ cố bấm nút / bảng / ô nhập khác). */
  document.addEventListener('pointerdown', e => {
    if (!typingModeActive()) return;
    const t = e.target;
    if (!t || !t.closest) return;
    /* Không mở modal / đang mở modal → đừng giành focus */
    if (studyOverlayOpen()) return;
    /* không giành focus nếu bấm vào nút bấm, ô nhập khác, link, hoặc khu vực chữ Hán
       (bấm chữ Hán để tra nghĩa là hành vi có chủ đích) */
    if (t.closest('button,a,summary,input:not(#pinyinInput),textarea,select,[role=button],[role=tab],[role=switch],.hanzi-pair,.modal,#app-history-panel,.hanzi,.studySettings')) return;
    const inp = domState.$('pinyinInput');
    const activeBefore = document.activeElement;
    if (inp && activeBefore !== inp) setTimeout(() => { if (typingModeActive() && canFocusStudyInput(inp, activeBefore)) inp.focus({preventScroll:true}); }, 0);
  }, true);
  domState.$('hintBtn').onclick = hint;
  domState.$('typingNextBtn')?.addEventListener('click', () => {
    if (typingModeActive() && !typingSessionState.composing && typingSessionState.awaitingEnter && !studyOverlayOpen()) goNextAfterCorrect();
  });
  /* ── ★ Modal hướng dẫn (nút 💡): giải thích toàn bộ cơ chế gõ + phím tắt ──
     Chỉ mở từ giao diện Luyện gõ (học câu) — không đặt trong game. */
}
