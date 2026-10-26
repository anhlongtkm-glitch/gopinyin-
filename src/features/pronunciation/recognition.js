// State and behavior owned by features/pronunciation/recognition. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationUtilsState, esc } from "./utils.js";

export const state = {};

const pronunciationRecognitionState = state;
let recognitionRequest = 0;

export function initializePronunciationRecognition() {
  /* ═══════════════════════════════════════════════════════════
     PronAsr — nhận dạng giọng nói (chỉ để lấy NỘI DUNG đã nói)
     ═══════════════════════════════════════════════════════════ */
  pronunciationRecognitionState.PronAsr = {
    Ctor() {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    },
    supported() {
      return !!this.Ctor();
    },
    start() {
      const request = ++recognitionRequest;
      pronunciationSessionState.S.asrText = '';
      pronunciationSessionState.S.asrConf = null;
      pronunciationSessionState.S.asrErr = '';
      pronunciationSessionState.S.asrDone = null;
      const C = this.Ctor();
      if (!C) return false;
      let r;
      try {
        r = new C();
      } catch (e) {
        return false;
      }
      r.lang = 'zh-CN';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      pronunciationSessionState.S.asrDone = new Promise(resolve => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        r.onresult = e => {
          if (request !== recognitionRequest) return;
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const alt = res[0] || {};
            if (res.isFinal) {
              pronunciationSessionState.S.asrText += alt.transcript || '';
              if (typeof alt.confidence === 'number' && alt.confidence > 0) {
                pronunciationSessionState.S.asrConf = pronunciationSessionState.S.asrConf == null ? alt.confidence : Math.min(pronunciationSessionState.S.asrConf, alt.confidence);
              }
            } else {
              interim += alt.transcript || '';
            }
          }
          pronunciationSessionState.S.asrInterim = interim;
          const st = pronunciationUtilsState.$('pronStatus');
          if (st && pronunciationSessionState.S.phase === 'recording' && interim) {
            st.dataset.interim = '1';
            st.innerHTML = '<span class="pronDot"></span>Đang nghe… <b class="pronInterim">' + esc(interim) + '</b>';
          }
        };
        r.onerror = e => {
          if (request === recognitionRequest) pronunciationSessionState.S.asrErr = e && e.error || 'unknown';
          if (pronunciationSessionState.S.asrErr === 'no-speech') {/* để onend xử lý */}
          done();
        };
        r.onend = () => {
          done();
        };
      });
      try {
        r.start();
      } catch (e) {
        return false;
      }
      pronunciationSessionState.S.asr = r;
      return true;
    },
    stop() {
      if (!pronunciationSessionState.S.asr) return;
      try {
        pronunciationSessionState.S.asr.stop();
      } catch (e) {}
      pronunciationSessionState.S.asr = null;
    },
    cancelPending() { recognitionRequest++; this.stop(); },
    wait(ms) {
      if (!pronunciationSessionState.S.asrDone) return Promise.resolve();
      return Promise.race([pronunciationSessionState.S.asrDone, new Promise(r => setTimeout(r, ms || 2500))]);
    }
  };
}
