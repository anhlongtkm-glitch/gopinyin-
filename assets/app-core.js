const $=id=>document.getElementById(id);
const DB_NAME='ChineseTypingStudioDB',DB_VERSION=2,STORE='datasets',VSTORE='vocabCache';
let db=null,activeDataset=null,rows=[],order=[],index=0,mainOrder=[],mainIndex=0,mode='all',wrongIds=new Set(),stats={correct:0,wrong:0,combo:0,bestCombo:0,attempts:0},currentFileKey='',lastValidInput='',composing=false,awaitingEnter=false,autoSound=true,speechRate=0.8,selectedVoiceName='',showVietnamese=true,showHanzi=true,pinyinHint=false,curHadError=false,suppressSentenceSpeech=false,readOnType=true,lastTypedSpoken='',studyOrigin='library';
/* Trạng thái chấm câu: chữ ký lỗi (chống ghi điểm yếu trùng) */
let hanWrongSig='';
/* ★ NGUỒN DUY NHẤT để lấy câu đang làm. Mọi chỗ hiển thị / chấm điểm / bộ lọc
   đều phải đi qua đây, nhờ vậy không thể xảy ra chuyện "màn hình hiện câu A mà
   bộ lọc lại so với câu B" (đúng lỗi người dùng gặp: xem "现在是零点。" nhưng
   đòi gõ "谢…"). Trả về null nếu dữ liệu không nhất quán → nơi gọi phải dừng. */
function currentRow(){
  if(index<0||index>=order.length)return null;
  const ri=order[index];
  if(ri==null||ri<0||ri>=rows.length)return null;
  return rows[ri]||null;
}
/* ── Trạng thái phiên luyện (không lưu) ──
   ★ MỘT kiểu gõ duy nhất: gõ trực tiếp CHỮ HÁN của cả câu → TỰ CHẤM khi gõ,
     gõ đúng hết mới được sang câu. Space = sang câu · Enter = ẩn/hiện gợi ý Pinyin. */
let sentStartTs=0;

/* ── IndexedDB (tự dự phòng bộ nhớ khi trình duyệt chặn lưu trữ) ── */
let dbReady=null,dbBroken=false;
/* ★ Lịch sử gõ: mảng các câu đã gõ (đúng/sai/khó) — lưu localStorage theo bộ */
let typingHistory=[],histFilter='done';
const memDB=new Map(),memVcache=new Map();
function initDB(){
  if(dbReady)return dbReady;
  dbReady=new Promise(resolve=>{
    let req=null;
    try{req=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){dbBroken=true;resolve(null);return}
    let settled=false;
    const fin=ok=>{if(settled)return;settled=true;if(!ok)dbBroken=true;resolve(db)};
    req.onupgradeneeded=()=>{try{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});if(!d.objectStoreNames.contains(VSTORE))d.createObjectStore(VSTORE,{keyPath:'file'})}catch(e){}};
    req.onsuccess=()=>{db=req.result;dbBroken=false;hideStorageWarn();try{db.onversionchange=()=>{try{db.close()}catch{};db=null;dbReady=null}}catch(e){};fin(true)};
    req.onerror=()=>fin(false);
    req.onblocked=()=>fin(false);          // tab khác đang giữ phiên bản DB cũ → không treo vô hạn
    setTimeout(()=>fin(false),5000);       // chốt an toàn: tối đa 5s
  });
  return dbReady;
}
function openDB(){return initDB()}
async function dbGetAll(){await initDB();if(!db)return[...memDB.values()];return new Promise(res=>{try{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>{dbBroken=true;res([...memDB.values()])}}catch(e){res([...memDB.values()])}})}
async function dbPut(v){await initDB();if(!db){memDB.set(v.id,v);return v}return new Promise((res,rej)=>{try{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
async function dbDelete(id){await initDB();if(!db){memDB.delete(id);return}return new Promise((res,rej)=>{try{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function progressKey(id){return'cts:progress:'+id}
// ★ Cache dữ liệu kho từ vựng (IndexedDB store riêng) — tải 1 lần, dùng offline về sau
function vcacheGet(file){return initDB().then(()=>{if(!db)return memVcache.get(file)||null;return new Promise(res=>{try{const r=db.transaction(VSTORE,'readonly').objectStore(VSTORE).get(file);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)}catch(e){res(null)}})})}
function vcachePut(v){return initDB().then(()=>{if(!db){memVcache.set(v.file,v);return v}return new Promise(res=>{try{const r=db.transaction(VSTORE,'readwrite').objectStore(VSTORE).put(v);r.onsuccess=()=>res(v);r.onerror=()=>res(null)}catch(e){res(null)}})})}

/* ── Utilities ── */
/* ★ Chuẩn hoá về chữ thường không dấu để SO KHỚP GÕ.
   NFD bóc được ă/â/ê/ô + mọi dấu thanh, NHƯNG ơ (U+01A1) và ư (U+01B0)
   KHÔNG có dạng phân rã → phải thay tường Minh. Nếu không, khi người dùng
   bật gõ tiếng Việt (Telex: "o"+"w"→"ơ"), ký tự này rơi vào [^a-z0-9\s]
   bị đổi thành KHOẢNG TRẮNG → so khớp báo SAI oan (Bug "w lúc đúng lúc sai"). */
function normalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[ơƠ]/g,'o').replace(/[ưƯ]/g,'u').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
/* ★ Chuẩn hoá RIÊNG cho việc SO KHỚP GÕ: pinyin không có chữ "v", người dùng hay gõ
   "v" thay cho "ü" (nv → nǚ, lv → lǜ). Quy "v" → "u" để cả "nu" và "nv" đều đúng.
   (KHÔNG dùng cho đọc tiêu đề file — ở đó "v" là chữ thật trong "Việt".) */
function typingPlain(s){return normalize(s).replace(/v/g,'u')}
/* ★ Bỏ chữ "w"/"y" đầu âm tiết nếu có (wo→o, yi→i, wen→en).
   Dùng khi người dùng bật gõ TIẾNG VIỆT: IME (Telex/VNI/UniKey) biến cặp
   nguyên âm+"w" thành ơ/ư nên chữ "w" ĐẦU âm tiết bị nuốt mất khỏi ô gõ
   → "wo" chỉ còn "o" và app từng báo sai oan. */
function noLeadingSemi(w){return (w&&w.length>1&&(w[0]==='w'||w[0]==='y'))?w.slice(1):w}
/* So khớp 1 từ đã gõ với từ mong đợi — chấp nhận cả khi thiếu w/y đầu âm tiết. */
function wordMatches(typed,expected){
  if(typed===expected)return true;
  if(expected.startsWith(typed))return true;
  const s=noLeadingSemi(expected);
  return !!s&&s.startsWith(typed);
}
/* Phát hiện chữ TIẾNG VIỆT trong ô gõ — dùng để nhắc người dùng tắt gõ
   tiếng Việt thay vì báo "ký tự sai".
   ★ CHỈ coi là tiếng Việt khi gặp ký tự mà PINYIN KHÔNG BAO GIỜ dùng:
     đ, ă, â, ê, ô, ơ, ư và các biến thể có dấu (chấm/hỏi/ngã/nặng…).
   ★ LƯU Ý: dấu HUYỀN (à ì ù) và SẮC (á í ú) CŨNG là dấu thanh PINYIN
     (gè, yào, bù, měi…) — app còn tự thêm dấu thanh khi gõ đúng từ, nên
     KHÔNG được coi chúng là tiếng Việt, nếu không mọi lần gõ sai cũng bị
     báo oan "đang bật gõ tiếng Việt". */
const PINYIN_CHARS=/[a-z0-9āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]/;
const VIET_CHARS=/[đđăâêôơưạảãẹẻẽịỉĩọỏõụủũỵỷỹằắẳẵặầấẩẫậềếểễệồốổỗộờớởỡợừứửữựĐĐĂÂÊÔƠƯẠẢÃẸẺẼỊỈĨỌỎÕỤỦŨỴỶỸẰẮẲẴẶẦẤẨẪẬỀẾỂỄỆỒỐỔỖỘỜỚỞỠỢỪỨỬỮỰ]/;
function hasVietnameseChars(s){
  const t=String(s||'');
  for(const ch of t){
    if(PINYIN_CHARS.test(ch))continue;    // chữ latin / dấu thanh pinyin → bỏ qua
    if(VIET_CHARS.test(ch))return true;   // ký tự chỉ có trong tiếng Việt
  }
  return false;
}

/* ═══ THỐNG KÊ ĐIỂM YẾU (theo âm tiết) + TỐC ĐỘ — lưu localStorage toàn cục ═══ */
const WEAK_KEY='cts:weak:v1',SPEED_KEY='cts:speed:v1';
let weakStats={},speedStats={chars:0,ms:0};
function loadWeakSpeed(){
  try{weakStats=JSON.parse(localStorage.getItem(WEAK_KEY)||'{}')||{}}catch(e){weakStats={}}
  try{const s=JSON.parse(localStorage.getItem(SPEED_KEY)||'{}');speedStats={chars:Number(s.chars)||0,ms:Number(s.ms)||0}}catch(e){}
}
function saveWeak(){try{localStorage.setItem(WEAK_KEY,JSON.stringify(weakStats))}catch(e){}}
function saveSpeed(){try{localStorage.setItem(SPEED_KEY,JSON.stringify(speedStats))}catch(e){}}
/* +1 đúng/sai cho 1 âm tiết (chấu theo pinyin, không phụ thuộc kiểu gõ) */
function weakInc(word,ok){
  const w=String(word||'').toLowerCase().replace(/[^a-züv]/g,'');
  if(!w)return;
  const r=weakStats[w]||(weakStats[w]={ok:0,wrong:0});
  if(ok)r.ok++;else r.wrong++;
}

/* ★ Từ yếu = gõ sai ≥2 lần VÀ tỉ lệ sai ≥25% (không đòi "sai > đúng" tuyệt đối —
   người luyện nhiều sẽ có ok rất cao, nếu so tuyệt đối thì không bao giờ thấy điểm yếu). */
function topWeakWords(limit){
  return Object.keys(weakStats)
    .map(w=>({w,ok:weakStats[w].ok||0,wrong:weakStats[w].wrong||0}))
    .filter(x=>x.wrong>=2&&x.wrong/(x.ok+x.wrong)>=0.25)
    .sort((a,b)=>(b.wrong/(b.ok+b.wrong))-(a.wrong/(a.ok+a.wrong))||b.wrong-a.wrong)
    .slice(0,limit||20);
}
function speedRecord(chars,ms){
  if(chars>0&&ms>400&&ms<600000){speedStats.chars+=chars;speedStats.ms+=ms;saveSpeed()}
}
function speedCpm(){
  if(!speedStats.ms)return 0;
  return Math.round(speedStats.chars/speedStats.ms*60000);
}
function speedReset(){speedStats={chars:0,ms:0};saveSpeed()}
function headerScore(h,type){const n=normalize(h);if(type==='vi')return/tieng viet|vietnamese|nghia viet|dich/.test(n)?10:(n==='viet'?8:0);if(type==='py')return/pinyin|phien am/.test(n)?10:0;if(type==='zh')return/tieng trung|chinese|中文|han tu/.test(n)?10:0;if(type==='wv')return/nghia tu|word meaning|tu vung|vocab|dinh nghia|tu don/.test(n)?10:0;return 0}
function detectColumns(headers){const best=t=>headers.map((h,i)=>({i,s:headerScore(h,t)})).sort((a,b)=>b.s-a.s)[0];const vi=best('vi'),py=best('py'),zh=best('zh'),wv=best('wv');if(!vi||!py||vi.s===0||py.s===0)throw new Error('Không tìm thấy cột Tiếng Việt hoặc Pinyin.');return{vi:vi.i,py:py.i,zh:zh&&zh.s?zh.i:-1,wv:wv&&wv.s?wv.i:-1}}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function uid(){return crypto.randomUUID?crypto.randomUUID():'ds_'+Date.now()+'_'+Math.random().toString(36).slice(2)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ═══════════════════════════════════════════════════════════
   ★ THEME (sáng / tối)
   ═══════════════════════════════════════════════════════════ */
const THEME_KEY='cts:theme';
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  const btn=$('themeToggle');
  if(btn){
    btn.textContent=t==='dark'?'☀️':'🌙';
    btn.setAttribute('aria-pressed',t==='dark'?'true':'false');
    btn.title=t==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
  }
}
function initTheme(){
  let saved=null;try{saved=localStorage.getItem(THEME_KEY)}catch{}
  const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved==='dark'||saved==='light'?saved:(prefersDark?'dark':'light'));
}
function toggleTheme(){
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  applyTheme(next);
  try{localStorage.setItem(THEME_KEY,next)}catch{}
}

/* ═══════════════════════════════════════════════════════════
   ★ TOAST — thông báo nổi phía trên
   ═══════════════════════════════════════════════════════════ */
function toast(msg,type='info',ms=2600){
  const host=$('toastHost');
  if(!host)return;
  const el=document.createElement('div');
  el.className='toast '+(type==='ok'?'ok':type==='bad'?'bad':type==='warn'?'warn':'');
  const icon=type==='ok'?'✅':type==='bad'?'⛔':type==='warn'?'⚠️':'ℹ️';
  el.innerHTML='<span class="toast-icon">'+icon+'</span><span>'+escapeHtml(msg)+'</span>';
  host.appendChild(el);
  const remove=()=>{el.classList.add('out');setTimeout(()=>el.remove(),220)};
  const timer=setTimeout(remove,ms);
  el.addEventListener('click',()=>{clearTimeout(timer);remove()});
}

/* ═══════════════════════════════════════════════════════════
   ★ APP MODAL — thay alert / confirm / prompt gốc trình duyệt
   ═══════════════════════════════════════════════════════════ */
let _modalResolve=null,_modalIsInput=false;
function _modalOpen(opts){
  const {title='',msg='',okText='Đồng ý',cancelText='Hủy',danger=false,input=false,value=''}=opts||{};
  return new Promise(resolve=>{
    _modalResolve=resolve;_modalIsInput=!!input;
    const modal=$('appModal'),ok=$('appModalOk'),cancel=$('appModalCancel'),inp=$('appModalInput');
    $('appModalTitle').textContent=title;
    $('appModalMsg').textContent=msg;
    $('appModalMsg').classList.toggle('hidden',!msg);
    ok.textContent=okText;ok.className='btn '+(danger?'danger':'primary');
    if(cancelText===null){cancel.classList.add('hidden')}
    else{cancel.classList.remove('hidden');cancel.textContent=cancelText}
    if(input){inp.classList.remove('hidden');inp.value=value}
    else{inp.classList.add('hidden');inp.value=''}
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
    setTimeout(()=>{if(input){inp.focus();inp.select()}else ok.focus()},30);
  });
}
function _modalClose(result){
  const modal=$('appModal');
  if(!modal)return;
  modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
  const r=_modalResolve;_modalResolve=null;
  if(r)r(result);
}
// Thay alert() — chỉ 1 nút
function appAlert(msg,title='Thông báo'){return _modalOpen({title,msg,okText:'Đã hiểu',cancelText:null})}
// Thay confirm() — trả Promise<boolean>
function appConfirm(msg,opts){
  const {title='Xác nhận',okText='Đồng ý',cancelText='Hủy',danger=false}=opts||{};
  return _modalOpen({title,msg,okText,cancelText,danger}).then(v=>v===true);
}
// Thay prompt() — trả Promise<string|null>
function appPrompt(msg,value='',opts){
  const {title='Nhập thông tin',okText='Lưu'}=opts||{};
  return _modalOpen({title,msg,okText,input:true,value}).then(v=>(v==null||v==='')?null:String(v));
}

/* ── Library ── */
let libraryQuery='',librarySortBy='recent';
/* ★ Thư viện (kho có sẵn HSK / chủ đề) — không còn danh sách bộ câu người dùng ở đây */
function renderLibrary(){
  $('appCard').classList.add('hidden');
  $('libraryCard').classList.remove('hidden');
  $('backLibrary').classList.add('hidden');
  document.body.classList.remove('studyFit');
  window.speechSynthesis?.cancel();
  renderVocab();
}
/* ═══════════════════════════════════════════════════════════
   ★ TIẾN ĐỘ NGAY TRÊN THẺ CHỦ ĐỀ / CẤP HSK
   Thay cho khối "📖 Bộ câu của bạn (đã học)" đã được bỏ: người dùng thấy
   ngay "đã học bao nhiêu câu" trên chính thẻ mình sắp bấm vào → giao diện
   gọn hơn hẳn mà vẫn không mất thông tin.
   Nguồn tiến độ: bộ luyện tương ứng có id 'vocab:<srcId>' (do openVocabSource tạo).
   ═══════════════════════════════════════════════════════════ */
function srcProgress(srcId,total,unit){
  if(!total)return '';
  let p=null;try{p=loadProgress('vocab:'+srcId)}catch(e){p=null}
  const done=p?Math.min(Math.max(p.mainIndex||0,0),total):0;
  const wrong=p?(p.wrongIds||[]).length:0;
  const pct=Math.round(done/total*100);
  /* thanh 5px: 1/301 vẫn phải thấy một vạch nhỏ → tối thiểu 2% khi đã học */
  const w=done>0?Math.max(pct,2):0;
  /* ★ Luôn có thanh tiến độ (kể cả thẻ chưa học) để lưới thẻ trông đều nhau;
     chỉ khi ĐÃ học mới thêm dòng chữ "x/N · y%" — tránh 206 thẻ đầy chữ. */
  return '<span class="vocabProg'+(done||wrong?'':' isZero')+'"><i style="width:'+w+'%"></i></span>'
    +((done||wrong)
      ? '<span class="vocabMeta">'
          +done+'/'+total+' '+unit+(pct>0?' · '+pct+'%':'')
          +(wrong?' · <em>'+wrong+' cần ôn</em>':'')
        +'</span>'
      : '');
}
/* ═══════════════════════════════════════════════════════════
   ★ BỘ CÂU AI ĐÃ LƯU (kind==='ai') — hiện ngay dưới khung "AI sinh câu".
   Mỗi thẻ cho biết số câu + đã học bao nhiêu + thanh tiến độ, và nút
   "Học tiếp" mở đúng câu đang học dở (openDataset khôi phục mainIndex).
   ═══════════════════════════════════════════════════════════ */
async function renderAiSets(){
  const grid=$('aiSets');if(!grid)return;
  let sets=await dbGetAll();
  sets=sets.filter(ds=>ds&&ds.kind==='ai');
  sets.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(!sets.length){
    grid.innerHTML='<div class="aiSetsEmpty"><span class="emoji">📭</span>'
      +'Chưa có bộ AI nào được lưu.<br>Viết chủ đề ở trên → bấm tạo → chọn <b>“💾 Lưu lại”</b> để bộ xuất hiện ở đây.</div>';
    return;
  }
  grid.innerHTML=sets.map(ds=>{
    const total=(ds.rows||[]).length;
    const p=loadProgress(ds.id);
    const done=Math.min(p?.mainIndex||0,total);
    const pct=total?Math.round(done/total*100):0;
    const wrong=(p?.wrongIds||[]).length;
    const promptTxt=ds.prompt?String(ds.prompt).replace(/\s+/g,' ').trim():'';
    const km=aiKindMeta(ds.contentType);
    return '<article class="libraryItem studiedItem aiSetCard" data-aiid="'+escapeHtml(ds.id)+'">'
      +'<h3>'+escapeHtml(ds.name||'Bộ AI')+'</h3>'
      +'<div class="aiSetBadges"><span class="aiSetBadge k-'+(ds.contentType||'sentence')+'">'+km.ico+' '+km.label+'</span></div>'
      +(promptTxt?'<div class="aiSetPrompt" title="'+escapeHtml(promptTxt)+'">💬 '+escapeHtml(promptTxt)+'</div>':'')
      +'<div class="libraryMeta">'+total+' '+km.unit+' · đã học '+done+'/'+total
        +(wrong?' · <b style="color:var(--bad,#e5484d)">'+wrong+' cần ôn</b>':'')+'</div>'
      +'<div class="aiSetBar"><i style="width:'+pct+'%"></i></div>'
      +'<div class="aiSetActs">'
        +'<button type="button" class="miniBtn primary" data-aiact="study" data-id="'+escapeHtml(ds.id)+'">'
          +(done>0?'▶ Học tiếp':'▶ Bắt đầu học')+'</button>'
        +'<button type="button" class="miniBtn" data-aiact="rename" data-id="'+escapeHtml(ds.id)+'">✏️ Đổi tên</button>'
        +'<button type="button" class="miniBtn" data-aiact="del" data-id="'+escapeHtml(ds.id)+'">✕ Xóa</button>'
      +'</div>'
      +'</article>';
  }).join('');
}
window.renderAiSets=renderAiSets;
/* Một listener duy nhất cho cả lưới (thẻ được vẽ lại nhiều lần) */
function aiSetsWire(){
  const grid=$('aiSets');if(!grid||grid.dataset.wired)return;
  grid.dataset.wired='1';
  grid.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-aiact]');if(!b)return;
    const id=b.dataset.id,act=b.dataset.aiact;
    const sets=await dbGetAll();
    const ds=sets.find(x=>x.id===id);if(!ds)return;
    if(act==='study'){
      await openDataset(id);
      return;
    }
    if(act==='rename'){
      const name=await appPrompt('Nhập tên mới cho bộ câu này:',ds.name||'',{title:'Đổi tên bộ câu',okText:'Lưu'});
      if(!name)return;
      ds.name=name.slice(0,80);ds.updatedAt=Date.now();
      await dbPut(ds);toast('Đã đổi tên thành “'+ds.name+'”.','ok');
      renderAiSets();return;
    }
    if(act==='del'){
      const ok=await appConfirm('Xóa bộ câu “'+ds.name+'” và tiến độ của nó? Không khôi phục được.',
        {title:'Xóa bộ câu',okText:'Xóa',danger:true});
      if(!ok)return;
      await dbDelete(id);
      try{localStorage.removeItem(progressKey(id))}catch(e){}
      toast('Đã xóa bộ câu.','ok');
      renderAiSets();return;
    }
  });
}
window.aiSetsWire=aiSetsWire;
/* ═══════════════════════════════════════════════════════════
   ★ BỘ CÂU HSK 1–9 (nhúng sẵn — KHÔNG cần mạng)
   ★ 100% là CÂU hoàn chỉnh, KHÔNG có từ đơn lẻ
   ★ Nguồn: hsk-sentences-audio (chuẩn HSK 3.0 / GF0025-2021)
   ★ Mỗi câu: [chữ Hán, pinyin, nghĩa tiếng Việt]
   ═══════════════════════════════════════════════════════════ */
const VOCAB_CDN='https://cdn.jsdelivr.net/gh/B11007011/database@main/notebooks/note/';
let vocabTab='hsk',vocabQuery='';
/* ═══════════════════════════════════════════════════════════
   ★ GÓI TỪ VỰNG CHỦ ĐỀ OFFLINE (assets/vocab-pack.js — 1,9 MB)
   206 chủ đề · 41.621 mục (chữ Hán + pinyin + nghĩa Việt).
   Nạp LƯỜI: chỉ tải khi người dùng mở một chủ đề lần đầu,
   nên trang vẫn nhẹ; sau đó dùng lại từ bộ nhớ.
   ═══════════════════════════════════════════════════════════ */
let vocabPackPromise=null;
function ensureVocabPack(){
  if(window.VOCAB_PACK)return Promise.resolve(true);
  if(vocabPackPromise)return vocabPackPromise;
  vocabPackPromise=new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='assets/vocab-pack.js';s.async=true;
    s.onload=()=>resolve(!!window.VOCAB_PACK);
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
  return vocabPackPromise;
}
function parsePackRows(raw){
  if(!raw)return [];
  const out=[];
  for(const line of String(raw).split('\n')){
    if(!line)continue;
    const p=line.split('\t');
    if(p[0]&&p[2])out.push({w:p[0],p:p[1]||'',m:p[2]});
  }
  return out;
}
/* số mục của một chủ đề (hiện trên thẻ, không cần nạp gói) */
function topicCount(id){
  try{
    if(typeof TOPIC_COUNTS!=='undefined'&&TOPIC_COUNTS[id])return TOPIC_COUNTS[id];
    if(window.TOPIC_COUNTS&&window.TOPIC_COUNTS[id])return window.TOPIC_COUNTS[id];
  }catch(e){}
  return 0;
}
/* ★ Số mục THẬT của một nguồn, tính từ dữ liệu thay vì nhãn viết cứng.
   Cấp HSK đếm đúng theo điều kiện của fetchVocabItems (có chữ Hán + có nghĩa),
   nhờ vậy nhãn trên thẻ luôn khớp với tiến độ "x/N" bên trong bộ luyện. */
function srcCount(id){
  const k=String(id||'');
  if(/^hsk[1-9]$/.test(k)&&typeof HSK_DATA!=='undefined'){
    return (HSK_DATA[k]||[]).filter(x=>x&&x[0]&&x[2]).length;
  }
  return topicCount(k);
}
function findVocabSource(id){
  for(const g of ['hsk','topic','tone','other']){
    const f=(VOCAB_GROUPS[g]||[]).find(x=>x[0]===id);
    if(f)return{id:f[0],label:f[1],cat:f[2]||'',file:f[0]+'.json'};
  }
  return null;
}
// ★ Tải dữ liệu 1 nguồn (ưu tiên cache) → [{w,p,m}]
async function fetchVocabItems(file){
  const key=String(file).replace(/\.json$/,'');
  const emb=HSK_DATA[key];
  if(emb)return emb.map(x=>({w:String(x[0]||''),p:String(x[1]||''),m:String(x[2]||'')})).filter(x=>x.w&&x.m);
  /* ★ ưu tiên gói offline (không cần mạng, mở tức thì sau lần đầu) */
  if(await ensureVocabPack()){
    const raw=window.VOCAB_PACK&&window.VOCAB_PACK[key];
    if(raw){
      const items=parsePackRows(raw);
      if(items.length)return items;
    }
  }
  const cached=await vcacheGet(file);
  if(cached&&Array.isArray(cached.items)&&cached.items.length)return cached.items;
  const resp=await fetch(VOCAB_CDN+file,{cache:'force-cache'});
  if(!resp.ok)throw new Error('máy chủ trả về '+resp.status);
  const raw=await resp.json();
  if(!Array.isArray(raw))throw new Error('dữ liệu không hợp lệ');
  const items=raw.map(x=>({
    w:String((x&&x.w)||'').trim(),
    p:String((x&&x.p)||'').trim(),
    m:String((x&&(x.m||x.m_en))||'').trim()
  })).filter(x=>x.w&&x.m);
  if(items.length)await vcachePut({file,items,fetchedAt:Date.now()});
  return items;
}
// ★ HSK 4–9 là nội dung Pro (HSK 1–3 học miễn phí)
function vocabLocked(srcId){
  const m=/^hsk([4-9])$/.exec(String(srcId||''));
  return !!m&&window.__gpIsPro!==true;
}
// ★ Bấm 1 mục trong kho → tạo bộ luyện (lưu vào thư viện) rồi mở luôn
async function openVocabSource(srcId){
  const src=findVocabSource(srcId);
  if(!src)return;
  if(vocabLocked(srcId)){
    if(typeof window.__gpOpenPro==='function')window.__gpOpenPro();
    toast('HSK 4–9 nằm trong gói Pro. Nâng cấp (hoặc dùng thử 7 ngày) để mở khoá nhé!','warn',3600);
    return;
  }
  const id='vocab:'+srcId;
  const existing=(await dbGetAll()).find(x=>x.id===id);
  if(existing){await openDataset(id);return}
  const list=$('vocabList');
  const prev=list?list.innerHTML:'';
  if(list)list.innerHTML='<div class="vocabLoading">Đang tải "'+escapeHtml(src.label)+'"…</div>';
  try{
    let items=await fetchVocabItems(src.file);
    if(!items.length)throw new Error('bộ dữ liệu rỗng');
    const rows=items.map((it,i)=>({id:i,vi:it.m,py:fixPinyin(it.p),zh:it.w,wv:[]}));
    const ds={id,name:src.label,sourceName:'Kho câu giao tiếp',rows,createdAt:Date.now(),updatedAt:Date.now(),builtin:true};
    await dbPut(ds);
    toast('Đã tạo bộ "'+src.label+'" ('+rows.length+' mục).','ok');
    await openDataset(id);
  }catch(e){
    if(list)list.innerHTML=prev;
    toast('Không tải được "'+src.label+'": '+e.message+'. Kiểm tra kết nối mạng rồi thử lại.','bad',5500);
  }
}
function renderVocab(){
  const list=$('vocabList');if(!list)return;
  let items=VOCAB_GROUPS[vocabTab]||[];
  const q=vocabQuery.trim().toLowerCase();
  if(q)items=items.filter(x=>x[1].toLowerCase().includes(q)||normalize(x[1]).includes(normalize(q)));
  if(!items.length){list.innerHTML='<div class="vocabEmpty">Không tìm thấy mục nào phù hợp.</div>';return}
  list.innerHTML=items.map(x=>{
    const locked=vocabLocked(x[0]);
    const cnt=srcCount(x[0]);
    const unit=/^hsk[1-9]$/.test(String(x[0]))?'câu':'từ';
    const cntTxt=cnt?('<span class="vocabCount">'+cnt+' '+unit+'</span>'):'';
    /* ★ Bỏ nhãn "281 câu" viết cứng trong VOCAB_GROUPS — số thật lấy từ dữ liệu,
       nếu không thẻ ghi 281 mà tiến độ bên trong lại là 0/301. */
    const cat=(x[2]&&!/^\s*\d+\s*(câu|từ)\s*$/i.test(x[2]))?x[2]:'';
    /* ★ Tiến độ đã học hiện NGAY trên thẻ (thay mục "Bộ câu của bạn" đã bỏ) */
    const prog=srcProgress(x[0],cnt,unit);
    return '<button class="vocabCard'+(locked?' isLocked':'')+'" type="button" data-vsrc="'+escapeHtml(x[0])+'" title="'+(locked?'Mở khoá bằng gói Pro — ':'')+'Tạo bộ luyện: '+escapeHtml(x[1])+(cnt?' · '+cnt+' '+unit:'')+'">'+
      (cat?'<span class="vocabCat">'+escapeHtml(cat)+'</span>':'')+
      (locked?'<span class="vocabLock">🔒 Pro</span>':'')+
      '<span class="vocabCard-title">'+escapeHtml(x[1])+'</span>'+
      cntTxt+
      prog+
    '</button>';
  }).join('');
}
function setLibTab(tab){
  /* ★ Thư viện chỉ còn pane kho câu có sẵn (HSK / chủ đề) */
  if(tab==='vocab')renderVocab();
}
// ★ Hiện cảnh báo khi trình duyệt chặn lưu trữ
function showStorageWarn(){const el=$('storageWarn');if(el)el.classList.remove('hidden')}
function hideStorageWarn(){const el=$('storageWarn');if(el)el.classList.add('hidden')}
/* ═══════════════════════════════════════════════════════════
   ★ AI SINH CÂU — bạn viết prompt → AI tạo câu tiếng Trung hoàn chỉnh
   ★ CHỈ GIỮ NHỮNG DỊCH VỤ THỰC SỰ DÙNG ĐƯỢC: Google Gemini (chính)
     + OpenRouter (dự phòng khi Gemini hết hạn mức). Cả hai đều dùng
     API key MIỄN PHÍ, không đăng nhập, không popup → chạy được ở mọi nơi.
   ★ Không giới hạn số lượng: "Tạo thêm" ghi thêm vào bộ đang học
   ═══════════════════════════════════════════════════════════ */
/* ★ CẤU HÌNH NHÀ CUNG CẤP — một chỗ duy nhất: tên, trang lấy API key, chữ trên nút,
   hướng dẫn, placeholder ô key. Dropdown + hàng "Lấy API key" đọc từ đây. */
const AI_PROVIDERS={
  gemini:{
    name:'Google Gemini',
    keyUrl:'https://aistudio.google.com/app/apikey',
    keyBtn:'🔑 Lấy API key Gemini (miễn phí)',
    keyHint:'Bấm nút trên → đăng nhập tài khoản Google → bấm <b>“Create API key”</b> → <b>sao chép</b> key rồi dán vào ô “API key” phía trên. Key chỉ lưu trên máy bạn.',
    ph:'Dán API key Gemini vào đây (lưu trên máy bạn)'
  },
  openrouter:{
    name:'OpenRouter',
    keyUrl:'https://openrouter.ai/keys',
    keyBtn:'🔑 Lấy API key OpenRouter (miễn phí)',
    keyHint:'Bấm nút trên → đăng nhập bằng Google/GitHub → bấm <b>“Create Key”</b> → <b>sao chép</b> key rồi dán vào ô “API key” phía trên. App chỉ dùng các model có đuôi <b>:free</b> nên không mất tiền.',
    ph:'Dán API key OpenRouter vào đây (lưu trên máy bạn)'
  }
};
const AI_DEFAULT_PROVIDER='gemini';
// ★ Từ 09/10/2026 free tier CHỈ còn dòng Flash-Lite (model Flash thường → trả phí).
// → Thử gemini-2.0-flash-lite (chắc chắn dùng được key miễn phí) TRƯỚC, rồi các Lite khác.
// Model không tồn tại/hết hạn mức/không có quyền thì tự nhảy sang model kế tiếp.
const GEMINI_MODELS=['gemini-2.0-flash-lite','gemini-2.5-flash-lite','gemini-3.1-flash-lite','gemini-3.5-flash-lite'];
function geminiUrl(m){return 'https://generativelanguage.googleapis.com/v1beta/models/'+m+':generateContent'}
const AI_PROV_KEY='cts:ai:provider',AI_KEY_KEY='cts:ai:key';
function aiLsGet(k,def){try{return localStorage.getItem(k)||def}catch(e){return def}}
function aiLsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
/* ★ Mỗi nhà cung cấp AI có API key RIÊNG (đổi qua lại không mất key đã dán).
   Khóa: 'cts:ai:key:<provider>'. Key cũ dùng chung một ô ('cts:ai:key') được
   tự động chuyển sang cho Gemini để người dùng không phải dán lại. */
function aiKeyStore(prov,v){try{localStorage.setItem('cts:ai:key:'+prov,v||'')}catch(e){}}
function aiKeyLoad(prov){
  try{
    const v=localStorage.getItem('cts:ai:key:'+prov);
    if(v!=null&&v!=='')return v;
    if(prov==='gemini'){const old=localStorage.getItem(AI_KEY_KEY);if(old)return old}
  }catch(e){}
  return '';
}

/* ═══════════════════════════════════════════════════════════
   ★ AI SINH CÂU — VIẾT PROMPT → HỌC NGAY
   • AI viết đợt câu đầu, bạn học luôn.
   • Sắp hết câu thì AI TỰ viết tiếp — không giới hạn số lượng.
   • Câu mới KHÔNG BAO GIỜ lặp câu cú (tập seen trong cùng phiên).
   • Phiên học KHÔNG lưu tiến độ: bấm "← Thư viện" là xong.
   ═══════════════════════════════════════════════════════════ */
let aiSession=null;   // {prompt,level,provider,key,batch,seen,pending,stopped,empty,live}
function aiSetStatus(msg,cls){const el=$('aiStatus');if(!el)return;el.className='aiStatus'+(cls?' '+cls:'');el.innerHTML=msg}
/* ★ Thanh trạng thái AI trên màn hình học */
function aiShowGen(msg,cls,retry){
  const el=$('aiGenBar');if(!el)return;
  /* ★ Phải gán lại class CÓ 'hidden' — trước đây gán 'aiGenBar' trần nên thanh
     rỗng vẫn hiện thành một dải màu xanh trống dưới thẻ câu. */
  if(!msg){el.className='aiGenBar hidden';el.innerHTML='';return}
  el.classList.remove('hidden');
  el.className='aiGenBar'+(cls?' '+cls:'');
  el.innerHTML=msg+(retry?'<button type="button" class="aiRetryBtn" id="aiRetryBtn">Thử lại</button>':'');
  if(retry&&$('aiRetryBtn'))$('aiRetryBtn').onclick=()=>{
    if(!aiSession)return;
    aiSession.stopped=false;aiSession.empty=0;aiShowGen('');aiMaybeFill();
  };
}
/* ★ Thêm câu AI vào hàng chờ học.
   Bộ ĐÃ LƯU (kind==='ai') → ghi luôn vào database để lần sau học tiếp vẫn đủ câu.
   Bộ học tạm (chưa lưu) → chỉ nằm trong bộ nhớ, rời đi là hết. */
function aiAppendRows(items){
  const start=rows.length;
  items.forEach((it,i)=>{
    rows.push({id:'ai-'+(start+i),vi:it.vi,py:it.py,zh:it.zh,wv:[]});
    order.push(start+i);mainOrder.push(start+i);
  });
  if(aiSession)aiSession.generated=rows.length;
  aiFillMissingVi();          // ★ AI hay bỏ trống nghĩa TV → tự dịch nền cho đủ
  const saved=aiSavedSet();
  if(saved){
    saved.rows=rows;saved.updatedAt=Date.now();
    dbPut(saved).catch(()=>{});
    save();                   // tiến độ + mainOrder mới (câu nối vào cuối)
  }
}
/* Bộ AI đã lưu đang học (khác với phiên AI học tạm) */
function aiSavedSet(){return (activeDataset&&activeDataset.kind==='ai')?activeDataset:null}
/* Loại nội dung đang học: ưu tiên bộ đã lưu → phiên AI đang chạy → mặc định câu */
function aiCurrentKind(){
  const s=aiSavedSet();
  if(s&&s.contentType&&AI_KINDS[s.contentType])return s.contentType;
  if(aiSession&&aiSession.kind&&AI_KINDS[aiSession.kind])return aiSession.kind;
  return 'sentence';
}
function aiCurrentUnit(){return aiUnitOf(aiCurrentKind())}
/* ★ AI đôi khi không trả nghĩa tiếng Việt (hoặc đặt sai tên trường) → tự dịch nền
   bằng MyMemory (có cache localStorage), cập nhật YÊN LẶNG — không đụng
   vào ô nhập hay câu đang gõ dở.
   ★ Tra nghĩa online: luôn bật, gọi thẳng MyMemory qua HTTPS. */
/* ★ Khai báo SỚM (trước aiFillMissingVi) để mọi hàm dùng đều thấy giá trị —
     tránh lỗi "gtOnline is not defined" (temporal dead zone) khi hàm được
     gọi trong ngữ cảnh chỉ trích xuất hàm (test/vm). */
const gtOnline=true;
const _viFillTried=new Set();
let _viFillWarned=false;
async function aiFillMissingVi(){
  const idxs=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(!r.vi&&r.zh&&r.zh!=='—'&&!_viFillTried.has(r.zh)){_viFillTried.add(r.zh);idxs.push(i)}
  }
  for(const i of idxs){
    try{
      const tr=await fetchViTranslation(rows[i].zh);
      if(tr)rows[i].vi=tr;
    }catch(e){
      /* Hết hạn mức MyMemory / mất mạng → báo rõ 1 lần, không im lặng như trước */
      if(!_viFillWarned){
        _viFillWarned=true;
        toast('Không tra được nghĩa online (hết hạn mức MyMemory hoặc mất mạng) — nghĩa một số câu sẽ để trống.','warn',6000);
      }
    }
    try{
      if(order[index]===i){                     // đang hiển thị đúng câu này → cập nhật dòng nghĩa
        const el=$('vietnamese');
        if(el)el.textContent=rows[i].vi||'—';
      }
    }catch(e){}
  }
}
/* ★ FIX: Cập nhật nhẹ nhàng khi có câu AI mới — KHÔNG hề đụng vào ô nhập
   hay câu hỏi đang làm. Trước đây chỗ này gọi render() nên bị xoá nội dung
   đang gõ dở và quay về đầu câu.
   wasWaiting: true nếu TRƯỚC khi thêm câu người dùng đang ở màn chờ
   ("AI đang viết câu tiếp theo") — khi đó mới cần render() để vào học câu mới. */
function aiRefreshAfterAppend(wasWaiting){
  renderStatsOnly();                          // chỉ thanh tiến độ + số liệu
  // Cập nhật dòng thông tin phiên (số câu AI đã tạo)
  if(aiSessionLive()){
    $('fileInfo').textContent=aiSavedSet()
      ? ('🤖 '+aiSavedSet().name+' • '+rows.length+' '+aiCurrentUnit()+' • đã lưu')
      : ('🤖 '+String(aiSession.prompt).slice(0,60)+' • '+rows.length+' '+aiCurrentUnit()+' (không lưu tiến độ)');
  }
  if(wasWaiting||index>=order.length){
    // Đang ở màn "AI đang viết câu tiếp theo..." → giờ đã có câu mới, vào học luôn
    render();
    return;
  }
  /* ★ Người dùng đang gõ dở bằng IME (composition) → TUYỆT ĐỐI không đụng vào
     ô gõ. Việc AI viết thêm nội dung ở chế độ nền không được phép làm rối
     những gì người dùng đang gõ. */
  if(composing)return;
  // Đang làm dở 1 câu → TUYỆT ĐỐI không render lại câu, giữ nguyên nội dung đã gõ.
  const inp=$('pinyinInput');
  if(inp&&!awaitingEnter){
    // giữ đúng nội dung người dùng đang gõ (chỉ chạm vào ô khi thật sự lệch)
    if(inp.value!==lastValidInput){
      inp.value=lastValidInput;
      try{inp.setSelectionRange(lastValidInput.length,lastValidInput.length)}catch(e){}
    }
    updateChineseHighlight();
  }
}
/* ★ AI tự viết thêm khi sắp hết — không giới hạn số lượng */
async function aiMaybeFill(){
  const s=aiSession;
  if(!s||!s.live||s.stopped||s.pending)return;
  if(order.length-index>=3)return;            // còn đủ mục chưa cần gọi AI
  s.pending++;
  const unit=aiUnitOf(s.kind);
  // ★ Ghi nhớ TRƯỚC khi thêm: người dùng có đang ở màn chờ mục mới không?
  const wasWaiting=index>=order.length;
  // ★ Không hiện thanh "AI đang viết..." đè lên khi người dùng đang gõ dở,
  //   chỉ hiện khi đang thực sự chờ mục mới.
  if(wasWaiting)aiShowGen('<span class="aiSpinner">AI đang viết '+unit+' tiếp theo…</span> (đã có <b>'+rows.length+'</b> '+unit+')');
  try{
    const res=await aiCollect(s.provider,s.key,s.prompt,s.batch,s.level,s.seen,null,s.kind);
    if(res.items.length){aiAppendRows(res.items);s.empty=0}
    else{s.empty++;if(s.empty>=2)s.stopped=true}
  }catch(e){s.empty++;if(s.empty>=2)s.stopped=true}
  s.pending--;
  if(s.stopped)aiShowGen('🤖 AI tạm hết '+unit+' mới cho chủ đề này — bạn đã học <b>'+rows.length+'</b> '+unit+'. Đổi chủ đề khác hoặc bấm thử lại.','err',true);
  else aiShowGen('');                          // xoá thanh khi đã xong/đang gõ dở
  aiRefreshAfterAppend(wasWaiting);            // ★ không phá nội dung đang gõ
}
/* ★ Bắt đầu học: viết prompt → AI viết đợt đầu → học ngay */
async function aiStartStudy(){
  const provider=$('aiProvider').value;
  const key=$('aiKey').value.trim();
  const prompt=$('aiPrompt').value.trim();
  if(!prompt){toast('Hãy viết chủ đề bạn muốn học.','warn');$('aiPrompt').focus();return}
  const level=$('aiLevel').value;
  const batch=Math.max(1,Math.min(20,Number($('aiBatch').value)||5));
  const kind=AI_KINDS[$('aiKind')&&$('aiKind').value]?$('aiKind').value:'sentence';
  const unit=aiUnitOf(kind);
  const btn=$('aiStartBtn');
  /* ★ CHƯA có API key → mở sẵn "Tuỳ chọn nâng cao", focus ô key, chỉ đúng nút lấy key
     (nhiều người không biết API key lấy ở đâu). */
  if(!key){
    const d=document.querySelector('.aiDetails');if(d)d.open=true;
    const kEl=$('aiKey');if(kEl)kEl.focus();
    const cfg=AI_PROVIDERS[provider]||AI_PROVIDERS[AI_DEFAULT_PROVIDER];
    aiSetStatus('⚠️ Bạn chưa có <b>API key '+cfg.name+'</b>. Bấm <b>“'+cfg.keyBtn+'”</b> → tạo và sao chép key rồi dán vào ô “API key”, sau đó bấm “học ngay” lại.','err');
    toast('Chưa có API key '+cfg.name+' — bấm nút “'+cfg.keyBtn+'” để lấy key.','warn',7000);
    return;
  }
  aiLsSet(AI_PROV_KEY,provider);aiKeyStore(provider,key);
  if(btn){btn.disabled=true;btn.textContent='⏳ Đang nhờ AI viết '+unit+'…'}
  aiVerifyFixedCount=0;      // đếm riêng số nghĩa được soát lại trong lần này
  aiSession={prompt:prompt,level:level,provider:provider,key:key,batch:batch,kind:kind,
             seen:new Set(),pending:0,stopped:false,empty:0,generated:0,live:true};
  try{
    const res=await aiCollect(provider,key,prompt,batch,level,aiSession.seen,null,kind);
    if(!res.items.length)throw new Error(res.stopped||('AI chưa trả về '+unit+' nào cho chủ đề này.'));

    /* ★ HỎI LƯU NGAY SAU KHI TẠO — trước khi vào học.
       · "Lưu lại"     → đặt tên → ghi vào thư viện → học tiếp lần sau đúng câu đang dở.
       · "Không lưu"   → học tạm như cũ, KHÔNG ghi gì; thoát ra là mất. */
    const wantSave=await appConfirm(
      'AI đã tạo '+res.items.length+' '+unit+' cho chủ đề “'+String(prompt).slice(0,70)+'”.\n\n'
      +'Lưu lại để lần sau vào học tiếp đúng chỗ bạn đang dở?\n'
      +'Nếu chọn “Không lưu”, bộ này chỉ dùng tạm lần này — thoát ra là hết.',
      {title:'💾 Lưu bộ này?',okText:'💾 Lưu lại',cancelText:'Không lưu'});
    let ds=null;
    if(wantSave){
      const defName=String(prompt).replace(/\s+/g,' ').trim().slice(0,48)||('Bộ '+unit+' AI');
      const name=await appPrompt(
        'Đặt tên cho bộ '+unit+' để dễ tìm lại trong “Bộ AI đã lưu”:',
        defName,{title:'Đặt tên bộ '+unit,okText:'Lưu bộ '+unit});
      if(!name){
        /* Huỷ ở bước đặt tên → coi như KHÔNG lưu (không tạo rác trong thư viện) */
        toast('Chưa đặt tên nên bộ '+unit+' này chỉ học tạm lần này.','warn',4200);
      }else{
        ds={id:'ai:'+Date.now(),name:name.slice(0,80),sourceName:'AI sinh câu',kind:'ai',
            contentType:kind,
            prompt:String(prompt),level:level,rows:[],createdAt:Date.now(),updatedAt:Date.now()};
      }
    }

    // → vào học ngay
    activeDataset=null;rows=[];order=[];mainOrder=[];mainIndex=0;index=0;mode='all';
    wrongIds=new Set();stats={correct:0,wrong:0,combo:0,bestCombo:0,attempts:0};
    pinyinHint=false;   // ★ mới vào chế độ gỗ → pinyin luôn ẩn, muốn xem thì bật
    if(ds){
      /* rows trỏ thẳng vào ds.rows → nội dung AI viết thêm sau này tự nằm trong bộ đã lưu */
      activeDataset=ds;rows=ds.rows;currentFileKey=progressKey(ds.id);
      mainOrder=[];mainIndex=0;index=0;
    }
    aiAppendRows(res.items);
    /* ★ Nói rõ cho người dùng biết đã soát lại nghĩa (không im lặng sửa) */
    if(aiVerifyFixedCount>0){
      toast('🔍 Đã soát lại và sửa '+aiVerifyFixedCount+' nghĩa tiếng Việt chưa sát với chữ Hán.','warn',6000);
    }
    if(ds){
      ds.rows=rows;ds.updatedAt=Date.now();
      await dbPut(ds);
      toast('💾 Đã lưu “'+ds.name+'” ('+rows.length+' '+unit+') — lần sau vào là học tiếp đúng chỗ đang dở.','ok',5200);
      try{ if(typeof window.renderAiSets==='function') window.renderAiSets(); }catch(e){}
    }else{
      toast('Đã có '+res.items.length+' '+unit+' — AI sẽ tự viết thêm khi bạn học gần hết.','ok',5500);
    }
    $('libraryCard').classList.add('hidden');
    $('aiCard')?.classList.add('hidden');
    $('appCard').classList.remove('hidden');
    $('backLibrary').classList.add('hidden');
    document.body.classList.add('studyFit');
    try{ fillAppSource(); }catch(e){}
    studyOrigin='ai';
    updateSoundUI();updateViUI();updateHanUI();updateModeUI();
    aiShowGen('');
    // Mục lỗi định dạng đã được lọc IM LẶNG (aiItemOk) — không báo cho người dùng
    render();
    loadHistory();renderAppHistory();
  }catch(e){
    aiSession=null;
    aiShowGen('⚠️ '+escapeHtml(e.message)+' — sửa lại rồi bấm “học ngay” lần nữa.','err');
    aiSetStatus('⚠️ '+escapeHtml(e.message),'err');
    toast('Không tạo được '+unit+': '+e.message,'bad',6500);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='🚀 Viết prompt rồi học ngay'}
  }
}
/* ★ Kết thúc phiên AI — không có gì để lưu */
function aiEndSession(){if(aiSession)aiSession.live=false;aiSession=null;aiShowGen('')}
function aiSessionLive(){return !!(aiSession&&aiSession.live)}
/* ★ LOẠI NỘI DUNG AI SINH RA:
   · sentence = câu hoàn chỉnh (mặc định, hành vi cũ)
   · word     = TỪ / CỤM TỪ (từ vựng) — không phải câu dài
   · both     = nửa từ vựng + nửa câu, cùng chủ đề
   unit dùng cho mọi nhãn đếm ("5 câu" / "5 từ" / "5 mục"). */
