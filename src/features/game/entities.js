import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/game/entities. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { saveGamePick } from "./engine.js";

import { initBg } from "./scenery.js";

import { state as gameSessionState, randTheme } from "./session.js";

import { gameSfx } from "./ship.js";

import { pickWord, state as gameWordsState } from "./words.js";

import { speakText } from "../../shared/audio/tts.js";

export function placeX(w) {
  for (let t = 0; t < 30; t++) {
    const x = 12 + Math.random() * Math.max(1, gameSessionState.W - w - 24);
    let ok = true;
    for (const it of gameSessionState.state.items) {
      if (it.caught) continue;
      const gap = x + w <= it.x ? it.x - (x + w) : it.x + it.w <= x ? x - (it.x + it.w) : -1;
      if (gap < 3.5 * Math.min(w, it.w)) {
        ok = false;
        break;
      }
    }
    if (ok) return x;
  }
  return null;
}

export function spawn() {
  const src = pickWord();
  if (!src) return;
  if (gameSessionState.state.items.filter(i => !i.caught).length >= gameSessionState.state.maxConcurrent) return;
  gameSessionState.ctx.font = '600 11.5px system-ui,sans-serif';
  const viW = gameSessionState.ctx.measureText(src.vi || '').width;
  gameSessionState.ctx.font = '800 21px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const wW = gameSessionState.ctx.measureText(src.word || '').width;
  gameSessionState.ctx.font = '800 17px system-ui,sans-serif';
  const pW = gameSessionState.ctx.measureText(String(src.py || src.pyPlain).replace(/\s+/g, '')).width;
  const w = Math.min(gameSessionState.W - 30, Math.max(120, Math.max(viW, wW, pW) + 40));
  const x = placeX(w);
  if (x == null) return;
  const h = 82;
  gameSessionState.state.items.push({
    id: gameSessionState.state.uid++,
    src,
    x,
    y: -h / 2 - 10,
    w,
    h,
    vy: gameWordsState.baseFall(),
    caught: false,
    scored: false,
    // ★ Hiếm thôi: chỉ ~10% thẻ mang tim, và chỉ khi đang thiếu mạng
    heart: gameSessionState.state.wordsDone >= 4 && gameSessionState.state.lives < gameSessionState.state.maxLives && Math.random() < 0.10
  });
}

export function shoot(it) {
  it.caught = true;
  /* ★ Không vỡ lộn xộn: giữ NGUYÊN thẻ (Tiếng Việt + Hán + Pinyin y như cũ),
     để người học nhìn thêm ~2s cho thuộc từ vựng, đồng thời trôi lên + mờ dần. */
  it.dying = true;
  it.dieT = 0;
  it.dieDur = 2.0;
  if (gameSessionState.state.locked === it) {
    gameSessionState.state.locked = null;
    gameSessionState.state.buffer = '';
  }
  gameSessionState.state.skipped.clear();
  gameSessionState.state.combo++;
  gameSessionState.state.bestCombo = Math.max(gameSessionState.state.bestCombo, gameSessionState.state.combo);
  const gain = gameSessionState.state.combo;
  gameSessionState.state.score += gain;
  gameSessionState.state.wordsDone++;
  /* ★ Tiến độ chặng tính riêng bằng stageWords — không suy ra từ wordsDone
     (wordsDone reset mỗi ván nên chặng khôi phục sẽ không bao giờ tiến). */
  gameSessionState.state.stageWords = (gameSessionState.state.stageWords || 0) + 1;
  const cx = it.x + it.w / 2,
    cy = it.y;
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2,
      sp = 90 + Math.random() * 250;
    gameSessionState.state.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 110,
      life: 0.5 + Math.random() * 0.4,
      max: 0.9,
      size: 2 + Math.random() * 3.5,
      hue: 45 + Math.random() * 30
    });
  }
  gameSessionState.state.floats.push({
    x: cx,
    y: cy - 10,
    txt: '+' + gain,
    life: 0.9,
    t: 0,
    color: '#fde047'
  });
  // ★ Phá thẻ mang tim → +1 mạng (tối đa 10)
  if (it.heart && gameSessionState.state.lives < gameSessionState.state.maxLives) {
    gameSessionState.state.lives++;
    gameSessionState.state.floats.push({
      x: cx,
      y: cy + 16,
      txt: '♥ +1',
      life: 1.1,
      t: 0,
      color: '#fb7185'
    });
  }
  try {
    speakText(it.src.word);
  } catch (e) {}
  gameSfx(1.5);
  /* báo điểm cho bảng xếp hạng (chỉ điểm của từ bắn được, không tính câu sai) */
  try {
    legacy.__gpOnGamePoint && legacy.__gpOnGamePoint(gain);
  } catch (e) {}
  // ★ Qua chặng mới (mỗi STAGE_SIZE từ) → đổi nền + hiện banner
  if (gameSessionState.state.stageWords >= gameSessionState.STAGE_SIZE) {
    document.dispatchEvent(new CustomEvent('gp:activity',{detail:{kind:'game',id:'stage:'+gameSessionState.state.level+':'+gameSessionState.state.stage}}));
    gameSessionState.state.stageWords = 0;
    advanceStage((gameSessionState.state.stage || 1) + 1);
  }
}

/* ★ Chuyển chặng: tăng số chặng, đổi chủ đề nền (phong cảnh), hiện banner ~2s
   (không dừng game), lưu theo chặng. Banner CHỈ ghi số chặng. */

/* ★ Chuyển chặng: tăng số chặng, đổi chủ đề nền (phong cảnh), hiện banner ~2s
   (không dừng game), lưu theo chặng. Banner CHỈ ghi số chặng. */
export function advanceStage(ns) {
  gameSessionState.state.stage = Math.max(1, Number(ns) || 1);
  gameSessionState.state.stageWords = 0;
  gameSessionState.state.themeIdx = randTheme(gameSessionState.state.themeIdx); // đổi cả nền → phong cảnh khác
  gameSessionState.state.banner = {
    title: 'Chặng ' + gameSessionState.state.stage,
    sub: 'Tiếp tục!',
    t: 0,
    life: 2.0
  };
  initBg();
  saveGameStage();
}

/* ★ Lưu tiến độ theo chặng (localStorage) */

/* ★ Lưu tiến độ theo chặng (localStorage) */
export function saveGameStage() {
  try {
    learningStorage.setItem('gopinyin:game:stage', JSON.stringify({
      score: gameSessionState.state.score,
      bestCombo: gameSessionState.state.bestCombo,
      lives: gameSessionState.state.lives,
      wordsDone: gameSessionState.state.wordsDone,
      stage: gameSessionState.state.stage,
      stageWords: gameSessionState.state.stageWords || 0,
      level: gameSessionState.state.level,
      ts: Date.now()
    }));
  } catch (e) {}
  saveGamePick();
}

export function loadGameStage() {
  try {
    const s = JSON.parse(learningStorage.getItem('gopinyin:game:stage') || 'null');
    return s && s.stage ? s : null;
  } catch (e) {
    return null;
  }
}

/* ★ Nhớ lựa chọn của lần chơi trước: cấp HSK · tốc độ (ĐỘ ĐỢ) · số thẻ.
   Đọc/lập riêng khỏi save chặng để luôn khôi phục được, kể cả khi không
   có ván đang dở. */
