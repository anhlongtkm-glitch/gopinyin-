/* ═══════════════════════════════════════════════════════════════
   GOPINYIN — LỚP GIAO DIỆN & TRẢI NGHIỆM MỚI
   - SFX engine (WebAudio, không cần file âm thanh)
   - Xác thực đăng nhập (localStorage — sẵn sàng nối backend)
   - Nâng cấp Pro + thanh toán Vietcombank (QR)
   - Mục nhận mặt chữ Hán (mới)
   - Landing page, dashboard, hiệu ứng
   Phụ thuộc: data.js (HSK_DATA, GAME_WORD_VI, HANZI_WORDS...),
              app-core.js (fixPinyin, splitPinyinSyllables, hanziSegment,
                           setLibTab, renderLibrary, toggleTheme, toast...)
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LS={
  users:'gp:users', user:'gp:user', pro:'gp:pro', proPlan:'gp:proPlan',
  goal:'gp:dailyGoal', daily:'gp:daily', streak:'gp:streak', best:'gp:bestScore', seenLanding:'gp:seenLanding'
};
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}catch(e){}};
const $h=(sel,root)=>(root||document).querySelector(sel);
const $$=(sel,root)=>Array.from((root||document).querySelectorAll(sel));

/* ═══════════════ SFX ENGINE — âm thanh tổng hợp, ấn tượng ═══════════════ */
const Sfx=(function(){
  let ctx=null,enabled=true;
  function ac(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();}
    if(ctx.state==='suspended')ctx.resume();
    return ctx;
  }
  function tone(o){
    if(!enabled)return;
    const c=ac();if(!c)return;
    const t0=c.currentTime+(o.delay||0);
    const osc=c.createOscillator(),g=c.createGain();
    osc.type=o.type||'sine';
    osc.frequency.setValueAtTime(o.f,t0);
    if(o.f2)osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.f2),t0+(o.dur||.15));
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(o.v||.16,t0+.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+(o.dur||.15));
    osc.connect(g);g.connect(c.destination);
    osc.start(t0);osc.stop(t0+(o.dur||.15)+.05);
  }
  function noise(dur,vol,delay){
    if(!enabled)return;
    const c=ac();if(!c)return;
    const t0=c.currentTime+(delay||0);
    const buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const src=c.createBufferSource();src.buffer=buf;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;
    const g=c.createGain();g.gain.value=vol||.12;
    src.connect(f);f.connect(g);g.connect(c.destination);
    src.start(t0);
  }
  return {
    unlock(){ac();},
    setEnabled(v){enabled=v;},
    isEnabled(){return enabled;},
    click(){tone({f:660,f2:520,dur:.07,type:'triangle',v:.1});},
    hover(){tone({f:880,dur:.04,type:'sine',v:.035});},
    tap(){tone({f:520,f2:760,dur:.09,type:'triangle',v:.12});},
    pop(){tone({f:300,f2:900,dur:.14,type:'sine',v:.16});},
    correct(combo){
      const base=523.25*Math.pow(1.0595,Math.min(combo||0,12));
      tone({f:base,dur:.12,type:'sine',v:.15});
      tone({f:base*1.26,dur:.12,type:'sine',v:.13,delay:.07});
      tone({f:base*1.5,dur:.22,type:'sine',v:.13,delay:.14});
    },
    wrong(){
      tone({f:196,f2:110,dur:.28,type:'sawtooth',v:.1});
      tone({f:147,dur:.2,type:'sine',v:.08,delay:.05});
    },
    combo(n){
      for(let i=0;i<3;i++)tone({f:440*Math.pow(1.122,i+n%5),dur:.09,type:'triangle',v:.1,delay:i*.05});
    },
    whoosh(){noise(.22,.07);tone({f:220,f2:660,dur:.25,type:'sine',v:.07});},
    unlock(){
      [523,659,784,1047].forEach((f,i)=>tone({f,dur:.35,type:'sine',v:.14,delay:i*.09}));
      noise(.4,.05,.1);
    },
    win(){
      [523,659,784,1047,1319].forEach((f,i)=>tone({f,dur:.4,type:'triangle',v:.13,delay:i*.11}));
      tone({f:1568,dur:.6,type:'sine',v:.1,delay:.5});
    },
    page(){tone({f:392,f2:588,dur:.18,type:'triangle',v:.09});}
  };
})();
/* Bật âm thanh sau tương tác đầu tiên (chính sách trình duyệt) */['pointerdown','keydown'].forEach(ev=>window.addEventListener(ev,function once(){Sfx.unlock();window.removeEventListener(ev,once)},{once:true}));

/* ═══════════════ CONFETTI ═══════════════ */
const confettiCanvas=$('confettiCanvas');
let confettiCtx=confettiCanvas?confettiCanvas.getContext('2d'):null,confettiPieces=[],confettiRAF=null;
function fireConfetti(count){
  if(!confettiCanvas||!confettiCtx)return;
  confettiCanvas.width=innerWidth;confettiCanvas.height=innerHeight;
  confettiCanvas.classList.add('fire');
  const colors=['#6d5ff5','#8b5cf6','#f472b6','#fbbf24','#34d399','#e8567f'];
  for(let i=0;i<(count||140);i++){
    confettiPieces.push({
      x:Math.random()*confettiCanvas.width,
      y:-20-Math.random()*confettiCanvas.height*.4,
      w:6+Math.random()*7,h:8+Math.random()*10,
      color:colors[Math.floor(Math.random()*colors.length)],
      vy:2+Math.random()*3.5,vx:(Math.random()-.5)*2.4,
      rot:Math.random()*Math.PI*2,vr:(Math.random()-.5)*.28,
      life:1
    });
  }
  if(!confettiRAF)confettiTick();
}
function confettiTick(){
  confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  confettiPieces.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.vy+=.045;
    if(p.y>confettiCanvas.height*.75)p.life-=.02;
    confettiCtx.save();confettiCtx.translate(p.x,p.y);confettiCtx.rotate(p.rot);
    confettiCtx.globalAlpha=Math.max(0,p.life);
    confettiCtx.fillStyle=p.color;
    confettiCtx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    confettiCtx.restore();
  });
  confettiPieces=confettiPieces.filter(p=>p.life>0&&p.y<confettiCanvas.height+40);
  if(confettiPieces.length)confettiRAF=requestAnimationFrame(confettiTick);
  else{confettiRAF=null;confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);confettiCanvas.classList.remove('fire');}
}

/* ═══════════════ XÁC THỰC (demo local — sẵn sàng nối API) ═══════════════ */
function getUsers(){return lsGet(LS.users,{})||{}}
function currentUser(){return lsGet(LS.user,null)}
function saveUser(u){lsSet(LS.user,u)}
/* ═══════════════ MẬT KHẨU — PBKDF2 (WebCrypto) ═══════════════
   ★ Bản cũ dùng `(h<<5)-h+charCode` — KHÔNG phải hàm băm mật mã: không salt,
     chỉ 32 bit, đảo ngược/đoán lại trong tích tắc.
   Nay:
     • PBKDF2-SHA256, 120.000 vòng, salt 16 byte ngẫu nhiên cho MỖI tài khoản.
     • Lưu dạng: pbkdf2$<iter>$<saltHex>$<hashHex>
     • Tài khoản cũ (dạng 'h…') vẫn đăng nhập được và được TỰ NÂNG CẤP sang
       PBKDF2 ngay lần đăng nhập kế tiếp → không mất tài khoản đang có.
   Lưu ý: đây vẫn là xác thực phía client (bản demo tĩnh). Khi thương mại hoá
   BẮT BUỘC chuyển sang backend — xem mục "Kết nối thanh toán thật" trong README. */
