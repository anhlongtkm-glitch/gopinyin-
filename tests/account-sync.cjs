'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
  const output=path.resolve('.cache/account-sync.cjs');fs.mkdirSync(path.dirname(output),{recursive:true});
  await require('esbuild').build({entryPoints:['src/shared/storage/account-data.js'],bundle:true,platform:'node',format:'cjs',outfile:output});
  const storage=new Map();
  global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  global.window=new EventTarget();
  Object.defineProperty(global,'navigator',{value:{onLine:true},configurable:true});
  const sync=require(output),db=new Map();let delay, reads=0, writes=0;
  const connection=uid=>({
    from:()=>({select(){return this},eq(){return this},order(){return this},async range(from,to){reads++;return {data:[...db.values()].filter(r=>r.user_id===uid).slice(from,to+1).map(r=>({...r})),error:null}}}),
    async rpc(name,p){
      writes++;
      if(delay){const wait=delay;delay=null;await wait;}
      const key=uid+':'+p.p_record_id,old=db.get(key);
      if((old?.version||0)!==p.p_expected_version)return{data:{conflict:true,record:old},error:null};
      const row={user_id:uid,kind:p.p_kind,record_id:p.p_record_id,payload:p.p_deleted?null:p.p_payload,deleted:p.p_deleted,version:p.p_expected_version+1};
      db.set(key,row);return{data:{conflict:false,record:{...row}},error:null};
    }
  });
  await sync.attachAccountData('one',connection('one'));
  sync.learningStorage.setItem('gp:dailyGoal','20');sync.learningStorage.setItem('cts:ai:key:gemini','secret');await sync.flushAccountData();
  assert.equal(db.get('one:gp:dailyGoal').payload,'20');assert.equal(db.has('one:cts:ai:key:gemini'),false);
  const beforeWrites=writes;
  for(let i=0;i<10;i++)sync.learningStorage.setItem('gp:dailyGoal','20');
  await sync.flushAccountData();assert.equal(writes,beforeWrites);
  const beforeReads=reads;
  await Promise.all(Array.from({length:10},()=>sync.synchronizeAccountData()));assert.equal(reads-beforeReads,1);
  console.log('  PASS sync efficiency: ten unchanged writes use zero RPCs; ten concurrent syncs use one pull');
  let release;delay=new Promise(r=>release=r);
  sync.learningStorage.setItem('gp:dailyGoal','21');const flushing=sync.flushAccountData();
  sync.learningStorage.setItem('gp:dailyGoal','22');
  sync.learningStorage.setItem('gp:bestScore','99');
  release();await flushing;
  assert.equal(db.get('one:gp:bestScore').payload,'99');
  assert.equal(db.get('one:gp:dailyGoal').payload,'22');assert.equal(db.get('one:gp:dailyGoal').version,3);
  db.get('one:gp:dailyGoal').version++;db.get('one:gp:dailyGoal').payload='remote';
  let conflicts=0;sync.setConflictResolver(async()=>{conflicts++;return 'local'});
  sync.learningStorage.setItem('gp:dailyGoal','23');await sync.flushAccountData();
  assert.equal(conflicts,1);assert.equal(db.get('one:gp:dailyGoal').payload,'23');
  db.get('one:gp:dailyGoal').version++;db.get('one:gp:dailyGoal').payload='24';
  sync.setConflictResolver(async()=> 'remote');sync.learningStorage.setItem('gp:dailyGoal','25');await sync.flushAccountData();
  assert.equal(sync.learningStorage.getItem('gp:dailyGoal'),'24');
  sync.learningStorage.removeItem('gp:dailyGoal');await sync.flushAccountData();await sync.pullAccountData();
  assert.equal(sync.learningStorage.getItem('gp:dailyGoal'),null);assert.equal(db.get('one:gp:dailyGoal').deleted,true);
  navigator.onLine=false;sync.learningStorage.setItem('gp:dailyGoal','26');await assert.rejects(()=>sync.flushAccountData());
  navigator.onLine=true;await sync.attachAccountData('two',connection('two'));assert.equal(sync.learningStorage.getItem('gp:dailyGoal'),null);
  await sync.attachAccountData('one',connection('one'));assert.equal(sync.learningStorage.getItem('gp:dailyGoal'),'26');
  sync.detachAccountData();
  for(const count of [100,1000]) {
    for(let i=0;i<count;i++)db.set('benchmark:'+i,{user_id:'benchmark',kind:'kv',record_id:'cts:progress:bench-'+i,payload:JSON.stringify({mainIndex:1,mainOrder:[0],stats:{correct:1}}),deleted:false,version:1});
    const before=reads,start=performance.now();
    await sync.attachAccountData('benchmark',connection('benchmark'));
    assert.equal(sync.listRecordEntries('kv').length,count);
    assert.equal(reads-before,count===100?1:3);
    console.log('  PASS paginated sync '+count+' records: '+(reads-before)+' reads, '+Math.round(performance.now()-start)+'ms (local fixture)');
    sync.detachAccountData();
  }
  console.log('  PASS sync: scoped outbox, write during request, CAS conflict choices, tombstones, reconnect, secret exclusion');
})().catch(e=>{console.error(e);process.exitCode=1;});
