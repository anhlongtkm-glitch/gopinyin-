// State and behavior owned by features/pronunciation/events. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { wireFileWarn } from "./file-transfer.js";

import { currentItem, prevItem, skipItem, nextItem, gotoItem, rebuildOrder } from "./lesson.js";

import { startSource } from "./library.js";

import { state as pronunciationMicrophoneState } from "./microphone.js";
import { state as pronunciationRecognitionState } from "./recognition.js";

import { stopRecording, beginRecording, setPhase, cancelAssessment } from "./recording.js";

import { renderResult, renderHanzi, renderCard, renderStats, showDetail, hideDetail } from "./render.js";

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { loadSource, syncToolbar, saveSettings, fillVoices } from "./settings.js";

import { state as pronunciationStorageState } from "./storage.js";

import { state as pronunciationTtsState, cancelPronunciationSample, schedulePronunciationSample } from "./tts.js";
import { onVoicesChanged, saveSpeechPreference } from '../../shared/audio/voice-policy.js';

import { state as pronunciationUtilsState, toast, hanChars } from "./utils.js";

import { appConfirm } from "../../shared/modal.js";

/* ═══════════════════════════════════════════════════════════
   Gắn sự kiện
   ═══════════════════════════════════════════════════════════ */
export function wire() {
  const on = (id, ev, fn) => {
    const el = pronunciationUtilsState.$(id);
    if (el) el.addEventListener(ev, fn);
  };
  wireFileWarn();
  on('pronResult', 'click', event => {
    if (!event.target.closest('[data-pron-service-retry]')) return;
    pronunciationSessionState.S.serverAssess = null;
    beginRecording();
  });
  on('pronMicBtn', 'click', () => {
    if (pronunciationSessionState.S.phase === 'recording') stopRecording('manual');else beginRecording();
  });
  on('pronSampleBtn', 'click', () => {
    const it = currentItem();
    if (!it) return;
    pronunciationTtsState.PronTts.speak(it.zh, {
      rate: pronunciationSessionState.S.settings.rate
    });
  });
  on('pronPlayMineBtn', 'click', () => pronunciationMicrophoneState.PronMic.playMine());

  /* ── Màn chọn bộ câu ── */
  const pickClick = e => {
    const b = e.target.closest('[data-psrc]');
    if (!b) return;
    e.preventDefault();
    startSource(b.dataset.psrc);
  };
  on('pronLibHsk', 'click', pickClick);
  on('pronBackBtn', 'click', () => {
    pronunciationMicrophoneState.PronMic.hardRelease();
    if (typeof legacy.showView === 'function') legacy.showView('practice');
  });
  on('pronPrevBtn', 'click', prevItem);
  on('pronRetryBtn', 'click', () => {
    cancelAssessment();
    pronunciationSessionState.S.result = null;
    pronunciationSessionState.S.record = null;
    renderResult();
    renderHanzi();
    setPhase('idle', '');
    beginRecording();
  });
  on('pronSkipBtn', 'click', skipItem);
  on('pronNextBtn', 'click', nextItem);
  on('pronRestartBtn', 'click', () => {
    pronunciationSessionState.S.index = 0;
    gotoItem(0);
  });
  on('pronResetBtn', 'click', async () => {
    const ok = await appConfirm('Xóa toàn bộ tiến độ luyện phát âm của bộ này?', {
      title: 'Xóa tiến độ',
      okText: 'Xóa',
      danger: true
    });
    if (!ok) return;
    pronunciationStorageState.PronStore.reset(pronunciationRepositoryState.PronRepo.keyOf(pronunciationSessionState.S.source));
    pronunciationSessionState.S.index = 0;
    pronunciationSessionState.S.result = null;
    pronunciationSessionState.S.record = null;
    rebuildOrder();
    renderCard();
    renderResult();
    renderStats();
    schedulePronunciationSample();
    toast('Đã xóa tiến độ luyện phát âm của bộ này.', 'ok');
  });
  on('pronSource', 'change', async e => {
    cancelAssessment();
    const v = e.target.value;
    if (v && v.startsWith('hsk:')) {
      const lvl = Number(v.slice(4).replace(/[^0-9]/g, '')) || 0;
    }
    pronunciationMicrophoneState.PronMic.release();
    pronunciationRecognitionState.PronAsr.stop();
    pronunciationSessionState.S.lastSource = v;
    if (await loadSource(v)) {
      syncToolbar();
      schedulePronunciationSample();
    }
  });
  on('pronFilter', 'change', e => {
    cancelAssessment();
    pronunciationMicrophoneState.PronMic.release();
    pronunciationRecognitionState.PronAsr.stop();
    setPhase('idle', '');
    pronunciationSessionState.S.settings.filter = e.target.value;
    saveSettings();
    const keep = currentItem() && currentItem().id;
    rebuildOrder(keep);
    pronunciationSessionState.S.result = null;
    pronunciationSessionState.S.record = null;
    renderCard();
    renderResult();
    renderStats();
    schedulePronunciationSample();
  });
  on('pronRate', 'change', e => {
    pronunciationSessionState.S.settings.rate = Number(e.target.value) || 1;
    saveSpeechPreference({rate:pronunciationSessionState.S.settings.rate});
    saveSettings();
  });
  on('pronVoice', 'change', e => {
    pronunciationSessionState.S.settings.voice = e.target.value;
    saveSpeechPreference({voice:pronunciationSessionState.S.settings.voice});
    saveSettings();
  });
  const tgl = (id, key) => on(id, 'click', () => {
    pronunciationSessionState.S.settings[key] = !pronunciationSessionState.S.settings[key];
    if (key === 'autoSample') pronunciationSessionState.S.settings.autoSampleExplicit = true;
    saveSettings();
    syncToolbar();
    if (key === 'showPy' || key === 'showHan' || key === 'showVi') renderCard();
    if (key === 'autoSample') {
      if (pronunciationSessionState.S.settings.autoSample) schedulePronunciationSample();
      else cancelPronunciationSample();
    }
  });
  tgl('pronPyToggle', 'showPy');
  tgl('pronHanToggle', 'showHan');
  tgl('pronViToggle', 'showVi');
  tgl('pronAutoSample', 'autoSample');
  tgl('pronAutoNext', 'autoNext');
  on('pronSettings', 'close', schedulePronunciationSample);

  /* bấm vào chữ Hán → chi tiết */
  const hz = pronunciationUtilsState.$('pronHanzi');
  if (hz) hz.addEventListener('click', e => {
    const b = e.target.closest('.pronChar');
    if (!b) return;
    showDetail(Number(b.dataset.ci));
  });

  /* bấm ra ngoài popover → đóng (popover có màn chắn tối nên phải đóng được) */
  document.addEventListener('click', e => {
    const d = pronunciationUtilsState.$('pronDetail');
    if (!d || d.classList.contains('hidden')) return;
    if (d.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#pronHanzi .pronChar')) return;
    hideDetail();
  });

  /* nút trong popover + trong kết quả */
  const det = pronunciationUtilsState.$('pronDetail');
  if (det) det.addEventListener('click', e => {
    const b = e.target.closest('[data-pd]');
    if (!b) return;
    const act = b.dataset.pd;
    if (act === 'close') {
      hideDetail();
      return;
    }
    if (act === 'say') {
      const ci = Number(det.dataset.ci);
      const it = currentItem();
      if (it) {
        const syl = pronunciationRepositoryState.PronRepo.syllables(it);
        pronunciationTtsState.PronTts.speak(syl[ci] || hanChars(it.zh)[ci] || '', {
          rate: 0.85
        });
      }
    }
  });
  const res = pronunciationUtilsState.$('pronResult');
  if (res) res.addEventListener('click', e => {
    const b = e.target.closest('[data-pa]');
    if (!b) return;
    const act = b.dataset.pa;
    if (act === 'retry') {
      pronunciationSessionState.S.result = null;
      pronunciationSessionState.S.record = null;
      renderResult();
      renderHanzi();
      setPhase('idle', '');
      beginRecording();
    } else if (act === 'sample') {
      const it = currentItem();
      if (it) pronunciationTtsState.PronTts.speak(it.zh, {
        rate: pronunciationSessionState.S.settings.rate
      });
    } else if (act === 'next') nextItem();
  });

  /* giọng đọc có thể nạp sau khi trang xong */
  if (pronunciationTtsState.PronTts.supported()) {
    try {
      onVoicesChanged(fillVoices);
    } catch (e) {}
  }

  /* Đóng micro khi rời trang / ẩn tab (không giữ đèn đỏ micro ngoài ý muốn) */
  window.addEventListener('pagehide', () => {
    cancelAssessment();
    try {
      pronunciationMicrophoneState.PronMic.hardRelease();
    } catch (e) {}
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cancelPronunciationSample();
    if (document.visibilityState === 'hidden' && pronunciationSessionState.S.phase === 'recording') stopRecording('manual');
    if (document.visibilityState === 'hidden' && ['requesting', 'starting'].includes(pronunciationSessionState.S.phase)) {
      cancelAssessment();
      pronunciationMicrophoneState.PronMic.hardRelease();
      setPhase('idle', '');
    }
  });

  // Lesson shortcuts are shared with typing; Escape only dismisses this popover.
  document.addEventListener('keydown', e => {
    const card = pronunciationUtilsState.$('pronCard');
    if (!card || card.classList.contains('hidden')) return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.querySelector('.modal:not([hidden]),.appModal.show,dialog[open]')) return;
    const detail = pronunciationUtilsState.$('pronDetail');
    if (e.key === 'Escape' && detail && !detail.classList.contains('hidden')) {
      e.preventDefault();
      hideDetail();
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   API công khai
   ═══════════════════════════════════════════════════════════ */
