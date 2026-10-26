import { isStudyAllowed } from "../auth/service.js";
// State and behavior owned by features/game/input. Initialization is orchestrated by app/bootstrap.js.


import { togglePause } from "./controller.js";

import { shoot } from "./entities.js";

import { isFs } from "./events.js";

import { isGameVisible } from "./loop.js";

import { state as gameSessionState } from "./session.js";

import { spawnBullet, penalty } from "./ship.js";

import { okChar } from "./words.js";

export function updateHud() {
  const sc = gameSessionState.$('gaScoreNum');
  if (sc) {
    const newTxt = String(gameSessionState.state.score);
    if (sc.textContent !== newTxt) {
      sc.textContent = newTxt;
      sc.classList.remove('pop');
      void sc.offsetWidth;
      sc.classList.add('pop');
    }
  }
  const h = gameSessionState.$('gaHearts');
  if (h) {
    /* màn hình hẹp: 9 trái tim đầy đủ sẽ tràn ra ngoài → hiện dạng gọn ♥ 5/9 */
    const narrow = window.matchMedia('(max-width:760px)').matches;
    h.textContent = narrow ? '♥ ' + gameSessionState.state.lives + '/' + gameSessionState.state.maxLives : '♥'.repeat(Math.max(0, gameSessionState.state.lives)) + '♡'.repeat(Math.max(0, gameSessionState.state.maxLives - gameSessionState.state.lives));
    h.title = gameSessionState.state.lives + '/' + gameSessionState.state.maxLives + ' mạng';
  }
  /* ★ Kho từ được lặp vòng khi hết → kẹp lại để HUD không hiện "35/30" */
  const moc = gameSessionState.$('gaMoc');
  if (moc) moc.textContent = gameSessionState.state.pool.length ? Math.min(gameSessionState.state.wordsDone, gameSessionState.state.pool.length) + '/' + gameSessionState.state.pool.length : '0/0';
  /* ★ Nhãn cấp HSK trong HUD phải đổi theo cấp đang chọn (trước đây hard-code "HSK 2") */
  const un = gameSessionState.$('gaUnit');
  if (un) un.textContent = 'HSK ' + gameSessionState.state.level;
  const fl = gameSessionState.$('gaFloorLabel');
  if (fl) fl.textContent = 'HSK ' + gameSessionState.state.level + ' Vocabulary (3.0)';
  const stg = gameSessionState.$('gaStageChip');
  if (stg) {
    const within = Math.max(0, Math.min(gameSessionState.STAGE_SIZE, gameSessionState.state.stageWords || 0));
    stg.textContent = 'Chặng ' + gameSessionState.state.stage + ' · ' + within + '/' + gameSessionState.STAGE_SIZE;
  }
}

export function handleKey(e) {
  if (!isGameVisible()) return;
  if (e.key === 'Escape') {
    /* đang toàn màn hình → để trình duyệt tự thoát, không tạm dừng game */
    if (isFs()) return;
    if (gameSessionState.state.running) togglePause();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    toggleGamePinyin();
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (gameSessionState.state.running) togglePause();
    return;
  }
  if (!gameSessionState.state.running || gameSessionState.state.paused) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    backspaceTarget();
    return;
  }
  if (!/^[a-zA-Z]$/.test(e.key)) return;
  e.preventDefault();
  typeChar(e.key);
}

/* ★ Backspace = đổi mục tiêu (không bị trừ gì)
   → bỏ khoá thẻ hiện tại; lần gõ kế tiếp sẽ chọn thẻ KHÁC cùng chữ cái đầu.
   Dùng khi lỡ khoá nhầm thẻ, không phải chờ thẻ rơi qua vạch. */

/* ★ Backspace = đổi mục tiêu (không bị trừ gì)
   → bỏ khoá thẻ hiện tại; lần gõ kế tiếp sẽ chọn thẻ KHÁC cùng chữ cái đầu.
   Dùng khi lỡ khoá nhầm thẻ, không phải chờ thẻ rơi qua vạch. */
export function backspaceTarget() {
  if (!gameSessionState.state.running || gameSessionState.state.paused) return;
  if (gameSessionState.state.locked) {
    gameSessionState.state.skipped.add(gameSessionState.state.locked.id);
    gameSessionState.state.locked = null;
    gameSessionState.state.buffer = '';
    gameSessionState.state.floats.push({
      x: gameSessionState.W / 2,
      y: gameSessionState.H - 100,
      txt: '↺ đổi mục tiêu',
      life: 0.7,
      t: 0,
      color: '#93c5fd'
    });
  }
}

