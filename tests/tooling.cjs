'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const p=server.address().port;await new Promise(r=>server.close(r));return p;}
async function eventually(fn,message){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await pause(100);}throw new Error(message);}
(async()=>{
  // A clean source copy proves that ignored/local files are not required to build.
  const clean=fs.mkdtempSync(path.join(os.tmpdir(),'gopinyin-clean-'));
  for(const name of ['src','assets','scripts','package.json','package-lock.json'])fs.cpSync(path.join(root,name),path.join(clean,name),{recursive:true});
  const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH};
  const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const install=spawnSync(process.execPath,[npm,'ci','--no-audit','--no-fund'],{cwd:clean,env,encoding:'utf8',windowsHide:true,timeout:120000});
  assert.equal(install.status,0,install.stderr);
  const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:clean,env,encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(build.status,0,build.stderr);assert(fs.existsSync(path.join(clean,'dist/index.html')));
  console.log('PASS clean checkout: npm ci + build, no hidden/local dependencies');
  const testPort=await port(),url=`http://127.0.0.1:${testPort}/`;
  const dev=spawn(process.execPath,['scripts/dev.mjs','--no-open'],{cwd:root,env:{...env,PORT:String(testPort)},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
  let log='';dev.stdout.on('data',b=>log+=b);dev.stderr.on('data',b=>log+=b);
  const probes=[];
  try {
    await eventually(async()=>(await fetch(url+'__gopinyin')).ok,'Dev server failed: '+log);
    assert((await (await fetch(url)).text()).includes('assets/app.js'));
    for(const target of ['/.env','/server/pro-server.js','/src/index.html','/tests/run.cjs'])assert.equal((await fetch(url+target.slice(1))).status,404);
    console.log('PASS development server: built page served; source/private paths unavailable');
    for(const extension of ['html','js','css']){
      const probe=path.join(root,'src/app',`.__watch_probe.${extension}`);assert(!fs.existsSync(probe));probes.push(probe);
      const before=fs.statSync(path.join(root,'dist/index.html')).mtimeMs;
      fs.writeFileSync(probe,extension==='html'?'<!-- watch probe -->':extension==='css'?'/* watch probe */':'// watch probe');
      await eventually(()=>fs.statSync(path.join(root,'dist/index.html')).mtimeMs>before,`No rebuild for ${extension}`);
      console.log(`PASS watch ${extension}: saving source triggers a completed rebuild`);
    }
    const payload={'gp:marker':'refactor-import-check','cts:progress:fixture':JSON.stringify({mainIndex:2})};
    const response=await fetch(url+'__import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:payload})});
    const {token}=await response.json();assert(token);
    assert.deepEqual((await (await fetch(url+'__import?token='+token)).json()).data,payload);
    assert.equal((await fetch(url+'__import?token='+token)).status,404);
    console.log('PASS import endpoint: payload preserved; token remains single-use');
  } finally {
    for(const probe of probes)fs.unlinkSync(probe);
    if(dev.connected)dev.send('shutdown');
    await Promise.race([new Promise(resolve=>dev.once('exit',resolve)),pause(5000)]);
    if(dev.exitCode===null)dev.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
