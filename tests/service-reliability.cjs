'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { startSupabaseFixture } = require('./helpers/supabase-fixture.cjs');

(async () => {
  const nativeFetch = global.fetch;
  const output = path.resolve('.cache/assessment-unit.cjs');
  await require('esbuild').build({
    entryPoints: ['src/features/pronunciation/assessment.js'], outfile: output, bundle: true, platform: 'node', format: 'cjs',
    plugins: [{ name: 'assessment-dependencies', setup(build) {
      build.onResolve({ filter: /\.js$/ }, args => {
        if (!args.importer.endsWith('pronunciation/assessment.js') && !args.importer.endsWith('pronunciation\\assessment.js')) return;
        if (args.path.includes('auth/service')) return { path: 'auth', namespace: 'fixture' };
        if (['./repository.js', './session.js', './wav.js', './utils.js'].includes(args.path)) return { path: args.path, namespace: 'fixture' };
      });
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
        auth: 'export async function accessToken(){return "test-token";}',
        './session.js': 'export const state=globalThis.pronTestState;',
        './repository.js': 'export const state={PronRepo:{syllables:item=>item.py.split(" ")}};',
        './wav.js': 'export const state={PronWav:{encode:async blob=>blob,toBase64:()=>"test-audio"}};',
        './utils.js': 'export const hanChars=s=>Array.from(s).filter(c=>/\\p{Script=Han}/u.test(c)); export const toneOf=()=>0;'
      }[args.path] }));
    } }]
  });
  global.window = {}; global.location = { href: 'http://localhost/' }; global.pronTestState = { S: {}, GOOD: 80 };
  const assessment = require(output); assessment.initializePronunciationAssessment();
  const api = assessment.state.PronAssess, item = { zh: '你好世界', py: 'nǐ hǎo shì jiè' };
  const result = api.fromServer(item, { pronScore: 90, words: [{ text: '你好', accuracy: 92 }, { text: '世', accuracy: 60 }, { text: '界', accuracy: 85 }] });
  assert.deepEqual(result.chars.map(c => c.score), [92, 92, 60, 85]);
  const omitted = api.fromServer(item, { pronScore: 80, words: [{ text: '你好', accuracy: 90 }, { text: '界', accuracy: 70 }] });
  assert.deepEqual(omitted.chars.map(c => c.score), [90, 90, null, 70]);
  console.log('  PASS pronunciation aligns multi-character words and missing characters without shifting scores');
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(JSON.stringify({ ok: true, pronScore: 90, words: [{ text: '你好世界', accuracy: 90 }] }), { status: calls === 1 ? 502 : 200 }); };
  assert.equal(await api.server(item, new Blob(['test'])), null);
  assert.equal(await api.server(item, new Blob(['test'])), null); assert.equal(calls, 1);
  pronTestState.S.serverAssess.retryAt = Date.now() - 1;
  assert.equal((await api.server(item, new Blob(['test']))).score, 90); assert.equal(calls, 2);
  console.log('  PASS temporary assessment failure backs off and recovers in the same session');
  // Restore native fetch before exercising the real HTTP server.
  global.fetch = nativeFetch;
  const httpOutput = path.resolve('.cache/http-unit.cjs');
  await require('esbuild').build({ entryPoints: ['src/shared/http.js'], outfile: httpOutput, bundle: true, platform: 'node', format: 'cjs' });
  const signal = require(httpOutput).timeoutSignal(10);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(signal.aborted, true);
  console.log('  PASS service deadline aborts after its configured timeout');
  const fixture = await startSupabaseFixture();
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server/pro-server.js'], {
    env: { ...process.env, PORT: String(port), SUPABASE_URL: fixture.url, SUPABASE_PUBLISHABLE_KEY: fixture.key, AZURE_SPEECH_KEY: 'test-no-upstream-call', USER_RATE_PER_MINUTE: '4' }, windowsHide: true, stdio: 'ignore'
  });
  try {
    const url = 'http://127.0.0.1:' + port;
    let ready = false;
    for (let i = 0; i < 60; i++) { try { if ((await fetch(url + '/health')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    assert(ready);
    const signup = async email => (await fetch(fixture.url + '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'password123' }) })).json();
    const first = await signup('rate-one@example.test'), second = await signup('rate-two@example.test');
    const request = token => fetch(url + '/api/pron', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '{}' });
    for (let i = 0; i < 4; i++) assert.equal((await request(first.access_token)).status, 400);
    const limited = await request(first.access_token); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
    assert.equal((await request(second.access_token)).status, 400);
    console.log('  PASS service quota counts each request once and isolates users sharing an IP');
  } finally { child.kill(); await fixture.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
