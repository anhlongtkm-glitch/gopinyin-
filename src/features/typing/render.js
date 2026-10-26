// State and behavior owned by features/typing/render. Initialization is orchestrated by app/bootstrap.js.

import { aiSessionLive, aiMaybeFill, aiSavedSet, state as aiSessionState, aiShowGen, aiCurrentUnit, aiCurrentKind, aiFillMissingVi } from "../ai/session.js";

import { currentTotal, updateWrongBadge } from "./answers.js";

import { save } from "./progress.js";

import { state as typingSessionState, currentRow } from "./session.js";

import { speedCpm } from "./weakness.js";

import { resetTypedSpeech, speakText } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { renderChineseWords } from "../../shared/language/hanzi.js";

import { gtReset } from "../../shared/translation.js";

/* ★ Hệ thống điểm mới:
   • Đúng  = số CÂU gõ đúng (hoàn thành)
   • Sai   = số CÂU có ít nhất 1 lần gõ sai (mỗi câu chỉ tính 1 lần, dù gõ sai nhiều ký tự)
   • Combo = chuỗi câu đúng liên tiếp hiện tại (sai là mất chuỗi)
   • Chính xác = Đúng / (Đúng + Sai) */
export function renderStatsOnly() {
  const total = currentTotal(),
    done = Math.min(typingSessionState.index + (typingSessionState.awaitingEnter ? 1 : 0), total);
  domState.$('progressText').textContent = done + '/' + total;
  domState.$('correctText').textContent = typingSessionState.stats.correct;
  domState.$('wrongText').textContent = typingSessionState.stats.wrong;
  domState.$('comboText').textContent = typingSessionState.stats.combo;
  domState.$('comboText').title = 'Cao nhất: ' + (typingSessionState.stats.bestCombo || 0);
  const answered = (typingSessionState.stats.correct || 0) + (typingSessionState.stats.wrong || 0);
  domState.$('accuracyText').textContent = answered ? Math.round(typingSessionState.stats.correct / answered * 100) + '%' : '—';
  domState.$('bar').style.width = (total ? done / total * 100 : 0) + '%';
  const cpm = domState.$('cpmText');
  if (cpm) {
    const v = speedCpm();
    cpm.textContent = v ? v + ' CPM' : '—';
    cpm.title = 'Tốc độ trung bình: ' + v + ' ký tự/phút (tính cả phiên này, lưu trên máy)';
  }
  updateWrongBadge();
}