const PBKDF2_ITER=120000, PASS_PREFIX='pbkdf2$';
function bufToHex(b){return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function hexToBuf(h){const n=Math.floor(String(h).length/2),a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=parseInt(String(h).substr(i*2,2),16);return a}
/* hash yếu của bản cũ — CHỈ giữ để nâng cấp tài khoản cũ, không dùng cho bản ghi mới */
function hashPassLegacy(p){let h=0;for(let i=0;i<p.length;i++){h=(h<<5)-h+p.charCodeAt(i);h|=0}return 'h'+Math.abs(h)}
function cryptoOk(){return !!(window.crypto&&window.crypto.subtle&&window.crypto.getRandomValues&&window.TextEncoder)}
async function pbkdf2Hex(pass,saltHex,iter){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(String(pass)),{name:'PBKDF2'},false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:hexToBuf(saltHex),iterations:iter,hash:'SHA-256'},key,256);
  return bufToHex(bits);
}
/* Tạo bản ghi mật khẩu mới. Không có WebCrypto → lùi về hash cũ (vẫn đăng nhập được). */
async function hashPass(p){
  if(!cryptoOk())return {stored:hashPassLegacy(p),legacy:true};
  const saltBuf=new Uint8Array(16);crypto.getRandomValues(saltBuf);
  const salt=bufToHex(saltBuf);
  const h=await pbkdf2Hex(p,salt,PBKDF2_ITER);
  return {stored:PASS_PREFIX+PBKDF2_ITER+'$'+salt+'$'+h,legacy:false};
}
/* So khớp mật khẩu → {ok, needsUpgrade} */
async function verifyPass(pass,stored){
  if(!stored)return {ok:false,needsUpgrade:false};
  const s=String(stored);
  if(s.indexOf(PASS_PREFIX)===0){
    const parts=s.split('$');
    const iter=Number(parts[1])||PBKDF2_ITER, salt=parts[2]||'', want=parts[3]||'';
    if(!salt||!want)return {ok:false,needsUpgrade:false};
    const calc=await pbkdf2Hex(pass,salt,iter);
    return {ok:calc===want,needsUpgrade:false};
  }
  return {ok:s===hashPassLegacy(pass),needsUpgrade:true};
}
async function doLogin(email,pass){
  const users=getUsers();
  const key=String(email||'').trim().toLowerCase();
  const u=users[key];
  if(!u)return {ok:false,msg:'Email chưa được đăng ký. Chuyển sang tab Đăng ký nhé!'};
  const v=await verifyPass(pass,u.pass);
  if(!v.ok)return {ok:false,msg:'Mật khẩu không đúng. Thử lại nào!'};
  /* ★ Nâng cấp bản ghi cũ (hash yếu) sang PBKDF2 ngay khi đăng nhập thành công */
  if(v.needsUpgrade){
    try{const nh=await hashPass(pass);if(!nh.legacy){users[key].pass=nh.stored;lsSet(LS.users,users)}}catch(e){}
  }
  saveUser({email:key,name:u.name,guest:false});
  migrateGlobalPro();          /* chuyển Pro mua bằng bản cũ sang tài khoản này */
  /* tài khoản cũ chưa từng nhận ưu đãi → cấp 7 ngày dùng thử */
  ensureTrial({email:key,name:u.name});
  return {ok:true,user:{email:key,name:u.name}};
}
async function doRegister(name,email,pass){
  const users=getUsers();
  const key=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key))return {ok:false,msg:'Email không hợp lệ.'};
  if(String(pass||'').length<8)return {ok:false,msg:'Mật khẩu cần ít nhất 8 ký tự.'};
  if(users[key])return {ok:false,msg:'Email này đã có tài khoản. Hãy đăng nhập.'};
  let stored;
  try{ stored=(await hashPass(pass)).stored; }
  catch(e){ return {ok:false,msg:'Trình duyệt không hỗ trợ mã hoá mật khẩu — hãy dùng Chrome/Edge/Firefox bản mới.'}; }
  users[key]={name:String(name||'').trim()||key.split('@')[0],pass:stored,createdAt:Date.now()};
  lsSet(LS.users,users);
  saveUser({email:key,name:users[key].name,guest:false});
  /* ★ Tặng 7 ngày dùng thử Pro cho tài khoản mới */
  ensureTrial({email:key,name:users[key].name});
  return {ok:true,user:{email:key,name:users[key].name},trial:true};
}
function doGuest(){
  saveUser({email:'',name:'Khách',guest:true});
  return {ok:true,user:{email:'',name:'Khách',guest:true}};
}
function doLogout(){
  localStorage.removeItem(LS.user);
  renderLandingShell();
  toast('Đã đăng xuất. Hẹn gặp lại bạn!','ok');
}

/* ═══════════════ PRO ═══════════════ */
/* ★ DÙNG THỬ PRO 7 NGÀY cho mỗi tài khoản đăng ký */
const TRIAL_DAYS=7;
const TRIAL_MS=TRIAL_DAYS*24*60*60*1000;
const trialKey=email=>'gp:trial:'+email;
function trialOf(u){
  u=u||currentUser();
  if(!u||!u.email||u.guest)return null;
  const t=lsGet(trialKey(u.email),null);
  return (t&&t.end)?t:null;
}
/* Cấp trial nếu tài khoản chưa từng có (đăng ký mới hoặc tài khoản cũ chưa nhận) */
function ensureTrial(u){
  u=u||currentUser();
  if(!u||!u.email||u.guest)return null;
  let t=lsGet(trialKey(u.email),null);
  if(!t||!t.end){
    const now=Date.now();
    t={start:now,end:now+TRIAL_MS};
    lsSet(trialKey(u.email),t);
  }
  return t;
}
function trialDaysLeft(){
  const t=trialOf();
  if(!t)return 0;
  const left=t.end-Date.now();
  return left>0?Math.max(1,Math.ceil(left/86400000)):0;
}
function trialActive(){ return trialDaysLeft()>0 }
function trialPct(){
  const t=trialOf();
  if(!t)return 0;
  const left=Math.max(0,t.end-Date.now());
  return Math.max(0,Math.min(100,Math.round(left/TRIAL_MS*100)));
}
/* ★ Gói THÁNG phải hết hạn. Bản cũ `isPaidPro()` chỉ kiểm tra "có bản ghi"
   nên mua 1 tháng là dùng VĨNH VIỄN — sai nghiệp vụ.
   ★ Pro phải gắn với TÀI KHOẢN: bản cũ đọc khoá toàn cục 'gp:pro' nên mua một
   lần là MỌI tài khoản trên máy (kể cả khách) đều thành Pro. */
function proKey(email){return 'gp:pro:'+email}
function proRecordOf(email){
  if(!email)return null;
  const r=lsGet(proKey(email),null);
  return (r&&r.at)?r:null;
}
function proRecordValid(r){
  if(!r)return false;
  const plan=String(r.plan||'month');
  if(plan==='lifetime')return true;
  const normalized=normalizeProPlanKey(plan);
  const at=Number(r.at)||0;
  if(normalized==='month')return at>0&&Date.now()<at+PRO_MONTH_MS;
  return at>0&&Date.now()<at+PRO_YEAR_MS;
}
function isPaidPro(){
  const u=currentUser();
  if(!u||u.guest||!u.email)return false;
  if(PRO_VERIFY_URL && !serverProConfirmed)return false;   // ★ phải có xác nhận server
  return proRecordValid(proRecordOf(u.email));
}
function isPro(){return isPaidPro()||trialActive()}
/* ★ Xác thực server: khi PRO_VERIFY_URL cấu hình, Pro chỉ hợp lệ nếu server đã xác nhận.
   Chống giả mạo localStorage (ghi trực tiếp gp:pro:<email>={plan:'lifetime'}).
   serverProConfirmed mặc định false → fail-closed (từ chối nếu chưa đối soát). */
let serverProConfirmed=false, serverProPlan=null;
async function verifyProWithServer(){
  if(!PRO_VERIFY_URL)return;
  try{
    const r=await fetch(PRO_VERIFY_URL+'?note='+encodeURIComponent(proTransferNote())+'&amount='+(PRO_PLANS[proPlan]||PRO_PLANS.month).amount,{cache:'no-store'});
    if(!r.ok){serverProConfirmed=false;return;}
    const d=await r.json();
    if(d&&d.paid){
      serverProConfirmed=true; serverProPlan=d.plan||proPlan;
      setPro(serverProPlan,true);                 /* ghi đè record local bằng giá trị server xác thực */
      ensureProContent();                         /* nạp nội dung Pro (HSK 4–9) từ server */
    }else{
      serverProConfirmed=false;                   /* server chưa xác nhận → thu hồi Pro giả (nếu có) */
      const u=currentUser();
      if(u&&u.email&&proRecordOf(u.email))localStorage.removeItem(proKey(u.email));
    }
    renderProState();
  }catch(e){ /* lỗi mạng → giữ nguyên trạng thái, không tự ý thu hồi */ }
}
/* ★ Nạp nội dung Pro (HSK 4–9) từ server SAU KHI xác thực — nội dung KHÔNG nhúng sẵn.
   Chỉ chạy khi có server đối soát (PRO_CONTENT_URL) và đã xác nhận Pro; mặc định → no-op. */
