// State and behavior owned by shared/confetti. Initialization is orchestrated by app/bootstrap.js.

import { state as accountStorageState } from "./account-storage.js";

export const state = {};

const confettiState = state;

export function fireConfetti(count) {
  if (document.hidden || document.documentElement.dataset.effects === 'off' || document.documentElement.dataset.effects === 'reduced') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!confettiState.confettiCanvas || !confettiState.confettiCtx) return;
  confettiState.confettiCanvas.width = innerWidth;
  confettiState.confettiCanvas.height = innerHeight;
  confettiState.confettiCanvas.classList.add('fire');
  const colors = ['#087866', '#14a890', '#f3b85a', '#88d7b8', '#dff3eb', '#a9dcca'];
  stopConfetti();
  confettiState.confettiCanvas.classList.add('fire');
  confettiState.until = performance.now() + 1500;
  for (let i = 0; i < Math.min(count || 60, innerWidth <= 860 ? 24 : 60); i++) {
    confettiState.confettiPieces.push({
      x: Math.random() * confettiState.confettiCanvas.width,
      y: -20 - Math.random() * confettiState.confettiCanvas.height * .4,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 3.5,
      vx: (Math.random() - .5) * 2.4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .28,
      life: 1
    });
  }
  if (!confettiState.confettiRAF) confettiTick();
}

export function confettiTick() {
  if (document.hidden || performance.now() >= confettiState.until) { stopConfetti(); return; }
  confettiState.confettiCtx.clearRect(0, 0, confettiState.confettiCanvas.width, confettiState.confettiCanvas.height);
  confettiState.confettiPieces.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.vy += .045;
    if (p.y > confettiState.confettiCanvas.height * .75) p.life -= .02;
    confettiState.confettiCtx.save();
    confettiState.confettiCtx.translate(p.x, p.y);
    confettiState.confettiCtx.rotate(p.rot);
    confettiState.confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiState.confettiCtx.fillStyle = p.color;
    confettiState.confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiState.confettiCtx.restore();
  });
  confettiState.confettiPieces = confettiState.confettiPieces.filter(p => p.life > 0 && p.y < confettiState.confettiCanvas.height + 40);
  if (confettiState.confettiPieces.length) confettiState.confettiRAF = requestAnimationFrame(confettiTick);else {
    confettiState.confettiRAF = null;
    confettiState.confettiCtx.clearRect(0, 0, confettiState.confettiCanvas.width, confettiState.confettiCanvas.height);
    confettiState.confettiCanvas.classList.remove('fire');
  }
}

export function stopConfetti() {
  if (confettiState.confettiRAF) cancelAnimationFrame(confettiState.confettiRAF);
  confettiState.confettiRAF = null;
  confettiState.confettiPieces = [];
  confettiState.confettiCtx?.clearRect(0,0,confettiState.confettiCanvas.width,confettiState.confettiCanvas.height);
  confettiState.confettiCanvas?.classList.remove('fire');
}

/* ═══════════════ XÁC THỰC (demo local — sẵn sàng nối API) ═══════════════ */

export function initializeConfetti() {
  /* ═══════════════ CONFETTI ═══════════════ */
  confettiState.confettiCanvas = accountStorageState.$('confettiCanvas');
  confettiState.confettiCtx = confettiState.confettiCanvas ? confettiState.confettiCanvas.getContext('2d') : null;
  confettiState.confettiPieces = [];
  confettiState.confettiRAF = null;
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopConfetti(); });
}