export function render() {
  typingSessionState.awaitingEnter = false;
  const total = currentTotal();
  renderStatsOnly();
  if (aiSessionLive()) aiMaybeFill(); // AI tự viết thêm khi sắp hết câu
  if (aiSessionLive() && !aiSavedSet()) {
    const rb = domState.$('resetBtn');
    if (rb) rb.classList.add('hidden');
  } else {
    const rb = domState.$('resetBtn');
    if (rb) rb.classList.remove('hidden');
  }
  if (typingSessionState.index >= total) {
    // ★ Phiên AI: chưa có đủ câu AI đang viết → giữ màn hình chờ, không báo "hoàn thành"
    if (aiSessionLive() && !aiSessionState.aiSession.stopped) {
      domState.$('completeArea').classList.add('hidden');
      domState.$('quizArea').classList.remove('hidden');
      domState.$('pinyinInput').value = '';
      domState.$('pinyinInput').readOnly = true;
      domState.$('vietnamese').innerHTML = '<span style="opacity:.7">🤖 AI đang viết câu tiếp theo, chờ chút nhé…</span>';
      domState.$('chinese').textContent = '⏳';
      domState.$('feedback').className = 'feedback hidden';
      domState.$('feedback').innerHTML = '';
      aiShowGen('<span class="aiSpinner">AI đang viết câu tiếp theo…</span> (đã có <b>' + typingSessionState.rows.length + '</b> câu)');
      return;
    }
    domState.$('quizArea').classList.add('hidden');
    domState.$('completeArea').classList.remove('hidden');
    const doneMsg = aiSavedSet() ? 'Bạn đã học hết ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' của bộ “' + aiSavedSet().name + '”. Vào lại màn AI sinh câu để tạo thêm bộ mới nhé.' : aiSessionLive() ? 'Bạn đã học ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' do AI tạo cho chủ đề “' + String(aiSessionState.aiSession.prompt).slice(0, 60) + '”. AI đã hết nội dung mới — đổi chủ đề khác để học tiếp nhé.' : typingSessionState.mode === 'wrong' ? 'Bạn đã hoàn thành lượt luyện các câu sai.' : 'Bạn đã hoàn thành lượt học này. Các câu sẽ không lặp lại cho đến khi bạn bấm Xóa tiến độ.';
    domState.$('completeArea').querySelector('p').textContent = doneMsg;
    if (typingSessionState.mode === 'review') domState.$('completeArea').querySelector('p').textContent = 'Đã hoàn thành phiên ôn ' + total + ' câu. Về Bảng điều khiển để chọn bài tiếp theo. Lịch ôn đã được cập nhật theo kết quả của bạn.';
    domState.$('restartBtn').textContent = typingSessionState.studyOrigin === 'ai' ? '← AI sinh câu' : typingSessionState.mode === 'wrong' ? 'Quay lại tất cả câu' : '← Thư viện';
    aiShowGen(aiSessionLive() && !aiSavedSet() ? 'Phiên học AI đã kết thúc — không lưu tiến độ.' : '');
    return;
  }
  domState.$('quizArea').classList.remove('hidden');
  domState.$('completeArea').classList.add('hidden');
  typingSessionState.awaitingEnter = false;
  typingSessionState.curHadError = false;
  const q = currentRow();
  if (!q) {
    domState.$('feedback').className = 'feedback hidden';
    domState.$('feedback').innerHTML = '';
    return;
  }
  const inp = domState.$('pinyinInput');
  inp.disabled = false;
  inp.readOnly = false;
  inp.value = '';
  typingSessionState.lastValidInput = '';
  inp.className = 'input';
  /* Gợi ý trong ô gõ khớp nội dung: bộ từ vựng thì "của từ", bộ câu thì "cả câu" */
  inp.placeholder = aiCurrentKind() === 'word' ? 'Gõ chữ Hán của từ — gõ đúng là tự báo Đúng' : 'Gõ chữ Hán của cả câu — gõ đúng là tự báo Đúng';
  const kbdNext = domState.$('kbdNextLabel');
  if (kbdNext) kbdNext.textContent = 'Sang ' + aiCurrentUnit();
  resetTypedSpeech(); // câu mới → đếm lại chữ đã đọc từ đầu
  typingSessionState.hanWrongSig = '';
  typingSessionState.sentStartTs = Date.now();
  renderChineseWords(q);
  if (q.vi) {
    domState.$('vietnamese').textContent = q.vi;
  } else {
    domState.$('vietnamese').textContent = '—';
    aiFillMissingVi();
  } // thiếu nghĩa → dịch nền rồi tự hiện
  domState.$('feedback').className = 'feedback hidden';
  domState.$('feedback').innerHTML = '';
  // ★ Pinyin mặc định ẨN mỗi khi vào chế độ gõ — bấm nút gợi ý (hoặc 💡 trên bàn phím ảo) để bật
  domState.$('chinese').classList.toggle('show-pinyin', typingSessionState.pinyinHint);
  domState.$('hintBtn').textContent = typingSessionState.pinyinHint ? '💡 Ẩn Pinyin' : '💡 Hiện Pinyin';
  domState.$('fileInfo').textContent = aiSavedSet() ? '🤖 ' + aiSavedSet().name + ' • ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' • đã lưu' : aiSessionLive() ? '🤖 ' + String(aiSessionState.aiSession.prompt).slice(0, 60) + ' • ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' (không lưu tiến độ)' : typingSessionState.activeDataset ? typingSessionState.activeDataset.name + ' • ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' • ' + typingSessionState.wrongIds.size + ' câu cần ôn' : typingSessionState.rows.length + ' ' + aiCurrentUnit();
  gtReset();
  setTimeout(() => {
    inp.focus();
    if (typingSessionState.autoSound && q.zh && q.zh !== '—') speakText(q.zh, false);
  }, 180);
  save();
}

/* ── Mark Correct / Wrong ── */
