// State and behavior owned by features/game/render. Initialization is orchestrated by app/bootstrap.js.

import { drawSceneryFar, drawSceneryNear } from "./scenery.js";

import { state as gameSessionState } from "./session.js";

import { shipNose } from "./ship.js";

import { state as languagePinyinState } from "../../shared/language/pinyin.js";

export function drawCard(it) {
  /* ★ Vừa gõ đúng → KHÔNG vỡ lộn xộn. Giữ nguyên khung + chữ Hán/Pinyin/Tiếng Việt
     để người học nhìn thêm ~2s cho thuộc từ vựng, đồng thời trôi lên trên và mờ dần. */
  if (it.dying) {
    const p = Math.min(1, it.dieT / it.dieDur);
    gameSessionState.ctx.save();
    gameSessionState.ctx.globalAlpha = Math.max(0, 1 - p);
    gameSessionState.ctx.translate(0, -p * 80);
    drawCardBody(it);
    gameSessionState.ctx.restore();
    return;
  }
  drawCardBody(it);
}

export function drawCardBody(it) {
  const cx = it.x + it.w / 2;
  const cy = it.y;
  const src = it.src;
  const locked = gameSessionState.state.locked && gameSessionState.state.locked.id === it.id;
  if (locked) {
    gameSessionState.ctx.shadowColor = '#60a5fa';
    gameSessionState.ctx.shadowBlur = 22;
  }
  roundRect(it.x, cy - it.h / 2, it.w, it.h, 12);
  const g = gameSessionState.ctx.createLinearGradient(it.x, cy - it.h / 2, it.x, cy + it.h / 2);
  g.addColorStop(0, locked ? 'rgba(37,99,235,0.95)' : 'rgba(30,58,138,0.92)');
  g.addColorStop(1, locked ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.92)');
  gameSessionState.ctx.fillStyle = g;
  gameSessionState.ctx.fill();
  gameSessionState.ctx.shadowBlur = 0;
  gameSessionState.ctx.lineWidth = locked ? 2.5 : 1;
  gameSessionState.ctx.strokeStyle = locked ? '#60a5fa' : 'rgba(148,163,184,0.35)';
  gameSessionState.ctx.stroke();
  gameSessionState.ctx.textAlign = 'center';
  gameSessionState.ctx.textBaseline = 'middle';
  // dòng 1: nghĩa tiếng Việt
  gameSessionState.ctx.fillStyle = 'rgba(186,206,235,0.85)';
  gameSessionState.ctx.font = '600 11.5px system-ui,-apple-system,sans-serif';
  const viTxt = String(src.vi || '').slice(0, 28);
  gameSessionState.ctx.fillText(viTxt, cx, cy - it.h / 2 + 15);
  // dòng 2: chữ Hán
  gameSessionState.ctx.fillStyle = '#f1f5f9';
  gameSessionState.ctx.font = '800 21px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  gameSessionState.ctx.fillText(String(src.word || ''), cx, cy - 4);
  // huy hiệu ♥ nếu thẻ mang mạng
  if (it.heart) {
    gameSessionState.ctx.font = '900 14px system-ui,sans-serif';
    gameSessionState.ctx.textAlign = 'right';
    gameSessionState.ctx.fillStyle = '#fb7185';
    gameSessionState.ctx.shadowColor = '#fb7185';
    gameSessionState.ctx.shadowBlur = 8;
    gameSessionState.ctx.fillText('♥', it.x + it.w - 8, cy - it.h / 2 + 16);
    gameSessionState.ctx.shadowBlur = 0;
    gameSessionState.ctx.textAlign = 'center';
  }
  // dòng 3: pinyin — Enter (hoặc nút 💡) để ẨN/HIỆN
  //   • Hiện: in đầy đủ pinyin có dấu thanh, phần đã gõ tô xanh, phần còn lại xanh nhạt
  //   • Ẩn : chỉ để gạch dưới mờ cho biết còn bao nhiêu chữ cái
  const py = String(src.pyPlain || '');
  if (py) {
    const typedLen = locked ? gameSessionState.state.buffer.length : 0;
    gameSessionState.ctx.font = '800 17px system-ui,sans-serif';
    if (gameSessionState.state.showPinyin) {
      /* ★ Bỏ khoảng trắng để pinyin hiển thị GIỐNG HỆT lúc gõ (yīkuàir = "yikuair") */
      const toned = (String(src.py || py).trim() || py).replace(/\s+/g, '');
      const chars = Array.from(toned);
      const totalW = gameSessionState.ctx.measureText(toned).width;
      let px = cx - totalW / 2;
      let li = 0;
      gameSessionState.ctx.textAlign = 'left';
      for (const ch of chars) {
        /* ★ PHẢI tính cả NGUYÊN ÂM CÓ DẤU THANH (ǐ á ǎ à ē…) là chữ cái.
           Trước đây chỉ dùng /[a-zü]/i nên "qǐchuáng" coi ǐ/á là KHÔNG phải
           chữ → chúng không bao giờ đổi màu khi gõ, và biến đếm `li` bị lệch
           khiến các chữ phía sau cũng tô sai vị trí. */
        const isLetter = /[a-zü]/i.test(ch) || !!languagePinyinState.TONE_MAP[ch];
        const done = isLetter && li < typedLen;
        gameSessionState.ctx.fillStyle = done ? '#86efac' : 'rgba(147,197,253,0.92)';
        if (done) {
          gameSessionState.ctx.shadowColor = '#86efac';
          gameSessionState.ctx.shadowBlur = 6;
        }
        gameSessionState.ctx.fillText(ch, px, cy + 19);
        gameSessionState.ctx.shadowBlur = 0;
        px += gameSessionState.ctx.measureText(ch).width;
        if (isLetter) li++;
      }
    } else if (typedLen > 0) {
      /* đang ẩn pinyin nhưng đã gõ được vài chữ → chỉ hiện phần đã gõ để biết tiến độ.
         ★ Người dùng chỉ gõ KHÔNG DẤU, nhưng phần đã gõ hiện kèm THANH ĐIỆU
           của từ đích (gõ "nushe" → hiện "nǚshē") để vừa luyện vừa thuộc thanh.
         ★ Đã bỏ dòng gạch mờ đánh dấu phần chưa gõ (yêu cầu). */
      const tonedFull = (String(src.py || py).trim() || py).replace(/\s+/g, '');
      const tonedLetters = Array.from(tonedFull).filter(ch => /[a-zü]/i.test(ch) || !!languagePinyinState.TONE_MAP[ch]);
      const shown = tonedLetters.length === py.length ? tonedLetters.slice(0, typedLen).join('') : py.slice(0, typedLen);
      if (shown) {
        gameSessionState.ctx.fillStyle = '#86efac';
        gameSessionState.ctx.shadowColor = '#86efac';
        gameSessionState.ctx.shadowBlur = 6;
        gameSessionState.ctx.textAlign = 'left';
        gameSessionState.ctx.fillText(shown, cx - gameSessionState.ctx.measureText(shown).width / 2, cy + 19);
        gameSessionState.ctx.shadowBlur = 0;
      }
    }
    /* chưa gõ gì và đang ẩn pinyin → để trống, không vẽ gạch mờ */
    gameSessionState.ctx.textAlign = 'center';
  }
}

