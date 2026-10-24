// State and behavior owned by features/game/scenery. Initialization is orchestrated by app/bootstrap.js.

import { state as gameSessionState } from "./session.js";

export function resize() {
  const r = gameSessionState.playField.getBoundingClientRect();
  gameSessionState.W = Math.max(320, r.width || 600);
  gameSessionState.H = Math.max(220, r.height || 400);
  gameSessionState.dpr = Math.min(window.devicePixelRatio || 1, 2);
  gameSessionState.canvas.width = Math.round(gameSessionState.W * gameSessionState.dpr);
  gameSessionState.canvas.height = Math.round(gameSessionState.H * gameSessionState.dpr);
  gameSessionState.canvas.style.width = gameSessionState.W + 'px';
  gameSessionState.canvas.style.height = gameSessionState.H + 'px';
  gameSessionState.ctx.setTransform(gameSessionState.dpr, 0, 0, gameSessionState.dpr, 0, 0);
  initBg();
}

/* ★ Nền theo chủ đề chặng — luôn tối. Mỗi chủ đề có loại hạt rơi riêng. */

/* ★ Nền theo chủ đề chặng — luôn tối. Mỗi chủ đề có loại hạt rơi riêng. */
export function makeBgParticle(x, y) {
  const part = gameSessionState.THEMES[gameSessionState.state.themeIdx].part;
  if (part === 'rain') {
    return {
      x,
      y,
      len: 8 + Math.random() * 16,
      vy: 180 + Math.random() * 260,
      a: 0.06 + Math.random() * 0.12,
      type: 'rain'
    };
  }
  if (part === 'snow') {
    return {
      x,
      y,
      r: 1.5 + Math.random() * 2.6,
      vy: 28 + Math.random() * 42,
      vx: (Math.random() - 0.5) * 22,
      a: 0.45 + Math.random() * 0.4,
      type: 'snow'
    };
  }
  if (part === 'star') {
    return {
      x,
      y,
      r: 0.6 + Math.random() * 1.7,
      tw: Math.random() * Math.PI * 2,
      a: 0.3 + Math.random() * 0.6,
      type: 'star'
    };
  }
  if (part === 'leaf') {
    return {
      x,
      y,
      r: 4 + Math.random() * 5,
      vy: 24 + Math.random() * 32,
      vx: (Math.random() - 0.5) * 34,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
      a: 0.55 + Math.random() * 0.35,
      hue: 25 + Math.random() * 25,
      type: 'leaf'
    };
  }
  if (part === 'petal') {
    return {
      x,
      y,
      r: 3 + Math.random() * 3,
      vy: 20 + Math.random() * 24,
      vx: (Math.random() - 0.5) * 34,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
      ph: Math.random() * Math.PI * 2,
      a: 0.65 + Math.random() * 0.3,
      type: 'petal'
    };
  }
  /* dust: hạt sáng li ti trôi lơ lửng (hoàng hôn / biển / neon) */
  return {
    x,
    y,
    r: 0.8 + Math.random() * 1.8,
    vy: -8 - Math.random() * 14,
    vx: (Math.random() - 0.5) * 14,
    tw: Math.random() * Math.PI * 2,
    a: 0.25 + Math.random() * 0.45,
    type: 'dust'
  };
}

export function initBg() {
  const n = Math.floor(gameSessionState.W * gameSessionState.H / 9000);
  gameSessionState.state.bg = [];
  for (let i = 0; i < n; i++) gameSessionState.state.bg.push(makeBgParticle(Math.random() * gameSessionState.W, Math.random() * gameSessionState.H));
  gameSessionState.state.scene = buildScene();
}

/* ★ Dựng PHONG CẢNH nền một lần (khi đổi chủ đề / resize) để các đối tượng
   (toà nhà, núi, cây…) đứng yên, không nhảy mỗi khung hình. */

/* ★ Dựng PHONG CẢNH nền một lần (khi đổi chủ đề / resize) để các đối tượng
   (toà nhà, núi, cây…) đứng yên, không nhảy mỗi khung hình. */
