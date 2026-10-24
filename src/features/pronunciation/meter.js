// State and behavior owned by features/pronunciation/meter. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationUtilsState } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Sóng âm thanh
   ═══════════════════════════════════════════════════════════ */
export function drawMeter(level) {
  const c = pronunciationUtilsState.$('pronWave');
  if (!c || !c.getContext) return;
  const ctx = c.getContext('2d');
  const W = c.width,
    H = c.height;
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const accent = (css.getPropertyValue('--primary-2') || '#1FC8A2').trim() || '#1FC8A2';
  const dim = (css.getPropertyValue('--line-2') || 'rgba(148,163,184,.22)').trim();
  const rr = (x, y, w, h, r) => {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    } else ctx.fillRect(x, y, w, h);
  };
  /* Chưa ghi âm → chỉ một "đường nền" mảnh, không vẽ 48 cột nhỏ
     (trước đây trông như một đường kẻ đứt nằm giữa thẻ). */
  if (pronunciationSessionState.S.phase !== 'recording') {
    ctx.fillStyle = dim;
    ctx.globalAlpha = 0.5;
    rr(0, H / 2 - 1.5, W, 3, 1.5);
    ctx.globalAlpha = 1;
    return;
  }
  const bars = 48,
    gap = 3;
  const bw = (W - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    /* hình bao mềm: giữa cao hơn hai đầu */
    const mid = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
    const wob = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 160 + i * 0.7));
    let h = Math.max(2, (0.12 + level * 3.4) * (0.35 + mid) * wob * H * 0.9);
    h = Math.min(H - 2, h);
    const x = i * (bw + gap),
      y = (H - h) / 2;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, level * 4);
    rr(x, y, bw, h, Math.min(bw / 2, 3));
  }
  ctx.globalAlpha = 1;
}

/* ═══════════════════════════════════════════════════════════
   Khởi động / nạp nguồn
   ═══════════════════════════════════════════════════════════ */