const AI_KINDS={
  sentence:{unit:'câu',label:'Câu hoàn chỉnh',ico:'📝'},
  word:{unit:'từ',label:'Từ vựng',ico:'🔤'},
  both:{unit:'mục',label:'Câu + từ vựng',ico:'📝🔤'}
};
function aiKindMeta(kind){return AI_KINDS[kind]||AI_KINDS.sentence}
function aiUnitOf(kind){return aiKindMeta(kind).unit}
function buildAiPrompt(userText,count,level,avoid,kind){
  const n=Number(count)||20;
  const k=AI_KINDS[kind]?kind:'sentence';
  /* Phần "tạo cái gì" đổi theo loại nội dung — các quy tắc định dạng bên dưới giữ nguyên */
  const askSentence=[
    'Hãy tạo đúng '+n+' câu tiếng Trung hoàn chỉnh, đúng ngữ pháp, tự nhiên, dùng được ngay trong giao tiếp (KHÔNG phải từ đơn lẻ).'
  ];
  const askWord=[
    'Hãy tạo đúng '+n+' TỪ hoặc CỤM TỪ tiếng Trung (từ vựng) đúng chủ đề — KHÔNG phải câu dài, KHÔNG phải đoạn văn.',
    'Mỗi mục là một từ/cụm từ ngắn gọn, thông dụng, dùng được ngay (thường 2–4 chữ Hán; có thể 1 chữ nếu là từ đơn thật sự cần thiết).',
    'Ưu tiên danh từ, động từ, tính từ và cụm từ cố định mà người học cần nhớ để dùng trong tình huống này.'
  ];
  const askBoth=[
    'Hãy tạo đúng '+n+' mục, chia ĐỀU làm hai phần cùng chủ đề: KHOẢNG MỘT NỬA là TỪ/CỤM TỪ ngắn (2–4 chữ Hán) và một nửa là CÂU hoàn chỉnh, tự nhiên.',
    'Xen kẽ từ vựng và câu, đừng dồn hết từ vựng lên đầu.'
  ];
  const ask=k==='word'?askWord:(k==='both'?askBoth:askSentence);
  const rows=[
    'Bạn là trợ lý tạo bài học tiếng Trung cho người Việt muốn tập GIAO TIẾP.',
    'Chủ đề người dùng yêu cầu: '+userText,
    ...ask,
    /* ★ Tôn trọng giới hạn người dùng nêu trong chủ đề (số chữ, phong cách, ngành nghề…) */
    'Nếu người dùng nêu giới hạn cụ thể trong chủ đề (số chữ tối đa, ngành nghề, mức trang trọng, phong cách…), PHẢI tuân thủ đúng giới hạn đó.',
    level?('Trình độ tương đương '+level+'.'):'',
    (avoid&&avoid.length)?('KHÔNG được lặp lại các mục đã có: '+avoid.join(' | ')):'',
    // ★ Cảnh báo: TUYỆT ĐỐI không dùng chữ cái Latin (A, B, C, …) hoặc chữ số (0-9) trong câu tiếng Trung.
    //   Nếu câu gốc có tên riêng/ký hiệu chứa chữ cái, hãy dịch sang chữ Hán tương đương (A→甲, B→乙, C→丙, …) hoặc dùng cách diễn đạt khác.
    //   Không được chèn chữ Latin lặp lại (vd "AAA" thay vì 1 chữ "A") — đây là lỗi thường gặp khi dịch các từ như "sóng A", "loại A", …',
    'QUY TẮC BẮT BUỘC:',
    '- Trường "zh" chỉ chứa chữ Hán (\u4e00-\u9fff), dấu câu tiếng Trung và khoảng trắng. KHÔNG chứa chữ cái Latin A-Z, a-z hoặc chữ số 0-9.',
    '- Pinyin viết đầy đủ dấu thanh (ā á ǎ à ē é ě è …) — KHÔNG dùng số thanh (ni3, hao3).',
    '- Nghĩa tiếng Việt tự nhiên, dùng được trong giao tiếp, không phiên âm Hán-Việt.',
    // ★ Chất lượng CƠ BẢN — tránh các câu như "请打一下表" ↔ "bật đồng hồ tính tiền"
    //   (dịch không sát nghĩa, tình huống lạ mà người bản ngữ ít nói):
    '- Bản dịch tiếng Việt phải SÁT với đúng nội dung tiếng Trung: nội dung và ngữ cảnh phải khớp 100% — KHÔNG thêm thắt, KHÔNG bỏ sót, KHÔNG dịch máy móc từng chữ.',
    '- Chỉ tạo nội dung THÔNG DỤNG, tình huống thực tế hàng ngày (mua sắm, đi lại, nhà hàng, khách sạn, công sở…). TUYỆT ĐỐI không tạo nội dung lạ, tình huống vô nghĩa hoặc cách dùng hiếm gặp.',
    '- ĐÚNG 1-1: số âm tiết pinyin phải BẰNG số chữ Hán của mục (không tính dấu câu) — mỗi chữ Hán ứng đúng một âm tiết, không thiếu không dư.',
    '- Áp dụng đúng quy tắc BIẾN ĐIỆU THANH: 一 đọc "yí" trước thanh 4 ("一下" = "yí xià"), đọc "yì" trước các thanh còn lại; 不 đọc "bú" trước thanh 4; âm tiết lặp trong từ láy đọc nhẹ (妈妈 = "mā ma").',
    'BẮT BUỘC: chỉ trả về MẢNG JSON thuần, không giải thích, không markdown, không có ```json.',
    'Mỗi phần tử: {"zh":"chữ Hán","py":"pinyin có dấu thanh","vi":"nghĩa tiếng Việt tự nhiên"}'
  ];
  return rows.filter(Boolean).join('\n');
}
/* ★ Gọi AI. Mọi nhà cung cấp đều dùng API key → kiểm tra key ở MỘT chỗ.
   opt.temperature: sinh câu dùng 0.9 (cần đa dạng), DỊCH dùng thấp (0.2-0.3) để bám sát nghĩa.
   opt.image = {mime, data} (base64 thuần) → gửi kèm ảnh cho model đọc ảnh (dịch ảnh). */
async function callAi(provider,key,prompt,opt){
  /* ★ Nếu app cấu hình proxy AI (window.__gpAiProxy), chuyển cuộc gọi sang server —
     key AI nằm ở server (AI_KEY_* env), client KHÔNG lưu key plaintext.
     Không đặt proxy → giữ nguyên gọi thẳng provider (tương thích cũ). */
  if(window.__gpAiProxy) return callAiProxy(provider,prompt,opt);
  const cfg=AI_PROVIDERS[provider]||AI_PROVIDERS[AI_DEFAULT_PROVIDER];
  if(!key)throw new Error('Bạn chưa nhập API key '+cfg.name+' — mở "Tuỳ chọn nâng cao" rồi bấm "'+cfg.keyBtn+'" để lấy key (chỉ 1 lần).');
  const temp=(opt&&typeof opt.temperature==='number')?opt.temperature:.9;
  const img=(opt&&opt.image&&opt.image.data)?opt.image:null;
  if(provider==='openrouter')return callOpenRouter(key,prompt,temp,img);
  let lastErr='';
  for(const mdl of GEMINI_MODELS){
    try{
      const reqParts=[{text:prompt}];
      if(img)reqParts.push({inline_data:{mime_type:img.mime,data:img.data}});
      const resp=await fetch(geminiUrl(mdl),{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:reqParts}],generationConfig:{temperature:temp}})});
      if(!resp.ok){lastErr='Gemini lỗi '+resp.status+(resp.status===429?' (hết hạn mức — đợi 1 phút rồi thử lại, hoặc chuyển sang OpenRouter)':(resp.status===404?' (model không còn tồn tại)':(resp.status===403?' (không có quyền dùng model này — model này cần tài khoản đã bật thanh toán, hoặc API key không hợp lệ)':(resp.status===400?' (API key không hợp lệ)':''))));continue}
      const d=await resp.json();
      const parts=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts;
      const txt=parts?parts.map(p=>p.text||'').join(''):'';
      if(txt)return txt;
      lastErr='Gemini không trả nội dung.';
    }catch(e){lastErr=(e&&e.message)||String(e)}
  }
  throw new Error(lastErr||'Gemini không trả nội dung.');
}
/* ★ Gọi AI qua server proxy (window.__gpAiProxy): key nằm ở server, client chỉ gửi prompt.
   Dùng khi đã cấu hình proxy để không lưu API key plaintext trên máy khách. */
async function callAiProxy(provider,prompt,opt){
  const img=(opt&&opt.image&&opt.image.data)?opt.image:null;
  const resp=await fetch(window.__gpAiProxy,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,prompt,image:img?{mime:img.mime,data:img.data}:null})});
  if(!resp.ok){let m='';try{m=(await resp.json()).error||''}catch(e){}throw new Error('Lỗi máy chủ AI proxy: '+resp.status+(m?(' — '+m):''));}
  const d=await resp.json();
  if(d&&d.text)return d.text;
  throw new Error('Máy chủ proxy không trả nội dung.');
}
/* ★ OpenRouter — chỉ dùng các model MIỄN PHÍ (đuôi ":free"). Thử lần lượt, model nào
   chết/hết hạn mức thì nhảy sang model kế tiếp. Dùng khi Gemini hết hạn mức. */
const OPENROUTER_MODELS=[
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-small-3.2-24b-instruct:free'
];
async function callOpenRouter(key,prompt,temp,img){
  let lastErr='';
  /* có ảnh → dùng content dạng mảng (text + image_url base64) */
  const content=(img&&img.data)
    ? [{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:'+img.mime+';base64,'+img.data}}]
    : prompt;
  for(const mdl of OPENROUTER_MODELS){
    try{
      const resp=await fetch('https://openrouter.ai/api/v1/chat/completions',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:mdl,messages:[{role:'user',content:content}],temperature:(typeof temp==='number'?temp:.9)})
      });
      if(!resp.ok){
        lastErr='OpenRouter lỗi '+resp.status+(resp.status===401?' (API key không hợp lệ)':(resp.status===402?' (hết hạn mức miễn phí)':(resp.status===429?' (gọi quá nhanh — đợi 1 phút)':'')));
        if(resp.status===401)break;         /* key sai → đổi model cũng vô ích */
        continue;
      }
      const d=await resp.json();
      const txt=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
      if(txt&&txt.trim())return txt;
      lastErr='OpenRouter không trả nội dung.';
    }catch(e){lastErr=(e&&e.message)||String(e)}
  }
  throw new Error(lastErr||'OpenRouter không trả nội dung.');
}
/* ★ Làm sạch pinyin AI trả về — bản viết lại chắc chắn hơn.
   Xử lý MỌI kiểu AI hay trả về:
     1) ni3 → nǐ          (số thanh dính liền)
     2) ni3 hao3 → nǐ hǎo
     3) ni3hao3 → nǐ hǎo  (số thanh làm ranh giới âm tiết, KHÔNG có dấu cách)
     4) ni3hao3ma5        (cả câu dính liền)
     5) nv / lv → nü / lü (không có số thanh — 'v' là cách gõ 'ü')
     6) lu:3 / nu:3 → lǚ   (kiểu cũ dùng 'u:')
     7) xi'an / nǚ'ér      (dấu nháy ngăn âm tiết → giữ tách âm tiết)
     8) zhōngguó viết liền theo TỪ → tự tách thành zhōng guó
   Trả về: các âm tiết ngăn nhau bằng ĐÚNG MỘT dấu cách. */

/* Bảng âm tiết pinyin hợp lệ (không dấu) — dùng để tách chuỗi viết liền */
const PINYIN_SYLLABLES=new Set(('a ai an ang ao e ei en eng er o ou '+
  'ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu '+
  'pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu '+
  'ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu '+
  'fa fan fang fei fen feng fo fou fu '+
  'da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo '+
  'ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo '+
  'na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nue nü nüe '+
  'la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lue lü lüe '+
  'ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo '+
  'ka kai kan kang kao ke ken keng kong kou ku kua kuai kuan kuang kui kun kuo '+
  'ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo '+
  'ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun '+
  'qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun '+
  'xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun '+
  'zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo '+
  'cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo '+
  'sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo '+
  'ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo '+
  'za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo '+
  'ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo '+
  'sa sai san sang sao se sen seng si song sou su suan sui sun suo '+
  'ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun '+
  'wa wai wan wang wei wen weng wo wu '+
  'n ng m hm hng r').split(' '));

/* ★ Mapping chữ cái Latin đứng riêng trong câu Hán → chữ Hán phổ biến tương ứng
   + pinyin của chữ Hán đó. Dùng để sửa lỗi Gemini/OpenRouter đôi khi
   trả về câu Hán lẫn chữ Latin (vd "这款盒子要用 A A A 瓦吗?" — do hiểu nhầm
   "sóng A" thành 3 chữ A lặp). Thay bằng chữ Hán tương đương (A→甲, B→乙, …)
   kèm cập nhật pinyin để người dùng không thấy chữ Latin lẫn vào chữ Hán nữa. */

/* ★ Sửa câu Hán có chữ Latin lẫn vào: thay từng chữ cái Latin đơn lẻ bằng
   chữ Hán tương ứng theo LATIN_TO_HANZI, đồng thời cập nhật pinyin tương ứng.
   - Chuỗi Latin dài ≥2 ký tự KHÔNG phải chuỗi lặp (vd "ABC", "Bb") → trả về ok:false
     để caller bỏ câu đó (không sửa được an toàn).
   - Chuỗi lặp (AAA, BBB) → tách từng ký tự rồi thay bình thường.
   - Số ký tự Hán+Latin phải KHỚP số âm tiết pinyin, nếu không cũng bỏ.
   - Khoảng trắng giữa 2 chữ Hán sau khi thay được tự động gộp lại. */
function sanitizeLatinInChinese(zh,py){
  if(!zh||!/[A-Za-z]/.test(zh))return{zh,py,ok:true,changed:false};
  const badMatch=zh.match(/[A-Za-z]{2,}/);
  if(badMatch&&!/^(.)\1+$/.test(badMatch[0])){
    return{zh,py,ok:false,reason:'chuỗi Latin không lặp dài ≥2: "'+badMatch[0]+'"'};
  }
  const pySyllables=String(py||'').trim().split(/\s+/).filter(Boolean);
  const hanOrLatin=[];
  for(const ch of zh){
    if(/[A-Za-z]/.test(ch))hanOrLatin.push(ch);
    else if(/[\u3400-\u9fff]/.test(ch))hanOrLatin.push(ch);
  }
  if(hanOrLatin.length!==pySyllables.length){
    return{zh,py,ok:false,reason:`số đơn vị Hán+Latin (${hanOrLatin.length}) ≠ số âm tiết pinyin (${pySyllables.length})`};
  }
  const newPy=[...pySyllables];
  let hi=0;let newZh='';
  for(const ch of zh){
    if(/[A-Za-z]/.test(ch)){
      const map=LATIN_TO_HANZI[ch.toUpperCase()];
      if(!map)return{zh,py,ok:false,reason:'không có mapping cho chữ "'+ch+'"'};
      newZh+=map.hz;
      newPy[hi]=map.py;
      hi++;
    }else{
      newZh+=ch;
      if(/[\u3400-\u9fff]/.test(ch))hi++;
    }
  }
  let prev;
  do{prev=newZh;newZh=newZh.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g,'$1$2');}
  while(newZh!==prev);
  return{zh:newZh,py:newPy.join(' '),ok:true,changed:true};
}

/* Tách 1 chuỗi pinyin viết liền (đã bỏ số thanh, đã bỏ dấu) thành các âm tiết */
function splitPinyinSyllables(str){
  const s=String(str||'').toLowerCase().replace(/[^a-zü]/g,'');
  if(!s)return[];
  const out=[];let i=0;
  while(i<s.length){
    let matched='';
    for(let L=Math.min(6,s.length-i);L>=1;L--){
      const cand=s.slice(i,i+L);
      if(PINYIN_SYLLABLES.has(cand)){matched=cand;break}
    }
    if(matched){out.push(matched);i+=matched.length}
    else{ // không khớp âm tiết nào → gom nguyên âm+phụ âm tới nguyên âm kế tiếp
      const m=s.slice(i).match(/^[^aeiouü]*[aeiouü]+/);
      const take=m?m[0]:s[i];
      out.push(take);i+=take.length;
    }
  }
  return out;
}

/* Đặt dấu thanh cho 1 âm tiết không dấu: quy tắc a > e > o > (i/u/ü cuối) */
const TONE_MARKS={a:['ā','á','ǎ','à'],e:['ē','é','ě','è'],o:['ō','ó','ǒ','ò'],i:['ī','í','ǐ','ì'],u:['ū','ú','ǔ','ù'],ü:['ǖ','ǘ','ǚ','ǜ']};
function applyTone(syl,t){
  if(!t||t<1||t>4)return syl;
  const low=syl.toLowerCase();
  let ch=null;
  if(low.includes('a'))ch='a';
  else if(low.includes('e'))ch='e';
  else if(low.includes('o'))ch='o';
  else{
    /* 'iu' → dấu trên u ; 'ui' → dấu trên i ; còn lại nguyên âm cuối */
    const vm=low.match(/[iuü]/g);
    if(vm)ch=vm[vm.length-1];
    else ch=low[0];
  }
  if(!ch)return syl;
  const marks=TONE_MARKS[ch];if(!marks)return syl;
  const idx=low.indexOf(ch);
  if(idx<0)return syl;
  /* giữ nguyên chữ hoa nếu có */
  const isUpper=syl[idx]!==low[idx];
  let rep=marks[t-1];
  if(isUpper)rep=rep.toUpperCase();
  return syl.slice(0,idx)+rep+syl.slice(idx+1);
}

/* ★ Chuyển 1 TOKEN (có thể chứa nhiều âm tiết + số thanh) thành dạng có dấu.
   Ví dụ: "ni3hao3" → "nǐ hǎo" ; "zhong1guo2" → "zhōng guó"
   Xử lý ca khó: "Yuenan4" (AI viết liền 2 âm tiết, chỉ số thanh ở CUỐI)
     → tách "Yue"+"nan", gán thanh 4 cho âm tiết cuối → "yuè nàn"
   Xử lý erhua: "wan2r" → "wánr" (giữ 'r' dính vào âm tiết, KHÔNG tách thành "wán r") */
