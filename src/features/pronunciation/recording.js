import { requireAccount, isStudyAllowed, currentUser } from "../auth/service.js";
import { setMascot } from "../../shared/mascot.js";
import { studyOverlayOpen } from "../../shared/study/interactions.js";
import { cancelPronunciationSample } from './tts.js';
// State and behavior owned by features/pronunciation/recording. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationAssessmentState } from "./assessment.js";

import { state as pronunciationFileTransferState } from "./file-transfer.js";

import { currentItem, nextItem } from "./lesson.js";
import { navigationVersion } from "../../app/routes.js";
import { sourceVersion } from "./settings.js";

import { drawMeter } from "./meter.js";

import { state as pronunciationMicrophoneState } from "./microphone.js";

import { state as pronunciationRecognitionState } from "./recognition.js";

import { renderStats, renderHanzi, renderResult, updateMicLabel } from "./render.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationStorageState } from "./storage.js";

import { state as pronunciationUtilsState, esc, toast } from "./utils.js";
let assessmentVersion = 0;
function clearRecordingTimers() {
  const s = pronunciationSessionState.S;
  clearInterval(s.timer); clearTimeout(s.maxTimer);
  s.timer = 0; s.maxTimer = 0;
}

function recognitionErrorMessage(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return '🚫 Trình duyệt chặn nhận dạng giọng nói. Hãy cấp quyền micro trong cài đặt trang web rồi thử lại.';
  if (code === 'network') return '📡 Không kết nối được dịch vụ nhận dạng giọng nói. Kiểm tra mạng rồi thử lại.';
  if (code === 'audio-capture') return '🎧 Không thu được âm thanh từ micro. Kiểm tra thiết bị và quyền micro rồi thử lại.';
  if (code === 'no-speech') return '🔇 Dịch vụ chưa nhận được giọng nói. Bấm micro để nói lại.';
  if (code === 'unsupported' || code === 'language-not-supported') return '⚠️ Trình duyệt hoặc dịch vụ này không hỗ trợ nhận dạng tiếng Trung. Hãy thử trình duyệt có hỗ trợ nhận dạng giọng nói.';
  if (code === 'start-timeout') return '⚠️ Dịch vụ nhận dạng không phản hồi khi khởi động. Kiểm tra mạng và bấm micro để thử lại.';
  if (code === 'start-failed' || code === 'ended-before-start') return '⚠️ Không khởi động được nhận dạng giọng nói. Bấm micro để thử lại hoặc kiểm tra quyền của trình duyệt.';
  if (code === 'aborted') return '⚠️ Nhận dạng giọng nói đã bị gián đoạn. Bấm micro để nói lại.';
  return '⚠️ Dịch vụ nhận dạng gặp lỗi (' + esc(code) + '). Bấm micro để thử lại.';
}

function failRecognition(code) {
  assessmentVersion++;
  clearRecordingTimers();
  pronunciationRecognitionState.PronAsr.cancelPending();
  pronunciationMicrophoneState.PronMic.release();
  pronunciationSessionState.S.busy = false;
  setPhase('error', recognitionErrorMessage(code));
}

export function cancelAssessment() {
  cancelPronunciationSample();
  assessmentVersion++;
  pronunciationSessionState.S.busy = false;
  clearRecordingTimers();
  clearTimeout(pronunciationSessionState.S.silenceTimer);
  pronunciationSessionState.S.silenceTimer = 0;
  pronunciationMicrophoneState.PronMic?.cancelPending();
  pronunciationRecognitionState.PronAsr?.cancelPending?.();
  if (['requesting', 'starting', 'recording', 'analyzing'].includes(pronunciationSessionState.S.phase)) setPhase('idle', '');
}

/* ═══════════════════════════════════════════════════════════
   Luồng ghi âm
   ═══════════════════════════════════════════════════════════ */
