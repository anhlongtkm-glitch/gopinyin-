import { isStudyAllowed, currentUser } from "../auth/service.js";
import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/game/engine. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { showOverlay } from "./controller.js";

import { spawn, saveGameStage } from "./entities.js";

import { updateHud } from "./input.js";

import { state as gameSessionState } from "./session.js";

import { updateShip } from "./ship.js";

import { state as gameWordsState } from "./words.js";

export const state = {};

const gameEngineState = state;

export function saveGamePick() {
  try {
    learningStorage.setItem(gameEngineState.PICK_KEY, JSON.stringify({
      level: gameSessionState.state.level,
      speed: Number(gameSessionState.state.speed) || 3,
      maxConcurrent: Number(gameSessionState.state.maxConcurrent) || 3
    }));
  } catch (e) {}
}

export function loadGamePick() {
  let p = null;
  try {
    p = JSON.parse(learningStorage.getItem(gameEngineState.PICK_KEY) || 'null');
  } catch (e) {
    p = null;
  }
  if (!p) return false;
  const lv = Number(p.level) || 0;
  if (!(lv >= 1 && lv <= 6)) return false;
  gameSessionState.state.level = lv;
  const sp = Number(p.speed);
  if (sp >= 1 && sp <= 10) {
    gameSessionState.state.speed = sp;
    const tag = gameSessionState.$('gaSpeedTag');
    if (tag) tag.textContent = gameSessionState.SPEED_LABEL[sp] || 'Vừa';
    const sl = gameSessionState.$('gaSpeed');
    if (sl) sl.value = String(sp);
  }
  const mc = Number(p.maxConcurrent);
  if (mc >= 1 && mc <= 5) {
    gameSessionState.state.maxConcurrent = mc;
    const dd = gameSessionState.$('gaDensity');
    if (dd) dd.value = String(mc);
  }
  return true;
}

export function loseLife(it) {
  /* ★ Đã hết mạng / đã báo game over → không trừ thêm (tránh lives âm
     và tránh gameOver() bị gọi nhiều lần khi nhiều thẻ rơi cùng lúc).
     Vẫn phải gỡ thẻ vừa rơi khỏi sân, nếu không nó nằm lại mãi trong
     state.items và chặn chỗ sinh thẻ mới (placeX). */
  if (gameSessionState.state.over) {
    if (it) {
      it.scored = true;
      it.caught = true;
      gameSessionState.state.items = gameSessionState.state.items.filter(x => x !== it);
    }
    return;
  }
  gameSessionState.state.lives--;
  gameSessionState.state.combo = 0;
  gameSessionState.state.flashRed = 1;
  gameSessionState.state.floats.push({
    x: gameSessionState.W / 2,
    y: gameSessionState.H - 80,
    txt: '−1 ♥',
    life: 0.9,
    t: 0,
    color: '#fb7185'
  });
  if (it) {
    it.scored = true;
    it.caught = true;
    gameSessionState.state.items = gameSessionState.state.items.filter(x => x !== it);
  }
  if (gameSessionState.state.locked && it && gameSessionState.state.locked.id === it.id) {
    /* thẻ đang gõ bị rơi qua vạch → mất mục tiêu, xoá phần đã gõ */
    gameSessionState.state.locked = null;
    gameSessionState.state.buffer = '';
    gameSessionState.state.floats.push({
      x: gameSessionState.W / 2,
      y: gameSessionState.H - 124,
      txt: '✗ mất mục tiêu',
      life: 1.0,
      t: 0,
      color: '#fca5a5'
    });
  }
  if (gameSessionState.state.lives <= 0) {
    gameSessionState.state.lives = 0;
    gameSessionState.state.over = true;
    const uid = currentUser()?.id;
    setTimeout(() => { if (currentUser()?.id === uid) gameOver(); }, 500);
  }
}

export function gameOver() {
  if (!isStudyAllowed()) return;
  if (!gameSessionState.state.over) gameSessionState.state.over = true;
  gameSessionState.state.running = false;
  saveGameStage();
  learningStorage.setItem('gopinyin:game:lastResult', JSON.stringify({
    level: gameSessionState.state.level, score: gameSessionState.state.score,
    wordsDone: gameSessionState.state.wordsDone, bestCombo: gameSessionState.state.bestCombo,
    stage: gameSessionState.state.stage, completedAt: Date.now()
  }));
  showOverlay('💔', 'Hết mạng!', 'Bắn rất tốt! Xem quảng cáo để nhận <b>+3 mạng</b> và tiếp tục chơi ngay, hoặc bắt đầu ván mới.', true, [{
    v: String(gameSessionState.state.score),
    l: 'Điểm'
  }, {
    v: String(gameSessionState.state.wordsDone),
    l: 'Từ đã bắn'
  }, {
    v: String(gameSessionState.state.bestCombo),
    l: 'Combo cao nhất'
  }, {
    v: 'Chặng ' + gameSessionState.state.stage,
    l: 'Tiến độ'
  }]);
}