function numToneToDiacritic(token){
  let w=String(token||'');
  if(!w)return '';
  w=w.replace(/u:/gi,'ü').replace(/U:/g,'Ü');
  w=w.replace(/v/g,'ü').replace(/V/g,'Ü');
  if(!/[1-5]/.test(w))return w;
  /* Quét tuần tự: mỗi lần gặp số thanh → chốt âm tiết vừa gom được với thanh đó.
     Lưu ý ERHUA: âm tiết kết thúc bằng 'r' (wánr, huìr) là 1 âm tiết trọn vẹn. */
  const out=[];let buf='';
  const flush=(tone)=>{ if(buf){out.push({syl:buf,tone:tone||0});buf=''} };
  for(let i=0;i<w.length;i++){
    const c=w[i];
    if(/[1-5]/.test(c)){
      /* ★ ERHUA: "wan2r" → số 2 rồi 'r'. Âm tiết 儿 hoá trong tiếng Trung
         LUÔN chứa nguyên âm (wan, yi, hui, na, dian…). Nếu buf có nguyên âm thì
         'r' thuộc về âm tiết này → nuốt vào, KHÔNG tách thành âm tiết riêng. */
      if(w[i+1]&&/^r$/i.test(w[i+1])&&/[aeiouü]/i.test(buf)){
        buf+='r';i++;
      }
      flush(Number(c));
    }
    else if(/[a-züA-ZÜ]/.test(c)){buf+=c}
    else{flush(0)}
  }
  if(buf)flush(0);
  /* ★ Nếu 1 mảnh chứa NHIỀU âm tiết viết liền (vd "Yuenan" với thanh ở cuối),
     tách bằng bảng âm tiết. Thanh điệu gán cho âm tiết ĐẦU — vì khi AI viết liền
     một từ nhiều âm tiết, số thanh đặt sau cả chuỗi thường thuộc về âm tiết đầu
     (vd "Yuenan4" = Yuè+nán, "Beijing3" = Běi+jīng). Nếu để âm tiết cuối sẽ sai. */
  const expanded=[];
  for(const o of out){
    const plain=stripToneMarks(o.syl).plain.toLowerCase();
    /* ★ ERHUA: âm tiết kết thúc bằng 'r' — trước 'r' có thể là nguyên âm (huir, nár)
       hoặc 'n'/'ng' (wanr, dianr, huir). Tất cả đều là 1 âm tiết trọn vẹn,
       KHÔNG được tách thành "wan"+"r". */
    const isErhua=/(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/i.test(plain);
    if(!isErhua&&o.syl.length>2&&/^[a-zü]+$/.test(plain)){
      const syls=splitPinyinSyllables(plain);
      if(syls.length>1&&syls.join('')===plain){
        syls.forEach((sy,k)=>{
          expanded.push({syl:sy,tone:k===0?o.tone:0});   /* thanh cho âm tiết ĐẦU */
        });
        continue;
      }
    }
    expanded.push(o);
  }
  return expanded.map(o=>applyTone(o.syl,o.tone)).join(' ');
}

/* ★ Âm tiết có nhận được 'r' erhua ở cuối không? (wán→wánr, diǎn→diǎnr, huì→huìr)
   Bỏ dấu thanh rồi xét: phải kết thúc bằng NGUYÊN ÂM, hoặc 'n'/'ng' có nguyên âm
   trước. LƯU Ý: "diǎn" kết thúc bằng 'n' → nếu chỉ xét nguyên âm cuối sẽ SAI. */
function canTakeErhua(syl){
  const p=normalize(syl).replace(/[^a-zü]/g,'');
  return /(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)$/.test(p);
}

/* ★ Tách 1 chuỗi pinyin (KHÔNG dấu) thành các âm tiết, GIỮ ĐÚNG ERHUA.
   Vì sao cần: "diǎnr" (点儿) chỉ là MỘT âm tiết trọn vẹn, nhưng nếu đem
   splitPinyinSyllables("dianr") thì ra ["dian","r"] → bị chèn dấu cách thành
   "diǎn r" (SAI — dòng đáp án hiện "cǎo méi yǒu diǎn r suān" và chữ 儿 bị lặp).
   → Bóc 'r' erhua ra trước, tách phần lõi, rồi GẮN 'r' lại vào âm tiết cuối:
        "dianr"  → ["dianr"]
        "yidianr"→ ["yi","dianr"]
        "zhongguo"→ ["zhong","guo"]   (không phải erhua → như cũ)
   Trả về null nếu không phải pinyin (không tách được an toàn). */
function splitPinyinKeepingErhua(plain){
  const p=String(plain||'').toLowerCase();
  if(!/^[a-zü]+$/.test(p)||p.length<3)return null;
  const isErhua=/(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/.test(p);
  const core=isErhua?p.slice(0,-1):p;
  const syls=splitPinyinSyllables(core);
  if(!syls.length||syls.join('')!==core)return null;
  if(isErhua)syls[syls.length-1]+='r';
  return syls;
}

/* ★ Chuẩn hoá pinyin: bỏ dấu câu, chuyển số thanh → dấu, tách âm tiết viết liền */
function fixPinyin(p){
  if(p==null)return '';
  let s=String(p).trim();
  if(!s)return '';
  /* 1) bỏ rào markdown / ngoặc bao quanh cả chuỗi */
  s=s.replace(/^```[a-z]*\s*/i,'').replace(/\s*```$/,'');
  s=s.replace(/^[\s"'“”‘’\[\]()【】]+|[\s"'“”‘’\[\]()【】]+$/g,'');
  /* 2) 'u:' / 'v' (cách gõ 'ü') → 'ü' — PHẢI chạy TRƯỚC khi bỏ dấu câu,
        nếu không dấu ':' sẽ bị xoá mất (lu:3 → "lu 3") */
  s=s.replace(/u:/gi,'ü').replace(/U:/g,'Ü');
  s=s.replace(/v/g,'ü').replace(/V/g,'Ü');
  /* 3) dấu nháy ngăn âm tiết (xi'an, nǚ'ér) → tạm đổi thành khoảng trắng */
  s=s.replace(/['’`]/g,' ');
  /* 4) bỏ dấu câu cả Trung lẫn Latin (KHÔNG xoá dấu thanh pinyin).
        LƯU Ý: KHÔNG dùng dải [\] hay dải rộng \uff00-\uffef trong character class
        vì sẽ vô tình nuốt ký tự dấu thanh như ǐ ǎ ǒ ǔ. Liệt kê tường minh. */
  s=s.replace(/[，。？！、；：·〈〉《》「」『』【】（）〔〕…—–～]/g,' ');
  s=s.replace(/[!?,.;:(){}<>|~@#$%^&*_+="'`]/g,' ');
  s=s.replace(/[\u201c\u201d\u2018\u2019\u3010\u3011\u300a\u300b]/g,' ');
  s=s.replace(/\uFF01|\uFF1F|\uFF0C|\uFF0E|\uFF1B|\uFF1A|\uFF08|\uFF09|\uFF3B|\uFF3D|\uFF5B|\uFF5D|\uFF0F|\uFF5C|\uFF20|\uFF03|\uFF05|\uFF06|\uFF0A|\uFF0B|\uFF0D|\uFF1D|\uFF5E/g,' ');
  s=s.replace(/[\/\\\[\]]/g,' ');
  s=s.replace(/\s+/g,' ').trim();
  if(!s)return '';
  /* 5) xử lý từng token */
  const toks=s.split(' ').filter(Boolean);
  const out=[];
  for(const tk of toks){
    if(/[1-5]/.test(tk)){
      /* có số thanh → chuyển trực tiếp (có thể ra nhiều âm tiết) */
      const conv=numToneToDiacritic(tk);
      if(conv)out.push(conv);
      continue;
    }
    /* KHÔNG có số thanh */
    if(/[\u3400-\u9fff]/.test(tk)){out.push(tk);continue}
    /* Giữ lại chữ Latin + ü + MỌI ký tự nguyên âm có dấu thanh pinyin.
       TRƯỚC ĐÂY dùng /[^a-zA-ZüÜ]/g → xoá mất ǎ/ǐ/ǒ/ǔ khiến "hǎo" thành "ho".
       Nay dùng thuộc tính Unicode \p{Script=Latin} để giữ nguyên dấu. */
    const bare=tk.replace(/[^\p{Script=Latin}]/gu,'');
    if(!bare)continue;
    const hasToneDiacritic=/[āáǎàēéěèōóǒòīíǐìūúǔùǖǘǚǜ]/.test(bare);
    /* Nếu token đã có dấu thanh → chỉ cần chuẩn hoá, KHÔNG tách (giữ đúng như AI trả) */
    if(hasToneDiacritic){
      /* thử tách nếu là nhiều âm tiết viết liền (zhōngguó → zhōng guó).
         ★ Giữ nguyên erhua: "diǎnr" phải ở lại 1 âm tiết (KHÔNG thành "diǎn r"). */
      const info=stripToneMarks(bare);
      const plainLow=info.plain.toLowerCase();
      const syls=splitPinyinKeepingErhua(plainLow);
      if(syls&&syls.length>1){
        out.push(syls.map((sy,k)=>applyTone(sy,info.tones[k]||0)).join(' '));
        continue;
      }
      out.push(bare);
      continue;
    }
    /* Chuỗi latin KHÔNG dấu: thử tách thành nhiều âm tiết pinyin (zhongguo → zhong guo).
       ★ Vẫn giữ erhua: "dianr" ở lại 1 âm tiết (KHÔNG thành "dian r"). */
    const low=bare.toLowerCase();
    const syls2=splitPinyinKeepingErhua(low);
    if(syls2&&syls2.length>1){
      out.push(syls2.join(' '));
      continue;
    }
    out.push(low);
  }
  /* 6) GỘP ERHUA: "wán r" → "wánr", "huì r" → "huìr".
        Chuẩn pinyin viết 儿 hoá dính liền vào âm tiết gốc.
        Chỉ gộp khi âm tiết trước kết thúc bằng NGUYÊN ÂM (kể cả có dấu thanh)
        và âm tiết sau đúng là "r" đứng riêng. */
  const merged=[];
  for(let i=0;i<out.length;i++){
    const cur=out[i],nxt=out[i+1];
    if(nxt!==undefined&&/^r$/i.test(nxt.replace(/\s/g,''))&&canTakeErhua(cur)){
      merged.push(cur.replace(/\s$/,'')+'r');
      i++;                       /* bỏ qua 'r' đã gộp */
      continue;
    }
    merged.push(cur);
  }
  return merged.join(' ').replace(/\s+/g,' ').trim().toLowerCase();
}

/* Bản đồ ký tự có DẤU THANH → (nguyên âm gốc, số thanh 1-4).
   Dùng cho tách/ghép pinyin viết liền (stripToneMarks). */
const TONE_MAP={};
(function(){
  const m={a:'āáǎà',e:'ēéěè',o:'ōóǒò',i:'īíǐì',u:'ūúǔù',ü:'ǖǘǚǜ'};
  for(const base in m){
    const arr=[...m[base]];
    arr.forEach((ch,k)=>{TONE_MAP[ch]={base,tone:k+1}});
  }
})();
/* Bỏ dấu thanh khỏi 1 chuỗi pinyin, đồng thời ghi lại thanh của từng âm tiết
   để có thể tách chuỗi viết liền rồi gán lại dấu đúng vị trí.
   Ví dụ: "zhōngguó" → { plain:"zhongguo", tones:[1,2] } */
function stripToneMarks(str){
  const s=String(str||'');
  let plain='';const tones=[];
  for(const ch of s){
    const info=TONE_MAP[ch];
    if(info){plain+=info.base;tones.push(info.tone)}
    else{plain+=ch;/* phụ âm/âm tiết chưa có dấu → không ghi thanh */}
  }
  return {plain,tones};
}
/* ★ Lấy nghĩa tiếng Việt từ 1 hàng AI — AI hay ĐỔI TÊN trường hoặc bỏ trống
   (vi / vietnamese / nghia / meaning / dich / translation / vn / viText…) */
function aiRowVi(x){
  if(!x)return'';
  const keys=['vi','vietnamese','nghia','nghiaViet','nghiaTiengViet','viText','viMeaning','meaning','dich','translation','trans','vn'];
  for(const k of keys){
    const v=x[k];
    if(v==null)continue;
    if(typeof v==='string'&&v.trim())return v.trim();
    if(typeof v==='object'){
      const s=v.text||v.vi||v.value||v.content;
      if(typeof s==='string'&&s.trim())return s.trim();
    }
  }
  return'';
}
/* ★ Đếm chữ Hán (không tính dấu câu, khoảng trắng) */
function aiHanCount(zh){return Array.from(String(zh||'').replace(/[^\u3400-\u9fff]/g,'')).length}
/* ★ Đếm âm tiết pinyin của cả chuỗi (viết liền hay cách đều đếm được —
   mỗi âm tiết pinyin luôn chứa đúng 1 nhóm nguyên âm). */
function aiSyllableCount(py){
  const t=normalize(String(py||'')).replace(/[^a-züv]/g,'');
  const groups=t.match(/[aeiouüv]+/g);
  return groups?groups.length:0;
}
/* ★ KIỂM TRA CƠ BẢN chất lượng 1 câu AI — loại bỏ câu lỗi nghiêm trọng:
   lệch số chữ Hán / âm tiết pinyin (AI ghép sai cặp hoặc bỏ sót âm tiết),
   thiếu nghĩa, pinyin còn số thanh… Câu ERHUA (có chữ 儿) được miễn kiểm tra
   đếm vì 儿 gộp vào âm tiết đứng trước ("玩意儿" = 3 chữ, "wán yìr" = 2 nhóm). */
function aiItemOk(zh,py,vi){
  if(!zh||!py||!vi)return false;
  if(/[1-5]/.test(py))return false;                     // còn số thanh → chưa chuẩn hoá
  const han=aiHanCount(zh),syl=aiSyllableCount(py);
  if(han===0||syl===0)return false;
  if(han!==syl&&!zh.includes('儿'))return false;        // lệch chữ–pinyin
  return true;
}
/* ═══════════════════════════════════════════════════════════
   ★ KIỂM TRA NGỮ NGHĨA: nghĩa tiếng Việt có ĐÚNG với chữ Hán không?
   aiItemOk() ở trên chỉ soát HÌNH THỨC (đủ trường, số chữ Hán = số âm tiết,
   không còn số thanh). Nó KHÔNG đọc nghĩa — nên câu sai nghĩa vẫn lọt, ví dụ:
      批量 (pī liàng) bị ghi "số lượng lớn"
      → sai: 批量 là "theo lô / hàng loạt / sản xuất hàng loạt".
        "số lượng lớn" phải là 大量 (dà liàng) hoặc 数量大.
   Bước dưới đây bổ sung kiểm tra NGỮ NGHĨA bằng chính AI, theo cách
   "tự dịch độc lập rồi đối chiếu" (self-consistency) — hiệu quả hơn hỏi
   thẳng "nghĩa này đúng không?" vì model có xu hướng gật đầu với chính nó:
     1) AI đọc chữ Hán và TỰ DỊCH (không nhìn nghĩa đã cho),
     2) so bản dịch của mình với nghĩa đã cho,
     3) chỉ khi lệch mới trả về nghĩa đúng.
   Không phụ thuộc từ điển offline: đã kiểm tra 批量 KHÔNG có trong gói
   41.621 mục của app, nên tra từ điển đơn thuần sẽ bỏ sót đúng lỗi này.
   ═══════════════════════════════════════════════════════════ */
const AI_VERIFY_KEY='gp:aiVerify';
/* Đếm số nghĩa đã sửa trong lần tạo gần nhất (để báo cho người dùng) */
let aiVerifyFixedCount=0;
function aiVerifyEnabled(){
  try{return aiLsGet(AI_VERIFY_KEY,'1')!=='0'}catch(e){return true}
}
/* Chuẩn hoá chữ Hán để ghép mục gốc ↔ mục AI trả về (bỏ dấu câu/khoảng trắng) */
function aiZhKey(s){return String(s||'').replace(/[^\u3400-\u9fff]/g,'')}
function buildVerifyPrompt(items){
  const list=items.map((it,i)=>(i+1)+'. zh: '+it.zh+'  |  vi: '+(it.vi||'(trống)')).join('\n');
  return [
    'Bạn là giáo viên tiếng Trung khó tính, chuyên soát lỗi NGHĨA Việt–Hán.',
    'Dưới đây là danh sách mục (chữ Hán + nghĩa tiếng Việt) do một trợ lý khác tạo.',
    'Với TỪNG mục, làm đúng thứ tự sau:',
    '  (1) Đọc chữ Hán ở "zh" và TỰ DỊCH sang tiếng Việt — KHÔNG nhìn trường "vi" trước.',
    '  (2) So bản dịch của bạn với nghĩa "vi" đã cho.',
    '  (3) Đánh giá ok = true CHỈ KHI nghĩa đã cho đúng và sát nghĩa. Ngược lại ok = false.',
    'Coi là SAI (ok=false) khi:',
    '  - dịch lệch nghĩa hoặc nhầm từ gần nghĩa (ví dụ 批量 KHÔNG phải "số lượng lớn" mà là "theo lô, hàng loạt");',
    '  - dịch theo âm Hán-Việt thay vì nghĩa thật;',
    '  - quá chung chung, mất sắc thái quan trọng, hoặc thêm thắt điều chữ Hán không có;',
    '  - nghĩa tiếng Việt mô tả một từ khác với chữ Hán đang xét.',
    'Khi ok=false, BẮT BUỘC điền "vi_dung" là nghĩa tiếng Việt ĐÚNG, ngắn gọn, tự nhiên.',
    'BẮT BUỘC: chỉ trả về MẢNG JSON thuần, không giải thích, không markdown, không ```json.',
    'Mỗi phần tử: {"zh":"giữ nguyên chữ Hán đã cho","ok":true|false,"vi_dung":"nghĩa đúng (chỉ khi ok=false)"}',
    'DANH SÁCH CẦN SOÁT:',
    list
  ].join('\n');
}
/* Đọc phản hồi soát lỗi → [{zh, ok, viDung}] */
function parseVerifyResult(text){
  if(!text)return[];
  let t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
  const a=t.indexOf('['),b=t.lastIndexOf(']');
  if(a>=0&&b>a)t=t.slice(a,b+1);
  let arr=null;
  try{arr=JSON.parse(t)}catch(e){}
  if(!Array.isArray(arr)){
    const objs=t.match(/\{[^{}]*\}/g)||[];
    arr=objs.map(o=>{try{return JSON.parse(o)}catch(e){return null}}).filter(Boolean);
  }
  if(!Array.isArray(arr))return[];
  const out=[];
  for(const x of arr){
    if(!x||typeof x!=='object')continue;
    const zh=String(x.zh||x.chinese||x.han||'').trim();
    if(!zh)continue;
    const okRaw=x.ok;
    const ok=(okRaw===true||okRaw==='true'||okRaw===1||okRaw==='1');
    const viDung=String(x.vi_dung||x.viDung||x.dung||x.correct||x.vi_fix||'').trim();
    out.push({zh,ok,viDung});
  }
  return out;
}
/* Trả về danh sách ĐÃ SỬA nghĩa. Lỗi mạng/AI → trả nguyên bản (không chặn việc học). */
async function aiVerifyMeanings(items,provider,key){
  if(!items||!items.length)return items;
  const res=await callAi(provider,key,buildVerifyPrompt(items),{temperature:0.1});
  const rows=parseVerifyResult(res);
  if(!rows.length)return items;
  const fix=new Map();
  for(const r of rows){
    if(r.ok)continue;
    if(r.viDung)fix.set(aiZhKey(r.zh),r.viDung);
  }
  if(!fix.size)return items;
  let n=0;
  const out=items.map(it=>{
    const f=fix.get(aiZhKey(it.zh));
    if(f&&f!==it.vi){n++;return {zh:it.zh,py:it.py,vi:f}}
    return it;
  });
  aiVerifyFixedCount+=n;
  return out;
}
function parseAiSentences(text){
  if(!text)return[];
  let t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
  const a=t.indexOf('['),b=t.lastIndexOf(']');
  if(a>=0&&b>a)t=t.slice(a,b+1);
  let arr=null;
  try{arr=JSON.parse(t)}catch(e){}
  if(!Array.isArray(arr)){
    const objs=t.match(/\{[^{}]*\}/g)||[];
    arr=objs.map(o=>{try{return JSON.parse(o)}catch(e){return null}}).filter(Boolean);
  }
  if(!Array.isArray(arr))return[];
  const out=[];let skipped=0;
  for(const x of arr){
    if(!x)continue;
    let zh=String((x&&x.zh)||'').trim();
    const py=fixPinyin((x&&(x.py||x.p))||'');
    const vi=aiRowVi(x);
    if(!zh||!/[\u3400-\u9fff]/.test(zh))continue;
    // ★ Sửa câu có chữ Latin lẫn trong chữ Hán (vd Gemini trả "AAA" thay vì "A")
    const san=sanitizeLatinInChinese(zh,py);
    if(!san.ok)continue;            // bỏ câu không sửa được, để AI tạo câu khác
    if(san.changed){zh=san.zh;}
    const pyF=san.changed?san.py:py;
    /* ★ Lọc chất lượng: câu lỗi cơ bản (lệnh chữ Hán–pinyin, thiếu nghĩa…)
       thì bỏ, không đưa vào bài học. */
    if(!aiItemOk(zh,pyF,vi)){skipped++;continue}
    out.push({zh,py:pyF,vi});
  }
  out.skipped=skipped;
  return out;
}

// ★ Gọi AI theo từng đợt nhỏ rồi lặp lại cho tới khi đủ số câu mong muốn
//   (API AI miễn phí thường trả thiếu câu → tự gọi lại, đồng thời tránh trùng lặp)
async function aiCollect(provider,key,userText,target,level,seen,onProgress,kind){
  const CHUNK=10;
  const maxTries=Math.min(10,Math.ceil(target/CHUNK)+6);
  let out=[],tries=0,emptyTries=0,failTries=0,stopped='',skipped=0;
  while(out.length<target&&tries<maxTries){
    tries++;
    if(onProgress)onProgress(out.length,target,tries);
    try{
      const text=await callAi(provider,key,buildAiPrompt(userText,CHUNK,level,[...seen],kind));
      const parsed=parseAiSentences(text);
      const got=parsed.filter(x=>!seen.has(x.zh));
      skipped+=parsed.skipped||0;                       // câu bị loại vì lỗi chất lượng
      if(!got.length){emptyTries++;if(emptyTries>=2){stopped='AI không tạo thêm được câu mới';break}}
      else{emptyTries=0;got.forEach(x=>seen.add(x.zh));out=out.concat(got)}
    }catch(e){
      failTries++;
      if(!out.length&&failTries>=3)throw e;              // lỗi liên tục mà chưa lấy được gì → báo lỗi
      if(failTries>=5){stopped='máy chủ AI lỗi liên tục';break}
      await new Promise(r=>setTimeout(r,900));           // nghỉ chút rồi thử lại
    }
  }
  if(out.length>target)out=out.slice(0,target);   // giữ đúng số câu đã chọn
  /* ★ SOÁT LẠI NGHĨA VIỆT ↔ CHỮ HÁN trước khi đưa vào bài học.
     Không có bước này thì nghĩa sai vẫn lọt (vd 批量 → "số lượng lớn").
     Lỗi mạng / AI không trả lời → giữ nguyên bản, KHÔNG chặn việc học. */
  if(out.length&&aiVerifyEnabled()){
    try{
      aiSetStatus('🔍 Đang soát lại nghĩa tiếng Việt cho khớp với chữ Hán…');
      out=await aiVerifyMeanings(out,provider,key);
      aiSetStatus('');
    }
    catch(e){ /* bỏ qua: thà học với nghĩa gốc còn hơn không có gì để học */ try{aiSetStatus('')}catch(_){} }
  }
  return {items:out,stopped:stopped,tries:tries,skipped:skipped};
}


// ★ AI viết thêm câu cho bộ đang học (không giới hạn số lượng)

function loadProgress(id){try{return JSON.parse(localStorage.getItem(progressKey(id))||'null')}catch{return null}}
/* ★ Reset trạng thái runtime của phiên (mốc đo tốc độ CPM) */
function resetSessionRuntime(){sentStartTs=0}
function save(){if(!activeDataset)return;if(mode==='all'){mainOrder=[...order];mainIndex=index}localStorage.setItem(progressKey(activeDataset.id),JSON.stringify({mainOrder,mainIndex,stats,wrongIds:[...wrongIds],autoSound,speechRate,selectedVoiceName,showVietnamese,showHanzi,readOnType,lastStudiedAt:Date.now()}))}


/* ── Export / Import tiến độ ── */
// ★ Xuất theo TÊN bộ câu để có thể khôi phục trên máy/trình duyệt khác
async function exportProgress(){
  const sets=await dbGetAll();
  if(!sets.length){toast('Chưa có dữ liệu để xuất.','warn');return}
  const items=[];
  for(const ds of sets){
    const p=loadProgress(ds.id);
    if(p)items.push({name:ds.name,progress:p});
  }
  if(!items.length){toast('Chưa có tiến độ nào để xuất.','warn');return}
  const payload={app:'ChineseTypingStudio',version:1,exportedAt:Date.now(),items};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='chinese-typing-progress-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Đã xuất tiến độ '+items.length+' bộ câu.','ok');
}
async function importProgress(file){
  try{
    const data=JSON.parse(await file.text());
    if(!data||data.app!=='ChineseTypingStudio'||!Array.isArray(data.items))throw new Error('File không đúng định dạng tiến độ.');
    const sets=await dbGetAll();
    let restored=0,skipped=0;
    for(const item of data.items){
      const ds=sets.find(s=>s.name===item.name);
      if(!ds){skipped++;continue}
      localStorage.setItem(progressKey(ds.id),JSON.stringify(item.progress));
      restored++;
    }
    await renderLibrary();
    if(restored&&!skipped)toast('Đã khôi phục tiến độ '+restored+' bộ câu.','ok');
    else if(restored&&skipped)toast('Khôi phục '+restored+' bộ, bỏ qua '+skipped+' bộ không có trong thư viện.','warn',4600);
    else toast('Không tìm thấy bộ câu nào khớp để khôi phục.','warn',4600);
  }catch(e){toast('Không nhập được tiến độ: '+e.message,'bad',5200)}
}

/* ── File Parsing ── */
/* ★ Nạp lười (lazy-load) thư viện SheetJS/xlsx: chỉ tải từ CDN khi thực sự cần
   (trước đây bị load trên MỌI trang qua thẻ <script> tĩnh → tốn băng thông,
   dễ bị trình chặn CDN làm lỗi). Gọi `await ensureXLSX()` trước khi dùng XLSX. */
let __xlsxLoading=null;
function loadXLSX(){
  if(typeof XLSX!=='undefined')return Promise.resolve();
  if(__xlsxLoading)return __xlsxLoading;
  __xlsxLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>{__xlsxLoading=null;reject(new Error('Không tải được thư viện Excel (mất mạng hoặc CDN bị chặn).'));};
    document.head.appendChild(s);
  });
  return __xlsxLoading;
}
async function ensureXLSX(){ await loadXLSX(); }
// ★ Tách cột "Nghĩa từ" theo dấu | (hỗ trợ thoát \| để nghĩa chứa được dấu |)
// Không dùng regex lookbehind để tương thích cả trình duyệt cũ
function splitWv(raw){
  if(!raw)return[];
  const out=[];let cur='';
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(ch==='\\'&&(raw[i+1]==='|'||raw[i+1]==='｜')){cur+=raw[i+1];i++;continue}
    if(ch==='|'||ch==='｜'){out.push(cur.trim());cur='';continue}
    cur+=ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/* ── Dataset Management ── */
async function openDataset(id){
  const sets=await dbGetAll();
  const ds=sets.find(x=>x.id===id);
  if(!ds)return;
  /* Ghi nhớ đang mở từ màn nào để nút "← ..." quay lại đúng chỗ */
  const aiVisible=!!($('aiCard')&&!$('aiCard').classList.contains('hidden'));
  studyOrigin=aiVisible?'ai':'library';
  aiEndSession();   // rời phiên AI (không lưu gì) nếu đang học câu do AI tạo
  resetSessionRuntime();
  activeDataset=ds;rows=ds.rows;currentFileKey=progressKey(ds.id);
  pinyinHint=false;   // ★ mới vào chế độ gỗ → pinyin luôn ẩn, muốn xem thì bật
  const saved=loadProgress(ds.id);
  const validOrder=o=>Array.isArray(o)&&o.every(i=>Number.isInteger(i)&&i>=0&&i<rows.length);
  if(saved&&validOrder(saved.mainOrder)&&saved.mainOrder.length===rows.length){
    mainOrder=saved.mainOrder;mainIndex=saved.mainIndex||0;
    stats=saved.stats||stats;wrongIds=new Set(saved.wrongIds||[]);
    autoSound=saved.autoSound!==false;speechRate=Number(saved.speechRate)||0.8;
    selectedVoiceName=String(saved.selectedVoiceName||'');
    showVietnamese=saved.showVietnamese!==false;showHanzi=saved.showHanzi!==false;
    readOnType=saved.readOnType!==false;
  }else if(saved&&validOrder(saved.mainOrder)&&saved.mainOrder.length){
    /* ★ Bộ câu ĐÃ LỚN THÊM (AI viết tiếp sau khi lưu) → giữ nguyên tiến độ cũ,
       chỉ nối các câu mới vào CUỐI. Trước đây độ dài lệch là xoá sạch tiến độ
       và xáo lại từ đầu — mất đúng câu người dùng đang học dở. */
    const seen=new Set(),ord=[];
    for(const i of saved.mainOrder){if(!seen.has(i)){seen.add(i);ord.push(i)}}
    for(let i=0;i<rows.length;i++)if(!seen.has(i))ord.push(i);
    mainOrder=ord;mainIndex=Math.min(saved.mainIndex||0,ord.length);
    stats=saved.stats||stats;wrongIds=new Set(saved.wrongIds||[]);
    autoSound=saved.autoSound!==false;speechRate=Number(saved.speechRate)||0.8;
    selectedVoiceName=String(saved.selectedVoiceName||'');
    showVietnamese=saved.showVietnamese!==false;showHanzi=saved.showHanzi!==false;
    readOnType=saved.readOnType!==false;
  }else{
    mainOrder=shuffle(rows.map((_,i)=>i));mainIndex=0;
    stats={correct:0,wrong:0,combo:0,bestCombo:0,attempts:0};wrongIds=new Set();
    autoSound=true;speechRate=.8;selectedVoiceName='';
    showVietnamese=true;readOnType=true;
  }
  mode='all';order=[...mainOrder];index=mainIndex;
  $('rateSelect').value=String(speechRate);
  populateVoiceSelect();updateSoundUI();updateReadTypeUI();updateViUI();updateHanUI();updateModeUI();
  $('libraryCard').classList.add('hidden');
  $('aiCard')?.classList.add('hidden');
  $('appCard').classList.remove('hidden');
  /* ★ Không còn nút "← Thư viện" trên thanh tiêu đề: màn luyện gõ đã có nút
     "← Bộ khác" trong nhóm "📚 Nội dung" — giống hệt màn Luyện phát âm. */
  $('backLibrary').classList.add('hidden');
  /* ★ Màn luyện gõ dùng CHUNG khung với màn Luyện phát âm: khoá trang đúng
     1 khung hình + đổ danh sách bộ câu vào nhóm "📚 Nội dung". */
  document.body.classList.add('studyFit');
  try{ fillAppSource(); }catch(e){}
  render();
  loadHistory();renderAppHistory();
}

/* ★ CẢNH TRÚC TRONG THẺ CÂU — màn Luyện gõ vẽ sẵn trong HTML, màn Luyện phát âm
   nhân bản đúng hình đó để hai thẻ câu trông y hệt nhau (khỏi chép 3KB SVG). */
(function(){
  try{
    const src=document.querySelector('#appCard .qbScenery');
    const box=document.querySelector('#pronCard .pronBox');
    if(src&&box&&!box.querySelector('.qbScenery')){
      box.insertBefore(src.cloneNode(true),box.firstChild);
    }
  }catch(e){}
})();

/* ★ NHÓM "📚 NỘI DUNG" CỦA MÀN LUYỆN GÕ (giống hệt bên Luyện phát âm):
   đang học bộ nào thì hiện bộ đó trước, sau là các bộ đã học, rồi các cấp HSK.
   Chọn bộ khác là đổi ngay tại chỗ, không phải quay ra Thư viện. */
async function fillAppSource(){
  const sel=$('appSource');if(!sel)return;
  const cur=activeDataset?activeDataset.id:'';
  const out=[];
  if(activeDataset){
    out.push({v:'id:'+cur,t:'📌 '+(activeDataset.name||'Bộ đang mở')+' ('+rows.length+')'});
  }else{
    out.push({v:'',t:'🤖 Câu do AI tạo (chưa lưu)'});
  }
  let sets=[];
  try{ sets=await dbGetAll(); }catch(e){ sets=[]; }
  sets.filter(ds=>ds&&ds.builtin&&Array.isArray(ds.rows)&&ds.rows.length&&ds.id!==cur)
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))
      .forEach(ds=>out.push({v:'id:'+ds.id,t:'💾 '+ds.name+' ('+ds.rows.length+')'}));
  /* Cấp HSK nào đã tạo bộ (id "vocab:hskN") thì thôi, không liệt kê 2 lần */
  const have=new Set(sets.map(ds=>ds&&ds.id));
  (VOCAB_GROUPS.hsk||[]).forEach(x=>{
    if('vocab:'+x[0]===cur||have.has('vocab:'+x[0]))return;
    out.push({v:'src:'+x[0],t:'🎓 '+x[1]});
  });
  sel.innerHTML=out.map(o=>'<option value="'+escapeHtml(o.v)+'">'+escapeHtml(o.t)+'</option>').join('');
  sel.value=activeDataset?('id:'+cur):'';
}

/* ── Chinese Word Rendering ── */
/* ★ Bộ tách từ tiếng Hán (maximal matching trên từ điển HSK 3.0).
   Mục đích: nhóm các chữ thuộc CÙNG MỘT TỪ lại với nhau (vd 听见, 你的…)
   để hiển thị chữ trong cùng từ sát nhau, còn giữa các TỪ có khe rộng hơn. */
/* Bộ tách từ tiếng Hán bằng VITERBI có trọng số tần suất.
   → Sửa lỗi greedy maximal-matching chọn nhầm từ dài hiếm (vd "有时" thay vì "时间").
   Với mỗi vị trí, tính chi phí = log(hạng tần suất); chọn đường có tổng chi phí nhỏ nhất. */
function hanziSegCost(w){
  const rank=HANZI_WORDS.get(w);
  if(rank!=null)return Math.log(rank+1);
  return w.length===1?Math.log(12000):Math.log(90000);   /* không có trong từ điển → phạt */
}
function hanziSegAllowed(w){
  return w.length===1||HANZI_WORDS.has(w);
}
/* Tách một chuỗi toàn chữ Hán thành mảng các TỪ (Viterbi, tối đa 4 chữ/từ) */
function hanziSegment(text){
  const chars=Array.from(text),n=chars.length;
  if(!n)return[];
  const best=new Array(n+1).fill(Infinity),back=new Array(n+1).fill(null);
  best[0]=0;
  for(let i=0;i<n;i++){
    if(best[i]===Infinity)continue;
    for(let L=1;L<=4&&i+L<=n;L++){
      const w=chars.slice(i,i+L).join('');
      if(!hanziSegAllowed(w))continue;
      const c=best[i]+hanziSegCost(w);
      if(c<best[i+L]){best[i+L]=c;back[i+L]=L}
    }
  }
  const out=[];let p=n;
  while(p>0){
    const L=back[p];
    if(!L){/* fallback an toàn: lùi 1 ký tự */
      out.unshift(chars[p-1]);p-=1;continue;
    }
    out.unshift(chars.slice(p-L,p).join(''));p-=L;
  }
  return out;
}

function splitChineseByPinyin(q){
  /* ★ Dùng answerWords để đã được tách sẵn âm tiết (sửa lỗi "xiāojí" viết liền) */
  const marked=answerWords(q).marked,text=String(q.zh||'');
  if(!text||text==='—'||!marked.length)return[{text:text||'—',wordIndex:-1,wordEnd:-1}];
  const units=[];
  for(let i=0;i<text.length;){
    const rest=text.slice(i),latin=rest.match(/^[A-Za-z0-9]+/);
    if(latin){units.push({text:latin[0],start:i,end:i+latin[0].length});i+=latin[0].length;continue}
    const ch=text[i];
    if(/[\u3400-\u9fff]/.test(ch))units.push({text:ch,start:i,end:i+1});
    i++;
  }
  if(!units.length)return[{text,wordIndex:-1,wordEnd:-1}];
  /* Bước 1: chia theo token pinyin (mỗi token = 1 âm tiết, hoặc 1 từ latin) */
  const raw=[];let unitPos=0,charPos=0;
  /* ★ ĐẾM SỐ CHỮ HÁN để phát hiện pinyin lệch âm tiết.
     Gemini/AI đôi khi trả pinyin thiếu âm tiết do ERHUA (儿 hoá): "玩儿" → "wánr"
     (1 âm tiết cho 2 chữ). Nếu chia cứng theo số âm tiết thì chữ bị nhóm SAI.
     → Nếu độ lệch ĐÚNG BẰNG số chữ "儿" thì coi là erhua (bình thường, chấp nhận).
       Nếu lệch vì lý do khác → chia theo TỈ LỆ cho khớp. */
  const totalHan=units.filter(u=>/[\u3400-\u9fff]/.test(u.text)).length;
  const erhuaCount=(text.match(/儿/g)||[]).length;
  const unitSeq=[];   // số âm tiết gán cho từng token pinyin
  {
    let up=0;
    for(let i=0;i<marked.length;i++){
      const token=marked[i],next=units[up]?.text||'';
      let take=next&&/[A-Za-z0-9]/.test(next)&&normalize(next)===normalize(token)?1:countPinyinSyllables(token);
      take=Math.max(1,take);
      unitSeq.push(take);
      up+=take;
      if(up>=units.length){for(let k=i+1;k<marked.length;k++)unitSeq.push(countPinyinSyllables(marked[k]));break}
    }
  }
  const totalPy=unitSeq.reduce((a,b)=>a+b,0);
  /* ★ ERHUA: âm tiết kết thúc bằng 'r' (wánr, huìr, nǎr) thực chất ứng với 2 chữ
     Hán (玩+儿). Vì vậy cần +1 slot cho mỗi token như vậy để tổng khớp số chữ Hán.
     Sau khi chia xong, chữ 儿 sẽ tự dính vào chữ trước khi tách từ. */
  const erhuaToks=marked.filter(t=>/(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/i.test(normalize(t).replace(/[^a-zü]/g,''))).length;
  if(erhuaToks>0){
    let added=0;
    for(let i=0;i<unitSeq.length&&added<erhuaToks;i++){
      const plain=normalize(marked[i]).replace(/[^a-zü]/g,'');
      if(/(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/.test(plain)){unitSeq[i]++;added++}
    }
  }
  const totalPy2=unitSeq.reduce((a,b)=>a+b,0);
  if(totalHan>0&&totalPy2!==totalHan){
    /* Phân bổ lại theo tỉ lệ (Bresenham) */
    const scaled=[];let acc=0;
    for(let i=0;i<unitSeq.length;i++){
      acc+=unitSeq[i];
      const target=Math.round(acc*totalHan/totalPy2);
      const prev=scaled.reduce((a,b)=>a+b,0);
      scaled.push(Math.max(1,target-prev));
    }
    let sum=scaled.reduce((a,b)=>a+b,0),guard=0;
    let k=scaled.length-1;
    while(sum!==totalHan&&guard++<1000){
      if(sum>totalHan){if(scaled[k]>1){scaled[k]--;sum--}else k--}
      else{scaled[k]++;sum++}
      if(k<0)k=scaled.length-1;
    }
    for(let i=0;i<unitSeq.length;i++)unitSeq[i]=scaled[i]||1;
  }
  /* Duyệt lại theo unitSeq đã căn chỉnh */
  unitPos=0;charPos=0;
  for(let i=0;i<marked.length;i++){
    const take=unitSeq[i]||1;
    const nextUnit=units[unitPos+take],end=nextUnit?nextUnit.start:text.length;
    raw.push({text:text.slice(charPos,end),charStart:charPos,charEnd:end,wordIndex:i});
    charPos=end;unitPos+=take;
    if(unitPos>=units.length)break;
  }
  if(charPos<text.length&&raw.length)raw[raw.length-1].text+=text.slice(charPos);
  /* ★ ERHUA: chữ "儿" trong zh đã được gộp vào âm tiết trước trong pinyin
     (玩儿 → wánr). Vì vậy raw[i] chứa "玩儿" nhưng pinyin token chỉ có "wánr".
     → Gộp raw[i] (chứa 儿 ở cuối) với raw[i-1] nếu cần, để chữ 儿 nằm cùng nhóm
       với chữ trước nó. Dùng erhuaCount đã tính để biết có bao nhiêu ca cần gộp. */
  if(erhuaCount>0&&raw.length>1){
    for(let i=raw.length-1;i>0&&erhuaCount>0;i--){
      /* piece kết thúc bằng 儿 và độ dài >= 2 → chữ 儿 nằm cuối piece này */
      if(/儿$/.test(raw[i].text)&&raw[i].text.length>=2){
        /* đã đúng nhóm (chữ trước + 儿 nằm cùng piece) → không cần gộp */
        continue;
      }
      /* case: raw[i] CHÍNH LÀ "儿" đứng riêng → gộp vào raw[i-1] */
      if(raw[i].text==='儿'){
        raw[i-1].text+=raw[i].text;
        raw[i-1].charEnd=raw[i].charEnd;
        raw.splice(i,1);
      }
    }
  }
  /* Bước 1.5: tách dấu câu ra khỏi chữ Hán (vd "起。" → "起" + "。") */
  const PUNCT=/[\u3000-\u303f\uff00-\uffef!?,.;:'"()\[\]{}<>\/\\|~`@#$%^&*\-_+=]/;
  const pieces=[];
  raw.forEach(r=>{
    let head=r.text,tail='';
    while(head.length>1&&PUNCT.test(head[head.length-1])){tail=head[head.length-1]+tail;head=head.slice(0,-1)}
    if(head){
      pieces.push({text:head,charStart:r.charStart,charEnd:r.charStart+head.length,wordIndex:r.wordIndex});
      if(tail)pieces.push({text:tail,charStart:r.charStart+head.length,charEnd:r.charEnd,wordIndex:r.wordIndex,punct:true});
    }else{
      pieces.push({text:r.text,charStart:r.charStart,charEnd:r.charEnd,wordIndex:r.wordIndex,punct:true});
    }
  });
  /* Bước 2: TÁCH TỪ trên TOÀN BỘ chuỗi chữ Hán một lần (maximal matching),
     rồi ánh xạ từng TỪ về khoảng pinyin token tương ứng.
     → nhóm đúng cả từ 3-4 chữ (对不起, 没关系, 不好意思…). */
  const hanSeq=pieces.filter(p=>!p.punct&&/[\u3400-\u9fff]/.test(p.text)).map(p=>p.text).join('');
  const wordList=hanziSegment(hanSeq);
  /* ánh xạ: duyệt pieces theo thứ tự, cắt dần theo từng TỪ trong wordList */
  const out=[];let ci=0;      // con trỏ trong pieces (bỏ qua punct)
  let wi=0;                    // con trỏ trong wordList
  let consumed=0;              // số chữ Hán của từ hiện tại đã dùng
  let i=0;
  while(i<pieces.length){
    const part=pieces[i];
    if(part.punct){out.push({text:part.text,charStart:part.charStart,charEnd:part.charEnd,wordIndex:part.wordIndex,wordEnd:part.wordIndex,punct:true});i++;continue}
    /* ghép các piece chữ Hán liền kề cho đến khi đủ 1 TỪ */
    const target=wordList[wi]||'';
    const need=target.length;
    let acc='',startIdx=i,lastWordIndex=part.wordIndex,cs=part.charStart,ce=part.charEnd;
    while(acc.length<need&&i<pieces.length&&!pieces[i].punct&&/[\u3400-\u9fff]/.test(pieces[i].text)){
      acc+=pieces[i].text;
      lastWordIndex=pieces[i].wordIndex;
      ce=pieces[i].charEnd;
      i++;
    }
    if(acc.length>need){/* vượt quá → cắt bớt, phần dư tách ra (trường hợp hiếm) */
      const extra=acc.slice(need);
      ce=ce-extra.length;
      /* tạo piece dư để xử lý tiếp */
      pieces.splice(i,0,{text:extra,charStart:ce,charEnd:ce+extra.length,wordIndex:lastWordIndex});
      acc=acc.slice(0,need);
    }
    out.push({text:acc||part.text,charStart:cs,charEnd:ce,wordIndex:part.wordIndex,wordEnd:lastWordIndex});
    wi++;
    if(wi>=wordList.length){/* còn piece thô (vd Latin) → đẩy nguyên */
      while(i<pieces.length){const p=pieces[i];out.push({text:p.text,charStart:p.charStart,charEnd:p.charEnd,wordIndex:p.wordIndex,wordEnd:p.wordIndex,punct:!!p.punct});i++}
      break;
    }
  }
  /* ★ GỘP ERHUA: một token pinyin có thể ứng với 2 CHỮ HÁN (diǎnr ↔ 点儿).
     Khi đó 2 piece liền kề được gán CÙNG wordIndex (vì cùng 1 âm tiết) → phải
     gộp lại thành 1 nhóm, nếu không pinyin sẽ hiện LẶP trên cả 2 chữ
     ("diǎn" hiện trên 点 VÀ trên 儿). */
  const merged=[];
  for(const p of out){
    const last=merged[merged.length-1];
    if(last&&!last.punct&&!p.punct&&last.wordIndex===p.wordIndex&&last.charEnd===p.charStart){
      last.text+=p.text;last.charEnd=p.charEnd;
    }else{
      merged.push(Object.assign({},p));
    }
  }
  return merged;
}
function renderChineseWords(q,gradeRes){
  const el=$('chinese');el.innerHTML='';
  const marked=answerWords(q).marked;let charCursor=0;
  splitChineseByPinyin(q).forEach(part=>{
    if(part.wordIndex>=0&&!part.punct){
      const pair=document.createElement('span');
      pair.className='hanzi-pair';
      pair.dataset.wordIndex=part.wordIndex;
      pair.dataset.wordEnd=(part.wordEnd!=null?part.wordEnd:part.wordIndex);
      /* ★ Tô đỏ âm tiết gõ SAI, vàng âm tiết sai THANH (sau khi chấm điểm) */
      if(gradeRes&&gradeRes[part.wordIndex]){
        const g=gradeRes[part.wordIndex];
        if(!g.base)pair.classList.add('wBad');
        else if(!g.tone)pair.classList.add('wTone');
      }
      pair.dataset.charStart=charCursor;
      charCursor+=part.text.length;
      pair.dataset.charEnd=charCursor;
      /* Nếu nhóm gộp nhiều token pinyin → hiển thị pinyin của từng âm tiết trong từ đó */
      const pyTexts=[];
      for(let k=part.wordIndex;k<=(part.wordEnd!=null?part.wordEnd:part.wordIndex);k++)pyTexts.push(marked[k]||'');
      const py=document.createElement('span');
      py.className='pinyin-guide';
      py.textContent=pyTexts.join(' ');
      const hz=document.createElement('span');
      hz.className='hanzi-word';
      /* Chữ trong cùng từ: giữ sát nhau, không thêm khe */
      hz.textContent=part.text;
      pair.append(py,hz);el.appendChild(pair);
      // ★ Click để mở bubble Google Dịch phía trên chữ Hán đó (kiểu chatbox nhỏ)
      // Với nhóm nhiều âm tiết, truyền cả khoảng wordIndex để lấy đúng pinyin/nghĩa
      const wEnd=(part.wordEnd!=null?part.wordEnd:part.wordIndex);
      pair.addEventListener('click',e=>{e.stopPropagation();openGoogleTranslate(part.text,part.wordIndex,pair,wEnd)});
      pair.setAttribute('tabindex','0');
      pair.setAttribute('role','button');
      pair.setAttribute('aria-label','Xem nghĩa của '+part.text);
      // ★ Bàn phím: Enter/Space cũng mở nghĩa (a11y)
      pair.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openGoogleTranslate(part.text,part.wordIndex,pair,wEnd)}
      });
    }else{
      const span=document.createElement('span');
      span.textContent=part.text;span.className='hanzi-punct';
      el.appendChild(span);
    }
  });
  updateChineseHighlight();
}
/* ★ Tách pinyin thành các ÂM TIẾT riêng — SỬA LỖI "xiāojí" bị lặp trên mọi chữ.
   AI (Gemini/OpenRouter) và một số file Excel ghi pinyin VIẾT LIỀN
   nhiều âm tiết trong 1 token ("xiāojí", "zhongguo2"). Nếu giữ nguyên:
     • mỗi chữ Hán đều nhận nguyên token → "消" và "极" đều hiện "xiāojí";
     • phần gõ pinyin cũng báo sai vì plain chỉ có 1 âm tiết thay vì 2.
   → Token nào chứa >1 âm tiết thì tách ra. fixPinyin xử lý cả số thanh lẫn
   dấu thanh, và countPinyinSyllables("wánr")=1 nên ERHUA được giữ nguyên. */
function answerWords(q){
  const raw=String(q.py||'').trim().split(/\s+/).filter(Boolean);
  const marked=[],plain=[];
  for(const t of raw){
    if(countPinyinSyllables(t)>1){
      const parts=fixPinyin(t).split(/\s+/).filter(Boolean);
      /* Chỉ nhận khi MỌI mảnh là âm tiết pinyin hợp lệ — tránh phá dữ liệu lạ
         (vd cột pinyin lỡ chứa 1 từ tiếng Anh "chinese"). Không khớp → giữ nguyên. */
      if(parts.length>1&&parts.every(p=>PINYIN_SYLLABLES.has(normalize(p)))){
        if(t[0]!==t[0].toLowerCase())parts[0]=parts[0].charAt(0).toUpperCase()+parts[0].slice(1);
        marked.push(...parts);
        for(const p of parts)plain.push(...normalize(p).split(' ').filter(Boolean));
        continue;
      }
    }
    const cleaned=fixPinyin(t);
    marked.push(cleaned);
    plain.push(...normalize(cleaned).split(' ').filter(Boolean));
  }
  /* ★ SỬA DỮ LIỆU CŨ: bản cũ của fixPinyin tách erhua thành 2 token ("diǎn" + "r").
     Dữ liệu đã lưu trong Thư viện/AI vẫn còn dạng hỏng đó → gộp 'r' trở lại âm
     tiết trước ("diǎn"+"r" → "diǎnr") để hiển thị và gõ pinyin đều đúng.
     Chỉ làm khi marked/plain khớp 1:1 (tránh lệch chỉ số với dữ liệu lạ). */
  if(marked.length===plain.length&&marked.length>1){
    const fm=[],fp=[];
    for(let i=0;i<marked.length;i++){
      const nxt=marked[i+1];
      if(nxt!==undefined&&/^r$/i.test(nxt)&&canTakeErhua(marked[i])){
        fm.push(marked[i]+'r');fp.push(plain[i]+'r');i++;continue;
      }
      fm.push(marked[i]);fp.push(plain[i]);
    }
    return{marked:fm,plain:fp};
  }
  return{marked,plain};
}
/* ── Typing Word Index ── */
/* ★ Vị trí âm tiết đang gõ = âm tiết ứng với chữ HÁN kế tiếp người dùng sẽ gõ
   (dùng để sáng từ trên dòng chữ Hán). */
function currentTypingWordIndex(){
  const q=currentRow();
  if(!q)return-1;
  const total=answerWords(q).marked.length;
  if(awaitingEnter)return Math.max(0,total-1);
  /* Số chữ Hán ĐÃ gõ → âm tiết của chữ ĐANG gõ → sáng đúng chữ đó.
     Phải đếm theo chữ Hán rồi tra danh sách âm tiết cũng theo chữ Hán
     (bỏ dấu câu), nếu không câu có dấu câu sẽ sáng nhầm chữ. */
  const typed=hanChars($('pinyinInput').value).length;
  const list=hanSyllableList(q,hanziAnswer(q).length);
  const idx=typed<list.length?list[typed]:Math.max(0,total-1);
  return Math.min(Math.max(0,idx),Math.max(0,total-1));
}
function updateChineseHighlight(){
  const pairs=document.querySelectorAll('#chinese .hanzi-pair');
  const active=currentTypingWordIndex();
  pairs.forEach(el=>{
    const a=Number(el.dataset.wordIndex||0),b=Number(el.dataset.wordEnd!=null?el.dataset.wordEnd:el.dataset.wordIndex||0);
    el.classList.toggle('active',active>=a&&active<=b);
    el.classList.toggle('done',b<active);
  });
}
function updateWrongBadge(){const b=$('wrongBadge');if(b)b.textContent=wrongIds.size}

/* ── Stats & Render ── */
function currentTotal(){return order.length}
/* ★ Hệ thống điểm mới:
   • Đúng  = số CÂU gõ đúng (hoàn thành)
   • Sai   = số CÂU có ít nhất 1 lần gõ sai (mỗi câu chỉ tính 1 lần, dù gõ sai nhiều ký tự)
   • Combo = chuỗi câu đúng liên tiếp hiện tại (sai là mất chuỗi)
   • Chính xác = Đúng / (Đúng + Sai) */
function renderStatsOnly(){
  const total=currentTotal(),done=Math.min(index,total);
  $('progressText').textContent=done+'/'+total;
  $('correctText').textContent=stats.correct;
  $('wrongText').textContent=stats.wrong;
  $('comboText').textContent=stats.combo;
  $('comboText').title='Cao nhất: '+(stats.bestCombo||0);
  const answered=(stats.correct||0)+(stats.wrong||0);
  $('accuracyText').textContent=(answered?Math.round(stats.correct/answered*100)+'%':'—');
  $('bar').style.width=(total?done/total*100:0)+'%';
  const cpm=$('cpmText');
  if(cpm){const v=speedCpm();cpm.textContent=v?v+' CPM':'—';cpm.title='Tốc độ trung bình: '+v+' ký tự/phút (tính cả phiên này, lưu trên máy)';}
  updateWrongBadge();
}
function render(){
  const total=currentTotal();renderStatsOnly();
  if(aiSessionLive())aiMaybeFill();               // AI tự viết thêm khi sắp hết câu
  if(aiSessionLive()&&!aiSavedSet()){const rb=$('resetBtn');if(rb)rb.classList.add('hidden')}
  else{const rb=$('resetBtn');if(rb)rb.classList.remove('hidden')}
  if(index>=total){
    // ★ Phiên AI: chưa có đủ câu AI đang viết → giữ màn hình chờ, không báo "hoàn thành"
    if(aiSessionLive()&&!aiSession.stopped){
      $('completeArea').classList.add('hidden');
      $('quizArea').classList.remove('hidden');
      $('pinyinInput').value='';$('pinyinInput').readOnly=true;
      $('vietnamese').innerHTML='<span style="opacity:.7">🤖 AI đang viết câu tiếp theo, chờ chút nhé…</span>';
      $('chinese').textContent='⏳';
      $('feedback').className='feedback hidden';$('feedback').innerHTML='';
      aiShowGen('<span class="aiSpinner">AI đang viết câu tiếp theo…</span> (đã có <b>'+rows.length+'</b> câu)');
      return;
    }
    $('quizArea').classList.add('hidden');
    $('completeArea').classList.remove('hidden');
    const doneMsg=aiSavedSet()
      ?('Bạn đã học hết '+rows.length+' '+aiCurrentUnit()+' của bộ “'+aiSavedSet().name+'”. Vào lại màn AI sinh câu để tạo thêm bộ mới nhé.')
      :(aiSessionLive()
        ?('Bạn đã học '+rows.length+' '+aiCurrentUnit()+' do AI tạo cho chủ đề “'+String(aiSession.prompt).slice(0,60)+'”. AI đã hết nội dung mới — đổi chủ đề khác để học tiếp nhé.')
        :(mode==='wrong'?'Bạn đã hoàn thành lượt luyện các câu sai.':'Bạn đã hoàn thành lượt học này. Các câu sẽ không lặp lại cho đến khi bạn bấm Xóa tiến độ.'));
    $('completeArea').querySelector('p').textContent=doneMsg;
    $('restartBtn').textContent=studyOrigin==='ai'?'← AI sinh câu':(mode==='wrong'?'Quay lại tất cả câu':'← Thư viện');
    aiShowGen(aiSessionLive()&&!aiSavedSet()?'Phiên học AI đã kết thúc — không lưu tiến độ.':'');
    return;
  }
  $('quizArea').classList.remove('hidden');
  $('completeArea').classList.add('hidden');
  awaitingEnter=false;curHadError=false;
  const q=currentRow();
  if(!q){ $('feedback').className='feedback hidden'; $('feedback').innerHTML=''; return; }
  const inp=$('pinyinInput');
  inp.disabled=false;inp.readOnly=false;inp.value='';
  lastValidInput='';inp.className='input';
  /* Gợi ý trong ô gõ khớp nội dung: bộ từ vựng thì "của từ", bộ câu thì "cả câu" */
  inp.placeholder=aiCurrentKind()==='word'
    ? 'Gõ chữ Hán của từ — gõ đúng là tự báo Đúng'
    : 'Gõ chữ Hán của cả câu — gõ đúng là tự báo Đúng';
  const kbdNext=$('kbdNextLabel');
  if(kbdNext)kbdNext.textContent='Sang '+aiCurrentUnit();
  resetTypedSpeech();   // câu mới → đếm lại chữ đã đọc từ đầu
  hanWrongSig='';
  sentStartTs=Date.now();
  renderChineseWords(q);
  if(q.vi){$('vietnamese').textContent=q.vi}
  else{$('vietnamese').textContent='—';aiFillMissingVi()}   // thiếu nghĩa → dịch nền rồi tự hiện
  $('feedback').className='feedback hidden';
  $('feedback').innerHTML='';
  // ★ Pinyin mặc định ẨN mỗi khi vào chế độ gõ — bấm nút gợi ý (hoặc 💡 trên bàn phím ảo) để bật
  $('chinese').classList.toggle('show-pinyin',pinyinHint);
  $('hintBtn').textContent=pinyinHint?'💡 Ẩn Pinyin':'💡 Hiện Pinyin';
  $('fileInfo').textContent=aiSavedSet()
    ? ('🤖 '+aiSavedSet().name+' • '+rows.length+' '+aiCurrentUnit()+' • đã lưu')
    : (aiSessionLive()
        ? ('🤖 '+String(aiSession.prompt).slice(0,60)+' • '+rows.length+' '+aiCurrentUnit()+' (không lưu tiến độ)')
        : (activeDataset
            ? (activeDataset.name+' • '+rows.length+' '+aiCurrentUnit()+' • '+wrongIds.size+' câu cần ôn')
            : (rows.length+' '+aiCurrentUnit())));
  gtReset();
  setTimeout(()=>{
    inp.focus();
    if(autoSound&&q.zh&&q.zh!=='—')speakText(q.zh,false);
  },180);
  save();
}

/* ── Mark Correct / Wrong ── */
function markSentenceCorrect(){
  if(awaitingEnter||index>=order.length)return;
  /* ★ Nếu lúc gõ xong đã đọc (chữ cuối + cả câu, hoặc 1 lần cả câu) thì
     KHÔNG đọc lại lần nữa sau 1 giây. */
  const skipSpeech=suppressSentenceSpeech;
  suppressSentenceSpeech=false;
  const inp=$('pinyinInput'),q=currentRow(),completedRowIndex=order[index];
  if(!q)return;
  /* ★ Gõ đúng → ô gõ hiện đáp án CHỮ HÁN (kèm dấu câu gốc) để đối chiếu */
  const ans=String(q.zh||'').trim()||answerWords(q).marked.join(' ');
  inp.value=ans;lastValidInput=ans;
  stats.attempts++;stats.correct++;stats.combo++;stats.bestCombo=Math.max(stats.bestCombo||0,stats.combo);
  /* ★ báo cho bảng xếp hạng: chỉ câu gõ ĐÚNG mới được tính (câu sai không cộng) */
  try{ window.__gpOnSentenceCorrect && window.__gpOnSentenceCorrect(); }catch(e){}
  if(mode==='wrong')wrongIds.delete(q.id);
  awaitingEnter=true;inp.classList.add('ok');inp.readOnly=true;
  $('feedback').className='feedback ok';
  $('feedback').textContent='✓ Chính xác — nhấn Space để sang '+aiCurrentUnit()+' tiếp theo';
  save();renderStatsOnly();updateChineseHighlight();
  recordHistory(q,'ok');   // ★ ghi câu vừa gõ đúng vào lịch sử bên phải
  setTimeout(()=>{
    if(skipSpeech)return;
    if(awaitingEnter&&index<order.length&&order[index]===completedRowIndex&&q.zh&&q.zh!=='—')
      speakText(q.zh,false);
  },1000);
}
function rememberCurrentWrong(){const q=currentRow();if(!q)return;wrongIds.add(q.id);updateWrongBadge()}
/* ★ Mỗi câu chỉ tính 1 lần Sai dù gõ sai nhiều ký tự; sai thì mất combo */
function markSentenceWrong(){
  stats.attempts++;
  if(!curHadError){curHadError=true;stats.wrong++;const q=currentRow();if(q)recordHistory(q,'wrong');}
  stats.combo=0;
  rememberCurrentWrong();
}

/* ═══════════════════════════════════════════════════════════
   ★ LỊCH SỬ GÕ — side panel "Câu đã gõ"
   Theo dõi mỗi câu đã gõ (đúng / sai / khó), lưu localStorage theo
   từng bộ, lọc Hôm nay / Sai / Khó; bấm vào để làm lại, ⭐ để đánh
   dấu khó. Tham khảo quy trình các app học từ vựng (Anki / Duolingo /
   Hack Chinese): gom câu sai + câu đánh dấu khó để ôn lại dễ dàng.
   ═══════════════════════════════════════════════════════════ */
const HIST_KEY_PREFIX='cts:history:';
function histKey(){
  if(aiSessionLive())return HIST_KEY_PREFIX+'ai:'+(aiSession&&aiSession.prompt?String(aiSession.prompt).slice(0,40):'default');
  return HIST_KEY_PREFIX+(activeDataset?activeDataset.id:'__none__');
}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function loadHistory(){
  typingHistory=[];
  try{const raw=localStorage.getItem(histKey());if(raw)typingHistory=JSON.parse(raw)||[]}catch(e){typingHistory=[]}
  typingHistory.sort((a,b)=>(b.ts||0)-(a.ts||0));
}
function saveHistory(){try{localStorage.setItem(histKey(),JSON.stringify(typingHistory))}catch(e){}}
/* ghi/ghi đè 1 câu vào lịch sử (status: 'ok' | 'wrong') */
function recordHistory(q,status){
  if(!q||!q.id)return;
  const t=todayStr();
  let rec=typingHistory.find(r=>r.id===q.id);
  if(!rec){
    rec={id:q.id,zh:'',py:'',vi:'',status:'ok',ts:0,date:''};
    typingHistory.push(rec);
  }
  if(!rec.zh)rec.zh=q.zh||'';
  if(!rec.py)rec.py=(q.py||'').toString();
  if(!rec.vi)rec.vi=q.vi||'';
  rec.status=status;
  rec.ts=Date.now();
  rec.date=t;
  typingHistory.sort((a,b)=>(b.ts||0)-(a.ts||0));
  saveHistory();renderAppHistory();
}
function setHistFilter(f){
  histFilter=f;
  document.querySelectorAll('.appHistoryTab').forEach(b=>{
    const on=b.dataset.tab===f;
    b.classList.toggle('active',on);
    b.setAttribute('aria-selected',on?'true':'false');
  });
  renderAppHistory();
}
function renderAppHistory(){
  const list=$('app-history-list');if(!list)return;
  const totalDone=typingHistory.length;
  const totalWrong=typingHistory.filter(r=>r.status==='wrong').length;
  const badge=$('app-history-done');if(badge)badge.textContent=totalDone+' đã làm';
  const hc=$('historyCount');if(hc)hc.textContent=totalDone;
  const cD=$('app-hist-cnt-done');if(cD)cD.textContent=totalDone;
  const cW=$('app-hist-cnt-wrong');if(cW)cW.textContent=totalWrong;
  const weakList=topWeakWords(50);
  const cWk=$('app-hist-cnt-weak');if(cWk)cWk.textContent=weakList.length;
  /* ★ Tab "Điểm yếu": các âm tiết hay gõ sai (sai > đúng, sai ≥ 2) */
  if(histFilter==='weak'){
    if(!weakList.length){
      list.innerHTML='<div class="appHistoryEmpty">Chưa đủ dữ liệu điểm yếu. Hãy luyện thêm vài câu — app ghi lại những âm tiết bạn hay gõ sai để tạo bộ ôn riêng.</div>';
      return;
    }
    list.innerHTML='<div class="weakList">'+weakList.map(x=>
      '<div class="weakItem"><b class="weakWord">'+escapeHtml(x.w)+'</b>'
      +'<span class="weakNum"><i class="bad">sai '+x.wrong+'</i> · đúng '+x.ok+'</span></div>'
    ).join('')+'</div>';
    return;
  }
  let items=typingHistory;
  if(histFilter==='wrong')items=typingHistory.filter(r=>r.status==='wrong');
  if(!items.length){
    list.innerHTML='<div class="appHistoryEmpty">Chưa có câu nào. Hãy gõ thử vài câu — chúng sẽ hiện ở đây để bạn ôn lại.</div>';
    return;
  }
  const shown=items.slice(0,200);
  list.innerHTML=shown.map(r=>{
    const cls=['appHistoryItem'];
    if(r.status==='wrong')cls.push('isWrong');
    else cls.push('isOk');
    const stt=r.status==='wrong'
      ?'<span class="appHistoryStt bad">Sai</span>'
      :'<span class="appHistoryStt ok">Đúng</span>';
    return '<div class="'+cls.join(' ')+'" role="listitem" data-id="'+escapeHtml(r.id)+'" tabindex="0">'
      +'<div class="appHistoryTop">'+stt+'</div>'
      +'<div class="appHistoryHan">'+escapeHtml(r.zh||'—')+'</div>'
      + (r.py?'<div class="appHistoryPy">'+escapeHtml(r.py)+'</div>':'')
      + (r.vi?'<div class="appHistoryVi">'+escapeHtml(r.vi)+'</div>':'')
      +'<div class="appHistoryMeta"><span class="appHistoryTime">'+fmtHistTime(r.ts)+'</span></div>'
      +'</div>';
  }).join('');
}
function fmtHistTime(ts){
  if(!ts)return'';
  try{
    const d=new Date(ts),now=Date.now(),diff=now-ts;
    if(diff<60000)return'vừa xong';
    if(diff<3600000)return Math.floor(diff/60000)+' phút trước';
    if(diff<86400000)return Math.floor(diff/3600000)+' giờ trước';
    return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  }catch(e){return''}
}
/* ★ Nhảy tới 1 câu theo id (để làm lại).
   LỖI CŨ (đã sửa): id trong `rows` là SỐ, còn id lấy từ DOM (`dataset.id`) là
   CHUỖI → so sánh `===` không bao giờ khớp. Tệ hơn, hàm ĐỔI `mode`/`order`
   TRƯỚC khi biết có tìm thấy câu hay không, rồi `return` → giao diện vẫn hiển
   thị câu cũ nhưng `order` đã thành danh sách mới, nên bộ lọc gõ so với MỘT CÂU
   KHÁC (vd đang xem "现在是零点。" nhưng đòi gõ "谢…" của "谢谢你！").
   Nay: so sánh bằng String(), và chỉ đổi trạng thái SAU KHI đã tìm thấy câu. */
function sameRowId(a,b){return a!=null&&b!=null&&String(a)===String(b)}
function gotoRowById(id){
  if(id==null||id==='')return;
  /* 1) tìm trong lượt hiện tại */
  let target=-1;
  for(let i=0;i<order.length;i++){if(sameRowId(rows[order[i]]&&rows[order[i]].id,id)){target=i;break}}
  if(target<0){
    /* 2) chưa có → tìm trong TOÀN BỘ rows; không thấy thì KHÔNG đụng gì cả */
    let rowIdx=-1;
    for(let i=0;i<rows.length;i++){if(sameRowId(rows[i]&&rows[i].id,id)){rowIdx=i;break}}
    if(rowIdx<0)return;
    mode='all';order=[...Array(rows.length).keys()];target=rowIdx;
    try{updateModeUI()}catch(e){}
  }
  index=target;awaitingEnter=false;curHadError=false;hanWrongSig='';
  if(mode==='all'){mainOrder=[...order];mainIndex=index}
  const inp=$('pinyinInput');
  inp.readOnly=false;inp.classList.remove('ok','bad');
  render();renderAppHistory();
  setTimeout(()=>{try{inp.focus()}catch(e){}},60);
}

function flashWrong(){
  const inp=$('pinyinInput');
  inp.classList.remove('ok');inp.classList.add('bad');
  $('feedback').className='feedback bad';
  /* ★ Phát hiện bàn phím tiếng Việt đang bật → nhắc TẮT thay vì báo "ký tự sai" */
  $('feedback').textContent=hasVietnameseChars(inp.value)
    ? '⚠️ Bạn đang bật GÕ TIẾNG VIỆT (Telex / VNI / UniKey / Gboard) — chữ bị biến dạng nên app báo sai. Hãy TẮT gõ tiếng Việt (chuyển bàn phím về English) rồi gõ lại.'
    : '✗ Ký tự vừa nhập không đúng. Hãy sửa đúng rồi mới gõ tiếp.';
  setTimeout(()=>inp.classList.remove('bad'),260);
}

/* ═══════════════════════════════════════════════════════════
   ★ FIX LOCKUP: Khi người dùng gõ sai, KHÔNG xoá sạch input.
   Trước đây code dùng inp.value=lastValidInput — nếu lastValidInput=''
   (câu mới, chưa gõ đúng ký tự nào) thì mọi phím gõ sau đó đều bị xoá
   → người dùng không thể gõ gì được nữa (lockup vĩnh viễn).
   Giải pháp: cắt input đến độ dài giữ được tiền tố hợp lệ dài nhất.
   ═══════════════════════════════════════════════════════════ */
function trimToValidPinyinPrefix(inp,words){
  const plainAll=typingPlain(inp.value).split(' ').filter(Boolean);
  const expectAll=words.plain.map(typingPlain);
  const hasTrailingSpace=/\s$/.test(inp.value);
  let validWordCount=0;
  for(let i=0;i<plainAll.length;i++){
    if(i>=expectAll.length)break;
    if(plainAll[i]===expectAll[i])validWordCount=i+1;
    else break;
  }
  if(validWordCount>=plainAll.length){
    return;
  }
  const validPart=words.marked.slice(0,validWordCount);
  const currentPlain=plainAll[validWordCount]||'';
  const expectedPlain=expectAll[validWordCount]||'';
  let validPrefixLen=0;
  for(let i=0;i<=currentPlain.length;i++){
    if(i<=expectedPlain.length&&expectedPlain.startsWith(currentPlain.slice(0,i))){
      validPrefixLen=i;
    }
  }
  let newVal;
  if(validPrefixLen>0&&validWordCount>0&&validWordCount<expectAll.length){
    /* Có từ đã hoàn thành + đang gõ tiền tố của từ kế tiếp */
    newVal=validPart.join(' ')+' '+words.marked[validWordCount].slice(0,validPrefixLen);
  }else if(validPrefixLen>0&&validWordCount===0){
    /* Chưa hoàn thành từ nào, đang gõ tiền tố của từ đầu tiên */
    newVal=words.marked[0]?words.marked[0].slice(0,validPrefixLen):'';
  }else if(validWordCount>0){
    /* Có từ đã hoàn thành, từ kế tiếp sai hoàn toàn → giữ từ đã xong + space */
    newVal=validPart.join(' ')+' ';
  }else{
    /* Không có gì hợp lệ → input rỗng */
    newVal='';
  }
  inp.value=newVal;
  lastValidInput=newVal;
  if(inp.value.length>0){
    inp.setSelectionRange(inp.value.length,inp.value.length);
  }
}

/* ═══════════════════════════════════════════════════════════
   ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
   · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
   · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
     phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
   · Dấu câu và khoảng trắng không bắt buộc — bỏ qua khi so khớp.
   · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
   ═══════════════════════════════════════════════════════════ */
/* ★ Chữ Hán = CHỮ HÁN THẬT (CJK ideograph) — khoảng trắng, dấu câu Trung,
   chữ Latin/số đều KHÔNG phải chữ Hán cần gõ.
   Trước đây app chỉ "loại trừ dấu câu" nên chữ cái Latin ('n','a' lúc đang gõ
   IME tiếng Trung của máy) bị coi là chữ Hán → bộ lọc "gõ sai không nhận" xoá
   mất, người dùng KHÔNG THỂ GÕ ĐƯỢC chữ nào (lỗi ảnh chụp vòng 21). */
const HAN_CHAR_RE=/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}]/u;
function isHanChar(c){return !!c&&HAN_CHAR_RE.test(c)}
/* Chữ Hán cần gõ của một câu (bỏ dấu câu / khoảng trắng) */
function hanChars(s){return Array.from(String(s??'')).filter(isHanChar)}
function hanziAnswer(q){return hanChars(q.zh)}
/* ★ Chấm theo từng CHỮ — so vị trí với đáp án, trả về mảng {exp,got,ok}
   để tô đỏ đúng chữ người dùng gõ sai hoặc gõ thiếu. */
function gradeHanzi(raw,q){
  const exp=hanziAnswer(q),got=hanChars(raw);
  const n=Math.max(exp.length,got.length),res=[];
  for(let i=0;i<n;i++)res.push({exp:exp[i]||'',got:got[i]||'',ok:!!exp[i]&&exp[i]===got[i]});
  return{res,exp,got};
}
/* Ánh xạ mỗi CHỮ HÁN → chỉ số ÂM TIẾT tương ứng (để cập nhật từ đang gõ
   trên dòng chữ Hán). Erhua (2 chữ 1 âm tiết) thì lấy âm tiết đầu. */
function hanCharSyllables(q){
  const parts=splitChineseByPinyin(q),map=[];
  for(const p of parts){
    const txt=String(p.text||'');
    const end=(p.wordEnd!=null?p.wordEnd:p.wordIndex);
    for(let i=0;i<txt.length;i++)map.push(p.wordIndex<0?-1:Math.min(p.wordIndex+i,end));
  }
  return map;
}
/* ★ Danh sách ÂM TIẾT theo CHỈ SỐ CHỮ HÁN (bỏ dấu câu / khoảng trắng).
   Trước đây nhiều chỗ dùng thẳng hanCharSyllables() — mảng đánh theo VỊ TRÍ
   TRONG CHUỖI GỐC (có dấu câu) — rồi lại lập chỉ số bằng "số chữ đã gõ"
   (chỉ tính chữ Hán). Câu có dấu câu → sáng nhầm chữ / tô đỏ nhầm chữ. */
function hanSyllableList(q,expLen){
  const map=hanCharSyllables(q),src=String(q.zh||''),out=[];
  for(let i=0;i<src.length&&i<map.length;i++)if(isHanChar(src[i]))out.push(map[i]);
  if(expLen&&out.length!==expLen){
    /* dữ liệu lạ (pinyin lệch số âm tiết) → phân bổ theo tỉ lệ để khỏi lệch */
    const total=answerWords(q).marked.length;
    out=Array.from({length:expLen},(_,i)=>Math.min(Math.max(0,Math.round(i*total/expLen)),Math.max(0,total-1)));
  }
  return out;
}
/* HTML đáp án — chữ gõ sai / gõ thiếu tô đỏ */
function hanziDiffHtml(res){
  return res.map(r=>'<span class="'+(r.ok?'':'wBad')+'">'+escapeHtml(r.exp||r.got||'?')+'</span>').join('');
}
/* gotLen = số chữ người dùng ĐÃ gõ (khi đang gõ dở, res dài hơn got) */
function describeHanziGrade(res,gotLen){
  const n=(gotLen!=null?gotLen:res.length);
  const bad=res.slice(0,n).filter(r=>!r.ok).length;
  if(!n)return 'Bạn chưa gõ chữ Hán nào.';
  if(bad)return 'Gõ sai '+bad+'/'+n+' chữ (chữ đỏ bên dưới).';
  return 'Gõ đúng '+n+' chữ — gõ tiếp…';
}
/* ★ Ghi thống kê điểm yếu theo ÂM TIẾT: đúng → mọi âm tiết +1 ok;
   sai → những âm tiết ứng với chữ gõ sai +1 wrong. */
function recordHanziGrade(q,res,ok){
  const w=answerWords(q);
  if(ok){for(const p of w.plain)weakInc(p,true);saveWeak();return}
  const map=hanSyllableList(q,hanziAnswer(q).length),bad=new Set();
  res.forEach((r,i)=>{if(!r.ok&&map[i]>=0&&w.plain[map[i]])bad.add(map[i])});
  for(const s of bad)weakInc(w.plain[s],false);
  saveWeak();
}
/* ═══════════════════════════════════════════════════════════
   ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
   · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
   · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
     phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
   · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
   ═══════════════════════════════════════════════════════════ */
/* ── Gõ tự do: tự chấm ngay khi gõ (không còn bước nhấn Enter kiểm tra) ── */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chữ kế tiếp của đáp án.
   Sai → ký tự KHÔNG vào ô gõ (không hiện, không báo đỏ rắc rối).
   Trả về true nếu đã có ký tự bị chặn. */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chuỗi chữ Hán của đáp án.
   Trước đây hàm này đếm "số chữ Hán" rồi thoát sớm khi không có chữ Hán nào
   (`if(!got.length)return false`) → gõ chữ Latin/số (vd "sdasdasd") KHÔNG bị
   chặn, chữ rác vẫn vào ô. Nay so từng ký tự với đáp án nên MỌI ký tự lạ
   đều bị loại, chỉ chữ Hán đúng thứ tự mới được nhập.
   Trả về true nếu đã có ký tự bị chặn. */
function hanziFilterInput(){
  if(composing||awaitingEnter)return false;
  const inp=$('pinyinInput');
  const raw=inp.value;
  if(!raw)return false;
  const q=currentRow();                 // ★ luôn lấy đúng câu đang hiển thị
  if(!q)return false;
  const tgt=Array.from(String(q.zh||''));
  if(!tgt.length)return false;
  const exp=hanChars(q.zh);            // các chữ Hán phải gõ, đúng thứ tự
  const chars=Array.from(raw);
  /* ★ CHỈ NHẬN TIỀN TỐ ĐÚNG (strict prefix).
     Bản cũ khớp kiểu "dãy con có thứ tự": gõ 东 khi câu là "我家在东边" vẫn được
     nhận (vì 东 có trong đáp án) → ô gõ chứa chuỗi lệch vị trí, chấm điểm báo sai
     nhưng người dùng không hiểu vì sao, và càng gõ càng lệch. Nay mỗi ký tự chỉ
     được nhận khi nó ĐÚNG LÀ ký tự kế tiếp của đáp án; ký tự sai bị loại ngay
     (chỉ loại riêng ký tự đó, phần đã gõ đúng phía trước giữ nguyên).
     Dấu câu do hanziAutoPunct tự chèn cũng được kiểm tra theo đúng vị trí. */
  let pi=0,hi=0,kept='';
  for(const ch of chars){
    if(isHanChar(ch)){
      if(hi<exp.length&&ch===exp[hi]){
        kept+=ch;hi++;
        while(pi<tgt.length&&tgt[pi]!==ch)pi++;
        pi++;
      }
      /* chữ Hán sai vị trí → bỏ, không ảnh hưởng phần đã gõ đúng */
    }else{
      /* dấu câu / khoảng trắng: chỉ nhận khi đúng là ký tự kế tiếp trong đáp án */
      if(pi<tgt.length&&tgt[pi]===ch){kept+=ch;pi++}
    }
  }
  if(kept===raw)return false;          // đang gõ đúng → không can thiệp
  inp.value=kept;
  try{inp.setSelectionRange(kept.length,kept.length)}catch(e){}
  lastValidInput=kept;
  /* ★ Hiệu ứng lỗi: rung ô gõ + viền đỏ để biết vừa gõ sai,
     nhưng ký tự sai KHÔNG vào ô (phần đã gõ đúng được giữ nguyên). */
  hanziInputShake();
  inp.classList.remove('ok');inp.classList.add('bad');
  const next=exp[hi]||'';
  $('feedback').className='feedback bad';
  $('feedback').innerHTML='✗ Chỉ nhận <b>chữ Hán</b> của câu'
    +(next?(' — chữ tiếp theo cần gõ: <b class="wBad">'+escapeHtml(next)+'</b>'):'')
    +'<br/><span style="opacity:.75">Nếu không gõ được chữ Hán, hãy chuyển bàn phím sang <b>tiếng Trung (IME)</b>.</span>';
  return true;
}
/* ★ DẤU CÂU TỰ NẢY ("tôi sẽ không gõ dấu, dấu sẽ tự nảy ra"):
   gõ xong các chữ Hán ngay trước dấu câu trong đáp án → tự thêm dấu đó vào
   ô gõ. Dấu ở CUỐI câu cũng tự nảy khi gõ xong chữ cuối. */
function hanziAutoPunct(){
  if(composing||awaitingEnter)return;
  const inp=$('pinyinInput'),q=currentRow();
  if(!q)return;
  const src=Array.from(String(q.zh||''));
  const typed=hanChars(inp.value).length;
  if(!typed)return;
  /* ★ Dựng lại ĐÚNG tiền tố của đáp án ứng với số chữ Hán đã gõ.
     Cách cũ chỉ NỐI THÊM dấu ở cuối nên: (1) dấu câu ĐẦU câu (「你好」) không
     bao giờ hiện, (2) nếu ô gõ bị lệch, dấu bị nhồi sai chỗ. Nay lấy nguyên
     tiền tố trong đáp án → dấu tự nảy đúng vị trí, kể cả dấu mở đầu câu. */
  let seen=0,i=0;
  while(i<src.length&&seen<typed){if(isHanChar(src[i]))seen++;i++}
  /* ★ Gộp luôn CỤM DẤU CÂU ngay sau chữ Hán vừa gõ ("谢谢" → "谢谢！",
     "你好，世界" → "你好，"). Không có bước này thì dấu ở CUỐI câu không bao
     giờ tự nảy và người dùng phải tự gõ dấu — trái với thiết kế. */
  let j=i;
  while(j<src.length&&!isHanChar(src[j]))j++;
  const prefix=src.slice(0,i).join('')+src.slice(i,j).join('');
  if(prefix&&prefix!==inp.value){
    inp.value=prefix;
    try{inp.setSelectionRange(prefix.length,prefix.length)}catch(e){}
  }
}
function handleAutoTyping(){
  if(composing||index>=order.length||awaitingEnter)return;
  const inp=$('pinyinInput');
  /* ★ Gõ sai → KHÔNG cho nhập: chỉ chữ đúng mới xuất hiện trong ô gõ,
     nhưng CÓ hiệu ứng lỗi rung/đỏ để người dùng biết mình gõ sai. */
  const blocked=hanziFilterInput();
  if(blocked){
    /* ★ Vẫn tính đây là "câu gõ sai" (mỗi câu chỉ tính 1 lần nhờ curHadError)
       — nếu không, vì ký tự sai bị chặn nên bộ đếm Sai/điểm yếu sẽ mãi = 0
       và câu này không được đưa vào danh sách cần ôn. */
    markSentenceWrong();
    updateChineseHighlight();
    return;   // hanziFilterInput() đã tự hiện hiệu ứng lỗi + rung ô gõ
  }
  /* ★ Dấu câu tự nảy (không bắt người dùng gõ dấu) */
  hanziAutoPunct();
  lastValidInput=inp.value;
  inp.classList.remove('bad');
  /* Gõ đúng trở lại → dọn thông báo lỗi cũ cho gọn màn hình */
  const fb=$('feedback');
  if(fb&&fb.classList.contains('bad')&&!awaitingEnter){fb.className='feedback hidden';fb.innerHTML=''}
  updateChineseHighlight();   // sáng từ đang gõ trên dòng chữ Hán
  /* ★ gõ ĐỦ + ĐÚNG cả câu → TỰ báo Đúng */
  const q=currentRow();
  if(!q)return;
  const exp=hanziAnswer(q),got=hanChars(inp.value);
  if(!got.length)return;
  /* ★ Đọc chữ vừa gõ (nếu đang bật). Gọi TRƯỚC checkSentence vì hàm đó khoá
     ô gõ (readOnly) khi gõ đủ cả câu — gọi sau sẽ không đọc được chữ cuối.
     isComplete = đã gõ đủ số chữ của đáp án → nối thêm tiếng đọc cả câu. */
  speakTypedProgress(got.length>=exp.length);
  const bad=got.some((c,i)=>c!==exp[i]);
  if(bad||got.length===exp.length)checkSentence(false);
}

/* ★ Tạo bộ ôn điểm yếu: quét câu chứa các âm tiết hay gõ sai → tạo bộ luyện riêng */
async function buildWeakDataset(){
  const weak=topWeakWords(30);
  if(!weak.length){toast('Chưa đủ dữ liệu điểm yếu — hãy luyện gõ thêm đã.','warn',3400);return}
  const weakSet=new Set(weak.map(x=>x.w));
  const source=(rows&&rows.length)?rows
    :Object.keys(HSK_DATA).flatMap(k=>(HSK_DATA[k]||[]).map(x=>({id:0,zh:x[0],py:x[1],vi:x[2]})));
  const found=[],seen=new Set();
  for(const r of source){
    if(found.length>=120)break;
    const plain=answerWords(r).plain.map(w=>String(w).replace(/[^a-züv]/g,''));
    if(!plain.some(w=>weakSet.has(w)))continue;
    const key=r.zh+'|'+r.py;
    if(seen.has(key))continue;
    seen.add(key);
    found.push({id:found.length,vi:r.vi,py:r.py,zh:r.zh,wv:[]});
  }
  if(!found.length){toast('Không tìm thấy câu nào chứa từ yếu trong bộ hiện tại.','warn',3400);return}
  const id='weak:'+Date.now();
  const ds={id,name:'🎯 Ôn từ yếu ('+found.length+' câu)',sourceName:'Thống kê điểm yếu',rows:found,createdAt:Date.now(),updatedAt:Date.now()};
  await dbPut(ds);
  toast('Đã tạo bộ ôn '+found.length+' câu chứa '+weak.length+' âm tiết hay sai.','ok',4200);
  await openDataset(id);
}

/* ═══════════════════════════════════════════════════════════
   ★ KIỂM TRA (TỰ ĐỘNG khi gõ — không còn bước nhấn Enter):
   - ĐÚNG  → markSentenceCorrect() (báo ✓, đọc lại câu, ghi "Đã làm").
   - SAI   → KHÔNG cho sang câu: tô đỏ chữ sai, giữ nguyên ô gõ, phải sửa
             cho đúng (hoặc bấm "Bỏ qua" để xem đáp án rồi đi tiếp).
   ═══════════════════════════════════════════════════════════ */
function checkSentence(manual){
  if(awaitingEnter)return;
  const inp=$('pinyinInput'),q=currentRow();
  if(!q)return;
  const raw=inp.value;
  /* ★ Giữ mốc thời gian của câu qua các lần gõ sai — chỉ chốt khi gõ ĐÚNG
     (nếu xoá ở lần sai thì lần sửa đúng sẽ mất mốc → không đo được CPM). */
  const startedAt=sentStartTs;
  const {res,exp,got}=gradeHanzi(raw,q);
  const ok=!!got.length&&exp.length===got.length&&res.every(r=>r.ok);
  if(ok){
    speedRecord(got.length,startedAt?Date.now()-startedAt:0);
    sentStartTs=0;hanWrongSig='';
    recordHanziGrade(q,res,true);
    markSentenceCorrect();return;
  }
  if(!got.length)return;   // chưa gõ gì → im lặng chờ
  markSentenceWrong();
  const sig='hz:'+q.id+':'+res.map(r=>r.ok?1:0).join('');
  if(hanWrongSig!==sig){hanWrongSig=sig;recordHanziGrade(q,res,false)}
  /* ★ Sai là phải sửa ngay tại ô gõ — gõ đúng cả câu mới được sang câu */
  $('feedback').className='feedback bad';
  $('feedback').innerHTML='✗ '+escapeHtml(describeHanziGrade(res,got.length))+' Đáp án: '+hanziDiffHtml(res)
    +'<br/>Sửa theo chữ <b class="wBad">đỏ</b> — gõ đúng cả câu là TỰ báo Đúng (hoặc bấm <b>“Bỏ qua”</b>).';
  inp.classList.remove('ok');inp.classList.add('bad');
  markWrongChineseWords(q,res);
  save();renderStatsOnly();updateChineseHighlight();
}
/* Tô đỏ những chữ Hán tương ứng với vị trí gõ sai (hiển thị trên dòng chữ Hán).
   ★ Trước đây `tone:true` được hard-code khiến class .wTone (báo SAI THANH, màu
   vàng) KHÔNG BAO GIỜ được gán → các âm tiết có dấu thanh không đổi màu khi gõ.
   Nay dùng bảng điểm đã chấm: base = chữ Hán đúng, tone = dấu thanh đúng. */
function markWrongChineseWords(q,res){
  const w=answerWords(q);
  const g=w.marked.map(()=>({base:true,tone:true}));
  const map=hanSyllableList(q,hanziAnswer(q).length);
  /* 1) chữ Hán gõ sai → base sai (đỏ) */
  res.forEach((r,i)=>{
    const s=map[i];
    if(s==null||s<0)return;
    const got=Array.from(String(r.got||'')).filter(isHanChar).join('');
    if(got&&got===r.exp)g[s].tone=false;   // chữ đúng, hợp lệ chỉ sai ở mức thanh
    else g[s].base=false;                  // chữ khác → sai hoàn toàn
  });
  /* 2) thanh pinyin gõ sai (chỉ khi người dùng gõ pinyin có dấu) → tone sai (vàng) */
  const typedPy=typedToneSignals();
  if(typedPy)applyTypedToneMarks(q,g,typedPy);
  renderChineseWords(q,g);
}
/* ★ Thu thập "dấu thanh người gõ" từ nội dung ô gõ.
   Khi gõ CHỮ HÁN bằng IME tiếng Trung, ô gõ không chứa pinyin nên không có
   tín hiệu thanh nào → trả null (không tô vàng, không tô nhầm).
   Khi gõ pinyin (bàn phím ảo / ô gõ pinyin), các âm tiết có dấu sẽ ra tín hiệu. */
function typedToneSignals(){
  const raw=$('pinyinInput').value||'';
  if(!/[āáǎàēéěèōóǒòīíǐìūúǔùǖǘǚǜ]/.test(raw))return null;
  return raw;
}
/* So dấu thanh của các âm tiết người gõ với đáp án → tô vàng .wTone */
function applyTypedToneMarks(q,g,raw){
  const w=answerWords(q);
  const typed=normalize(raw).split(/\s+/).filter(Boolean);
  let i=0;
  for(const exp of w.plain){
    if(i>=typed.length)break;
    const got=typed[i++];
    if(!exp||!got)continue;
    const ge=stripToneMarks(exp).tones[0]||0;
    const gt=stripToneMarks(got).tones[0]||0;
    /* chỉ tô vàng khi CÙNG âm tiết (bỏ dấu khớp) nhưng THANH khác */
    if(stripToneMarks(exp).plain===stripToneMarks(got).plain&&ge!==gt&&i-1<g.length)g[i-1].tone=false;
  }
}

/* ★ "Lưới an toàn" cho phím Space: ô gõ đã chứa ĐÚNG toàn bộ chữ Hán của mục
   đang hiện chưa? Dùng khi awaitingEnter chưa kịp bật (IME vừa chốt chữ bằng
   Space, AI vừa chèn mục mới, màn hình vừa render lại…) — để cú bấm Space
   không bị nuốt mất. */
function hanziComplete(){
  const q=currentRow();if(!q)return false;
  const inp=$('pinyinInput');if(!inp)return false;
  const exp=hanziAnswer(q),got=hanChars(inp.value);
  return !!got.length&&got.length===exp.length&&got.every((c,i)=>c===exp[i]);
}
function goNextAfterCorrect(){
  if(!awaitingEnter)return;
  awaitingEnter=false;
  $('pinyinInput').readOnly=false;
  /* Hết danh sách → vẫn phải render() để hiện màn "đang chờ AI viết tiếp" /
     "hoàn thành", tránh kẹt ở mục cuối mà bấm Space không có phản ứng gì. */
  if(index<order.length)index++;
  save();render();
}
/* ═══════════════════════════════════════════════════════════
   ★ QUAY LẠI CÂU TRƯỚC — nút "◀ Câu trước" + phím Backspace khi đã gõ đúng.
   Hoàn tác đúng phần thống kê đã cộng cho câu vừa rời đi, nếu không quay lại
   làm lại sẽ bị cộng điểm 2 lần (Đúng/Sai lệch).
   · Câu trước đã gõ ĐÚNG  → trừ 1 Đúng (làm lại đúng sẽ cộng lại → net 0).
   · Câu trước đã gõ SAI   → đánh dấu curHadError để KHÔNG tính Sai lần nữa.
   ═══════════════════════════════════════════════════════════ */
function goPrevSentence(){
  if(index<=0)return;
  index--;
  awaitingEnter=false;hanWrongSig='';sentStartTs=Date.now();
  const prevQ=rows[order[index]];
  curHadError=false;
  if(prevQ&&typeof typingHistory!=='undefined'){
    const rec=typingHistory.find(r=>r.id===prevQ.id);
    if(rec){
      if(rec.status==='ok'){
        stats.correct=Math.max(0,stats.correct-1);
        stats.combo=0;
      }else{
        /* đã từng tính Sai cho câu này → giữ nguyên, đừng cộng lặp */
        curHadError=true;
      }
    }
    if(mode==='wrong'&&prevQ)wrongIds.delete(prevQ.id);
  }
  const inp=$('pinyinInput');
  inp.readOnly=false;inp.classList.remove('ok','bad');
  const fb=$('feedback');
  if(fb){fb.className='feedback hidden';fb.innerHTML=''}
  save();render();
  setTimeout(()=>inp.focus(),60);
}

/* ── Speech Synthesis ── */
function getChineseVoices(){
  return window.speechSynthesis.getVoices().filter(v=>
    /^zh/i.test(v.lang)||
    /Chinese|Mandarin|Xiaoxiao|Xiaoyi|Xiaomo|Xiaoxuan|Xiaohan|Yaoyao|Huihui|Yunxi|Yunjian|Yunyang|Yunhao|Yunze|Yunfeng|Kangkang/i.test(v.name)
  );
}
function voiceGender(v){
  const n=v.name.toLowerCase();
  if(/yunxi|yunjian|yunyang|yunhao|yunze|yunfeng|kangkang|danny|male/.test(n))return'male';
  if(/xiaoxiao|xiaoyi|xiaomo|xiaoxuan|xiaohan|yaoyao|huihui|female/.test(n))return'female';
  return'unknown';
}
function voiceLabel(v){
  const g=voiceGender(v);
  return(g==='male'?'👨 ':g==='female'?'👩 ':'🎤 ')+v.name+' — '+v.lang;
}
function populateVoiceSelect(){
  const select=$('voiceSelect');if(!select)return;
  const voices=getChineseVoices().sort((a,b)=>{
    const ga=voiceGender(a),gb=voiceGender(b);
    const rank={male:0,female:1,unknown:2};
    return rank[ga]-rank[gb]||a.name.localeCompare(b.name);
  });
  const current=selectedVoiceName;
  select.innerHTML='<option value="">Tự động chọn</option><option value="__male__">👨 Giọng nam</option><option value="__female__">👩 Giọng nữ</option>'+voices.map(v=>`<option value="${escapeHtml(v.name)}">${escapeHtml(voiceLabel(v))}</option>`).join('');
  if(current&&(current==='__male__'||current==='__female__'||voices.some(v=>v.name===current)))select.value=current;
  else{select.value='';if(current)selectedVoiceName=''}
}
function getChineseVoice(){
  const voices=getChineseVoices();
  if(selectedVoiceName==='__male__')return voices.find(v=>voiceGender(v)==='male')||voices.find(v=>/^zh(-|_)?CN/i.test(v.lang))||voices[0];
  if(selectedVoiceName==='__female__')return voices.find(v=>voiceGender(v)==='female')||voices.find(v=>/^zh(-|_)?CN/i.test(v.lang))||voices[0];
  return voices.find(v=>v.name===selectedVoiceName)||voices.find(v=>/^zh(-|_)?CN/i.test(v.lang))||voices[0];
}
/* ★ Đọc NHIỀU đoạn nối tiếp nhau (không cắt nhau như speakText).
   Dùng khi cần "đọc chữ cuối rồi đọc lại cả câu": cancel() 1 lần rồi
   đẩy lần lượt các utterance vào hàng đợi của speechSynthesis. */
function speakQueue(texts){
  if(!('speechSynthesis'in window))return;
  const list=(Array.isArray(texts)?texts:[texts]).filter(t=>t&&String(t).trim());
  if(!list.length)return;
  window.speechSynthesis.cancel();
  const voice=getChineseVoice();
  for(const text of list){
    const utter=new SpeechSynthesisUtterance(text);
    utter.lang='zh-CN';utter.rate=speechRate;
    if(voice)utter.voice=voice;
    if(selectedVoiceName==='__male__'&&voiceGender(voice||{})!=='male')utter.pitch=0.78;
    window.speechSynthesis.speak(utter);
  }
}
function speakText(text,showButtonState=false){
  if(!text||!('speechSynthesis'in window))return;
  window.speechSynthesis.cancel();
  const utter=new SpeechSynthesisUtterance(text);
  utter.lang='zh-CN';utter.rate=speechRate;
  const voice=getChineseVoice();
  if(voice)utter.voice=voice;
  if(selectedVoiceName==='__male__'&&voiceGender(voice||{})!=='male')utter.pitch=0.78;
  const btn=$('audioBtn');
  if(showButtonState){
    btn.classList.add('speaking');
    btn.innerHTML='🔊 <span>Đang phát...</span>';
    const reset=()=>{btn.classList.remove('speaking');btn.innerHTML='🔊 <span>Nghe câu tiếng Trung</span>'};
    utter.onend=reset;utter.onerror=reset;
  }
  window.speechSynthesis.speak(utter);
}
function speakChinese(){
  if(!('speechSynthesis'in window)){toast('Trình duyệt không hỗ trợ đọc tiếng. Hãy mở bằng Chrome hoặc Edge.','warn');return}
  const q=currentRow();
  if(!q)return;
  if(!q.zh||q.zh==='—'){toast('Câu này không có chữ Hán.','warn');return}
  speakText(q.zh,true);
}

/* ── Word Speech ── */
function countPinyinSyllables(token){
  const t=normalize(token).replace(/[^a-züv]/g,'');
  if(!t)return 1;
  const groups=t.match(/[aeiouüv]+/g);
  return Math.max(1,groups?groups.length:1);
}
function chineseSpeechUnits(text){
  const units=[];
  for(let i=0;i<text.length;){
    const rest=text.slice(i),latin=rest.match(/^[A-Za-z0-9]+/);
    if(latin){units.push(latin[0]);i+=latin[0].length;continue}
    const ch=text[i];
    if(/[\u3400-\u9fff]/.test(ch))units.push(ch);
    i++;
  }
  return units;
}
function wordChineseText(q,wordIndex){
  const marked=answerWords(q).marked,units=chineseSpeechUnits(q.zh||'');
  let pos=0;
  for(let i=0;i<marked.length;i++){
    const token=marked[i],next=units[pos]||'';
    let take=next&&/[A-Za-z0-9]/.test(next)&&normalize(next)===normalize(token)?1:countPinyinSyllables(token);
    const piece=units.slice(pos,pos+take).join('');
    if(i===wordIndex)return piece||token;
    pos+=take;
  }
  return marked[wordIndex]||'';
}
function speakCompletedWord(wordIndex){
  if(!autoSound||index>=order.length||!('speechSynthesis'in window))return;
  speakText(wordChineseText(rows[order[index]],wordIndex),false);
}

/* ═══════════════════════════════════════════════════════════
   ★ ĐỌC CHỮ VỪA GÕ (bật/tắt độc lập, không phụ thuộc nút "Tự đọc")
   • Gõ ĐÚNG 1 chữ Hán → đọc ngay chữ đó.
   • Gõ/dán NHIỀU chữ một lúc (IME giữ cụm, dán chuỗi) → đọc GỘP 1 LẦN:
     gõ ra "请确认" (3 chữ trong 1 sự kiện input) → đọc "请确认" một lần,
     KHÔNG đọc 3 lần liên tiếp.
   • ★ CHỮ CUỐI CÙNG cũng được đọc: hàm chỉ đọc PHẦN MỚI thêm vào so với
     lần đọc trước, nên chữ cuối luôn nằm trong phần mới → không bị bỏ sót
     (lỗi hay gặp: chỉ đọc các chữ ở giữa, rơi mất chữ cuối câu).
   ═══════════════════════════════════════════════════════════ */
function speakTypedProgress(isComplete){
  if(!readOnType||!('speechSynthesis'in window)||composing||awaitingEnter)return;
  const inp=$('pinyinInput'),q=currentRow();
  if(!q)return;
  const got=hanChars(inp.value).join('');
  /* Người dùng xoá lùi (Backspace) hoặc sửa lại → đồng bộ mốc, KHÔNG đọc */
  if(got.length<lastTypedSpoken.length||!got.startsWith(lastTypedSpoken)){lastTypedSpoken=got;return}
  if(got.length===lastTypedSpoken.length)return;      // không có chữ mới
  const fresh=got.slice(lastTypedSpoken.length);       // đúng phần vừa gõ thêm
  lastTypedSpoken=got;
  if(isComplete){
    /* ★ Gõ xong câu: nối tiếp "chữ vừa gõ" → "cả câu" trong cùng hàng đợi.
       Nếu để markSentenceCorrect() đọc cả câu riêng sau 1s thì lệnh
       speechSynthesis.cancel() sẽ CẮT NGANG tiếng chữ cuối đang đọc. */
    suppressSentenceSpeech=true;
    speakQueue([fresh,String(q.zh||'')]);
  }else{
    speakText(fresh,false);
  }
}
/* Sang câu mới / làm lại → gạch đếm lại từ đầu */
function resetTypedSpeech(){lastTypedSpoken=''}

/* ═══════════════════════════════════════════════════════════
   ★ ÂM THANH HIỆU ỨNG (Web Audio API) — KHÔNG cần file ngoài
   • sfxShot(): tiếng "bắn" rất ngắn (~90ms) mỗi khi gõ ĐÚNG 1 ký tự.
     Trộn 2 lớp: nhiễu trắng qua bandpass (tiếng "bụp") + sóng vuông
     quét tần số từ cao xuống thấp (tiếng "pew").
   • Cao độ hơi ngẫu nhiên mỗi phím → nghe tự nhiên, không đều đều.
   • AudioContext chỉ tạo ở lần bấm phím đầu tiên (đúng cử chỉ người
     dùng) nên không bị chính sách autoplay của trình duyệt chặn.
   ═══════════════════════════════════════════════════════════ */
let _sfxAC=null,_sfxMaster=null;
function sfxCtx(){
  if(_sfxAC)return _sfxAC;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  try{
    _sfxAC=new AC();
    _sfxMaster=_sfxAC.createGain();
    _sfxMaster.gain.value=0.5;               /* âm lượng tổng — vừa phải, không chói */
    _sfxMaster.connect(_sfxAC.destination);
  }catch(e){_sfxAC=null}
  return _sfxAC;
}
/* power: 1 = gõ 1 ký tự, >1 = nổ khi gõ xong cả từ */
function sfxShot(power){
  const ac=sfxCtx();
  if(!ac||!_sfxMaster)return;
  if(ac.state==='suspended'){try{ac.resume()}catch(e){}}
  const k=power||1;
  const t0=ac.currentTime+0.001;
  try{
    /* 1) nhiễu trắng rất ngắn — tiếng "bụp" của phát bắn */
    const dur=0.05+0.03*k;
    const len=Math.max(1,Math.floor(ac.sampleRate*dur));
    const buf=ac.createBuffer(1,len,ac.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);
    const noise=ac.createBufferSource();noise.buffer=buf;
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.2;
    bp.frequency.setValueAtTime(2200+Math.random()*1200,t0);
    bp.frequency.exponentialRampToValueAtTime(520,t0+dur);
    const gN=ac.createGain();
    gN.gain.setValueAtTime(0.0001,t0);
    gN.gain.exponentialRampToValueAtTime(0.5*k,t0+0.004);
    gN.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    noise.connect(bp);bp.connect(gN);gN.connect(_sfxMaster);
    noise.start(t0);noise.stop(t0+dur+0.01);
    /* 2) "pew" — sóng vuông quét tần số xuống */
    const osc=ac.createOscillator();osc.type='square';
    const f0=(680+Math.random()*220)*Math.min(1.5,k);
    const d2=0.085+0.03*k;
    osc.frequency.setValueAtTime(f0,t0);
    osc.frequency.exponentialRampToValueAtTime(110,t0+d2);
    const gO=ac.createGain();
    gO.gain.setValueAtTime(0.0001,t0);
    gO.gain.exponentialRampToValueAtTime(0.15*k,t0+0.006);
    gO.gain.exponentialRampToValueAtTime(0.0001,t0+d2);
    osc.connect(gO);gO.connect(_sfxMaster);
    osc.start(t0);osc.stop(t0+d2+0.01);
  }catch(e){/* thiết bị không hỗ trợ → bỏ qua, không làm hỏng game */}
}

/* ── Hint / Skip / Reset ── */
/* Cho bàn phím ảo / nơi khác gọi được (ẩn/hiện pinyin — chỉ Enter và nút 💡) */
window.__gpToggleHint=function(){hint()};
function hint(){
  if(index>=order.length)return;
  pinyinHint=!pinyinHint;   // giữ trạng thái qua các câu trong phiên — mặc định ẩn khi mới vào
  $('chinese').classList.toggle('show-pinyin',pinyinHint);
  $('hintBtn').textContent=pinyinHint?'💡 Ẩn Pinyin':'💡 Hiện Pinyin';
  $('pinyinInput').focus();
}
function skip(){
  const q=currentRow();
  if(!q)return;
  const inp=$('pinyinInput');
  markSentenceWrong();                 // câu này tính là sai (nếu chưa tính)
  const ans=String(q.zh||'').trim()||answerWords(q).marked.join(' ');
  awaitingEnter=false;
  inp.readOnly=false;inp.classList.remove('ok','bad');
  toast('⏭ Đã bỏ qua — đáp án: '+ans,'warn',3200);
  index++;save();render();
}
// ★ Làm lại câu hiện tại — xóa nội dung đã gõ, giữ nguyên câu
function retrySentence(){
  const q=currentRow();
  if(!q)return;
  awaitingEnter=false;lastValidInput='';
  const inp=$('pinyinInput');
  inp.value='';inp.readOnly=false;inp.className='input';
  resetTypedSpeech();   // làm lại → đếm lại chữ đã đọc từ đầu
  hanWrongSig='';
  $('feedback').className='feedback hidden';$('feedback').innerHTML='';
  renderChineseWords(q);   // xoá tô đỏ/vàng
  updateChineseHighlight();inp.focus();
}
async function resetProgress(){
  if(!activeDataset)return;   // phiên AI không lưu tiến độ → không có gì để xoá
  if(!await appConfirm('Xóa tiến độ và danh sách câu sai của riêng bộ này?',{title:'Xóa tiến độ',okText:'Xóa',danger:true}))return;
  localStorage.removeItem(progressKey(activeDataset.id));
  mainOrder=shuffle(rows.map((_,i)=>i));mainIndex=0;
  mode='all';order=[...mainOrder];index=0;
  wrongIds=new Set();
  stats={correct:0,wrong:0,combo:0,bestCombo:0,attempts:0};
  autoSound=true;speechRate=.8;selectedVoiceName='';showVietnamese=true;showHanzi=true;pinyinHint=false;readOnType=true;
  resetSessionRuntime();
  $('rateSelect').value='.8';
  populateVoiceSelect();updateSoundUI();updateReadTypeUI();updateViUI();updateHanUI();updateModeUI();save();render();
}

/* ── Mode Switching ──
   ★ Đã bỏ nút chế độ (Tất cả / Câu sai) khỏi thanh công cụ theo yêu cầu —
   giữ lại hàm cho an toàn nếu sau này gọi từ nơi khác (đều có guard null). */
function updateModeUI(){
  const a=$('allModeBtn'),w=$('wrongModeBtn');
  if(a){a.classList.toggle('active',mode==='all');a.setAttribute('aria-pressed',mode==='all'?'true':'false');}
  if(w){w.classList.toggle('active',mode==='wrong');w.setAttribute('aria-pressed',mode==='wrong'?'true':'false');}
  updateWrongBadge();
}
function switchMode(nextMode){
  if(nextMode===mode)return;
  if(mode==='all'){mainOrder=[...order];mainIndex=index}
  mode=nextMode;
  if(mode==='all'){order=[...mainOrder];index=mainIndex}
  else{
    const ids=[...wrongIds];
    if(!ids.length){toast('Hiện chưa có câu sai để luyện.','warn');mode='all';order=[...mainOrder];index=mainIndex;updateModeUI();return}
    const idSet=new Set(ids);
    order=shuffle(rows.map((r,i)=>idSet.has(r.id)?i:null).filter(i=>i!==null));
    index=0;
  }
  awaitingEnter=false;window.speechSynthesis?.cancel();
  updateModeUI();save();render();
}
/* ★ Cập nhật công tắc: KHÔNG ghi đè textContent (sẽ xoá icon + nhãn trong
   HTML). Chỉ đổi icon, class .off và aria-pressed — trạng thái Bật/Tắt do CSS
   hiển thị bằng đèn LED, nhờ vậy nhãn không bị đổi độ dài gây nhảy layout. */
function setToggleUI(id,on,icoOn,icoOff){
  const b=$(id);if(!b)return;
  b.classList.toggle('off',!on);
  b.setAttribute('aria-pressed',on?'true':'false');
  const i=b.querySelector('.tgIco');
  if(i&&icoOn)i.textContent=on?icoOn:(icoOff||icoOn);
}
function updateSoundUI(){
  setToggleUI('soundToggle',autoSound,'🔊','🔇');
}
function toggleAutoSound(){
  autoSound=!autoSound;
  if(!autoSound&&'speechSynthesis'in window)window.speechSynthesis.cancel();
  updateSoundUI();save();
  $('pinyinInput').focus();
}
/* ── Nút "Đọc khi gõ": đọc chữ Hán ngay khi gõ đúng ── */
function updateReadTypeUI(){
  setToggleUI('readTypeToggle',readOnType,'🔈','🔇');
}
function toggleReadType(){
  readOnType=!readOnType;
  resetTypedSpeech();               // bật lại thì đọc từ chữ đang gõ dở
  if(!readOnType&&'speechSynthesis'in window)window.speechSynthesis.cancel();
  updateReadTypeUI();save();
  $('pinyinInput').focus();
}

/* Gợi ý khi ẩn cả hai dòng */
function syncQuizHint(){
  const h=$('quizEmptyHint');
  if(h)h.hidden = showVietnamese || showHanzi;
}

/* ── Vietnamese Toggle ── */
function updateViUI(){
  setToggleUI('viToggle',showVietnamese,'👁️','🚫');
  /* ★ ẩn HẲN cả dòng (kể cả nhãn) thay vì làm mờ chữ */
  $('viLine')?.classList.toggle('vi-hidden',!showVietnamese);
  syncQuizHint();
}
function toggleVietnamese(){
  showVietnamese=!showVietnamese;
  updateViUI();save();
  $('pinyinInput').focus();
}

/* ── Hanzi (chữ Hán) Toggle ── */
function updateHanUI(){
  setToggleUI('hanToggle',showHanzi,'🀄','🀄');
  $('hanLine')?.classList.toggle('vi-hidden',!showHanzi);
  syncQuizHint();
}
function toggleHanziLine(){
  showHanzi=!showHanzi;
  updateHanUI();save();
  $('pinyinInput').focus();
}

/* ═══════════════════════════════════════════════════════════
   ★ BUBBLE GOOGLE DỊCH (kiểu chatbox nhỏ, neo trên chữ Hán)
   ★ Khi bấm vào chữ Hán, hiện bubble nhỏ ngay phía trên
   ★ Tự tắt sau 5 giây, hoặc khi click chữ Hán khác
   ★ KHÔNG chặn gõ phím
   ★ Dùng MyMemory API (chính) + Google Translate (dự phòng)
   ★ Cache kết quả vào localStorage
   ═══════════════════════════════════════════════════════════ */
function viCacheKey(text){return'cts:vi:'+text}
function getCachedVi(text){try{const d=localStorage.getItem(viCacheKey(text));if(d!==null)return JSON.parse(d)}catch{return null}}
// ★ Chỉ cache khi kết quả hợp lệ (không cache null)
function setCachedVi(text,data){if(!data)return;try{localStorage.setItem(viCacheKey(text),JSON.stringify(data))}catch{}}

// ★ MyMemory API — ổn định hơn Google Translate khi gọi từ trình duyệt
// ★ Dịch nghĩa online — GỌI TRỰC TIẾP MyMemory qua HTTPS.
// ⚠ Đã BỎ 2 proxy công khai (allorigins / corsproxy) vì chúng NHÌN THẤY toàn bộ
//   nội dung câu người dùng đang học. Nay chỉ còn 1 kết nối trực tiếp tới MyMemory.
async function fetchMyMemory(text){
  const baseUrl='https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair=zh-CN|vi';
  const urls=[baseUrl];
  for(const url of urls){
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),8000);
      const resp=await fetch(url,{signal:controller.signal});
      clearTimeout(timer);
      if(!resp.ok)continue;
      const data=await resp.json();
      if(data&&data.responseData&&data.responseData.translatedText){
        let tr=data.responseData.translatedText;
        tr=tr.replace(/^(WARNING|MYMEMORY WARNING).*$/im,'').trim();
        if(tr&&tr.length>0)return tr;
      }
      if(data&&data.matches&&Array.isArray(data.matches)){
        for(const m of data.matches){
          if(m&&m.translation&&m.quality>0){
            return m.translation;
          }
        }
      }
    }catch(e){continue}
  }
  return null;
}

