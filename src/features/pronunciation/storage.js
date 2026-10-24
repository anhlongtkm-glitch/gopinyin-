// State and behavior owned by features/pronunciation/storage. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { lsJson, lsSet } from "./utils.js";

export const state = {};

const pronunciationStorageState = state;

export function initializePronunciationStorage() {
  /* ═══════════════════════════════════════════════════════════
     PronStore — tiến độ + lịch sử
     Mỗi mục: {n: số lượt, best, last, good, at}
     Tiến độ tổng hợp KHÁC với lịch sử: nói lại 3 lần vẫn là 1 mục đã luyện.
     ═══════════════════════════════════════════════════════════ */
  pronunciationStorageState.PronStore = {
    load(key) {
      const d = lsJson(pronunciationSessionState.STORE_PREFIX + key, null);
      if (!d || typeof d !== 'object') return {
        v: 1,
        byId: {},
        index: 0,
        recent: []
      };
      return {
        v: 1,
        byId: d.byId || {},
        index: d.index || 0,
        recent: Array.isArray(d.recent) ? d.recent : []
      };
    },
    save(key) {
      if (!pronunciationSessionState.S.progress) return;
      const p = pronunciationSessionState.S.progress;
      if (p.recent.length > pronunciationSessionState.RECENT_MAX) p.recent = p.recent.slice(-pronunciationSessionState.RECENT_MAX);
      lsSet(pronunciationSessionState.STORE_PREFIX + key, JSON.stringify(p));
    },
    rec(id) {
      return pronunciationSessionState.S.progress && pronunciationSessionState.S.progress.byId[id] || null;
    },
    add(item, score, good) {
      if (!pronunciationSessionState.S.progress) return;
      const id = item.id;
      const cur = pronunciationSessionState.S.progress.byId[id] || {
        n: 0,
        best: 0,
        last: 0,
        good: false,
        at: 0
      };
      cur.n++;
      cur.last = score;
      cur.best = Math.max(cur.best || 0, score);
      cur.good = cur.best >= pronunciationSessionState.GOOD;
      cur.at = Date.now();
      pronunciationSessionState.S.progress.byId[id] = cur;
      pronunciationSessionState.S.progress.recent.push({
        at: cur.at,
        id: id,
        score: score,
        good: good
      });
      pronunciationStorageState.PronStore.save(pronunciationRepositoryState.PronRepo.keyOf(pronunciationSessionState.S.source));
    },
    reset(key) {
      try {
        localStorage.removeItem(pronunciationSessionState.STORE_PREFIX + key);
      } catch (e) {}
      pronunciationSessionState.S.progress = {
        v: 1,
        byId: {},
        index: 0,
        recent: []
      };
    }
  };
}
