'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const items = [
  { zh:'茶叶', py:'chá yè', vi:'lá trà' }, { zh:'红茶', py:'hóng chá', vi:'trà đen' },
  { zh:'绿茶', py:'lǜ chá', vi:'trà xanh' }, { zh:'白茶', py:'bái chá', vi:'trà trắng' },
  { zh:'茶水', py:'chá shuǐ', vi:'nước trà' }
];
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage(), errors = [];
    await page.addInitScript(() => Object.defineProperty(window.crypto, 'randomUUID', {value:undefined,configurable:true}));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL, {waitUntil:'networkidle'});
    await register(page, 'AI save flow');
    await page.route('**/api/ai', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(items)})}));
    const open = () => page.evaluate(() => {window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
    await open();
    assert(await page.locator('#aiSaveLesson').isChecked());
    assert(await page.locator('#aiContinue [data-ai-create]').isVisible());
    await page.fill('#aiPrompt','Giao tiếp đời sống hằng ngày');
    await page.selectOption('#aiKind','word');
    await page.uncheck('#aiSaveLesson');
    assert(await page.locator('#aiNameField').isHidden());
    assert(await page.locator('#aiTemporaryHint').isVisible());
    await page.click('#aiStartBtn');
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await page.locator('#appModal.show').count(),0);
    assert.equal(await page.evaluate(() => window.activeDataset),null);
    assert.equal(await page.evaluate(async () => (await window.dbGetAll()).filter(ds=>ds.kind==='ai').length),0);
    console.log('  PASS temporary lessons open directly without saving or showing a modal');

    await open(); await page.check('#aiSaveLesson');
    await page.fill('#aiPrompt','Đồ uống'); await page.fill('#aiLessonName','Bài trà');
    await page.click('#aiStartBtn'); await page.locator('#appCard').waitFor({state:'visible'});
    const id = await page.evaluate(() => window.activeDataset.id);
    assert.equal(await page.evaluate(() => window.activeDataset.name),'Bài trà');
    assert.equal(await page.evaluate(() => window.rows.length),5);
    assert(await page.locator('#aiStudyEdit').isVisible());
    await page.evaluate(() => {window.index=1;window.save();});
    await open();
    assert.equal(await page.locator('#aiContinue article').getAttribute('data-aiid'),id);
    await page.fill('#aiSetSearch','không tồn tại');
    assert.equal(await page.locator('#aiSets article').count(),0);
    assert(await page.locator('#aiContinue article').isVisible());
    await page.fill('#aiSetSearch','Đồ uống');
    assert.equal(await page.locator('#aiSets article').count(),1);
    await page.click('#aiContinue [data-aiact=study]');
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => window.index),1);
    assert.equal(await page.evaluate(() => window.currentRow().zh),items[1].zh);
    console.log('  PASS saved lessons retain their name, progress, recent shortcut and searchable prompt');

    await open(); await page.fill('#aiSetSearch','');
    await page.fill('#aiPrompt','Bài thứ hai'); await page.fill('#aiLessonName','');
    await page.click('#aiStartBtn'); await page.locator('#appCard').waitFor({state:'visible'});
    const second = await page.evaluate(() => window.activeDataset.id);
    assert.equal(await page.evaluate(() => window.activeDataset.name),'Bài thứ hai');
    await open();
    const card = page.locator('#aiSets article').filter({has:page.locator('[data-aiact=rename][data-id="'+id+'"]')});
    await card.locator('[data-aiact=rename]').click();
    await page.fill('#appModalInput','Trà đổi tên'); await page.click('#appModalOk');
    await page.waitForFunction(id => document.querySelector('#aiSets [data-aiid="'+id+'"] h3')?.textContent==='Trà đổi tên', id);
    assert.equal(await page.locator('#aiContinue article').getAttribute('data-aiid'),second);
    await page.waitForFunction(() => document.getElementById('accountSyncStatus').textContent==='Đã đồng bộ');
    await page.reload({waitUntil:'networkidle'}); await open();
    await page.locator('#aiSets [data-id="'+id+'"][data-aiact=study]').click();
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => window.index),1);
    await open();
    await page.locator('#aiSets [data-id="'+id+'"][data-aiact=del]').click();
    await page.click('#appModalOk');
    await page.waitForFunction(id => !document.querySelector('#aiSets [data-aiid="'+id+'"]'),id);
    assert.equal(await page.evaluate(async id => (await window.dbGetAll()).some(ds=>ds.id===id),id),false);
    console.log('  PASS default names, renaming without changing recency, reload and deletion work');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
