'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const root=path.resolve(__dirname,'..');
const suites=['app_regress.js','study_shell.js','pronounce.js','pron_picker_d.js','verify_pron_studied.js','games_hub.js','read_on_type.js','space_key.js','ai_save_flow.js','ai_meaning_check.js','ai_vocab_mode.js'];
const output=path.join(root,'.cache/test-run');
async function freePort(){const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));return port;}
function run(file,env){return new Promise(resolve=>{const child=spawn(process.execPath,[path.join(root,'tests',file)],{cwd:root,env,windowsHide:true});let text='';child.stdout.on('data',b=>text+=b);child.stderr.on('data',b=>text+=b);const timer=setTimeout(()=>child.kill(),180000);child.on('error',e=>{text+=e.message;});child.on('close',code=>{clearTimeout(timer);fs.writeFileSync(path.join(output,file+'.log'),text);const result={file,code,passed:(text.match(/^\s*PASS\s/gm)||[]).length,failed:(text.match(/^\s*FAIL\s/gm)||[]).length};console.log(`${code===0&&!result.failed?'PASS':'FAIL'} ${file}: ${result.passed} passed, ${result.failed} failed`);resolve(result);});});}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const {build}=await import('../scripts/build.mjs');await build();
  const port=await freePort(),url=`http://127.0.0.1:${port}/`;
  const server=spawn(process.execPath,[path.join(root,'server/serve.js'),'--no-open'],{cwd:root,env:{...process.env,PORT:String(port),GP_BUILD_READY:'1'},windowsHide:true,stdio:'pipe'});
  let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
  try {
    let ready=false;
    for(let i=0;i<100;i++){try{const response=await fetch(url+'__gopinyin');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    if(!ready)throw new Error('Test server failed: '+serverLog);
    const env={...process.env,TEST_URL:url};
    const results=[];let cursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(cursor<suites.length){const file=suites[cursor++];results.push(await run(file,env));}}));
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
    const failed=results.filter(r=>r.code!==0||r.failed);
    console.log(`${results.reduce((s,r)=>s+r.passed,0)} checks passed; ${failed.length} suites failed. Logs: .cache/test-run/`);
    if(failed.length)process.exitCode=1;
  } finally {server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
