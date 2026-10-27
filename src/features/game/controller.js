import { requireAccount, isStudyAllowed } from "../auth/service.js";
import { setMascot, renderVisibleMascots } from "../../shared/mascot.js";
// State and behavior owned by features/game/controller. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { loadGamePick } from "./engine.js";

import { spawn, saveGameStage, loadGameStage } from "./entities.js";

import { isFs, syncFsBtn } from "./events.js";

import { syncPinyinBtn, updateHud, syncGameLevelTitles } from "./input.js";

import { frame } from "./loop.js";

import { initBg, resize } from "./scenery.js";

import { state as gameSessionState, randTheme } from "./session.js";

import { resetShip } from "./ship.js";

import { shuffle, buildPool } from "./words.js";

import { toast } from "../../shared/toast.js";

export const state = {};

const gameControllerState = state;

export function togglePause() {
  if (!isStudyAllowed() || !gameSessionState.state.running) return;
  gameSessionState.state.paused = !gameSessionState.state.paused;
  const btn = gameSessionState.$('gaPauseBtn');
  if (btn) btn.textContent = gameSessionState.state.paused ? '▶' : '⏸';
  if (!gameSessionState.state.paused) gameSessionState.state.lastT = 0;
}

export async function startGame() {
  if (!await requireAccount(startGame)) return;
  if (!gameSessionState.state.pool.length) {
    toast('Chưa có từ vựng cho cấp này.', 'bad');
    return;
  }
  gameSessionState.state.suspended = false;
  gameSessionState.state.resumeReady = false;
  gameSessionState.state.running = true;
  gameSessionState.state.paused = false;
  gameSessionState.state.lastT = 0;
  gameSessionState.state.items = [];
  gameSessionState.state.particles = [];
  gameSessionState.state.bullets = [];
  gameSessionState.state.floats = [];
  gameSessionState.state.score = 0;
  gameSessionState.state.lives = 5;
  gameSessionState.state.combo = 0;
  gameSessionState.state.bestCombo = 0;
  gameSessionState.state.wordsDone = 0;
  gameSessionState.state.buffer = '';
  gameSessionState.state.locked = null;
  gameSessionState.state.skipped.clear();
  gameSessionState.state.flashRed = 0;
  gameSessionState.state.over = false;
  gameSessionState.state.stageWords = 0;
  /* ★ Giữ số chặng đã lưu (tiếp nối theo từng chặng); nền/ phong cảnh chọn ngẫu nhiên */
  gameSessionState.state.banner = null;
  gameSessionState.state.themeIdx = randTheme(-1);
  initBg();
  gameSessionState.state.pool = shuffle(buildPool(gameSessionState.state.level));
  gameSessionState.state.poolIdx = 0;
  gameSessionState.state.spawnAcc = 0;
  hideOverlay();
  resetShip();
  gameSessionState.$('gaNewBtn')?.classList.add('hidden');
  /* thả ngay 1 thẻ để vào ván là có việc làm, không phải chờ */
  spawn();
  const pb = gameSessionState.$('gaPauseBtn');
  if (pb) pb.textContent = '⏸';
  syncPinyinBtn();
  if (!gameSessionState.state.rafId) gameSessionState.state.rafId = requestAnimationFrame(frame);
  updateHud();
}

/* ★ Tiếp tục ván đang dở (sau khi thoát sang mục khác) */

/* ★ Tiếp tục ván đang dở (sau khi thoát sang mục khác) */
export async function resumeGame() {
  if (!await requireAccount(resumeGame)) return;
  if (!gameSessionState.state.suspended) {
    startGame();
    return;
  }
  gameSessionState.state.suspended = false;
  gameSessionState.state.resumeReady = false;
  gameSessionState.state.running = true;
  gameSessionState.state.paused = false;
  gameSessionState.state.lastT = 0;
  gameSessionState.state.over = false;
  hideOverlay();
  gameSessionState.$('gaNewBtn')?.classList.add('hidden');
  const pb = gameSessionState.$('gaPauseBtn');
  if (pb) pb.textContent = '⏸';
  if (!gameSessionState.state.rafId) gameSessionState.state.rafId = requestAnimationFrame(frame);
  updateHud();
  toast('▶ Tiếp tục ván đang chơi', 'ok', 1500);
}

export function showResumeOverlay() {
  const bangSo = [{
    v: '♥ ' + gameSessionState.state.lives + '/' + gameSessionState.state.maxLives,
    l: 'Mạng còn lại'
  }, {
    v: String(gameSessionState.state.score),
    l: 'Điểm'
  }, {
    v: String(gameSessionState.state.wordsDone),
    l: 'Từ đã bắn'
  }, {
    v: 'Chặng ' + gameSessionState.state.stage,
    l: 'Tiến độ'
  }];
  showOverlay('⏸️', 'Ván đang dở', 'Bạn đang chơi dang dở. Tiếp tục để giữ nguyên điểm và chặng, hay bắt đầu một ván mới?', false, bangSo);
  const st = gameSessionState.$('gaStartBtn');
  if (st) st.textContent = '▶ Tiếp tục';
  gameSessionState.$('gaNewBtn')?.classList.remove('hidden');
  gameSessionState.$('gaAdBtn')?.classList.add('hidden');
  gameSessionState.state.resumeReady = true;
}