async function ensureProContent(){
  if(!PRO_CONTENT_URL||!serverProConfirmed)return;
  try{
    const r=await fetch(PRO_CONTENT_URL+'?note='+encodeURIComponent(proTransferNote()),{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();
    if(d&&d.content){ for(const lvl of ['hsk4','hsk5','hsk6','hsk7','hsk8','hsk9']){ if(Array.isArray(d.content[lvl])) HSK_DATA[lvl]=d.content[lvl]; } }
  }catch(e){ /* lỗi mạng → giữ nội dung hiện tại */ }
}
/* Trả false nếu không ghi được (chưa đăng nhập / là khách) */
function setPro(plan,verified){
  /* ★ Khi đã bật xác thực server (PRO_VERIFY_URL), cấm mở Pro thủ công
     (gõ setPro('lifetime') ở DevTools) — Pro chỉ cấp sau khi server đối soát.
     Luồng server (startProWatch) gọi setPro(plan,true) nên vẫn hoạt động bình thường. */
  if(PRO_VERIFY_URL && !verified)return false;
  const u=currentUser();
  if(!u||!u.email||u.guest)return false;
  const p=normalizeProPlanKey(plan);
  const rec={plan:p,at:Date.now()};
  if(p==='month')rec.expiresAt=rec.at+PRO_MONTH_MS;
  if(p==='year')rec.expiresAt=rec.at+PRO_YEAR_MS;
  lsSet(proKey(u.email),rec);
  return true;
}
function clearPro(){
  const u=currentUser();
  if(u&&u.email)localStorage.removeItem(proKey(u.email));
  localStorage.removeItem(LS.pro);          /* dọn khoá toàn cục của bản cũ */
}
/* ★ Một lần: chuyển quyền Pro mua bằng bản cũ (khoá toàn cục 'gp:pro') sang
   đúng tài khoản đang đăng nhập, để người đã mua không bị mất quyền.
   Chưa đăng nhập thì GIỮ LẠI khoá cũ, lần đăng nhập sau sẽ chuyển tiếp. */
function migrateGlobalPro(){
  try{
    const old=lsGet(LS.pro,null);
    if(!old)return;
    const u=currentUser();
    if(!u||!u.email||u.guest)return;         /* chưa đăng nhập → để nguyên */
    if(!lsGet(proKey(u.email),null)){
      const migratedPlan=normalizeProPlanKey(old.plan);
      const migratedAt=Number(old.at)||Date.now();
      lsSet(proKey(u.email),{
        plan:migratedPlan,
        at:migratedAt,
        expiresAt:migratedPlan==='month'?migratedAt+PRO_MONTH_MS:migratedPlan==='year'?migratedAt+PRO_YEAR_MS:undefined
      });
    }
    localStorage.removeItem(LS.pro);
  }catch(e){}
}
function renderProState(){
  const pro=isPro(), paid=isPaidPro(), trial=!paid&&trialActive(), days=trialDaysLeft();
  document.body.classList.toggle('is-pro',pro);
  const badge=$('wsProBadge');
  if(badge){badge.classList.toggle('hidden',!pro);badge.textContent=paid?'PRO':'TRIAL'}
  const planEl=$('wsUserPlan');
  const u=currentUser();
  if(planEl){
    planEl.textContent = paid
      ? 'Gói Pro 👑'
      : trial ? ('Dùng thử · còn '+days+' ngày')
      : 'Gói miễn phí';
  }
  $$('.ws-navItem').forEach(b=>{
    if(b.dataset.view==='ai'){
      const lock=$h('.ws-lock',b);
      if(lock)lock.style.display=pro?'none':'';
    }
  });
  const up=$('wsUpgradeBtn');
  if(up){
    up.querySelector('b').textContent=paid?'Bạn đang là Pro':trial?('Giữ Pro · còn '+days+' ngày'):'Nâng cấp Pro';
    const sm=up.querySelector('small');
    if(sm)sm.textContent=paid?'Đã mở khoá toàn bộ tính năng':trial?'AI & HSK 4–9 sắp khoá':'Mở AI & HSK 4–9';
  }
  /* nhãn thẻ AI ở dashboard đổi theo trạng thái */
  const aiBadge=$h('.featureAi .dfBadge');
  if(aiBadge)aiBadge.textContent=paid?'Đã mở khoá ✨':trial?'Dùng thử Pro 🎁':'Pro · Mở khoá';
  /* cho app-core biết trạng thái Pro (dùng để khoá HSK 4–9) rồi vẽ lại thư viện */
  window.__gpIsPro=pro;
  try{ window.__gpSyncGameLocks && window.__gpSyncGameLocks(); }catch(e){}
  renderTrial();
  try{if(typeof renderVocab==='function')renderVocab()}catch(e){}
}
/* ★ Băng / thanh trạng thái dùng thử */
function renderTrial(){
  const trial=trialActive(), days=trialDaysLeft(), pct=trialPct();
  const banner=$('trialBanner');
  if(banner){
    banner.classList.toggle('hidden',!trial);
    if(trial){
      const sub=$('trialBannerSub');
      if(sub)sub.innerHTML='Còn <b>'+days+' ngày</b> — hết hạn sẽ khoá lại AI sinh câu và HSK 4–9. Nâng cấp để giữ nguyên.';
      const fill=$('trialBarFill');
      if(fill)fill.style.width=pct+'%';
    }
  }
  const bar=$('proTrial');
  if(bar){
    bar.classList.toggle('hidden',!trial);
    if(trial){
      const t=$('proTrialTitle'), s=$('proTrialSub'), f=$('proTrialFill');
      if(t)t.textContent='Bạn đang dùng thử Pro miễn phí';
      if(s)s.textContent='Còn '+days+'/'+TRIAL_DAYS+' ngày — nâng cấp để không bị khoá lại';
      if(f)f.style.width=pct+'%';
    }
  }
}

/* ═══════════════ ĐIỀU HƯỚNG LANDING ↔ WORKSPACE ═══════════════ */
const VIEW_META={
  dash:['Bảng điều khiển','Tổng quan hành trình học tập của bạn'],
  library:['Luyện gõ','Thư viện câu HSK — gõ chữ Hán của cả câu, app tự chấm'],
  pron:['Luyện phát âm','Chọn bộ câu theo cấp HSK — nói bằng micro, chấm điểm từng chữ'],
  pronStudy:['Luyện phát âm','Nói tiếng Trung bằng micro — chấm điểm từng chữ, nghe lại và sửa ngay'],
  rank:['Bảng xếp hạng','Bảng xếp hạng luyện gõ theo ngày / tuần — tính theo số câu luyện được'],
  ai:['AI sinh câu','Viết prompt, AI tạo câu mới kèm pinyin + nghĩa'],
  games:['Game từ vựng','Chọn một trò chơi từ vựng để vừa chơi vừa nhớ chữ Hán'],
  game:['Game bắn chữ','Gõ pinyin để bắn nổ chữ — nhấn Enter để xem/ẩn gợi ý pinyin']
};
let currentView='dash';
function showLanding(){
  $('landing').classList.remove('hidden');
  $('workspace').classList.add('hidden');
  document.body.style.overflow='';
  window.scrollTo(0,0);
  Sfx.page();
}
function enterWorkspace(){
  const u=currentUser();
  if(!u){openModal('authModal');return;}
  ensureTrial(u);
  renderUserChip();
  renderProState();
  $('landing').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  window.scrollTo(0,0);
  showView('dash');
  Sfx.whoosh();
  if(!lsGet(LS.seenLanding,false)){/* landing đã xem */}
  lsSet(LS.seenLanding,true);
}
window.enterWorkspace=enterWorkspace;
function renderUserChip(){
  const u=currentUser()||{name:'Khách',guest:true};
  const nameEl=$('wsUserName'),av=$('wsAvatar'),dn=$('dashName');
  const nm=u.name||(u.email?u.email.split('@')[0]:'Khách');
  if(nameEl)nameEl.textContent=u.guest?'Khách (dùng thử)':nm;
  if(av)av.textContent=(nm[0]||'K').toUpperCase();
  if(dn)dn.textContent=u.guest?'bạn':nm;
}
function showView(v){
  /* ★ Chốt an toàn: tên view lạ → về Bảng điều khiển. Nếu không, mọi section
     đều bị ẩn và người dùng chỉ thấy một khung trắng. */
  if(!VIEW_META[v]) v='dash';
  if(v==='ai'&&!isPro()){
    openModal('proModal');
    toast('Tính năng này dành cho hội viên Pro ⭐','warn');
    return;
  }
  if(!currentUser()){openModal('authModal');return;}
  /* rời màn luyện phát âm → TẮT MIC ngay (không ghi âm ngoài ý muốn) */
  if((currentView==='pron'||currentView==='pronStudy') && v!=='pronStudy' && window.__pron){try{window.__pron.leave()}catch(e){}}
  /* ★ Rời khỏi màn chơi game (bấm mục khác trên thanh bên) → dừng ván đang chơi
     và lưu tiến độ, nhưng KHÔNG tự nhảy màn (showView lo phần hiển thị).
     PHẢI kiểm tra TRƯỚC khi ghi đè currentView. */
  if(currentView==='game' && v!=='game' && window.__game && window.__game.leaveGame){
    try{ window.__game.leaveGame({silent:true}); }catch(e){}
  }
  currentView=v;
  /* rời khỏi màn học → mở khoá cuộn trang (khung .studyShell chỉ khoá khi
     đang thật sự ở trong màn luyện gõ / luyện phát âm). */
  document.body.classList.remove('studyFit');
  $('dashView').classList.toggle('hidden',v!=='dash');
  $('libraryCard').classList.toggle('hidden',v!=='library');
  $('rankCard').classList.toggle('hidden',v!=='rank');
  $('aiCard').classList.toggle('hidden',v!=='ai');
  $('pronLibCard')?.classList.toggle('hidden',v!=='pron');
  $('pronCard')?.classList.toggle('hidden',v!=='pronStudy');
  $('appCard').classList.toggle('hidden',true);
  $('gamesCard')?.classList.toggle('hidden',v!=='games');
  $('gameCard').classList.toggle('hidden',v!=='game');
  if(v==='library'){
    setLibTab('vocab');
    /* ★ Đã bỏ mục "📖 Bộ câu của bạn": tiến độ giờ vẽ trực tiếp trên từng thẻ
       chủ đề / cấp HSK bên trong renderVocab(). */
  }
  if(v==='rank'){
    try{ if(typeof window.renderRank==='function') window.renderRank('study'); }catch(e){}
  }
  if(v==='ai'){
    if(typeof window.aiProviderRefresh==='function'){ try{ window.aiProviderRefresh(); }catch(e){} }
    try{ if(typeof window.aiSyncKindUI==='function') window.aiSyncKindUI(); }catch(e){}
    /* ★ Bộ câu AI đã lưu — vẽ lại mỗi lần vào để tiến độ luôn mới */
    try{ if(typeof window.aiSetsWire==='function') window.aiSetsWire(); }catch(e){}
    try{ if(typeof window.renderAiSets==='function') window.renderAiSets(); }catch(e){}
  }
  /* ★ Luyện phát âm: "pron" = màn CHỌN BỘ CÂU, "pronStudy" = màn luyện.
     Chọn bộ ở đây rồi mới vào học — giống luồng của màn Luyện gõ. */
  if(v==='pron' && window.__pron) { try{ window.__pron.openLib(); }catch(e){} }
  if(v==='pronStudy' && window.__pron) { try{ window.__pron.open(); }catch(e){} }
  $('backLibrary').classList.toggle('hidden',v!=='game');
  const meta=VIEW_META[v]||VIEW_META.dash;
  $('wsViewTitle').textContent=meta[0];
  $('wsViewSub').textContent=meta[1];
  /* "pronStudy" là màn con của mục "pron"; "game" là màn con của mục "games"
     → vẫn tô sáng đúng mục cha trên thanh bên khi đang ở màn con. */
  const navKey=(v==='pronStudy')?'pron':(v==='game')?'games':v;
  $$('.ws-navItem').forEach(b=>b.classList.toggle('active',b.dataset.view===navKey));
  if(v==='game' && window.__game && window.__game.openGame) window.__game.openGame();
  if(v==='dash')refreshDash();
  /* ★ phát lại hiệu ứng xuất hiện mỗi lần chuyển mục */
  if(v!=='game')replayFx(viewEl(v));
  Sfx.page();
}
/* ★ expose cho app-core gọi (vd nút Quay lại trong appCard khi đang học bộ câu cá nhân) */
window.showView=showView;
function viewEl(v){
  return v==='dash'?$('dashView'):v==='ai'?$('aiCard'):v==='rank'?$('rankCard')
       :v==='games'?$('gamesCard'):$('libraryCard');
}
function replayFx(el){
  if(!el)return;
  el.classList.remove('fx-in');
  void el.offsetWidth;      /* ép reflow để animation chạy lại */
  el.classList.add('fx-in');
}

/* ═══════════════ MODAL PLUMBING ═══════════════ */
/* ★ Các nút đóng dùng data-close="auth" / "pro" nhưng id thật là authModal / proModal
   → phải ánh xạ lại, nếu không closeModal() không tìm thấy phần tử và nút ✕ "chết". */
const MODAL_ALIAS={auth:'authModal',pro:'proModal'};
function resolveModal(id){
  if(!id)return null;
  return $(id)||$(MODAL_ALIAS[id]||'')||null;
}
function openModal(id){
  const m=resolveModal(id);if(!m)return;
  m.hidden=false;document.body.style.overflow='hidden';Sfx.pop();
  /* mở bảng Pro → làm mới QR + số tiền theo đúng khách đang đăng nhập */
  if(m.id==='proModal'){ renderTrial(); if(typeof syncProPlan==='function')syncProPlan(); }
}
function closeModal(id){
  const m=resolveModal(id);
  if(!m)return;
  m.hidden=true;
  /* trả focus về nơi mở modal để bàn phím không bị "kẹt" trong modal đã đóng */
  try{if(m.contains(document.activeElement))document.activeElement.blur()}catch(e){}
  if(!$$('.modal:not([hidden])').length)document.body.style.overflow='';
}
$$('[data-close]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.close)));
$$('.modal').forEach(m=>m.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal(m.id)}));

/* ═══════════════ MODAL ĐĂNG NHẬP ═══════════════ */
let authMode='login';
function setAuthMode(mode){
  authMode=mode;
  $$('.authTab').forEach(t=>{const on=t.dataset.authtab===mode;t.classList.toggle('active',on);t.setAttribute('aria-selected',on?'true':'false')});
  $('authNameField').hidden=mode!=='register';
  $('authSubmit').textContent=mode==='register'?'Tạo tài khoản':'Đăng nhập';
  $('authError').hidden=true;
  $('authTitle').textContent=mode==='register'?'Tạo tài khoản GoPinyin':'Đăng nhập GoPinyin';
  $('authSubtitle').textContent=mode==='register'?'Tạo tài khoản để lưu tiến độ học của bạn.':'Đăng nhập để lưu tiến độ học và đồng bộ trên mọi thiết bị.';
  /* ★ Không dùng minlength trên ô mật khẩu: form dùng chung cho cả Đăng nhập —
     minlength sẽ chặn luôn tài khoản cũ có mật khẩu ngắn. Chỉ đổi gợi ý. */
  const pw=$('authPass');
  if(pw){
    pw.placeholder=mode==='register'?'Ít nhất 8 ký tự':'Mật khẩu của bạn';
    pw.setAttribute('autocomplete',mode==='register'?'new-password':'current-password');
  }
  Sfx.click();
}
$$('.authTab').forEach(t=>t.addEventListener('click',()=>setAuthMode(t.dataset.authtab)));
$('authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if($('authSubmit').dataset.busy==='1')return;      // chặn bấm gửi 2 lần
  const name=$('authName').value,email=$('authEmail').value,pass=$('authPass').value;
  const err=$('authError'),btn=$('authSubmit');
  const mode=authMode;
  btn.dataset.busy='1';btn.disabled=true;
  const oldTxt=btn.textContent;btn.textContent='⏳ Đang xử lý…';
  let r;
  try{
    r = mode==='register' ? await doRegister(name,email,pass) : await doLogin(email,pass);
  }catch(ex){
    r={ok:false,msg:'Không xử lý được: '+((ex&&ex.message)||ex)};
  }finally{
    btn.dataset.busy='0';btn.disabled=false;
    btn.textContent=oldTxt;
  }
  if(!r.ok){err.textContent=r.msg;err.hidden=false;Sfx.wrong();return;}
  err.hidden=true;
  closeModal('authModal');
  renderUserChip();renderProState();
  enterWorkspace();
  if(r.trial&&trialActive()){
    toast('🎁 Tài khoản mới — tặng bạn '+TRIAL_DAYS+' ngày dùng thử Pro miễn phí!','ok',4200);
  }else if(trialActive()){
    toast('Đăng nhập thành công. Bạn còn '+trialDaysLeft()+' ngày dùng thử Pro 🎁','ok',3600);
  }else{
    toast((mode==='register'?'Đăng ký':'Đăng nhập')+' thành công. Chúc bạn học tốt! 🎉','ok');
  }
  Sfx.unlock();fireConfetti(120);
});
$('authGoogleBtn').addEventListener('click',()=>{
  toast('Đăng nhập Google sẽ được bật khi kết nối backend. Hiện dùng email hoặc khách nhé!','warn');
  Sfx.click();
});
$('authGuestBtn').addEventListener('click',()=>{
  doGuest();closeModal('authModal');renderUserChip();renderProState();enterWorkspace();
  toast('Đang dùng thử với tư cách khách — tiến độ lưu trên máy này.','ok');
});
$('wsLogoutBtn').addEventListener('click',()=>{doLogout();Sfx.click();});

