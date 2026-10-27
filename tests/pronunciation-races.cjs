'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const output = path.resolve('.cache/pronunciation-races.cjs');
  const fixtures = {
    '../auth/service.js': 'export const requireAccount=async()=>true,isStudyAllowed=()=>true,currentUser=()=>({id:"test"});',
    './assessment.js': 'export const state={PronAssess:{server:()=>new Promise(resolve=>globalThis.pronRace.responses.push(resolve)),local:()=>({score:90})}};',
    './file-transfer.js': 'export const state={isFileProto:()=>false};',
    './lesson.js': 'export const currentItem=()=>{const s=globalThis.pronRace.S;return s.items[s.order[s.index]];};export const nextItem=()=>{};',
    '../../app/routes.js': 'export const navigationVersion=()=>globalThis.pronRace.navigation;',
    './settings.js': 'export const sourceVersion=()=>globalThis.pronRace.source;',
    './tts.js': 'export const cancelPronunciationSample=()=>{};',
    './meter.js': 'export const drawMeter=()=>{};',
    './microphone.js': 'export const state={PronMic:{release(){},cancelPending(){},stopMeter(){},stopRecorder(){}}};',
    './recognition.js': 'export const state={PronAsr:{stop(){},wait:()=>globalThis.pronRace.wait}};',
    './render.js': 'export const renderStats=()=>{},renderHanzi=()=>{},renderResult=()=>{},updateMicLabel=()=>{};',
    './session.js': 'export const state={S:globalThis.pronRace.S,GOOD:80};',
    './storage.js': 'export const state={PronStore:{add:item=>globalThis.pronRace.saved.push(item.id)}};',
    './utils.js': 'export const state={$:()=>null};export const esc=String,toast=()=>{};'
  };
  await require('esbuild').build({ entryPoints: ['src/features/pronunciation/recording.js'], bundle: true, platform: 'node', format: 'cjs', outfile: output, plugins: [{ name: 'recording-race-fixtures', setup(build) {
    build.onResolve({ filter: /\.js$/ }, args => args.importer.replaceAll('\\', '/').endsWith('/pronunciation/recording.js') && fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path] }));
  } }] });
  global.pronRace = { navigation: 1, source: 1, responses: [], saved: [], wait: Promise.resolve(), S: { items: [{ id: 'old' }, { id: 'new' }], order: [0, 1], index: 0, chunks: [], settings: { autoNext: false }, sessionTries: 0 } };
  const recording = require(output), race = global.pronRace;
  const old = recording.finishAssessment('old', 1);
  recording.cancelAssessment(); race.S.index = 1;
  const current = recording.finishAssessment('new', 1);
  race.responses[0]({ score: 90 }); await old;
  assert.equal(race.S.busy, true); assert.deepEqual(race.saved, []);
  race.responses[1]({ score: 95 }); await current;
  assert.deepEqual(race.saved, ['new']); assert.equal(race.S.busy, false);
  console.log('  PASS stale assessment cannot save to a different question or clear a newer assessment busy state');
  race.S.index = 0; race.S.phase = 'recording'; race.S.startedAt = Date.now() - 1000; race.S.hasSpeech = true; race.S.asrText = 'old';
  let release; race.wait = new Promise(resolve => { release = resolve; });
  const stopped = recording.stopRecording('manual');
  recording.cancelAssessment(); race.S.index = 1; race.S.phase = 'idle'; release(); await stopped;
  assert.equal(race.responses.length, 2); assert.deepEqual(race.saved, ['new']);
  console.log('  PASS cancelled speech-recognition wait cannot begin assessment for the next question');
  const asrOutput = path.resolve('.cache/recognition-races.cjs');
  await require('esbuild').build({ entryPoints: ['src/features/pronunciation/recognition.js'], bundle: true, platform: 'node', format: 'cjs', outfile: asrOutput, plugins: [{ name: 'recognition-fixtures', setup(build) {
    build.onResolve({ filter: /\.js$/ }, args => args.importer.replaceAll('\\', '/').endsWith('/pronunciation/recognition.js') && fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path] }));
  } }] });
  global.window = { SpeechRecognition: class { start() {} stop() {} } };
  const recognition = require(asrOutput); recognition.initializePronunciationRecognition();
  const asr = recognition.state.PronAsr;
  asr.start(); const oldRecognizer = race.S.asr;
  asr.start(); const newRecognizer = race.S.asr;
  const result = transcript => ({ resultIndex: 0, results: [Object.assign([{ transcript, confidence: 1 }], { isFinal: true })] });
  oldRecognizer.onresult(result('old')); oldRecognizer.onerror({ error: 'old-error' });
  newRecognizer.onresult(result('new')); asr.stop(); newRecognizer.onresult(result('-final'));
  assert.equal(race.S.asrText, 'new-final'); assert.equal(race.S.asrErr, '');
  asr.cancelPending(); newRecognizer.onresult(result('-cancelled'));
  assert.equal(race.S.asrText, 'new-final');
  console.log('  PASS stale recognizer callbacks are ignored while final results after a normal stop remain accepted');
})().catch(error => { console.error(error); process.exitCode = 1; });