// ★ Google Translate API — dự phòng
async function fetchGoogleTranslate(text){
  const baseUrl='https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q='+encodeURIComponent(text);
  const urls=[
    baseUrl,
    'https://api.allorigins.win/raw?url='+encodeURIComponent(baseUrl),
    'https://corsproxy.io/?url='+encodeURIComponent(baseUrl),
  ];
  for(const url of urls){
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),8000);
      const resp=await fetch(url,{signal:controller.signal});
      clearTimeout(timer);
      if(!resp.ok)continue;
      const data=await resp.json();
      if(Array.isArray(data)&&Array.isArray(data[0])){
        const translation=data[0].map(x=>Array.isArray(x)?x[0]:'').filter(Boolean).join('');
        if(translation)return translation;
      }
    }catch(e){continue}
  }
  return null;
}

async function fetchViTranslation(text){
  // Cache trước — dùng truthy check để tránh bug undefined !== null
  const cached=getCachedVi(text);
  if(cached)return cached;
  // Thử MyMemory trước (ổn định hơn), Google Translate làm dự phòng
  let tr=await fetchMyMemory(text);
  if(!tr)tr=await fetchGoogleTranslate(text);
  if(tr){setCachedVi(text,tr);return tr}
  return null;
}

// ★ Tìm Pinyin của 1 từ Hán (từ q.py)
function getWordPinyin(q,wordIndex){
  if(!q||wordIndex<0)return'';
  const marked=answerWords(q).marked;
  return marked[wordIndex]||'';
}

