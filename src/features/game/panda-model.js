// Pure, deterministic rules for Panda Du Hành. No DOM, audio, storage or network.
import { CONTENT_VERSION, getTopic } from './panda-content.js';

export const RULES_VERSION = 'panda-90s-v2-calm';
export const GAME_DURATION = 90;
const TICK_RATE = 60;
const TICK = 1 / TICK_RATE;
const LANES = [0.25, 0.75];
export const PACING = Object.freeze({
  practice: Object.freeze({ intervals:[8, 7.5, 7], lifetimes:[30, 28, 26], minSpawnGap:5, maxActive:2 }),
  challenge: Object.freeze({ intervals:[7.5, 7, 6.5], lifetimes:[26, 24, 22], minSpawnGap:4.5, maxActive:2 })
});
const SPECIALS = [
  { at: 20, kind: 'gold' }, { at: 45, kind: 'gold' },
  { at: 60, kind: 'mission', missionIndex: 1 },
  { at: 70, kind: 'mission', missionIndex: 2 },
  { at: 80, kind: 'mission', missionIndex: 3 }
];

function seedNumber(value) {
  let result = 2166136261;
  for (const letter of String(value)) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
  return result >>> 0;
}

function randomGenerator(seed) {
  let value = seed;
  return () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function comboMultiplier(combo) {
  return combo >= 15 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1;
}

function buildSchedule(topic, seed, mode) {
  const random = randomGenerator(seed);
  const pace = PACING[mode];
  const timings = [];
  for (let stage = 0; stage < 3; stage++) {
    for (let at = stage * 30; at < Math.min(85, (stage + 1) * 30); at += pace.intervals[stage]) timings.push({ at, kind:'normal' });
  }
  timings.push({ at:4, kind:'normal' });
  timings.push(...SPECIALS);
  timings.sort((a, b) => a.at - b.at || (a.kind === 'normal' ? 1 : -1));
  let bag = [], lastWord = '';
  return timings.map((entry, index) => {
    const stage = Math.min(3, Math.floor(entry.at / 30) + 1);
    if (!bag.length) {
      // The early wave favors short common entries while keeping the complete topic available later.
      bag = [...topic.words].sort((a, b) => a.pyPlain.length - b.pyPlain.length);
      if (stage === 1) bag = bag.slice(0, Math.max(10, Math.ceil(bag.length * 0.65)));
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    if (bag.length > 1 && bag[0].id === lastWord) [bag[0], bag[1]] = [bag[1], bag[0]];
    const src = bag.shift();
    lastWord = src.id;
    return {
      ...entry, src, id: index + 1, lane: index % LANES.length,
      lifeSeconds: pace.lifetimes[stage - 1] + Math.min(14, src.pyPlain.length) * 0.35
    };
  });
}

export function createGame({ topicId = 'family', mode = 'practice', seed = 'panda-default', showPinyin = false, reviewWordIds = [] } = {}) {
  const topic = getTopic(topicId);
  const requestedReview = new Set(Array.isArray(reviewWordIds) ? reviewWordIds : []);
  const reviewPool = topic.words.filter(word => requestedReview.has(word.id));
  const isReview = reviewPool.length > 0;
  const pool = isReview ? reviewPool : topic.words;
  if (isReview) mode = 'practice';
  const normalizedSeed = seedNumber(`${topic.id}:${seed}`);
  return {
    topicId: topic.id, topic, mode: mode === 'challenge' ? 'challenge' : 'practice',
    isReview, reviewWordIds: isReview ? reviewPool.map(word => word.id) : [], completedWordIds: [],
    seed: String(seed), rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION,
    running: false, paused: false, suspended: false, resumeReady: false, over: false,
    elapsed: 0, duration: GAME_DURATION, stage: 1, stageWords: 0, tick: 0, timeCarry: 0,
    score: 0, wordScore: 0, goldScore: 0, missionScore: 0,
    lives: 3, maxLives: 3, combo: 0, bestCombo: 0, wordsDone: 0,
    showPinyin: mode !== 'challenge' && !!showPinyin, usedHints: false, hintsUsed: 0,
    correctKeys: 0, wrongKeys: 0, missed: 0, cleanWords: 0, accuracy: null,
    missionDone: 0, missionTotal: 3, missionComplete: false, goldDone: 0,
    focusCharges: 0, focusLeft: 0, focusProgress: 0,
    pool: [...pool], poolIdx: 0, items: [], locked: null, buffer: '', skipped: new Set(),
    schedule: buildSchedule({ ...topic, words:pool }, normalizedSeed, mode === 'challenge' ? 'challenge' : 'practice'), scheduleCursor: 0, pending: [], lastSpawnAt:-Infinity,
    events: [], review: [], finishReason: '', lastT: 0, rafId: 0,
    // Retained only for callers that inspect the public game state.
    particles: [], bullets: [], floats: [], flashRed: 0, shipAngle: 0
  };
}

function active(item) { return !item.caught && !item.dying; }
function canInput(game) { return game.running && !game.paused && !game.over; }
function event(game, type, item, extra = {}) {
  game.events.push({ type, at: game.elapsed, itemId: item?.id, x: item?.x, y: item?.y, word: item?.src.word, ...extra });
}

function reviewWord(game, item, reason) {
  let row = game.review.find(word => word.id === item.src.id);
  if (!row) {
    row = { ...item.src, reasons: [], errors: 0, missed: 0, usedHint: false };
    game.review.push(row);
  }
  if (!row.reasons.includes(reason)) row.reasons.push(reason);
  if (reason === 'wrong') row.errors++;
  if (reason === 'missed') row.missed++;
  if (reason === 'hint') row.usedHint = true;
}

function markHint(game, item) {
  if (item.usedHint || !active(item)) return;
  item.usedHint = true;
  game.usedHints = true;
  game.hintsUsed++;
  reviewWord(game, item, 'hint');
}

function updateAccuracy(game) {
  const attempts = game.correctKeys + game.wrongKeys;
  game.accuracy = attempts ? Math.round(game.correctKeys / attempts * 100) : null;
}

function finish(game, reason) {
  if (game.over) return;
  game.over = true;
  game.running = false;
  game.paused = false;
  game.suspended = false;
  game.resumeReady = false;
  game.finishReason = reason;
  game.locked = null;
  game.buffer = '';
  updateAccuracy(game);
  event(game, 'finish', null, { reason, score: game.score, accuracy: game.accuracy });
}

function spawnDue(game) {
  while (game.scheduleCursor < game.schedule.length && game.schedule[game.scheduleCursor].at <= game.elapsed + 1e-8) {
    game.pending.push(game.schedule[game.scheduleCursor++]);
  }
  const pace = PACING[game.mode];
  game.pending = game.pending.filter(entry => entry.kind !== 'normal' || game.elapsed - entry.at <= 10);
  if (game.items.filter(active).length >= pace.maxActive || game.elapsed - game.lastSpawnAt + 1e-8 < pace.minSpawnGap) return;
  // Prefer scheduled rewards/missions; stale ordinary words must not form a burst after a miss.
  game.pending.sort((a, b) => Number(a.kind === 'normal') - Number(b.kind === 'normal') || a.at - b.at);
  for (let p = 0; p < game.pending.length;) {
    const next = game.pending[p];
    // Do not offer a word if there is no reasonable reading/typing time left.
    const needed = 4 + next.src.pyPlain.length * 0.45;
    if (game.duration - game.elapsed < needed) {
      game.pending.splice(p, 1);
      continue;
    }
    const live = game.items.filter(active);
    if (live.some(item => item.lane === next.lane && item.y < 0.54)) { p++; continue; }
    const item = {
      id: next.id, src: next.src, kind: next.kind, missionIndex: next.missionIndex || 0,
      lane: next.lane, x: LANES[next.lane], y: 0, age: 0, lifeSeconds: next.lifeSeconds,
      caught: false, dying: false, dieT: 0, dieDur: 1.4, heart: false,
      typed: '', hadError: false, usedHint: false
    };
    game.items.push(item);
    game.poolIdx++;
    game.lastSpawnAt = game.elapsed;
    if (game.showPinyin) markHint(game, item);
    game.pending.splice(p, 1);
    return;
  }
}

export function beginGame(game) {
  if (game.running || game.over) return false;
  game.running = true;
  game.paused = false;
  game.suspended = false;
  game.resumeReady = false;
  game.lastT = 0;
  spawnDue(game);
  return true;
}

function miss(game, item) {
  if (!active(item) || game.over) return;
  item.caught = true;
  game.lives = Math.max(0, game.lives - 1);
  game.missed++;
  game.combo = 0;
  game.focusProgress = 0;
  reviewWord(game, item, 'missed');
  if (game.locked === item) { game.locked = null; game.buffer = ''; }
  game.skipped.delete(item.id);
  event(game, 'miss', item, { lives: game.lives });
  if (!game.lives) finish(game, 'lives');
}

function fixedUpdate(game) {
  const factor = game.focusLeft > 0 ? 0.45 : 1;
  game.tick++;
  game.elapsed = Math.min(game.duration, game.tick / TICK_RATE);
  game.focusLeft = Math.max(0, game.focusLeft - TICK);
  const stage = Math.min(3, Math.floor(game.elapsed / 30) + 1);
  if (stage !== game.stage) { game.stage = stage; event(game, 'stage', null, { stage }); }
  if (game.elapsed >= game.duration) { finish(game, 'time'); return; }
  for (const item of game.items) {
    if (item.dying) { item.dieT += TICK; continue; }
    if (!active(item)) continue;
    item.age += TICK;
    item.y += TICK * factor / item.lifeSeconds;
    if (item.y >= 1) miss(game, item);
    if (game.over) break;
  }
  game.items = game.items.filter(item => item.dying ? item.dieT < item.dieDur : !item.caught);
  if (!game.over) spawnDue(game);
}

export function updateGame(game, dt) {
  if (!canInput(game) || !Number.isFinite(dt) || dt <= 0) return false;
  // Fixed ticks make spawn timing independent from the browser's frame rate.
  game.timeCarry += Math.min(dt, GAME_DURATION);
  while (game.timeCarry + 1e-9 >= TICK && canInput(game)) {
    game.timeCarry = Math.max(0, game.timeCarry - TICK);
    fixedUpdate(game);
  }
  if (game.over) game.timeCarry = 0;
  return true;
}

function matches(expected, typed) { return expected === typed || expected === 'v' && typed === 'u'; }

function wrong(game, item) {
  game.wrongKeys++;
  game.combo = 0;
  game.focusProgress = 0;
  if (item) { item.hadError = true; reviewWord(game, item, 'wrong'); }
  updateAccuracy(game);
  event(game, 'wrong', item, { buffer: game.buffer });
}

function complete(game, item) {
  if (!active(item) || game.over) return;
  const clean = !item.hadError;
  const multiplier = clean ? comboMultiplier(game.combo) : 1;
  const base = 100 + 10 * Math.min(item.src.pyPlain.length, 8);
  const wordPoints = Math.round(base * multiplier);
  let bonus = 0;
  game.wordScore += wordPoints;
  if (item.kind === 'gold' && clean) { game.goldDone++; game.goldScore += 200; bonus += 200; }
  if (item.kind === 'mission') {
    game.missionDone++;
    if (game.missionDone >= game.missionTotal && !game.missionComplete) {
      game.missionComplete = true;
      game.missionScore += 500;
      bonus += 500;
    }
  }
  game.score += wordPoints + bonus;
  game.wordsDone++;
  if (!game.completedWordIds.includes(item.src.id)) game.completedWordIds.push(item.src.id);
  game.stageWords++;
  if (clean) {
    game.combo++;
    game.cleanWords++;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.focusProgress = game.combo % 5;
    if (game.combo % 5 === 0) game.focusCharges = 1;
  } else {
    game.combo = 0;
    game.focusProgress = 0;
  }
  item.caught = true;
  item.dying = true;
  item.dieT = 0;
  if (game.locked === item) { game.locked = null; game.buffer = ''; }
  game.skipped.clear();
  event(game, 'complete', item, { points: wordPoints + bonus, wordPoints, bonus, multiplier, clean, kind: item.kind });
}

export function typeGameChar(game, raw) {
  const input = String(raw);
  if (!canInput(game) || input.length !== 1 || !/[a-z]/i.test(input)) return false;
  const ch = input.toLowerCase();
  let item = game.locked;
  if (item && !active(item)) { game.locked = null; game.buffer = ''; item = null; }
  if (!item) {
    let candidates = game.items.filter(candidate => active(candidate) && matches(candidate.src.pyPlain[0], ch));
    if (game.skipped.size) {
      const alternatives = candidates.filter(candidate => !game.skipped.has(candidate.id));
      if (alternatives.length) candidates = alternatives; else game.skipped.clear();
    }
    item = candidates.sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!item) { wrong(game); return false; }
    game.locked = item;
    game.buffer = '';
    item.typed = '';
  }
  const expected = item.src.pyPlain[game.buffer.length];
  if (!matches(expected, ch)) { wrong(game, item); return false; }
  game.correctKeys++;
  // Store the target's canonical v for ü even if the compatible u key was accepted.
  game.buffer += expected;
  item.typed = game.buffer;
  updateAccuracy(game);
  event(game, 'shot', item, { ch, buffer: game.buffer });
  if (game.buffer.length === item.src.pyPlain.length) complete(game, item);
  return true;
}

export function changeTarget(game) {
  if (!canInput(game) || !game.locked) return false;
  game.skipped.add(game.locked.id);
  game.locked.typed = '';
  game.locked = null;
  game.buffer = '';
  return true;
}

export function activateFocus(game) {
  if (!canInput(game) || !game.focusCharges || game.focusLeft > 0) return false;
  game.focusCharges = 0;
  game.focusLeft = 4;
  event(game, 'focus', null, { duration: 4 });
  return true;
}

export function setPinyin(game, value) {
  if (game.mode === 'challenge') return false;
  game.showPinyin = !!value;
  if (game.showPinyin) for (const item of game.items) markHint(game, item);
  return true;
}
