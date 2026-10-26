import { isStudyAllowed } from "../auth/service.js";
import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/typing/controls. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { answerWords, updateChineseHighlight, updateWrongBadge } from "./answers.js";

import { save, resetSessionRuntime } from "./progress.js";

import { render } from "./render.js";

import { markSentenceWrong } from "./scoring.js";

import { state as typingSessionState, currentRow } from "./session.js";

import { resetTypedSpeech, populateVoiceSelect, speakText } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { renderChineseWords } from "../../shared/language/hanzi.js";

import { appConfirm } from "../../shared/modal.js";

import { progressKey } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { gtReset } from "../../shared/translation.js";

import { shuffle } from "../../shared/utils.js";

export function hint() {
  if (!isStudyAllowed()) return;
  if (typingSessionState.index >= typingSessionState.order.length) return;
  typingSessionState.pinyinHint = !typingSessionState.pinyinHint; // giữ trạng thái qua các câu trong phiên — mặc định ẩn khi mới vào
  domState.$('chinese').classList.toggle('show-pinyin', typingSessionState.pinyinHint);
  domState.$('hintBtn').textContent = typingSessionState.pinyinHint ? '💡 Ẩn Pinyin' : '💡 Hiện Pinyin';
  domState.$('pinyinInput').focus();
}

export function skip() {
  if (!isStudyAllowed()) return;
  const q = currentRow();
  if (!q) return;
  const inp = domState.$('pinyinInput');
  markSentenceWrong(); // câu này tính là sai (nếu chưa tính)
  const ans = String(q.zh || '').trim() || answerWords(q).marked.join(' ');
  typingSessionState.awaitingEnter = false;
  inp.readOnly = false;
  inp.classList.remove('ok', 'bad');
  toast('⏭ Đã bỏ qua — đáp án: ' + ans, 'warn', 3200);
  typingSessionState.index++;
  save();
  render();
}
// ★ Làm lại câu hiện tại — xóa nội dung đã gõ, giữ nguyên câu

// ★ Làm lại câu hiện tại — xóa nội dung đã gõ, giữ nguyên câu
export function retrySentence() {
  if (!isStudyAllowed()) return;
  const q = currentRow();
  if (!q) return;
  typingSessionState.awaitingEnter = false;
  typingSessionState.lastValidInput = '';
  const inp = domState.$('pinyinInput');
  inp.value = '';
  inp.readOnly = false;
  inp.className = 'input';
  resetTypedSpeech(); // làm lại → đếm lại chữ đã đọc từ đầu
  typingSessionState.hanWrongSig = '';
  domState.$('feedback').className = 'feedback hidden';
  domState.$('feedback').innerHTML = '';
  renderChineseWords(q); // xoá tô đỏ/vàng
  updateChineseHighlight();
  inp.focus();
}

export async function resetProgress() {
  if (!isStudyAllowed()) return;
  if (!typingSessionState.activeDataset) return; // phiên AI không lưu tiến độ → không có gì để xoá
  if (!(await appConfirm('Xóa tiến độ và danh sách câu sai của riêng bộ này?', {
    title: 'Xóa tiến độ',
    okText: 'Xóa',
    danger: true
  }))) return;
  learningStorage.removeItem(progressKey(typingSessionState.activeDataset.id));
  typingSessionState.mainOrder = shuffle(typingSessionState.rows.map((_, i) => i));
  typingSessionState.mainIndex = 0;
  typingSessionState.mode = 'all';
  typingSessionState.order = [...typingSessionState.mainOrder];
  typingSessionState.index = 0;
  typingSessionState.wrongIds = new Set();
  typingSessionState.stats = {
    correct: 0,
    wrong: 0,
    combo: 0,
    bestCombo: 0,
    attempts: 0
  };
  typingSessionState.autoSound = true;
  typingSessionState.speechRate = .8;
  typingSessionState.selectedVoiceName = '';
  typingSessionState.showVietnamese = true;
  typingSessionState.showHanzi = true;
  typingSessionState.pinyinHint = false;
  typingSessionState.readOnType = true;
  resetSessionRuntime();
  domState.$('rateSelect').value = '.8';
  populateVoiceSelect();
  updateSoundUI();
  updateReadTypeUI();
  updateViUI();
  updateHanUI();
  updateModeUI();
  save();
  render();
}