export function setPhase(p, msg) {
  pronunciationSessionState.S.phase = p;
  let captureNote = pronunciationUtilsState.$('pronCaptureNote');
  if (!captureNote && pronunciationSessionState.S.nativeCapture) {
    const stage = document.querySelector('#pronCard .pronStage');
    if (stage) {
      captureNote = document.createElement('small');
      captureNote.id = 'pronCaptureNote'; captureNote.className = 'small';
      captureNote.textContent = 'Chế độ điện thoại không lưu bản ghi nghe lại.';
      stage.after(captureNote);
    }
  }
  if (captureNote) captureNote.hidden = !pronunciationSessionState.S.nativeCapture;
  const btn = pronunciationUtilsState.$('pronMicBtn');
  const st = pronunciationUtilsState.$('pronStatus');
  if (btn) {
    btn.classList.toggle('is-rec', p === 'recording');
    btn.classList.toggle('is-busy', ['analyzing', 'requesting', 'starting'].includes(p));
    btn.disabled = ['analyzing', 'requesting', 'starting'].includes(p);
    btn.setAttribute('aria-label', p === 'starting' ? 'Đang mở nhận dạng giọng nói' : p === 'recording' ? 'Dừng ghi âm' : p === 'analyzing' ? 'Đang phân tích phát âm' : p === 'requesting' ? 'Đang xin quyền micro' : pronunciationSessionState.S.result ? 'Nói lại câu này' : 'Bắt đầu nói');
    btn.setAttribute('aria-busy', ['analyzing', 'requesting', 'starting'].includes(p) ? 'true' : 'false');
    btn.setAttribute('aria-pressed', p === 'recording' ? 'true' : 'false');
    const txt = btn.querySelector('.pronMicTxt');
    const sub = btn.querySelector('.pronMicSub');
    if (txt) txt.textContent = p === 'starting' ? 'Đang mở nhận dạng…' : p === 'recording' ? 'Đang nghe… bấm để dừng' : p === 'analyzing' ? 'Đang phân tích…' : p === 'requesting' ? 'Đang xin quyền micro…' : pronunciationSessionState.S.result ? 'Nhấn để nói lại' : 'Nhấn để bắt đầu nói';
    if (sub) sub.innerHTML = p === 'recording' ? 'hoặc nhấn <kbd>Enter</kbd> để dừng' : p === 'idle' ? 'hoặc nhấn <kbd>Enter</kbd>' : '';
  }
  if (st) {
    delete st.dataset.interim;
    st.className = 'pronStatus' + (p === 'error' ? ' is-err' : p === 'result' ? ' is-ok' : p === 'analyzing' ? ' is-busy' : '');
    if (msg != null) st.innerHTML = msg;else if (p === 'idle') st.innerHTML = '';
  }
  const tm = pronunciationUtilsState.$('pronTimer');
  if (tm) tm.classList.toggle('hidden', p !== 'recording');
  const pose = p === 'recording' ? 'speaking' : ['analyzing', 'requesting', 'starting'].includes(p) ? 'thinking' : p === 'error' ? 'encourage' : p === 'result' ? (pronunciationSessionState.S.result?.score >= pronunciationSessionState.GOOD ? 'clap' : 'encourage') : 'reading';
  setMascot('pronStudyMascot', pose, {animate:p === 'error',eventKey:'phase:' + p + ':' + pronunciationSessionState.S.startedAt + ':' + pronunciationSessionState.S.sessionTries});
  /* đổi trạng thái → vẽ lại "đường nền" (khi không ghi âm) hoặc để vòng lặp sóng tiếp quản */
  if (p !== 'recording') drawMeter(0);
}