// ★ Tìm nghĩa tiếng Việt của 1 từ (từ cột "Nghĩa từ" trong Excel)
function getWordViMeaning(q,wordIndex){
  if(!q||wordIndex<0)return'';
  return q.wv&&q.wv[wordIndex]?q.wv[wordIndex]:'';
}

// ★ Đóng bubble Google Dịch — ẩn + reset timer + reset nội dung
function gtReset(){
  clearTimeout(window._gtTimer);
  const pop=$('gtPopup');
  if(pop){
    pop.classList.remove('show');
    pop.classList.remove('below');
    pop.setAttribute('aria-hidden','true');
  }
  const body=$('gtBody');
  if(!body)return;
  body.innerHTML=
    '<div class="gtEmpty">'+
      '<div class="gtEmpty-icon">👆</div>'+
      '<div class="gtEmpty-text">Bấm vào chữ Hán<br>để dịch sang tiếng Việt</div>'+
      '<div class="gtEmpty-sub">Bấm chữ Hán → hiện phía trên (tự tắt 5s)</div>'+
    '</div>';
}

// ★ Hiển thị kết quả dịch thành công — chỉ nghĩa, không có nút
function gtShowResult(text,pinyin,viTr,source){
  const body=$('gtBody');
  body.innerHTML=
    '<div class="gtOriginal">'+escapeHtml(text)+'</div>'+
    (pinyin?'<div class="gtPinyin">['+escapeHtml(pinyin)+']</div>':'')+
    '<div class="gtVi">'+escapeHtml(viTr)+'</div>'+
    '<div class="gtSource">Nguồn: '+escapeHtml(source||'MyMemory')+'</div>';
}

