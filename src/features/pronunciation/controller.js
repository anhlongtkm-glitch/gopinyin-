import { requireAccount } from "../auth/service.js";
import { restoreLibraryPosition } from "../../app/view-context.js";
// State and behavior owned by features/pronunciation/controller. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { state as pronunciationAssessmentState } from "./assessment.js";

import { wire } from "./events.js";

import { syncFileWarn } from "./file-transfer.js";

import { renderLib, startSource } from "./library.js";

import { drawMeter } from "./meter.js";

import { state as pronunciationMicrophoneState } from "./microphone.js";

import { state as pronunciationRecognitionState } from "./recognition.js";
import { schedulePronunciationSample } from './tts.js';

import { setPhase } from "./recording.js";

import { renderStats, hideDetail, hanziHtml } from "./render.js";

import { state as pronunciationSessionState } from "./session.js";

import { loadSettings, fillVoices, fillSources, loadSource, syncToolbar, cancelSourceLoad } from "./settings.js";
import { navigationVersion } from "../../app/routes.js";
import { ensureStudyControlVisible, studyOverlayOpen } from "../../shared/study/interactions.js";

export const state = {};

const pronunciationControllerState = state;

export function initializePronunciationController() {
  /* ═══════════════════════════════════════════════════════════
     API công khai
     ═══════════════════════════════════════════════════════════ */
  pronunciationControllerState.Pron = {
    /* Màn CHỌN BỘ CÂU (view "pron") */
    async openLib() {
      const navigation = navigationVersion();
      if (!pronunciationSessionState.S.ready) {
        pronunciationSessionState.S.ready = true;
        loadSettings();
        wire();
        fillVoices();
      }
      document.body.classList.remove('studyFit');
      pronunciationMicrophoneState.PronMic.hardRelease();
      syncFileWarn();
      loadSettings();
      await renderLib();
      if (navigation === navigationVersion()) restoreLibraryPosition('pronLibCard');
    },
    /* Màn LUYỆN (view "pronStudy") */
    async open() {
      const navigation = navigationVersion();
      if (!await requireAccount(() => pronunciationControllerState.Pron.open())) return;
      if (navigation !== navigationVersion()) return;
      loadSettings();
      if (!pronunciationSessionState.S.ready) {
        pronunciationSessionState.S.ready = true;
        loadSettings();
        wire();
        fillVoices();
      }
      /* Shared study styling keeps controls readable and allows short screens to scroll. */
      document.body.classList.add('studyFit');
      syncFileWarn();
      await fillSources();
      if (navigation !== navigationVersion()) return;
      if (!pronunciationSessionState.S.items.length || pronunciationSessionState.S.lastSource !== pronunciationSessionState.S.source) {
        pronunciationSessionState.S.lastSource = pronunciationSessionState.S.source;
        if (!await loadSource(pronunciationSessionState.S.source)) return;
      }
      syncToolbar();
      drawMeter(0);
      renderStats();
      schedulePronunciationSample();
      // Source loading can render the question before this view becomes visible.
      const source = pronunciationSessionState.S.source, activeBefore = document.activeElement;
      const scrollBefore = window.scrollY;
      requestAnimationFrame(() => {
        if (navigation !== navigationVersion() || source !== pronunciationSessionState.S.source || document.activeElement !== activeBefore || window.scrollY !== scrollBefore || studyOverlayOpen() || document.getElementById('pronSettings')?.open) return;
        ensureStudyControlVisible(document.getElementById('pronMicBtn'));
      });
      /* giọng đọc thường nạp trễ */
      setTimeout(fillVoices, 500);
    },
    /* Vào thẳng một bộ (dùng cho nút "Học tiếp" ở nơi khác) */
    start(srcId) {
      return startSource(srcId);
    },
    leave() {
      cancelSourceLoad();
      pronunciationMicrophoneState.PronMic.hardRelease();
      pronunciationRecognitionState.PronAsr.stop();
      if (pronunciationSessionState.S.timer) {
        clearInterval(pronunciationSessionState.S.timer);
        pronunciationSessionState.S.timer = 0;
      }
      if (pronunciationSessionState.S.maxTimer) {
        clearTimeout(pronunciationSessionState.S.maxTimer);
        pronunciationSessionState.S.maxTimer = 0;
      }
      if (pronunciationSessionState.S.silenceTimer) {
        clearTimeout(pronunciationSessionState.S.silenceTimer);
        pronunciationSessionState.S.silenceTimer = 0;
      }
      if (['recording', 'requesting', 'analyzing'].includes(pronunciationSessionState.S.phase)) setPhase('idle', '');
      hideDetail();
      document.body.classList.remove('studyFit');
      try {
        window.speechSynthesis && window.speechSynthesis.cancel();
      } catch (e) {}
    },
    /* dùng cho kiểm thử + tích hợp ngoài */
    _state: pronunciationSessionState.S,
    _assess: (item, transcript, conf) => pronunciationAssessmentState.PronAssess.local(item, transcript, conf),
    _align: (a, b) => pronunciationAssessmentState.PronAssess.align(a, b),
    _hanziHtml: (zh, st) => hanziHtml(zh, st || {}),
    _good: pronunciationSessionState.GOOD
  };
  publishLegacy("__pron", pronunciationControllerState.Pron);
}