/* ═══════════════ MODAL PRO + THANH TOÁN ═══════════════ */
/* ★ MỘT nguồn dữ liệu duy nhất cho gói Pro — landing page và modal đều đọc từ đây
   để giá / quyền lợi không bao giờ lệch nhau. */
const APP_CONFIG = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
const PRO_MONTH_MS=31*24*60*60*1000;
const PRO_YEAR_MS=365*24*60*60*1000;
const PRO_PLANS={
  month:{price:'39.000đ',amount:39000,label:'Gói tháng',unit:'/tháng'},
  year:{price:'399.000đ',amount:399000,label:'Gói năm',unit:'/năm'},
  lifetime:{price:'399.000đ',amount:399000,label:'Gói năm',unit:'/năm'}
};
function normalizeProPlanKey(plan){
  if(plan==='year'||plan==='lifetime')return 'year';
  return 'month';
}
/* ★ Thông tin nhận tiền — dùng để sinh mã VietQR riêng cho từng khách
   (QR có sẵn số tiền + nội dung, khách quét là ngân hàng tự điền). */
const PRO_BANK={
  bank: APP_CONFIG.BANK_NAME || APP_CONFIG.PRO_BANK_NAME || 'Vietcombank',
  bin: APP_CONFIG.BANK_BIN || APP_CONFIG.PRO_BANK_BIN || '970436',
  acc: APP_CONFIG.BANK_ACC || APP_CONFIG.PRO_BANK_ACC || '9342383345',
  name: APP_CONFIG.BANK_OWNER || APP_CONFIG.PRO_BANK_OWNER || 'NGUYEN VAN LONG'
};

/* ⚙️ TỰ ĐỘNG NÂNG CẤP PRO
   Điền PRO_VERIFY_URL = endpoint đối soát của bạn (xem server/pro-server.js).
   Endpoint nhận ?note=<nội dung CK>&amount=<số tiền> và trả JSON:
     { "paid": true, "plan": "month" }
   Khi có URL này, app tự hỏi lại mỗi 5 giây và mở Pro ngay khi tiền về.
   Để trống '' → dùng luồng xác nhận thủ công (khách tick ô rồi bấm kích hoạt).
   (Có thể đặt trước bằng window.PRO_VERIFY_URL nếu không muốn sửa file này.) */
const PRO_VERIFY_URL=(typeof window!=='undefined'&&window.PRO_VERIFY_URL) || (APP_CONFIG.PRO_VERIFY_URL || APP_CONFIG.GOPINYIN_PRO_VERIFY_URL || '');
const PRO_CONTENT_URL=(typeof window!=='undefined'&&window.PRO_CONTENT_URL) || (APP_CONFIG.PRO_CONTENT_URL || APP_CONFIG.GOPINYIN_PRO_CONTENT_URL || (PRO_VERIFY_URL?PRO_VERIFY_URL.replace(/\/pro\/status$/,'')+'/pro/content':''));

