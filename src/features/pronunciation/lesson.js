// State and behavior owned by features/pronunciation/lesson. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationMicrophoneState } from "./microphone.js";

import { setPhase, cancelAssessment } from "./recording.js";
import { navigationVersion } from "../../app/routes.js";

import { hideDetail, renderCard, renderResult, renderStats, renderComplete } from "./render.js";

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationStorageState } from "./storage.js";

import { schedulePronunciationSample } from "./tts.js";

import { clamp, toast } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Điều hướng câu
   ═══════════════════════════════════════════════════════════ */
export function currentItem() {
  return pronunciationSessionState.S.items[pronunciationSessionState.S.order[pronunciationSessionState.S.index]] || null;
}

export function rebuildOrder(keepId) {
  const f = pronunciationSessionState.S.settings.filter;
  const all = pronunciationSessionState.S.items.map((it, i) => i);
  const rec = i => pronunciationStorageState.PronStore.rec(pronunciationSessionState.S.items[i].id);
  let ord = all;
  if (f === 'new') ord = all.filter(i => !rec(i));else if (f === 'redo') ord = all.filter(i => {
    const r = rec(i);
    return r && r.best < pronunciationSessionState.GOOD;
  });else if (f === 'done') ord = all.filter(i => {
    const r = rec(i);
    return r && r.best >= pronunciationSessionState.GOOD;
  });
  pronunciationSessionState.S.order = ord.length ? ord : all;
  let idx = 0;
  if (keepId) {
    const k = pronunciationSessionState.S.order.findIndex(i => pronunciationSessionState.S.items[i].id === keepId);
    if (k >= 0) idx = k;
  }
  pronunciationSessionState.S.index = clamp(idx, 0, Math.max(0, pronunciationSessionState.S.order.length - 1));
}

export function gotoItem(pos) {
  if (!pronunciationSessionState.S.order.length) return;
  const p = clamp(pos, 0, pronunciationSessionState.S.order.length - 1);
  if (p === pronunciationSessionState.S.index && pronunciationSessionState.S.record) return;
  cancelAssessment();
  pronunciationSessionState.S.index = p;
  pronunciationSessionState.S.result = null;
  pronunciationSessionState.S.record = null;
  hideDetail();
  pronunciationMicrophoneState.PronMic.release();
  setPhase('idle', '');
  renderCard();
  renderResult();
  renderStats();
  saveIndex();
  schedulePronunciationSample();
}

export function nextItem() {
  if (!pronunciationSessionState.S.order.length) return;
  if (pronunciationSessionState.S.index >= pronunciationSessionState.S.order.length - 1) {
    cancelAssessment();
    pronunciationSessionState.S.index = pronunciationSessionState.S.order.length; // vượt cuối → hiện màn hoàn thành
    renderComplete();
    return;
  }
  gotoItem(pronunciationSessionState.S.index + 1);
}

export function prevItem() {
  if (pronunciationSessionState.S.index > 0) gotoItem(pronunciationSessionState.S.index - 1);
}

export function skipItem() {
  /* Bỏ qua KHÔNG tính là đã luyện thành công, nhưng vẫn ghi nhận đã xem */
  const it = currentItem();
  if (it) {
    const r = pronunciationStorageState.PronStore.rec(it.id);
    if (!r) {
      pronunciationSessionState.S.progress.byId[it.id] = {
        n: 0,
        best: 0,
        last: 0,
        good: false,
        at: Date.now(),
        skipped: true
      };
      pronunciationStorageState.PronStore.save(pronunciationRepositoryState.PronRepo.keyOf(pronunciationSessionState.S.source));
    }
  }
  toast('⏭ Đã bỏ qua — câu này không được tính là đã luyện tốt.', 'warn', 2400);
  nextItem();
  renderStats();
}

export function saveIndex() {
  if (!pronunciationSessionState.S.progress) return;
  pronunciationSessionState.S.progress.index = pronunciationSessionState.S.index;
  pronunciationStorageState.PronStore.save(pronunciationRepositoryState.PronRepo.keyOf(pronunciationSessionState.S.source));
}

/* ═══════════════════════════════════════════════════════════
   Vẽ — thống kê
   ═══════════════════════════════════════════════════════════ */
