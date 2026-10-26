import { requireAccount, isStudyAllowed, currentUser } from "../auth/service.js";
// State and behavior owned by features/pronunciation/recording. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationAssessmentState } from "./assessment.js";

import { state as pronunciationFileTransferState } from "./file-transfer.js";

import { currentItem, nextItem } from "./lesson.js";

import { drawMeter } from "./meter.js";

import { state as pronunciationMicrophoneState } from "./microphone.js";

import { state as pronunciationRecognitionState } from "./recognition.js";

import { renderStats, renderHanzi, renderResult, updateMicLabel } from "./render.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationStorageState } from "./storage.js";

import { state as pronunciationUtilsState, esc, toast } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Luồng ghi âm
   ═══════════════════════════════════════════════════════════ */
export function setPhase(p, msg) {
  pronunciationSessionState.S.phase = p;
  const btn = pronunciationUtilsState.$('pronMicBtn');
  const st = pronunciationUtilsState.$('pronStatus');
  if (btn) {
    btn.classList.toggle('is-rec', p === 'recording');
    btn.classList.toggle('is-busy', p === 'analyzing' || p === 'requesting');
    btn.disabled = p === 'analyzing' || p === 'requesting';
    const txt = btn.querySelector('.pronMicTxt');
    const sub = btn.querySelector('.pronMicSub');
    if (txt) txt.textContent = p === 'recording' ? 'Đang nghe… bấm để dừng' : p === 'analyzing' ? 'Đang phân tích…' : p === 'requesting' ? 'Đang xin quyền micro…' : pronunciationSessionState.S.result ? 'Nhấn để nói lại' : 'Nhấn để bắt đầu nói';
    if (sub) sub.innerHTML = p === 'recording' ? 'hoặc nhấn <b>Enter</b> để dừng' : p === 'idle' ? 'hoặc nhấn <b>Enter</b>' : '';
  }
  if (st) {
    st.className = 'pronStatus' + (p === 'error' ? ' is-err' : p === 'result' ? ' is-ok' : p === 'analyzing' ? ' is-busy' : '');
    if (msg != null) st.innerHTML = msg;else if (p === 'idle') st.innerHTML = '';
  }
  const tm = pronunciationUtilsState.$('pronTimer');
  if (tm) tm.classList.toggle('hidden', p !== 'recording');
  /* đổi trạng thái → vẽ lại "đường nền" (khi không ghi âm) hoặc để vòng lặp sóng tiếp quản */
  if (p !== 'recording') drawMeter(0);
}

export function fmtSec(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

export async function beginRecording() {
  if (!await requireAccount(() => beginRecording())) return;
  if (pronunciationSessionState.S.busy) return;
  if (pronunciationSessionState.S.phase === 'recording') {
    stopRecording('manual');
    return;
  }
  if (!pronunciationSessionState.S.items.length) return;
  if (!pronunciationMicrophoneState.PronMic.supported()) {
    setPhase('error', '⚠️ Trình duyệt không cho truy cập micro trên trang này. Hãy mở bằng <b>Chrome</b> hoặc <b>Edge</b> qua <b>https</b> (hoặc localhost).');
    return;
  }
  if (!pronunciationRecognitionState.PronAsr.supported()) {
    setPhase('error', '⚠️ Trình duyệt này không hỗ trợ nhận dạng giọng nói (Web Speech API). Hãy dùng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính để luyện phát âm.');
    return;
  }
  setPhase('requesting', '🎙 Đang xin quyền micro…');
  let stream;
  try {
    stream = await pronunciationMicrophoneState.PronMic.acquire();
  } catch (e) {
    const name = e && e.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      setPhase('error', '🚫 Micro chưa được cấp quyền. Bấm vào biểu tượng <b>🔒</b> cạnh thanh địa chỉ → cho phép <b>Micro</b>, rồi thử lại.');
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setPhase('error', '🎧 Không tìm thấy micro nào trên máy. Hãy cắm tai nghe có micro hoặc kiểm tra thiết bị âm thanh.');
    } else {
      setPhase('error', '⚠️ Không mở được micro (' + esc(name || 'lỗi không rõ') + '). Kiểm tra lại thiết bị rồi thử lại.');
    }
    return;
  }

  /* lượt mới — không dùng lại âm thanh / kết quả của lượt trước */
  pronunciationSessionState.S.record = null;
  pronunciationSessionState.S.busy = false;
  /* Nhắc 1 lần: nếu quyền chỉ được cấp "lần này" thì lần sau mở trang vẫn
     phải cấp lại — hướng dẫn chọn "Cho phép mỗi khi truy cập trang web". */
  if (!pronunciationSessionState.S.permHintShown) {
    pronunciationSessionState.S.permHintShown = true;
    if (!pronunciationFileTransferState.isFileProto()) {
      pronunciationMicrophoneState.PronMic.permission().then(p => {
        if (p === 'prompt') toast('Mẹo: khi Chrome hỏi micro, chọn “Cho phép mỗi khi truy cập trang web” để không phải cấp lại lần sau.', 'warn', 6000);
      });
    }
  }
  pronunciationMicrophoneState.PronMic.startRecorder(stream);
  pronunciationMicrophoneState.PronMic.startMeter(stream);
  pronunciationRecognitionState.PronAsr.start();
  pronunciationSessionState.S.startedAt = Date.now();
  setPhase('recording', '<span class="pronDot"></span>Đang nghe… hãy nói câu ở trên.');
  if (pronunciationSessionState.S.timer) clearInterval(pronunciationSessionState.S.timer);
  pronunciationSessionState.S.timer = setInterval(() => {
    const tm = pronunciationUtilsState.$('pronTimer');
    if (tm) tm.textContent = fmtSec(Date.now() - pronunciationSessionState.S.startedAt);
  }, 100);
  if (pronunciationSessionState.S.maxTimer) clearTimeout(pronunciationSessionState.S.maxTimer);
  pronunciationSessionState.S.maxTimer = setTimeout(() => stopRecording('timeout'), pronunciationSessionState.MAX_MS);
}

