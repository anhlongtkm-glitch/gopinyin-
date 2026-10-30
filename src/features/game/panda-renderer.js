// Presentation only: animation never changes scoring or the deterministic word schedule.
const FONT = 'Inter,system-ui,sans-serif';
const HAN_FONT = '"Noto Sans SC","Microsoft YaHei",sans-serif';
const INK = '#080F1B', SURFACE = '#111C2A', ENERGY = '#69E5C2';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function rounded(ctx, x, y, w, h, r = 14) {
  w = Math.max(0, w); h = Math.max(0, h);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
// Shared by the DOM sprite and Canvas muzzle. Sprite nose is at (50%, 12%).
export function shipGeometry(width, height, angle = 0) {
  const size = clamp(height * .13, 42, 108), sh = size * 444 / 512;
  const center = { x:width / 2, y:height * .945 - sh / 2 };
  const reach = sh * .38;
  return { size, center, muzzle:{ x:center.x + Math.sin(angle) * reach, y:center.y - Math.cos(angle) * reach } };
}
export function aimAngle(center, target) { return Math.atan2(target.x - center.x, center.y - target.y); }
export function cardEdge(origin, center, width, height) {
  const dx = origin.x - center.x, dy = origin.y - center.y;
  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2), 1);
  return { x:center.x + dx * scale, y:center.y + dy * scale };
}
export function createPandaRenderer(canvas, player) {
  const ctx = canvas.getContext('2d');
  let W = 900, H = 600, angle = 0, reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const bullets = [], particles = [], labels = [], rings = [];
  const stars = Array.from({ length:24 }, (_, i) => ({ x:((i * 137.508) % 997) / 997, y:((i * 83.71) % 991) / 991, r:.4 + (i % 3) * .25 }));
  function resize() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, bounds.width); H = Math.max(1, bounds.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.style.setProperty('--pd-ship-size', shipGeometry(W, H).size + 'px');
    reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  }
  function cardSize() {
    return { w:Math.min(clamp(W * .20, 124, 210), W * .46), h:clamp(H * .21, 80, 118) };
  }
  function point(item) {
    const { w,h } = cardSize(), top = h / 2 + 22;
    const bottom = Math.max(top, H - Math.max(100, H * .24) - h / 2);
    return { x:clamp(item.x * W, w / 2 + 6, W - w / 2 - 6), y:top + item.y * (bottom - top) };
  }
  function paintShip() {
    player.style.setProperty('--pd-ship-angle', (angle * 180 / Math.PI).toFixed(2) + 'deg');
  }
  function receive(events) {
    for (const event of events) {
      const target = Number.isFinite(event.x) ? point(event) : { x:W / 2, y:H / 2 };
      if (event.type === 'shot') {
        // Queue only the visual launch until the 150ms turn has reached the target.
        bullets.push({ nx:event.x, ny:event.y, from:null, age:0, duration:reduced ? .01 : .28, targetId:event.itemId });
      }
      if (event.type === 'complete') {
        labels.push({ ...target, text:'+' + event.points, age:0, color:event.kind === 'gold' ? '#F4C96B' : ENERGY });
        if (!reduced) for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          particles.push({ ...target, vx:Math.cos(a) * 55, vy:Math.sin(a) * 45, age:0, color:ENERGY });
        }
      }
      if (event.type === 'miss') labels.push({ x:W / 2, y:H - 22, text:'−1 lá chắn', color:'#FF9AA9', age:0 });
    }
    if (bullets.length > 24) bullets.splice(0, bullets.length - 24);
    if (particles.length > 64) particles.splice(0, particles.length - 64);
    if (labels.length > 8) labels.splice(0, labels.length - 8);
  }
  function background(game) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#BBDCE6';
    for (const s of stars) {
      ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#182A3B'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(W * 1.13, H * 1.24, W * .32, H * .62, -.4, 0, Math.PI * 2); ctx.stroke();
    if (game.focusLeft > 0) { ctx.strokeStyle = '#69E5C255'; rounded(ctx, 2, 2, W - 4, H - 4); ctx.stroke(); }
  }
  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length && ctx.measureText(result + '…').width > maxWidth) result = result.slice(0, -1);
    return result + '…';
  }
  function card(item, game) {
    const at = point(item), { w,h } = cardSize(), x = at.x - w / 2, y = at.y - h / 2;
    const selected = game.locked?.id === item.id, golden = item.kind === 'gold', mission = item.kind === 'mission';
    // Keep model's review dwell time intact, but visually dissolve the completed card in 250ms.
    if (item.dying && item.dieT >= .25) return;
    ctx.save();
    if (item.dying) ctx.globalAlpha = Math.max(0, 1 - item.dieT / .25);
    rounded(ctx, x, y, w, h); ctx.fillStyle = SURFACE; ctx.fill();
    ctx.strokeStyle = selected ? ENERGY : golden ? '#D5B467' : mission ? '#AAADE7' : '#344356';
    ctx.lineWidth = selected ? 1.7 : 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hanSize = h < 105 ? 25 : W < 550 ? 29 : 36;
    ctx.font = `600 ${hanSize}px ${HAN_FONT}`; ctx.fillStyle = '#F0FBF5';
    ctx.fillText(item.src.word, at.x, y + h * .29, w - 24);
    ctx.font = `500 ${W < 550 ? 12 : 14}px ${FONT}`; ctx.fillStyle = '#D0DAE5';
    ctx.fillText(fitText(item.src.vi, w - 22), at.x, y + h * .54);
    const show = game.showPinyin || item.dying;
    const py = show ? item.src.py : item.typed;
    if (py) {
      ctx.font = `500 ${W < 550 ? 13 : 15}px ${FONT}`; ctx.fillStyle = show ? '#9CB0C6' : ENERGY;
      ctx.fillText(fitText(py, w - 24), at.x, y + h * .75);
    }
    if (golden || mission) {
      const title = golden ? '✦ Thưởng' : 'Nhiệm vụ ' + item.missionIndex;
      ctx.font = `600 11px ${FONT}`; const bw = ctx.measureText(title).width + 16;
      rounded(ctx, x + 10, y - 12, bw, 21, 6); ctx.fillStyle = INK; ctx.fill();
      ctx.fillStyle = golden ? '#F4C96B' : '#B8BCF3'; ctx.fillText(title, x + 10 + bw / 2, y - 2);
    }
    if (selected && !item.dying) {
      const progress = item.typed.length / item.src.pyPlain.length;
      const barWidth = w * .64;
      ctx.fillStyle = '#2B3C4F'; rounded(ctx, at.x - barWidth / 2, y + h - 13, barWidth, 3, 1.5); ctx.fill();
      if (progress) { ctx.fillStyle = ENERGY; rounded(ctx, at.x - barWidth / 2, y + h - 13, barWidth * progress, 3, 1.5); ctx.fill(); }
    }
    ctx.restore();
  }
  function draw(game, now, dt = 0) {
    background(game);
    const pending = bullets.find(b => !b.from);
    const pendingTarget = pending && game.items.find(item => item.id === pending.targetId);
    const aim = pending ? point(pendingTarget || { x:pending.nx, y:pending.ny }) : game.locked ? point(game.locked) : null;
    const center = shipGeometry(W, H).center;
    const goal = aim ? aimAngle(center, aim) : 0;
    const step = Math.PI * Math.max(0, dt) / .15;
    angle = reduced ? goal : angle + clamp(goal - angle, -step, step);
    paintShip();
    for (const item of game.items) card(item, game);
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.from) {
        if (b !== pending || Math.abs(goal - angle) > .03) continue;
        // Snap the last fraction at launch so the muzzle, nose and flight path agree.
        angle = goal; paintShip();
        b.from = shipGeometry(W, H, angle).muzzle;
        b.from = { x:b.from.x / W, y:b.from.y / H };
      }
      b.age += dt;
      const item = game.items.find(item => item.id === b.targetId);
      const target = item ? point(item) : point({ x:b.nx, y:b.ny });
      const from = { x:b.from.x * W, y:b.from.y * H }, { w,h } = cardSize();
      const to = cardEdge(from, target, w, h);
      if (b.age >= b.duration) { rings.push({ ...to, age:0 }); bullets.splice(i, 1); continue; }
      const p = b.age / b.duration, x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p;
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      ctx.strokeStyle = '#69E5C277'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (to.x - from.x) / len * 17, y - (to.y - from.y) / len * 17); ctx.stroke();
      ctx.shadowColor = ENERGY; ctx.shadowBlur = reduced ? 0 : 8;
      ctx.fillStyle = '#EEFFF9'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.age += dt;
      if (r.age > .2) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - r.age / .2; ctx.strokeStyle = ENERGY; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, reduced ? 5 : 4 + r.age * 35, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt;
      if (p.age > .35) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - p.age / .35; ctx.fillStyle = p.color; ctx.fillRect(p.x + p.vx * p.age, p.y + p.vy * p.age, 2, 2);
    }
    for (let i = labels.length - 1; i >= 0; i--) {
      const f = labels[i]; f.age += dt;
      if (f.age > .8) { labels.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - f.age / .8; ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT}`; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - (reduced ? 0 : f.age * 20));
    }
    ctx.globalAlpha = 1;
  }
  function clear() { bullets.length = 0; particles.length = 0; labels.length = 0; rings.length = 0; angle = 0; paintShip(); }
  return { resize, draw, receive, clear };
}
