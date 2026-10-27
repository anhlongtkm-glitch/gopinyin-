'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const generated=[
  {zh:'批量',py:'pī liàng',vi:'theo lô, hàng loạt'},
  {zh:'纸箱',py:'zhǐ xiāng',vi:'thùng carton'},
  {zh:'纸板',py:'zhǐ bǎn',vi:'bìa carton'},
  {zh:'工厂',py:'gōng chǎng',vi:'nhà máy'},
  {zh:'打包',py:'dǎ bāo',vi:'đóng gói'}
];
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    // An old saved opt-in must not revive the removed API verification step.
    await page.addInitScript(()=>localStorage.setItem('gp:aiVerify','1'));
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    await register(page,'AI single generation');
    await page.route('**/api/ai',async route=>{
      const body=route.request().postDataJSON();requests.push(body);
      assert(!/CẦN SOÁT|soát lỗi NGHĨA|vi_dung/.test(body.prompt));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(generated)})});
    });
    await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
    await page.click('.aiDetails summary');
    assert.equal(await page.locator('#aiVerify').count(),0);
    assert(!/Soát lại nghĩa/.test(await page.locator('#aiCard').textContent()));
    assert.equal(await page.evaluate(()=>typeof window.aiVerifyMeanings),'undefined');
    console.log('  PASS meaning verification controls and API helpers are removed even with an old opt-in preference');

    await page.selectOption('#aiKind','word');
    await page.fill('#aiPrompt','từ vựng ngành bao bì');
    await page.click('#aiStartBtn');
    await page.locator('#appModal.show').waitFor();
    assert.equal(requests.length,1,'A complete batch must go straight to the save prompt after one generation request');
    await page.click('#appModalCancel');
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>window.rows.map(({zh,py,vi})=>({zh,py,vi}))),generated);
    assert.equal(await page.locator('#vietnamese').textContent(),generated[0].vi);
    console.log('  PASS one generation request provides the complete lesson and original translations without a second AI call');

    const parsed=await page.evaluate(items=>window.parseAiSentences(JSON.stringify([
      ...items,
      {zh:'你好',py:'nǐ',vi:'Xin chào'},
      {zh:'谢谢',py:'xiè xie',vi:''}
    ])),generated);
    assert.deepEqual(parsed,generated);
    assert.equal(requests.length,1);
    console.log('  PASS local formatting checks still reject missing translations or mismatched pinyin without API calls');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