export function buildScene() {
  const sc = {
    type: gameSessionState.THEMES[gameSessionState.state.themeIdx].scene,
    builds: [],
    windows: [],
    hills: [],
    trees: [],
    branches: []
  };
  const R = Math.random;
  if (sc.type === 'city' || sc.type === 'neon') {
    let x = -12;
    while (x < gameSessionState.W + 12) {
      const w = 42 + R() * 72,
        h = 60 + R() * 160;
      sc.builds.push({
        x,
        w,
        h
      });
      const cols = Math.max(1, Math.floor((w - 10) / 14)),
        rows = Math.max(3, Math.floor((h - 8) / 18));
      for (let c = 0; c < cols; c++) for (let rw = 0; rw < rows; rw++) {
        if (R() < 0.34) {
          sc.windows.push({
            x: x + 7 + c * 14,
            y: gameSessionState.H - h + 8 + rw * 18,
            w: 5,
            h: 7,
            c: sc.type === 'neon' ? ['#22d3ee', '#f472b6', '#fde047', '#a78bfa', '#34d399'][Math.floor(R() * 5)] : 'rgba(147,197,253,0.16)'
          });
        }
      }
      x += w + 3 + R() * 12;
    }
  } else if (sc.type === 'mountain') {
    sc.hills.push({
      x: -30,
      w: gameSessionState.W * 0.85,
      h: 140 + R() * 70
    });
    sc.hills.push({
      x: gameSessionState.W * 0.28,
      w: gameSessionState.W * 0.95,
      h: 100 + R() * 80
    });
    sc.hills.push({
      x: gameSessionState.W * 0.62,
      w: gameSessionState.W * 0.85,
      h: 175 + R() * 65
    });
  } else if (sc.type === 'forest') {
    const cnt = 5 + Math.floor(R() * 4);
    for (let i = 0; i < cnt; i++) {
      const h = 70 + R() * 90;
      sc.trees.push({
        x: gameSessionState.W / (cnt - 1) * i + (R() - 0.5) * 30,
        h,
        w: 26 + R() * 22
      });
    }
  } else if (sc.type === 'sakura') {
    const cnt = 5;
    for (let i = 0; i < cnt; i++) {
      /* nhánh từ góc trên trái/phải cụp xuống */
      const b = {
        x: i < cnt / 2 ? -20 : gameSessionState.W + 20,
        y: 20 + R() * 70,
        len: 90 + R() * 90,
        dir: i < cnt / 2 ? 1 : -1,
        blossoms: []
      };
      const bn = 7 + Math.floor(R() * 5);
      for (let k = 0; k < bn; k++) {
        b.blossoms.push({
          dx: 10 + R() * b.len,
          dy: -12 + R() * b.len * 0.6,
          r: 4 + R() * 4
        });
      }
      sc.branches.push(b);
    }
  }
  return sc;
}

/* ★ Vẽ phong cảnh phía SAU (silhouette) → đặt TRƯỚC lớp hạt đang rơi */

