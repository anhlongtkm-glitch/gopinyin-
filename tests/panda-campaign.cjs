'use strict';
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
async function load(entry) {
  const built = await esbuild.build({ entryPoints:[entry], bundle:true, write:false, platform:'node', format:'cjs' });
  const module = { exports:{} }; new Function('module','exports',built.outputFiles[0].text)(module,module.exports); return module.exports;
}
(async () => {
  const c = await load('src/features/game/panda-campaign.js'), m = await load('src/features/game/panda-model.js');
  let progress = {};
  for (const level of c.LEVELS) {
    const id = level.topics[0], topic = c.getCampaignTopic(id);
    assert(topic.words.length >= 50 && topic.words.length <= 70);
    assert.equal(new Set(topic.words.map(word => word.word)).size,topic.words.length);
    assert(c.levelUnlocked(progress,level.id));
    if (level.id < c.LEVELS.length) assert(!c.levelUnlocked(progress,level.id+1));
    const game = m.createGame({campaign:true,topicId:id,showPinyin:true}); m.beginGame(game);
    const phrases=[];
    for (let tick=0; game.running && tick<12000; tick++) {
      for (const item of game.items.filter(item=>!item.caught)) {
        if (item.kind === 'phrase') {
          const known = new Set([...game.knownWordIds,...game.completedWordIds]);
          assert(game.bonusSentences.some(sentence=>sentence.tiles.map(tile=>tile.word).join('')===item.src.word && sentence.tiles.every(tile=>known.has(tile.id))));
          phrases.push(item.src.word);
        }
        for (const char of item.src.pyPlain) m.typeGameChar(game,char);
      }
      m.updateGame(game,.1);
    }
    assert.equal(game.finishReason,'level');
    assert.equal(game.spawnedWordIds.length,topic.words.length);
    assert.equal(new Set(game.spawnedWordIds).size,topic.words.length);
    assert.equal(game.completedWordIds.length,topic.words.length);
    assert.equal(new Set(phrases).size,phrases.length);
    assert.equal(game.phraseScore,phrases.length*400);
    progress=c.recordLevel(progress,id,game.completedWordIds,game.settledWordIds);
    assert(c.levelPassed(progress,id));
    const replay=m.createGame({campaign:true,topicId:id,knownWordIds:c.levelProgress(progress,id).learned,processedWordIds:c.levelProgress(progress,id).processed});
    assert.equal(replay.pool.length,0);
    progress=JSON.parse(JSON.stringify(progress));
  }
  console.log('  PASS all 14 levels contain 50–70 unique words, emit each once, apply learned-only sentences and unlock in order');
  const first=c.getCampaignTopic('family'), partial=first.words.slice(0,11).map(word=>word.id);
  let saved=c.recordLevel({},'family',partial.slice(0,9),partial);
  const resumed=m.createGame({campaign:true,topicId:'family',knownWordIds:c.levelProgress(saved,'family').learned,processedWordIds:c.levelProgress(saved,'family').processed});
  assert.equal(resumed.pool.length,first.words.length-partial.length);
  assert(resumed.schedule.filter(row=>row.kind==='normal').every(row=>!partial.includes(row.src.id)));
  const legacy={family:{learned:partial.slice(0,3),boss:true},'family-2':{learned:partial.slice(3),boss:true}};
  assert.equal(c.levelProgress(legacy,'family').learned.length,partial.length);
  assert.equal(c.levelProgress(legacy,'family').processed.length,partial.length);
  console.log('  PASS resumed levels exclude completed and missed words, and preserve existing learning records');
  const idle=m.createGame({campaign:true,topicId:'family'}); m.beginGame(idle);
  for (let tick=0; idle.running && tick<1200; tick++) m.updateGame(idle,1);
  assert.equal(idle.finishReason,'level'); assert.equal(idle.lives,3);
  assert.equal(new Set(idle.spawnedWordIds).size,idle.totalWords);
  assert.equal(idle.settledWordIds.length,idle.totalWords);
  assert.equal(idle.review.length,idle.totalWords);
  console.log('  PASS missed words do not loop or end learning early; the level has no ninety-second cutoff');
  const rapid=m.createGame({campaign:true,topicId:'family'});m.beginGame(rapid);
  for(let count=0;count<rapid.totalWords && rapid.running;count++){
    const item=rapid.items.find(item=>!item.caught&&!item.dying);
    assert(item,'fast typing must not leave the player waiting for the old schedule');
    for(const char of item.src.pyPlain)m.typeGameChar(rapid,char);
    if(!rapid.running)break;
    const at=rapid.elapsed;
    m.updateGame(rapid,.3);
    assert(!rapid.items.some(item=>!item.caught&&!item.dying),'retain a short transition after completion');
    rapid.paused=true;m.updateGame(rapid,5);assert(Math.abs(rapid.elapsed-(at+.3))<1e-9);
    rapid.paused=false;m.updateGame(rapid,.1);
    assert(rapid.items.some(item=>!item.caught&&!item.dying),'the next word must arrive within 400ms');
    assert(rapid.elapsed-at<.41,'refilling must not advance the game clock');
    assert(rapid.items.filter(item=>!item.caught&&!item.dying).length<=2);
  }
  assert.equal(new Set(rapid.spawnedWordIds).size,rapid.spawnedWordIds.length);
  console.log('  PASS clearing the screen brings the next target within 350–400ms, preserves pause and never duplicates words');
  if (!process.env.TEST_URL) return;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.addEventListener('gp:account-ready',()=>{window.campaignAccountReady=true;});
    const Audio=window.AudioContext||window.webkitAudioContext;
    window.pandaAudioNodes=0;
    if (Audio) { const create=Audio.prototype.createOscillator; Audio.prototype.createOscillator=function(...args){window.pandaAudioNodes++;return create.apply(this,args);}; }
  });
  const out=path.resolve('.cache/panda-simple');fs.mkdirSync(out,{recursive:true});
  try {
    await page.goto(process.env.TEST_URL);await register(page,'Simple game');await page.evaluate(()=>window.showView('game'));
    assert.equal(await page.locator('[data-mode],#pdReadyPinyin,.pdRules,.pdLessonBrief,[data-pd="boss"]').count(),0);
    assert.equal(await page.locator('#gaOverlay button').count(),2);
    assert(await page.locator('#gaStartBtn').isVisible());
    await page.screenshot({path:path.join(out,'mobile-ready.png')});
    await page.click('[data-pd="levels"]');
    assert.equal(await page.locator('[data-topic]').count(),14);
    assert(await page.locator('[data-topic="drinks"]').isDisabled());
    await page.click('[data-topic="family"]');await page.click('#gaStartBtn');await page.waitForFunction(()=>window.__game._state.running);
    const audioBefore=await page.evaluate(()=>window.pandaAudioNodes);
    await page.evaluate(()=>{
      const g=window.__game._state,item=g.items.find(item=>!item.caught);
      for(const char of item.src.pyPlain)window.__game.typeChar(char);
    });
    assert((await page.evaluate(()=>window.pandaAudioNodes))>audioBefore);
    await page.evaluate(()=>window.showView('games'));await page.evaluate(()=>window.showView('game'));await page.click('[data-pd="resume-flight"]');
    await page.evaluate(()=>{
      const api=window.__game,g=api._state;
      for(let tick=0;g.running&&tick<2500;tick++){
        for(const item of g.items.filter(item=>!item.caught))for(const char of item.src.pyPlain)api.typeChar(char);
        api._update(.25);
      }
    });
    await page.locator('.pdPanel--result').waitFor({state:'visible'});
    assert.match(await page.locator('#gaOverlay').innerText(),/Hoàn thành level/);
    const stats=await page.evaluate(()=>({spawned:window.__game._state.spawnedWordIds,total:window.__game._state.totalWords}));
    assert.equal(stats.spawned.length,new Set(stats.spawned).size);assert.equal(stats.spawned.length,stats.total);
    await page.screenshot({path:path.join(out,'mobile-complete.png')});
    await page.click('[data-pd="next-topic"]');assert.equal(await page.evaluate(()=>window.__game._state.topicId),'drinks');
    await page.reload();await page.waitForFunction(()=>window.__game&&window.campaignAccountReady);
    if(await page.locator('#authModal').isVisible())await page.click('#authModal .modalClose');
    await page.evaluate(()=>window.showView('game'));await page.click('[data-pd="levels"]');
    assert(await page.locator('[data-topic="family"]').isDisabled());assert(await page.locator('[data-topic="drinks"]').isEnabled());
    console.log('  PASS simple two-button start, single-pass gameplay, audio, level completion and saved unlocks work on mobile');
    await page.click('[data-topic="drinks"]');
    for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:950}]){
      await page.setViewportSize(viewport);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(viewport.width>viewport.height)await page.locator('#gaStartBtn').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,viewport.width+'-ready.png')});
      assert(await page.locator('#gaStartBtn').evaluate(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(hit===button||button.contains(hit));}));
    }
    assert.deepEqual(errors,[]);
    console.log('  PASS ready screen fits small phones, landscape and desktop without browser errors');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
