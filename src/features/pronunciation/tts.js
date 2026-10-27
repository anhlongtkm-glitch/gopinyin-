// Sample playback belongs to the current question and stops before microphone use.
import { state as pronunciationSessionState } from './session.js';
import { setMascot } from '../../shared/mascot.js';
import { currentItem } from './lesson.js';
import { navigationVersion } from '../../app/routes.js';
import { studyOverlayOpen } from '../../shared/study/interactions.js';
import { chineseVoices, chooseChineseVoice, speechPreferences, onVoicesChanged } from '../../shared/audio/voice-policy.js';

let utteranceVersion = 0, sampleTimer = 0, removeVoiceListener;
export const state = {};

export function cancelPronunciationSample() {
  utteranceVersion++;
  clearTimeout(sampleTimer);
  sampleTimer = 0;
  removeVoiceListener?.();
  removeVoiceListener = null;
  try { window.speechSynthesis?.cancel(); } catch {}
}

function sampleAllowed(automatic) {
  if (document.visibilityState === 'hidden' || !document.getElementById('pronCard')?.getClientRects().length) return false;
  if (['requesting','recording','analyzing'].includes(pronunciationSessionState.S.phase)) return false;
  return !automatic || (pronunciationSessionState.S.settings.autoSample && !studyOverlayOpen() && !document.getElementById('pronSettings')?.open);
}

export function schedulePronunciationSample() {
  cancelPronunciationSample();
  if (!pronunciationSessionState.S.settings.autoSample) return;
  const version = utteranceVersion, item = currentItem(), navigation = navigationVersion(), items = pronunciationSessionState.S.items;
  if (!item?.zh) return;
  sampleTimer = setTimeout(() => {
    sampleTimer = 0;
    if (version === utteranceVersion && item === currentItem() && items === pronunciationSessionState.S.items && navigation === navigationVersion() && sampleAllowed(true)) state.PronTts.speak(item.zh, {automatic:true});
  }, 220);
}

export function initializePronunciationTts() {
  state.PronTts = {
    supported() { return 'speechSynthesis' in window; },
    speak(text, opts = {}) {
      if (!this.supported() || !text || !sampleAllowed(opts.automatic)) return;
      cancelPronunciationSample();
      const version = utteranceVersion, item = currentItem(), navigation = navigationVersion(), items = pronunciationSessionState.S.items;
      const current = () => version === utteranceVersion && item === currentItem() && items === pronunciationSessionState.S.items && navigation === navigationVersion() && sampleAllowed(opts.automatic);
      const send = () => {
        clearTimeout(sampleTimer); sampleTimer = 0;
        removeVoiceListener?.(); removeVoiceListener = null;
        if (!current()) return;
        const audio = speechPreferences(pronunciationSessionState.S.settings);
        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.lang = 'zh-CN';
        utterance.rate = Number(opts.rate) || audio.rate;
        const voice = chooseChineseVoice(chineseVoices(), audio.voice);
        if (voice) utterance.voice = voice;
        utterance.onstart = () => { if (current()) setMascot('pronStudyMascot', 'listening'); };
        let finished = false;
        const finish = event => {
          if (finished) return;
          finished = true;
          if (current()) {
            const result = pronunciationSessionState.S.result;
            setMascot('pronStudyMascot', result ? result.score >= pronunciationSessionState.GOOD ? 'approve' : 'encourage' : 'reading');
            opts.onend?.(event);
          }
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        try { window.speechSynthesis.speak(utterance); } catch {}
      };
      // Chrome may expose its Google voices only after the first voiceschanged.
      if (chineseVoices().length) send();
      else {
        removeVoiceListener = onVoicesChanged(() => { if (chineseVoices().length) send(); });
        sampleTimer = setTimeout(send, 600);
      }
    },
    pickVoice() { return chooseChineseVoice(chineseVoices(), speechPreferences(pronunciationSessionState.S.settings).voice); },
    voices: chineseVoices
  };
}