export async function stopRecording(reason) {
  if (pronunciationSessionState.S.phase !== 'recording') return;
  if (pronunciationSessionState.S.timer) {
    clearInterval(pronunciationSessionState.S.timer);
    pronunciationSessionState.S.timer = 0;
  }
  if (pronunciationSessionState.S.maxTimer) {
    clearTimeout(pronunciationSessionState.S.maxTimer);
    pronunciationSessionState.S.maxTimer = 0;
  }
  const dur = Date.now() - pronunciationSessionState.S.startedAt;
  const spoke = pronunciationSessionState.S.hasSpeech;
  pronunciationMicrophoneState.PronMic.stopMeter();
  pronunciationMicrophoneState.PronMic.stopRecorder();
  pronunciationRecognitionState.PronAsr.stop();
  setPhase('analyzing', '<span class="pronSpinner"></span>Đang phân tích phát âm…');

  /* chờ kết quả nhận dạng cuối cùng (tối đa 2.5s để không treo UI) */
  await pronunciationRecognitionState.PronAsr.wait(2500);
  const transcript = (pronunciationSessionState.S.asrText || '').trim();

  /* ★ Chỉ coi là "quá ngắn" khi KHÔNG có cả nội dung nhận dạng lẫn tín hiệu
     âm thanh. Người nói từ ngắn rất nhanh (0.3–0.4 giây) hoặc micro thu nhỏ
     vẫn phải được chấm bình thường — trước đây kiểm tra thời lượng trước nên
     các lượt này bị từ chối oan. */
  if (!transcript && dur < 450 && !spoke) {
    pronunciationMicrophoneState.PronMic.release();
    pronunciationSessionState.S.busy = false;
    setPhase('error', '⏱ Âm thanh quá ngắn. Hãy bấm micro rồi nói cả câu ngay, đừng chờ.');
    return;
  }
  if (pronunciationSessionState.S.asrErr === 'not-allowed' || pronunciationSessionState.S.asrErr === 'service-not-allowed') {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', '🚫 Trình duyệt chặn nhận dạng giọng nói. Hãy cấp quyền micro và thử lại.');
    return;
  }
  if (pronunciationSessionState.S.asrErr === 'network') {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', '📡 Mất kết nối tới dịch vụ nhận dạng giọng nói. Kiểm tra mạng rồi thử lại.');
    return;
  }
  if (!transcript) {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', spoke ? '🔇 Chưa nghe rõ giọng nói của bạn. Hãy kiểm tra micro và thử nói lại trong môi trường yên tĩnh hơn.' : '🔇 Không phát hiện giọng nói. Hãy bấm micro rồi nói to, rõ hơn.');
    return;
  }
  await finishAssessment(transcript, pronunciationSessionState.S.asrConf);
}

export async function finishAssessment(transcript, conf) {
  if (!isStudyAllowed()) return;
  const item = currentItem();
  if (!item) {
    setPhase('idle');
    return;
  }
  const uid = currentUser()?.id;
  pronunciationSessionState.S.busy = true;

  /* 1) Thử dịch vụ chấm phát âm thật (nếu có cấu hình) */
  let result = null;
  try {
    const blob = pronunciationSessionState.S.chunks.length ? new Blob(pronunciationSessionState.S.chunks, {
      type: pronunciationSessionState.S.chunks[0].type || 'audio/webm'
    }) : null;
    result = await pronunciationAssessmentState.PronAssess.server(item, blob);
  } catch (e) {
    result = null;
  }

  if (!isStudyAllowed() || currentUser()?.id !== uid) { pronunciationSessionState.S.busy = false; return; }
  /* 2) Không có → đánh giá sơ bộ độ khớp nội dung từ văn bản nhận dạng */
  if (!result) result = pronunciationAssessmentState.PronAssess.local(item, transcript, conf);
  pronunciationSessionState.S.result = result;
  pronunciationSessionState.S.sessionTries++;
  pronunciationSessionState.S.busy = false;
  pronunciationMicrophoneState.PronMic.release();
  pronunciationStorageState.PronStore.add(item, result.score, result.score >= pronunciationSessionState.GOOD);
  pronunciationSessionState.S.record = result;
  renderStats();
  renderHanzi();
  renderResult();
  setPhase('result', '');
  updateMicLabel();
  if (pronunciationSessionState.S.settings.autoNext) {
    if (pronunciationSessionState.S.silenceTimer) clearTimeout(pronunciationSessionState.S.silenceTimer);
    pronunciationSessionState.S.silenceTimer = setTimeout(() => {
      if (pronunciationSessionState.S.phase === 'result' && pronunciationSessionState.S.settings.autoNext) nextItem();
    }, 3600);
  }
}

/* ═══════════════════════════════════════════════════════════
   Điều hướng câu
   ═══════════════════════════════════════════════════════════ */
