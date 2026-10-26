'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

(async () => {
  const output = path.resolve('.cache/progress-restore');
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ entryPoints: ['src/features/typing/progress-normalization.js'], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(output, 'normalize.cjs') });
  const { normalizeProgress } = require(path.join(output, 'normalize.cjs'));
  const emptyStats = { correct: 0, wrong: 0, combo: 0, bestCombo: 0, attempts: 0 };
  const stats = { correct: 5, wrong: 2, combo: 3, bestCombo: 4, attempts: 7 };
  const saved = { mainOrder: [2, 0, 3, 1], mainIndex: 2, stats };
  const restored = normalizeProgress(saved, 4);
  assert.deepEqual(restored, saved);
  assert.notEqual(restored.mainOrder, saved.mainOrder);
  assert.notEqual(restored.stats, stats);
  assert.equal(normalizeProgress({ ...saved, mainIndex: 4 }, 4).mainIndex, 4);
  console.log('  PASS valid partial and completed lessons retain their order, position and statistics');

  assert.deepEqual(normalizeProgress({ mainOrder: [1, 0], mainIndex: 2, stats }, 4), { mainOrder: [1, 0, 2, 3], mainIndex: 2, stats });
  assert.equal(normalizeProgress({ mainOrder: [1, 0], mainIndex: 999 }, 4).mainIndex, 2);
  console.log('  PASS appended questions remain unanswered even when an imported cursor exceeds the old order');

  assert.deepEqual(normalizeProgress({ mainOrder: [0, 0, 2], mainIndex: 2 }, 3), { mainOrder: [0, 2, 1], mainIndex: 1, stats: emptyStats });
  assert.deepEqual(normalizeProgress({ mainOrder: [9, 2, 2, -1, 0, '1', null], mainIndex: 5 }, 4), { mainOrder: [2, 0, 1, 3], mainIndex: 2, stats: emptyStats });
  assert.deepEqual(normalizeProgress({ mainOrder: [3, 2, 1, 0], mainIndex: 3 }, 2), { mainOrder: [1, 0], mainIndex: 1, stats: emptyStats });
  console.log('  PASS duplicate, invalid and deleted row indices are removed without skipping unfinished rows');

  for (const mainIndex of [-10, NaN, Infinity, -Infinity, 'broken', {}, [], true]) {
    assert.equal(normalizeProgress({ mainOrder: [0, 1, 2], mainIndex }, 3).mainIndex, 0);
  }
  assert.equal(normalizeProgress({ mainOrder: [0, 1, 2], mainIndex: '2' }, 3).mainIndex, 2);
  assert.equal(normalizeProgress({ mainOrder: [0, 1, 2], mainIndex: 1.9 }, 3).mainIndex, 1);
  console.log('  PASS restored positions are finite bounded integers and legacy numeric strings remain usable');

  assert.deepEqual(normalizeProgress({ mainOrder: [0], stats: { correct: -3, wrong: Infinity, combo: '4', attempts: NaN } }, 1).stats, { ...emptyStats, combo: 4, bestCombo: 4 });
  assert.deepEqual(normalizeProgress({ mainOrder: [0], stats: { correct: '6.8', wrong: {}, combo: true, bestCombo: -2, attempts: 1e100 } }, 1).stats, { ...emptyStats, correct: 6, attempts: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(normalizeProgress({ mainOrder: [0] }, 1).stats, emptyStats);
  assert.deepEqual(normalizeProgress({ mainOrder: [0], stats: null }, 1).stats, emptyStats);
  console.log('  PASS missing or corrupt statistics reset per field without negative values, NaN or inherited counters');

  for (const value of [null, false, 'broken', [], { mainOrder: {} }, { mainOrder: [] }, { mainOrder: [-1, 99], mainIndex: 2, stats }]) {
    assert.deepEqual(normalizeProgress(value, 2), { mainOrder: null, mainIndex: 0, stats: emptyStats });
  }
  assert.deepEqual(normalizeProgress({ mainOrder: [], mainIndex: 10 }, 0), { mainOrder: [], mainIndex: 0, stats: emptyStats });
  console.log('  PASS unusable saved orders start a fresh lesson instead of restoring unrelated statistics');

  const stubs = {
    '../auth/service.js': 'export const requireAccount=async()=>true,currentUser=()=>({id:"learner"});',
    '../../app/routes.js': 'export const navigationVersion=()=>1,markNavigation=()=>1,writeRoute=()=>{};',
    '../../app/navigation.js': 'export const showView=async()=>{};',
    '../../data/catalog.js': 'export const state={VOCAB_GROUPS:{hsk:[]}};',
    '../ai/session.js': 'export const aiEndSession=()=>{};',
    './controls.js': 'export const updateSoundUI=()=>{},updateReadTypeUI=()=>{},updateViUI=()=>{},updateHanUI=()=>{},updateModeUI=()=>{};',
    './history.js': 'export const loadHistory=()=>{},renderAppHistory=()=>{};',
    './progress.js': 'export const resetSessionRuntime=()=>{},loadProgress=id=>globalThis.__progressRestoreTest.saved.get(id);',
    './render.js': 'export const render=()=>{};',
    './session.js': 'export const state=globalThis.__progressRestoreTest.state;',
    '../../shared/audio/tts.js': 'export const populateVoiceSelect=()=>{};',
    '../../shared/dom.js': 'export const state={$:()=>globalThis.__progressRestoreTest.element};',
    '../../shared/storage/lesson-repository.js': 'export const dbList=async()=>[],dbGet=async id=>globalThis.__progressRestoreTest.datasets.get(id),progressKey=id=>"cts:progress:"+id;',
    '../../shared/utils.js': 'export const shuffle=order=>order.reverse(),escapeHtml=String;'
  };
  await esbuild.build({
    entryPoints: ['src/features/typing/datasets.js'], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(output, 'datasets.cjs'),
    plugins: [{ name: 'lesson-runtime-fixture', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path] }));
    } }]
  });
  const element = { classList: { contains: () => true, add() {}, remove() {} }, value: '' };
  global.document = { body: element };
  const rows = Array.from({ length: 3 }, (_, id) => ({ id }));
  const fixture = global.__progressRestoreTest = { state: {}, element, datasets: new Map(['one', 'two', 'new'].map(id => [id, { id, rows }])), saved: new Map() };
  fixture.saved.set('one', { mainOrder: [2, 0, 1], mainIndex: 1, stats, showHanzi: false });
  fixture.saved.set('two', { mainOrder: [0, 0, 2], mainIndex: 2, wrongIds: {}, reviewById: [] });
  const { openDataset } = require(path.join(output, 'datasets.cjs'));
  await openDataset('one');
  assert.deepEqual(fixture.state.stats, stats);
  await openDataset('two');
  assert.deepEqual(fixture.state.stats, emptyStats);
  assert.deepEqual(fixture.state.order, [0, 2, 1]);
  assert.equal(fixture.state.index, 1);
  assert.equal(fixture.state.wrongIds.size, 0);
  assert.deepEqual(fixture.state.reviewById, {});
  console.log('  PASS switching datasets uses normalized state and malformed review/wrong lists cannot break opening');
  fixture.state.showHanzi = false;
  await openDataset('new');
  assert.deepEqual(fixture.state.stats, emptyStats);
  assert.deepEqual(fixture.state.order, [2, 1, 0]);
  assert.equal(fixture.state.index, 0);
  assert.equal(fixture.state.showHanzi, true);
  console.log('  PASS a fresh lesson resets both statistics and Hanzi visibility from the preceding lesson');
})().catch(error => { console.error(error); process.exitCode = 1; });