export function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  gameSessionState.ctx.beginPath();
  gameSessionState.ctx.moveTo(x + r, y);
  gameSessionState.ctx.arcTo(x + w, y, x + w, y + h, r);
  gameSessionState.ctx.arcTo(x + w, y + h, x, y + h, r);
  gameSessionState.ctx.arcTo(x, y + h, x, y, r);
  gameSessionState.ctx.arcTo(x, y, x + w, y, r);
  gameSessionState.ctx.closePath();
}

export function draw() {
  // ★ Nền theo chủ đề chặng — luôn TỐI (chủ đạo tối)
  const cur = gameSessionState.THEMES[gameSessionState.state.themeIdx];
  const bg = gameSessionState.ctx.createLinearGradient(0, 0, 0, gameSessionState.H);
  bg.addColorStop(0, cur.bg1);
  bg.addColorStop(1, cur.bg2);
  gameSessionState.ctx.fillStyle = bg;
  gameSessionState.ctx.fillRect(0, 0, gameSessionState.W, gameSessionState.H);
  // vignette
  const vg = gameSessionState.ctx.createRadialGradient(gameSessionState.W / 2, gameSessionState.H * 0.4, Math.min(gameSessionState.W, gameSessionState.H) * 0.25, gameSessionState.W / 2, gameSessionState.H * 0.5, Math.max(gameSessionState.W, gameSessionState.H) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  gameSessionState.ctx.fillStyle = vg;
  gameSessionState.ctx.fillRect(0, 0, gameSessionState.W, gameSessionState.H);
  // ★ Phong cảnh nền: silhouette phía sau (toà nhà/núi/rừm/hoàng hôn…)
  drawSceneryFar();
  // hạt nền theo chủ đề (mưa/tuyết/sao/lá/cánh hoa/bụi sáng)
  for (const p of gameSessionState.state.bg) {
    if (p.type === 'rain') {
      gameSessionState.ctx.strokeStyle = 'rgba(186,206,235,' + p.a + ')';
      gameSessionState.ctx.lineWidth = 1;
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.moveTo(p.x, p.y);
      gameSessionState.ctx.lineTo(p.x - 0.4, p.y + p.len);
      gameSessionState.ctx.stroke();
    } else if (p.type === 'snow') {
      gameSessionState.ctx.fillStyle = 'rgba(226,232,240,' + p.a + ')';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gameSessionState.ctx.fill();
    } else if (p.type === 'star') {
      const tw = 0.45 + 0.55 * Math.sin(p.tw);
      gameSessionState.ctx.fillStyle = 'rgba(196,181,253,' + (p.a * tw).toFixed(3) + ')';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gameSessionState.ctx.fill();
    } else if (p.type === 'leaf') {
      gameSessionState.ctx.save();
      gameSessionState.ctx.translate(p.x, p.y);
      gameSessionState.ctx.rotate(p.rot);
      gameSessionState.ctx.fillStyle = 'hsla(' + p.hue + ',75%,55%,' + p.a.toFixed(3) + ')';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
      gameSessionState.ctx.fill();
      gameSessionState.ctx.restore();
    } else if (p.type === 'petal') {
      gameSessionState.ctx.save();
      gameSessionState.ctx.translate(p.x, p.y);
      gameSessionState.ctx.rotate(p.rot);
      gameSessionState.ctx.fillStyle = 'rgba(251,207,232,' + p.a.toFixed(3) + ')';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      gameSessionState.ctx.fill();
      gameSessionState.ctx.restore();
    } else {
      // dust — hạt sáng li ti trôi lơ lửng
      const tw = 0.45 + 0.55 * Math.sin(p.tw);
      gameSessionState.ctx.fillStyle = 'rgba(226,240,255,' + (p.a * tw).toFixed(3) + ')';
      gameSessionState.ctx.beginPath();
      gameSessionState.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gameSessionState.ctx.fill();
    }
  }
  // ★ Phong cảnh phía TRƯỚC (hành tinh/mặt trăng/sóng biển) — vẽ sau lớp hạt
  drawSceneryNear();
  // sàn phát sáng
  const floorY = gameSessionState.H - 60;
  gameSessionState.ctx.save();
  gameSessionState.ctx.strokeStyle = 'rgba(96,165,250,0.85)';
  gameSessionState.ctx.shadowColor = '#60a5fa';
  gameSessionState.ctx.shadowBlur = 14;
  gameSessionState.ctx.lineWidth = 2;
  gameSessionState.ctx.beginPath();
  gameSessionState.ctx.moveTo(0, floorY);
  gameSessionState.ctx.lineTo(gameSessionState.W, floorY);
  gameSessionState.ctx.stroke();
  gameSessionState.ctx.restore();
  // đường cảnh báo
  gameSessionState.ctx.strokeStyle = 'rgba(251,113,133,' + (0.12 + 0.25 * gameSessionState.state.flashRed).toFixed(3) + ')';
  gameSessionState.ctx.lineWidth = 1;
  gameSessionState.ctx.setLineDash([6, 6]);
  gameSessionState.ctx.beginPath();
  gameSessionState.ctx.moveTo(0, floorY - 32);
  gameSessionState.ctx.lineTo(gameSessionState.W, floorY - 32);
  gameSessionState.ctx.stroke();
  gameSessionState.ctx.setLineDash([]);
  // đường ngắm tới mục tiêu đang khoá — cho biết CHẮC CHẮN đang gõ thẻ nào
  if (gameSessionState.state.locked && !gameSessionState.state.locked.caught) {
    const n = shipNose();
    const tx = gameSessionState.state.locked.x + gameSessionState.state.locked.w / 2,
      ty = gameSessionState.state.locked.y + gameSessionState.state.locked.h / 2;
    const aim = gameSessionState.ctx.createLinearGradient(n.x, n.y, tx, ty);
    aim.addColorStop(0, 'rgba(96,165,250,0.5)');
    aim.addColorStop(1, 'rgba(96,165,250,0.05)');
    gameSessionState.ctx.save();
    gameSessionState.ctx.strokeStyle = aim;
    gameSessionState.ctx.lineWidth = 1.4;
    gameSessionState.ctx.setLineDash([5, 7]);
    gameSessionState.ctx.lineDashOffset = -(performance.now() / 28 % 12);
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.moveTo(n.x, n.y);
    gameSessionState.ctx.lineTo(tx, ty);
    gameSessionState.ctx.stroke();
    gameSessionState.ctx.restore();
  }
  // bullets
  for (const b of gameSessionState.state.bullets) {
    const a = Math.max(0, Math.min(1, (b.life - b.t) / 0.3 || 1));
    gameSessionState.ctx.save();
    gameSessionState.ctx.shadowColor = '#fde047';
    gameSessionState.ctx.shadowBlur = 10;
    gameSessionState.ctx.fillStyle = 'rgba(253,224,71,' + a + ')';
    gameSessionState.ctx.font = '900 17px system-ui,sans-serif';
    gameSessionState.ctx.textAlign = 'center';
    gameSessionState.ctx.fillText(b.ch, b.x, b.y);
    gameSessionState.ctx.restore();
  }
  // thẻ
  for (const it of gameSessionState.state.items) {
    drawCard(it);
  }
  // particles
  for (const p of gameSessionState.state.particles) {
    const a = Math.max(0, p.life / p.max);
    gameSessionState.ctx.fillStyle = 'hsla(' + p.hue + ',90%,65%,' + a.toFixed(3) + ')';
    gameSessionState.ctx.beginPath();
    gameSessionState.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    gameSessionState.ctx.fill();
  }
  // floats
  for (const f of gameSessionState.state.floats) {
    const a = Math.max(0, 1 - f.t / f.life);
    const pop = 1 + 1.1 * Math.max(0, 1 - f.t / 0.18);
    gameSessionState.ctx.save();
    gameSessionState.ctx.globalAlpha = a;
    gameSessionState.ctx.fillStyle = f.color;
    gameSessionState.ctx.font = '900 19px system-ui,sans-serif';
    gameSessionState.ctx.textAlign = 'center';
    gameSessionState.ctx.translate(f.x, f.y);
    gameSessionState.ctx.scale(pop, pop);
    gameSessionState.ctx.fillText(f.txt, 0, 0);
    gameSessionState.ctx.restore();
  }
  if (gameSessionState.state.flashRed > 0) {
    gameSessionState.ctx.fillStyle = 'rgba(251,113,133,' + (gameSessionState.state.flashRed * 0.18).toFixed(3) + ')';
    gameSessionState.ctx.fillRect(0, 0, gameSessionState.W, gameSessionState.H);
  }
  // ★ Banner chặng: hiện ~2s rồi mờ tắt (không dừng game)
  if (gameSessionState.state.banner) {
    const bp = gameSessionState.state.banner.t / gameSessionState.state.banner.life;
    let a = 1;
    if (bp < 0.15) a = bp / 0.15;else if (bp > 0.7) a = (1 - bp) / 0.3;
    a = Math.max(0, Math.min(1, a)) * 0.96;
    gameSessionState.ctx.save();
    gameSessionState.ctx.globalAlpha = a;
    gameSessionState.ctx.textAlign = 'center';
    gameSessionState.ctx.textBaseline = 'middle';
    gameSessionState.ctx.fillStyle = '#ffffff';
    gameSessionState.ctx.font = '900 30px "Baloo 2",system-ui,sans-serif';
    gameSessionState.ctx.fillText(gameSessionState.state.banner.title, gameSessionState.W / 2, gameSessionState.H / 2 - 8);
    gameSessionState.ctx.fillStyle = 'rgba(226,232,240,0.92)';
    gameSessionState.ctx.font = '700 16px system-ui,sans-serif';
    gameSessionState.ctx.fillText(gameSessionState.state.banner.sub, gameSessionState.W / 2, gameSessionState.H / 2 + 24);
    gameSessionState.ctx.restore();
  }
  if (gameSessionState.state.paused) {
    /* ★ Màn tạm dừng = nơi ôn lại CƠ CHẾ CHƠI & PHÍM TẮT ngay trong game */
    gameSessionState.ctx.fillStyle = 'rgba(8,14,32,.72)';
    gameSessionState.ctx.fillRect(0, 0, gameSessionState.W, gameSessionState.H);
    const pw = Math.min(gameSessionState.W - 36, 470),
      ph = 214;
    const px = (gameSessionState.W - pw) / 2,
      py = (gameSessionState.H - ph) / 2;
    gameSessionState.ctx.save();
    roundRect(px, py, pw, ph, 18);
    const pg = gameSessionState.ctx.createLinearGradient(px, py, px, py + ph);
    pg.addColorStop(0, 'rgba(30,41,59,.97)');
    pg.addColorStop(1, 'rgba(15,23,42,.97)');
    gameSessionState.ctx.fillStyle = pg;
    gameSessionState.ctx.fill();
    gameSessionState.ctx.strokeStyle = 'rgba(96,165,250,.35)';
    gameSessionState.ctx.lineWidth = 1;
    gameSessionState.ctx.stroke();
    gameSessionState.ctx.restore();
    gameSessionState.ctx.textAlign = 'center';
    gameSessionState.ctx.fillStyle = '#fff';
    gameSessionState.ctx.font = '800 24px system-ui,sans-serif';
    gameSessionState.ctx.fillText('⏸ TẠM DỪNG', gameSessionState.W / 2, py + 42);
    gameSessionState.ctx.font = '600 13px system-ui,sans-serif';
    const lines = ['Gõ pinyin của thẻ để bắn nổ · gõ sai chỉ mất combo, không nhảy thẻ khác', 'Enter (hoặc nút 🔒/拼): hiện/ẩn pinyin · Backspace: đổi mục tiêu', 'Space: chơi tiếp · Esc: đóng (ván được giữ lại) · Thẻ ♥ rơi: +1 mạng'];
    lines.forEach((t, i) => gameSessionState.ctx.fillText(t, gameSessionState.W / 2, py + 80 + i * 24));
    gameSessionState.ctx.fillStyle = '#93c5fd';
    gameSessionState.ctx.font = '700 13px system-ui,sans-serif';
    gameSessionState.ctx.fillText('Nhấn Space hoặc nút ⏸ để tiếp tục', gameSessionState.W / 2, py + ph - 28);
  }
}
