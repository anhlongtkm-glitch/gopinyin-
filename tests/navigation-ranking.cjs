'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const source=file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.resolve(file),'utf8')).toString('base64'));
(async()=>{
  const {rankedEntries,personalStanding,periodDetails}=await source('src/features/ranking/model.js');
  const tied=rankedEntries([{id:'a',correct:9},{id:'b',correct:9},{id:'c',correct:4},{id:'c',correct:4},{id:'z',correct:-1}],'c');
  assert.deepEqual(tied.map(e=>e.place),[1,1,3]);
  assert.equal(personalStanding(tied,'c','week').gap,6);
  assert.equal(personalStanding(tied,'a','day').gap,null);
  assert.equal(personalStanding(tied,'absent','week').me,undefined);
  assert.equal(periodDetails('week',new Date(2026,10,1,12)).label,'26/10 – 01/11');
  assert.equal(periodDetails('week',new Date(2026,10,2,0)).label,'02/11 – 08/11');
  console.log('  PASS ranking ties, nearest higher score, absent users and weekly boundaries');
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    assert(await page.locator('#libraryCard').isVisible());assert.equal(await page.locator('#dashView,#readingsCard').count(),0);
    assert.equal(await page.locator('[data-view="dash"],[data-view="readings"],[data-mobile-view="dash"],[data-more-view="readings"]').count(),0);
    await page.click('.ws-navItem[data-view="topics"]');
    assert.match(page.url(),/#\/topics$/);assert.equal(await page.locator('#hskLevelPicker').isVisible(),false);
    assert((await page.locator('#vocabList [data-vsrc]').count())>100);
    await page.fill('#vocabSearch','gia');
    const topicsCount=await page.locator('#vocabList [data-vsrc]').count();assert(topicsCount>0);
    await page.click('.ws-navItem[data-view="practice"]');assert.match(page.url(),/#\/hsk$/);
    assert.equal(await page.inputValue('#vocabSearch'),'');assert(await page.locator('#hskLevelPicker').isVisible());
    await page.fill('#vocabSearch','HSK 2');
    await page.click('.ws-navItem[data-view="topics"]');assert.equal(await page.inputValue('#vocabSearch'),'gia');
    assert.equal(await page.locator('#vocabList [data-vsrc]').count(),topicsCount);
    await page.goBack();assert.equal(await page.inputValue('#vocabSearch'),'HSK 2');
    for(const retired of ['dash','readings','shadow']){
      await page.goto(new URL('#/'+retired,process.env.TEST_URL).href,{waitUntil:'networkidle'});
      await page.waitForURL('**/#/hsk');assert(await page.locator('#libraryCard').isVisible());
    }
    console.log('  PASS separate HSK/topic routes and search, Back and retired-page redirects');
    await register(page,'Bạn học thử nghiệm');
    const me=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')))).user.id);
    await page.evaluate(()=>window.showView('topics'));
    const topicId=await page.locator('#vocabList [data-vsrc]').first().getAttribute('data-vsrc');
    await page.evaluate(async topicId=>{
      const rows=[{id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'},{id:1,zh:'谢谢。',py:'xiè xie',vi:'Cảm ơn.'}];
      await window.dbPut({id:'vocab:'+topicId,name:'Chủ đề đang học',rows,updatedAt:Date.now()});
      await window.dbPut({id:'practice:hsk1-context',name:'Chặng HSK đang học',rows,updatedAt:Date.now()});
      await window.openDataset('vocab:'+topicId);window.markSentenceCorrect();
    },topicId);
    await page.waitForFunction(()=>document.querySelector('#accountSyncStatus').textContent==='Đã đồng bộ');
    await page.reload({waitUntil:'networkidle'});await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await page.locator('#libraryCard').getAttribute('data-library-group'),'topic');
    await page.evaluate(async()=>{await window.openDataset('practice:hsk1-context');window.markSentenceCorrect();await window.showView('topics');});
    await page.waitForFunction(topicId=>document.querySelector('#libraryResumeButton').dataset.resumeId==='vocab:'+topicId,topicId);
    await page.evaluate(()=>window.showView('hsk'));
    await page.waitForFunction(()=>document.querySelector('#libraryResumeButton').dataset.resumeId==='practice:hsk1-context');
    console.log('  PASS direct topic study links restore their parent and each catalog resumes only its own lessons');
    let mode='normal',delayDay=false;
    const weekRows=[{id:'a',name:'An Nhiên',correct:80},{id:'b',name:'Minh Anh',correct:80},{id:'c',name:'Người học với tên rất dài để kiểm tra bố cục',correct:60},{id:me,name:'Bạn học thử nghiệm',correct:40},{id:'e',name:'Khánh Linh',correct:35},{id:'f',name:'<img src=x onerror=alert(1)>',correct:20},{id:'g',name:'Hoàng Nam',correct:10}];
    await page.route('**/rest/v1/rpc/public_rankings',async route=>{
      const scope=route.request().postDataJSON().p_scope;
      if(delayDay&&scope==='day')await new Promise(r=>setTimeout(r,400));
      if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Unavailable"}'});
      const rows=mode==='empty'?[]:mode==='outside'?Array.from({length:100},(_,i)=>({id:'outside-'+i,name:'Người học '+i,correct:200-i})):scope==='week'?weekRows:[{id:me,name:'Bạn học thử nghiệm',correct:2}];
      await route.fulfill({contentType:'application/json',body:JSON.stringify(rows)});
    });
    await page.click('.ws-navItem[data-view="rank"]');await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('.rankTab.active').textContent(),'Tuần này');
    assert.deepEqual(await page.locator('#studyRankList .rankNo').allTextContents(),['1','1','3','4','5','6','7']);
    assert.match(await page.locator('#studyRankMe').textContent(),/21 câu đúng/);
    assert.equal(await page.locator('#studyRankList img').count(),0);
    await page.click('#rankNearMe');assert.equal(await page.locator('#studyRankList .rankRow').count(),5);
    assert.equal(await page.locator('#studyRankList .isMe').count(),1);
    await page.click('#rankNearMe');
    mode='error';await page.click('#rankRefresh');await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#studyRankStatus').textContent(),/trước đó/);assert.equal(await page.locator('#studyRankList .rankRow').count(),7);
    mode='normal';delayDay=true;await page.click('[data-rank="day"]');await page.click('[data-rank="week"]');
    await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    await page.waitForTimeout(500);assert.equal(await page.locator('#studyRankList .rankRow').count(),7);
    mode='outside';await page.click('#rankRefresh');await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#studyRankMe').textContent(),/chưa có tên trong top 100/);assert.equal(await page.locator('.rankPersonalPlace').textContent(),'—');
    mode='empty';await page.click('#rankRefresh');await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    assert(await page.locator('.rankEmpty').isVisible());assert.equal(await page.locator('#studyRankTable').isVisible(),false);
    mode='normal';await page.click('#rankRefresh');await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
    console.log('  PASS populated rankings, safe names, personal gap, nearby filter, stale-request protection and truthful cache/empty/top100 states');
    fs.mkdirSync(path.resolve('.cache/navigation-ranking'),{recursive:true});
    for(const theme of ['dark','light'])for(const width of [360,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      for(const view of ['hsk','topics','rank']){
        await page.evaluate(view=>window.showView(view),view);
        if(view==='rank')await page.waitForFunction(()=>document.querySelector('#rankCard').getAttribute('aria-busy')==='false');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+width+' '+view);
        if(width===390||width===1440)await page.screenshot({path:path.resolve('.cache/navigation-ranking/'+theme+'-'+width+'-'+view+'.png'),fullPage:true});
      }
      if(theme==='dark')assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(2, 4, 3)');
    }
    await page.setViewportSize({width:390,height:844});await page.click('[data-mobile-view="topics"]');
    assert.equal(await page.locator('[data-mobile-view="topics"]').getAttribute('aria-current'),'page');
    await page.click('#mobileMoreBtn');assert.equal(await page.locator('[data-more-view="readings"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('  PASS deep dark palette, five responsive widths in both themes, mobile navigation and no runtime errors');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