/* ── Mode Switching ──
   ★ Đã bỏ nút chế độ (Tất cả / Câu sai) khỏi thanh công cụ theo yêu cầu —
   giữ lại hàm cho an toàn nếu sau này gọi từ nơi khác (đều có guard null). */

/* ── Mode Switching ──
   ★ Đã bỏ nút chế độ (Tất cả / Câu sai) khỏi thanh công cụ theo yêu cầu —
   giữ lại hàm cho an toàn nếu sau này gọi từ nơi khác (đều có guard null). */
export function updateModeUI() {
  const a = domState.$('allModeBtn'),
    w = domState.$('wrongModeBtn');
  if (a) {
    a.classList.toggle('active', typingSessionState.mode === 'all');
    a.setAttribute('aria-pressed', typingSessionState.mode === 'all' ? 'true' : 'false');
  }
  if (w) {
    w.classList.toggle('active', typingSessionState.mode === 'wrong');
    w.setAttribute('aria-pressed', typingSessionState.mode === 'wrong' ? 'true' : 'false');
  }
  updateWrongBadge();
}

export function switchMode(nextMode) {
  if (nextMode === typingSessionState.mode) return;
  if (typingSessionState.mode === 'all') {
    typingSessionState.mainOrder = [...typingSessionState.order];
    typingSessionState.mainIndex = typingSessionState.index;
  }
  typingSessionState.mode = nextMode;
  if (typingSessionState.mode === 'all') {
    typingSessionState.order = [...typingSessionState.mainOrder];
    typingSessionState.index = typingSessionState.mainIndex;
  } else {
    const ids = [...typingSessionState.wrongIds];
    if (!ids.length) {
      toast('Hiện chưa có câu sai để luyện.', 'warn');
      typingSessionState.mode = 'all';
      typingSessionState.order = [...typingSessionState.mainOrder];
      typingSessionState.index = typingSessionState.mainIndex;
      updateModeUI();
      return;
    }
    const idSet = new Set(ids);
    typingSessionState.order = shuffle(typingSessionState.rows.map((r, i) => idSet.has(r.id) ? i : null).filter(i => i !== null));
    typingSessionState.index = 0;
  }
  typingSessionState.awaitingEnter = false;
  window.speechSynthesis?.cancel();
  updateModeUI();
  save();
  render();
}
/* ★ Cập nhật công tắc: KHÔNG ghi đè textContent (sẽ xoá icon + nhãn trong
   HTML). Chỉ đổi icon, class .off và aria-pressed — trạng thái Bật/Tắt do CSS
   hiển thị bằng đèn LED, nhờ vậy nhãn không bị đổi độ dài gây nhảy layout. */

/* ★ Cập nhật công tắc: KHÔNG ghi đè textContent (sẽ xoá icon + nhãn trong
   HTML). Chỉ đổi icon, class .off và aria-pressed — trạng thái Bật/Tắt do CSS
   hiển thị bằng đèn LED, nhờ vậy nhãn không bị đổi độ dài gây nhảy layout. */