/* ★ Vẽ phong cảnh phía SAU (silhouette) → đặt TRƯỚC lớp hạt đang rơi */
export function drawSceneryFar() {
  const sc = gameSessionState.state.scene;
  if (!sc) return;
  if (sc.type === 'city' || sc.type === 'neon') {
    gameSessionState.ctx.save();
    const body = sc.type === 'neon' ? 'rgba(7,5,20,0.9)' : 'rgba(4,9,22,0.9)';
    gameSessionState.ctx.fillStyle = body;
    for (const b of sc.builds) gameSessionState.ctx.fillRect(b.x, gameSessionState.H - b.h, b.w, b.h);
    for (const w of sc.windows) {
      gameSessionState.ctx.fillStyle = w.c;
      gameSessionState.ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    gameSessionState.ctx.restore();
  } else if (sc.type === 'mountain') {
    gameSessionState.ctx.save();
    for (const m of sc.hills) {
      gameSessionState.ctx.fillStyle = 'rgba(9,20,42,0.92)';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.moveTo(m.x, gameSessionState.H);
      gameSessionState.ctx.lineTo(m.x + m.w / 2, gameSessionState.H - m.h);
      gameSessionState.ctx.lineTo(m.x + m.w, gameSessionState.H);
      gameSessionState.ctx.closePath();
      gameSessionState.ctx.fill();
      /* chóp tuyết */
      const capW = m.w * 0.2;
      gameSessionState.ctx.fillStyle = 'rgba(226,232,240,0.82)';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.moveTo(m.x + m.w / 2 - capW, gameSessionState.H - m.h + capW * 1.7);
      gameSessionState.ctx.lineTo(m.x + m.w / 2, gameSessionState.H - m.h);
      gameSessionState.ctx.lineTo(m.x + m.w / 2 + capW, gameSessionState.H - m.h + capW * 1.7);
      gameSessionState.ctx.closePath();
      gameSessionState.ctx.fill();
    }
    gameSessionState.ctx.restore();
  } else if (sc.type === 'forest') {
    gameSessionState.ctx.save();
    gameSessionState.ctx.fillStyle = 'rgba(15,10,4,0.92)';
    for (const t of sc.trees) {
      /* thân cây */
      gameSessionState.ctx.fillRect(t.x - 3, gameSessionState.H - t.h * 0.45, 6, t.h * 0.45);
      /* 3 tầng lá hình tam giác (cây thông) */
      for (let k = 0; k < 3; k++) {
        const w = t.w * (1 - k * 0.22);
        const baseY = gameSessionState.H - t.h * 0.35 - k * t.h * 0.24;
        gameSessionState.ctx.beginPath();
        gameSessionState.ctx.moveTo(t.x - w, baseY);
        gameSessionState.ctx.lineTo(t.x, baseY - t.h * 0.32);
        gameSessionState.ctx.lineTo(t.x + w, baseY);
        gameSessionState.ctx.closePath();
        gameSessionState.ctx.fill();
      }
    }
    gameSessionState.ctx.restore();
  } else if (sc.type === 'sakura') {
    gameSessionState.ctx.save();
    /* nhánh */
    gameSessionState.ctx.strokeStyle = 'rgba(38,22,30,0.95)';
    gameSessionState.ctx.lineWidth = 5;
    gameSessionState.ctx.lineCap = 'round';
    for (const b of sc.branches) {
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.moveTo(b.x, b.y);
      gameSessionState.ctx.quadraticCurveTo(b.x + b.dir * b.len * 0.6, b.y + b.len * 0.5, b.x + b.dir * b.len, b.y + b.len * 0.25);
      gameSessionState.ctx.stroke();
    }
    /* chùm hoa */
    for (const b of sc.branches) {
      for (const fl of b.blossoms) {
        const px = b.x + b.dir * fl.dx,
          py = b.y + fl.dy;
        gameSessionState.ctx.fillStyle = 'rgba(251,207,232,0.9)';
        gameSessionState.ctx.beginPath();
        gameSessionState.ctx.arc(px, py, fl.r, 0, Math.PI * 2);
        gameSessionState.ctx.fill();
        gameSessionState.ctx.fillStyle = 'rgba(245,180,214,0.7)';
        gameSessionState.ctx.beginPath();
        gameSessionState.ctx.arc(px, py, fl.r * 0.5, 0, Math.PI * 2);
        gameSessionState.ctx.fill();
      }
    }
    gameSessionState.ctx.restore();
  } else if (sc.type === 'sunset') {
    gameSessionState.ctx.save();
    /* mặt trời + quầng sáng */
    const sunX = gameSessionState.W * 0.68,
      sunY = gameSessionState.H - 96,
      R0 = 34;
    const glow = gameSessionState.ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, R0 * 3.2);
    glow.addColorStop(0, 'rgba(253,186,116,0.55)');
    glow.addColorStop(1, 'rgba(253,186,116,0)');
    gameSessionState.ctx.fillStyle = glow;
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(sunX, sunY, R0 * 3.2, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    gameSessionState.ctx.fillStyle = 'rgba(253,224,171,0.95)';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(sunX, sunY, R0, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    /* đồi nhỏ */
    gameSessionState.ctx.fillStyle = 'rgba(35,12,38,0.92)';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.moveTo(0, gameSessionState.H);
    gameSessionState.ctx.lineTo(0, gameSessionState.H - 70);
    gameSessionState.ctx.quadraticCurveTo(gameSessionState.W * 0.3, gameSessionState.H - 150, gameSessionState.W * 0.55, gameSessionState.H - 80);
    gameSessionState.ctx.quadraticCurveTo(gameSessionState.W * 0.8, gameSessionState.H - 30, gameSessionState.W, gameSessionState.H - 95);
    gameSessionState.ctx.lineTo(gameSessionState.W, gameSessionState.H);
    gameSessionState.ctx.closePath();
    gameSessionState.ctx.fill();
    /* vài con chim */
    gameSessionState.ctx.strokeStyle = 'rgba(60,25,60,0.8)';
    gameSessionState.ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const bx = gameSessionState.W * 0.18 + i * 26,
        by = 60 + i % 2 * 22;
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.moveTo(bx - 6, by);
      gameSessionState.ctx.quadraticCurveTo(bx - 3, by - 4, bx, by);
      gameSessionState.ctx.quadraticCurveTo(bx + 3, by - 4, bx + 6, by);
      gameSessionState.ctx.stroke();
    }
    gameSessionState.ctx.restore();
  }
}

/* ★ Vẽ phong cảnh phía TRƯỚC (sau lớp hạt): hành tinh, mặt trăng, sóng biển */

/* ★ Vẽ phong cảnh phía TRƯỚC (sau lớp hạt): hành tinh, mặt trăng, sóng biển */
export function drawSceneryNear() {
  const sc = gameSessionState.state.scene;
  if (!sc) return;
  if (sc.type === 'planet') {
    gameSessionState.ctx.save();
    /* mặt trăng nhỏ bên trái */
    gameSessionState.ctx.fillStyle = 'rgba(203,213,225,0.85)';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(gameSessionState.W * 0.16, gameSessionState.H * 0.24, 18, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    gameSessionState.ctx.fillStyle = 'rgba(148,163,184,0.35)';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(gameSessionState.W * 0.16 + 6, gameSessionState.H * 0.24 - 5, 4, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(gameSessionState.W * 0.16 - 5, gameSessionState.H * 0.24 + 6, 3, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    /* hành tinh lớn góc phải + vành đai */
    const px = gameSessionState.W * 0.82,
      py = gameSessionState.H * 0.62,
      pr = Math.min(gameSessionState.W, gameSessionState.H) * 0.3;
    const grd = gameSessionState.ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    grd.addColorStop(0, 'rgba(139,92,246,0.85)');
    grd.addColorStop(0.6, 'rgba(76,29,149,0.9)');
    grd.addColorStop(1, 'rgba(30,15,60,0.95)');
    gameSessionState.ctx.fillStyle = grd;
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(px, py, pr, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    /* vành đai */
    gameSessionState.ctx.save();
    gameSessionState.ctx.translate(px, py);
    gameSessionState.ctx.rotate(-0.42);
    gameSessionState.ctx.scale(1, 0.28);
    gameSessionState.ctx.strokeStyle = 'rgba(196,181,253,0.55)';
    gameSessionState.ctx.lineWidth = 5;
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(0, 0, pr * 1.55, 0, Math.PI * 2);
    gameSessionState.ctx.stroke();
    gameSessionState.ctx.restore();
    gameSessionState.ctx.restore();
  } else if (sc.type === 'sea') {
    gameSessionState.ctx.save();
    const horizon = gameSessionState.H - 86;
    /* mặt trăng phản chiếu */
    const moonX = gameSessionState.W * 0.3,
      R0 = 20;
    gameSessionState.ctx.fillStyle = 'rgba(226,232,240,0.9)';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(moonX, horizon - 40, R0, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
    /* biển */
    gameSessionState.ctx.fillStyle = 'rgba(5,20,40,0.6)';
    gameSessionState.ctx.fillRect(0, horizon, gameSessionState.W, gameSessionState.H - horizon);
    /* sóng */
    gameSessionState.ctx.strokeStyle = 'rgba(148,197,253,0.28)';
    gameSessionState.ctx.lineWidth = 1.4;
    const t = performance.now() / 1000;
    for (let k = 0; k < 7; k++) {
      const y = horizon + 8 + k * 13;
      const amp = 3 + k * 0.6;
      gameSessionState.ctx.beginPath();
      for (let x = 0; x <= gameSessionState.W; x += 14) {
        const yy = y + Math.sin(x * 0.05 + t * 1.4 + k * 0.6) * amp;
        x === 0 ? gameSessionState.ctx.moveTo(x, yy) : gameSessionState.ctx.lineTo(x, yy);
      }
      gameSessionState.ctx.stroke();
    }
    /* vệt sáng trăng trên mặt nước */
    const rg = gameSessionState.ctx.createLinearGradient(0, horizon, 0, gameSessionState.H);
    rg.addColorStop(0, 'rgba(226,232,240,0.22)');
    rg.addColorStop(1, 'rgba(226,232,240,0)');
    gameSessionState.ctx.fillStyle = rg;
    gameSessionState.ctx.fillRect(moonX - 10, horizon, 20, gameSessionState.H - horizon);
    gameSessionState.ctx.restore();
  }
}
