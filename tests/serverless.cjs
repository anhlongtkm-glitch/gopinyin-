'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startSupabaseFixture } = require('./helpers/supabase-fixture.cjs');
(async () => {
  const fixture = await startSupabaseFixture();
  try {
    Object.assign(process.env, { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', GOPINYIN_SUPABASE_URL: fixture.url, GOPINYIN_SUPABASE_PUBLISHABLE_KEY: fixture.key, AI_KEY_GEMINI: '', AI_KEY_OPENROUTER: '', AZURE_SPEECH_KEY: '' });
    const handler = require('../api/ai');
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
    assert.equal((await request('/api/ai', { provider: 'gemini', prompt: 'test' }, user.access_token)).status, 500);
    assert.equal((await request('/api/ai', { provider: 'gemini', prompt: 'x'.repeat(300000) }, user.access_token)).status, 413);
    assert.equal((await request('/api/pron', {}, user.access_token)).status, 501);
    console.log('  PASS serverless exports do not listen; parsed object/string/buffer bodies and limits work');
    console.log('  PASS public readiness exposes configuration flags only; authentication uses Vercel public env fallback');
  } finally { await fixture.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