export function fmtSec(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

export async function beginRecording() {
  const navigation = navigationVersion(), source = sourceVersion(), attempt = assessmentVersion;
  // A verified, ready session can start device capture inside the tap gesture.
  // Authentication is still required; backend writes retain their own checks.
  if (!isStudyAllowed() && !await requireAccount(() => beginRecording())) return;
  if (navigation !== navigationVersion() || source !== sourceVersion() || attempt !== assessmentVersion) return;
  if (pronunciationSessionState.S.busy || ['requesting', 'starting', 'analyzing'].includes(pronunciationSessionState.S.phase)) return;
  if (pronunciationSessionState.S.phase === 'recording') {
    stopRecording('manual');
    return;
  }
  if (!pronunciationSessionState.S.items.length) return;
  if (window.isSecureContext === false) {
    setPhase('error', '🔒 Nhận dạng giọng nói cần kết nối an toàn. Hãy mở trang qua HTTPS (hoặc localhost trên thiết bị này).');
    return;
  }
  const nativeCapture = pronunciationRecognitionState.PronAsr.nativeCapture?.() || false;
  if (!nativeCapture && !pronunciationMicrophoneState.PronMic.supported()) {
    setPhase('error', '⚠️ Trình duyệt không cho truy cập micro trên trang này. Hãy mở bằng <b>Chrome</b> hoặc <b>Edge</b> qua <b>https</b> (hoặc localhost).');
    return;
  }
  if (!pronunciationRecognitionState.PronAsr.supported()) {
    setPhase('error', recognitionErrorMessage('unsupported'));
    return;
  }
  cancelPronunciationSample();
  pronunciationSessionState.S.nativeCapture = nativeCapture;
  let stream;
  if (nativeCapture) {
    // SpeechRecognition owns the microphone on phones. A parallel getUserMedia
    // stream/recorder/meter can interrupt its capture or stop it before final text.
    pronunciationMicrophoneState.PronMic.hardRelease();
    pronunciationSessionState.S.chunks = [];
    pronunciationSessionState.S.recDone = null;
    pronunciationSessionState.S.hasSpeech = false;
    if (pronunciationSessionState.S.blobUrl) URL.revokeObjectURL(pronunciationSessionState.S.blobUrl);
    pronunciationSessionState.S.blobUrl = '';
    const playback = pronunciationUtilsState.$('pronPlayMineBtn');
    if (playback) { playback.disabled = true; playback.title = 'Bản ghi nghe lại không có trong chế độ nhận dạng tương thích điện thoại.'; }
  } else {
    setPhase('requesting', '🎙 Đang xin quyền micro…');
    try {
      stream = await pronunciationMicrophoneState.PronMic.acquire();
    } catch (e) {
      if (navigation !== navigationVersion() || source !== sourceVersion() || attempt !== assessmentVersion) return;
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
    if (navigation !== navigationVersion() || source !== sourceVersion() || attempt !== assessmentVersion) { pronunciationMicrophoneState.PronMic.hardRelease(); return; }
    const playback = pronunciationUtilsState.$('pronPlayMineBtn');
    if (playback) playback.title = 'Nghe lại bản ghi vừa nói';
  }

  /* lượt mới — không dùng lại âm thanh / kết quả của lượt trước */
  pronunciationSessionState.S.record = null;
  pronunciationSessionState.S.busy = false;
  /* Nhắc 1 lần: nếu quyền chỉ được cấp "lần này" thì lần sau mở trang vẫn
     phải cấp lại — hướng dẫn chọn "Cho phép mỗi khi truy cập trang web". */
  if (!nativeCapture && !pronunciationSessionState.S.permHintShown) {
    pronunciationSessionState.S.permHintShown = true;
    if (!pronunciationFileTransferState.isFileProto()) {
      pronunciationMicrophoneState.PronMic.permission().then(p => {
        if (p === 'prompt') toast('Mẹo: khi Chrome hỏi micro, chọn “Cho phép mỗi khi truy cập trang web” để không phải cấp lại lần sau.', 'warn', 6000);
      });
    }
  }
  setPhase('starting', '🎙 Đang mở dịch vụ nhận dạng tiếng Trung…');
  const current = () => navigation === navigationVersion() && source === sourceVersion() && attempt === assessmentVersion;
  pronunciationRecognitionState.PronAsr.start({
    onStart() {
      if (!current() || pronunciationSessionState.S.phase !== 'starting') return;
      if (!nativeCapture) {
        pronunciationMicrophoneState.PronMic.startRecorder(stream);
        pronunciationMicrophoneState.PronMic.startMeter(stream);
      }
      pronunciationSessionState.S.startedAt = Date.now();
      setPhase('recording', '<span class="pronDot"></span>Đang nghe… hãy nói câu ở trên.');
      clearRecordingTimers();
      pronunciationSessionState.S.timer = setInterval(() => {
        const tm = pronunciationUtilsState.$('pronTimer');
        if (tm) tm.textContent = fmtSec(Date.now() - pronunciationSessionState.S.startedAt);
      }, 100);
      pronunciationSessionState.S.maxTimer = setTimeout(() => stopRecording('timeout'), pronunciationSessionState.MAX_MS);
    },
    onEnd({ error }) {
      if (!current()) return;
      if (error) { failRecognition(error); return; }
      if (pronunciationSessionState.S.phase === 'recording') stopRecording('ended');
    }
  });
}

export async function stopRecording(reason) {
  if (pronunciationSessionState.S.phase !== 'recording') return;
  const version = assessmentVersion, item = currentItem(), source = sourceVersion(), navigation = navigationVersion();
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
  // Set the guard before stop(): some implementations dispatch onend synchronously.
  setPhase('analyzing', '<span class="pronSpinner"></span>Đang phân tích phát âm…');
  pronunciationMicrophoneState.PronMic.stopMeter();
  pronunciationMicrophoneState.PronMic.stopRecorder();
  pronunciationRecognitionState.PronAsr.stop();

  // Wait for both the final transcript and the recorder's asynchronous final chunk.
  await Promise.all([
    pronunciationRecognitionState.PronAsr.wait(2500),
    pronunciationMicrophoneState.PronMic.waitRecorder?.(1000)
  ]);
  if (version !== assessmentVersion || item !== currentItem() || source !== sourceVersion() || navigation !== navigationVersion()) return;
  const transcript = (pronunciationSessionState.S.asrText || '').trim();
  pronunciationRecognitionState.PronAsr.cancelPending?.();

  if (pronunciationSessionState.S.asrErr) {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', recognitionErrorMessage(pronunciationSessionState.S.asrErr));
    return;
  }
  if (!transcript && pronunciationSessionState.S.asrInterim) {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', '🔇 Dịch vụ đã dừng trước khi xác nhận kết quả cuối. Bấm micro để nói lại; phần chữ tạm thời chưa được dùng để chấm.');
    return;
  }

  /* ★ Chỉ coi là "quá ngắn" khi KHÔNG có cả nội dung nhận dạng lẫn tín hiệu
     âm thanh. Người nói từ ngắn rất nhanh (0.3–0.4 giây) hoặc micro thu nhỏ
     vẫn phải được chấm bình thường — trước đây kiểm tra thời lượng trước nên
     các lượt này bị từ chối oan. */
  if (!pronunciationSessionState.S.nativeCapture && !transcript && dur < 450 && !spoke) {
    pronunciationMicrophoneState.PronMic.release();
    pronunciationSessionState.S.busy = false;
    setPhase('error', '⏱ Âm thanh quá ngắn. Hãy bấm micro rồi nói cả câu ngay, đừng chờ.');
    return;
  }
  if (!transcript) {
    pronunciationMicrophoneState.PronMic.release();
    setPhase('error', '⚠️ Trình duyệt không trả về chữ nhận dạng cho lượt nói này. Bấm micro để thử lại; kiểm tra quyền micro của Chrome và kết nối mạng.');
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
  const version = ++assessmentVersion;
  const items = pronunciationSessionState.S.items, source = sourceVersion(), navigation = navigationVersion();
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

  if (version !== assessmentVersion || items !== pronunciationSessionState.S.items || currentItem() !== item || source !== sourceVersion() || navigation !== navigationVersion()) return;
  if (!isStudyAllowed() || currentUser()?.id !== uid) { pronunciationSessionState.S.busy = false; return; }
  /* 2) Không có → đánh giá sơ bộ độ khớp nội dung từ văn bản nhận dạng */
  if (!result) result = pronunciationAssessmentState.PronAssess.local(item, transcript, conf);
  pronunciationSessionState.S.result = result;
  pronunciationSessionState.S.sessionTries++;
  pronunciationSessionState.S.busy = false;
  pronunciationMicrophoneState.PronMic.release();
  pronunciationStorageState.PronStore.add(item, result.score, result.score >= pronunciationSessionState.GOOD);
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('gp:activity',{detail:{kind:'voice',id:JSON.stringify([item.zh,item.py])}}));
  pronunciationSessionState.S.record = result;
  renderStats();
  renderHanzi();
  renderResult();
  setPhase('result', '');
  updateMicLabel();
  if (pronunciationSessionState.S.settings.autoNext) {
    if (pronunciationSessionState.S.silenceTimer) clearTimeout(pronunciationSessionState.S.silenceTimer);
    pronunciationSessionState.S.silenceTimer = setTimeout(() => {
      if (version === assessmentVersion && item === currentItem() && navigation === navigationVersion() && pronunciationSessionState.S.phase === 'result' && pronunciationSessionState.S.settings.autoNext && !studyOverlayOpen() && !document.getElementById('pronSettings')?.open) nextItem();
    }, 3600);
  }
}

/* ═══════════════════════════════════════════════════════════
   Điều hướng câu
   ═══════════════════════════════════════════════════════════ */