/* ★ Gõ 1 ký tự (dùng chung cho bàn phím thật và bàn phím ảo) */

/* ★ Gõ 1 ký tự (dùng chung cho bàn phím thật và bàn phím ảo) */
export function typeChar(raw) {
  if (!isStudyAllowed()) return;
  if (!gameSessionState.state.running || gameSessionState.state.paused) return;
  if (!/^[a-zA-Z]$/.test(raw)) return;
  const ch = String(raw).toLowerCase().replace(/v/g, 'u');

  /* ═══════════════════════════════════════════════════════════
     ★ KHOÁ MỤC TIÊU (giống ZType / WarType):
       - Đã khoá thẻ nào thì gõ cho hết thẻ ĐÓ.
       - Gõ sai: chỉ mất combo + nháy đỏ, TUYỆT ĐỐI không nhảy
         sang thẻ khác và không xoá những ký tự đã gõ đúng.
       - Chỉ đổi mục tiêu khi: bắn xong thẻ, hoặc thẻ rơi qua vạch.
     ═══════════════════════════════════════════════════════════ */
  if (gameSessionState.state.locked) {
    const py = gameSessionState.state.locked.src.pyPlain;
    const idx = gameSessionState.state.buffer.length;
    if (idx < py.length && okChar(py[idx], ch)) {
      gameSessionState.state.buffer += ch;
      if (gameSessionState.state.buffer.length >= 2) gameSessionState.state.skipped.clear();
      spawnBullet(ch, gameSessionState.state.locked);
      if (gameSessionState.state.buffer.length === py.length) shoot(gameSessionState.state.locked);
    } else {
      penalty();
    }
    return;
  }

  /* Chưa khoá → chọn thẻ SẮP CHẠM VẠCH NHẤT bắt đầu bằng ký tự vừa gõ
     (thẻ nguy hiểm nhất được ưu tiên, không chọn ngẫu nhiên).
     Nếu vừa bấm Backspace để đổi mục tiêu → bỏ qua thẻ vừa bỏ. */
  let cands = gameSessionState.state.items.filter(it => !it.caught && okChar(it.src.pyPlain[0], ch));
  if (gameSessionState.state.skipped.size) {
    const alt = cands.filter(it => !gameSessionState.state.skipped.has(it.id));
    if (alt.length) cands = alt;else gameSessionState.state.skipped.clear();
  }
  if (!cands.length) {
    penalty();
    return;
  }
  const tgt = cands.sort((a, b) => b.y - a.y)[0];
  gameSessionState.state.locked = tgt;
  gameSessionState.state.buffer = ch;
  spawnBullet(ch, tgt);
  if (tgt.src.pyPlain.length === 1) shoot(tgt);
}

/* Ký tự tiếp theo cần gõ (để bàn phím ảo gợi ý phím) */

/* Ký tự tiếp theo cần gõ (để bàn phím ảo gợi ý phím) */
export function nextKey() {
  if (!gameSessionState.state.running || gameSessionState.state.paused) return '';
  if (gameSessionState.state.locked) {
    const py = gameSessionState.state.locked.src.pyPlain;
    return py[gameSessionState.state.buffer.length] || '';
  }
  return '';
}

// ★ Enter trong game: bật/tắt hiển thị pinyin — KHÔNG bật popup (tránh phân tâm)

// ★ Enter trong game: bật/tắt hiển thị pinyin — KHÔNG bật popup (tránh phân tâm)
export function toggleGamePinyin() {
  gameSessionState.state.showPinyin = !gameSessionState.state.showPinyin;
  syncPinyinBtn();
}

export function syncPinyinBtn() {
  const b = gameSessionState.$('gaPyBtn');
  if (!b) return;
  b.textContent = gameSessionState.state.showPinyin ? '拼' : '🔒';
  b.classList.toggle('on', gameSessionState.state.showPinyin);
  b.setAttribute('aria-pressed', gameSessionState.state.showPinyin ? 'true' : 'false');
  b.title = gameSessionState.state.showPinyin ? 'Đang hiện Pinyin — bấm hoặc Enter để ẩn' : 'Đang ẩn Pinyin — bấm hoặc Enter để xem gợi ý';
}
export function syncGameLevelTitles() {
  document.querySelectorAll('[data-glevel]').forEach(b => {
    b.title = 'Chơi cấp HSK ' + b.dataset.glevel;
  });
}

export function initializeGameInput() {
  syncGameLevelTitles();

  /* ═══ TÀU: xoay đầu nhọn về phía thẻ đang gõ ═══ */
}
