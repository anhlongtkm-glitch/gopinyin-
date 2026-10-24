// State and behavior owned by features/typing/session. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const typingSessionState = state;

/* ★ NGUỒN DUY NHẤT để lấy câu đang làm. Mọi chỗ hiển thị / chấm điểm / bộ lọc
   đều phải đi qua đây, nhờ vậy không thể xảy ra chuyện "màn hình hiện câu A mà
   bộ lọc lại so với câu B" (đúng lỗi người dùng gặp: xem "现在是零点。" nhưng
   đòi gõ "谢…"). Trả về null nếu dữ liệu không nhất quán → nơi gọi phải dừng. */
export function currentRow() {
  if (typingSessionState.index < 0 || typingSessionState.index >= typingSessionState.order.length) return null;
  const ri = typingSessionState.order[typingSessionState.index];
  if (ri == null || ri < 0 || ri >= typingSessionState.rows.length) return null;
  return typingSessionState.rows[ri] || null;
}
/* ── Trạng thái phiên luyện (không lưu) ──
   ★ MỘT kiểu gõ duy nhất: gõ trực tiếp CHỮ HÁN của cả câu → TỰ CHẤM khi gõ,
     gõ đúng hết mới được sang câu. Space = sang câu · Enter = ẩn/hiện gợi ý Pinyin. */

export function initializeTypingSession() {
  typingSessionState.activeDataset = null;
  typingSessionState.rows = [];
  typingSessionState.order = [];
  typingSessionState.index = 0;
  typingSessionState.mainOrder = [];
  typingSessionState.mainIndex = 0;
  typingSessionState.mode = 'all';
  typingSessionState.wrongIds = new Set();
  typingSessionState.stats = {
    correct: 0,
    wrong: 0,
    combo: 0,
    bestCombo: 0,
    attempts: 0
  };
  typingSessionState.currentFileKey = '';
  typingSessionState.lastValidInput = '';
  typingSessionState.composing = false;
  typingSessionState.awaitingEnter = false;
  typingSessionState.autoSound = true;
  typingSessionState.speechRate = 0.8;
  typingSessionState.selectedVoiceName = '';
  typingSessionState.showVietnamese = true;
  typingSessionState.showHanzi = true;
  typingSessionState.pinyinHint = false;
  typingSessionState.curHadError = false;
  typingSessionState.suppressSentenceSpeech = false;
  typingSessionState.readOnType = true;
  typingSessionState.lastTypedSpoken = '';
  typingSessionState.studyOrigin = 'library';
  /* Trạng thái chấm câu: chữ ký lỗi (chống ghi điểm yếu trùng) */
  typingSessionState.hanWrongSig = '';
  /* ── Trạng thái phiên luyện (không lưu) ──
     ★ MỘT kiểu gõ duy nhất: gõ trực tiếp CHỮ HÁN của cả câu → TỰ CHẤM khi gõ,
       gõ đúng hết mới được sang câu. Space = sang câu · Enter = ẩn/hiện gợi ý Pinyin. */
  typingSessionState.sentStartTs = 0;
}

