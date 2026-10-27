import { readings, tones, toneNames } from './content.js';
import { applyActivity, bearLevel, emptyDay, localDay, quests, weeklyProgress } from './model.js';
import { dataOwner, learningStorage, listRecordEntries, onDataChange } from '../../shared/storage/account-data.js';
import { requireAccount } from '../auth/service.js';
import { speakText } from '../../shared/audio/tts.js';
import { celebrate, effectPreference, setEffectPreference } from '../../shared/celebrations.js';
import { showView } from '../../app/navigation.js';
import { navigationVersion } from '../../app/routes.js';
import { studyOverlayOpen } from '../../shared/study/interactions.js';
import { readingMarkup } from './presentation.js';
import { renderVisibleMascots } from '../../shared/mascot.js';

const $ = id => document.getElementById(id);
const prefix = 'cts:progress:journey-day:';
let activeReading, toneIndex = 0, quizOrder = [], toneDone = false;
let shadowLine = 0, recorder, stream, recordingUrl, shadowEpoch = 0, recordingTimer, startedAt = 0, requesting = false;
let shadowOwner;
let journeySpeech = false;
const dateKey = () => prefix + localDay();
function readDay() { try { const v = JSON.parse(learningStorage.getItem(dateKey())); return v?.events && v?.counts && Array.isArray(v.claimed) ? v : emptyDay(); } catch { return emptyDay(); } }
function days() { return listRecordEntries('kv').filter(r => r.record_id.startsWith(prefix)).flatMap(r => { try { const d = JSON.parse(r.payload); return [{...d,date:r.record_id.slice(prefix.length)}]; } catch { return []; } }); }
function totalXp() { return days().reduce((sum,d) => sum + Math.max(0,Number(d.xp)||0),0); }