let proPlan='month';
function proTransferNote(){
  const u=currentUser();
  const id=(u&&u.email)?u.email:(u&&u.name&&!u.guest?u.name:'khach');
  return 'GOPINYIN '+String(id).replace(/\s+/g,'');
}
/* Sinh URL ảnh VietQR cho đúng khách + đúng gói */
function proQrUrl(plan){
  const p=PRO_PLANS[plan]||PRO_PLANS.month;
  return 'https://img.vietqr.io/image/'+PRO_BANK.bin+'-'+PRO_BANK.acc+'-compact2.png'
    +'?amount='+p.amount
    +'&addInfo='+encodeURIComponent(proTransferNote())
    +'&accountName='+encodeURIComponent(PRO_BANK.name);
}
function syncProPlan(){
  const info=PRO_PLANS[normalizeProPlanKey(proPlan)]||PRO_PLANS.month;
  $$('.proPlan').forEach(p=>{
    const on=normalizeProPlanKey(p.dataset.plan)===normalizeProPlanKey(proPlan);
    p.classList.toggle('active',on);
    p.setAttribute('aria-pressed',on?'true':'false');
  });
  const amt=$('proAmount'); if(amt)amt.textContent=info.price;
  const qrAmt=$('proQrAmount'); if(qrAmt)qrAmt.textContent=info.price;
  const note=proTransferNote();
  const noteEl=$('proTransferNote'); if(noteEl)noteEl.textContent=note;
  const cAmt=$('proConfirmAmt'); if(cAmt)cAmt.textContent=info.price;
  const cNote=$('proConfirmNote'); if(cNote)cNote.textContent=note;
  /* dữ liệu cho các nút copy (copy đúng giá trị thô, không copy dấu chấm) */
  const cpA=$('proCopyAmount'); if(cpA)cpA.dataset.copy=String(info.amount);
  const cpN=$('proCopyNote'); if(cpN)cpN.dataset.copy=note;
  /* ảnh QR mới cho từng khách */
  const img=$('proQrImg');
  if(img){
    img.classList.remove('ready');
    const fb=$('proQrFallback'); if(fb)fb.hidden=true;
    img.src=proQrUrl(proPlan);
  }
  /* trạng thái chờ */
  resetProStatus();
  if(PRO_VERIFY_URL)startProWatch();
  Sfx.click();
}
/* ── Theo dõi trạng thái thanh toán (tự động nâng cấp) ── */
let proWatchTimer=null,proWatchTries=0;
function resetProStatus(){
  if(proWatchTimer){clearInterval(proWatchTimer);proWatchTimer=null}
  proWatchTries=0;
  const st=$('proStatus'); if(st)st.hidden=true;
}
function startProWatch(){
  if(!PRO_VERIFY_URL)return;
  const st=$('proStatus'),txt=$('proStatusText');
  if(st)st.hidden=false;
  if(txt)txt.textContent='Đang chờ xác nhận giao dịch… (tự mở khoá khi tiền về)';
  if(proWatchTimer)clearInterval(proWatchTimer);
  proWatchTimer=setInterval(async()=>{
    proWatchTries++;
    if(proWatchTries>120){clearInterval(proWatchTimer);proWatchTimer=null;
      if(txt)txt.textContent='Chưa nhận được giao dịch. Nhắn Zalo kèm ảnh chuyển khoản để được hỗ trợ.';
      return}
    try{
      const r=await fetch(PRO_VERIFY_URL+'?note='+encodeURIComponent(proTransferNote())+'&amount='+(PRO_PLANS[proPlan]||PRO_PLANS.month).amount,{cache:'no-store'});
      if(!r.ok)return;
      const d=await r.json();
      if(d&&d.paid){
        clearInterval(proWatchTimer);proWatchTimer=null;
        serverProConfirmed=true; serverProPlan=d.plan||proPlan;
        ensureProContent();   /* nạp nội dung Pro (HSK 4–9) từ server */
        /* ★ Chỉ bật Pro khi đã xác định được TÀI KHOẢN (Pro gắn với email) */
        if(!setPro(d.plan||proPlan,true)){
          if(txt)txt.textContent='Đã nhận tiền nhưng chưa xác định được tài khoản — hãy đăng nhập lại rồi mở lại bảng này.';
          return;
        }
        renderProState();closeModal('proModal');
        fireConfetti(220);Sfx.win();
        toast('🎉 Đã nhận được chuyển khoản — Pro tự động kích hoạt!','ok',4500);
      }
    }catch(e){/* mạng lỗi → thử lại vòng sau */}
  },5000);
}
$$('.proPlan').forEach(p=>p.addEventListener('click',()=>{proPlan=p.dataset.plan;syncProPlan();}));
$('proConfirmChk').addEventListener('change',e=>{$('proActivateBtn').disabled=!e.target.checked;Sfx.click();});
/* Ảnh QR tải xong / lỗi */
(function(){
  const img=$('proQrImg');
  if(!img)return;
  img.addEventListener('load',()=>{img.classList.add('ready');const fb=$('proQrFallback');if(fb)fb.hidden=true});
  img.addEventListener('error',()=>{
    img.classList.remove('ready');
    const fb=$('proQrFallback');if(fb)fb.hidden=false;
  });
})();
function copyText(text,btn){
  const done=()=>{const old=btn.textContent;btn.textContent='✓';btn.classList.add('copied');Sfx.correct(2);setTimeout(()=>{btn.textContent=old;btn.classList.remove('copied')},1600)};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done));
  else fallbackCopy(text,done);
}
function fallbackCopy(text,done){
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');done()}catch(e){toast('Không copy được — hãy chọn và copy thủ công.','warn')}
  ta.remove();
}
$$('.proCopy').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();
  copyText(String(btn.dataset.copy||'').trim(),e.currentTarget);
}));
$('proActivateBtn').addEventListener('click',()=>{
  /* ⚠️ PRODUCTION: nên để server xác nhận giao dịch (PRO_VERIFY_URL) rồi mới bật Pro.
     Ở bản front-end này, ta bật Pro cục bộ sau khi người dùng xác nhận đã chuyển khoản.
     ★ Pro nay gắn với TÀI KHOẢN: khách / chưa đăng nhập thì không kích hoạt được. */
  const u=currentUser();
  if(!u||u.guest||!u.email){
    toast('Hãy tạo tài khoản (hoặc đăng nhập) trước khi kích hoạt Pro — quyền Pro gắn với email để còn khôi phục khi đổi máy.','warn',5000);
    closeModal('proModal');openModal('authModal');
    return;
  }
  const ok=setPro(proPlan);
  if(!ok){toast('Không kích hoạt được Pro cho tài khoản này. Hãy đăng nhập lại rồi thử.','bad',4500);return;}
  renderProState();
  resetProStatus();
  closeModal('proModal');
  fireConfetti(220);Sfx.win();
  toast('🎉 Kích hoạt Pro thành công! Toàn bộ tính năng đã mở khoá.','ok',4200);
  $('proConfirmChk').checked=false;$('proActivateBtn').disabled=true;
});
$('wsUpgradeBtn').addEventListener('click',()=>openModal('proModal'));
$('trialUpgradeBtn')?.addEventListener('click',()=>openModal('proModal'));
$('lpPriceProBtn').addEventListener('click',()=>{
  /* mở modal với ĐÚNG gói đang chọn ở landing */
  proPlan=landingPlan;
  openModal('proModal');
});
/* Cho app-core gọi khi khách bấm vào nội dung Pro (HSK 4–9) */
window.__gpOpenPro=()=>openModal('proModal');
$('heroProBtn').addEventListener('click',()=>{
  document.getElementById('pricing').scrollIntoView({behavior:'smooth'});
  Sfx.click();
});
/* Đóng modal Pro → ngừng hỏi server */
$$('[data-close="pro"]').forEach(el=>el.addEventListener('click',resetProStatus));
/* ★ Đồng bộ giá gói giữa landing page và modal */
function renderPricing(){
  $$('[data-pro-price]').forEach(el=>{const p=PRO_PLANS[el.dataset.proPrice];if(p)el.textContent=p.price});
  /* landing: giữ nguyên cấu trúc "79.000đ<span>/tháng</span>" → chỉ thay nút text đầu tiên */
  $$('[data-price-slot]').forEach(el=>{
    const p=PRO_PLANS[el.dataset.priceSlot];if(!p)return;
    if(el.firstChild&&el.firstChild.nodeType===3)el.firstChild.nodeValue=p.price;
    else el.textContent=p.price;
  });
}
/* ★ Chọn gói ngay trên landing: Gói tháng ↔ Trọn đời */
let landingPlan='month';
function syncLandingPlan(){
  const info=PRO_PLANS[normalizeProPlanKey(landingPlan)]||PRO_PLANS.month;
  const num=$('lpProPrice');
  if(num){
    const span=num.querySelector('span');
    if(num.firstChild&&num.firstChild.nodeType===3)num.firstChild.nodeValue=info.price;
    else num.textContent=info.price;
    if(span)span.textContent=info.unit;
  }
  $$('.lp-planBtn').forEach(b=>{
    const on=normalizeProPlanKey(b.dataset.lpPlan)===normalizeProPlanKey(landingPlan);
    b.classList.toggle('active',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
  const save=$('lpProSave');
  if(save){
    save.textContent='Tiết kiệm hơn khi chọn gói năm';
    save.classList.toggle('isBest',landingPlan==='year');
  }
}
$$('.lp-planBtn').forEach(b=>b.addEventListener('click',()=>{
  landingPlan=b.dataset.lpPlan==='year'?'year':'month';
  syncLandingPlan();Sfx.click();
}));

/* ═══════════════ ĐĂNG NHẬP / CTA TỪ LANDING ═══════════════ */
$('lpLoginBtn').addEventListener('click',()=>{
  if(currentUser()){enterWorkspace();return;}
  openModal('authModal');
});
$('lpCtaBtn').addEventListener('click',()=>{
  if(currentUser())enterWorkspace();else openModal('authModal');
});
$('heroStartBtn').addEventListener('click',()=>{
  if(currentUser()){enterWorkspace();return;}
  openModal('authModal');
});
$$('[data-open="auth"]').forEach(b=>b.addEventListener('click',()=>openModal('authModal')));
$$('[data-goto]').forEach(a=>a.addEventListener('click',()=>{
  if(!currentUser()){openModal('authModal');toast('Đăng nhập để vào học nhé!','warn');return;}
  enterWorkspace();
  /* ★ 'typing' và 'vocab' đều nằm trong Thư viện; trước đây 'vocab' được truyền
     thẳng vào showView() — mà showView không có view tên 'vocab' → ẩn HẾT các
     mục và người dùng nhận một màn trắng. */
  const g=a.dataset.goto;
  const view=(g==='typing'||g==='vocab')?'library':g;
  setTimeout(()=>{
    showView(view);
    if(g==='vocab'){
      const t=document.querySelector('.modeBtn[data-vtab="topic"]');
      if(t)setTimeout(()=>{try{t.click()}catch(e){}},0);
    }
  },80);
}));
$$('.ws-navItem').forEach(b=>{
  const label=b.querySelector('.ws-navLabel')?.textContent.trim()||b.dataset.view;
  b.setAttribute('aria-label',label+(b.dataset.view==='ai'?', Pro':''));
  b.title=label+(b.dataset.view==='ai'?', Pro':'');
  b.addEventListener('click',()=>showView(b.dataset.view));
});
$('dashContinueBtn').addEventListener('click',async()=>{
  const button=$('dashContinueBtn');
  const id=button.dataset.datasetId;
  if(!id){showView('library');return}
  button.disabled=true;
  try{
    showView('library');
    await window.__gpBridge.resumeDataset(id);
  }catch(error){
    console.error('Không thể mở bộ học đang tiếp tục:',error);
    toast('Không mở được bộ học này: '+error.message,'bad',5000);
  }finally{
    button.disabled=false;
  }
});
/* ★ Thẻ game trong sảnh "Game từ vựng": bấm vào mở game tương ứng (data-view).
   Giữ nguyên mảng data-view ở trên; chỉ gắn thêm class .gameTile. */
$$('.gameTile[data-view]').forEach(b=>{
  b.addEventListener('click',()=>showView(b.dataset.view));
  b.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); showView(b.dataset.view); }
  });
});
$$('[data-view]').filter(b=>b.classList.contains('dashCard')||b.classList.contains('dashRecentItem')||b.classList.contains('dashFeature')).forEach(b=>b.addEventListener('click',()=>{
  showView(b.dataset.view);
  /* ★ Thẻ lối tắt có thể chỉ định sẵn tab từ vựng cần mở.
     PHẢI nhắm đúng nút tab (.modeBtn) — trước đây dùng querySelector('[data-vtab]')
     nên khớp lại CHÍNH thẻ này (nó cũng mang data-vtab) → click dồn click vô hạn. */
  if(b.dataset.vtab){
    const t=document.querySelector('.modeBtn[data-vtab="'+b.dataset.vtab+'"]');
    if(t && t!==b)setTimeout(()=>{try{t.click()}catch(e){}},0);
  }
}));

