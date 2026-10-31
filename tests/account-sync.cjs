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
  const sync=require(output),db=new Map();let delay, pullDelay, reads=0, writes=0, bytes=0;
  const connection=uid=>({
    from:()=>({fields:'*',kind:null,ids:null,select(fields){this.fields=fields;return this},eq(key,value){if(key==='kind')this.kind=value;return this},in(key,values){assert(values.reduce((sum,id)=>sum+encodeURIComponent(JSON.stringify(id)).length+1,0)<=5000);this.ids=values;return this},order(){return this},async range(from,to){
      reads++;
      if(pullDelay){const wait=pullDelay;pullDelay=null;await wait;}
      const data=[...db.values()].filter(r=>r.user_id===uid&&(!this.kind||r.kind===this.kind)&&(!this.ids||this.ids.includes(r.record_id))).slice(from,to+1).map(r=>this.fields==='*'?{...r}:Object.fromEntries(this.fields.split(',').map(key=>[key,r[key]])));
      bytes+=Buffer.byteLength(JSON.stringify(data));return {data,error:null};
    }}),
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
  sync.writeRecords([{kind:'dataset',id:'atomic',payload:{prompt:'old'}},{kind:'kv',id:'cts:progress:atomic',payload:'old-progress'}]);
  await sync.flushAccountData();
  const setItem=global.localStorage.setItem, writesBeforeQuota=writes;
  global.localStorage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>sync.writeRecords([{kind:'dataset',id:'atomic',payload:{prompt:'new'}},{kind:'kv',id:'cts:progress:atomic',payload:'new-progress'}]));
  assert.equal(sync.readRecord('dataset','atomic').prompt,'old');
  assert.equal(sync.readRecord('kv','cts:progress:atomic'),'old-progress');
  global.localStorage.setItem=setItem;
  await sync.flushAccountData();assert.equal(writes,writesBeforeQuota);
  const owned={prompt:'owned'};sync.writeRecord('dataset','atomic',owned);owned.prompt='external mutation';
  assert.equal(sync.readRecord('dataset','atomic').prompt,'owned');
  await sync.flushAccountData();
  console.log('  PASS grouped writes roll back dataset and progress together on quota failure and own their payloads');
  sync.learningStorage.setItem('gp:dailyGoal','20');sync.learningStorage.setItem('cts:ai:key:gemini','secret');await sync.flushAccountData();
  assert.equal(db.get('one:gp:dailyGoal').payload,'20');assert.equal(db.has('one:cts:ai:key:gemini'),false);
  const beforeWrites=writes;
  for(let i=0;i<10;i++)sync.learningStorage.setItem('gp:dailyGoal','20');
  await sync.flushAccountData();assert.equal(writes,beforeWrites);
  const beforeReads=reads;
  await Promise.all(Array.from({length:10},()=>sync.synchronizeAccountData()));assert.equal(reads-beforeReads,1);
  console.log('  PASS sync efficiency: ten unchanged writes use zero RPCs; ten concurrent syncs use one pull');
  let finishPull;pullDelay=new Promise(resolve=>finishPull=resolve);
  const checking=sync.pullAccountData();assert.equal(sync.syncStatus(),'saved');finishPull();await checking;
  console.log('  PASS background version checks keep an already synchronized lesson available');
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
    localStorage.removeItem('gp:account-cache:benchmark');bytes=0;
    for(let i=0;i<count;i++)db.set('benchmark:'+i,{user_id:'benchmark',kind:'kv',record_id:'cts:progress:bench-'+i,payload:JSON.stringify({mainIndex:1,mainOrder:[0],stats:{correct:1}}),deleted:false,version:1});
    const before=reads,start=performance.now();
    await sync.attachAccountData('benchmark',connection('benchmark'));
    assert.equal(sync.listRecordEntries('kv').length,count);
    assert.equal(reads-before,count===100?1:3);
    console.log('  PASS paginated sync '+count+' records: '+(reads-before)+' reads, '+Math.round(performance.now()-start)+'ms (local fixture)');
    const fullBytes=bytes;
    bytes=0;const beforeDelta=reads;let notifications=0;const stop=sync.onDataChange(()=>notifications++);
    await sync.pullAccountData();
    assert.equal(reads-beforeDelta,count===100?1:3);assert.equal(notifications,0);
    assert(bytes < count*160,'Unchanged pull should contain version metadata only');
    const manifestBytes=bytes;bytes=0;
    const row=db.get('benchmark:0');row.version++;row.payload=JSON.stringify({mainIndex:2,stats:{correct:2}});
    await sync.pullAccountData();assert.equal(JSON.parse(sync.learningStorage.getItem('cts:progress:bench-0')).mainIndex,2);
    assert.equal(notifications,1);stop();
    console.log('  PASS version manifest '+count+' records: '+fullBytes+' full bytes -> '+manifestBytes+' unchanged bytes, one changed payload fetched');
    sync.detachAccountData();
  }
  await sync.attachAccountData('long-ids',connection('long-ids'));
  for(let i=0;i<3;i++)db.set('long-ids:'+i,{user_id:'long-ids',kind:'kv',record_id:'cts:progress:'+String.fromCharCode(0x6c49).repeat(280)+i,payload:'value',deleted:false,version:1});
  await sync.pullAccountData();assert.equal(sync.listRecordEntries('kv').length,3);sync.detachAccountData();
  console.log('  PASS changed-record batches bound URL size for long Unicode record IDs');
  await sync.attachAccountData('stale',connection('stale'));
  for(const id of ['cts:progress:first','cts:progress:second'])sync.learningStorage.setItem(id,'initial');
  await sync.flushAccountData();
  for(const id of ['cts:progress:first','cts:progress:second']){
    const row=db.get('stale:'+id);row.version++;row.payload='remote';sync.learningStorage.setItem(id,'local');
  }
  sync.setConflictResolver(async()=>{await sync.attachAccountData('replacement',connection('replacement'));return 'remote';});
  await sync.pullAccountData();
  assert.equal(sync.dataOwner(),'replacement');assert.equal(sync.listRecordEntries('kv').length,0);
  sync.detachAccountData();
  console.log('  PASS account switch during conflict resolution discards the remaining old-account response');
  console.log('  PASS sync: scoped outbox, write during request, CAS conflict choices, tombstones, reconnect, secret exclusion');
})().catch(e=>{console.error(e);process.exitCode=1;});