export function recordActivity(kind,id) {
  if (!dataOwner()) return;
  const before = bearLevel(totalXp()), beforeWeekly = weeklyProgress(days()), day = readDay(), result = applyActivity(day,kind,String(id));
  if (result.day === day) return;
  learningStorage.setItem(dateKey(),JSON.stringify(result.day));
  const after = bearLevel(totalXp());
  const afterWeekly = weeklyProgress(days());
  const gift = {5:'Mũ học tập',10:'Ba lô khám phá',15:'Ghim ngôi sao',20:'Nhà thám hiểm'}[after.level];
  if (after.level > before.level) celebrate({id:`level:${dataOwner()}:${after.level}`,kind:'level',title:`Gấu lên cấp ${after.level}! ${gift?'Mở khóa '+gift+'.':'Cùng tiến xa hơn.'}`});
  else if(afterWeekly.earned.length>beforeWeekly.earned.length) celebrate({id:`weekly:${dataOwner()}:${afterWeekly.earned.at(-1)}`,kind:'badge',title:'Huy hiệu mới: Bạn học chăm chỉ!'});
  else if (result.quests.length) celebrate({id:`quest:${dataOwner()}:${localDay()}:${result.quests.map(q=>q.id)}`,kind:'quest',title:`Hoàn thành nhiệm vụ · +${result.added} XP`});
  else if (result.added) celebrate({id:`activity:${dataOwner()}:${localDay()}:${kind}:${id}`,kind:['reading','tone','shadow','game'].includes(kind)?'complete':'correct',title:`${kind==='typing'?'Chính xác!':'Hoàn thành lượt luyện!'} +${result.added} XP`});
  renderJourney();
}
function questCards(day) {
  return quests.map(q => `<button class="journeyQuest" type="button" data-view="${q.view}"><span class="featureEyebrow">${day.claimed.includes(q.id)?'Đã hoàn thành · +5 XP':'Nhiệm vụ · +5 XP'}</span><b>${q.title}</b><span>${q.text}</span><progress max="${q.target}" value="${Math.min(q.target,day.counts[q.id])}" aria-label="${q.title}"></progress><small>${Math.min(q.target,day.counts[q.id])}/${q.target} · ${day.claimed.includes(q.id)?'Tuyệt lắm!':'Luyện ngay →'}</small></button>`).join('');
}
export function renderJourney() {
  if (!$('bearProgress')) return;
  const xp = totalXp(), level = bearLevel(xp), day = readDay();
  $('bearProgress').innerHTML = `<span class="featureEyebrow">${dataOwner()?'Hành trình của bạn':'Đăng nhập để lưu hành trình'}</span><h3>Gấu cấp ${level.level} <small>· ${xp} XP</small></h3><progress max="${level.needed||1}" value="${level.needed?level.current:1}" aria-label="Tiến độ lên cấp"></progress><p>${level.needed?`${level.current}/${level.needed} XP đến cấp ${level.level+1}`:'Đã đạt cấp tối đa. Tiếp tục học theo nhịp của bạn!'}</p>`;
  $('bearQuests').innerHTML = questCards(day);
  if ($('dashQuests')) $('dashQuests').innerHTML = questCards(day);
  if ($('dashBearLevel')) $('dashBearLevel').textContent = `Gấu cấp ${level.level} · ${xp} XP`;
  if ($('dashBearNext')) $('dashBearNext').textContent = level.needed?`Còn ${level.needed-level.current} XP để lên cấp ${level.level+1}.`:'Gấu đã đạt cấp 20. Cùng tiếp tục khám phá!';
  if ($('dashBearXp')) { $('dashBearXp').max=level.needed||1; $('dashBearXp').value=level.needed?level.current:1; }
  if ($('gameDailyXp')) $('gameDailyXp').textContent=`${day.gameXp||0} / 20 XP`;
  const {activeDays,earned} = weeklyProgress(days());
  $('weeklyChallenge').innerHTML = `<span class="featureEyebrow">Thử thách tuần này</span><h3>Hẹn gấu 4 ngày</h3><p>Hoàn thành một hoạt động trong 4 ngày khác nhau. ${Math.min(activeDays,4)}/4 ngày.</p><progress value="${Math.min(activeDays,4)}" max="4" aria-label="Thử thách tuần"></progress><small>${activeDays>=4?'Đã nhận huy hiệu Bạn học chăm chỉ tuần này.':'Không cần học liên tục. Mỗi ngày một chút là đủ.'}</small>`;
  const milestones = [[5,'Mũ học tập'],[10,'Ba lô khám phá'],[15,'Ghim ngôi sao'],[20,'Nhà thám hiểm']];
  $('bearMilestones').innerHTML=milestones.map(([n,title])=>`<div class="bearMilestone"><span>Lv.${n}</span><b>${title}</b><small>${level.level>=n?'Đã mở khóa':'Chưa mở'}</small></div>`).join('');
  const events=days().flatMap(d=>Object.keys(d.events||{}).map(key=>{try{return JSON.parse(key)[0];}catch{return '';}}));
  const badgeSpecs=[['Khởi đầu',events.length>0,'Hoàn thành một hoạt động'],['Nhớ mặt chữ',events.includes('typing'),'Gõ đúng một câu'],['Tai tinh',events.includes('tone'),'Hoàn thành bài thanh điệu'],['Bắt nhịp',events.includes('shadow'),'Thu một lượt Shadowing'],['Đọc trọn',events.includes('reading'),'Hoàn thành một bài khóa'],['Bền bỉ',earned.length>0,'Học bốn ngày trong một tuần']];
  $('bearBadges').innerHTML=badgeSpecs.map(([title,unlocked,hint],i)=>`<div class="bearBadge ${unlocked?'unlocked':''}"><span class="badgeEmblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${['M5 17C2 8 12 3 20 4c0 8-4 16-13 14m-2 2L17 7','M3 5h18v14H3zm4 4h2m2 0h2m2 0h2m-9 5h8','M4 9h4l5-4v14l-5-4H4zm12-2a7 7 0 0 1 0 10','M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0m-7 8v3','M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zm10 3a3 3 0 0 1 3-3h4v15h-7','M7 3h10v6a5 5 0 0 1-10 0zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v7m-4 0h8'][i]}"/></svg></span><b>${title}</b><small>${unlocked?'Đã đạt':hint}</small></div>`).join('');
}
function linesMarkup(lines) { return lines.map(([zh,py,vi])=>`<div class="journeySentence"><p lang="zh-CN">${zh}</p><p class="journeyPinyin">${py}</p><p>${vi}</p></div>`).join(''); }
function openReading(id) {
  activeReading = readings.find(x=>x.id===id); if (!activeReading) return;
  $('readingList').hidden = true; $('readingLesson').hidden = false;
  $('readingLesson').innerHTML = readingMarkup(activeReading);
  $('readingLesson').classList.remove('hide-reading-pinyin','hide-reading-meaning');
  renderVisibleMascots();
  $('readingHeading').focus({preventScroll:true});
}
function renderTone() {
  const item = tones[quizOrder[toneIndex]];
  $('toneQuiz').innerHTML = `<span class="featureEyebrow">NGHE PHÂN BIỆT · CÂU ${toneIndex+1}/5</span><div class="toneQuestion"><button type="button" class="toneListen" data-tone-sample="${quizOrder[toneIndex]}" aria-label="Nghe âm mẫu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zm12-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/></svg></button><h3>Bạn vừa nghe thanh nào?</h3><p>Nghe mẫu, sau đó chọn đường thanh phù hợp.</p></div><div class="toneChoices">${toneNames.map((name,i)=>`<button type="button" class="btn secondary" data-tone-answer="${i}"><span>${name}</span><svg viewBox="0 0 140 52" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="${['M16 24h108','M16 40L124 10','M16 12Q65 72 124 12','M16 10L124 43','M60 24h20'][i]}"/></svg></button>`).join('')}</div><details class="toneHint"><summary>Gợi ý chữ &amp; Pinyin</summary><div class="journeySentence"><p lang="zh-CN">${item.han}</p><p class="journeyPinyin">${item.py}</p><p>${item.vi}</p></div></details><p id="toneFeedback" role="status"></p>`;
}
function shadowContent() { return readings[Number($('shadowSource').value)||0]; }
function renderShadow() {
  const content = shadowContent();
  $('shadowPhrase').innerHTML = `<span class="featureEyebrow">Câu ${shadowLine+1}/${content.lines.length}</span>${linesMarkup([content.lines[shadowLine]])}`;
  $('shadowNext').textContent = shadowLine===content.lines.length-1?'Về câu đầu · 5':'Câu tiếp · 5';
  if($('shadowOutline'))$('shadowOutline').innerHTML=content.lines.map(([zh,py,vi],i)=>`<button type="button" data-shadow-line="${i}" class="${i===shadowLine?'selected':''}"><b lang="zh-CN">${zh}</b><span>${py}</span><small>${vi}</small></button>`).join('');
}
function clearShadow() {
  shadowEpoch++; requesting = false; clearTimeout(recordingTimer);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(t=>t.stop()); stream = null; recorder = null;
  if (journeySpeech && 'speechSynthesis' in window) speechSynthesis.cancel();
  journeySpeech = false;
  if (recordingUrl) URL.revokeObjectURL(recordingUrl); recordingUrl = null;
  $('shadowPlayback').pause(); $('shadowPlayback').removeAttribute('src'); $('shadowPlayback').hidden = true;
  $('shadowRecord').disabled = false; $('shadowRecord').textContent = 'Nói theo · Enter';
  $('shadowStatus').textContent = 'Nghe mẫu rồi nói theo ít nhất 2 giây. Tối đa 15 giây mỗi lượt.';
}
async function toggleShadow() {
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if (requesting) return;
  const navigation = navigationVersion();
  if (!await requireAccount() || navigation !== navigationVersion() || $('shadowTextCard').classList.contains('hidden')) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { $('shadowStatus').textContent = 'Trình duyệt chưa hỗ trợ thu âm. Bạn vẫn có thể nghe và nói theo mẫu.'; return; }
  clearShadow();
  const epoch = shadowEpoch, content = shadowContent(), line = shadowLine;
  shadowOwner = dataOwner(); requesting = true; $('shadowRecord').disabled = true;
  $('shadowStatus').textContent = 'Đang xin quyền micro…';
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({audio:true});
    if (epoch !== shadowEpoch || shadowOwner !== dataOwner() || $('shadowTextCard').classList.contains('hidden') || document.hidden) { acquired.getTracks().forEach(t=>t.stop()); return; }
    stream = acquired; const chunks = []; const current = new MediaRecorder(acquired); recorder = current;
    current.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    current.onstop = () => {
      acquired.getTracks().forEach(t=>t.stop()); clearTimeout(recordingTimer);
      if (epoch !== shadowEpoch || shadowOwner !== dataOwner()) return;
      recorder = null; stream = null;
      $('shadowRecord').textContent = 'Nói lại · Enter';
      const duration = performance.now()-startedAt;
      if (duration<2000 || !chunks.length) { $('shadowStatus').textContent='Lượt thu quá ngắn. Hãy nói theo ít nhất 2 giây rồi dừng.'; return; }
      const blob = new Blob(chunks,{type:current.mimeType || chunks[0].type});
      recordingUrl = URL.createObjectURL(blob); $('shadowPlayback').src = recordingUrl; $('shadowPlayback').hidden = false;
      $('shadowStatus').textContent='Đã thu xong. Nghe lại và so sánh nhịp, thanh điệu với mẫu. Đây chưa phải kết quả chấm phát âm.';
      recordActivity('shadow',content.id+':'+line);
    };
    current.onerror = () => { if (epoch===shadowEpoch) { clearShadow(); $('shadowStatus').textContent='Thu âm bị gián đoạn. Hãy thử lại.'; } };
    startedAt = performance.now(); current.start(); $('shadowRecord').disabled = false; $('shadowRecord').textContent = 'Dừng ghi âm · Enter'; $('shadowStatus').textContent='Đang ghi âm… bấm Dừng khi nói xong.';
    recordingTimer = setTimeout(()=>{if(current.state==='recording')current.stop();},15000);
  } catch { if (epoch===shadowEpoch) { clearShadow(); $('shadowStatus').textContent='Không mở được micro. Kiểm tra quyền micro rồi thử lại.'; } }
  finally { if(epoch===shadowEpoch) { requesting=false; $('shadowRecord').disabled=false; } }
}
export function initializeJourney() {
  $('readingList').innerHTML=readings.map(r=>`<button type="button" class="journeyLesson" data-reading="${r.id}"><span class="featureEyebrow">HSK 1 · ${r.topic}</span><b>${r.title}</b><span>3 câu đọc · 3 câu kiểm tra</span><small>Bắt đầu đọc →</small></button>`).join('');
  $('toneExamples').innerHTML=tones.map((t,i)=>`<button type="button" class="toneExample" data-tone-sample="${i}"><span class="toneContour" aria-hidden="true">${['→','↗','∨','↘','·'][i]}</span><b lang="zh-CN">${t.han}</b><strong>${t.py}</strong><span>${toneNames[i]}</span></button>`).join('');
  $('shadowSource').innerHTML=readings.map((r,i)=>`<option value="${i}">${r.title}</option>`).join(''); renderShadow();
  document.addEventListener('click',async e=>{
    const quest=e.target.closest('.journeyQuest[data-view]'); if(quest) showView(quest.dataset.view);
    const reading = e.target.closest('[data-reading]'); if(reading) openReading(reading.dataset.reading);
    const line=e.target.closest('[data-reading-line]');if(line&&activeReading){journeySpeech=true;speakText(activeReading.lines[Number(line.dataset.readingLine)][0]);}
    const toggle=e.target.closest('[data-reading-toggle]');if(toggle){const on=toggle.getAttribute('aria-pressed')!=='true';toggle.setAttribute('aria-pressed',String(on));$('readingLesson').classList.toggle('hide-reading-'+toggle.dataset.readingToggle,!on);}
    const practice=e.target.closest('[data-reading-practice]');if(practice)document.dispatchEvent(new CustomEvent('gp:practice-reading',{detail:practice.dataset.readingPractice}));
    const shadow=e.target.closest('[data-reading-shadow]');if(shadow){clearShadow();$('shadowSource').value=String(readings.findIndex(r=>r.id===shadow.dataset.readingShadow));shadowLine=0;renderShadow();void showView('shadowText');}
    const shadowTarget=e.target.closest('[data-shadow-line]');if(shadowTarget){clearShadow();shadowLine=Number(shadowTarget.dataset.shadowLine);renderShadow();}
    if(e.target.closest('#readingBack')) { $('readingList').hidden=false; $('readingLesson').hidden=true; window.speechSynthesis?.cancel(); }
    if(e.target.closest('#readingListen')&&activeReading) { journeySpeech=true; speakText(activeReading.lines.map(x=>x[0]).join('')); }
    const sample=e.target.closest('[data-tone-sample]'); if(sample) { journeySpeech=true; speakText(tones[Number(sample.dataset.toneSample)].han); }
    const answer=e.target.closest('[data-tone-answer]'); if(answer&&!toneDone) {
      if(Number(answer.dataset.toneAnswer)!==tones[quizOrder[toneIndex]].tone) { $('toneFeedback').textContent='Thử lại nhé. Quan sát dấu trên nguyên âm và nghe âm mẫu.'; return; }
      if(++toneIndex<5) { renderTone(); $('toneQuiz').querySelector('button')?.focus({preventScroll:true}); }
      else { toneDone=true; $('toneQuiz').innerHTML='<p role="status">Đúng cả 5 âm! Bạn đã hoàn thành lượt nhận biết thanh điệu.</p>'; recordActivity('tone','five-basic-tones'); }
    }
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='readingQuiz')return; e.preventDefault(); const form=new FormData(e.target); const score=activeReading.questions.filter((q,i)=>Number(form.get('q'+i))===q[2]).length; $('readingResult').textContent=`Bạn đúng ${score}/3 câu. ${score>=2?'Hoàn thành! Hãy thử đọc lại thành tiếng.':'Đọc lại đoạn trên rồi thử một lần nữa nhé.'}`; if(score>=2)recordActivity('reading',activeReading.id);});
  $('toneStart').addEventListener('click',()=>{toneIndex=0;toneDone=false;quizOrder=[0,1,2,3,4];for(let i=4;i>0;i--){const j=Math.floor(Math.random()*(i+1));[quizOrder[i],quizOrder[j]]=[quizOrder[j],quizOrder[i]];}$('toneExamples').hidden=true;$('toneStart').textContent='Luyện lại 5 âm';$('toneQuiz').hidden=false;renderTone();});
  $('shadowListen').addEventListener('click',()=>{if(recorder||requesting)return;$('shadowPlayback').pause();journeySpeech=true;speakText(shadowContent().lines[shadowLine][0]);});
  $('shadowRecord').addEventListener('click',toggleShadow);
  document.addEventListener('keydown',e=>{
    if($('shadowTextCard').classList.contains('hidden')||studyOverlayOpen()||e.repeat||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.key==='Enter'&&e.target.closest('button,a'))return;
    const action=e.key==='Enter'?'shadowRecord':e.key==='4'?'shadowListen':e.key==='5'?'shadowNext':null;
    if(action){e.preventDefault();$(action).click();}
  });
  $('shadowNext').addEventListener('click',()=>{clearShadow();shadowLine=(shadowLine+1)%shadowContent().lines.length;renderShadow();$('shadowStatus').textContent='Nghe mẫu rồi nói theo ít nhất 2 giây.';});
  $('shadowSource').addEventListener('change',()=>{clearShadow();shadowLine=0;renderShadow();});
  $('journeyEffects').value=effectPreference(); $('journeyEffects').addEventListener('change',e=>setEffectPreference(e.target.value));
  document.addEventListener('gp:activity',e=>recordActivity(e.detail.kind,e.detail.id));
  document.addEventListener('gp:celebrate',e=>celebrate(e.detail));
  document.addEventListener('gp:view-leaving',clearShadow);
  document.addEventListener('gp:view-changed',renderJourney);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearShadow();});
  document.addEventListener('gp:more-opened',()=>{if(recorder?.state==='recording')recorder.stop();else if(requesting)clearShadow();});
  let owner = dataOwner();
  onDataChange(()=>{if(owner!==dataOwner()){clearShadow();activeReading=null;owner=dataOwner();$('readingList').hidden=false;$('readingLesson').hidden=true;}renderJourney();});
  window.addEventListener('gp:account-cleared',()=>{clearShadow();$('readingList').hidden=false;$('readingLesson').hidden=true;renderJourney();});
  renderJourney();
}
