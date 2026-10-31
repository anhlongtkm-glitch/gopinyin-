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
    const page=await browser.newPage(),errors=[],requests=[],accountRequests=[];
    let responseItems=generated, responseStatus=200;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      if (/\/auth\/v1\/user|\/rest\/v1\/learning_records/.test(request.url())) accountRequests.push(request.url());
    });
    // An old saved opt-in must not revive the removed API verification step.
    await page.addInitScript(()=>localStorage.setItem('gp:aiVerify','1'));
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    await register(page,'AI single generation');
    await page.route('**/api/ai',async route=>{
      const body=route.request().postDataJSON();requests.push(body);
      assert.match(route.request().headers().authorization,/^Bearer /,'Proxy requests must still carry an account token');
      assert(!/CẦN SOÁT|soát lỗi NGHĨA|vi_dung/.test(body.prompt));
      await route.fulfill({status:responseStatus,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(responseItems),error:responseStatus===401?'expired session':undefined})});
    });
    await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
    await page.click('.aiDetails summary');
    assert.equal(await page.locator('#aiVerify').count(),0);
    assert(!/Soát lại nghĩa/.test(await page.locator('#aiCard').textContent()));
    assert.equal(await page.evaluate(()=>typeof window.aiVerifyMeanings),'undefined');
    console.log('  PASS meaning verification controls and API helpers are removed even with an old opt-in preference');

    await page.selectOption('#aiKind','word');
    await page.fill('#aiPrompt','từ vựng ngành bao bì');
    accountRequests.length=0;
    await page.uncheck('#aiSaveLesson');
    await page.click('#aiStartBtn');
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(requests.length,1,'A complete batch must open study directly after one generation request');
    assert.equal(accountRequests.filter(url=>url.includes('/auth/v1/user')).length,1,'Only the initial study gate should revalidate the account');
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

    // No study render here: observe only the generation path, without progress
    // saves or background UI work contributing unrelated sync requests.
    accountRequests.length=0;
    const beforeFastBatch=requests.length;
    const fastBatch=await page.evaluate(()=>window.aiCollect('gemini','','fast lesson',5,'',new Set(),null,'word'));
    assert.equal(fastBatch.items.length,5);
    assert.equal(requests.length,beforeFastBatch+1);
    assert.equal(accountRequests.length,0,'An active proxy lesson must not wait on redundant Auth or learning-record pulls');
    console.log('  PASS active proxy generation sends one AI request with no extra Auth or account-data round trips');

    let directCalls=0;
    await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
      directCalls++;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'direct fixture'}}]})});
    });
    for(const standalone of [false,true]) {
      accountRequests.length=0;
      const direct=await page.evaluate(async standalone=>{
        window.APP_CONFIG.AI_PROXY_URL=false;
        try {
          return await (standalone?window.callOpenRouter('fixture-key','direct fixture',0.9):window.callAi('openrouter','fixture-key','direct fixture'));
        } finally {window.APP_CONFIG.AI_PROXY_URL='/api/ai';}
      },standalone);
      assert.equal(direct,'direct fixture');
      assert.equal(accountRequests.filter(url=>url.includes('/auth/v1/user')).length,1,'Personal-key calls still need one remote account check');
    }
    assert.equal(directCalls,2);
    console.log('  PASS personal-key requests and standalone helpers retain exactly one account verification');

    responseItems=[generated[0],generated[0],generated[1],{zh:'你好',py:'nǐ',vi:'Invalid incomplete Pinyin'}];
    const beforePartial=requests.length;
    const partial=await page.evaluate(()=>window.aiCollect('gemini','','partial lesson',5,'',new Set(),null,'word'));
    assert.equal(partial.items.length,2);
    assert.equal(requests.length,beforePartial+1,'A useful partial batch must return before a top-up request');
    assert.deepEqual(partial.items,generated.slice(0,2));
    console.log('  PASS a partial batch starts immediately, removes duplicates, and still filters malformed Pinyin locally');

    responseItems=generated;
    const bounded=await page.evaluate(()=>{
      const seen=new Set(Array.from({length:200},(_,i)=>'old-item-'+i));
      return window.aiCollect('gemini','','long lesson',5,'',seen,null,'word');
    });
    assert.equal(bounded.items.length,5);
    assert(!requests.at(-1).prompt.includes('old-item-0 |'));
    assert(requests.at(-1).prompt.includes('old-item-199'));
    responseItems=[generated[0],generated[1]];
    const beforeOldDuplicate=requests.length;
    const duplicate=await page.evaluate(item=>{
      const seen=new Set([item,...Array.from({length:200},(_,i)=>'old-item-'+i)]);
      return window.aiCollect('gemini','','long lesson',5,'',seen,null,'word');
    },generated[0].zh);
    assert.deepEqual(duplicate.items,[generated[1]],'Older items omitted from the prompt must still be rejected locally');
    assert.equal(requests.length,beforeOldDuplicate+1);
    console.log('  PASS long lessons bound prompt history while deduplicating against the complete lesson');

    responseItems=[];
    const beforeEmpty=requests.length;
    const empty=await page.evaluate(()=>window.aiCollect('gemini','','empty lesson',5,'',new Set(),null,'word'));
    assert.equal(empty.items.length,0);
    assert.equal(requests.length,beforeEmpty+2,'Unusable output has only one additional attempt');
    responseStatus=401;
    const beforeDenied=requests.length;
    const denied=await page.evaluate(async()=>{
      try {await window.callAiProxy('gemini','expired token');return false;}
      catch(error){return error.status===401;}
    });
    assert(denied,'Proxy authentication failures must remain failures');
    assert.equal(requests.length,beforeDenied+1);
    console.log('  PASS unusable output has a bounded retry and server authentication rejection is preserved');

    let delayed;
    await page.route('**/api/ai',route=>{delayed=route;});
    await page.evaluate(()=>{
      window.__lateAi=window.callAi('gemini','','late response').then(()=>false,()=>true);
    });
    for(let i=0;i<100&&!delayed;i++)await page.waitForTimeout(10);
    assert(delayed);
    await page.evaluate(()=>document.getElementById('wsLogoutBtn').click());
    await page.locator('#wsLoginBtn').waitFor({state:'visible'});
    await delayed.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(generated)})});
    assert(await page.evaluate(()=>window.__lateAi),'A response arriving after logout must not be accepted');
    delayed=null;
    const guestDenied=await page.evaluate(async()=>{
      try {await window.callAiProxy('gemini','guest request');return false;}
      catch {return true;}
    });
    assert(guestDenied);assert.equal(delayed,null,'A guest must not send any AI request');
    console.log('  PASS logout invalidates pending results and guests cannot use the optimized proxy path');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
