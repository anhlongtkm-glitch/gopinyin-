import { requireAccount, isStudyAllowed, currentUser } from "../auth/service.js";
// State and behavior owned by features/pronunciation/microphone. Initialization is orchestrated by app/bootstrap.js.

import { drawMeter } from "./meter.js";

import { stopRecording } from "./recording.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationUtilsState, toast } from "./utils.js";

export const state = {};

const pronunciationMicrophoneState = state;

export function initializePronunciationMicrophone() {
  /* ═══════════════════════════════════════════════════════════
     PronMic — quyền micro · thu âm · đo âm lượng · phát lại
     ═══════════════════════════════════════════════════════════ */
  pronunciationMicrophoneState.PronMic = {
    requestVersion: 0,
    cancelPending() { this.requestVersion++; },
    supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    async acquire() {
      const request = this.requestVersion;
      if (!await requireAccount()) throw new Error('Cần đăng nhập và có mạng để mở micro.');
      if (request !== this.requestVersion) throw new Error('Phiên luyện đã kết thúc.');
      /* ★ Dùng lại stream đang mở nếu còn sống.
         Người dùng phàn nàn: "mỗi lần sang một câu lại phải cấp quyền cho
         micro". Nguyên nhân là release() cũ DỪNG hết track sau MỖI lượt nói,
         nên lượt sau gọi lại getUserMedia → Chrome hỏi quyền lại (nhất là khi
         lần đầu chọn "Cho phép lần này"). Nay stream được giữ suốt phiên luyện,
         chỉ đóng khi rời màn hình. */
      if (pronunciationSessionState.S.stream && this.alive()) return pronunciationSessionState.S.stream;
      if (pronunciationSessionState.S.stream) {
        try {
          pronunciationSessionState.S.stream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        pronunciationSessionState.S.stream = null;
      }
      const uid = currentUser()?.id;
      if (!this.supported()) throw new Error('no-mediadevices');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      if (request !== this.requestVersion || !isStudyAllowed() || currentUser()?.id !== uid) { stream.getTracks().forEach(t => t.stop()); throw new Error('Phiên luyện đã kết thúc.'); }
      pronunciationSessionState.S.stream = stream;
      /* Thiết bị bị rút / quyền bị thu hồi giữa phiên → lần sau xin lại */
      try {
        stream.getAudioTracks().forEach(t => {
          t.addEventListener('ended', () => {
            if (pronunciationSessionState.S.stream === stream) pronunciationSessionState.S.stream = null;
          });
        });
      } catch (e) {}
      return stream;
    },
    /* Stream còn dùng được không (track chưa kết thúc và vẫn "live") */
    alive() {
      if (!pronunciationSessionState.S.stream) return false;
      try {
        const ts = pronunciationSessionState.S.stream.getAudioTracks();
        return ts.length > 0 && ts.every(t => t.readyState === 'live' && t.enabled);
      } catch (e) {
        return false;
      }
    },
    /* Quyền micro đã được cấp vĩnh viễn cho origin này chưa (không phải hỏi lại) */
    async permission() {
      try {
        if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
        const st = await navigator.permissions.query({
          name: 'microphone'
        });
        return st.state || 'unknown';
      } catch (e) {
        return 'unknown';
      }
    },
    /* Bắt đầu đo âm lượng (vẽ sóng + phát hiện im lặng) */
    startMeter(stream) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        pronunciationSessionState.S.actx = new Ctx();
        const src = pronunciationSessionState.S.actx.createMediaStreamSource(stream);
        const an = pronunciationSessionState.S.actx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.75;
        src.connect(an);
        pronunciationSessionState.S.analyser = an;
        pronunciationSessionState.S.freq = new Uint8Array(an.frequencyBinCount);
        pronunciationSessionState.S.hasSpeech = false;
        pronunciationSessionState.S.lastLoud = Date.now();
        const loop = () => {
          if (!pronunciationSessionState.S.analyser) return;
          pronunciationSessionState.S.analyser.getByteFrequencyData(pronunciationSessionState.S.freq);
          let sum = 0;
          const n = Math.min(64, pronunciationSessionState.S.freq.length);
          for (let i = 0; i < n; i++) sum += pronunciationSessionState.S.freq[i];
          const rms = sum / n / 255;
          drawMeter(rms);
          if (rms > pronunciationSessionState.SILENCE_RMS) {
            pronunciationSessionState.S.hasSpeech = true;
            pronunciationSessionState.S.lastLoud = Date.now();
          }
          /* tự kết thúc khi đã nói xong và im lặng đủ lâu */
          if (pronunciationSessionState.S.hasSpeech && Date.now() - pronunciationSessionState.S.lastLoud > pronunciationSessionState.SILENCE_MS) {
            stopRecording('silence');
            return;
          }
          pronunciationSessionState.S.raf = requestAnimationFrame(loop);
        };
        pronunciationSessionState.S.raf = requestAnimationFrame(loop);
      } catch (e) {/* không đo được âm lượng thì vẫn ghi âm bình thường */}
    },
    stopMeter() {
      if (pronunciationSessionState.S.raf) {
        cancelAnimationFrame(pronunciationSessionState.S.raf);
        pronunciationSessionState.S.raf = 0;
      }
      if (pronunciationSessionState.S.actx) {
        try {
          pronunciationSessionState.S.actx.close();
        } catch (e) {}
        pronunciationSessionState.S.actx = null;
      }
      pronunciationSessionState.S.analyser = null;
      drawMeter(0);
    },
    startRecorder(stream) {
      if (!window.MediaRecorder) return;
      try {
        pronunciationSessionState.S.chunks = [];
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => {
          try {
            return window.MediaRecorder.isTypeSupported(m);
          } catch (e) {
            return false;
          }
        });
        pronunciationSessionState.S.rec = new MediaRecorder(stream, mime ? {
          mimeType: mime
        } : undefined);
        pronunciationSessionState.S.rec.ondataavailable = e => {
          if (e.data && e.data.size) pronunciationSessionState.S.chunks.push(e.data);
        };
        pronunciationSessionState.S.rec.onstop = () => {
          if (!pronunciationSessionState.S.chunks.length) return;
          try {
            const blob = new Blob(pronunciationSessionState.S.chunks, {
              type: pronunciationSessionState.S.chunks[0].type || 'audio/webm'
            });
            if (pronunciationSessionState.S.blobUrl) {
              try {
                URL.revokeObjectURL(pronunciationSessionState.S.blobUrl);
              } catch (e) {}
            }
            pronunciationSessionState.S.blobUrl = URL.createObjectURL(blob);
            const pb = pronunciationUtilsState.$('pronPlayMineBtn');
            if (pb) pb.disabled = false;
          } catch (e) {}
        };
        pronunciationSessionState.S.rec.start();
      } catch (e) {
        pronunciationSessionState.S.rec = null;
      }
    },
    stopRecorder() {
      try {
        if (pronunciationSessionState.S.rec && pronunciationSessionState.S.rec.state !== 'inactive') pronunciationSessionState.S.rec.stop();
      } catch (e) {}
      pronunciationSessionState.S.rec = null;
    },
    /* ★ release() = "nhả nhẹ": chỉ tắt đo âm lượng + dừng bản ghi, GIỮ track
       micro để lượt sau không phải xin quyền lại. Muốn đóng hẳn thì hardRelease(). */
    release() {
      this.stopMeter();
      this.stopRecorder();
    },
    /* Đóng micro thật — chỉ gọi khi rời màn luyện phát âm / rời trang */
    hardRelease() {
      this.requestVersion++;
      this.stopMeter();
      this.stopRecorder();
      if (pronunciationSessionState.S.stream) {
        try {
          pronunciationSessionState.S.stream.getTracks().forEach(t => t.stop());
        } catch (e) {}
        pronunciationSessionState.S.stream = null;
      }
    },
    playMine() {
      if (!pronunciationSessionState.S.blobUrl) return;
      const a = new Audio(pronunciationSessionState.S.blobUrl);
      a.play().catch(() => toast('Không phát lại được bản ghi này.', 'warn'));
    }
  };
}