export function showOverlay(emoji, title, msg, isOver, stats) {
  const ov = gameSessionState.$('gaOverlay');
  if (!ov) return;
  ov.classList.remove('hidden');
  setMascot('gameMascot', isOver ? 'trophy' : 'ready', { animate: !!isOver });
  renderVisibleMascots();
  gameSessionState.$('gaOverlayEmoji').textContent = emoji;
  gameSessionState.$('gaOverlayTitle').textContent = title;
  gameSessionState.$('gaOverlayMsg').innerHTML = msg;
  /* ★ Ô thống kê (điểm / tim / từ / chặng) — giãn cách đẹp thay vì chữ chảy liền */
  const box = gameSessionState.$('gaOverlayStats');
  if (box) {
    box.innerHTML = '';
    if (stats && stats.length) {
      for (const s of stats) {
        const cell = document.createElement('div');
        cell.className = 'gaStat';
        const v = document.createElement('span');
        v.className = 'gaStatVal';
        v.textContent = s.v;
        const l = document.createElement('span');
        l.className = 'gaStatLbl';
        l.textContent = s.l;
        cell.appendChild(v);
        cell.appendChild(l);
        box.appendChild(cell);
      }
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }
  const start = gameSessionState.$('gaStartBtn');
  if (start) {
    start.textContent = isOver ? '↺ Chơi lại' : '▶ Bắt đầu';
    start.classList.remove('hidden');
  }
  const ad = gameSessionState.$('gaAdBtn');
  if (ad) ad.classList.toggle('hidden', !isOver);
}

export function hideOverlay() {
  gameSessionState.$('gaOverlay')?.classList.add('hidden');
}

/* ★ Hết mạng → nhận thêm 3 mạng (đếm ngược 3s) rồi chơi tiếp */

export async function watchAd() {
  if (!await requireAccount(watchAd)) return;
  const ov = gameSessionState.$('gaOverlay');
  if (!ov) return;
  if (gameControllerState.adTimer) {
    clearInterval(gameControllerState.adTimer);
    gameControllerState.adTimer = null;
  }
  gameSessionState.$('gaStartBtn')?.classList.add('hidden');
  gameSessionState.$('gaAdBtn')?.classList.add('hidden');
  gameSessionState.$('gaOverlayEmoji').textContent = '🎁';
  gameSessionState.$('gaOverlayTitle').textContent = 'Nhận thêm mạng…';
  gameSessionState.$('gaOverlayMsg').innerHTML = 'Đang nạp thêm <b>+3 mạng</b> — còn <b id="gaAdCount">3</b> giây…';
  let left = 3;
  gameControllerState.adTimer = setInterval(() => {
    if (!isStudyAllowed()) { clearInterval(gameControllerState.adTimer); gameControllerState.adTimer = null; return; }
    left--;
    const c = gameSessionState.$('gaAdCount');
    if (c) c.textContent = String(Math.max(0, left));
    if (left <= 0) {
      clearInterval(gameControllerState.adTimer);
      gameControllerState.adTimer = null;
      gameSessionState.state.lives = Math.min(gameSessionState.state.maxLives, Math.max(0, gameSessionState.state.lives) + 3);
      gameSessionState.state.combo = 0;
      gameSessionState.state.over = false;
      hideOverlay();
      gameSessionState.state.running = true;
      gameSessionState.state.paused = false;
      gameSessionState.state.lastT = 0;
      const pb = gameSessionState.$('gaPauseBtn');
      if (pb) pb.textContent = '⏸';
      gameSessionState.state.floats.push({
        x: gameSessionState.W / 2,
        y: gameSessionState.H / 2,
        txt: '♥ +3',
        life: 1.2,
        t: 0,
        color: '#fb7185'
      });
      if (!gameSessionState.state.rafId) gameSessionState.state.rafId = requestAnimationFrame(frame);
      updateHud();
    }
  }, 1000);
}

export function leaveGame(opts) {
  /* opts.silent = true → chỉ dừng ván đang chơi, KHÔNG tự chuyển màn
     (dùng khi người dùng bấm mục khác trên thanh bên). */
  const silent = !!(opts && opts.silent);
  /* ★ Giữ lại ván đang chơi để lần sau vào tiếp tục + lưu tiến độ theo chặng */
  if (gameSessionState.state.running) gameSessionState.state.suspended = true;
  try {
    if (!gameSessionState.suppressSave) saveGameStage();
  } catch (e) {}
  if (gameSessionState.state.rafId) {
    cancelAnimationFrame(gameSessionState.state.rafId);
    gameSessionState.state.rafId = 0;
  }
  gameSessionState.state.running = false;
  gameSessionState.state.paused = false;
  if (isFs()) {
    try {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) {}
  }
  gameSessionState.$('gameCard')?.classList.add('hidden');
  gameSessionState.$('appCard')?.classList.add('hidden');
  if (silent) {
    /* người dùng tự chuyển sang mục khác → showView() lo phần hiển thị */
    gameSessionState.$('gamesCard')?.classList.remove('hidden');
    return;
  }
  /* ★ Quay về sảnh "Game từ vựng" (game là màn con của mục này) thay vì thư viện */
  if (legacy.showView) legacy.showView('games');
}

export function openGame() {
  resize();
  gameSessionState.state.showPinyin = false; // ★ mới vào game → pinyin luôn ẩn, muốn xem thì bật
  syncPinyinBtn();
  syncFsBtn();
  syncGameLevelTitles();
  /* ★ Có ván đang dở → mời tiếp tục thay vì xoá sạch */
  if (gameSessionState.state.suspended && gameSessionState.state.pool.length) {
    gameSessionState.state.running = false;
    gameSessionState.state.paused = false;
    gameSessionState.state.lastT = 0;
    showResumeOverlay();
    updateHud();
    if (!gameSessionState.state.rafId) gameSessionState.state.rafId = requestAnimationFrame(frame);
    return;
  }
  gameSessionState.state.suspended = false;
  gameSessionState.state.resumeReady = false;
  /* ★ Khôi phục chặng đã lưu (tiếp nối theo từng chặng); chủ đề nền RANDOM mỗi lần mở game */
  const saved = loadGameStage();
  if (saved && saved.stage) gameSessionState.state.stage = Math.max(1, Number(saved.stage) || 1);
  gameSessionState.state.stageWords = saved ? Math.max(0, Math.min(gameSessionState.STAGE_SIZE - 1, Number(saved.stageWords) || 0)) : 0;
  /* ★ Khôi phục cả CẤP HSK đã chọn — nhưng chỉ khi cấp đó được phép
     (giữ nguyên cấp HSK đã chọn). */
  if (saved && saved.level) {
    const lv = Number(saved.level) || 0;
    if (lv >= 1 && lv <= 6) {
      gameSessionState.state.level = lv;
    }
  }
  /* ★ Ưu tiên lựa chọn của lần chơi trước (cấp HSK · ĐỘ ĐỢ · số thẻ).
     Chạy sau bước trên để ghi đè khi save chặng còn tồn tại từ lâu. */
  loadGamePick();
  document.querySelectorAll('[data-glevel]').forEach(x => {
    const on = Number(x.dataset.glevel) === gameSessionState.state.level;
    x.classList.toggle('active', on);
    x.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  gameSessionState.state.over = false;
  gameSessionState.state.themeIdx = randTheme(-1);
  gameSessionState.state.pool = buildPool(gameSessionState.state.level);
  gameSessionState.state.poolIdx = 0;
  gameSessionState.state.score = 0;
  gameSessionState.state.lives = 5;
  gameSessionState.state.combo = 0;
  gameSessionState.state.bestCombo = 0;
  gameSessionState.state.wordsDone = 0;
  gameSessionState.state.items = [];
  gameSessionState.state.particles = [];
  gameSessionState.state.bullets = [];
  gameSessionState.state.floats = [];
  gameSessionState.state.buffer = '';
  gameSessionState.state.locked = null;
  gameSessionState.state.skipped.clear();
  gameSessionState.state.flashRed = 0;
  gameSessionState.state.banner = null;
  gameSessionState.state.running = false;
  gameSessionState.state.paused = false;
  initBg();
  resetShip();
  gameSessionState.$('gaNewBtn')?.classList.add('hidden');
  showOverlay('🎮', 'Sẵn sàng?', '<div class="gaRules">' + '<div class="gaRule"><span class="gaRuleIco">🎯</span><span>Gõ <b>toàn bộ pinyin</b> của từ để <b>bắn nổ</b>.</span></div>' + '<div class="gaRule"><span class="gaRuleIco">💡</span><span><b>Enter</b> hiện/ẩn pinyin · <b>Backspace</b> đổi mục tiêu.</span></div>' + '<div class="gaRule"><span class="gaRuleIco">🔒</span><span>Gõ sai chỉ <b>mất combo</b> — không trừ điểm, không nhảy thẻ.</span></div>' + '<div class="gaRule"><span class="gaRuleIco">❤️</span><span><b>5 mạng</b>: thẻ qua vạch <b>−1</b> · thẻ <b style="color:#fb7185">♥</b> phá nổ <b>+1</b>.</span></div>' + '<div class="gaRule"><span class="gaRuleIco">🎆</span><span><b>Chia chặng</b>: mỗi <b>' + gameSessionState.STAGE_SIZE + '</b> từ đổi cả <b>nền game</b> (nhiều phong cảnh: mưa · tuyết · vũ trụ · rừng thu · hoàng hôn · biển đêm · hoa anh đào · neon) — lưu tiến độ <b>theo chặng</b>.</span></div>' + '</div>', false);
  updateHud();
  if (!gameSessionState.state.rafId) gameSessionState.state.rafId = requestAnimationFrame(frame);
}

export function initializeGameController() {
  /* ★ Hết mạng → nhận thêm 3 mạng (đếm ngược 3s) rồi chơi tiếp */
  gameControllerState.adTimer = null;
}