// ★ Hiển thị lỗi khi dịch thất bại — chỉ thông báo ngắn
function gtShowError(text,pinyin){
  const body=$('gtBody');
  body.innerHTML=
    '<div class="gtOriginal">'+escapeHtml(text)+'</div>'+
    (pinyin?'<div class="gtPinyin">['+escapeHtml(pinyin)+']</div>':'')+
    '<div class="gtVi gtVi-error">⚠️ Không dịch được</div>';
}

// ★ Hàm dịch + hiển thị
async function runTranslate(text,pinyin){
  const body=$('gtBody');
  if(body)body.querySelector('.gtVi-loading')&&(body.querySelector('.gtVi-loading').textContent='Đang dịch lại sang tiếng Việt...');
  const tr=await fetchViTranslation(text);
  if(tr){
    gtShowResult(text,pinyin,tr,'MyMemory / Google');
  }else{
    gtShowError(text,pinyin);
  }
}

// ★ Hàm được gọi khi click vào 1 chữ Hán → hiện bubble Google Dịch ngay phía trên chữ đó
// ★ Kiểu chatbox nhỏ, tự tắt sau 5s, hoặc khi click chữ Hán khác
function openGoogleTranslate(text,wordIndex,targetEl,wordEnd){
  if(!text||!/[\u3400-\u9fff]/.test(text))return;
  const q=index<order.length?rows[order[index]]:null;
  const wEnd=(wordEnd!=null?wordEnd:wordIndex);
  let pinyin=q?getWordPinyin(q,wordIndex):'', excelMeaning=q?getWordViMeaning(q,wordIndex):'';
  /* ★ Nhóm nhiều âm tiết: ghép pinyin của từng âm tiết lại */
  if(q&&wEnd>wordIndex){
    const pyParts=[];
    for(let k=wordIndex;k<=wEnd;k++){const p=getWordPinyin(q,k);if(p)pyParts.push(p)}
    if(pyParts.length)pinyin=pyParts.join(' ');
  }
  const pop=$('gtPopup');
  const body=$('gtBody');
  if(!pop||!body)return;
  // ★ Hiện popup
  pop.classList.add('show');
  pop.setAttribute('aria-hidden','false');
  // ★ Định vị popup neo trên chữ Hán (targetEl)
  if(targetEl){
    positionGtBubble(pop,targetEl);
  }
  // Hiển thị chữ + pinyin ngay
  body.innerHTML=
    '<div class="gtOriginal">'+escapeHtml(text)+'</div>'+
    (pinyin?'<div class="gtPinyin">['+escapeHtml(pinyin)+']</div>':'');
  // Nếu có nghĩa từ bộ câu (Excel/HSK) — hiện trước, đây là dữ liệu CÓ SẴN, không cần mạng
  if(excelMeaning){
    body.insertAdjacentHTML('beforeend',
      '<div class="gtVi">'+escapeHtml(excelMeaning)+'</div>'
    );
  }
  // Thêm dòng loading cho bản dịch
  body.insertAdjacentHTML('beforeend',
    '<div class="gtVi gtVi-loading">Đang dịch...</div>'
  );
  // Gọi API dịch
  runTranslate(text,pinyin);
  // ★ Tự tắt sau 5 giây (reset timer mỗi lần click chữ mới)
  clearTimeout(window._gtTimer);
  window._gtTimer=setTimeout(gtReset,5000);
}

// ★ Định vị bubble: neo phía trên target, căn giữa theo chiều ngang
// ★ Nếu không đủ chỗ phía trên → hiện phía dưới
function positionGtBubble(pop,targetEl){
  const rect=targetEl.getBoundingClientRect();
  const popRect=pop.getBoundingClientRect();
  const pad=8;
  // Căn giữa ngang theo target
  let left=rect.left+rect.width/2-popRect.width/2;
  left=Math.max(pad,Math.min(left,window.innerWidth-popRect.width-pad));
  // Mặc định: hiện phía trên target
  let top=rect.top-popRect.height-10;
  // Nếu không đủ chỗ phía trên (ví dụ chữ ở mép trên) → hiện phía dưới
  if(top<pad){
    top=rect.bottom+10;
    pop.classList.add('below');
  }else{
    pop.classList.remove('below');
  }
  // Dùng position:absolute với toạ độ đã cộng scrollY để bubble ổn định khi cuộn trang
  pop.style.left=left+'px';
  pop.style.top=(top+window.scrollY)+'px';
}

/* ★ Từ điển từ→nghĩa Tiếng Việt cho game (chỉ chứa NGHĨA CỦA TỪ, không phải nghĩa câu).
   Reveal chỉ hiện nghĩa khi có trong đây; không có thì chỉ hiện chữ + pinyin. */
/* ═══════════════════════════════════════════════════════════
   🎮 GAME BẮN CHỮ (mới) — tham khảo ảnh:
   • Nền xanh đậm + mưa rơi
   • Thẻ từ vựng rơi: nghĩa Việt trên, chữ Hán giữa, pinyin dưới
   • Gõ TOÀN BỘ pinyin để bắn nổ từ. Enter ẩn/hiện pinyin. Sai ký tự → mất điểm + mất combo.
   • 5 mạng mỗi ván (tối đa 10). Thẻ qua vạch −1 mạng; thẻ mang ♥ phá nổ được +1 mạng.
   • Hết mạng → xem quảng cáo để +3 mạng và chơi tiếp.
   ═══════════════════════════════════════════════════════════ */
