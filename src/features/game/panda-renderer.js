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
export function shipGeometry(width, height, angle = 0, recoil = 0) {
  const size = clamp(height * .13, 42, 108), sh = size * 444 / 512;
  const center = { x:width / 2 - Math.sin(angle) * recoil, y:height * .945 - sh / 2 + Math.cos(angle) * recoil };
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
  let W = 900, H = 600, angle = 0, recoil = 0, reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const bullets = [], particles = [], labels = [], rings = [], flashes = [], hits = new Map();
  function burst(at, color, reward = false) {
    rings.push({ ...at, age:0, color, reward });
    if (reduced) return;
    const count = reward ? 24 : 16;
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count + Math.random() * .18;
      const speed = (reward ? 110 : 70) + Math.random() * 80;
      particles.push({ ...at, vx:Math.cos(a) * speed, vy:Math.sin(a) * speed, age:0, color, size:1.5 + Math.random() * 2, life:.35 + Math.random() * .25 });
    }
    if (particles.length > 144) particles.splice(0, particles.length - 144);
  }
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
    if (reduced) recoil = 0;
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
    player.style.setProperty('--pd-ship-recoil', recoil.toFixed(3));
    player.style.setProperty('--pd-recoil-x', (-Math.sin(angle) * recoil).toFixed(3) + 'px');
    player.style.setProperty('--pd-recoil-y', (Math.cos(angle) * recoil).toFixed(3) + 'px');
  }
  function receive(events) {
    for (const event of events) {
      const target = Number.isFinite(event.x) ? point(event) : { x:W / 2, y:H / 2 };
      if (event.type === 'shot') {
        recoil = reduced ? 0 : Math.min(10, recoil + 7);
        // Queue only the visual launch until the 150ms turn has reached the target.
        bullets.push({ nx:event.x, ny:event.y, from:null, age:0, duration:reduced ? .01 : .18, targetId:event.itemId });
        hits.set(event.itemId, .12);
      }
      if (event.type === 'complete') {
        const reward = ['gold','phrase'].includes(event.kind), color = reward ? '#F4C96B' : ENERGY;
        labels.push({
          ...target, text:event.word, age:0, word:true, color:ENERGY,
          card:{ word:event.word, vi:event.vi, py:event.py, kind:event.kind, missionIndex:event.missionIndex }
        });
        labels.push({ ...target, text:(event.kind === 'phrase' ? 'CÂU THƯỞNG ' : '') + '+' + event.points, age:0, color, reward });
        burst(target, color, reward);
      }
      if (event.type === 'miss') labels.push({ x:W / 2, y:H - 22, text:'Xem lại ở cuối level', color:'#B6C9D8', age:0 });
    }
    if (bullets.length > 24) bullets.splice(0, bullets.length - 24);
    if (rings.length > 24) rings.splice(0, rings.length - 24);
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
    const selected = game.locked?.id === item.id, golden = item.kind === 'gold' || item.kind === 'phrase', mission = item.kind === 'mission', phrase = item.kind === 'phrase';
    // Keep model's review dwell time intact, but visually dissolve the completed card in 250ms.
    if (item.dying && item.dieT >= .25) return;
    ctx.save();
    if (item.dying) ctx.globalAlpha = Math.max(0, 1 - item.dieT / .25);
    rounded(ctx, x, y, w, h); ctx.fillStyle = SURFACE; ctx.fill();
    ctx.strokeStyle = selected ? ENERGY : golden ? '#D5B467' : mission ? '#AAADE7' : '#344356';
    ctx.lineWidth = selected ? 1.7 : 1; ctx.stroke();
    if (hits.has(item.id)) {
      ctx.globalAlpha = reduced ? .12 : Math.min(.3, hits.get(item.id) * 2.5);
      ctx.fillStyle = ENERGY; rounded(ctx, x, y, w, h); ctx.fill();
      ctx.globalAlpha = item.dying ? Math.max(0, 1 - item.dieT / .25) : 1;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hanSize = phrase ? Math.min(22, (w - 24) / Math.ceil(item.src.word.length / 2)) : h < 105 ? 25 : W < 550 ? 29 : 36;
    ctx.font = `600 ${hanSize}px ${HAN_FONT}`; ctx.fillStyle = '#F0FBF5';
    if (phrase) {
      const middle = Math.ceil(item.src.word.length / 2);
      ctx.fillText(item.src.word.slice(0, middle), at.x, y + h * .22, w - 24);
      ctx.fillText(item.src.word.slice(middle), at.x, y + h * .44, w - 24);
    } else ctx.fillText(item.src.word, at.x, y + h * .29, w - 24);
    ctx.font = `500 ${W < 550 ? 12 : 14}px ${FONT}`; ctx.fillStyle = '#D0DAE5';
    ctx.fillText(fitText(item.src.vi, w - 22), at.x, y + h * (phrase ? .64 : .54));
    const show = game.showPinyin || item.dying;
    const py = show ? item.src.py : item.typed;
    if (py) {
      ctx.font = `500 ${W < 550 ? 13 : 15}px ${FONT}`; ctx.fillStyle = show ? '#9CB0C6' : ENERGY;
      ctx.fillText(fitText(py, w - 24), at.x, y + h * (phrase ? .82 : .75));
    }
    if (golden || mission) {
      const title = phrase ? 'Câu thưởng +400' : golden ? '✦ Thưởng' : 'Nhiệm vụ ' + item.missionIndex;
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
    recoil = reduced ? 0 : recoil * Math.exp(-Math.max(0,dt) * 18);
    if (recoil < .015) recoil = 0;
    for (const [id, remaining] of hits) { if (remaining <= dt) hits.delete(id); else hits.set(id, remaining - dt); }
    background(game);
    const pending = bullets.find(b => !b.from);
    const pendingTarget = pending && game.items.find(item => item.id === pending.targetId);
    const aim = pending ? point(pendingTarget || { x:pending.nx, y:pending.ny }) : game.locked ? point(game.locked) : null;
    const center = shipGeometry(W, H).center;
    const goal = aim ? aimAngle(center, aim) : 0;
    const step = Math.PI * Math.max(0, dt) / .15;
    angle = reduced ? goal : angle + clamp(goal - angle, -step, step);
    paintShip();
    if (game.running && !game.paused && !game.over && game.locked && !game.locked.dying) {
      const muzzle = shipGeometry(W, H, angle, recoil).muzzle;
      const edge = cardEdge(muzzle, aim, cardSize().w, cardSize().h);
      const pulse = reduced ? .55 : .38 + (Math.sin(now / 170) + 1) * .16;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = pulse;
      ctx.shadowColor = ENERGY;
      ctx.shadowBlur = reduced ? 0 : 12;
      ctx.strokeStyle = 'rgba(105,229,194,0.9)';
      ctx.lineWidth = reduced ? 1 : 1.5;
      ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y); ctx.lineTo(edge.x, edge.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    for (const item of game.items) card(item, game);
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.from) {
        if (b !== pending || Math.abs(goal - angle) > .03) continue;
        // Snap the last fraction at launch so the muzzle, nose and flight path agree.
        angle = goal; paintShip();
        b.from = shipGeometry(W, H, angle, recoil).muzzle;
        flashes.push({ ...b.from, age:0 });
        if (flashes.length > 8) flashes.shift();
        b.from = { x:b.from.x / W, y:b.from.y / H };
      }
      b.age += dt;
      const item = game.items.find(item => item.id === b.targetId);
      const target = item ? point(item) : point({ x:b.nx, y:b.ny });
      const from = { x:b.from.x * W, y:b.from.y * H }, { w,h } = cardSize();
      const to = cardEdge(from, target, w, h);
      if (b.age >= b.duration) { rings.push({ ...to, age:0, color:ENERGY, small:true }); bullets.splice(i, 1); continue; }
      const p = b.age / b.duration, x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p;
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const tail = reduced ? 8 : 36;
      ctx.lineCap = 'round'; ctx.shadowColor = ENERGY; ctx.shadowBlur = reduced ? 0 : 16;
      for (const [stroke, line] of [['#69E5C233',8],['#69E5C2BB',4],['#F1FFF9',1.5]]) {
        ctx.strokeStyle = stroke; ctx.lineWidth = line;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (to.x - from.x) / len * tail, y - (to.y - from.y) / len * tail); ctx.stroke();
      }
      ctx.fillStyle = '#EEFFF9'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i]; flash.age += dt;
      if (flash.age >= .085) { flashes.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - flash.age / .085) * (reduced ? .2 : .8);
      ctx.fillStyle = '#DFFFF2'; ctx.shadowColor = ENERGY; ctx.shadowBlur = reduced ? 0 : 18;
      ctx.beginPath(); ctx.arc(flash.x, flash.y, reduced ? 3 : 4 + (1 - flash.age / .085) * 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.age += dt;
      const duration = r.small ? .16 : .45;
      if (r.age > duration) { rings.splice(i, 1); continue; }
      const fade = 1 - r.age / duration;
      ctx.globalAlpha = fade * .8; ctx.strokeStyle = r.color || ENERGY; ctx.lineWidth = r.small ? 1.5 : 2.5 * fade;
      const radius = reduced ? 8 : 5 + r.age * (r.small ? 50 : r.reward ? 170 : 120);
      ctx.beginPath(); ctx.arc(r.x, r.y, radius, 0, Math.PI * 2); ctx.stroke();
      if (!r.small && !reduced) {
        ctx.globalAlpha = fade * .16; ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(r.x, r.y, radius * .7, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt;
      if (p.age > p.life) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.pow(1 - p.age / p.life, 2); ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      const travel = 1 - Math.exp(-p.age * 4), px = p.x + p.vx * travel / 3, py = p.y + p.vy * travel / 3 + p.age * p.age * 35;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - p.vx * .035, py - p.vy * .035); ctx.stroke();
    }
    for (let i = labels.length - 1; i >= 0; i--) {
      const f = labels[i]; f.age += dt;
      const duration = f.word ? 2 : .8;
      if (f.age >= duration) { labels.splice(i, 1); continue; }
      const progress = f.age / duration;
      ctx.globalAlpha = f.word ? 1 - progress : Math.min(1, (1 - progress) * 2);
      if (f.word) {
        const { w,h } = cardSize(), x = f.x - w / 2, y = f.y - h / 2 - (reduced ? 0 : progress * 76);
        const phrase = f.card.kind === 'phrase', golden = f.card.kind === 'gold' || phrase, mission = f.card.kind === 'mission';
        ctx.save();
        ctx.shadowColor = ENERGY; ctx.shadowBlur = reduced ? 0 : 14;
        rounded(ctx,x,y,w,h); ctx.fillStyle = SURFACE; ctx.fill();
        ctx.strokeStyle = golden ? '#D5B467' : mission ? '#AAADE7' : ENERGY;
        ctx.lineWidth = 1.7; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const hanSize = phrase ? Math.min(22,(w-24)/Math.ceil(f.card.word.length/2)) : h < 105 ? 25 : W < 550 ? 29 : 36;
        ctx.font = `600 ${hanSize}px ${HAN_FONT}`; ctx.fillStyle = '#F0FBF5';
        if (phrase) {
          const middle = Math.ceil(f.card.word.length/2);
          ctx.fillText(f.card.word.slice(0,middle),f.x,y+h*.22,w-24);
          ctx.fillText(f.card.word.slice(middle),f.x,y+h*.44,w-24);
        } else ctx.fillText(f.card.word,f.x,y+h*.29,w-24);
        ctx.font = `500 ${W < 550 ? 12 : 14}px ${FONT}`; ctx.fillStyle = '#D0DAE5';
        ctx.fillText(fitText(f.card.vi || '',w-22),f.x,y+h*(phrase ? .64 : .54));
        ctx.font = `500 ${W < 550 ? 13 : 15}px ${FONT}`; ctx.fillStyle = '#9CB0C6';
        ctx.fillText(fitText(f.card.py || '',w-24),f.x,y+h*(phrase ? .82 : .75));
        if (golden || mission) {
          const title = phrase ? 'Câu thưởng +400' : golden ? '✦ Thưởng' : 'Nhiệm vụ ' + f.card.missionIndex;
          ctx.font = `600 11px ${FONT}`; const badgeWidth = ctx.measureText(title).width + 16;
          rounded(ctx,x+10,y-12,badgeWidth,21,6); ctx.fillStyle = INK; ctx.fill();
          ctx.fillStyle = golden ? '#F4C96B' : '#B8BCF3';
          ctx.fillText(title,x+10+badgeWidth/2,y-2);
        }
        ctx.restore();
      } else {
        ctx.textAlign = 'center'; ctx.font = `700 ${f.reward ? 17 : 15}px ${FONT}`; ctx.fillStyle = f.color;
        ctx.shadowColor = INK; ctx.shadowBlur = reduced ? 0 : 6;
        ctx.fillText(f.text,f.x,f.y-(reduced ? 0 : 8+f.age*40)); ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }
  function clear() { bullets.length = 0; particles.length = 0; labels.length = 0; rings.length = 0; flashes.length = 0; hits.clear(); angle = 0; recoil = 0; paintShip(); }
  return { resize, draw, receive, clear };
}
