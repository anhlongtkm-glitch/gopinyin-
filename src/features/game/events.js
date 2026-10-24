// State and behavior owned by features/game/events. Initialization is orchestrated by app/bootstrap.js.

import { legacy, publishLegacy } from "../../app/compatibility.js";

import { state as gameControllerState, resumeGame, startGame, watchAd, leaveGame, togglePause, openGame } from "./controller.js";

import { saveGamePick, update } from "./engine.js";

import { saveGameStage, shoot, advanceStage } from "./entities.js";

import { toggleGamePinyin, updateHud, handleKey, typeChar, backspaceTarget, nextKey } from "./input.js";

import { isGameVisible } from "./loop.js";

import { draw } from "./render.js";

import { resize } from "./scenery.js";

import { state as gameSessionState } from "./session.js";

import { state as gameWordsState, buildPool } from "./words.js";

import { toast } from "../../shared/toast.js";

export const state = {};

const gameEventsState = state;

export function wireUI() {
  gameSessionState.$('gaStartBtn')?.addEventListener('click', () => {
    if (gameControllerState.adTimer) {
      clearInterval(gameControllerState.adTimer);
      gameControllerState.adTimer = null;
    }
    saveGamePick(); /* nhớ cấp HSK · ĐỘ ĐỢ · số thẻ của ván này */
    if (gameSessionState.state.resumeReady) resumeGame();else startGame();
  });
  gameSessionState.$('gaNewBtn')?.addEventListener('click', () => {
    gameSessionState.state.suspended = false;
    startGame();
  });
  gameSessionState.$('gaAdBtn')?.addEventListener('click', watchAd);
  gameSessionState.$('gaCloseBtn')?.addEventListener('click', leaveGame);
  gameSessionState.$('gaPauseBtn')?.addEventListener('click', togglePause);
  gameSessionState.$('gaSoundBtn')?.addEventListener('click', () => {
    gameSessionState.state.sfx = !gameSessionState.state.sfx;
    gameSessionState.$('gaSoundBtn').textContent = gameSessionState.state.sfx ? '🔊' : '🔇';
    gameSessionState.$('gaSoundBtn').classList.toggle('muted', !gameSessionState.state.sfx);
  });
  gameSessionState.$('gaPyBtn')?.addEventListener('click', toggleGamePinyin);
  gameSessionState.$('gaFsBtn')?.addEventListener('click', toggleFullscreen);
  gameSessionState.$('gaSpeed')?.addEventListener('input', e => {
    gameSessionState.state.speed = Number(e.target.value) || 3;
    gameSessionState.$('gaSpeedTag').textContent = gameSessionState.SPEED_LABEL[gameSessionState.state.speed] || 'Vừa';
    for (const it of gameSessionState.state.items) it.vy = gameWordsState.baseFall();
    saveGamePick();
  });
  gameSessionState.$('gaDensity')?.addEventListener('change', e => {
    gameSessionState.state.maxConcurrent = Math.max(1, Number(e.target.value) || 3);
    saveGamePick();
  });
  gameSessionState.$('gaLevels')?.addEventListener('click', e => {
    const b = e.target.closest('[data-glevel]');
    if (!b) return;
    const lv = Number(b.dataset.glevel) || 2;
    /* ★ HSK 4–6 trong game cũng là nội dung Pro */
    if (lv >= 4 && legacy.__gpIsPro !== true) {
      if (typeof legacy.__gpOpenPro === 'function') legacy.__gpOpenPro();
      toast('Cấp HSK 4–6 trong game thuộc gói Pro — nâng cấp hoặc dùng thử 7 ngày để chơi.', 'warn', 3400);
      return;
    }
    document.querySelectorAll('[data-glevel]').forEach(x => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    gameSessionState.state.level = lv;
    gameSessionState.state.pool = buildPool(gameSessionState.state.level);
    gameSessionState.state.poolIdx = 0;
    gameSessionState.state.stageWords = 0;
    gameSessionState.state.wordsDone = 0; // đổi cấp → đếm lại từ đầu cho khớp kho từ mới
    saveGameStage();
    updateHud();
    if (gameSessionState.state.running) startGame();
  });
  /* ★ Nút quay lại ở thanh tiêu đề KHÔNG gắn ở đây — dùng chung #backLibrary
     cho cả màn game lẫn màn học, nên gán 1 handler duy nhất ở tầng ngoài
     (xem onBackTop) để tránh 2 handler chạy chồng lên nhau. */
}

/* ★ Chơi toàn màn hình */

/* ★ Chơi toàn màn hình */
export function isFs() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function syncFsBtn() {
  const b = gameSessionState.$('gaFsBtn');
  if (!b) return;
  b.textContent = isFs() ? '⤡' : '⛶';
  b.classList.toggle('on', isFs());
  b.setAttribute('aria-pressed', isFs() ? 'true' : 'false');
  b.title = isFs() ? 'Thoát toàn màn hình (Esc)' : 'Chơi toàn màn hình';
}

export function toggleFullscreen() {
  const el = gameSessionState.$('gameCard');
  if (!el) return;
  try {
    if (!isFs()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) req.call(el);else toast('Trình duyệt không hỗ trợ toàn màn hình.', 'warn');
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  } catch (e) {
    toast('Không bật được toàn màn hình.', 'warn');
  }
}

export function initializeGameEvents() {
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
    syncFsBtn();
    if (isGameVisible()) {
      resize();
      if (!gameSessionState.state.running || gameSessionState.state.paused) draw();
    }
  }));
  window.addEventListener('resize', () => {
    if (isGameVisible()) resize();
  });
  document.addEventListener('keydown', handleKey);
  gameEventsState._tt = gameSessionState.$('themeToggle');
  if (gameEventsState._tt) gameEventsState._tt.addEventListener('click', () => setTimeout(() => {
    if (isGameVisible()) draw();
  }, 30));
  wireUI();
  publishLegacy("__game", {
    openGame,
    leaveGame,
    startGame,
    togglePause,
    typeChar,
    backspaceTarget,
    nextKey,
    togglePinyin: toggleGamePinyin,
    draw,
    shoot,
    advanceStage,
    _update: update,
    _state: gameSessionState.state
  });
}
