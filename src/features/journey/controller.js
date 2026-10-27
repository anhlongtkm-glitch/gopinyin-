import { readings } from './content.js';
import { applyActivity, bearLevel, emptyDay, localDay, quests, weeklyProgress } from './model.js';
import { dataOwner, learningStorage, listRecordEntries, onDataChange } from '../../shared/storage/account-data.js';
import { speakText } from '../../shared/audio/tts.js';
import { celebrate, effectPreference, setEffectPreference } from '../../shared/celebrations.js';
import { showView } from '../../app/navigation.js';
import { readingMarkup } from './presentation.js';
import { renderVisibleMascots } from '../../shared/mascot.js';
import { escapeHtml as safe } from '../../shared/utils.js';

const $ = id => document.getElementById(id);
const prefix = 'cts:progress:journey-day:';
let activeReading, readingLevel = 1;
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
  else if (result.added) celebrate({id:`activity:${dataOwner()}:${localDay()}:${kind}:${id}`,kind:['reading','game'].includes(kind)?'complete':'correct',title:`${kind==='typing'?'Chính xác!':'Hoàn thành lượt luyện!'} +${result.added} XP`});
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
  const badgeSpecs=[['Khởi đầu',events.length>0,'Hoàn thành một hoạt động'],['Nhớ mặt chữ',events.includes('typing'),'Gõ đúng một câu'],['Đọc trọn',events.includes('reading'),'Hoàn thành một bài khóa'],['Bền bỉ',earned.length>0,'Học bốn ngày trong một tuần']];
  const badgePaths=['M5 17C2 8 12 3 20 4c0 8-4 16-13 14m-2 2L17 7','M3 5h18v14H3zm4 4h2m2 0h2m2 0h2m-9 5h8','M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zm10 3a3 3 0 0 1 3-3h4v15h-7','M7 3h10v6a5 5 0 0 1-10 0zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v7m-4 0h8'];
  $('bearBadges').innerHTML=badgeSpecs.map(([title,unlocked,hint],i)=>`<div class="bearBadge ${unlocked?'unlocked':''}"><span class="badgeEmblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${badgePaths[i]}"/></svg></span><b>${title}</b><small>${unlocked?'Đã đạt':hint}</small></div>`).join('');
}
function stopReadingSpeech() {
  if (journeySpeech) window.speechSynthesis?.cancel();
  journeySpeech = false;
}
function renderReadings() {
  const lessons = readings.filter(r => r.level === readingLevel);
  $('readingList').innerHTML = lessons.map(r => `<button type="button" class="journeyLesson" data-reading="${safe(r.id)}"><span class="featureEyebrow">HSK ${r.level} · ${safe(r.topic)}</span><b>${safe(r.title)}</b><span>${r.lines.length} lượt thoại · ${r.questions.length} câu kiểm tra</span><small>Bắt đầu đọc →</small></button>`).join('');
  $('readingCatalogCount').textContent = `${lessons.length} bài · ${lessons.reduce((sum,r) => sum+r.lines.length,0)} lượt thoại · Có sẵn để đọc khi không có mạng`;
  document.querySelectorAll('[data-reading-level]').forEach(button => {
    const selected = Number(button.dataset.readingLevel) === readingLevel;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
function openReading(id) {
  activeReading = readings.find(x=>x.id===id); if (!activeReading) return;
  stopReadingSpeech();
  readingLevel = activeReading.level;
  $('readingCatalog').hidden = true; $('readingLesson').hidden = false;
  $('readingLesson').innerHTML = readingMarkup(activeReading);
  $('readingLesson').classList.remove('hide-reading-pinyin','hide-reading-meaning');
  renderVisibleMascots();
  $('readingHeading').focus({preventScroll:true});
}
function closeReading({focus = false} = {}) {
  const id = activeReading?.id;
  stopReadingSpeech();
  activeReading = null;
  $('readingCatalog').hidden = false;
  $('readingLesson').hidden = true;
  renderReadings();
  if (focus && id) {
    [...$('readingList').querySelectorAll('[data-reading]')].find(button => button.dataset.reading === id)?.focus({preventScroll:true});
  }
}
export function initializeJourney() {
  renderReadings();
  document.addEventListener('click',e => {
    const quest = e.target.closest('.journeyQuest[data-view]');
    if (quest) void showView(quest.dataset.view);
    const level = e.target.closest('[data-reading-level]');
    if (level) {
      readingLevel = Number(level.dataset.readingLevel);
      renderReadings();
    }
    const reading = e.target.closest('[data-reading]');
    if (reading) openReading(reading.dataset.reading);
    const line = e.target.closest('[data-reading-line]');
    if (line && activeReading) {
      const sentence = activeReading.lines[Number(line.dataset.readingLine)];
      if (sentence) { journeySpeech = true; speakText(sentence[0]); }
    }
    const toggle = e.target.closest('[data-reading-toggle]');
    if (toggle) {
      const on = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed',String(on));
      $('readingLesson').classList.toggle('hide-reading-'+toggle.dataset.readingToggle,!on);
    }
    const practice = e.target.closest('[data-reading-practice]');
    if (practice) {
      stopReadingSpeech();
      document.dispatchEvent(new CustomEvent('gp:practice-reading',{detail:practice.dataset.readingPractice}));
    }
    if (e.target.closest('#readingBack')) closeReading({focus:true});
    if (e.target.closest('#readingListen') && activeReading) {
      journeySpeech = true;
      speakText(activeReading.lines.map(row => row[0]).join(' '));
    }
    if (e.target.closest('#readingStop')) stopReadingSpeech();
  });
  document.addEventListener('submit',e => {
    if (e.target.id !== 'readingQuiz' || !activeReading) return;
    e.preventDefault();
    const form = new FormData(e.target);
    const score = activeReading.questions.filter((question,index) => form.has('q'+index) && Number(form.get('q'+index)) === question[2]).length;
    const passed = score >= Math.ceil(activeReading.questions.length*2/3);
    $('readingResult').textContent = `Bạn đúng ${score}/${activeReading.questions.length} câu. ${passed ? 'Hoàn thành! Hãy thử đọc lại thành tiếng.' : 'Đọc lại đoạn trên rồi thử một lần nữa nhé.'}`;
    if (passed) recordActivity('reading',activeReading.id);
  });
  $('journeyEffects').value = effectPreference();
  $('journeyEffects').addEventListener('change',e => setEffectPreference(e.target.value));
  document.addEventListener('gp:activity',e => recordActivity(e.detail.kind,e.detail.id));
  document.addEventListener('gp:celebrate',e => celebrate(e.detail));
  document.addEventListener('gp:view-leaving',stopReadingSpeech);
  document.addEventListener('gp:view-changed',renderJourney);
  document.addEventListener('visibilitychange',() => { if (document.hidden) stopReadingSpeech(); });
  document.addEventListener('gp:more-opened',stopReadingSpeech);
  let owner = dataOwner();
  onDataChange(() => {
    if (owner !== dataOwner()) { closeReading(); owner = dataOwner(); }
    renderJourney();
  });
  window.addEventListener('gp:account-cleared',() => { closeReading(); renderJourney(); });
  renderJourney();
}