export function setToggleUI(id, on, icoOn, icoOff) {
  const b = domState.$(id);
  if (!b) return;
  b.classList.toggle('off', !on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  const i = b.querySelector('.tgIco');
  if (i && icoOn) i.textContent = on ? icoOn : icoOff || icoOn;
}

export function updateSoundUI() {
  setToggleUI('soundToggle', typingSessionState.autoSound, '🔊', '🔇');
}

export function toggleAutoSound() {
  typingSessionState.autoSound = !typingSessionState.autoSound;
  if (!typingSessionState.autoSound && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  updateSoundUI();
  save();
  domState.$('pinyinInput').focus();
}
/* ── Nút "Đọc khi gõ": đọc chữ Hán ngay khi gõ đúng ── */

/* ── Nút "Đọc khi gõ": đọc chữ Hán ngay khi gõ đúng ── */
export function updateReadTypeUI() {
  setToggleUI('readTypeToggle', typingSessionState.readOnType, '🔈', '🔇');
}

export function toggleReadType() {
  typingSessionState.readOnType = !typingSessionState.readOnType;
  resetTypedSpeech(); // bật lại thì đọc từ chữ đang gõ dở
  if (!typingSessionState.readOnType && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  updateReadTypeUI();
  save();
  domState.$('pinyinInput').focus();
}

/* Gợi ý khi ẩn cả hai dòng */

/* Gợi ý khi ẩn cả hai dòng */
export function syncQuizHint() {
  const h = domState.$('quizEmptyHint');
  if (h) h.hidden = typingSessionState.showVietnamese || typingSessionState.showHanzi;
}

/* ── Vietnamese Toggle ── */

/* ── Vietnamese Toggle ── */
export function updateViUI() {
  setToggleUI('viToggle', typingSessionState.showVietnamese, '👁️', '🚫');
  /* ★ ẩn HẲN cả dòng (kể cả nhãn) thay vì làm mờ chữ */
  domState.$('viLine')?.classList.toggle('vi-hidden', !typingSessionState.showVietnamese);
  syncQuizHint();
}

export function toggleVietnamese() {
  typingSessionState.showVietnamese = !typingSessionState.showVietnamese;
  updateViUI();
  save();
  domState.$('pinyinInput').focus();
}

/* ── Hanzi (chữ Hán) Toggle ── */

/* ── Hanzi (chữ Hán) Toggle ── */
export function updateHanUI() {
  setToggleUI('hanToggle', typingSessionState.showHanzi, '🀄', '🀄');
  domState.$('hanLine')?.classList.toggle('vi-hidden', !typingSessionState.showHanzi);
  syncQuizHint();
}

export function toggleHanziLine() {
  typingSessionState.showHanzi = !typingSessionState.showHanzi;
  updateHanUI();
  save();
  domState.$('pinyinInput').focus();
}

/* ═══════════════════════════════════════════════════════════
   ★ BUBBLE GOOGLE DỊCH (kiểu chatbox nhỏ, neo trên chữ Hán)
   ★ Khi bấm vào chữ Hán, hiện bubble nhỏ ngay phía trên
   ★ Tự tắt sau 5 giây, hoặc khi click chữ Hán khác
   ★ KHÔNG chặn gõ phím
   ★ Dùng MyMemory API (chính) + Google Translate (dự phòng)
   ★ Cache kết quả vào localStorage
   ═══════════════════════════════════════════════════════════ */

export function initializeTypingControls() {
  /* ── Hint / Skip / Reset ── */
  /* Cho bàn phím ảo / nơi khác gọi được (ẩn/hiện pinyin — chỉ Enter và nút 💡) */
  publishLegacy("__gpToggleHint", function () {
    hint();
  });
}

export function initializeTypingControls2() {
  /* ★ Tra nghĩa online: luôn bật (đã bỏ nút bật/tắt) — gọi thẳng MyMemory qua HTTPS */
  // ★ Gõ BẤT KỲ phím nào → tự tắt popup (Esc cũng tắt)
  document.addEventListener('keydown', e => {
    if (domState.$('appModal').classList.contains('show')) return; // modal ưu tiên hơn
    if (!domState.$('gtPopup').classList.contains('show')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
    }
    gtReset();
  });
  // ★ Click BẤT KỲ đâu → tự tắt popup
  // (click vào chữ Hán đã stopPropagation nên không tới đây → vẫn mở popup mới bình thường)
  document.addEventListener('click', e => {
    if (domState.$('appModal').classList.contains('show')) return;
    if (!domState.$('gtPopup').classList.contains('show')) return;
    // Không tắt khi click bên trong popup (ví dụ nút ✕)
    if (domState.$('gtPopup').contains(e.target)) return;
    gtReset();
  });
  domState.$('rateSelect').onchange = e => {
    typingSessionState.speechRate = Number(e.target.value) || .8;
    save();
    domState.$('pinyinInput').focus();
  };
  domState.$('voiceSelect').onchange = e => {
    typingSessionState.selectedVoiceName = e.target.value;
    save();
    const q = typingSessionState.index < typingSessionState.order.length ? typingSessionState.rows[typingSessionState.order[typingSessionState.index]] : null;
    if (q && q.zh && q.zh !== '—') speakText(q.zh, false);
    domState.$('pinyinInput').focus();
  };
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateVoiceSelect;
    setTimeout(populateVoiceSelect, 100);
  }

  /* ── ★ Header: đổ bóng khi cuộn (sticky) ── */
}
