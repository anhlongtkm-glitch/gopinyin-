// State and behavior owned by features/game/ship. Initialization is orchestrated by app/bootstrap.js.

import { state as gameSessionState } from "./session.js";

import { sfxShot } from "../../shared/audio/typing-sfx.js";

export const state = {};

const gameShipState = state;

// từ tâm tới mũi nhọn
export function shipCenter() {
  return {
    x: gameSessionState.W / 2,
    y: gameSessionState.H - gameShipState.SHIP_CY_OFF
  };
}

export function shipNose() {
  const c = shipCenter(),
    a = gameSessionState.state.shipAngle * Math.PI / 180;
  return {
    x: c.x + Math.sin(a) * gameShipState.SHIP_NOSE,
    y: c.y - Math.cos(a) * gameShipState.SHIP_NOSE
  };
}

export function updateShip(dt) {
  let target = 0;
  if (gameSessionState.state.locked && !gameSessionState.state.locked.caught) {
    const c = shipCenter();
    const dx = gameSessionState.state.locked.x + gameSessionState.state.locked.w / 2 - c.x;
    const dy = gameSessionState.state.locked.y - c.y;
    target = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = chĩa thẳng lên
  }
  const diff = (target - gameSessionState.state.shipAngle + 540) % 360 - 180; // đi đường ngắn nhất
  gameSessionState.state.shipAngle += diff * Math.min(1, dt * 11);
  if (gameSessionState.shipSvg) gameSessionState.shipSvg.style.transform = 'rotate(' + gameSessionState.state.shipAngle.toFixed(2) + 'deg)';
}

export function resetShip() {
  gameSessionState.state.shipAngle = 0;
  if (gameSessionState.shipSvg) gameSessionState.shipSvg.style.transform = 'rotate(0deg)';
}

/* Âm thanh game — tôn trọng nút 🔇 */

/* Âm thanh game — tôn trọng nút 🔇 */
export function gameSfx(power) {
  if (!gameSessionState.state.sfx) return;
  try {
    sfxShot(power);
  } catch (e) {}
}

export function spawnBullet(ch, target) {
  const n = shipNose();
  gameSfx(0.85); /* ★ mỗi ký tự gõ đúng = 1 tiếng "pew" */
  gameSessionState.state.bullets.push({
    ch,
    target,
    x: n.x,
    y: n.y,
    vx: 0,
    vy: -560,
    tx: target.x + target.w / 2,
    ty: target.y + 19,
    life: 1.0,
    t: 0
  });
  /* tia lửa ở đầu nòng */
  for (let i = 0; i < 3; i++) {
    const a = gameSessionState.state.shipAngle * Math.PI / 180 + (Math.random() - .5) * 0.9;
    gameSessionState.state.particles.push({
      x: n.x,
      y: n.y,
      vx: Math.sin(a) * (60 + Math.random() * 90),
      vy: -Math.cos(a) * (60 + Math.random() * 90),
      life: .18,
      max: .18,
      size: 1.4 + Math.random() * 1.6,
      hue: 200 + Math.random() * 30
    });
  }
}

export function penalty() {
  /* ★ Gõ sai KHÔNG trừ điểm nữa — chỉ mất combo */
  gameSessionState.state.combo = 0;
  gameSessionState.state.flashRed = 1;
  gameSessionState.state.floats.push({
    x: gameSessionState.W / 2,
    y: gameSessionState.H - 100,
    txt: '✗ sai',
    life: 0.6,
    t: 0,
    color: '#fb7185'
  });
  gameSfx(0.4);
}

export function initializeGameShip() {
  /* ═══ TÀU: xoay đầu nhọn về phía thẻ đang gõ ═══ */
  gameShipState.SHIP_CY_OFF = 69;
  // tâm tàu cách đáy sân chơi
  gameShipState.SHIP_NOSE = 23;
}
