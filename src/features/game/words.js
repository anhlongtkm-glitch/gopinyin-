// State and behavior owned by features/game/words. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { state as gameSessionState } from "./session.js";

import { hanziSegment } from "../../shared/language/hanzi.js";

import { stripToneMarks } from "../../shared/language/pinyin.js";

export const state = {};

const gameWordsState = state;

/* ü được gõ bằng "v" (quy ước pinyin: 女 nǚ → "nv"). Vẫn chấp nhận "u"
   tương đương "v" khi đích là ü để người quen gõ cũ không bị kẹt. */
export function plainPinyin(py) {
  try {
    const {
      plain
    } = stripToneMarks(String(py || ''));
    return plain.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z]/g, '');
  } catch (e) {
    return String(py || '').toLowerCase().replace(/[^a-z]/g, '');
  }
}

export function okChar(exp, typed) {
  if (exp === typed) return true;
  if (exp === 'v' && typed === 'u') return true;
  return false;
}

export function sentenceToWords(zh, py, vi, map) {
  const syls = String(py || '').trim().split(/\s+/).filter(Boolean);
  if (!syls.length) return;
  const chars = Array.from(zh);
  const perChar = new Array(chars.length).fill(null);
  let si = 0,
    lastSyl = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!gameSessionState.HAN.test(ch)) continue;
    if (ch === '儿' && /r$/i.test(lastSyl)) {
      perChar[i] = null;
      continue;
    }
    if (si >= syls.length) return;
    perChar[i] = syls[si];
    lastSyl = syls[si];
    si++;
  }
  if (si !== syls.length) return;
  const segs = typeof hanziSegment === 'function' ? hanziSegment(zh) : [chars.join('')];
  let pos = 0;
  for (const seg of segs) {
    const len = Array.from(seg).length;
    if (len >= 1 && /^[㐀-鿿]+$/.test(seg)) {
      const sl = chars.slice(pos, pos + len).map((_, k) => perChar[pos + k]).filter(Boolean);
      const erhuaTail = /儿$/.test(seg);
      if (sl.length === len || erhuaTail && sl.length === len - 1) {
        const pyw = sl.join(' ');
        const mean = typeof dataCatalogState.GAME_WORD_VI !== 'undefined' && dataCatalogState.GAME_WORD_VI[seg] || '';
        map.set(seg, {
          word: seg,
          py: pyw,
          vi: mean,
          pyPlain: plainPinyin(pyw)
        });
      }
    }
    pos += len;
  }
}

export function buildPool(level) {
  if (gameWordsState.poolCache[level]) return gameWordsState.poolCache[level];
  const data = typeof dataCatalogState.HSK_DATA !== 'undefined' && dataCatalogState.HSK_DATA['hsk' + level] || [];
  const map = new Map();
  for (const row of data) {
    if (!row || !row[0]) continue;
    try {
      sentenceToWords(row[0], row[1], row[2], map);
    } catch (e) {}
  }
  let arr = [...map.values()].filter(w => w.pyPlain.length >= 2 && w.pyPlain.length <= 8 && w.vi);
  if (arr.length < 6) {
    arr = [...map.values()].filter(w => w.pyPlain.length >= 1 && w.pyPlain.length <= 10 && w.vi);
  }
  gameWordsState.poolCache[level] = arr;
  return arr;
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickWord() {
  const pool = gameSessionState.state.pool;
  if (!pool.length) return null;
  const w = pool[gameSessionState.state.poolIdx % pool.length];
  gameSessionState.state.poolIdx++;
  return w;
}

/* ★ Tốc độ rơi đã GIẢM mạnh so với bản cũ (9 + speed*12 → 45px/s ở mức 3):
   giờ mức 1 ≈ 13px/s, mức 3 ≈ 27px/s, mức 10 ≈ 76px/s → người mới kịp nhìn & gõ. */

export function initializeGameWords() {
  gameWordsState.poolCache = {};
  /* ★ Tốc độ rơi đã GIẢM mạnh so với bản cũ (9 + speed*12 → 45px/s ở mức 3):
     giờ mức 1 ≈ 13px/s, mức 3 ≈ 27px/s, mức 10 ≈ 76px/s → người mới kịp nhìn & gõ. */
  gameWordsState.baseFall = () => 6 + gameSessionState.state.speed * 7;
  // px/s
  gameWordsState.spawnInterval = () => Math.max(1.5, 3.8 - gameSessionState.state.speed * 0.18);
}
