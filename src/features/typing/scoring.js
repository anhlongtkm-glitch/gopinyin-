import { isStudyAllowed } from "../auth/service.js";
import { setMascot } from "../../shared/mascot.js";
import { studyOverlayOpen, scheduleStudyControlReveal } from "../../shared/study/interactions.js";
import { navigationVersion } from '../../app/routes.js';
import { nextReview } from "./review.js";
// State and behavior owned by features/typing/scoring. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { aiCurrentUnit } from "../ai/session.js";

import { answerWords, updateChineseHighlight, updateWrongBadge } from "./answers.js";

import { recordHistory } from "./history.js";

import { save } from "./progress.js";

import { renderStatsOnly } from "./render.js";

import { state as typingSessionState, currentRow } from "./session.js";

import { speakText } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

/* ── Mark Correct / Wrong ── */
export function markSentenceCorrect() {
  if (!isStudyAllowed()) return;
  if (typingSessionState.awaitingEnter || typingSessionState.index >= typingSessionState.order.length) return;
  /* ★ Nếu lúc gõ xong đã đọc (chữ cuối + cả câu, hoặc 1 lần cả câu) thì
     KHÔNG đọc lại lần nữa sau 1 giây. */
  const skipSpeech = typingSessionState.suppressSentenceSpeech;
  typingSessionState.suppressSentenceSpeech = false;
  const inp = domState.$('pinyinInput'),
    q = currentRow(),
    completedRows = typingSessionState.rows,
    completedRowIndex = typingSessionState.order[typingSessionState.index];
  if (!q) return;
  /* ★ Gõ đúng → ô gõ hiện đáp án CHỮ HÁN (kèm dấu câu gốc) để đối chiếu */
  const ans = String(q.zh || '').trim() || answerWords(q).marked.join(' ');
  inp.value = ans;
  typingSessionState.lastValidInput = ans;
  typingSessionState.stats.attempts++;
  typingSessionState.stats.correct++;
  typingSessionState.stats.combo++;
  typingSessionState.stats.bestCombo = Math.max(typingSessionState.stats.bestCombo || 0, typingSessionState.stats.combo);
  /* ★ báo cho bảng xếp hạng: chỉ câu gõ ĐÚNG mới được tính (câu sai không cộng) */
  try {
    legacy.__gpOnSentenceCorrect && legacy.__gpOnSentenceCorrect();
  } catch (e) {}
  if (!typingSessionState.curHadError) {
    for (const id of typingSessionState.wrongIds) if (String(id) === String(q.id)) typingSessionState.wrongIds.delete(id);
    typingSessionState.reviewById[q.id] = nextReview(typingSessionState.reviewById[q.id], true);
  }
  typingSessionState.awaitingEnter = true;
  inp.classList.add('ok');
  inp.readOnly = true;
  domState.$('feedback').className = 'feedback ok';
  domState.$('feedback').textContent = 'Chính xác! Bấm Câu tiếp hoặc nhấn Enter để sang ' + aiCurrentUnit() + ' tiếp theo.';
  if (domState.$('typingFeedbackRow')) domState.$('typingFeedbackRow').hidden = false;
  const eventKey = 'correct:' + typingSessionState.sentStartTs + ':' + completedRowIndex + ':' + typingSessionState.stats.attempts;
  setMascot('typingStudyMascot', 'approve', {animate:true, eventKey});
  setMascot('typingFeedbackMascot', 'face-happy', {animate:true, eventKey});
  save();
  renderStatsOnly();
  updateChineseHighlight();
  recordHistory(q, 'ok'); // ★ ghi câu vừa gõ đúng vào lịch sử bên phải
  document.dispatchEvent(new CustomEvent('gp:activity',{detail:{kind:'typing',id:JSON.stringify([q.zh,q.py])}}));
  const navigation = navigationVersion();
  scheduleStudyControlReveal('typingNextBtn', () => navigation === navigationVersion()
    && typingSessionState.rows === completedRows && currentRow() === q
    && typingSessionState.awaitingEnter && !typingSessionState.composing);
  setTimeout(() => {
    if (skipSpeech || studyOverlayOpen()) return;
    if (!domState.$('appCard').classList.contains('hidden') && typingSessionState.rows === completedRows && typingSessionState.awaitingEnter && typingSessionState.index < typingSessionState.order.length && typingSessionState.order[typingSessionState.index] === completedRowIndex && q.zh && q.zh !== '—') speakText(q.zh, false);
  }, 1000);
}

export function rememberCurrentWrong() {
  const q = currentRow();
  if (!q) return;
  typingSessionState.wrongIds.add(q.id);
  updateWrongBadge();
}
/* ★ Mỗi câu chỉ tính 1 lần Sai dù gõ sai nhiều ký tự; sai thì mất combo */

/* ★ Mỗi câu chỉ tính 1 lần Sai dù gõ sai nhiều ký tự; sai thì mất combo */
export function markSentenceWrong() {
  if (!isStudyAllowed() || typingSessionState.awaitingEnter) return;
  const q = currentRow();
  if (!q) return;
  const firstError = !typingSessionState.curHadError;
  if (firstError) typingSessionState.stats.attempts++;
  if (!typingSessionState.curHadError) {
    typingSessionState.curHadError = true;
    typingSessionState.stats.wrong++;
    if (q) {
      recordHistory(q, 'wrong');
      typingSessionState.reviewById[q.id] = nextReview(typingSessionState.reviewById[q.id], false);
    }
  }
  typingSessionState.stats.combo = 0;
  rememberCurrentWrong();
  if (firstError) {
    if (domState.$('typingFeedbackRow')) domState.$('typingFeedbackRow').hidden = false;
    setMascot('typingFeedbackMascot', 'face-encourage', {animate:true, eventKey:'error:' + typingSessionState.sentStartTs + ':' + typingSessionState.index + ':' + typingSessionState.stats.attempts});
    save();
  }
}

/* ═══════════════════════════════════════════════════════════
   ★ LỊCH SỬ GÕ — side panel "Câu đã gõ"
   Theo dõi mỗi câu đã gõ (đúng / sai / khó), lưu localStorage theo
   từng bộ, lọc Hôm nay / Sai / Khó; bấm vào để làm lại, ⭐ để đánh
   dấu khó. Tham khảo quy trình các app học từ vựng (Anki / Duolingo /
   Hack Chinese): gom câu sai + câu đánh dấu khó để ôn lại dễ dàng.
   ═══════════════════════════════════════════════════════════ */
