// State and behavior owned by shared/lesson-bridge. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../app/compatibility.js";

import { state as dataCatalogState } from "../data/catalog.js";

import { answerWords } from "../features/typing/answers.js";

import { openDataset } from "../features/typing/datasets.js";

import { hanChars, isHanChar, hanSyllableList } from "../features/typing/input.js";

import { loadProgress } from "../features/typing/progress.js";

import { state as typingSessionState } from "../features/typing/session.js";

import { getChineseVoices } from "./audio/tts.js";

import { dbGetAll, dbList, dbGet } from "./storage/lesson-repository.js";

import { toast } from "./toast.js";

import { escapeHtml } from "./utils.js";

export let lessonRepository = null;

export function initializeLessonBridge() {
  /* ═══════════════════════════════════════════════════════════════
     ★ CẦU NỐI CHO MODULE "LUYỆN PHÁT ÂM" (assets/pronounce.js)
     ───────────────────────────────────────────────────────────────
     Module luyện phát âm nằm ở file riêng để không phình to file này,
     nhưng phải DÙNG CHUNG kho dữ liệu + tiện ích với phần luyện gõ.
     Thay vì để file kia chọc thẳng vào biến nội bộ (dễ vỡ khi refactor),
     ở đây mở ra một mặt tiếp xúc nhỏ, chỉ đọc.
     ═══════════════════════════════════════════════════════════════ */
  lessonRepository = {
    /* dữ liệu bài học hiện tại (cùng nguồn với luyện gõ) */
    rows: () => typingSessionState.rows,
    activeDataset: () => typingSessionState.activeDataset,
    hskData: () => typeof dataCatalogState.HSK_DATA !== 'undefined' ? dataCatalogState.HSK_DATA : {},
    dbGetAll: () => dbGetAll(),
    dbList: () => dbList(),
    dbGet: id => dbGet(id),
    /* tiến độ luyện gõ của 1 bộ — để màn Luyện phát âm biết bộ nào đã học */
    loadProgress: id => loadProgress(id),
    continueDataset: async () => {
      const sets = await dbList();
      const candidates = sets.map(ds => ({
        ds,
        progress: loadProgress(ds.id)
      })).filter(({
        progress
      }) => {
        if (!progress || !Array.isArray(progress.mainOrder) || !progress.mainOrder.length) return false;
        const index = Number(progress.mainIndex) || 0;
        const attempts = Number(progress.stats?.attempts) || 0;
        return index < progress.mainOrder.length && (index > 0 || attempts > 0);
      }).sort((a, b) => (Number(b.progress.lastStudiedAt) || Number(b.ds.updatedAt) || 0) - (Number(a.progress.lastStudiedAt) || Number(a.ds.updatedAt) || 0));
      const candidate = candidates[0];
      if (!candidate) return null;
      return {
        id: candidate.ds.id,
        name: candidate.ds.name,
        completed: Math.max(0, Number(candidate.progress.mainIndex) || 0),
        total: candidate.progress.mainOrder.length
      };
    },
    resumeDataset: async id => {
      const sets = await dbList();
      if (!sets.some(ds => ds.id === id)) throw new Error('Bộ học này không còn trong thư viện.');
      await openDataset(id);
    },
    /* tiện ích xử lý chữ Hán / pinyin — dùng lại, không viết bản sao */
    hanChars: s => hanChars(s),
    isHanChar: c => isHanChar(c),
    answerWords: q => answerWords(q),
    hanSyllableList: (q, n) => hanSyllableList(q, n),
    /* giao diện dùng chung */
    toast: (m, kind, ms) => toast(m, kind, ms),
    escapeHtml: s => escapeHtml(s),
    chineseVoices: () => {
      try {
        return getChineseVoices();
      } catch (e) {
        return [];
      }
    },
    /* trạng thái âm thanh đang dùng ở màn luyện gõ (để đồng bộ mặc định) */
    speechRate: () => typingSessionState.speechRate,
    voiceName: () => typingSessionState.selectedVoiceName
  };
  publishLegacy("__gpBridge", lessonRepository);
}