(function(){
  const $ = id => document.getElementById(id);
  const HAN = /[㐀-鿿]/;
  const stage = $('gameCard');
  const playField = $('gaStage') || $('gameCard');   // vùng vẽ thật (canvas nằm trong đây)
  const shipSvg = $('gaShipSvg');
  const canvas = $('gaCanvas');
  if(!stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  let W=600, H=400, dpr=1;

  const state = {
    level: 2, running: false, paused: false, suspended: false, resumeReady: false,
    speed: 3, sfx: true, maxConcurrent: 3,
    score: 0, lives: 5, maxLives: 10, combo: 0, bestCombo: 0, wordsDone: 0,
    showPinyin: false, shipAngle: 0,
    items: [], particles: [], bullets: [], floats: [], bg: [],
    pool: [], poolIdx: 0,
    buffer: '', locked: null, skipped: new Set(),
    spawnAcc: 0, lastT: 0, rafId: 0,
    flashRed: 0, uid: 1,
    /* ★ stageWords = số từ đã bắn TRONG chặng hiện tại. Trước đây tiến độ chặng
       được suy ra từ wordsDone (reset về 0 mỗi ván) nên khi khôi phục chặng cũ
       (vd chặng 5) thì wordsDone không bao giờ vượt 5*30 → chặng KẸT vĩnh viễn.
       over = đã báo hết mạng (chặn gameOver() bắn nhiều lần). */
    stageWords: 0, over: false,
    stage: 1, themeIdx: 0, banner: null, scene: null
  };

  const SPEED_LABEL = {1:'Siêu chậm',2:'Rất chậm',3:'Chậm',4:'Vừa',5:'Vừa',6:'Khá',7:'Khá',8:'Nhanh',9:'Nhanh',10:'Siêu nhanh'};

  /* ★ Chặng (stage): mỗi chặng = STAGE_SIZE từ. Qua chặng → đổi cả nền game.
     Mỗi nền là một PHONG CẢNH riêng (thành phố mưa, núi tuyết, vũ trụ, rừm thu,
     hoàng hôn, biển đêm, hoa anh đào, thành phố neon) + hạt rơi tương ứng.
     Chủ đề được RANDOM khi mở game và khi đổi chặng (khác chủ đề trước đó).
     Nền luôn TỐI (chủ đạo tối) dù app đang sáng hay tối. */
  const STAGE_SIZE = 30;
  const THEMES = [
    { id:'rain',   bg1:'#0a1228', bg2:'#0d1a35', scene:'city',     part:'rain'  },
    { id:'snow',   bg1:'#0b1430', bg2:'#122a44', scene:'mountain', part:'snow'  },
    { id:'space',  bg1:'#05050f', bg2:'#140b2a', scene:'planet',   part:'star'  },
    { id:'autumn', bg1:'#1a1005', bg2:'#2c1a09', scene:'forest',   part:'leaf'  },
    { id:'dusk',   bg1:'#241029', bg2:'#4a2340', scene:'sunset',   part:'dust'  },
    { id:'sea',    bg1:'#04101c', bg2:'#07263a', scene:'sea',      part:'dust'  },
    { id:'sakura', bg1:'#1a0a18', bg2:'#33132c', scene:'sakura',   part:'petal' },
    { id:'neon',   bg1:'#0a0716', bg2:'#1a0a2e', scene:'neon',     part:'dust'  },
  ];
  /* Chủ đề ngẫu nhiên (KHÁC chủ đề đang có) */
  function randTheme(exclude){
    if(THEMES.length < 2) return 0;
    let i; do{ i = Math.floor(Math.random()*THEMES.length); }while(i === exclude);
    return i;
  }

  /* ü được gõ bằng "v" (quy ước pinyin: 女 nǚ → "nv"). Vẫn chấp nhận "u"
     tương đương "v" khi đích là ü để người quen gõ cũ không bị kẹt. */
  function plainPinyin(py){
    try{
      const {plain} = stripToneMarks(String(py||''));
      return plain.toLowerCase().replace(/ü/g,'v').replace(/[^a-z]/g,'');
    }catch(e){ return String(py||'').toLowerCase().replace(/[^a-z]/g,''); }
  }
  function okChar(exp, typed){
    if(exp === typed) return true;
    if(exp === 'v' && typed === 'u') return true;
    return false;
  }

  function sentenceToWords(zh, py, vi, map){
    const syls = String(py||'').trim().split(/\s+/).filter(Boolean);
    if(!syls.length) return;
    const chars = Array.from(zh);
    const perChar = new Array(chars.length).fill(null);
    let si=0, lastSyl='';
    for(let i=0;i<chars.length;i++){
      const ch=chars[i];
      if(!HAN.test(ch)) continue;
      if(ch==='儿' && /r$/i.test(lastSyl)){ perChar[i]=null; continue; }
      if(si>=syls.length) return;
      perChar[i]=syls[si]; lastSyl=syls[si]; si++;
    }
    if(si!==syls.length) return;
    const segs = (typeof hanziSegment==='function') ? hanziSegment(zh) : [chars.join('')];
    let pos=0;
    for(const seg of segs){
      const len = Array.from(seg).length;
      if(len>=1 && /^[㐀-鿿]+$/.test(seg)){
        const sl = chars.slice(pos,pos+len).map((_,k)=>perChar[pos+k]).filter(Boolean);
        const erhuaTail = /儿$/.test(seg);
        if(sl.length===len || (erhuaTail && sl.length===len-1)){
          const pyw = sl.join(' ');
          const mean = (typeof GAME_WORD_VI!=='undefined' && GAME_WORD_VI[seg]) || '';
          map.set(seg, {word:seg, py:pyw, vi:mean, pyPlain:plainPinyin(pyw)});
        }
      }
      pos += len;
    }
  }

  const poolCache = {};
  function buildPool(level){
    if(poolCache[level]) return poolCache[level];
    const data = (typeof HSK_DATA!=='undefined' && HSK_DATA['hsk'+level]) || [];
    const map = new Map();
    for(const row of data){
      if(!row||!row[0]) continue;
      try{ sentenceToWords(row[0], row[1], row[2], map); }catch(e){}
    }
    let arr = [...map.values()].filter(w => w.pyPlain.length>=2 && w.pyPlain.length<=8 && w.vi);
    if(arr.length < 6){
      arr = [...map.values()].filter(w => w.pyPlain.length>=1 && w.pyPlain.length<=10 && w.vi);
    }
    poolCache[level] = arr;
    return arr;
  }

  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

  function pickWord(){
    const pool = state.pool;
    if(!pool.length) return null;
    const w = pool[state.poolIdx % pool.length];
    state.poolIdx++;
    return w;
  }

  /* ★ Tốc độ rơi đã GIẢM mạnh so với bản cũ (9 + speed*12 → 45px/s ở mức 3):
     giờ mức 1 ≈ 13px/s, mức 3 ≈ 27px/s, mức 10 ≈ 76px/s → người mới kịp nhìn & gõ. */
  const baseFall = () => 6 + state.speed * 7;      // px/s
  const spawnInterval = () => Math.max(1.5, 3.8 - state.speed * 0.18);

  function resize(){
    const r = playField.getBoundingClientRect();
    W = Math.max(320, r.width || 600);
    H = Math.max(220, r.height || 400);
    dpr = Math.min(window.devicePixelRatio||1, 2);
    canvas.width = Math.round(W*dpr);
    canvas.height = Math.round(H*dpr);
    canvas.style.width = W+'px';
    canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    initBg();
  }

  /* ★ Nền theo chủ đề chặng — luôn tối. Mỗi chủ đề có loại hạt rơi riêng. */
  function makeBgParticle(x, y){
    const part = THEMES[state.themeIdx].part;
    if(part === 'rain'){
      return { x, y, len: 8 + Math.random()*16, vy: 180 + Math.random()*260, a: 0.06 + Math.random()*0.12, type:'rain' };
    }
    if(part === 'snow'){
      return { x, y, r: 1.5 + Math.random()*2.6, vy: 28 + Math.random()*42, vx: (Math.random()-0.5)*22, a: 0.45 + Math.random()*0.4, type:'snow' };
    }
    if(part === 'star'){
      return { x, y, r: 0.6 + Math.random()*1.7, tw: Math.random()*Math.PI*2, a: 0.3 + Math.random()*0.6, type:'star' };
    }
    if(part === 'leaf'){
      return { x, y, r: 4 + Math.random()*5, vy: 24 + Math.random()*32, vx: (Math.random()-0.5)*34, rot: Math.random()*Math.PI*2, vr: (Math.random()-0.5)*2, a: 0.55 + Math.random()*0.35, hue: 25 + Math.random()*25, type:'leaf' };
    }
    if(part === 'petal'){
      return { x, y, r: 3 + Math.random()*3, vy: 20 + Math.random()*24, vx: (Math.random()-0.5)*34, rot: Math.random()*Math.PI*2, vr: (Math.random()-0.5)*2, ph: Math.random()*Math.PI*2, a: 0.65 + Math.random()*0.3, type:'petal' };
    }
    /* dust: hạt sáng li ti trôi lơ lửng (hoàng hôn / biển / neon) */
    return { x, y, r: 0.8 + Math.random()*1.8, vy: -8 - Math.random()*14, vx: (Math.random()-0.5)*14, tw: Math.random()*Math.PI*2, a: 0.25 + Math.random()*0.45, type:'dust' };
  }
  function initBg(){
    const n = Math.floor((W*H)/9000);
    state.bg = [];
    for(let i=0;i<n;i++) state.bg.push(makeBgParticle(Math.random()*W, Math.random()*H));
    state.scene = buildScene();
  }

  /* ★ Dựng PHONG CẢNH nền một lần (khi đổi chủ đề / resize) để các đối tượng
     (toà nhà, núi, cây…) đứng yên, không nhảy mỗi khung hình. */
  function buildScene(){
    const sc = { type: THEMES[state.themeIdx].scene, builds: [], windows: [], hills: [], trees: [], branches: [] };
    const R = Math.random;
    if(sc.type === 'city' || sc.type === 'neon'){
      let x = -12;
      while(x < W + 12){
        const w = 42 + R()*72, h = 60 + R()*160;
        sc.builds.push({ x, w, h });
        const cols = Math.max(1, Math.floor((w-10)/14)), rows = Math.max(3, Math.floor((h-8)/18));
        for(let c=0;c<cols;c++) for(let rw=0;rw<rows;rw++){
          if(R() < 0.34){
            sc.windows.push({
              x: x + 7 + c*14, y: H - h + 8 + rw*18,
              w: 5, h: 7,
              c: (sc.type === 'neon')
                ? ['#22d3ee','#f472b6','#fde047','#a78bfa','#34d399'][Math.floor(R()*5)]
                : 'rgba(147,197,253,0.16)'
            });
          }
        }
        x += w + 3 + R()*12;
      }
    } else if(sc.type === 'mountain'){
      sc.hills.push({ x:-30,  w: W*0.85, h: 140 + R()*70 });
      sc.hills.push({ x: W*0.28, w: W*0.95, h: 100 + R()*80 });
      sc.hills.push({ x: W*0.62, w: W*0.85, h: 175 + R()*65 });
    } else if(sc.type === 'forest'){
      const cnt = 5 + Math.floor(R()*4);
      for(let i=0;i<cnt;i++){
        const h = 70 + R()*90;
        sc.trees.push({ x: (W/(cnt-1))*i + (R()-0.5)*30, h, w: 26 + R()*22 });
      }
    } else if(sc.type === 'sakura'){
      const cnt = 5;
      for(let i=0;i<cnt;i++){
        /* nhánh từ góc trên trái/phải cụp xuống */
        const b = { x: i<cnt/2 ? -20 : W+20, y: 20 + R()*70, len: 90 + R()*90, dir: i<cnt/2 ? 1 : -1, blossoms: [] };
        const bn = 7 + Math.floor(R()*5);
        for(let k=0;k<bn;k++){
          b.blossoms.push({ dx: 10 + R()*b.len, dy: -12 + R()*b.len*0.6, r: 4 + R()*4 });
        }
        sc.branches.push(b);
      }
    }
    return sc;
  }

  /* ★ Vẽ phong cảnh phía SAU (silhouette) → đặt TRƯỚC lớp hạt đang rơi */
  function drawSceneryFar(){
    const sc = state.scene; if(!sc) return;
    if(sc.type === 'city' || sc.type === 'neon'){
      ctx.save();
      const body = sc.type === 'neon' ? 'rgba(7,5,20,0.9)' : 'rgba(4,9,22,0.9)';
      ctx.fillStyle = body;
      for(const b of sc.builds) ctx.fillRect(b.x, H - b.h, b.w, b.h);
      for(const w of sc.windows){ ctx.fillStyle = w.c; ctx.fillRect(w.x, w.y, w.w, w.h); }
      ctx.restore();
    } else if(sc.type === 'mountain'){
      ctx.save();
      for(const m of sc.hills){
        ctx.fillStyle = 'rgba(9,20,42,0.92)';
        ctx.beginPath();
        ctx.moveTo(m.x, H);
        ctx.lineTo(m.x + m.w/2, H - m.h);
        ctx.lineTo(m.x + m.w, H);
        ctx.closePath(); ctx.fill();
        /* chóp tuyết */
        const capW = m.w*0.2;
        ctx.fillStyle = 'rgba(226,232,240,0.82)';
        ctx.beginPath();
        ctx.moveTo(m.x + m.w/2 - capW, H - m.h + capW*1.7);
        ctx.lineTo(m.x + m.w/2, H - m.h);
        ctx.lineTo(m.x + m.w/2 + capW, H - m.h + capW*1.7);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if(sc.type === 'forest'){
      ctx.save();
      ctx.fillStyle = 'rgba(15,10,4,0.92)';
      for(const t of sc.trees){
        /* thân cây */
        ctx.fillRect(t.x - 3, H - t.h*0.45, 6, t.h*0.45);
        /* 3 tầng lá hình tam giác (cây thông) */
        for(let k=0;k<3;k++){
          const w = t.w * (1 - k*0.22);
          const baseY = H - t.h*0.35 - k*t.h*0.24;
          ctx.beginPath();
          ctx.moveTo(t.x - w, baseY);
          ctx.lineTo(t.x, baseY - t.h*0.32);
          ctx.lineTo(t.x + w, baseY);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    } else if(sc.type === 'sakura'){
      ctx.save();
      /* nhánh */
      ctx.strokeStyle = 'rgba(38,22,30,0.95)';
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      for(const b of sc.branches){
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.quadraticCurveTo(b.x + b.dir*b.len*0.6, b.y + b.len*0.5, b.x + b.dir*b.len, b.y + b.len*0.25);
        ctx.stroke();
      }
      /* chùm hoa */
      for(const b of sc.branches){
        for(const fl of b.blossoms){
          const px = b.x + b.dir*fl.dx, py = b.y + fl.dy;
          ctx.fillStyle = 'rgba(251,207,232,0.9)';
          ctx.beginPath(); ctx.arc(px, py, fl.r, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(245,180,214,0.7)';
          ctx.beginPath(); ctx.arc(px, py, fl.r*0.5, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    } else if(sc.type === 'sunset'){
      ctx.save();
      /* mặt trời + quầng sáng */
      const sunX = W*0.68, sunY = H - 96, R0 = 34;
      const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, R0*3.2);
      glow.addColorStop(0, 'rgba(253,186,116,0.55)');
      glow.addColorStop(1, 'rgba(253,186,116,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sunX, sunY, R0*3.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(253,224,171,0.95)';
      ctx.beginPath(); ctx.arc(sunX, sunY, R0, 0, Math.PI*2); ctx.fill();
      /* đồi nhỏ */
      ctx.fillStyle = 'rgba(35,12,38,0.92)';
      ctx.beginPath();
      ctx.moveTo(0, H); ctx.lineTo(0, H-70);
      ctx.quadraticCurveTo(W*0.3, H-150, W*0.55, H-80);
      ctx.quadraticCurveTo(W*0.8, H-30, W, H-95);
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      /* vài con chim */
      ctx.strokeStyle = 'rgba(60,25,60,0.8)'; ctx.lineWidth = 1.6;
      for(let i=0;i<4;i++){
        const bx = W*0.18 + i*26, by = 60 + (i%2)*22;
        ctx.beginPath();
        ctx.moveTo(bx-6, by); ctx.quadraticCurveTo(bx-3, by-4, bx, by);
        ctx.quadraticCurveTo(bx+3, by-4, bx+6, by);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ★ Vẽ phong cảnh phía TRƯỚC (sau lớp hạt): hành tinh, mặt trăng, sóng biển */
  function drawSceneryNear(){
    const sc = state.scene; if(!sc) return;
    if(sc.type === 'planet'){
      ctx.save();
      /* mặt trăng nhỏ bên trái */
      ctx.fillStyle = 'rgba(203,213,225,0.85)';
      ctx.beginPath(); ctx.arc(W*0.16, H*0.24, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.beginPath(); ctx.arc(W*0.16+6, H*0.24-5, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(W*0.16-5, H*0.24+6, 3, 0, Math.PI*2); ctx.fill();
      /* hành tinh lớn góc phải + vành đai */
      const px = W*0.82, py = H*0.62, pr = Math.min(W,H)*0.3;
      const grd = ctx.createRadialGradient(px - pr*0.4, py - pr*0.4, pr*0.1, px, py, pr);
      grd.addColorStop(0, 'rgba(139,92,246,0.85)');
      grd.addColorStop(0.6, 'rgba(76,29,149,0.9)');
      grd.addColorStop(1, 'rgba(30,15,60,0.95)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
      /* vành đai */
      ctx.save();
      ctx.translate(px, py); ctx.rotate(-0.42);
      ctx.scale(1, 0.28);
      ctx.strokeStyle = 'rgba(196,181,253,0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, pr*1.55, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      ctx.restore();
    } else if(sc.type === 'sea'){
      ctx.save();
      const horizon = H - 86;
      /* mặt trăng phản chiếu */
      const moonX = W*0.3, R0 = 20;
      ctx.fillStyle = 'rgba(226,232,240,0.9)';
      ctx.beginPath(); ctx.arc(moonX, horizon - 40, R0, 0, Math.PI*2); ctx.fill();
      /* biển */
      ctx.fillStyle = 'rgba(5,20,40,0.6)';
      ctx.fillRect(0, horizon, W, H - horizon);
      /* sóng */
      ctx.strokeStyle = 'rgba(148,197,253,0.28)';
      ctx.lineWidth = 1.4;
      const t = performance.now()/1000;
      for(let k=0;k<7;k++){
        const y = horizon + 8 + k*13;
        const amp = 3 + k*0.6;
        ctx.beginPath();
        for(let x=0;x<=W;x+=14){
          const yy = y + Math.sin(x*0.05 + t*1.4 + k*0.6)*amp;
          x===0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      /* vệt sáng trăng trên mặt nước */
      const rg = ctx.createLinearGradient(0, horizon, 0, H);
      rg.addColorStop(0, 'rgba(226,232,240,0.22)');
      rg.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(moonX - 10, horizon, 20, H - horizon);
      ctx.restore();
    }
  }

  function placeX(w){
    for(let t=0;t<30;t++){
      const x = 12 + Math.random() * Math.max(1, W - w - 24);
      let ok = true;
      for(const it of state.items){
        if(it.caught) continue;
        const gap = (x+w <= it.x) ? (it.x - (x+w)) : ((it.x+it.w <= x) ? (x - (it.x+it.w)) : -1);
        if(gap < 3.5*Math.min(w, it.w)) { ok=false; break; }
      }
      if(ok) return x;
    }
    return null;
  }

  function spawn(){
    const src = pickWord();
    if(!src) return;
    if(state.items.filter(i=>!i.caught).length >= state.maxConcurrent) return;
    ctx.font = '600 11.5px system-ui,sans-serif';
    const viW = ctx.measureText(src.vi || '').width;
    ctx.font = '800 21px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    const wW = ctx.measureText(src.word || '').width;
    ctx.font = '800 17px system-ui,sans-serif';
    const pW = ctx.measureText(String(src.py || src.pyPlain).replace(/\s+/g,'')).width;
    const w = Math.min(W-30, Math.max(120, Math.max(viW, wW, pW) + 40));
    const x = placeX(w);
    if(x == null) return;
    const h = 82;
    state.items.push({
      id: state.uid++, src,
      x, y: -h/2 - 10,
      w, h,
      vy: baseFall(),
      caught: false, scored: false,
      // ★ Hiếm thôi: chỉ ~10% thẻ mang tim, và chỉ khi đang thiếu mạng
      heart: state.wordsDone >= 4 && state.lives < state.maxLives && Math.random() < 0.10,
    });
  }

  function shoot(it){
    it.caught = true;
    /* ★ Không vỡ lộn xộn: giữ NGUYÊN thẻ (Tiếng Việt + Hán + Pinyin y như cũ),
       để người học nhìn thêm ~2s cho thuộc từ vựng, đồng thời trôi lên + mờ dần. */
    it.dying = true; it.dieT = 0; it.dieDur = 2.0;
    if(state.locked === it){ state.locked = null; state.buffer = ''; }
    state.skipped.clear();
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const gain = state.combo;
    state.score += gain;
    state.wordsDone++;
    /* ★ Tiến độ chặng tính riêng bằng stageWords — không suy ra từ wordsDone
       (wordsDone reset mỗi ván nên chặng khôi phục sẽ không bao giờ tiến). */
    state.stageWords = (state.stageWords||0) + 1;
    const cx = it.x + it.w/2, cy = it.y;
    for(let i=0;i<24;i++){
      const a = Math.random()*Math.PI*2, sp = 90+Math.random()*250;
      state.particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-110,life:0.5+Math.random()*0.4,max:0.9,size:2+Math.random()*3.5,hue:45+Math.random()*30});
    }
    state.floats.push({x:cx, y:cy-10, txt:'+'+gain, life:0.9, t:0, color:'#fde047'});
    // ★ Phá thẻ mang tim → +1 mạng (tối đa 10)
    if(it.heart && state.lives < state.maxLives){
      state.lives++;
      state.floats.push({x:cx, y:cy+16, txt:'♥ +1', life:1.1, t:0, color:'#fb7185'});
    }
    try{ speakText(it.src.word); }catch(e){}
    gameSfx(1.5);
    /* báo điểm cho bảng xếp hạng (chỉ điểm của từ bắn được, không tính câu sai) */
    try{ window.__gpOnGamePoint && window.__gpOnGamePoint(gain); }catch(e){}
    // ★ Qua chặng mới (mỗi STAGE_SIZE từ) → đổi nền + hiện banner
    if(state.stageWords >= STAGE_SIZE){
      state.stageWords = 0;
      advanceStage((state.stage||1) + 1);
    }
  }

  /* ★ Chuyển chặng: tăng số chặng, đổi chủ đề nền (phong cảnh), hiện banner ~2s
     (không dừng game), lưu theo chặng. Banner CHỈ ghi số chặng. */
  function advanceStage(ns){
    state.stage = Math.max(1, Number(ns)||1);
    state.stageWords = 0;
    state.themeIdx = randTheme(state.themeIdx);   // đổi cả nền → phong cảnh khác
    state.banner = { title:'Chặng ' + state.stage, sub:'Tiếp tục!', t:0, life:2.0 };
    initBg();
    saveGameStage();
  }

  /* ★ Lưu tiến độ theo chặng (localStorage) */
  function saveGameStage(){
    try{ localStorage.setItem('gopinyin:game:stage', JSON.stringify({ stage:state.stage, stageWords:state.stageWords||0, level:state.level, ts:Date.now() })); }catch(e){}
    saveGamePick();
  }
  function loadGameStage(){
    try{
      const s = JSON.parse(localStorage.getItem('gopinyin:game:stage')||'null');
      return (s && s.stage) ? s : null;
    }catch(e){ return null; }
  }

  /* ★ Nhớ lựa chọn của lần chơi trước: cấp HSK · tốc độ (ĐỘ ĐỢ) · số thẻ.
     Đọc/lập riêng khỏi save chặng để luôn khôi phục được, kể cả khi không
     có ván đang dở. */
  const PICK_KEY = 'gopinyin:game:pick';
  function saveGamePick(){
    try{
      localStorage.setItem(PICK_KEY, JSON.stringify({
        level: state.level,
        speed: Number(state.speed)||3,
        maxConcurrent: Number(state.maxConcurrent)||3
      }));
    }catch(e){}
  }
  function loadGamePick(){
    let p = null;
    try{ p = JSON.parse(localStorage.getItem(PICK_KEY)||'null'); }catch(e){ p = null; }
    if(!p) return false;
    const lv = Number(p.level)||0;
    /* HSK 4–6 là nội dung Pro → tài khoản miễn phí không được khôi phục */
    if(!(lv>=1 && lv<=6) || (lv>=4 && window.__gpIsPro!==true)) return false;
    state.level = lv;
    const sp = Number(p.speed);
    if(sp>=1 && sp<=10){
      state.speed = sp;
      const tag = $('gaSpeedTag'); if(tag) tag.textContent = SPEED_LABEL[sp] || 'Vừa';
      const sl = $('gaSpeed'); if(sl) sl.value = String(sp);
    }
    const mc = Number(p.maxConcurrent);
    if(mc>=1 && mc<=5){
      state.maxConcurrent = mc;
      const dd = $('gaDensity'); if(dd) dd.value = String(mc);
    }
    return true;
  }

  function loseLife(it){
    /* ★ Đã hết mạng / đã báo game over → không trừ thêm (tránh lives âm
       và tránh gameOver() bị gọi nhiều lần khi nhiều thẻ rơi cùng lúc).
       Vẫn phải gỡ thẻ vừa rơi khỏi sân, nếu không nó nằm lại mãi trong
       state.items và chặn chỗ sinh thẻ mới (placeX). */
    if(state.over){
      if(it){ it.scored = true; it.caught = true; state.items = state.items.filter(x => x !== it); }
      return;
    }
    state.lives--;
    state.combo = 0;
    state.flashRed = 1;
    state.floats.push({x:W/2, y:H-80, txt:'−1 ♥', life:0.9, t:0, color:'#fb7185'});
    if(it){ it.scored = true; it.caught = true; state.items = state.items.filter(x => x !== it); }
    if(state.locked && it && state.locked.id===it.id){
      /* thẻ đang gõ bị rơi qua vạch → mất mục tiêu, xoá phần đã gõ */
      state.locked=null; state.buffer='';
      state.floats.push({x:W/2, y:H-124, txt:'✗ mất mục tiêu', life:1.0, t:0, color:'#fca5a5'});
    }
    if(state.lives <= 0){ state.lives = 0; state.over = true; setTimeout(gameOver, 500); }
  }

  function gameOver(){
    if(!state.over) state.over = true;
    state.running = false;
    showOverlay('💔','Hết mạng!',
      'Bắn rất tốt! Xem quảng cáo để nhận <b>+3 mạng</b> và tiếp tục chơi ngay, hoặc bắt đầu ván mới.',
      true,
      [
        { v:String(state.score), l:'Điểm' },
        { v:String(state.wordsDone), l:'Từ đã bắn' },
        { v:String(state.bestCombo), l:'Combo cao nhất' },
        { v:'Chặng ' + state.stage, l:'Tiến độ' },
      ]);
  }

  function update(dt){
    updateShip(dt);
    // ★ Nền theo chủ đề chặng (rain/snow/space/autumn/dusk/sea/sakura/neon)
    for(const p of state.bg){
      if(p.type === 'rain'){
        p.y += p.vy * dt;
        if(p.y > H+20){ p.y = -p.len; p.x = Math.random()*W; }
      } else if(p.type === 'snow'){
        p.y += p.vy * dt; p.x += p.vx * dt;
        if(p.y > H+10){ p.y = -10; p.x = Math.random()*W; }
      } else if(p.type === 'star' || p.type === 'dust'){
        p.tw += dt*3;
        if(p.type === 'dust'){
          p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(p.y*0.03)*0.3;
          if(p.y < -12){ p.y = H+12; p.x = Math.random()*W; }
        }
      } else { // leaf / petal — rơi chậm, đung đưa + xoay
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.y*0.02 + (p.ph||0))*0.6;
        p.rot += p.vr * dt;
        if(p.y > H+10){ p.y = -10; p.x = Math.random()*W; }
      }
    }
    state.spawnAcc += dt;
    const iv = spawnInterval(); let g=0;
    while(state.spawnAcc >= iv && g++<6){ state.spawnAcc -= iv; spawn(); }
    const floorY = H - 60;
    for(const it of state.items){
      if(it.dying){ it.dieT += dt; continue; }
      if(it.caught) continue;
      it.y += it.vy * dt;
      if(!it.scored && it.y + it.h/2 >= floorY){
        it.scored = true;
        loseLife(it);
      }
    }
    // ★ Giữ thẻ đang vỡ cho đến khi hết thời gian rồi gỡ bỏ
    state.items = state.items.filter(it => it.dying ? it.dieT < it.dieDur : (!it.caught || it.y < H+120));
    if(state.locked && !state.items.some(i=>i.id===state.locked.id && !i.caught && !i.dying)){
      state.locked = null; state.buffer = '';
    }
    // ★ Banner chặng: hiện ~2s rồi tự tắt (không dừng game)
    if(state.banner){ state.banner.t += dt; if(state.banner.t >= state.banner.life) state.banner = null; }
    for(const p of state.particles){ p.vy += 700*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; }
    state.particles = state.particles.filter(p => p.life>0);
    for(const b of state.bullets){
      b.t += dt;
      // ★ Bám theo dòng pinyin của thẻ đích khi thẻ còn rơi → không bay lệch
      if(b.target && state.items.includes(b.target) && !b.target.caught){
        b.tx = b.target.x + b.target.w/2;
        b.ty = b.target.y + 19;   // ngay dòng pinyin dưới chữ Hán
      }
      const dx=b.tx-b.x, dy=b.ty-b.y, dist=Math.hypot(dx,dy);
      if(dist>0.01){ const sp=Math.max(dist*7, 760); b.vx=dx/dist*sp; b.vy=dy/dist*sp; }
      b.x += b.vx*dt; b.y += b.vy*dt;
      if(dist < 12 || b.t > b.life){
        b.dead = true;
        for(let i=0;i<5;i++){ const a=Math.random()*Math.PI*2,sp=60+Math.random()*100; state.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.2,max:0.2,size:1.4+Math.random(),hue:55}); }
      }
    }
    state.bullets = state.bullets.filter(b => !b.dead);
    for(const f of state.floats){ f.y -= 55*dt; f.t += dt; }
    state.floats = state.floats.filter(f => f.t < f.life);
    if(state.flashRed>0) state.flashRed = Math.max(0, state.flashRed - dt*2.5);
    updateHud();
  }

  function drawCard(it){
    /* ★ Vừa gõ đúng → KHÔNG vỡ lộn xộn. Giữ nguyên khung + chữ Hán/Pinyin/Tiếng Việt
       để người học nhìn thêm ~2s cho thuộc từ vựng, đồng thời trôi lên trên và mờ dần. */
    if(it.dying){
      const p = Math.min(1, it.dieT / it.dieDur);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.translate(0, -p * 80);
      drawCardBody(it);
      ctx.restore();
      return;
    }
    drawCardBody(it);
  }

  function drawCardBody(it){
    const cx = it.x + it.w/2;
    const cy = it.y;
    const src = it.src;
    const locked = state.locked && state.locked.id === it.id;
    if(locked){ ctx.shadowColor='#60a5fa'; ctx.shadowBlur=22; }
    roundRect(it.x, cy - it.h/2, it.w, it.h, 12);
    const g = ctx.createLinearGradient(it.x, cy-it.h/2, it.x, cy+it.h/2);
    g.addColorStop(0, locked ? 'rgba(37,99,235,0.95)' : 'rgba(30,58,138,0.92)');
    g.addColorStop(1, locked ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.92)');
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = locked ? 2.5 : 1;
    ctx.strokeStyle = locked ? '#60a5fa' : 'rgba(148,163,184,0.35)';
    ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    // dòng 1: nghĩa tiếng Việt
    ctx.fillStyle = 'rgba(186,206,235,0.85)';
    ctx.font = '600 11.5px system-ui,-apple-system,sans-serif';
    const viTxt = String(src.vi || '').slice(0, 28);
    ctx.fillText(viTxt, cx, cy - it.h/2 + 15);
    // dòng 2: chữ Hán
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '800 21px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    ctx.fillText(String(src.word || ''), cx, cy - 4);
    // huy hiệu ♥ nếu thẻ mang mạng
    if(it.heart){
      ctx.font = '900 14px system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fb7185';
      ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 8;
      ctx.fillText('♥', it.x + it.w - 8, cy - it.h/2 + 16);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
    }
    // dòng 3: pinyin — Enter (hoặc nút 💡) để ẨN/HIỆN
    //   • Hiện: in đầy đủ pinyin có dấu thanh, phần đã gõ tô xanh, phần còn lại xanh nhạt
    //   • Ẩn : chỉ để gạch dưới mờ cho biết còn bao nhiêu chữ cái
    const py = String(src.pyPlain || '');
    if(py){
      const typedLen = locked ? state.buffer.length : 0;
      ctx.font = '800 17px system-ui,sans-serif';
      if(state.showPinyin){
        /* ★ Bỏ khoảng trắng để pinyin hiển thị GIỐNG HỆT lúc gõ (yīkuàir = "yikuair") */
        const toned = (String(src.py || py).trim() || py).replace(/\s+/g, '');
        const chars = Array.from(toned);
        const totalW = ctx.measureText(toned).width;
        let px = cx - totalW / 2;
        let li = 0;
        ctx.textAlign = 'left';
        for(const ch of chars){
          /* ★ PHẢI tính cả NGUYÊN ÂM CÓ DẤU THANH (ǐ á ǎ à ē…) là chữ cái.
             Trước đây chỉ dùng /[a-zü]/i nên "qǐchuáng" coi ǐ/á là KHÔNG phải
             chữ → chúng không bao giờ đổi màu khi gõ, và biến đếm `li` bị lệch
             khiến các chữ phía sau cũng tô sai vị trí. */
          const isLetter = /[a-zü]/i.test(ch) || !!TONE_MAP[ch];
          const done = isLetter && li < typedLen;
          ctx.fillStyle = done ? '#86efac' : 'rgba(147,197,253,0.92)';
          if(done){ ctx.shadowColor = '#86efac'; ctx.shadowBlur = 6; }
          ctx.fillText(ch, px, cy + 19);
          ctx.shadowBlur = 0;
          px += ctx.measureText(ch).width;
          if(isLetter) li++;
        }
      } else if(typedLen > 0){
        /* đang ẩn pinyin nhưng đã gõ được vài chữ → chỉ hiện phần đã gõ để biết tiến độ.
           ★ Người dùng chỉ gõ KHÔNG DẤU, nhưng phần đã gõ hiện kèm THANH ĐIỆU
             của từ đích (gõ "nushe" → hiện "nǚshē") để vừa luyện vừa thuộc thanh.
           ★ Đã bỏ dòng gạch mờ đánh dấu phần chưa gõ (yêu cầu). */
        const tonedFull = (String(src.py || py).trim() || py).replace(/\s+/g, '');
        const tonedLetters = Array.from(tonedFull).filter(ch => /[a-zü]/i.test(ch) || !!TONE_MAP[ch]);
        const shown = (tonedLetters.length === py.length)
          ? tonedLetters.slice(0, typedLen).join('')
          : py.slice(0, typedLen);
        if(shown){
          ctx.fillStyle = '#86efac';
          ctx.shadowColor = '#86efac'; ctx.shadowBlur = 6;
          ctx.textAlign = 'left';
          ctx.fillText(shown, cx - ctx.measureText(shown).width / 2, cy + 19);
          ctx.shadowBlur = 0;
        }
      }
      /* chưa gõ gì và đang ẩn pinyin → để trống, không vẽ gạch mờ */
      ctx.textAlign = 'center';
    }
  }

  function roundRect(x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function draw(){
    // ★ Nền theo chủ đề chặng — luôn TỐI (chủ đạo tối)
    const cur = THEMES[state.themeIdx];
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, cur.bg1);
    bg.addColorStop(1, cur.bg2);
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    // vignette
    const vg = ctx.createRadialGradient(W/2, H*0.4, Math.min(W,H)*0.25, W/2, H*0.5, Math.max(W,H)*0.7);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
    // ★ Phong cảnh nền: silhouette phía sau (toà nhà/núi/rừm/hoàng hôn…)
    drawSceneryFar();
    // hạt nền theo chủ đề (mưa/tuyết/sao/lá/cánh hoa/bụi sáng)
    for(const p of state.bg){
      if(p.type === 'rain'){
        ctx.strokeStyle = 'rgba(186,206,235,'+p.a+')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 0.4, p.y + p.len);
        ctx.stroke();
      } else if(p.type === 'snow'){
        ctx.fillStyle = 'rgba(226,232,240,'+p.a+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      } else if(p.type === 'star'){
        const tw = 0.45 + 0.55*Math.sin(p.tw);
        ctx.fillStyle = 'rgba(196,181,253,'+(p.a*tw).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      } else if(p.type === 'leaf'){
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = 'hsla('+p.hue+',75%,55%,'+p.a.toFixed(3)+')';
        ctx.beginPath(); ctx.ellipse(0,0,p.r, p.r*0.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else if(p.type === 'petal'){
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(251,207,232,'+p.a.toFixed(3)+')';
        ctx.beginPath(); ctx.ellipse(0,0,p.r, p.r*0.55, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else { // dust — hạt sáng li ti trôi lơ lửng
        const tw = 0.45 + 0.55*Math.sin(p.tw);
        ctx.fillStyle = 'rgba(226,240,255,'+(p.a*tw).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      }
    }
    // ★ Phong cảnh phía TRƯỚC (hành tinh/mặt trăng/sóng biển) — vẽ sau lớp hạt
    drawSceneryNear();
    // sàn phát sáng
    const floorY = H - 60;
    ctx.save();
    ctx.strokeStyle = 'rgba(96,165,250,0.85)';
    ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
    ctx.restore();
    // đường cảnh báo
    ctx.strokeStyle = 'rgba(251,113,133,'+(0.12+0.25*state.flashRed).toFixed(3)+')';
    ctx.lineWidth = 1; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(0, floorY-32); ctx.lineTo(W, floorY-32); ctx.stroke();
    ctx.setLineDash([]);
    // đường ngắm tới mục tiêu đang khoá — cho biết CHẮC CHẮN đang gõ thẻ nào
    if(state.locked && !state.locked.caught){
      const n = shipNose();
      const tx = state.locked.x + state.locked.w/2, ty = state.locked.y + state.locked.h/2;
      const aim = ctx.createLinearGradient(n.x, n.y, tx, ty);
      aim.addColorStop(0, 'rgba(96,165,250,0.5)');
      aim.addColorStop(1, 'rgba(96,165,250,0.05)');
      ctx.save();
      ctx.strokeStyle = aim;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -((performance.now()/28) % 12);
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
    }
    // bullets
    for(const b of state.bullets){
      const a = Math.max(0, Math.min(1, (b.life-b.t)/0.3 || 1));
      ctx.save();
      ctx.shadowColor='#fde047'; ctx.shadowBlur=10;
      ctx.fillStyle = 'rgba(253,224,71,'+a+')';
      ctx.font='900 17px system-ui,sans-serif';
      ctx.textAlign='center';
      ctx.fillText(b.ch, b.x, b.y);
      ctx.restore();
    }
    // thẻ
    for(const it of state.items){ drawCard(it); }
    // particles
    for(const p of state.particles){
      const a = Math.max(0, p.life/p.max);
      ctx.fillStyle = 'hsla('+p.hue+',90%,65%,'+a.toFixed(3)+')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    }
    // floats
    for(const f of state.floats){
      const a = Math.max(0, 1 - f.t/f.life);
      const pop = 1 + 1.1*Math.max(0, 1-f.t/0.18);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = '900 19px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.translate(f.x, f.y); ctx.scale(pop, pop);
      ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    }
    if(state.flashRed > 0){
      ctx.fillStyle = 'rgba(251,113,133,'+(state.flashRed*0.18).toFixed(3)+')';
      ctx.fillRect(0,0,W,H);
    }
    // ★ Banner chặng: hiện ~2s rồi mờ tắt (không dừng game)
    if(state.banner){
      const bp = state.banner.t / state.banner.life;
      let a = 1;
      if(bp < 0.15) a = bp/0.15;
      else if(bp > 0.7) a = (1-bp)/0.3;
      a = Math.max(0, Math.min(1, a)) * 0.96;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 30px "Baloo 2",system-ui,sans-serif';
      ctx.fillText(state.banner.title, W/2, H/2 - 8);
      ctx.fillStyle = 'rgba(226,232,240,0.92)';
      ctx.font = '700 16px system-ui,sans-serif';
      ctx.fillText(state.banner.sub, W/2, H/2 + 24);
      ctx.restore();
    }
    if(state.paused){
      /* ★ Màn tạm dừng = nơi ôn lại CƠ CHẾ CHƠI & PHÍM TẮT ngay trong game */
      ctx.fillStyle = 'rgba(8,14,32,.72)';
      ctx.fillRect(0,0,W,H);
      const pw = Math.min(W-36, 470), ph = 214;
      const px = (W-pw)/2, py = (H-ph)/2;
      ctx.save();
      roundRect(px, py, pw, ph, 18);
      const pg = ctx.createLinearGradient(px, py, px, py+ph);
      pg.addColorStop(0,'rgba(30,41,59,.97)');
      pg.addColorStop(1,'rgba(15,23,42,.97)');
      ctx.fillStyle = pg; ctx.fill();
      ctx.strokeStyle='rgba(96,165,250,.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '800 24px system-ui,sans-serif';
      ctx.fillText('⏸ TẠM DỪNG', W/2, py + 42);
      ctx.font = '600 13px system-ui,sans-serif';
      const lines = [
        'Gõ pinyin của thẻ để bắn nổ · gõ sai chỉ mất combo, không nhảy thẻ khác',
        'Enter (hoặc nút 🔒/拼): hiện/ẩn pinyin · Backspace: đổi mục tiêu',
        'Space: chơi tiếp · Esc: đóng (ván được giữ lại) · Thẻ ♥ rơi: +1 mạng'
      ];
      lines.forEach((t,i)=>ctx.fillText(t, W/2, py + 80 + i*24));
      ctx.fillStyle = '#93c5fd';
      ctx.font = '700 13px system-ui,sans-serif';
      ctx.fillText('Nhấn Space hoặc nút ⏸ để tiếp tục', W/2, py + ph - 28);
    }
  }

  function frame(t){
    if(!isGameVisible()){
      state.rafId = 0;
      /* rời mục game bằng bất kỳ đường nào → giữ ván lại để chơi tiếp */
      if(state.running){ state.suspended = true; state.running = false; state.paused = false; }
      return;
    }
    state.rafId = requestAnimationFrame(frame);
    if(!state.running){ draw(); return; }
    if(state.paused){ state.lastT = 0; draw(); return; }
    if(!state.lastT) state.lastT = t;
    let dt = (t - state.lastT)/1000; state.lastT = t;
    if(dt > 0.05) dt = 0.05;
    update(dt); draw();
  }

  function isGameVisible(){ const c=$('gameCard'); return c && !c.classList.contains('hidden'); }

  function updateHud(){
    const sc = $('gaScoreNum');
    if(sc){
      const newTxt = String(state.score);
      if(sc.textContent !== newTxt){
        sc.textContent = newTxt;
        sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop');
      }
    }
    const h = $('gaHearts');
    if(h){
      /* màn hình hẹp: 9 trái tim đầy đủ sẽ tràn ra ngoài → hiện dạng gọn ♥ 5/9 */
      const narrow = window.matchMedia('(max-width:760px)').matches;
      h.textContent = narrow
        ? ('♥ ' + state.lives + '/' + state.maxLives)
        : '♥'.repeat(Math.max(0,state.lives)) + '♡'.repeat(Math.max(0,state.maxLives-state.lives));
      h.title = state.lives + '/' + state.maxLives + ' mạng';
    }
    /* ★ Kho từ được lặp vòng khi hết → kẹp lại để HUD không hiện "35/30" */
    const moc = $('gaMoc'); if(moc) moc.textContent = (state.pool.length ? (Math.min(state.wordsDone, state.pool.length) + '/' + state.pool.length) : '0/0');
    /* ★ Nhãn cấp HSK trong HUD phải đổi theo cấp đang chọn (trước đây hard-code "HSK 2") */
    const un = $('gaUnit'); if(un) un.textContent = 'HSK ' + state.level;
    const fl = $('gaFloorLabel'); if(fl) fl.textContent = 'HSK ' + state.level + ' Vocabulary (3.0)';
    const stg = $('gaStageChip'); if(stg){
      const within = Math.max(0, Math.min(STAGE_SIZE, state.stageWords||0));
      stg.textContent = 'Chặng ' + state.stage + ' · ' + within + '/' + STAGE_SIZE;
    }
  }

  function handleKey(e){
    if(!isGameVisible()) return;
    if(e.key === 'Escape'){
      /* đang toàn màn hình → để trình duyệt tự thoát, không tạm dừng game */
      if(isFs()) return;
      if(state.running) togglePause();
      return;
    }
    if(e.key === 'Enter'){ e.preventDefault(); toggleGamePinyin(); return; }
    if(e.key === ' '){
      e.preventDefault();
      if(state.running) togglePause();
      return;
    }
    if(!state.running || state.paused) return;
    if(e.ctrlKey || e.altKey || e.metaKey) return;
    if(e.key === 'Backspace'){ e.preventDefault(); backspaceTarget(); return; }
    if(!/^[a-zA-Z]$/.test(e.key)) return;
    e.preventDefault();
    typeChar(e.key);
  }

  /* ★ Backspace = đổi mục tiêu (không bị trừ gì)
     → bỏ khoá thẻ hiện tại; lần gõ kế tiếp sẽ chọn thẻ KHÁC cùng chữ cái đầu.
     Dùng khi lỡ khoá nhầm thẻ, không phải chờ thẻ rơi qua vạch. */
  function backspaceTarget(){
    if(!state.running || state.paused) return;
    if(state.locked){
      state.skipped.add(state.locked.id);
      state.locked = null; state.buffer = '';
      state.floats.push({x:W/2, y:H-100, txt:'↺ đổi mục tiêu', life:0.7, t:0, color:'#93c5fd'});
    }
  }

  /* ★ Gõ 1 ký tự (dùng chung cho bàn phím thật và bàn phím ảo) */
  function typeChar(raw){
    if(!state.running || state.paused) return;
    if(!/^[a-zA-Z]$/.test(raw)) return;
    const ch = String(raw).toLowerCase().replace(/v/g,'u');

    /* ═══════════════════════════════════════════════════════════
       ★ KHOÁ MỤC TIÊU (giống ZType / WarType):
         - Đã khoá thẻ nào thì gõ cho hết thẻ ĐÓ.
         - Gõ sai: chỉ mất combo + nháy đỏ, TUYỆT ĐỐI không nhảy
           sang thẻ khác và không xoá những ký tự đã gõ đúng.
         - Chỉ đổi mục tiêu khi: bắn xong thẻ, hoặc thẻ rơi qua vạch.
       ═══════════════════════════════════════════════════════════ */
    if(state.locked){
      const py = state.locked.src.pyPlain;
      const idx = state.buffer.length;
      if(idx < py.length && okChar(py[idx], ch)){
        state.buffer += ch;
        if(state.buffer.length >= 2) state.skipped.clear();
        spawnBullet(ch, state.locked);
        if(state.buffer.length === py.length) shoot(state.locked);
      } else {
        penalty();
      }
      return;
    }

    /* Chưa khoá → chọn thẻ SẮP CHẠM VẠCH NHẤT bắt đầu bằng ký tự vừa gõ
       (thẻ nguy hiểm nhất được ưu tiên, không chọn ngẫu nhiên).
       Nếu vừa bấm Backspace để đổi mục tiêu → bỏ qua thẻ vừa bỏ. */
    let cands = state.items.filter(it => !it.caught && okChar(it.src.pyPlain[0], ch));
    if(state.skipped.size){
      const alt = cands.filter(it => !state.skipped.has(it.id));
      if(alt.length) cands = alt; else state.skipped.clear();
    }
    if(!cands.length){ penalty(); return; }
    const tgt = cands.sort((a,b)=> b.y - a.y)[0];
    state.locked = tgt;
    state.buffer = ch;
    spawnBullet(ch, tgt);
    if(tgt.src.pyPlain.length === 1) shoot(tgt);
  }

  /* Ký tự tiếp theo cần gõ (để bàn phím ảo gợi ý phím) */
  function nextKey(){
    if(!state.running || state.paused) return '';
    if(state.locked){
      const py = state.locked.src.pyPlain;
      return py[state.buffer.length] || '';
    }
    return '';
  }

  // ★ Enter trong game: bật/tắt hiển thị pinyin — KHÔNG bật popup (tránh phân tâm)
  function toggleGamePinyin(){
    state.showPinyin = !state.showPinyin;
    syncPinyinBtn();
  }
  function syncPinyinBtn(){
    const b = $('gaPyBtn');
    if(!b) return;
    b.textContent = state.showPinyin ? '拼' : '🔒';
    b.classList.toggle('on', state.showPinyin);
    b.setAttribute('aria-pressed', state.showPinyin ? 'true' : 'false');
    b.title = state.showPinyin ? 'Đang hiện Pinyin — bấm hoặc Enter để ẩn' : 'Đang ẩn Pinyin — bấm hoặc Enter để xem gợi ý';
  }
  /* ★ Khoá cấp HSK 4–6 khi chưa có Pro (đồng bộ với kho câu HSK 4–9) */
  function syncGameLocks(){
    const pro = window.__gpIsPro === true;
    document.querySelectorAll('[data-glevel]').forEach(b=>{
      const lv = Number(b.dataset.glevel)||0;
      const lock = lv>=4 && !pro;
      b.classList.toggle('isLocked', lock);
      b.title = lock ? ('Cấp HSK '+lv+' — cần gói Pro') : ('Chơi cấp HSK '+lv);
    });
  }
  window.__gpSyncGameLocks = syncGameLocks;

  /* ═══ TÀU: xoay đầu nhọn về phía thẻ đang gõ ═══ */  const SHIP_CY_OFF = 69;   // tâm tàu cách đáy sân chơi
  const SHIP_NOSE = 23;     // từ tâm tới mũi nhọn
  function shipCenter(){ return { x: W/2, y: H - SHIP_CY_OFF }; }
  function shipNose(){
    const c = shipCenter(), a = state.shipAngle * Math.PI/180;
    return { x: c.x + Math.sin(a)*SHIP_NOSE, y: c.y - Math.cos(a)*SHIP_NOSE };
  }
  function updateShip(dt){
    let target = 0;
    if(state.locked && !state.locked.caught){
      const c = shipCenter();
      const dx = (state.locked.x + state.locked.w/2) - c.x;
      const dy = state.locked.y - c.y;
      target = Math.atan2(dx, -dy) * 180/Math.PI;   // 0 = chĩa thẳng lên
    }
    const diff = ((target - state.shipAngle + 540) % 360) - 180;  // đi đường ngắn nhất
    state.shipAngle += diff * Math.min(1, dt*11);
    if(shipSvg) shipSvg.style.transform = 'rotate(' + state.shipAngle.toFixed(2) + 'deg)';
  }
  function resetShip(){
    state.shipAngle = 0;
    if(shipSvg) shipSvg.style.transform = 'rotate(0deg)';
  }

  /* Âm thanh game — tôn trọng nút 🔇 */
  function gameSfx(power){ if(!state.sfx) return; try{ sfxShot(power); }catch(e){} }

  function spawnBullet(ch, target){
    const n = shipNose();
    gameSfx(0.85);          /* ★ mỗi ký tự gõ đúng = 1 tiếng "pew" */
    state.bullets.push({
      ch, target,
      x: n.x, y: n.y,
      vx: 0, vy: -560,
      tx: target.x+target.w/2, ty: target.y + 19,
      life: 1.0, t:0
    });
    /* tia lửa ở đầu nòng */
    for(let i=0;i<3;i++){
      const a = state.shipAngle*Math.PI/180 + (Math.random()-.5)*0.9;
      state.particles.push({x:n.x,y:n.y,vx:Math.sin(a)*(60+Math.random()*90),vy:-Math.cos(a)*(60+Math.random()*90),
        life:.18,max:.18,size:1.4+Math.random()*1.6,hue:200+Math.random()*30});
    }
  }

  function penalty(){
    /* ★ Gõ sai KHÔNG trừ điểm nữa — chỉ mất combo */
    state.combo = 0;
    state.flashRed = 1;
    state.floats.push({x: W/2, y: H-100, txt:'✗ sai', life:0.6, t:0, color:'#fb7185'});
    gameSfx(0.4);
  }

  function togglePause(){
    if(!state.running) return;
    state.paused = !state.paused;
    const btn = $('gaPauseBtn'); if(btn) btn.textContent = state.paused ? '▶' : '⏸';
    if(!state.paused) state.lastT = 0;
  }

  function startGame(){
    if(!state.pool.length){ toast('Chưa có từ vựng cho cấp này.','bad'); return; }
    state.suspended = false; state.resumeReady = false;
    state.running = true; state.paused = false; state.lastT = 0;
    state.items = []; state.particles = []; state.bullets = []; state.floats = [];
    state.score = 0; state.lives = 5; state.combo = 0; state.bestCombo = 0;
    state.wordsDone = 0; state.buffer = ''; state.locked = null; state.skipped.clear();
    state.flashRed = 0; state.over = false; state.stageWords = 0;
    /* ★ Giữ số chặng đã lưu (tiếp nối theo từng chặng); nền/ phong cảnh chọn ngẫu nhiên */
    state.banner = null;
    state.themeIdx = randTheme(-1);
    initBg();
    state.pool = shuffle(buildPool(state.level));
    state.poolIdx = 0;
    state.spawnAcc = 0;
    hideOverlay();
    resetShip();
    $('gaNewBtn')?.classList.add('hidden');
    /* thả ngay 1 thẻ để vào ván là có việc làm, không phải chờ */
    spawn();
    const pb = $('gaPauseBtn'); if(pb) pb.textContent = '⏸';
    syncPinyinBtn();
    if(!state.rafId) state.rafId = requestAnimationFrame(frame);
    updateHud();
  }

  /* ★ Tiếp tục ván đang dở (sau khi thoát sang mục khác) */
  function resumeGame(){
    if(!state.suspended){ startGame(); return; }
    state.suspended = false; state.resumeReady = false;
    state.running = true; state.paused = false; state.lastT = 0; state.over = false;
    hideOverlay();
    $('gaNewBtn')?.classList.add('hidden');
    const pb = $('gaPauseBtn'); if(pb) pb.textContent = '⏸';
    if(!state.rafId) state.rafId = requestAnimationFrame(frame);
    updateHud();
    toast('▶ Tiếp tục ván đang chơi','ok',1500);
  }

  function showResumeOverlay(){
    const bangSo = [
      { v:'♥ ' + state.lives + '/' + state.maxLives, l:'Mạng còn lại' },
      { v:String(state.score), l:'Điểm' },
      { v:String(state.wordsDone), l:'Từ đã bắn' },
      { v:'Chặng ' + state.stage, l:'Tiến độ' },
    ];
    showOverlay('⏸️','Ván đang dở',
      'Bạn đang chơi dang dở. Tiếp tục để giữ nguyên điểm và chặng, hay bắt đầu một ván mới?',
      false, bangSo);
    const st = $('gaStartBtn'); if(st) st.textContent = '▶ Tiếp tục';
    $('gaNewBtn')?.classList.remove('hidden');
    $('gaAdBtn')?.classList.add('hidden');
    state.resumeReady = true;
  }

  function showOverlay(emoji, title, msg, isOver, stats){
    const ov = $('gaOverlay'); if(!ov) return;
    ov.classList.remove('hidden');
    $('gaOverlayEmoji').textContent = emoji;
    $('gaOverlayTitle').textContent = title;
    $('gaOverlayMsg').innerHTML = msg;
    /* ★ Ô thống kê (điểm / tim / từ / chặng) — giãn cách đẹp thay vì chữ chảy liền */
    const box = $('gaOverlayStats');
    if(box){
      box.innerHTML = '';
      if(stats && stats.length){
        for(const s of stats){
          const cell = document.createElement('div');
          cell.className = 'gaStat';
          const v = document.createElement('span'); v.className = 'gaStatVal'; v.textContent = s.v;
          const l = document.createElement('span'); l.className = 'gaStatLbl'; l.textContent = s.l;
          cell.appendChild(v); cell.appendChild(l);
          box.appendChild(cell);
        }
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
      }
    }
    const start = $('gaStartBtn');
    if(start){
      start.textContent = isOver ? '↺ Chơi lại' : '▶ Bắt đầu';
      start.classList.remove('hidden');
    }
    const ad = $('gaAdBtn');
    if(ad) ad.classList.toggle('hidden', !isOver);
  }
  function hideOverlay(){ $('gaOverlay')?.classList.add('hidden'); }

  /* ★ Hết mạng → nhận thêm 3 mạng (đếm ngược 3s) rồi chơi tiếp */
  let adTimer = null;
  function watchAd(){
    const ov = $('gaOverlay'); if(!ov) return;
    if(adTimer){ clearInterval(adTimer); adTimer = null; }
    $('gaStartBtn')?.classList.add('hidden');
    $('gaAdBtn')?.classList.add('hidden');
    $('gaOverlayEmoji').textContent = '🎁';
    $('gaOverlayTitle').textContent = 'Nhận thêm mạng…';
    $('gaOverlayMsg').innerHTML = 'Đang nạp thêm <b>+3 mạng</b> — còn <b id="gaAdCount">3</b> giây…';
    let left = 3;
    adTimer = setInterval(()=>{
      left--;
      const c = $('gaAdCount');
      if(c) c.textContent = String(Math.max(0,left));
      if(left <= 0){
        clearInterval(adTimer); adTimer = null;
        state.lives = Math.min(state.maxLives, Math.max(0, state.lives) + 3);
        state.combo = 0;
        state.over = false;
        hideOverlay();
        state.running = true; state.paused = false; state.lastT = 0;
        const pb = $('gaPauseBtn'); if(pb) pb.textContent = '⏸';
        state.floats.push({x:W/2, y:H/2, txt:'♥ +3', life:1.2, t:0, color:'#fb7185'});
        if(!state.rafId) state.rafId = requestAnimationFrame(frame);
        updateHud();
      }
    }, 1000);
  }

  function leaveGame(opts){
    /* opts.silent = true → chỉ dừng ván đang chơi, KHÔNG tự chuyển màn
       (dùng khi người dùng bấm mục khác trên thanh bên). */
    const silent=!!(opts&&opts.silent);
    /* ★ Giữ lại ván đang chơi để lần sau vào tiếp tục + lưu tiến độ theo chặng */
    if(state.running) state.suspended = true;
    try{ saveGameStage(); }catch(e){}
    if(state.rafId){ cancelAnimationFrame(state.rafId); state.rafId = 0; }
    state.running = false; state.paused = false;
    if(isFs()){ try{ (document.exitFullscreen||document.webkitExitFullscreen).call(document); }catch(e){} }
    $('gameCard')?.classList.add('hidden');
    $('appCard')?.classList.add('hidden');
    if(silent){
      /* người dùng tự chuyển sang mục khác → showView() lo phần hiển thị */
      $('gamesCard')?.classList.remove('hidden');
      return;
    }
    /* ★ Quay về sảnh "Game từ vựng" (game là màn con của mục này) thay vì thư viện */
    if(window.showView) window.showView('games');
  }

  function openGame(){
    resize();
    state.showPinyin=false;   // ★ mới vào game → pinyin luôn ẩn, muốn xem thì bật
    syncPinyinBtn();
    syncFsBtn();
    syncGameLocks();
    /* ★ Có ván đang dở → mời tiếp tục thay vì xoá sạch */
    if(state.suspended && state.pool.length){
      state.running = false; state.paused = false; state.lastT = 0;
      showResumeOverlay();
      updateHud();
      if(!state.rafId) state.rafId = requestAnimationFrame(frame);
      return;
    }
    state.suspended = false; state.resumeReady = false;
    /* ★ Khôi phục chặng đã lưu (tiếp nối theo từng chặng); chủ đề nền RANDOM mỗi lần mở game */
    const saved = loadGameStage();
    if(saved && saved.stage) state.stage = Math.max(1, Number(saved.stage)||1);
    state.stageWords = saved ? Math.max(0, Math.min(STAGE_SIZE-1, Number(saved.stageWords)||0)) : 0;
    /* ★ Khôi phục cả CẤP HSK đã chọn — nhưng chỉ khi cấp đó được phép
       (HSK 4–6 là nội dung Pro, không được khôi phục cho tài khoản miễn phí). */
    if(saved && saved.level){
      const lv = Number(saved.level)||0;
      if(lv>=1 && lv<=6 && (lv<4 || window.__gpIsPro===true)){
        state.level = lv;
      }
    }
    /* ★ Ưu tiên lựa chọn của lần chơi trước (cấp HSK · ĐỘ ĐỢ · số thẻ).
       Chạy sau bước trên để ghi đè khi save chặng còn tồn tại từ lâu. */
    loadGamePick();
    document.querySelectorAll('[data-glevel]').forEach(x=>{
      const on = Number(x.dataset.glevel)===state.level;
      x.classList.toggle('active', on);
      x.setAttribute('aria-pressed', on?'true':'false');
    });
    state.over = false;
    state.themeIdx = randTheme(-1);
    state.pool = buildPool(state.level);
    state.poolIdx = 0;
    state.score = 0; state.lives = 5; state.combo = 0; state.bestCombo = 0;
    state.wordsDone = 0;
    state.items = []; state.particles = []; state.bullets = []; state.floats = [];
    state.buffer = ''; state.locked = null; state.skipped.clear(); state.flashRed = 0;
    state.banner = null;
    state.running = false; state.paused = false;
    initBg();
    resetShip();
    $('gaNewBtn')?.classList.add('hidden');
    showOverlay('🎮','Sẵn sàng?',
      '<div class="gaRules">'
      +'<div class="gaRule"><span class="gaRuleIco">🎯</span><span>Gõ <b>toàn bộ pinyin</b> của từ để <b>bắn nổ</b>.</span></div>'
      +'<div class="gaRule"><span class="gaRuleIco">💡</span><span><b>Enter</b> hiện/ẩn pinyin · <b>Backspace</b> đổi mục tiêu.</span></div>'
      +'<div class="gaRule"><span class="gaRuleIco">🔒</span><span>Gõ sai chỉ <b>mất combo</b> — không trừ điểm, không nhảy thẻ.</span></div>'
      +'<div class="gaRule"><span class="gaRuleIco">❤️</span><span><b>5 mạng</b>: thẻ qua vạch <b>−1</b> · thẻ <b style="color:#fb7185">♥</b> phá nổ <b>+1</b>.</span></div>'
      +'<div class="gaRule"><span class="gaRuleIco">🎆</span><span><b>Chia chặng</b>: mỗi <b>'+STAGE_SIZE+'</b> từ đổi cả <b>nền game</b> (nhiều phong cảnh: mưa · tuyết · vũ trụ · rừng thu · hoàng hôn · biển đêm · hoa anh đào · neon) — lưu tiến độ <b>theo chặng</b>.</span></div>'
      +'</div>',
      false);
    updateHud();
    if(!state.rafId) state.rafId = requestAnimationFrame(frame);
  }

  function wireUI(){
    $('gaStartBtn')?.addEventListener('click', ()=>{
      if(adTimer){clearInterval(adTimer);adTimer=null;}
      saveGamePick();   /* nhớ cấp HSK · ĐỘ ĐỢ · số thẻ của ván này */
      if(state.resumeReady) resumeGame(); else startGame();
    });
    $('gaNewBtn')?.addEventListener('click', ()=>{ state.suspended=false; startGame(); });
    $('gaAdBtn')?.addEventListener('click', watchAd);
    $('gaCloseBtn')?.addEventListener('click', leaveGame);
    $('gaPauseBtn')?.addEventListener('click', togglePause);
    $('gaSoundBtn')?.addEventListener('click', ()=>{
      state.sfx = !state.sfx;
      $('gaSoundBtn').textContent = state.sfx ? '🔊' : '🔇';
      $('gaSoundBtn').classList.toggle('muted', !state.sfx);
    });
    $('gaPyBtn')?.addEventListener('click', toggleGamePinyin);
    $('gaFsBtn')?.addEventListener('click', toggleFullscreen);
    $('gaSpeed')?.addEventListener('input', e=>{
      state.speed = Number(e.target.value)||3;
      $('gaSpeedTag').textContent = SPEED_LABEL[state.speed] || 'Vừa';
      for(const it of state.items) it.vy = baseFall();
      saveGamePick();
    });
    $('gaDensity')?.addEventListener('change', e=>{
      state.maxConcurrent = Math.max(1, Number(e.target.value)||3);
      saveGamePick();
    });
    $('gaLevels')?.addEventListener('click', e=>{
      const b = e.target.closest('[data-glevel]'); if(!b) return;
      const lv = Number(b.dataset.glevel)||2;
      /* ★ HSK 4–6 trong game cũng là nội dung Pro */
      if(lv>=4 && window.__gpIsPro!==true){
        if(typeof window.__gpOpenPro==='function') window.__gpOpenPro();
        toast('Cấp HSK 4–6 trong game thuộc gói Pro — nâng cấp hoặc dùng thử 7 ngày để chơi.','warn',3400);
        return;
      }
      document.querySelectorAll('[data-glevel]').forEach(x=>{ x.classList.toggle('active', x===b); x.setAttribute('aria-pressed', x===b?'true':'false'); });
      state.level = lv;
      state.pool = buildPool(state.level); state.poolIdx = 0;
      state.stageWords = 0;
      state.wordsDone = 0;   // đổi cấp → đếm lại từ đầu cho khớp kho từ mới
      saveGameStage();
      updateHud();
      if(state.running) startGame();
    });
    /* ★ Nút quay lại ở thanh tiêu đề KHÔNG gắn ở đây — dùng chung #backLibrary
       cho cả màn game lẫn màn học, nên gán 1 handler duy nhất ở tầng ngoài
       (xem onBackTop) để tránh 2 handler chạy chồng lên nhau. */
  }

  /* ★ Chơi toàn màn hình */
  function isFs(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function syncFsBtn(){
    const b = $('gaFsBtn');
    if(!b) return;
    b.textContent = isFs() ? '⤡' : '⛶';
    b.classList.toggle('on', isFs());
    b.setAttribute('aria-pressed', isFs() ? 'true' : 'false');
    b.title = isFs() ? 'Thoát toàn màn hình (Esc)' : 'Chơi toàn màn hình';
  }
  function toggleFullscreen(){
    const el = $('gameCard');
    if(!el) return;
    try{
      if(!isFs()){
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if(req) req.call(el);
        else toast('Trình duyệt không hỗ trợ toàn màn hình.','warn');
      }else{
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if(exit) exit.call(document);
      }
    }catch(e){ toast('Không bật được toàn màn hình.','warn'); }
  }
  ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,()=>{
    syncFsBtn();
    if(isGameVisible()){ resize(); if(!state.running || state.paused) draw(); }
  }));
  window.addEventListener('resize', ()=>{ if(isGameVisible()) resize(); });

  document.addEventListener('keydown', handleKey);
  const _tt = $('themeToggle');
  if(_tt) _tt.addEventListener('click', ()=> setTimeout(()=>{ if(isGameVisible()) draw(); }, 30));

  wireUI();
  window.__game = { openGame, leaveGame, startGame, togglePause, typeChar, backspaceTarget, nextKey, togglePinyin: toggleGamePinyin, draw, shoot, advanceStage, _update: update, _state: state };
})();

/* ── Event Listeners ── */
/* ★ Đã bỏ handler của "Bộ câu của bạn" (#studiedSets) — mục này không còn,
   tiến độ giờ nằm ngay trên từng thẻ chủ đề / cấp HSK. */
/* ★ Rời màn học: lưu tiến độ rồi quay về ĐÚNG nơi đã mở bộ câu.
   Mở từ màn "AI sinh câu" → về lại đó (thấy ngay danh sách bộ đã lưu).
   Mở từ thư viện → về thư viện như cũ. */
function leaveStudy(){
  save();aiEndSession();activeDataset=null;
  const origin=studyOrigin;studyOrigin='library';
  if(origin==='ai'&&typeof window.showView==='function'){window.showView('ai');return}
  renderLibrary();
}
/* ★ NÚT QUAY LẠI (#backLibrary) — dùng chung cho nhiều màn nên gắn MỘT
   handler duy nhất và tự phân nhánh theo màn đang mở:
   - Đang ở màn chơi GAME  → về sảnh "Game từ vựng" (mục cha của game).
   - Đang ở màn học (gõ / AI) → về đúng nơi đã mở (AI sinh câu hoặc Thư viện).
   ★ Trước đây nút này bị gán 2 handler CHỒNG nhau (leaveGame trong game +
     leaveStudy ở ngoài) → bấm ở màn game sẽ mở cả Thư viện đè lên sảnh game. */
function onBackClick(){
  const gc=$('gameCard');
  const inGame=!!(gc&&!gc.classList.contains('hidden'));
  if(inGame&&window.__game&&window.__game.leaveGame){window.__game.leaveGame();return}
  leaveStudy();
}
$('backLibrary').onclick=onBackClick;
/* ★ Nút "← Bộ khác" + select "📚 Nội dung" trong màn luyện gõ
   (giống hệt cặp nút/select bên màn Luyện phát âm). */
if($('appBackBtn'))$('appBackBtn').onclick=leaveStudy;
if($('appSource'))$('appSource').onchange=async e=>{
  const v=e.target.value||'';if(!v)return;
  try{
    if(v.indexOf('src:')===0)await openVocabSource(v.slice(4));
    else if(v.indexOf('id:')===0)await openDataset(v.slice(3));
  }catch(err){toast('Không mở được bộ này: '+err.message,'bad',5200)}
};
// ★ Theme toggle
$('themeToggle').onclick=toggleTheme;
// ★ Export / Import tiến độ
$('exportProgressBtn').onclick=exportProgress;
$('importProgressBtn').onclick=()=>$('progressFileInput').click();
$('progressFileInput').onchange=e=>{const f=e.target.files?.[0];if(f)importProgress(f);e.target.value=''};
// ★ Kho từ vựng: chuyển tab nguồn (Kho câu giao tiếp / Bộ câu của tôi)
// ★ Mở bộ câu: bấm nút "Học tiếp" trong Thư viện / Bộ câu của bạn
// ★ AI sinh câu: viết prompt → học ngay / đổi nhà cung cấp / lưu key
$('aiStartBtn').onclick=aiStartStudy;
/* ★ Chọn "Học gì" (câu / từ vựng / cả hai) → đổi nhãn câu hỏi, gợi ý, placeholder
   và nhãn số lượng ("5 câu" ↔ "5 từ" ↔ "5 mục") cho khớp nội dung sẽ tạo. */
const AI_KIND_UI={
  sentence:{q:'Bạn muốn học câu tiếng Trung về chủ đề gì?',
            sub:'AI sẽ viết câu hoàn chỉnh kèm pinyin & nghĩa tiếng Việt.',
            ph:'Ví dụ: hội thoại khi đi mua đồ ở chợ, nói thẳng, dùng được ngày mai',
            hint:''},
  word:{q:'Bạn muốn học TỪ VỰNG tiếng Trung về chủ đề gì?',
        sub:'AI sẽ tạo từ / cụm từ ngắn kèm pinyin & nghĩa tiếng Việt — không phải câu dài.',
        ph:'Ví dụ: từ vựng chuyên ngành bao bì carton, công xưởng, mỗi từ dưới 3 chữ',
        hint:'🔤 <b>Chế độ từ vựng:</b> mỗi mục là một từ/cụm từ ngắn (thường 2–4 chữ Hán) — học nhanh, nhớ mặt chữ. Ghi rõ giới hạn trong ô chủ đề (vd “dưới 3 chữ”, “danh từ ngành in”) thì AI sẽ theo đúng.'},
  both:{q:'Bạn muốn học CÂU và TỪ VỰNG về chủ đề gì?',
        sub:'AI sẽ tạo một nửa là từ vựng, một nửa là câu hoàn chỉnh cùng chủ đề.',
        ph:'Ví dụ: đi khám bệnh — nửa là từ vựng triệu chứng, nửa là câu nói với bác sĩ',
        hint:'📝🔤 <b>Chế độ kết hợp:</b> AI chia đều — một nửa là từ/cụm từ ngắn, một nửa là câu hoàn chỉnh, cùng một chủ đề.'}
};
function aiSyncKindUI(){
  const kind=($('aiKind')&&$('aiKind').value)||'sentence';
  const ui=AI_KIND_UI[kind]||AI_KIND_UI.sentence;
  const unit=aiUnitOf(kind);
  const lab=$('aiPromptLabelText'),sub=$('aiPromptSub'),ta=$('aiPrompt'),hint=$('aiKindHint');
  if(lab)lab.textContent=ui.q;
  if(sub)sub.textContent=ui.sub;
  if(ta)ta.placeholder=ui.ph;
  if(hint){hint.innerHTML=ui.hint;hint.style.display=ui.hint?'':'none'}
  const batch=$('aiBatch');
  if(batch){
    /* Nhãn số lượng đổi theo đơn vị — giữ nguyên value (3/5/10) */
    [...batch.options].forEach(o=>{
      const n=String(o.value);
      o.textContent=n+' '+unit;
    });
  }
}
if($('aiKind'))$('aiKind').addEventListener('change',aiSyncKindUI);
window.aiSyncKindUI=aiSyncKindUI;
/* ★ Công tắc "Soát lại nghĩa Việt ↔ chữ Hán" — nhớ lựa chọn trên máy */
if($('aiVerify')){
  $('aiVerify').checked=aiVerifyEnabled();
  $('aiVerify').addEventListener('change',e=>{
    aiLsSet(AI_VERIFY_KEY,e.target.checked?'1':'0');
    toast(e.target.checked?'🔍 Sẽ soát lại nghĩa mỗi lần AI tạo nội dung.':'Đã tắt soát nghĩa — nội dung tạo nhanh hơn nhưng có thể lệch nghĩa.',e.target.checked?'ok':'warn',3200);
  });
}
/* ★ Cập nhật hàng "Lấy API key" theo nhà cung cấp đang chọn:
   link + chữ trên nút + hướng dẫn + placeholder ô key đều đổi theo. */
function aiProviderRefresh(){
  const sel=$('aiProvider'),prov=(sel&&sel.value)||AI_DEFAULT_PROVIDER;
  const cfg=AI_PROVIDERS[prov]||AI_PROVIDERS[AI_DEFAULT_PROVIDER];
  const a=$('keyHelpLink'),h=$('keyHelpHint'),k=$('aiKey');
  if(a){a.href=cfg.keyUrl;a.textContent=cfg.keyBtn}
  if(h)h.innerHTML=cfg.keyHint;
  if(k)k.placeholder=cfg.ph;
}
$('aiProvider').addEventListener('change',e=>{
  const v=e.target.value;
  const prev=aiLsGet(AI_PROV_KEY,AI_DEFAULT_PROVIDER);
  const k=$('aiKey');
  /* ★ Mỗi nhà cung cấp có key RIÊNG → đổi qua lại không mất key đã dán. */
  if(k&&prev&&prev!==v)aiKeyStore(prev,k.value.trim());
  aiLsSet(AI_PROV_KEY,v);
  if(k)k.value=aiKeyLoad(v);
  aiProviderRefresh();
});
$('aiKey').addEventListener('change',e=>{
  const sel=$('aiProvider');
  aiKeyStore((sel&&sel.value)||AI_DEFAULT_PROVIDER,e.target.value.trim());
});
// ★ Khôi phục tuỳ chọn AI đã lưu
(function(){
  const p=aiLsGet(AI_PROV_KEY,AI_DEFAULT_PROVIDER),sel=$('aiProvider');
  /* ★ Giá trị cũ có thể là 'puter'/'poll' (đã bỏ) → tự đưa về mặc định Gemini. */
  const use=AI_PROVIDERS[p]?p:AI_DEFAULT_PROVIDER;
  if(sel)sel.value=use;
  if(use!==p)aiLsSet(AI_PROV_KEY,use);
  const k=$('aiKey');
  if(k)k.value=aiKeyLoad(use);
  aiProviderRefresh();
  aiSyncKindUI();          // đồng bộ nhãn "Học gì" ngay lần đầu
})();
// ★ Kho từ vựng: chuyển nhóm (HSK / Chủ đề / Khác) + tìm kiếm + chọn mục
/* ★ Chỉ gắn cho NÚT TAB thật (.modeBtn). Trước đây quét mọi [data-vtab] nên thẻ
   lối tắt trên Bảng điều khiển (cũng có data-vtab) bị gán nhầm handler đổi tab. */
document.querySelectorAll('.modeBtn[data-vtab]').forEach(b=>{
  b.onclick=()=>{
    vocabTab=b.dataset.vtab;
    document.querySelectorAll('.modeBtn[data-vtab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b?'true':'false')});
    vocabQuery='';const s=$('vocabSearch');if(s)s.value='';
    renderVocab();
  };
});
$('vocabSearch').addEventListener('input',e=>{vocabQuery=e.target.value||'';renderVocab()});
$('vocabList').addEventListener('click',e=>{const b=e.target.closest('[data-vsrc]');if(b)openVocabSource(b.dataset.vsrc)});
// ★ App modal — nút và bàn phím
$('appModalOk').onclick=()=>_modalClose(_modalIsInput?$('appModalInput').value:true);
$('appModalCancel').onclick=()=>_modalClose(_modalIsInput?null:false);
$('appModalInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();_modalClose($('appModalInput').value)}});
$('appModal').addEventListener('click',e=>{if(e.target===$('appModal'))_modalClose(_modalIsInput?null:false)});
document.addEventListener('keydown',e=>{
  if(!$('appModal').classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault();_modalClose(_modalIsInput?null:false)}
},true);
$('audioBtn').onclick=speakChinese;
document.addEventListener('keydown',e=>{
  if(e.key==='F1'){e.preventDefault();speakChinese();setTimeout(()=>$('pinyinInput')?.focus(),0)}
});
/* ★ Gõ sai → có HIỆU ỨNG LỖI (rung ô gõ + báo bằng chứng), ký tự sai vẫn
   KHÔNG vào ô gõ. Người dùng không bị "mất chữ" mà vẫn biết mình gõ sai. */
function hanziInputShake(){
  const inp=$('pinyinInput');
  inp.classList.remove('shakeBad');
  void inp.offsetWidth;          // ép reflow để animation chạy lại
  inp.classList.add('shakeBad');
  setTimeout(()=>inp.classList.remove('shakeBad'),520);
}
/* ★ Bắt đầu gõ bằng IME tiếng Trung → dọn viền đỏ / thông báo lỗi cũ.
   Trước đây đang báo đỏ mà người dùng chuyển sang gõ pinyin (đang composition)
   thì viền đỏ vẫn nằm đó, trông như bị chặn dù thực ra chỉ là đang gõ dở. */
$('pinyinInput').addEventListener('compositionstart',()=>{
  composing=true;
  const inp=$('pinyinInput');
  inp.classList.remove('bad','shakeBad');
  const fb=$('feedback');
  if(fb&&fb.classList.contains('bad')&&!awaitingEnter){fb.className='feedback hidden';fb.innerHTML=''}
});
$('pinyinInput').addEventListener('compositionend',()=>{composing=false;handleAutoTyping()});
/* Ô gõ không tự bắt phím nữa — phím được xử lý ở TẦNG DOCUMENT (bên dưới)
   để nhấn Enter/Space luôn có tác dụng kể cả khi ô gõ đang mất focus. */
$('pinyinInput').addEventListener('input',handleAutoTyping);
$('pinyinInput').addEventListener('paste',e=>e.preventDefault());
/* ═══════════════════════════════════════════════════════════
   ★ PHÍM TẮT Ở TẦNG DOCUMENT — không phụ thuộc focus của ô gõ.
   Trước đây handler bị gắn thẳng vào #pinyinInput nên khi người dùng
   bấm ra chỗ khác (dòng chữ Hán, nút bấm, thanh cuộn…) thì nhấn Space
   không sang câu được, phải click lại vào ô gõ mới nhận phím.
   ═══════════════════════════════════════════════════════════ */
/* Game bắn chữ tự xử lý phím khi đang mở → nhường cho game, tránh xung đột.
   (isGameVisible() nằm trong IIFE của game, không truy cập được ở đây nên
    kiểm tra trực tiếp #gameCard cho chắc.) */
function typingGameOpen(){
  const c=$('gameCard');
  return !!(c&&!c.classList.contains('hidden'));
}
function typingModeActive(){
  const quiz=$('quizArea');
  if(!quiz||quiz.classList.contains('hidden'))return false;
  /* Không cần dataset: nếu màn hình luyện gõ đang mở và game đã đóng thì
     phím tắt vẫn phải hoạt động (ví dụ đang xem lại câu, đã hết bộ câu…). */
  return !typingGameOpen();
}
document.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  if(typingGameOpen())return;
  if(!typingModeActive())return;
  /* Đang mở modal (hướng dẫn / lịch sử / xác nhận) → không xử lý phím của
     màn hình luyện gõ, tránh việc Enter vừa đóng modal vừa bật pinyin. */
  if(document.querySelector('.modal:not([hidden])'))return;
  const am=$('appModal');
  if(am&&am.classList.contains('show'))return;
  /* ★ Không cướp phím khi người dùng đang gõ ở MỘT Ô KHÁC (ô tìm từ vựng,
     prompt AI, modal…). Chỉ xử lý khi focus ở ô gõ chữ Hán hoặc ở vùng
     trung tính (body / nút / dòng chữ Hán) — nhờ vậy Space vẫn sang câu
     được dù ô gõ không có focus, mà không phá các ô nhập khác. */
  const ae=document.activeElement;
  if(ae&&ae!==$('pinyinInput')){
    const tag=(ae.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||ae.isContentEditable)return;
  }
  /* ENTER: ẩn/hiện gợi ý pinyin — ĐÂY LÀ PHÍM DUY NHẤT làm việc này. */
  if(e.key==='Enter'){
    e.preventDefault();
    hint();
    return;
  }
  /* SPACE: CHỈ để SANG MỤC KẾ TIẾP — không bao giờ ẩn/hiện pinyin nữa
     (trước đây Space vừa sang câu vừa bật/tắt pinyin nên rất dễ bấm nhầm).
     · Đã gõ đúng (awaitingEnter)  → sang mục kế tiếp.
     · Ô gõ đã đúng đáp án nhưng trạng thái chưa kịp chốt (IME vừa chốt chữ
       bằng Space, AI vừa chèn mục mới, màn hình vừa render lại…) → chốt rồi
       sang luôn, KHÔNG im lặng bỏ qua cú bấm.
     · Còn đang gõ dở → không làm gì cả. */
  if(e.key===' '||e.key==='Spacebar'){
    e.preventDefault();
    if(awaitingEnter){goNextAfterCorrect();return}
    if(hanziComplete()){
      markSentenceCorrect();
      if(awaitingEnter)goNextAfterCorrect();
      return;
    }
    return;
  }
  /* BACKSPACE khi đang chờ Space → quay lại làm câu vừa làm */
  if(e.key==='Backspace'&&awaitingEnter){
    e.preventDefault();
    goPrevSentence();
    return;
  }
  /* Đang chờ sang câu → chặn mọi ký tự khác gõ vào ô đã khoá */
  if(awaitingEnter&&e.key.length===1)e.preventDefault();
});
/* ★ Giữ ô gõ luôn có focus trong màn hình luyện gõ — khi người dùng bấm
   vào vùng trống hoặc dòng chữ Hán, focus quay lại ô gõ (nhưng không
   giành focus khi họ cố bấm nút / bảng / ô nhập khác). */
document.addEventListener('pointerdown',e=>{
  if(!typingModeActive())return;
  const t=e.target;
  if(!t||!t.closest)return;
  /* Không mở modal / đang mở modal → đừng giành focus */
  if(document.querySelector('.modal:not([hidden])'))return;
  /* không giành focus nếu bấm vào nút bấm, ô nhập khác, link, hoặc khu vực chữ Hán
     (bấm chữ Hán để tra nghĩa là hành vi có chủ đích) */
  if(t.closest('button,a,input:not(#pinyinInput),textarea,select,.hanzi-pair,.modal,#app-history-panel,.hanzi'))return;
  const inp=$('pinyinInput');
  if(inp&&document.activeElement!==inp)setTimeout(()=>inp.focus(),0);
},true);
$('hintBtn').onclick=hint;
/* ── ★ Modal hướng dẫn (nút 💡): giải thích toàn bộ cơ chế gõ + phím tắt ──
   Chỉ mở từ giao diện Luyện gõ (học câu) — không đặt trong game. */
function openHelpModal(){
  const m=$('helpModal');if(!m)return;
  m.hidden=false;document.body.style.overflow='hidden';
  try{(m.querySelector('.modalClose')||m).focus()}catch(e){}
}
function closeHelpModal(){
  const m=$('helpModal');if(!m||m.hidden)return;
  m.hidden=true;
  if(!document.querySelector('.modal:not([hidden])'))document.body.style.overflow='';
}
$('helpBtn').onclick=openHelpModal;
/* nút ✕ / nền mờ / "Đã hiểu" → đóng (gopinyin.js cũng đóng lại lần nữa, không sao) */
document.querySelectorAll('#helpModal [data-close]').forEach(el=>el.addEventListener('click',closeHelpModal));
/* ★ Khi modal mở: nuốt phím để game / F1 / tra nghĩa không xử lý; Esc thì đóng */
document.addEventListener('keydown',e=>{
  const hm=$('helpModal'),xm=$('histModal');
  const open=(hm&&!hm.hidden)?'help':((xm&&!xm.hidden)?'hist':null);
  if(!open)return;
  if(e.key==='Escape'){e.preventDefault();open==='help'?closeHelpModal():closeHistModal();return}
  e.stopPropagation();
  if(e.key!=='Tab')e.preventDefault();
},true);
$('retrySentenceBtn').onclick=retrySentence;
if($('prevSentenceBtn'))$('prevSentenceBtn').onclick=goPrevSentence;
$('skipBtn').onclick=skip;
/* ★ Side panel "Câu đã gõ": click để làm lại */
const histPanel=$('app-history-panel');
if(histPanel){
  histPanel.addEventListener('click',e=>{
    const tab=e.target.closest('.appHistoryTab');
    if(tab){setHistFilter(tab.dataset.tab);return;}
    const item=e.target.closest('.appHistoryItem[data-id]');
    if(item){closeHistModal();gotoRowById(item.dataset.id);}
  });
  histPanel.addEventListener('keydown',e=>{
    const item=e.target.closest('.appHistoryItem[data-id]');
    if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();closeHistModal();gotoRowById(item.dataset.id);}
  });
}
$('resetBtn').onclick=resetProgress;
$('restartBtn').onclick=()=>{
  if(mode==='wrong')switchMode('all');
  else leaveStudy();
};
/* Nút chế độ đã bỏ — không còn binding allModeBtn/wrongModeBtn */
/* ★ Nút “Câu đã làm”: mở BẢNG LỚN liệt kê TẤT CẢ câu đã làm (modal) */
function openHistModal(){
  const m=$('histModal');if(!m)return;
  setHistFilter('done');renderAppHistory();
  m.hidden=false;document.body.style.overflow='hidden';
  try{(m.querySelector('.modalClose')||m).focus()}catch(e){}
}
function closeHistModal(){
  const m=$('histModal');if(!m||m.hidden)return;
  m.hidden=true;
  if(!document.querySelector('.modal:not([hidden])'))document.body.style.overflow='';
}
function showHistoryPanel(){openHistModal()}
if($('historyBtn'))$('historyBtn').onclick=showHistoryPanel;
document.querySelectorAll('#histModal [data-close]').forEach(el=>el.addEventListener('click',closeHistModal));
if($('weakBuildBtn'))$('weakBuildBtn').onclick=buildWeakDataset;
$('soundToggle').onclick=toggleAutoSound;
if($('readTypeToggle'))$('readTypeToggle').onclick=toggleReadType;
$('viToggle').onclick=toggleVietnamese;
if($('hanToggle'))$('hanToggle').onclick=toggleHanziLine;
// ★ Đóng bubble Google Dịch — nút ✕, gõ phím bất kỳ, hoặc click ra ngoài
$('gtClose').onclick=gtReset;
/* ★ Tra nghĩa online: luôn bật (đã bỏ nút bật/tắt) — gọi thẳng MyMemory qua HTTPS */
// ★ Gõ BẤT KỲ phím nào → tự tắt popup (Esc cũng tắt)
document.addEventListener('keydown',e=>{
  if($('appModal').classList.contains('show'))return; // modal ưu tiên hơn
  if(!$('gtPopup').classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault()}
  gtReset();
});
// ★ Click BẤT KỲ đâu → tự tắt popup
// (click vào chữ Hán đã stopPropagation nên không tới đây → vẫn mở popup mới bình thường)
document.addEventListener('click',e=>{
  if($('appModal').classList.contains('show'))return;
  if(!$('gtPopup').classList.contains('show'))return;
  // Không tắt khi click bên trong popup (ví dụ nút ✕)
  if($('gtPopup').contains(e.target))return;
  gtReset();
});
$('rateSelect').onchange=e=>{speechRate=Number(e.target.value)||.8;save();$('pinyinInput').focus()};
$('voiceSelect').onchange=e=>{
  selectedVoiceName=e.target.value;save();
  const q=index<order.length?rows[order[index]]:null;
  if(q&&q.zh&&q.zh!=='—')speakText(q.zh,false);
  $('pinyinInput').focus();
};
if('speechSynthesis'in window){
  window.speechSynthesis.onvoiceschanged=populateVoiceSelect;
  setTimeout(populateVoiceSelect,100);
}

/* ── ★ Header: đổ bóng khi cuộn (sticky) ── */
(function(){
  const bar=$('topBar');if(!bar)return;
  let ticking=false;
  const onScroll=()=>{
    if(ticking)return;ticking=true;
    requestAnimationFrame(()=>{
      bar.classList.toggle('scrolled',(window.scrollY||document.documentElement.scrollTop||0)>8);
      ticking=false;
    });
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
})();

/* ── Init ── */
initTheme();
loadWeakSpeed();
(async()=>{
  await initDB();
  if(dbBroken)showStorageWarn();
  try{ renderLibrary(); }catch(e){toast('Không tải được thư viện: '+e.message,'bad',5000)}
})();

/* ═══════════════════════════════════════════════════════════════
   ★ CẦU NỐI CHO MODULE "LUYỆN PHÁT ÂM" (assets/pronounce.js)
   ───────────────────────────────────────────────────────────────
   Module luyện phát âm nằm ở file riêng để không phình to file này,
   nhưng phải DÙNG CHUNG kho dữ liệu + tiện ích với phần luyện gõ.
   Thay vì để file kia chọc thẳng vào biến nội bộ (dễ vỡ khi refactor),
   ở đây mở ra một mặt tiếp xúc nhỏ, chỉ đọc.
   ═══════════════════════════════════════════════════════════════ */
window.__gpBridge = {
  /* dữ liệu bài học hiện tại (cùng nguồn với luyện gõ) */
  rows: () => rows,
  activeDataset: () => activeDataset,
  hskData: () => (typeof HSK_DATA !== 'undefined' ? HSK_DATA : {}),
  dbGetAll: () => dbGetAll(),
  /* tiến độ luyện gõ của 1 bộ — để màn Luyện phát âm biết bộ nào đã học */
  loadProgress: (id) => loadProgress(id),
  continueDataset: async () => {
    const sets = await dbGetAll();
    const candidates = sets.map(ds => ({ ds, progress: loadProgress(ds.id) }))
      .filter(({ progress }) => {
        if (!progress || !Array.isArray(progress.mainOrder) || !progress.mainOrder.length) return false;
        const index = Number(progress.mainIndex) || 0;
        const attempts = Number(progress.stats?.attempts) || 0;
        return index < progress.mainOrder.length && (index > 0 || attempts > 0);
      })
      .sort((a, b) =>
        (Number(b.progress.lastStudiedAt) || Number(b.ds.updatedAt) || 0)
        - (Number(a.progress.lastStudiedAt) || Number(a.ds.updatedAt) || 0)
      );
    const candidate = candidates[0];
    if (!candidate) return null;
    return {
      id: candidate.ds.id,
      name: candidate.ds.name,
      completed: Math.max(0, Number(candidate.progress.mainIndex) || 0),
      total: candidate.progress.mainOrder.length
    };
  },
  resumeDataset: async (id) => {
    const sets = await dbGetAll();
    if (!sets.some(ds => ds.id === id)) throw new Error('Bộ học này không còn trong thư viện.');
    await openDataset(id);
  },
  /* tiện ích xử lý chữ Hán / pinyin — dùng lại, không viết bản sao */
  hanChars: (s) => hanChars(s),
  isHanChar: (c) => isHanChar(c),
  answerWords: (q) => answerWords(q),
  hanSyllableList: (q, n) => hanSyllableList(q, n),
  /* giao diện dùng chung */
  toast: (m, kind, ms) => toast(m, kind, ms),
  escapeHtml: (s) => escapeHtml(s),
  chineseVoices: () => { try { return getChineseVoices(); } catch (e) { return []; } },
  /* trạng thái âm thanh đang dùng ở màn luyện gõ (để đồng bộ mặc định) */
  speechRate: () => speechRate,
  voiceName: () => selectedVoiceName
};