export function update(dt) {
  if (!isStudyAllowed()) return;
  updateShip(dt);
  // ★ Nền theo chủ đề chặng (rain/snow/space/autumn/dusk/sea/sakura/neon)
  for (const p of gameSessionState.state.bg) {
    if (p.type === 'rain') {
      p.y += p.vy * dt;
      if (p.y > gameSessionState.H + 20) {
        p.y = -p.len;
        p.x = Math.random() * gameSessionState.W;
      }
    } else if (p.type === 'snow') {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.y > gameSessionState.H + 10) {
        p.y = -10;
        p.x = Math.random() * gameSessionState.W;
      }
    } else if (p.type === 'star' || p.type === 'dust') {
      p.tw += dt * 3;
      if (p.type === 'dust') {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.y * 0.03) * 0.3;
        if (p.y < -12) {
          p.y = gameSessionState.H + 12;
          p.x = Math.random() * gameSessionState.W;
        }
      }
    } else {
      // leaf / petal — rơi chậm, đung đưa + xoay
      p.y += p.vy * dt;
      p.x += p.vx * dt + Math.sin(p.y * 0.02 + (p.ph || 0)) * 0.6;
      p.rot += p.vr * dt;
      if (p.y > gameSessionState.H + 10) {
        p.y = -10;
        p.x = Math.random() * gameSessionState.W;
      }
    }
  }
  gameSessionState.state.spawnAcc += dt;
  const iv = gameWordsState.spawnInterval();
  let g = 0;
  while (gameSessionState.state.spawnAcc >= iv && g++ < 6) {
    gameSessionState.state.spawnAcc -= iv;
    spawn();
  }
  const floorY = gameSessionState.H - 60;
  for (const it of gameSessionState.state.items) {
    if (it.dying) {
      it.dieT += dt;
      continue;
    }
    if (it.caught) continue;
    it.y += it.vy * dt;
    if (!it.scored && it.y + it.h / 2 >= floorY) {
      it.scored = true;
      loseLife(it);
    }
  }
  // ★ Giữ thẻ đang vỡ cho đến khi hết thời gian rồi gỡ bỏ
  gameSessionState.state.items = gameSessionState.state.items.filter(it => it.dying ? it.dieT < it.dieDur : !it.caught || it.y < gameSessionState.H + 120);
  if (gameSessionState.state.locked && !gameSessionState.state.items.some(i => i.id === gameSessionState.state.locked.id && !i.caught && !i.dying)) {
    gameSessionState.state.locked = null;
    gameSessionState.state.buffer = '';
  }
  // ★ Banner chặng: hiện ~2s rồi tự tắt (không dừng game)
  if (gameSessionState.state.banner) {
    gameSessionState.state.banner.t += dt;
    if (gameSessionState.state.banner.t >= gameSessionState.state.banner.life) gameSessionState.state.banner = null;
  }
  for (const p of gameSessionState.state.particles) {
    p.vy += 700 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  gameSessionState.state.particles = gameSessionState.state.particles.filter(p => p.life > 0);
  for (const b of gameSessionState.state.bullets) {
    b.t += dt;
    // ★ Bám theo dòng pinyin của thẻ đích khi thẻ còn rơi → không bay lệch
    if (b.target && gameSessionState.state.items.includes(b.target) && !b.target.caught) {
      b.tx = b.target.x + b.target.w / 2;
      b.ty = b.target.y + 19; // ngay dòng pinyin dưới chữ Hán
    }
    const dx = b.tx - b.x,
      dy = b.ty - b.y,
      dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      const sp = Math.max(dist * 7, 760);
      b.vx = dx / dist * sp;
      b.vy = dy / dist * sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (dist < 12 || b.t > b.life) {
      b.dead = true;
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2,
          sp = 60 + Math.random() * 100;
        gameSessionState.state.particles.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.2,
          max: 0.2,
          size: 1.4 + Math.random(),
          hue: 55
        });
      }
    }
  }
  gameSessionState.state.bullets = gameSessionState.state.bullets.filter(b => !b.dead);
  for (const f of gameSessionState.state.floats) {
    f.y -= 55 * dt;
    f.t += dt;
  }
  gameSessionState.state.floats = gameSessionState.state.floats.filter(f => f.t < f.life);
  if (gameSessionState.state.flashRed > 0) gameSessionState.state.flashRed = Math.max(0, gameSessionState.state.flashRed - dt * 2.5);
  updateHud();
}

export function initializeGameEngine() {
  /* ★ Nhớ lựa chọn của lần chơi trước: cấp HSK · tốc độ (ĐỘ ĐỢ) · số thẻ.
     Đọc/lập riêng khỏi save chặng để luôn khôi phục được, kể cả khi không
     có ván đang dở. */
  gameEngineState.PICK_KEY = 'gopinyin:game:pick';
}
