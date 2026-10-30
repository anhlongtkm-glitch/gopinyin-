// Browser recognition lifecycle; callbacks belong to one pronunciation attempt.
import { state as pronunciationSessionState } from './session.js';
import { state as pronunciationUtilsState, esc } from './utils.js';

export const state = {};
export const ASR_START_TIMEOUT_MS = 5000;
let recognitionRequest = 0;
let active = null;

function exceptionCode(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'not-allowed';
  return 'start-failed';
}

export function initializePronunciationRecognition() {
  state.PronAsr = {
    Ctor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; },
    supported() { return !!this.Ctor(); },
    start({ onStart = () => {}, onEnd = () => {} } = {}) {
      this.cancelPending();
      const request = recognitionRequest;
      const s = pronunciationSessionState.S;
      s.asrText = ''; s.asrInterim = ''; s.asrConf = null; s.asrErr = ''; s.asrDone = null;
      // Diagnostic metadata only: never audio, transcript, or account identifiers.
      const diagnostics = s.asrDiagnostics = {
        secureContext: window.isSecureContext === true, supported: this.supported(),
        requestedAt: Date.now(), startedAt: null, errorAt: null, endedAt: null, error: ''
      };
      let resolveDone;
      s.asrDone = new Promise(resolve => { resolveDone = resolve; });
      let started = false, ended = false, stopping = false, timer;
      const current = () => request === recognitionRequest;
      const settle = () => { clearTimeout(timer); resolveDone(); };
      const finish = (error = '') => {
        if (!current() || ended) return;
        ended = true;
        diagnostics.endedAt = Date.now();
        if (error) {
          s.asrErr = error; diagnostics.error = error; diagnostics.errorAt = Date.now();
        }
        settle();
        onEnd({ error, started });
      };
      const C = this.Ctor();
      let r;
      active = { cancel: settle, recognizer: null };
      if (!C) { finish('unsupported'); return false; }
      try { r = new C(); }
      catch (error) { finish(exceptionCode(error)); return false; }
      active.recognizer = r;
      s.asr = r;
      r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onstart = () => {
        if (!current() || ended || stopping || started) return;
        started = true; clearTimeout(timer); diagnostics.startedAt = Date.now(); onStart();
      };
      r.onresult = e => {
        if (!current() || ended) return;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i], alt = result[0] || {};
          if (result.isFinal) {
            s.asrText += alt.transcript || '';
            if (typeof alt.confidence === 'number' && alt.confidence > 0) {
              s.asrConf = s.asrConf == null ? alt.confidence : Math.min(s.asrConf, alt.confidence);
            }
          } else interim += alt.transcript || '';
        }
        s.asrInterim = interim;
        const status = pronunciationUtilsState.$('pronStatus');
        if (status && s.phase === 'recording' && interim) {
          status.dataset.interim = '1';
          status.innerHTML = '<span class="pronDot"></span>Đang nghe… <b class="pronInterim">' + esc(interim) + '</b>';
        }
      };
      r.onerror = event => finish(event?.error || 'unknown');
      r.onend = () => finish(started ? '' : 'ended-before-start');
      timer = setTimeout(() => {
        finish('start-timeout');
        try { r.abort?.(); } catch {}
      }, ASR_START_TIMEOUT_MS);
      try { r.start(); }
      catch (error) { finish(exceptionCode(error)); return false; }
      if (active && current()) active.stop = () => { stopping = true; clearTimeout(timer); };
      return true;
    },
    stop() {
      active?.stop?.();
      const r = pronunciationSessionState.S.asr;
      pronunciationSessionState.S.asr = null;
      try { r?.stop(); } catch {}
    },
    cancelPending() {
      recognitionRequest++;
      const previous = active;
      active = null;
      pronunciationSessionState.S.asr = null;
      previous?.cancel();
      try {
        if (previous?.recognizer?.abort) previous.recognizer.abort();
        else previous?.recognizer?.stop();
      } catch {}
    },
    wait(ms = 2500) {
      const done = pronunciationSessionState.S.asrDone;
      if (!done) return Promise.resolve();
      return new Promise(resolve => {
        const timer = setTimeout(resolve, ms);
        done.then(() => { clearTimeout(timer); resolve(); });
      });
    }
  };
}
