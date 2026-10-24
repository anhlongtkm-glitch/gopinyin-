// State and behavior owned by features/game/loop. Initialization is orchestrated by app/bootstrap.js.

import { update } from "./engine.js";

import { draw } from "./render.js";

import { state as gameSessionState } from "./session.js";

export function frame(t) {
  if (!isGameVisible()) {
    gameSessionState.state.rafId = 0;
    /* rời mục game bằng bất kỳ đường nào → giữ ván lại để chơi tiếp */
    if (gameSessionState.state.running) {
      gameSessionState.state.suspended = true;
      gameSessionState.state.running = false;
      gameSessionState.state.paused = false;
    }
    return;
  }
  gameSessionState.state.rafId = requestAnimationFrame(frame);
  if (!gameSessionState.state.running) {
    draw();
    return;
  }
  if (gameSessionState.state.paused) {
    gameSessionState.state.lastT = 0;
    draw();
    return;
  }
  if (!gameSessionState.state.lastT) gameSessionState.state.lastT = t;
  let dt = (t - gameSessionState.state.lastT) / 1000;
  gameSessionState.state.lastT = t;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  draw();
}

export function isGameVisible() {
  const c = gameSessionState.$('gameCard');
  return c && !c.classList.contains('hidden');
}
