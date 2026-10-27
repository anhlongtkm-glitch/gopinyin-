'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startSupabaseFixture } = require('./helpers/supabase-fixture.cjs');
(async () => {
  const fixture = await startSupabaseFixture();
  try {
    Object.assign(process.env, { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', GOPINYIN_SUPABASE_URL: fixture.url, GOPINYIN_SUPABASE_PUBLISHABLE_KEY: fixture.key, AI_KEY_GEMINI: '', AI_KEY_OPENROUTER: '', AZURE_SPEECH_KEY: '' });
    let handler = require('../api/ai');
    assert.equal(handler, require('../api/pron')); assert.equal(handler, require('../api/status'));
    async function request(url, body, token, method = 'POST') {
      const req = Object.assign(new EventEmitter(), { url, body, method, headers: { host: 'localhost', ...(token ? { authorization: 'Bearer ' + token } : {}) }, socket: { remoteAddress: 'test' } });
      const result = { headers: {} };
      const res = { headersSent: false, destroyed: false, setHeader(key, value) { result.headers[key] = value; }, writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); this.headersSent = true; }, end(value) { result.body = JSON.parse(value); } };
      let timer;
      try { await Promise.race([handler(req, res), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Parsed serverless body was not consumed')), 2000); })]); }
      finally { clearTimeout(timer); }
      return result;
    }
    const status = await request('/api/status', undefined, null, 'GET');
    assert.equal(status.status, 200); assert.equal(status.headers['Cache-Control'], 'no-store');
    assert.equal(status.body.accountConfigured, true);
    assert.deepEqual(status.body.services, { gemini: false, openrouter: false, pronunciation: false });
    assert(!JSON.stringify(status.body).includes(fixture.key));
    assert.equal((await request('/api/ai', {}, null)).status, 401);
    const user = await (await fetch(fixture.url + '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: 'serverless@example.test', password: 'password123' }) })).json();
    for (const body of [{ provider: 'invalid', prompt: 'test' }, JSON.stringify({ provider: 'invalid', prompt: 'test' }), Buffer.from('{"provider":"invalid","prompt":"test"}')]) {
      assert.equal((await request('/api/ai', body, user.access_token)).status, 400);
    }
    const unconfigured = await request('/api/ai', { provider: 'gemini', prompt: 'test' }, user.access_token);
    assert.equal(unconfigured.status, 503); assert.equal(unconfigured.body.code, 'ai_not_configured');
    assert.match(unconfigured.body.error, /AI_KEY_GEMINI/);
    assert.equal((await request('/api/ai', { provider: 'gemini', prompt: 'x'.repeat(300000) }, user.access_token)).status, 413);
    assert.equal((await request('/api/pron', {}, user.access_token)).status, 501);
    console.log('  PASS serverless exports do not listen; parsed object/string/buffer bodies and limits work');
    console.log('  PASS public readiness exposes configuration flags only; authentication uses Vercel public env fallback');
    process.env.AI_KEY_GEMINI = 'fixture-key-never-printed';
    delete require.cache[require.resolve('../server/pro-server')];
    handler = require('../server/pro-server');
    const nativeFetch = global.fetch;
    let upstreamCalls = 0, upstreamStatus = 429, upstreamBody;
    global.fetch = async (url, options) => {
      if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return nativeFetch(url, options);
      upstreamCalls++; upstreamBody = JSON.parse(options.body);
      assert.equal(options.headers['x-goog-api-key'], process.env.AI_KEY_GEMINI);
      return upstreamStatus === 200
        ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[{"zh":"茶","py":"chá","vi":"trà"}]' }] } }] }))
        : new Response('{}', { status: upstreamStatus, headers: { 'Retry-After': '17' } });
    };
    try {
      const limited = await request('/api/ai', { prompt: 'từ vựng đồ uống' }, user.access_token);
      assert.equal(limited.status, 429); assert.equal(limited.headers['Retry-After'], '17');
      assert.equal(limited.headers['Access-Control-Expose-Headers'], 'Retry-After');
      assert.equal(upstreamCalls, 1); assert(!JSON.stringify(limited.body).includes(process.env.AI_KEY_GEMINI));
      upstreamStatus = 200;
      const generated = await request('/api/ai', { prompt: 'đồ uống', temperature: .1 }, user.access_token);
      assert.equal(generated.status, 200); assert.match(generated.body.text, /茶/);
      assert.equal(upstreamBody.generationConfig.temperature, .1);
      upstreamStatus = 404;
      assert.equal((await request('/api/ai', { provider: 'gemini', prompt: 'test' }, user.access_token)).status, 502);
      assert.equal(upstreamCalls, 3);
      assert.equal((await request('/api/ai', { prompt: 'test', temperature: 'wrong' }, user.access_token)).status, 400);
      console.log('  PASS AI proxy preserves quota status/retry time, defaults to Gemini, and uses no paid fallback');
    } finally { global.fetch = nativeFetch; }
  } finally { await fixture.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
