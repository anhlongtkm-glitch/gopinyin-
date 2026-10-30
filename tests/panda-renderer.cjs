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
  const arcs = [], texts = [], props = {};
  const ctx = new Proxy({ measureText:t => ({ width:t.length*8 }), arc:(...args) => arcs.push(args), fillText:t => texts.push(t), roundRect:(x,y,w,h,r) => assert(w>=0&&h>=0&&r>=0,'Canvas roundRect dimensions and radius must stay nonnegative') }, { get:(obj,key) => obj[key] ?? (() => {}) });
  const canvas = { style:{}, parentElement:{ getBoundingClientRect:() => ({width,height}) }, getContext:() => ctx };
  const player = { style:{setProperty:(key,value) => {props[key]=value;}} };
  const renderer = createPandaRenderer(canvas,player); renderer.resize();
  assert.equal(canvas.width,1800); assert.equal(canvas.height,1200);
  const item = { id:1, x:.75, y:.2, kind:'normal', typed:'b', src:{word:'爸爸',vi:'Bố',py:'bàba',pyPlain:'baba'} };
  const game = { items:[item], locked:item, showPinyin:true };
  renderer.receive([{type:'shot',itemId:1,x:item.x,y:item.y}]);
  renderer.draw(game,0,.16);
  const angle = parseFloat(props['--pd-ship-angle'])*Math.PI/180;
  const center = shipGeometry(width,height).center;
  const target = {x:675,y:144.2};
  close(angle,aimAngle(center,target));
  const muzzle = shipGeometry(width,height,angle).muzzle;
  const edge = cardEdge(muzzle,target,180,118), p = .16/.28;
  const bullet = arcs.find(a => a[2] === 2.5); assert(bullet);
  close(bullet[0],muzzle.x+(edge.x-muzzle.x)*p); close(bullet[1],muzzle.y+(edge.y-muzzle.y)*p);
  assert(texts.includes('bàba'));
  console.log('  PASS real renderer launches from the rotated sprite nose, stops at card edge and uses canonical Pinyin');
  item.dying=true; item.dieT=.26; texts.length=0;
  renderer.draw(game,200,.1); assert(!texts.includes('爸爸'));
  width=390; height=280; reduced=true; renderer.clear(); renderer.resize();
  item.dying=false; game.locked=item;
  renderer.draw(game,300,0); assert(parseFloat(props['--pd-ship-angle'])>0);
  assert.equal(canvas.width,780); assert.equal(canvas.height,560);
  game.locked=null; renderer.draw(game,301,0); assert.equal(parseFloat(props['--pd-ship-angle']),0);
  console.log('  PASS completed cards dissolve at 250ms; resize and reduced motion retain accurate aiming');
  width=0; height=0; game.focusLeft=4; renderer.resize(); renderer.draw(game,400,0);
  console.log('  PASS Focus rendering survives a temporarily zero-sized stage during viewport or fullscreen transitions');
})().catch(error => { console.error(error); process.exitCode=1; });
