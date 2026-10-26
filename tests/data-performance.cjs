'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__localMetrics = { lcp: null, cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__localMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__localMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(process.env.TEST_URL, { waitUntil: 'networkidle' });
    await register(page, 'Data performance learner');
    const info = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'))));
      const source = window.VOCAB_GROUPS.topic[0];
      return { config: window.APP_CONFIG, token: session.access_token, source: source[0], name: source[1] };
    });
    const id = 'vocab:' + info.source;
    const response = await fetch(info.config.SUPABASE_URL + '/rest/v1/rpc/put_learning_record', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: info.config.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + info.token },
      body: JSON.stringify({ p_kind: 'dataset', p_record_id: id, p_payload: { id, name: info.name, builtin: true }, p_expected_version: 0, p_deleted: false })
    });
    assert(response.ok); assert.equal((await response.json()).conflict, false);
    requests.length = 0;
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.getElementById('accountSyncStatus').textContent === 'Đã đồng bộ');
    const header = await page.evaluate(async id => (await window.__gpBridge.dbList()).find(ds => ds.id === id), id);
    assert(header.rowCount > 0); assert.equal(header.rows, undefined);
    for (const view of ['pron', 'ai', 'library']) {
      await page.evaluate(view => window.showView(view), view);
      await page.waitForTimeout(100);
    }
    assert.equal(requests.filter(url => url.includes('/vocab-pack.js')).length, 0);
    await page.click('[data-vsrc="hsk1"]'); await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(requests.filter(url => url.includes('/vocab-pack.js')).length, 0);
    console.log('  PASS dashboard, pickers, AI listing and HSK lesson do not hydrate unrelated topic datasets');
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return { ...window.__localMetrics, domContentLoadedMs: navigation.domContentLoadedEventEnd, loadMs: navigation.loadEventEnd };
    });
    await page.evaluate(() => window.showView('library'));
    await page.click('[data-vtab="topic"].modeBtn');
    await page.locator(`[data-vsrc="${info.source}"]`).click(); await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.rows.length), header.rowCount);
    assert.equal(requests.filter(url => url.includes('/vocab-pack.js')).length, 1);
    const isolated = await page.evaluate(async id => {
      const first = await window.__gpBridge.dbGet(id), original = first.rows[0].zh;
      first.rows[0].zh = 'modified';
      const second = await window.__gpBridge.dbGet(id);
      return second.rows[0].zh === original;
    }, id);
    assert(isolated);
    assert.deepEqual(errors, []);
    console.log('  PASS selected topic hydrates once on demand; separate reads cannot mutate stored rows');
    fs.mkdirSync('.cache/roadmap', { recursive: true });
    fs.writeFileSync('.cache/roadmap/data-performance.json', JSON.stringify({ environment: 'Local Chromium, 390x844, no CPU/network throttling; lab sample, not field Core Web Vitals', ...metrics, eagerVocabRequests: 0, selectedVocabRequests: 1, deferredVocabRawBytes: fs.statSync('assets/vocab-pack.js').size }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
