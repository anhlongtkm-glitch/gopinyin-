// State and behavior owned by features/typing/events. Initialization is orchestrated by app/bootstrap.js.

import { hint } from "./controls.js";

import { handleAutoTyping, goNextAfterCorrect, hanziComplete, goPrevSentence } from "./input.js";

import { markSentenceCorrect } from "./scoring.js";

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

/* ═══════════════════════════════════════════════════════════
   ★ PHÍM TẮT Ở TẦNG DOCUMENT — không phụ thuộc focus của ô gõ.
   Trước đây handler bị gắn thẳng vào #pinyinInput nên khi người dùng
   bấm ra chỗ khác (dòng chữ Hán, nút bấm, thanh cuộn…) thì nhấn Space
   không sang câu được, phải click lại vào ô gõ mới nhận phím.
   ═══════════════════════════════════════════════════════════ */
/* Game bắn chữ tự xử lý phím khi đang mở → nhường cho game, tránh xung đột.
   (isGameVisible() nằm trong IIFE của game, không truy cập được ở đây nên
    kiểm tra trực tiếp #gameCard cho chắc.) */
export function typingGameOpen() {
  const c = domState.$('gameCard');
  return !!(c && !c.classList.contains('hidden'));
}

export function typingModeActive() {
  const quiz = domState.$('quizArea');
  if (!quiz || quiz.classList.contains('hidden')) return false;
  /* Không cần dataset: nếu màn hình luyện gõ đang mở và game đã đóng thì
     phím tắt vẫn phải hoạt động (ví dụ đang xem lại câu, đã hết bộ câu…). */
  return !typingGameOpen();
}

export function initializeTypingEvents() {
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
  /* Ô gõ không tự bắt phím nữa — phím được xử lý ở TẦNG DOCUMENT (bên dưới)
     để nhấn Enter/Space luôn có tác dụng kể cả khi ô gõ đang mất focus. */
  domState.$('pinyinInput').addEventListener('input', handleAutoTyping);
  domState.$('pinyinInput').addEventListener('paste', e => e.preventDefault());
  /* ═══════════════════════════════════════════════════════════
     ★ PHÍM TẮT Ở TẦNG DOCUMENT — không phụ thuộc focus của ô gõ.
     Trước đây handler bị gắn thẳng vào #pinyinInput nên khi người dùng
     bấm ra chỗ khác (dòng chữ Hán, nút bấm, thanh cuộn…) thì nhấn Space
     không sang câu được, phải click lại vào ô gõ mới nhận phím.
     ═══════════════════════════════════════════════════════════ */
  /* Game bắn chữ tự xử lý phím khi đang mở → nhường cho game, tránh xung đột.
     (isGameVisible() nằm trong IIFE của game, không truy cập được ở đây nên
      kiểm tra trực tiếp #gameCard cho chắc.) */

  document.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (typingGameOpen()) return;
    if (!typingModeActive()) return;
    /* Đang mở modal (hướng dẫn / lịch sử / xác nhận) → không xử lý phím của
       màn hình luyện gõ, tránh việc Enter vừa đóng modal vừa bật pinyin. */
    if (document.querySelector('.modal:not([hidden])')) return;
    const am = domState.$('appModal');
    if (am && am.classList.contains('show')) return;
    /* ★ Không cướp phím khi người dùng đang gõ ở MỘT Ô KHÁC (ô tìm từ vựng,
       prompt AI, modal…). Chỉ xử lý khi focus ở ô gõ chữ Hán hoặc ở vùng
       trung tính (body / nút / dòng chữ Hán) — nhờ vậy Space vẫn sang câu
       được dù ô gõ không có focus, mà không phá các ô nhập khác. */
    const ae = document.activeElement;
    if (ae && ae !== domState.$('pinyinInput')) {
      const tag = (ae.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || ae.isContentEditable) return;
    }
    /* ENTER: ẩn/hiện gợi ý pinyin — ĐÂY LÀ PHÍM DUY NHẤT làm việc này. */
    if (e.key === 'Enter') {
      e.preventDefault();
      hint();
      return;
    }
    /* SPACE: CHỈ để SANG MỤC KẾ TIẾP — không bao giờ ẩn/hiện pinyin nữa
       (trước đây Space vừa sang câu vừa bật/tắt pinyin nên rất dễ bấm nhầm).
       · Đã gõ đúng (awaitingEnter)  → sang mục kế tiếp.
       · Ô gõ đã đúng đáp án nhưng trạng thái chưa kịp chốt (IME vừa chốt chữ
         bằng Space, AI vừa chèn mục mới, màn hình vừa render lại…) → chốt rồi
         sang luôn, KHÔNG im lặng bỏ qua cú bấm.
       · Còn đang gõ dở → không làm gì cả. */
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (typingSessionState.awaitingEnter) {
        goNextAfterCorrect();
        return;
      }
      if (hanziComplete()) {
        markSentenceCorrect();
        if (typingSessionState.awaitingEnter) goNextAfterCorrect();
        return;
      }
      return;
    }
    /* BACKSPACE khi đang chờ Space → quay lại làm câu vừa làm */
    if (e.key === 'Backspace' && typingSessionState.awaitingEnter) {
      e.preventDefault();
      goPrevSentence();
      return;
    }
    /* Đang chờ sang câu → chặn mọi ký tự khác gõ vào ô đã khoá */
    if (typingSessionState.awaitingEnter && e.key.length === 1) e.preventDefault();
  });
  /* ★ Giữ ô gõ luôn có focus trong màn hình luyện gõ — khi người dùng bấm
     vào vùng trống hoặc dòng chữ Hán, focus quay lại ô gõ (nhưng không
     giành focus khi họ cố bấm nút / bảng / ô nhập khác). */
  document.addEventListener('pointerdown', e => {
    if (!typingModeActive()) return;
    const t = e.target;
    if (!t || !t.closest) return;
    /* Không mở modal / đang mở modal → đừng giành focus */
    if (document.querySelector('.modal:not([hidden])')) return;
    /* không giành focus nếu bấm vào nút bấm, ô nhập khác, link, hoặc khu vực chữ Hán
       (bấm chữ Hán để tra nghĩa là hành vi có chủ đích) */
    if (t.closest('button,a,input:not(#pinyinInput),textarea,select,.hanzi-pair,.modal,#app-history-panel,.hanzi')) return;
    const inp = domState.$('pinyinInput');
    if (inp && document.activeElement !== inp) setTimeout(() => inp.focus(), 0);
  }, true);
  domState.$('hintBtn').onclick = hint;
  /* ── ★ Modal hướng dẫn (nút 💡): giải thích toàn bộ cơ chế gõ + phím tắt ──
     Chỉ mở từ giao diện Luyện gõ (học câu) — không đặt trong game. */
}
