// State and behavior owned by features/pronunciation/tts. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationSessionState } from "./session.js";
import { setMascot } from "../../shared/mascot.js";
import { currentItem } from "./lesson.js";
import { navigationVersion } from "../../app/routes.js";

let utteranceVersion = 0;

export const state = {};

const pronunciationTtsState = state;

export function initializePronunciationTts() {
  /* ═══════════════════════════════════════════════════════════
     PronTts — đọc câu mẫu
     ═══════════════════════════════════════════════════════════ */
  pronunciationTtsState.PronTts = {
    supported() {
      return 'speechSynthesis' in window;
    },
    speak(text, opts) {
      if (!this.supported() || !text) return;
      const o = opts || {};
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      const u = new SpeechSynthesisUtterance(String(text));
      const version = ++utteranceVersion, item = currentItem(), navigation = navigationVersion();
      const visible = () => version === utteranceVersion && item === currentItem() && navigation === navigationVersion() && document.getElementById('pronCard')?.getClientRects().length;
      u.onstart = () => {
        if (visible() && !['recording','analyzing','requesting'].includes(pronunciationSessionState.S.phase)) setMascot('pronStudyMascot', 'listening');
      };
      u.lang = 'zh-CN';
      u.rate = Number(o.rate) || pronunciationSessionState.S.settings.rate || 1;
      const v = this.pickVoice();
      if (v) u.voice = v;
      let finished = false;
      const finish = event => {
        if (finished) return;
        finished = true;
        if (visible() && !['recording','analyzing','requesting'].includes(pronunciationSessionState.S.phase)) {
          const result = pronunciationSessionState.S.result;
          setMascot('pronStudyMascot', result ? result.score >= pronunciationSessionState.GOOD ? 'approve' : 'encourage' : 'reading');
        }
        o.onend?.(event);
      };
      u.onend = finish;
      u.onerror = finish;
      try {
        window.speechSynthesis.speak(u);
      } catch (e) {}
    },
    pickVoice() {
      if (!this.supported()) return null;
      let all = [];
      try {
        all = window.speechSynthesis.getVoices() || [];
      } catch (e) {
        return null;
      }
      const zh = all.filter(v => /^zh/i.test(v.lang || '') || /Chinese|Mandarin|Xiaoxiao|Yaoyao|Huihui|Yunxi|Yunjian|Kangkang/i.test(v.name || ''));
      if (!zh.length) return null;
      if (pronunciationSessionState.S.settings.voice) {
        const hit = zh.find(v => v.name === pronunciationSessionState.S.settings.voice);
        if (hit) return hit;
      }
      return zh.find(v => /CN|Hans|zh-CN/i.test((v.lang || '') + ' ' + (v.name || ''))) || zh[0];
    },
    voices() {
      if (!this.supported()) return [];
      let all = [];
      try {
        all = window.speechSynthesis.getVoices() || [];
      } catch (e) {
        return [];
      }
      return all.filter(v => /^zh/i.test(v.lang || '') || /Chinese|Mandarin|Xiaoxiao|Yaoyao|Huihui|Yunxi|Yunjian|Kangkang/i.test(v.name || ''));
    }
  };
}
