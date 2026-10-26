'use strict';
// Local protocol fixture, not a production auth bypass. Production uses the real SDK and server verification.
const http = require('node:http');
const crypto = require('node:crypto');
async function startSupabaseFixture() {
  const users = new Map(), tokens = new Map(), refresh = new Map(), records = new Map(), files = new Map();
  let origin;
  const session = account => {
    const jwt = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const access_token = jwt({ alg:'HS256',typ:'JWT' })+'.'+jwt({ sub:account.user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',email:account.user.email })+'.fixture';
    const refresh_token = crypto.randomUUID();
    tokens.set(access_token, account); refresh.set(refresh_token, account);
    return { access_token, refresh_token, token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:account.user };
  };
  const server = http.createServer(async (req,res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,x-client-info');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const url = new URL(req.url, origin), token=(req.headers.authorization||'').replace(/^Bearer\s+/i,''), account=tokens.get(token);
    const chunks=[];for await(const chunk of req) chunks.push(chunk);const raw=Buffer.concat(chunks);
    let body={};try{body=JSON.parse(raw.toString())}catch{}
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    const denied=()=>json(401,{message:'Invalid account',error_code:'bad_jwt'});
    if(url.pathname==='/auth/v1/signup') {
      if(users.has(body.email)) return json(422,{message:'Email already registered'});
      const id=crypto.randomUUID(),verified=!String(body.email).startsWith('unverified');
      const user={id,email:body.email,role:'authenticated',aud:'authenticated',created_at:new Date().toISOString(),email_confirmed_at:verified?new Date().toISOString():null,user_metadata:body.data||{},app_metadata:{provider:'email'}};
      const a={user,password:body.password,profile:{id,display_name:body.data?.display_name||'Learner',avatar_path:null}};
      users.set(body.email,a);
      return json(200,verified?session(a):user);
    }
    if(url.pathname==='/auth/v1/token') {
      const a=url.searchParams.get('grant_type')==='refresh_token'?refresh.get(body.refresh_token):users.get(body.email);
      if(!a||(url.searchParams.get('grant_type')!=='refresh_token'&&a.password!==body.password))return json(400,{message:'Invalid login credentials',error_code:'invalid_credentials'});
      if(!a.user.email_confirmed_at)return json(400,{message:'Email not confirmed',error_code:'email_not_confirmed'});
      return json(200,session(a));
    }
    if(url.pathname==='/auth/v1/recover') return json(200,{});
    if(url.pathname==='/auth/v1/logout') {tokens.delete(token);return json(200,{});}
    if(url.pathname==='/auth/v1/user') {
      if(!account)return denied();
      if(req.method==='PUT'&&body.password)account.password=body.password;
      return json(200,account.user);
    }
    if(url.pathname==='/rest/v1/profiles') {
      if(!account)return denied();
      const wanted=url.searchParams.get('id')?.replace('eq.','');
      if(wanted!==account.user.id)return json(403,{message:'RLS'});
      if(req.method==='PATCH') {
        if(body.avatar_path&&!body.avatar_path.startsWith(account.user.id+'/'))return json(403,{message:'RLS avatar'});
        Object.assign(account.profile,body);
        return json(200,null);
      }
      return json(200,account.profile);
    }
    if(url.pathname==='/rest/v1/learning_records') {
      if(!account)return denied();
      if(req.method!=='GET')return json(403,{message:'Use versioned RPC'});
      const all=[...records.values()].filter(r=>r.user_id===account.user.id).sort((a,b)=>a.kind.localeCompare(b.kind)||a.record_id.localeCompare(b.record_id));
      const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);
      return json(200,all.slice(offset,offset+limit));
    }
    if(url.pathname==='/rest/v1/rpc/put_learning_record') {
      if(!account)return denied();
      const key=JSON.stringify([account.user.id,body.p_kind,body.p_record_id]),old=records.get(key);
      if((old?.version||0)!==body.p_expected_version)return json(200,{conflict:true,record:old||null});
      const row={user_id:account.user.id,kind:body.p_kind,record_id:body.p_record_id,payload:body.p_deleted?null:body.p_payload,deleted:!!body.p_deleted,version:body.p_expected_version+1,updated_at:new Date().toISOString()};
      records.set(key,row);return json(200,{conflict:false,record:row});
    }
    if(url.pathname==='/rest/v1/rpc/public_rankings') {
      const entries=[];
      for(const a of users.values()) {
        const key=JSON.stringify([a.user.id,'kv',body.p_board==='study'?'gp:lbStudy':'gp:lbGame']);
        const stored=records.get(key);if(!stored||stored.deleted)continue;
        let bucket;try{bucket=JSON.parse(stored.payload)[body.p_scope]?.[body.p_period]?.[a.user.id]}catch{}
        if(bucket)entries.push({id:a.user.id,name:a.profile.display_name,avatar_path:a.profile.avatar_path,correct:bucket.correct||0,score:bucket.score||0});
      }
      return json(200,entries.sort((a,b)=>b.correct-a.correct||b.score-a.score).slice(0,100));
    }
    if(url.pathname.startsWith('/storage/v1/object/public/avatars/')) {
      const file=files.get(decodeURIComponent(url.pathname.split('/avatars/')[1]));
      if(!file)return json(404,{message:'Missing image'});
      res.writeHead(200,{'Content-Type':'image/webp'});return res.end(file);
    }
    if(url.pathname.startsWith('/storage/v1/object/')) {
      if(!account)return denied();
      if(req.method==='DELETE') {
        for(const p of body.prefixes||[]){if(!p.startsWith(account.user.id+'/'))return json(403,{message:'RLS'});files.delete(p);}
        return json(200,[]);
      }
      const p=decodeURIComponent(url.pathname.split('/avatars/')[1]||'');
      if(!p.startsWith(account.user.id+'/'))return json(403,{message:'RLS'});
      files.set(p,raw);return json(200,{Key:'avatars/'+p,Id:crypto.randomUUID()});
    }
    json(404,{message:'Unknown fixture route: '+url.pathname});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  return {url:origin,key:'fixture-publishable-key',users,tokens,records,session,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function register(page,name='Regression learner') {
  await page.click('#wsLoginBtn');
  await page.click('[data-authtab="register"]');
  await page.fill('#authName',name);
  await page.fill('#authEmail','regression-'+crypto.randomUUID()+'@example.test');
  await page.fill('#authPass','password123');
  await page.click('#authSubmit');
  await page.locator('#authModal').waitFor({state:'hidden'});
  if(await page.locator('#legacyImportModal').isVisible())await page.click('#legacySkip');
  await page.waitForFunction(()=>document.getElementById('accountSyncStatus').textContent==='Đã đồng bộ');
}
module.exports={startSupabaseFixture,register};