/* ═══════════════ THEME ĐỒNG BỘ ═══════════════ */
function syncThemeButtons(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const lp=$('lpThemeBtn');
  if(lp){lp.textContent=dark?'☀️':'🌙';lp.title=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';}
}
$('lpThemeBtn').addEventListener('click',()=>{if(typeof toggleTheme==='function')toggleTheme();syncThemeButtons();Sfx.click();});
$('themeToggle').addEventListener('click',()=>setTimeout(syncThemeButtons,0));

/* ═══════════════ DASHBOARD ═══════════════ */
const DAILY_GOAL=20;
function todayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
function bumpDaily(){
  const d=lsGet(LS.daily,{date:todayKey(),count:0})||{date:todayKey(),count:0};
  if(d.date!==todayKey()){d.date=todayKey();d.count=0}
  d.count++;lsSet(LS.daily,d);
  /* Streak */
  const st=lsGet(LS.streak,{last:'',days:0})||{last:'',days:0};
  const y=new Date(Date.now()-86400000);const yk=y.getFullYear()+'-'+(y.getMonth()+1)+'-'+y.getDate();
  if(st.last!==todayKey()){
    st.days=(st.last===yk)?(st.days||0)+1:1;
    st.last=todayKey();lsSet(LS.streak,st);
  }
  return d.count;
}
let continueRequest=0;
async function refreshDashContinue(){
  const request=++continueRequest;
  const button=$('dashContinueBtn');
  if(!button)return;
  try{
    const next=window.__gpBridge&&await window.__gpBridge.continueDataset();
    if(request!==continueRequest)return;
    const eyebrow=$('dashContinueEyebrow');
    const title=$('dashContinueTitle');
    const sub=$('dashContinueSub');
    const action=$('dashContinueAction');
    const progress=$('dashContinueProgress');
    const fill=$('dashContinueProgressFill');
    if(!next){
      button.dataset.datasetId='';
      button.setAttribute('aria-label','Khám phá thư viện học tập');
      eyebrow.textContent='Lộ trình học tập';
      title.textContent='Chọn bài học đầu tiên';
      sub.textContent='Khám phá thư viện HSK và chủ đề từ vựng để bắt đầu.';
      action.firstChild.nodeValue='Khám phá thư viện ';
      progress.hidden=true;
      fill.style.width='0%';
      progress.setAttribute('aria-valuenow','0');
      return;
    }
    const completed=Math.min(next.completed,next.total);
    const percent=next.total?Math.round(completed/next.total*100):0;
    button.dataset.datasetId=next.id;
    button.setAttribute('aria-label','Tiếp tục học '+next.name+', tiến độ '+completed+' trên '+next.total);
    eyebrow.textContent='Đang học';
    title.textContent=next.name;
    sub.textContent=completed.toLocaleString('vi-VN')+' / '+next.total.toLocaleString('vi-VN')+' câu đã hoàn thành · '+percent+'%';
    action.firstChild.nodeValue='Tiếp tục học ';
    progress.hidden=false;
    progress.setAttribute('aria-valuenow',String(percent));
    fill.style.width=percent+'%';
  }catch(error){
    if(request!==continueRequest)return;
    console.error('Không tải được bộ học tiếp tục:',error);
    $('dashContinueEyebrow').textContent='Lộ trình học tập';
    $('dashContinueTitle').textContent='Mở thư viện học tập';
    $('dashContinueSub').textContent='Chưa tải được tiến độ gần đây. Bạn vẫn có thể mở thư viện để chọn bài học.';
    $('dashContinueAction').firstChild.nodeValue='Mở thư viện ';
    button.dataset.datasetId='';
    button.setAttribute('aria-label','Mở thư viện học tập');
    $('dashContinueProgress').hidden=true;
  }
}
function refreshDash(){
  renderTrial();
  /* Gom tiến độ từ tất cả bộ câu (core lưu ở localStorage key cts:progress:<id>) */
  let learned=0,correct=0,wrong=0,bestCombo=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.indexOf('cts:progress:')===0){
        let p=null;try{p=JSON.parse(localStorage.getItem(k))}catch(e){}
        if(!p)continue;
        const done=Math.min(p.mainIndex||0,999999);
        learned+=done;
        const s=p.stats||{};
        correct+=s.correct||0;wrong+=s.wrong||0;
        bestCombo=Math.max(bestCombo,s.combo||0);
      }
    }
  }catch(e){}
  const att=correct+wrong;
  /* Chưa làm câu nào thì KHÔNG phải 100% — hiện "—" cho trung thực */
  const acc=att?Math.round(correct/att*100):null;
  countUp($('dashLearned'),learned);
  if(acc===null){const el=$('dashAcc');if(el)el.textContent='—'}else{countUp($('dashAcc'),acc,'%')}
  countUp($('dashCombo'),bestCombo);
  countUp($('dashBest'),lsGet(LS.best,0)||0);
  /* Vòng mục tiêu */
  const d=lsGet(LS.daily,{date:todayKey(),count:0})||{date:todayKey(),count:0};
  const cnt=(d.date===todayKey())?d.count:0;
  $('dashGoalNum').textContent=Math.min(cnt,DAILY_GOAL)+'/'+DAILY_GOAL;
  const ring=$('dashRingFg'),C=326.7;
  ring.style.strokeDashoffset=String(C-C*Math.min(cnt/DAILY_GOAL,1));
  /* Streak */
  const st=lsGet(LS.streak,{last:'',days:0})||{last:'',days:0};
  const chip=$('wsStreakChip');
  if(st.last===todayKey()&&st.days>0){chip.classList.remove('hidden');$('wsStreakNum').textContent=st.days}
  else chip.classList.add('hidden');
  refreshDashContinue();
}
/* ★ Đếm số chạy lên cho các ô thống kê (chỉ chạy khi giá trị thay đổi) */
const _countCache=new WeakMap();
function countUp(el,target,suffix){
  if(!el)return;
  const key=String(target)+'|'+(suffix||'');
  if(_countCache.get(el)===key){el.textContent=Number(target).toLocaleString('vi-VN')+(suffix||'');return}
  _countCache.set(el,key);
  const to=Number(target)||0;
  const from=Number(String(el.textContent).replace(/[^\d]/g,''))||0;
  if(from===to||!to){el.textContent=to.toLocaleString('vi-VN')+(suffix||'');return}
  const t0=performance.now(),dur=700;
  const tick=t=>{
    const k=Math.min((t-t0)/dur,1),e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e).toLocaleString('vi-VN')+(suffix||'');
    if(k<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/* Theo dõi tiến độ học để cộng mục tiêu ngày + điểm game cao nhất */
/* ★ Mục tiêu ngày + streak: được cộng từ __gpOnSentenceCorrect (mỗi CÂU ĐÚNG
   đúng 1 lần). Trước đây chỗ này đoán bằng cách so `#progressText` mỗi 1,2s →
   Xoá tiến độ / đổi bộ / quay lại màn khác cũng làm số đổi → cộng mục tiêu OAN. */
setInterval(()=>{
  if($('workspace').classList.contains('hidden'))return;
  const gs=$('gaScoreNum');
  if(gs&&!$('gameCard').classList.contains('hidden')){
    const v=parseInt(String(gs.textContent).replace(/[^\d-]/g,''),10);
    if(!isNaN(v)&&v>(lsGet(LS.best,0)||0))lsSet(LS.best,v);
  }
},1200);

/* ═══════════════ BẢNG XẾP HẠNG — TÁCH RIÊNG: GAME vs LUYỆN GÕ ═══════════════
   Hai bảng lưu cục bộ hoàn toàn riêng biệt:
     gp:lbGame  — CHỈ dữ liệu CHƠI GAME (từ bắn trúng + điểm combo)
     gp:lbStudy — CHỈ dữ liệu LUYỆN GÕ (số câu luyện được)
   Cấu trúc mỗi bảng:
     { day:{ 'YYYY-MM-DD': { <uid>:{name,correct,score,at} } },
       week:{ 'YYYY-Www' : { <uid>:{...} } } }
   • correct = số câu/từ gõ ĐÚNG (câu sai không được cộng)
   • score   = điểm game bắn chữ (mỗi chữ bắn trúng, theo combo) — chỉ có ở bảng game
   Mỗi tài khoản đăng nhập = một dòng riêng. */
const LB_KEY_GAME='gp:lbGame', LB_KEY_STUDY='gp:lbStudy', LB_KEEP_DAYS=21, LB_KEEP_WEEKS=10;
const pad2=n=>String(n).padStart(2,'0');
function dayStamp(d){d=d||new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function weekStamp(d){
  d=d||new Date();
  const t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const dow=(t.getDay()+6)%7;              /* Thứ 2 = 0 */
  t.setDate(t.getDate()-dow+3);            /* dịch về thứ Năm của tuần ISO */
  const jan4=new Date(t.getFullYear(),0,4);
  jan4.setDate(jan4.getDate()-((jan4.getDay()+6)%7)+3);
  const wk=1+Math.round((t-jan4)/(7*86400000));
  return t.getFullYear()+'-W'+pad2(wk);
}
function lbUser(){
  const u=currentUser();
  if(!u)return {id:'guest:khach',name:'Khách'};
  if(u.guest)return {id:'guest:'+String(u.name||'Khách'),name:String(u.name||'Khách')};
  const email=String(u.email||'').toLowerCase();
  return {id:email||('name:'+(u.name||'hocvien')),name:u.name||email.split('@')[0]||'Học viên'};
}
function rankStore(board){return board==='study'?LB_KEY_STUDY:LB_KEY_GAME;}
function lbPrune(db){
  const cut=dayStamp(new Date(Date.now()-(LB_KEEP_DAYS-1)*86400000));
  Object.keys(db.day||{}).forEach(k=>{if(k<cut)delete db.day[k]});
  Object.keys(db.week||{}).sort().reverse().slice(LB_KEEP_WEEKS).forEach(k=>{delete db.week[k]});
}
/* Cộng dồn vào cả bảng ngày và bảng tuần của người đang đăng nhập.
   board = 'game' (chỉ game) | 'study' (chỉ luyện gõ) */
function lbBump(board,patch){
  const u=lbUser();
  const db=lsGet(rankStore(board),null)||{};
  db.day=db.day||{};db.week=db.week||{};
  const now=Date.now();
  [['day',dayStamp()],['week',weekStamp()]].forEach(([scope,key])=>{
    const bucket=db[scope][key]=db[scope][key]||{};
    const e=bucket[u.id]=bucket[u.id]||{name:u.name,correct:0,score:0,at:now};
    e.name=u.name;e.at=now;
    if(patch.correct)e.correct=(e.correct||0)+patch.correct;
    if(patch.score)e.score=(e.score||0)+patch.score;
  });
  lbPrune(db);
  lsSet(rankStore(board),db);
}
/* ★ expose cho app-core (panel BXH) gọi khi mở / có điểm mới */
window.renderRank=renderRank;
let rankScope='day', studyRankScope='day';
function rankEntries(board,scope){
  const db=lsGet(rankStore(board),null)||{};
  const key=scope==='week'?weekStamp():dayStamp();
  const bucket=(db[scope]||{})[key]||{};
  const me=lbUser();
  return Object.keys(bucket).map(id=>{
    const e=bucket[id]||{};
    return {id,name:e.name||'Học viên',correct:e.correct||0,score:e.score||0,at:e.at||0,me:id===me.id};
  }).filter(e=>e.correct>0||e.score>0)
    .sort((a,b)=>b.correct-a.correct||b.score-a.score||String(a.name).localeCompare(String(b.name),'vi'));
}
const escHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rankAvatar(name,extra){
  const ch=(String(name||'?').trim()[0]||'?').toUpperCase();
  return '<span class="rankAv '+(extra||'')+'">'+escHtml(ch)+'</span>';
}
function rankRowFor(board,e,place,extra){
  const isStudy=board==='study';
  return '<div class="rankRow'+(e.me?' isMe':'')+(extra?' '+extra:'')+'" role="listitem">'
    +'<span class="rankNo">'+place+'</span>'
    +'<span class="rankWho">'+rankAvatar(e.name)
      +'<span class="rankName"><span class="rankNameTxt">'+escHtml(e.name)+'</span>'
      +(e.me?'<span class="rankYouTag">Bạn</span>':'')+'</span></span>'
    +'<span class="rankCorrect"><b>'+e.correct.toLocaleString('vi-VN')+'</b><i>'+(isStudy?'câu luyện':'câu/từ')+'</i></span>'
    +(isStudy?'<span class="rankScore hidden"></span>':'<span class="rankScore"><b>'+e.score.toLocaleString('vi-VN')+'</b><i>điểm</i></span>')
    +'</div>';
}
function renderRank(board){
  const isStudy=board==='study';
  const prefix=isStudy?'studyRank':'rank';
  const podium=$(prefix+'Podium'),host=$(prefix+'List'),meBox=$(prefix+'Me'),table=$(prefix+'Table');
  if(!podium||!host)return;
  const scope=isStudy?studyRankScope:rankScope;
  /* tabs: chỉ còn BXH luyện gỗ (#rankCard); game tab đã gỡ */
  const tabSel=isStudy?'#rankCard .rankTab':'#rankCard .rankTab';
  $$(tabSel).forEach(t=>{
    const on=t.dataset.rank===scope;
    t.classList.toggle('active',on);t.setAttribute('aria-selected',on?'true':'false');
  });
  const note=$(prefix+'ScopeNote');
  if(note){
    const scopeLabel=scope==='week'
      ? ('Tuần '+String(weekStamp()).slice(6)+'/'+String(weekStamp()).slice(0,4))
      : 'Hôm nay';
    note.textContent=scopeLabel+' · '+(isStudy
      ? 'xếp hạng luyện gõ trên thiết bị này, mỗi tài khoản một dòng — chỉ tính câu gõ đúng.'
      : 'xếp hạng lưu trên thiết bị này, mỗi tài khoản một dòng — câu sai không được tính.');
  }
  const list=rankEntries(board,scope);
  if(!list.length){
    podium.className='rankPodium isEmpty';
    podium.innerHTML='<div class="rankEmpty"><div class="rankEmptyIcon">🌱</div>'
      +'<div><b>Chưa có ai trên bảng</b><span>'+(isStudy
        ? 'Luyện gõ đúng một câu là bạn xuất hiện ngay ở đây.'
        : 'Học đúng một câu (hoặc bắn trúng một chữ trong game) là bạn xuất hiện ngay.')+'</span></div></div>';
    host.innerHTML='';
    if(table)table.classList.add('hidden');
    if(meBox){meBox.classList.add('hidden');meBox.innerHTML=''}
    return;
  }
  const medals=['🥇','🥈','🥉'];
  const top=list.slice(0,3);
  const rows=list.slice(3);
  /* xếp hình bục: hạng 2 – hạng 1 – hạng 3 (dưới 3 người thì xếp thẳng 1→2) */
  const order=top.length>=3?[top[1],top[0],top[2]]:top.slice();
  podium.className='rankPodium'+(top.length===1?' p1':top.length===2?' p2':'');
  if(table)table.classList.remove('hidden');
  podium.innerHTML=order.map(e=>{
    const place=list.indexOf(e)+1;
    return '<div class="rankPod pod'+place+(e.me?' isMe':'')+'">'
      +'<div class="rankPodMedal" aria-label="Hạng '+place+'">'+medals[place-1]+'</div>'
      +rankAvatar(e.name,'avBig')
      +'<div class="rankPodName">'+escHtml(e.name)+(e.me?'<span class="rankYouTag">Bạn</span>':'')+'</div>'
      +'<div class="rankPodStats"><b>'+e.correct.toLocaleString('vi-VN')+'</b> '+(isStudy?'câu luyện':'đúng')
        +(isStudy?'':'<span class="rankPodDot">·</span><b>'+e.score.toLocaleString('vi-VN')+'</b> điểm')+'</div>'
      +'</div>';
  }).join('');
  host.innerHTML=rows.map((e,i)=>rankRowFor(board,e,i+4)).join('');
  if(table)table.classList.toggle('hidden',rows.length===0);
  if(meBox){
    /* chỉ hiện dòng "vị trí của bạn" khi bạn chưa có dữ liệu (đã có hạng thì đã nằm trong bảng) */
    const meIdx=list.findIndex(e=>e.me);
    if(meIdx===-1){
      const me=lbUser();
      meBox.classList.remove('hidden');
      meBox.innerHTML=rankRowFor(board,{name:me.name,correct:0,score:0,me:true},'—','rankMeRow');
    }else{
      meBox.classList.add('hidden');meBox.innerHTML='';
    }
  }
}
/* ★ Chỉ còn tab BXH Luyện gỗ (#rankCard); BXH game đã bị gỡ bỏ */
$$('#rankCard .rankTab').forEach(t=>t.addEventListener('click',()=>{
  studyRankScope=t.dataset.rank==='week'?'week':'day';
  renderRank('study');Sfx.click();
}));
/* ★ Hai nguồn điểm, mỗi nguồn một bảng riêng:
   • study → câu gõ đúng trong Luyện gõ (bảng luyện gỗ) */
/* ★ Game bắn chữ KHÔNG còn bảng xếp hạng (người dùng yêu cầu gỡ bỏ) */
window.__gpOnGamePoint=function(){};
window.__gpOnSentenceCorrect=()=>{
  lbBump('study',{correct:1});
  /* ★ Mục tiêu ngày + chuỗi ngày học: cộng đúng 1 lần cho mỗi câu gõ ĐÚNG */
  try{ bumpDaily(); }catch(e){}
  /* chỉ vẽ lại dashboard khi nó đang hiện (tránh tính toán thừa mỗi câu) */
  try{ if($('dashView')&&!$('dashView').classList.contains('hidden'))refreshDash(); }catch(e){}
};
window.__gpRankBump=lbBump;

/* ★ Chuyển tiếp (lần đầu): dữ liệu bảng xếp hạng CŨ (gp:lb, kết hợp game+study)
   → đưa vào bảng GAME (gp:lbGame) để không mất thành tích đã chơi. Bảng study
   được seed riêng từ lịch sử luyện gõ bên dưới. */
(function carryOldLb(){
  try{
    if(lsGet(LB_KEY_GAME,null))return;
    const old=lsGet('gp:lb',null);
    if(old&&(old.day||old.week))lsSet(LB_KEY_GAME,old);
  }catch(e){}
})();

/* ★ MỘT LẦN DUY NHẤT cho mỗi tài khoản: nhập "lịch sử học" đã có từ trước
   (tổng stats.correct trong các bộ câu) vào bảng LUYỆN GÕ (gp:lbStudy),
   để bảng xếp hạng không hiện 0 với người đã học trước khi có tính năng này. */
function lbHistoryCorrect(){
  let total=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k||k.indexOf('cts:progress:')!==0)continue;
      try{
        const p=JSON.parse(localStorage.getItem(k));
        total+=(p&&p.stats&&p.stats.correct)||0;
      }catch(e){}
    }
  }catch(e){}
  return total;
}
function lbMigrate(){
  if(!currentUser())return;
  const u=lbUser();
  const done=lsGet('gp:lbSeed',{})||{};
  if(done[u.id])return;
  done[u.id]=1;lsSet('gp:lbSeed',done);
  const base=lbHistoryCorrect();
  if(base<=0)return;
  const db=lsGet(LB_KEY_STUDY,null)||{};db.day=db.day||{};db.week=db.week||{};
  const now=Date.now();
  [['day',dayStamp()],['week',weekStamp()]].forEach(([scope,key])=>{
    const bucket=db[scope][key]=db[scope][key]||{};
    const e=bucket[u.id];
    if(e&&e.correct>0)return;              /* đã có số liệu thật → không ghi đè */
    bucket[u.id]={name:u.name,correct:base,score:0,at:now};
  });
  lsSet(LB_KEY_STUDY,db);
}
try{ lbMigrate(); }catch(e){}

