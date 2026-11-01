'use strict';
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
(async () => {
  const built = await esbuild.build({ entryPoints:['src/features/game/panda-renderer.js'], bundle:true, write:false, platform:'node', format:'cjs' });
  const mod = { exports:{} }; new Function('module','exports',built.outputFiles[0].text)(mod, mod.exports);
  const { shipGeometry, aimAngle, cardEdge, createPandaRenderer } = mod.exports;
  const close = (a,b) => assert(Math.abs(a-b) < .001, `${a} != ${b}`);
  for (const [width,height] of [[900,600],[390,280],[768,440]]) {
    for (const direction of [-1,1]) {
      const target = { x:width * (direction < 0 ? .25 : .75), y:height * .25 };
      const center = shipGeometry(width,height).center, angle = aimAngle(center,target);
      assert.equal(Math.sign(angle),direction);
      const muzzle = shipGeometry(width,height,angle).muzzle;
      close((muzzle.x-center.x)*(target.y-center.y)-(muzzle.y-center.y)*(target.x-center.x),0);
      assert(muzzle.y < center.y);
      const edge = cardEdge(muzzle,target,140,88);
      close(Math.max(Math.abs(edge.x-target.x)/70,Math.abs(edge.y-target.y)/44),1);
    }
  }
  console.log('  PASS muzzle and target edge align with left/right headings across desktop and mobile sizes');
  let reduced = false;
  global.matchMedia = () => ({ matches:reduced }); global.devicePixelRatio = 2;
  let width = 900, height = 600;
  const arcs = [], texts = [], laserLines = [], props = {};
  let path = [];
  const ctx = new Proxy({
    measureText:t => ({ width:t.length*8 }), arc:(...args) => arcs.push(args),
    beginPath:() => { path=[]; }, moveTo:(x,y) => { path.push([x,y]); }, lineTo:(x,y) => { path.push([x,y]); },
    stroke:() => { if (ctx.strokeStyle === 'rgba(105,229,194,0.9)' && path.length === 2) laserLines.push(path); },
    fillText:(text,x,y) => texts.push({text,x,y,alpha:ctx.globalAlpha}),
    roundRect:(x,y,w,h,r) => assert(w>=0&&h>=0&&r>=0,'Canvas roundRect dimensions and radius must stay nonnegative')
  }, { get:(obj,key) => obj[key] ?? (() => {}) });
  const canvas = { style:{}, parentElement:{ getBoundingClientRect:() => ({width,height}) }, getContext:() => ctx };
  const player = { style:{setProperty:(key,value) => {props[key]=value;}} };
  const renderer = createPandaRenderer(canvas,player); renderer.resize();
  assert.equal(canvas.width,1800); assert.equal(canvas.height,1200);
  const item = { id:1, x:.75, y:.2, kind:'normal', typed:'b', src:{word:'爸爸',vi:'Bố',py:'bàba',pyPlain:'baba'} };
  const game = { items:[item], locked:item, showPinyin:true, running:true, paused:false, over:false };
  renderer.draw(game,0,0);
  assert.equal(laserLines.length,1,'typing must show a steady laser aimed at the locked word');
  const targetPoint={x:675,y:144.2}, laserEnd=laserLines[0][1];
  close(Math.max(Math.abs(laserEnd[0]-targetPoint.x)/90,Math.abs(laserEnd[1]-targetPoint.y)/59),1);
  laserLines.length=0;
  renderer.receive([{type:'shot',itemId:1,x:item.x,y:item.y}]);
  renderer.draw(game,0,.16);
  const angle = parseFloat(props['--pd-ship-angle'])*Math.PI/180;
  const center = shipGeometry(width,height).center;
  const target = {x:675,y:144.2};
  close(angle,aimAngle(center,target));
  const recoil = Number(props['--pd-ship-recoil']);
  assert(recoil > 0, 'a shot must move the ship backwards');
  const muzzle = shipGeometry(width,height,angle,recoil).muzzle;
  const edge = cardEdge(muzzle,target,180,118), p = .16/.18;
  const bullet = arcs.find(a => a[2] === 2.5); assert(bullet);
  close(bullet[0],muzzle.x+(edge.x-muzzle.x)*p); close(bullet[1],muzzle.y+(edge.y-muzzle.y)*p);
  assert(texts.some(entry=>entry.text==='bàba'));
  console.log('  PASS real renderer launches from the rotated sprite nose, stops at card edge and uses canonical Pinyin');
  const peak = recoil;
  for (let i=0;i<30;i++) renderer.draw(game,200+i*16,1/60);
  assert(Number(props['--pd-ship-recoil']) < peak * .01);
  assert(Number(props['--pd-recoil-y'].replace('px','')) >= 0);
  console.log('  PASS firing kicks the ship backwards along its aim and recovers smoothly without drifting');
  const lasersBeforeCompletion=laserLines.length;
  item.dying=true; item.dieT=.26; texts.length=0;
  renderer.receive([{type:'complete',itemId:1,x:item.x,y:item.y,word:'爸爸',vi:'Bố',py:'bàba',points:140,kind:'normal'}]);
  renderer.draw(game,200,.5);
  const floating=texts.find(entry=>entry.text==='爸爸');
  assert(floating&&floating.y<targetPoint.y&&floating.alpha>0,'completed Hanzi should float upward while fading');
  assert(texts.some(entry=>entry.text==='Bố')&&texts.some(entry=>entry.text==='bàba'),'floating card should preserve the Vietnamese meaning and Pinyin');
  texts.length=0; renderer.draw(game,1700,1.5);
  assert(!texts.some(entry=>entry.text==='爸爸'),'completed Hanzi should disappear after two seconds');
  renderer.draw(game,2000,.1); assert(!texts.some(entry=>entry.text==='爸爸'));
  assert.equal(laserLines.length,lasersBeforeCompletion,'completed targets should stop receiving the laser');
  width=390; height=280; reduced=true; renderer.clear(); renderer.resize();
  item.dying=false; game.locked=item;
  renderer.draw(game,300,0); assert(parseFloat(props['--pd-ship-angle'])>0);
  renderer.receive([{type:'shot',itemId:1,x:item.x,y:item.y}]); renderer.draw(game,301,.016);
  assert.equal(Number(props['--pd-ship-recoil']),0);
  assert.equal(canvas.width,780); assert.equal(canvas.height,560);
  game.locked=null; renderer.draw(game,301,0); assert.equal(parseFloat(props['--pd-ship-angle']),0);
  console.log('  PASS completed cards dissolve at 250ms; resize and reduced motion retain accurate aiming');
  width=0; height=0; game.focusLeft=4; renderer.resize(); renderer.draw(game,400,0);
  console.log('  PASS Focus rendering survives a temporarily zero-sized stage during viewport or fullscreen transitions');
})().catch(error => { console.error(error); process.exitCode=1; });
