'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const {register} = require('./helpers/supabase-fixture.cjs');
const initial = [
  ['茶叶','chá yè','lá trà'],['红茶','hóng chá','trà đen'],['绿茶','lǜ chá','trà xanh'],
  ['白茶','bái chá','trà trắng'],['茶水','chá shuǐ','nước trà']
].map(([zh,py,vi])=>({zh,py,vi}));
const extra = [['苹果','píng guǒ','táo'],['西瓜','xī guā','dưa hấu'],['香蕉','xiāng jiāo','chuối'],['葡萄','pú tao','nho'],['草莓','cǎo méi','dâu tây']].map(([zh,py,vi])=>({zh,py,vi}));
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'}); await register(page,'AI request editor');
    let response=initial, hold=false, held=[];
    const respond=(route,items,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?{text:JSON.stringify(items)}:{error:'quota'})});
    await page.route('**/api/ai',route=>{
      requests.push(route.request().postDataJSON());
      if(hold){held.push(route);return;}
      return respond(route,response);
    });
    await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
    await page.selectOption('#aiKind','word'); await page.fill('#aiPrompt','Trà ban đầu');
    await page.click('#aiStartBtn'); await page.locator('#appCard').waitFor({state:'visible'});
    const id=await page.evaluate(()=>window.activeDataset.id);
    await page.evaluate(()=>{window.autoSound=false;window.readOnType=false;});
    await page.click('#aiStudyEdit');
    assert(await page.locator('#aiEditDialog').isVisible());
    await page.fill('#aiEditPrompt',''); await page.click('#aiEditSave');
    assert.equal(await page.locator('#aiEditPrompt').getAttribute('aria-invalid'),'true');
    assert.match(await page.locator('#aiEditError').textContent(),/nhập/);
    await page.keyboard.press('Escape'); await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.activeElement.id),'aiStudyEdit');
    assert.equal(await page.evaluate(()=>window.activeDataset.prompt),'Trà ban đầu');
    console.log('  PASS empty prompts validate inline; Escape cancels and restores focus');

    // Shuffled order means a storage-array slice would keep the wrong rows.
    await page.evaluate(()=>{
      window.order=[4,1,3,0,2];window.mainOrder=[...window.order];window.index=1;window.mainIndex=1;
      window.render();window.save();
    });
    await page.fill('#pinyinInput','红');
    const before=await page.evaluate(()=>({ids:[window.rows[4].id,window.rows[1].id],current:window.currentRow().id,stats:JSON.stringify(window.stats)}));
    hold=true;
    await page.click('#aiStudyEdit'); await page.fill('#aiEditPrompt','Hoa quả ở chợ'); await page.selectOption('#aiEditLevel','HSK 2');
    await page.click('#aiEditSave'); await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.aiSession.pending===1);
    while(!held.length) await delay(10);
    assert.equal(await page.inputValue('#pinyinInput'),'红');
    assert.equal(await page.evaluate(()=>window.currentRow().id),before.current);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.stats)),before.stats);
    assert.deepEqual(await page.evaluate(()=>window.order.map(i=>window.rows[i].id)),before.ids);
    assert.match(requests.at(-1).prompt,/Hoa quả ở chợ/);assert.match(requests.at(-1).prompt,/HSK 2/);
    const route=held.shift(); await respond(route,extra);
    await page.waitForFunction(()=>window.aiSession.pending===0);
    assert.equal(await page.inputValue('#pinyinInput'),'红');
    assert.equal(await page.evaluate(()=>window.rows[window.order[2]].zh),extra[0].zh);
    assert.equal(await page.evaluate(()=>new Set(window.rows.map(row=>row.id)).size),7);
    console.log('  PASS editing shuffled lessons preserves current input, IDs and statistics; new content follows immediately');

    // Start an old prefetch, then edit while it is in flight.
    await page.evaluate(()=>{window.index=4;window.mainIndex=4;window.render();window.save();});
    while(!held.length)await delay(10);
    const old=held.shift(), count=requests.length;
    await page.click('#aiStudyEdit'); await page.fill('#aiEditPrompt','Yêu cầu mới nhất'); await page.click('#aiEditSave');
    await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    assert.equal(requests.length,count,'The old request must release its slot before a new generation starts');
    await respond(old,[initial[2]]);
    while(!held.length)await delay(10);
    assert.equal(requests.length,count+1);
    assert.equal(await page.evaluate(()=>window.rows.some(row=>row.zh==='绿茶')),false);
    await respond(held.shift(),[],429);
    await page.waitForFunction(()=>window.aiSession.stopped&&window.aiSession.pending===0);
    assert(await page.locator('#aiRetryBtn').isVisible());
    assert.equal(await page.evaluate(()=>window.activeDataset.prompt),'Yêu cầu mới nhất');
    assert.equal(await page.evaluate(()=>window.rows.length),5);
    console.log('  PASS stale generation is discarded, one pending slot is retained and quota failure keeps the revised lesson');

    // Local storage failure must roll back BOTH records and runtime.
    await page.click('#aiStudyEdit'); await page.fill('#aiEditPrompt','Không được ghi');
    await page.evaluate(()=>{
      window.__storageSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key.startsWith('gp:account-cache:'))throw new DOMException('quota','QuotaExceededError');return window.__storageSet.call(this,key,value);};
    });
    await page.click('#aiEditSave');
    await page.waitForFunction(()=>document.getElementById('aiEditError').textContent.length>0);
    assert.equal(await page.evaluate(()=>window.activeDataset.prompt),'Yêu cầu mới nhất');
    assert.equal(await page.evaluate(async id=>(await window.dbGetAll()).find(ds=>ds.id===id).prompt,id),'Yêu cầu mới nhất');
    await page.evaluate(()=>{Storage.prototype.setItem=window.__storageSet;});
    await page.click('#aiEditCancel');
    console.log('  PASS storage errors keep the old dataset, progress and input without reporting success');

    // Edit in review mode: main queue changes, active review queue does not.
    await page.evaluate(()=>{
      const row=window.currentRow();window.wrongIds=new Set([row.id]);window.save();window.switchMode('wrong');
    });
    const review=await page.evaluate(()=>({id:window.currentRow().id,order:window.order.map(i=>window.rows[i].id),stats:JSON.stringify(window.stats)}));
    await page.click('#aiStudyEdit');await page.fill('#aiEditPrompt','Sau khi ôn');await page.click('#aiEditSave');
    await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.mode),'wrong');
    assert.deepEqual(await page.evaluate(()=>window.order.map(i=>window.rows[i].id)),review.order);
    assert.equal(await page.evaluate(()=>window.currentRow().id),review.id);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.stats)),review.stats);
    assert.equal(held.length,0);
    console.log('  PASS review order and statistics survive a prompt edit without background generation');

    // Save from the list, reload and continue at the saved cursor.
    hold=false;response=extra;
    await page.evaluate(()=>window.showView('ai'));
    await page.locator('#aiSets [data-aiact=edit]').click();
    await page.fill('#aiEditPrompt','Chủ đề từ danh sách');await page.selectOption('#aiEditLevel','HSK 3');await page.click('#aiEditSave');
    await page.locator('#appCard').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.aiSession?.pending===0);
    assert.equal(await page.evaluate(()=>window.activeDataset.id),id);
    const cursor=await page.evaluate(()=>window.mainIndex);
    await page.waitForFunction(()=>document.getElementById('accountSyncStatus').textContent==='Đã đồng bộ');
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.activeDataset.prompt),'Chủ đề từ danh sách');
    assert.equal(await page.evaluate(()=>window.activeDataset.level),'HSK 3');
    assert.equal(await page.evaluate(()=>window.mainIndex),cursor);
    console.log('  PASS editing from the saved list reopens the same lesson and survives reload with its progress');

    // Completing a current item advances the persisted cursor, but must not keep
    // the NEXT old item when the user edits before pressing Next.
    hold=true;
    await page.evaluate(async items=>{
      window.aiEndSession();
      const ds=window.activeDataset;
      ds.rows=items.map((item,i)=>({...item,id:'boundary-'+i,wv:[]}));
      await window.dbPut(ds);
      window.rows=ds.rows;window.order=[0,1,2,3,4];window.mainOrder=[...window.order];
      window.index=0;window.mainIndex=0;window.mode='all';window.wrongIds=new Set();window.reviewById={};window.awaitingEnter=false;
      window.save();await window.openDataset(ds.id);
    },initial);
    await page.fill('#pinyinInput',initial[0].zh);
    await page.waitForFunction(()=>window.awaitingEnter);
    const completedId=await page.evaluate(()=>window.currentRow().id);
    await page.click('#aiStudyEdit');await page.fill('#aiEditPrompt','Sau mục vừa hoàn thành');await page.click('#aiEditSave');
    await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    while(!held.length)await delay(10);
    assert.equal(await page.evaluate(()=>window.rows.length),1);
    assert.equal(await page.evaluate(()=>window.currentRow().id),completedId);
    assert.equal(await page.evaluate(()=>window.awaitingEnter),true);
    await respond(held.shift(),extra);await page.waitForFunction(()=>window.aiSession.pending===0);
    await page.click('#typingNextBtn');
    assert.equal(await page.evaluate(()=>window.currentRow().zh),extra[0].zh);
    console.log('  PASS edits after a completed answer keep that answer and place new content at Next');

    const exhausted=await page.evaluate(()=>{
      window.index=window.order.length;window.mainIndex=window.index;window.awaitingEnter=false;window.save();window.render();
      return window.rows.map(row=>row.id);
    });
    while(!held.length)await delay(10);
    const exhaustedOld=held.shift();
    await page.click('#aiStudyEdit');await page.fill('#aiEditPrompt','Tiếp tục bài đã hết');await page.click('#aiEditSave');
    await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    assert.deepEqual(await page.evaluate(()=>window.rows.map(row=>row.id)),exhausted);
    await respond(exhaustedOld,[initial[1]]);
    while(!held.length)await delay(10);
    await respond(held.shift(),initial.slice(1));await page.waitForFunction(()=>window.aiSession.pending===0);
    assert.equal(await page.evaluate(()=>window.currentRow().zh),initial[1].zh);
    assert.equal(await page.locator('#pinyinInput').evaluate(el=>el.readOnly),false);
    console.log('  PASS exhausted lessons keep all learned content and resume directly with the new request');
    hold=false;

    // Responsive dialog and form QA, including a 200% equivalent CSS viewport.
    for(const width of [320,390,768,1440,720]){
      for(const theme of ['light','dark']){
        await page.setViewportSize({width,height:844});
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        await page.evaluate(()=>window.showView('ai'));
        await page.locator('#aiSets [data-aiact=edit]').click();
        const geometry=await page.evaluate(()=>{
          const dialog=document.getElementById('aiEditDialog'), r=dialog.getBoundingClientRect();
          return {left:r.left,right:r.right,width:innerWidth,overflow:dialog.scrollWidth>dialog.clientWidth+1,page:document.documentElement.scrollWidth>innerWidth+1};
        });
        assert(geometry.left>=0&&geometry.right<=width+1&&!geometry.overflow&&!geometry.page,JSON.stringify({width,theme,geometry}));
        for(let n=0;n<8;n++){
          await page.keyboard.press('Tab');
          assert(await page.evaluate(()=>document.getElementById('aiEditDialog').contains(document.activeElement)));
        }
        await page.screenshot({path:'.cache/test-run/ai-editor-'+width+'-'+theme+'.png'});
        await page.keyboard.press('Escape');
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:'.cache/test-run/ai-home-'+width+'-'+theme+'.png',fullPage:true});
      }
    }
    assert.deepEqual(errors,[]);
    console.log('  PASS light/dark forms and dialogs fit 320/390/768/1440px and a 200% equivalent viewport');
    for(const height of [568,430]){
      await page.setViewportSize({width:320,height});
      await page.locator('#aiSets [data-aiact=edit]').click();
      await page.locator('#aiEditSave').scrollIntoViewIfNeeded();
      const fits=await page.locator('#aiEditSave').evaluate(button=>{
        const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;
      });
      assert(fits,'The save action must remain reachable in a short viewport');
      await page.keyboard.press('Escape');
    }
    console.log('  PASS short viewports and a simulated keyboard-height reduction keep Save reachable');
    await page.locator('#aiSets [data-aiact=study]').click();await page.locator('#appCard').waitFor({state:'visible'});
    await page.click('#aiStudyEdit');
    await page.evaluate(()=>document.getElementById('wsLogoutBtn').click());
    await page.locator('#aiEditDialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.getElementById('wsUserChip').classList.contains('is-guest'));
    assert.deepEqual(errors,[]);
    console.log('  PASS logout closes the editor and revokes its pending edit');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
