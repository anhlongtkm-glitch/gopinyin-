'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

(async () => {
  const built = await esbuild.build({
    absWorkingDir: path.resolve('.'), entryPoints: ['src/features/game/panda-model.js'],
    bundle: true, write: false, platform: 'node', format: 'cjs'
  });
  const loaded = { exports: {} };
  new Function('module', 'exports', built.outputFiles[0].text)(loaded, loaded.exports);
  const { createGame, beginGame, updateGame, typeGameChar, changeTarget, activateFocus, setPinyin, PACING } = loaded.exports;
  const contentBuild = await esbuild.build({
    absWorkingDir: path.resolve('.'), entryPoints: ['src/features/game/panda-content.js'],
    bundle: true, write: false, platform: 'node', format: 'cjs'
  });
  const contentLoaded = { exports: {} };
  new Function('module', 'exports', contentBuild.outputFiles[0].text)(contentLoaded, contentLoaded.exports);
  const { TOPICS, plainPinyin, getTopic } = contentLoaded.exports;
  const check = (name, run) => { run(); console.log('  PASS ' + name); };
  const start = options => { const game = createGame(options); beginGame(game); return game; };
  let fixtureId = 1000;
  function word(game, { text = '爸爸', py = 'baba', kind = 'normal', y = 0.3, hadError = false, lane = 0 } = {}) {
    const item = {
      id: ++fixtureId, src: { id: 'fixture:' + text, word: text, py, pyPlain: py, vi: 'Từ thử' },
      kind, missionIndex: 0, lane, x: lane ? 0.75 : 0.25, y, age: 0, lifeSeconds: 12,
      caught: false, dying: false, dieT: 0, dieDur: 1.4, heart: false, typed: '', hadError, usedHint: false
    };
    game.items = game.items.filter(item => item.dying);
    game.items.push(item); game.locked = null; game.buffer = ''; game.skipped.clear();
    return item;
  }
  function typeWord(game, item) { for (const char of item.src.pyPlain) assert(typeGameChar(game, char)); }

  check('fourteen curated topics each have at least fifty unique vocabulary entries', () => {
    assert.deepEqual(TOPICS.map(topic => topic.id), ['family', 'food', 'drinks', 'school', 'travel', 'shopping', 'animals', 'nature', 'weather', 'body', 'health', 'sports', 'work', 'time']);
    for (const topic of TOPICS) {
      assert(topic.words.length >= 50, topic.id + ' has ' + topic.words.length + ' words');
      assert.equal(new Set(topic.words.map(word => word.id)).size, topic.words.length);
      for (const item of topic.words) {
        assert(item.vi && item.py && /^[\u3400-\u9fff]+$/.test(item.word));
        assert.equal(item.pyPlain, plainPinyin(item.py));
        assert(/^[a-z]+$/.test(item.pyPlain));
      }
    }
    assert.equal(getTopic('missing').id, 'family');
    assert.equal(plainPinyin('nǚ ér'.normalize('NFD')), 'nver');
    assert.equal(plainPinyin('lu:4 cha2'), 'lvcha');
  });

  check('calm pacing provides more reading time, caps active words at two, and never dumps a backlog', () => {
    for (const mode of ['practice','challenge']) {
      const game = start({ mode }); game.lives = 100;
      const born = [];
      for (let i = 0; i < 89 * 60; i++) {
        const before = game.poolIdx;
        updateGame(game, 1 / 60);
        assert(game.items.filter(item => !item.caught).length <= 2);
        if (game.poolIdx !== before) born.push(game.elapsed);
      }
      for (let i = 1; i < born.length; i++) assert(born[i] - born[i - 1] >= PACING[mode].minSpawnGap - 1e-6);
      assert(game.schedule.every(entry => entry.lifeSeconds >= (mode === 'practice' ? 26 : 22)));
      assert(game.schedule.filter(entry => entry.kind === 'normal').length <= 15);
    }
  });

  check('the sixth clean word receives the new capped combo multiplier, not the fifth', () => {
    const game = start();
    for (let index = 0; index < 5; index++) typeWord(game, word(game));
    assert.equal(game.score, 700);
    assert.equal(game.combo, 5);
    assert.equal(game.focusCharges, 1);
    typeWord(game, word(game));
    assert.equal(game.score, 910);
    for (let index = 6; index < 15; index++) typeWord(game, word(game));
    const before = game.score;
    typeWord(game, word(game));
    assert.equal(game.score - before, 420);
    assert.equal(game.bestCombo, 16);
  });

  check('wrong input preserves typed progress, removes combo and attributes the actual word to review', () => {
    const game = start(); const item = word(game);
    game.combo = 12;
    assert(typeGameChar(game, 'b'));
    assert.equal(typeGameChar(game, 'z'), false);
    assert.equal(game.buffer, 'b');
    assert.equal(game.combo, 0);
    assert.equal(item.hadError, true);
    assert.equal(game.review[0].word, '爸爸');
    for (const ch of 'aba') typeGameChar(game, ch);
    assert.equal(game.score, 140);
    assert.equal(game.combo, 0);
    assert.equal(game.correctKeys, 4);
    assert.equal(game.wrongKeys, 1);
    assert.equal(game.accuracy, 80);
    assert.equal(game.review[0].errors, 1);
  });

  check('target changes cycle matching words without deleting valid stats or selecting dying cards', () => {
    const game = start(); const first = word(game, { text: '爸爸', y: 0.8 });
    const second = { ...first, id: ++fixtureId, y: 0.2, lane: 1, x: 0.75, src: { ...first.src, id: 'fixture:second' } };
    game.items.push(second);
    assert(typeGameChar(game, 'b')); assert.equal(game.locked, first);
    assert(changeTarget(game)); assert.equal(game.buffer, '');
    assert(typeGameChar(game, 'b')); assert.equal(game.locked, second);
    assert.equal(game.correctKeys, 2);
    for (const ch of 'aba') typeGameChar(game, ch);
    assert(second.dying);
    assert(typeGameChar(game, 'b')); assert.equal(game.locked, first);
  });

  check('Pinyin can toggle in practice, records hints once per visible target, and is blocked in challenge', () => {
    const game = start(); const item = game.items[0];
    assert.equal(game.showPinyin, false);
    assert(setPinyin(game, true));
    assert.equal(game.hintsUsed, 1);
    assert(setPinyin(game, false)); assert(setPinyin(game, true));
    assert.equal(game.hintsUsed, 1);
    assert.equal(game.review.find(row => row.id === item.src.id).usedHint, true);
    const challenge = start({ mode: 'challenge', showPinyin: true });
    assert.equal(challenge.showPinyin, false);
    assert.equal(setPinyin(challenge, true), false);
    assert.equal(challenge.showPinyin, false);
    assert.equal(challenge.hintsUsed, 0);
  });

  check('ü can use v or compatible u without permitting pasted words or nonletters', () => {
    const game = start(); const item = word(game, { text: '女儿', py: 'nver' });
    for (const input of ['Enter', 'Shift', 'a\n', 'nihao', '你', '', ' ']) assert.equal(typeGameChar(game, input), false);
    assert.equal(game.correctKeys + game.wrongKeys, 0);
    for (const char of 'nuer') assert(typeGameChar(game, char));
    assert(item.caught);
    assert.equal(game.correctKeys, 4);
  });

  check('gold and mission bonuses are bounded and awarded once', () => {
    const game = start(); const gold = word(game, { kind: 'gold' });
    typeWord(game, gold);
    assert.equal(game.score, 340); assert.equal(game.goldScore, 200);
    const afterGold = game.score;
    typeGameChar(game, 'a');
    assert.equal(game.score, afterGold);
    const dirtyGold = word(game, { kind: 'gold' });
    typeGameChar(game, 'b'); typeGameChar(game, 'z');
    for (const ch of 'aba') typeGameChar(game, ch);
    assert.equal(game.goldScore, 200);
    assert.equal(dirtyGold.hadError, true);
    for (let index = 0; index < 3; index++) typeWord(game, word(game, { kind: 'mission' }));
    assert.equal(game.missionDone, 3); assert.equal(game.missionComplete, true);
    assert.equal(game.missionScore, 500);
    typeGameChar(game, 'a');
    assert.equal(game.missionScore, 500);
    assert.equal(game.score, game.wordScore + game.goldScore + game.missionScore);
  });

  check('focus slows card travel for four seconds while match time still advances', () => {
    const normal = start({ seed: 'focus-check' });
    const slow = start({ seed: 'focus-check' });
    normal.lives = slow.lives = 100;
    slow.focusCharges = 1;
    assert(activateFocus(slow)); assert.equal(activateFocus(slow), false);
    updateGame(normal, 4); updateGame(slow, 4);
    assert.equal(normal.elapsed, slow.elapsed);
    assert(slow.items[0].y < normal.items[0].y * 0.6);
    assert(slow.focusLeft < 1e-8);
    assert.equal(slow.focusCharges, 0);
  });

  check('same seed produces the same schedule and state across different frame rates', () => {
    const one = start({ seed: 'equal-seed' }), two = start({ seed: 'equal-seed' });
    one.lives = two.lives = 100;
    updateGame(one, 23.5);
    for (let index = 0; index < 1410; index++) updateGame(two, 1 / 60);
    assert.deepEqual(one.schedule, two.schedule);
    assert.equal(one.elapsed, two.elapsed);
    assert.deepEqual(one.items, two.items);
    assert.equal(one.missed, two.missed);
    assert.notDeepEqual(one.schedule, start({ seed: 'different-seed' }).schedule);
  });

  check('a miss on the final life ends once, never makes lives negative, and rejects later input', () => {
    const game = start(); const item = word(game, { y: 0.999 });
    game.lives = 1;
    updateGame(game, 0.1);
    assert.equal(game.lives, 0); assert.equal(game.running, false); assert.equal(game.over, true);
    assert.equal(game.finishReason, 'lives'); assert.equal(game.missed, 1);
    assert(game.review.find(row => row.id === item.src.id).reasons.includes('missed'));
    const snapshot = [game.score, game.correctKeys, game.wrongKeys, game.elapsed];
    assert.equal(typeGameChar(game, 'b'), false);
    assert.equal(activateFocus(game), false);
    assert.equal(changeTarget(game), false);
    updateGame(game, 20);
    assert.deepEqual([game.score, game.correctKeys, game.wrongKeys, game.elapsed], snapshot);
    assert.equal(game.events.filter(event => event.type === 'finish').length, 1);
    assert.equal(game.accuracy, null);
  });

  check('review flights use only validated topic words and count distinct words separately from repeats', () => {
    const family = getTopic('family'), food = getTopic('food');
    const id = family.words[0].id;
    const game = start({ topicId:'family', mode:'challenge', showPinyin:true, reviewWordIds:[id, id, food.words[0].id, 'missing'] });
    assert.equal(game.isReview, true);
    assert.equal(game.mode, 'practice');
    assert.deepEqual(game.pool.map(row => row.id), [id]);
    assert(game.schedule.every(row => row.src.id === id));
    for (let round = 0; round < 2; round++) {
      let target = game.items.find(row => !row.caught);
      for (let tries = 0; !target && tries < 10; tries++) { updateGame(game, .5); target = game.items.find(row => !row.caught); }
      assert(target);
      typeWord(game, target);
    }
    assert.equal(game.wordsDone, 2);
    assert.deepEqual(game.completedWordIds, [id]);
    const invalid = createGame({ topicId:'family', reviewWordIds:[food.words[0].id] });
    assert.equal(invalid.isReview, false);
    assert(invalid.pool.every(row => row.id.startsWith('family:')));
  });

  check('the ninety-second clock ends exactly and pause never silently consumes time', () => {
    const game = start(); game.lives = 100;
    game.paused = true; updateGame(game, 8); assert.equal(game.elapsed, 0);
    assert.equal(typeGameChar(game, 'a'), false);
    game.paused = false; updateGame(game, 90);
    assert.equal(game.elapsed, 90); assert.equal(game.stage, 3);
    assert.equal(game.finishReason, 'time'); assert.equal(game.over, true);
    assert.equal(game.accuracy, null);
    assert.equal(game.events.filter(event => event.type === 'finish').length, 1);
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
