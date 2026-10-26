'use strict';
// Read-only acceptance checks: no sign-up, provider requests, or user-data writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const args = process.argv.slice(2), base = new URL(args.find(arg => /^https?:/.test(arg)) || 'https://www.gopinyin.io.vn/');
  const report = { checkedAt: new Date().toISOString(), url: base.href, checks: [] };
  const get = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const root = await get(base), html = await root.text();
  assert.equal(root.status, 200); report.checks.push('homepage HTTP 200');
  const assets = [...new Set([...html.matchAll(/assets\/immutable\/app\.[a-f0-9]+\.(?:js|css)/g)].map(match => match[0]))];
  assert.equal(assets.length, 2);
  if (args.includes('--expect-local')) {
    const localHtml = fs.readFileSync('dist/index.html', 'utf8');
    const expected = [...new Set([...localHtml.matchAll(/assets\/immutable\/app\.[a-f0-9]+\.(?:js|css)/g)].map(match => match[0]))];
    assert.deepEqual([...assets].sort(), expected.sort(), 'Production is not serving the assets referenced by the current local build');
  }
  for (const asset of assets) {
    const response = await get(new URL(asset, base)); assert.equal(response.status, 200);
    assert(response.headers.get('cache-control')?.includes('immutable'));
    const body = Buffer.from(await response.arrayBuffer());
    if (args.includes('--expect-local')) assert(body.equals(fs.readFileSync('dist/' + asset)), 'Production asset differs from local build: ' + asset);
  }
  report.assets = assets; report.checks.push('versioned assets HTTP 200, immutable cache');
  const statusResponse = await get(new URL('api/status', base));
  assert(statusResponse.headers.get('content-type')?.includes('application/json'), 'API status must return JSON, not the SPA');
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json(); assert.equal(status.apiVersion, 1);
  report.accountConfigured = status.accountConfigured; report.services = status.services;
  report.checks.push('API readiness returns JSON');
  for (const route of ['api/ai', 'api/pron']) {
    const response = await get(new URL(route, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401, route + ' must reject unauthenticated requests');
    assert(response.headers.get('content-type')?.includes('application/json'));
  }
  report.checks.push('AI/pronunciation reject unauthenticated requests with JSON 401');
  for (const path of ['.env.local', 'server/pro-paid.json', 'server/pro-content.json']) {
    assert.equal((await get(new URL(path, base))).status, 404, 'Private path must not be published: ' + path);
  }
  report.checks.push('private configuration and server data paths return 404');
  if (args.includes('--browser')) {
    const { chromium } = require('playwright-core');
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base.href, { waitUntil: 'networkidle' });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const view of ['library', 'pron', 'ai', 'games', 'rank', 'dash']) {
          await page.click(`.ws-navItem[data-view="${view}"]`);
          await page.waitForTimeout(100);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow in ' + view);
        }
      }
      assert.deepEqual(errors, []); report.checks.push('six public views at 1440px/390px; no overflow or runtime errors');
    } finally { await browser.close(); }
  }
  fs.mkdirSync('.cache/production', { recursive: true });
  fs.writeFileSync('.cache/production/acceptance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error('FAIL production check:', error.message); process.exitCode = 1; });
