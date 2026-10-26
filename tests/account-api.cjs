'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const {startSupabaseFixture}=require('./helpers/supabase-fixture.cjs');
(async()=>{
  const fixture=await startSupabaseFixture();
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const server=spawn(process.execPath,['server/pro-server.js'],{env:{...process.env,PORT:String(port),SUPABASE_URL:fixture.url,SUPABASE_PUBLISHABLE_KEY:fixture.key,WEBHOOK_SECRET:'',AI_KEY_GEMINI:'',AI_KEY_OPENROUTER:'',AZURE_SPEECH_KEY:''},windowsHide:true,stdio:'pipe'});
  try {
    const url='http://127.0.0.1:'+port;
    for(let i=0;i<60;i++){try{if((await fetch(url+'/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
    const signup=await(await fetch(fixture.url+'/auth/v1/signup',{method:'POST',body:JSON.stringify({email:'api@example.test',password:'password123'})})).json();
    for(const route of ['/api/ai','/api/pron']) {
      assert.equal((await fetch(url+route,{method:'POST',body:'{}'})).status,401);
      assert.equal((await fetch(url+route,{method:'POST',headers:{Authorization:'Bearer forged'},body:'{}'})).status,401);
    }
    const headers={Authorization:'Bearer '+signup.access_token};
    assert.equal((await fetch(url+'/api/ai',{method:'POST',headers,body:'{}'})).status,500);
    assert.equal((await fetch(url+'/api/pron',{method:'POST',headers,body:'{}'})).status,501);
    fixture.tokens.delete(signup.access_token);
    assert.equal((await fetch(url+'/api/pron',{method:'POST',headers,body:'{}'})).status,401);
    for(const route of ['/pro/status','/pro/content','/webhook'])assert.equal((await fetch(url+route)).status,404);
    console.log('  PASS API verification: missing, forged and revoked tokens rejected; verified user reaches retained services');
  } finally {server.kill();await fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