/* ═══════════════ LANDING: HIỆU ỨNG & TƯƠNG TÁC ═══════════════ */
function landingFX(){
  /* Năm footer */
  const yr=$('lpYear');if(yr)yr.textContent=String(new Date().getFullYear());

  /* Nav trôi + bóng */
  const nav=$('lpNav');
  if(nav){
    const onScroll=()=>{nav.classList.toggle('scrolled',window.scrollY>12)};
    window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  }

  /* Chữ Hán bay ngược nền */
  const charsHost=$('lpChars');
  if(charsHost){
    const hanzi='你好中文学习汉语拼音字词读写意思朋友学校生活工作吃饭时间'.split('');
    for(let i=0;i<14;i++){
      const s=document.createElement('span');
      s.textContent=hanzi[i%hanzi.length];
      s.style.left=(Math.random()*96)+'vw';
      s.style.fontSize=(26+Math.random()*54)+'px';
      s.style.animationDuration=(16+Math.random()*20)+'s';
      s.style.animationDelay=(-Math.random()*30)+'s';
      s.style.opacity=String(0.03+Math.random()*0.045);
      charsHost.appendChild(s);
    }
  }

  /* Reveal khi cuộn
     ★ Trình duyệt/WebView cũ không có IntersectionObserver → trước đây dòng
     `new IntersectionObserver(...)` NÉM LỖI, làm hỏng cả phần còn lại của
     file (đếm số, hiệu ứng, VÀ toàn bộ khối khởi tạo ở cuối) → app trắng.
     Nay thiếu IO thì hiện luôn mọi thứ thay vì chết. */
  const hasIO = typeof IntersectionObserver === 'function';
  const io = hasIO ? new IntersectionObserver(es=>{
    es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
  },{threshold:.12}) : null;
  if(io) $$('.reveal').forEach(el=>io.observe(el));
  else $$('.reveal').forEach(el=>el.classList.add('in'));

  /* Đếm số thống kê */
  const runCount = el=>{
    const target=parseInt(el.dataset.count||'0',10);
    if(!target){el.textContent='0';return}
    const t0=performance.now(),dur=1400;
    const tick=t=>{
      const k=Math.min((t-t0)/dur,1), ease=1-Math.pow(1-k,3);
      el.textContent=Math.round(target*ease).toLocaleString('vi-VN');
      if(k<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const cio = hasIO ? new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting)return;
      runCount(e.target);
      cio.unobserve(e.target);
    });
  },{threshold:.4}) : null;
  if(cio) $$('[data-count]').forEach(el=>cio.observe(el));
  else $$('[data-count]').forEach(runCount);

  /* Hiệu ứng ánh sáng theo chuột trên thẻ tính năng */
  $$('.lp-feature').forEach(card=>{
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty('--mx',(e.clientX-r.left)+'px');
      card.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });

  /* Âm thanh hover nhẹ cho nav/CTA (chỉ desktop) */
  if(matchMedia('(hover:hover)').matches){
    $$('.lp-btn,.ws-navItem,.dashCard,.vocabCard').forEach(el=>{
      el.addEventListener('mouseenter',()=>Sfx.hover());
    });
  }
  $$('.lp-btn,.lp-module,.lp-feature').forEach(el=>el.addEventListener('click',()=>Sfx.tap()));
}

/* ═══════════════ KHỞI TẠO ═══════════════ */
/* ★ Bọc try/catch: hiệu ứng landing KHÔNG được phép làm chết khối khởi tạo
   (đăng nhập, Pro, render) phía dưới. */
try{ landingFX(); }catch(e){ try{ console.warn('[gopinyin] landingFX lỗi:',e&&e.message); }catch(_){} }
function renderLandingShell(){
  $('landing').classList.remove('hidden');
  $('workspace').classList.add('hidden');
  renderUserChip();
  renderProState();
}
/* ★ Landing chỉ hiện LẦN ĐẦU — đã đăng nhập & đã từng xem landing → vào thẳng workspace,
   các lần sau không hiện landing nữa. Chưa đăng nhập thì vẫn hiện landing để đăng nhập. */
migrateGlobalPro();   /* chuyển quyền Pro của bản cũ sang tài khoản đang đăng nhập */
/* ★ Khi có server đối soát: xác thực Pro qua server ngay khi tải + định kỳ (chống giả mạo localStorage) */
if(PRO_VERIFY_URL){ verifyProWithServer(); setInterval(verifyProWithServer,60000); }
if(currentUser()&&lsGet(LS.seenLanding,false))enterWorkspace();
else{lsSet(LS.seenLanding,true);renderLandingShell();}
renderPricing();
syncLandingPlan();
renderTrial();
syncThemeButtons();
/* Trạng thái Pro lúc tải */
document.body.classList.toggle('is-pro',isPro());
/* Phím tắt: Escape đóng modal đang mở */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const open=$$('.modal:not([hidden])');
    if(open.length)closeModal(open[open.length-1].id);
  }
});
/* Logo click ở sidebar → về bảng điều khiển */
const sideBrand=document.querySelector('.ws-sideBrand');
if(sideBrand)sideBrand.addEventListener('click',()=>showView('dash'));
})();
