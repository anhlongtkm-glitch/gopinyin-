import { publishLegacy, legacy } from '../../app/compatibility.js';
import { currentUser, requireAccount, isStudyAllowed } from '../auth/service.js';
import { learningStorage } from '../../shared/storage/account-data.js';
import { studyOverlayOpen } from '../../shared/study/interactions.js';
import { speakText } from '../../shared/audio/tts.js';
import { pandaSound, unlockPandaAudio } from './panda-audio.js';
import { state as gameSession } from './session.js';
import { createGame, beginGame, updateGame, typeGameChar, changeTarget, setPinyin } from './panda-model.js';
import { createPandaRenderer } from './panda-renderer.js';
import { CAMPAIGN_VERSION, LEVELS, getCampaignTopic as getTopic, levelFor, levelProgress, levelPassed, levelUnlocked, recordLevel, nextTopic } from './panda-campaign.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const number = value => Number(value || 0).toLocaleString('vi-VN');
const PREF_KEY = 'gopinyin:game:panda:preferences';
const PROGRESS_KEY = 'gopinyin:game:panda:campaign:' + CAMPAIGN_VERSION;
const game = createGame();
let renderer, phase = 'ready', frameId = 0, lastFrame = 0, epoch = 0, initialized = false, owner = null;
let sound = true, countdownTimer = null, feedbackTimer = null, resultSaved = false, settingsFrom = '', modalFocus = null, adAbort = null;
let preferences = { topicId:'family', mode:'practice', showPinyin:true };
let viewportBlocked = false, viewportNotice, layoutPhase = '', keyboardBeforeOptions = false;
const visible = () => !!$('gameCard') && !$('gameCard').classList.contains('hidden');
function readJSON(key, fallback) { try { return JSON.parse(learningStorage.getItem(key)) || fallback; } catch { return fallback; } }
const progress = () => readJSON(PROGRESS_KEY, {});
function saveProgress() {
  try {
    learningStorage.setItem(PROGRESS_KEY, JSON.stringify(recordLevel(progress(), game.topicId, game.completedWordIds, game.settledWordIds)));
    return true;
  } catch { feedback('Chưa lưu được tiến độ. Hãy thử lại trước khi rời game.'); return false; }
}
function savePreferences() { learningStorage.setItem(PREF_KEY, JSON.stringify(preferences)); }
function feedback(message) {
  clearTimeout(feedbackTimer); $('pdFeedback').textContent = message;
  feedbackTimer = setTimeout(() => { $('pdFeedback').textContent = ''; }, 2400);
}
function panel(html, className = '', autofocus = true) {
  const overlay = $('gaOverlay');
  overlay.innerHTML = '<div class="pdPanel ' + className + '" tabindex="-1">' + html + '</div>';
  overlay.classList.remove('hidden'); overlay.scrollTop = 0;
  if (autofocus) requestAnimationFrame(() => {
    if (visible() && !studyOverlayOpen() && !overlay.classList.contains('hidden')) overlay.firstElementChild?.focus({ preventScroll:true });
  });
}
function hidePanel() { $('gaOverlay').classList.add('hidden'); $('gaStage').focus({preventScroll:true}); }
function freshGame() {
  preferences.topicId = getTopic(preferences.topicId).id;
  if (!levelUnlocked(progress(), levelFor(preferences.topicId).id)) preferences.topicId = nextTopic(progress());
  const saved = progress(), current = levelProgress(saved, preferences.topicId);
  const knownWordIds = LEVELS.flatMap(level => levelProgress(saved, level.topics[0]).learned);
  Object.assign(game, createGame({ ...preferences, mode:'practice', campaign:true, knownWordIds, processedWordIds:current.processed, seed:'level:' + preferences.topicId }));
  resultSaved = false; renderer?.clear(); syncHud();
}
function readyPanel() {
  phase = 'ready';
  const topic = getTopic(preferences.topicId), level = levelFor(topic.id), done = levelProgress(progress(), topic.id).processed.length;
  panel('<p class="pdEyebrow">LEVEL ' + level.id + ' / ' + LEVELS.length + '</p><h2 class="pdPanelHeading">' + esc(topic.label) + '</h2><p class="pdLead">Gõ Pinyin để học từ đang rơi.<br>Thỉnh thoảng có một câu ngắn để bạn áp dụng.</p><div class="pdSimpleProgress"><span>' + done + ' / ' + topic.words.length + ' từ</span><progress value="' + done + '" max="' + topic.words.length + '" aria-label="Tiến độ level"></progress></div><div class="pdPanelActions"><button id="gaStartBtn" type="button" class="pdButton pdButton--primary" data-pd="play">' + (done ? 'Tiếp tục level' : 'Bắt đầu') + '</button><button type="button" class="pdButton pdButton--quiet" data-pd="levels">Chọn level</button></div>', 'pdPanel--compact pdPanel--ready');
  syncHud();
}
function levelsPanel() {
  phase = 'levels';
  const saved = progress();
  panel('<p class="pdEyebrow">HỌC THEO NHỊP CỦA BẠN</p><h2 class="pdPanelHeading">Chọn level</h2><div class="pdLevelList">' + LEVELS.map(level => {
    const id = level.topics[0], done = levelPassed(saved,id), unlocked = levelUnlocked(saved,level.id);
    return '<button type="button" class="pdLevelChoice" data-topic="' + id + '"' + (!unlocked || done ? ' disabled' : '') + '><span class="pdLevelNumber">' + level.id + '</span><span><b>' + esc(level.name) + '</b><small>' + level.wordCount + ' từ · ' + (done ? 'Hoàn thành' : unlocked ? levelProgress(saved,id).processed.length + ' từ đã qua' : 'Chưa mở khóa') + '</small></span></button>';
  }).join('') + '</div><div class="pdPanelActions"><button type="button" class="pdButton pdButton--quiet" data-pd="ready">Quay lại</button></div>', 'pdPanel--levels');
  syncHud();
}
function syncHud() {
  if (!$('pdClock')) return;
  $('gameCard').classList.toggle('is-preparing', ['ready','levels','resume','ad','countdown','authorizing'].includes(phase));
  $('pdTopicLabel').textContent = 'Level ' + levelFor(game.topicId).id + ' · ' + game.topic.label;
  $('pdClock').textContent = game.settledWordIds.length + '/' + game.totalWords;
  $('pdTimeFill').style.transform = 'scaleX(' + Math.min(1, game.settledWordIds.length / Math.max(1, game.totalWords)) + ')';
  $('gaScoreNum').textContent = number(game.score);
  $('pdTyped').textContent = game.buffer || '…';
  const dock = $('pdInputDock'), mobileKeyboard = document.body.classList.contains('vk-open') && matchMedia('(max-width:600px)').matches;
  const parent = document.querySelector(mobileKeyboard ? '#gameCard .pdSubHud' : '#gameCard .pdFlightBar');
  if (dock.parentElement !== parent) {
    if (mobileKeyboard) parent.append(dock); else parent.insertBefore(dock, document.querySelector('#gameCard .pdFlightTools'));
  }
  $('gaPyBtn').disabled = ['ad','countdown'].includes(phase);
  $('gaPyBtn').setAttribute('aria-pressed', String(game.showPinyin));
  $('pdPinyinLabel').textContent = game.showPinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin';
  $('gaPauseBtn').disabled = !game.running || phase === 'options';
  $('gaPauseBtn').setAttribute('aria-label', game.paused ? 'Tiếp tục' : 'Tạm dừng');
  $('gaKbdBtn').disabled = phase === 'options';
  if (layoutPhase !== phase) { layoutPhase = phase; document.dispatchEvent(new Event('gp:game-layout')); }
}
function consumeEvents() {
  const events = game.events.splice(0); renderer.receive(events);
  for (const event of events) {
    if (event.type === 'wrong') {
      $('pdInputDock').classList.remove('is-error'); void $('pdInputDock').offsetWidth;
      $('pdInputDock').classList.add('is-error'); feedback('Thử lại ký tự này');
    }
    if (event.type === 'shot') { $('pdInputDock').classList.remove('is-error'); if (sound) pandaSound('shot',game.combo); }
    if (event.type === 'complete') {
      if (event.kind !== 'phrase') saveProgress();
      if (sound) {
        pandaSound(event.kind === 'phrase' ? 'reward' : 'complete',game.combo);
        pandaSound('impact');
        try { speakText(event.word); } catch {}
      }
    }
    if (event.type === 'miss') {
      saveProgress(); feedback(event.word + ' · Xem lại từ ở cuối level');
    }
    if (event.type === 'finish') finishPanel();
  }
}
function frame(now) {
  frameId = 0;
  if (!visible()) { lastFrame = 0; return; }
  const dt = lastFrame ? Math.min(.25,Math.max(0,(now-lastFrame)/1000)) : 0;
  const gameDt = lastFrame ? Math.max(0,(now-lastFrame)/1000) : 0; lastFrame = now;
  if (game.running && !game.paused && isStudyAllowed()) { updateGame(game,gameDt); consumeEvents(); }
  else if (game.running && !game.paused) togglePause();
  renderer.draw(game,now,game.paused ? 0 : dt); syncHud(); frameId = requestAnimationFrame(frame);
}
function ensureFrame() { if (!frameId && visible()) { lastFrame = 0; frameId = requestAnimationFrame(frame); } }
export function togglePause() {
  if (!game.running || viewportBlocked && game.paused) return;
  if (!game.paused) {
    game.paused = true; phase = 'paused'; window.speechSynthesis?.cancel();
    panel('<h2 class="pdPanelHeading">Tạm dừng</h2><p class="pdLead">Từ đang gõ và tiến độ được giữ lại.</p><div class="pdPanelActions"><button type="button" class="pdButton pdButton--primary" data-pd="resume">Tiếp tục</button><button type="button" class="pdButton pdButton--quiet" data-pd="leave">Về sảnh</button></div>', 'pdPanel--compact', !studyOverlayOpen());
  } else { game.paused = false; phase = 'playing'; lastFrame = 0; hidePanel(); }
  syncHud();
}
export function togglePinyin() {
  if (['ad','countdown'].includes(phase)) return;
  setPinyin(game,!game.showPinyin); preferences.showPinyin = game.showPinyin; savePreferences(); syncHud();
}
export function typeChar(ch) {
  if (!visible() || !isStudyAllowed() || phase !== 'playing' || studyOverlayOpen()) return false;
  const result = typeGameChar(game,ch); consumeEvents(); syncHud(); return result;
}
export function backspaceTarget() {
  if (phase === 'playing' && isStudyAllowed() && !studyOverlayOpen() && changeTarget(game)) feedback('Gõ chữ đầu để đổi mục tiêu');
}
export function nextKey() { return game.showPinyin && game.running && !game.paused && game.locked ? game.locked.src.pyPlain[game.buffer.length] || '' : ''; }
function chooseTopic(id) {
  const topic = getTopic(id);
  if (!levelUnlocked(progress(),levelFor(topic.id).id) || levelPassed(progress(),topic.id)) return;
  preferences.topicId = topic.id; savePreferences(); freshGame(); readyPanel();
}
function updateViewport(detail) {
  const blocked = visible() && detail.blocked;
  viewportBlocked = blocked;
  if (!blocked) {
    if (viewportNotice?.open) {
      viewportNotice.close();
      if (visible()) $('gaOverlay').querySelector('.pdPanel')?.focus({preventScroll:true});
    }
    return;
  }
  if (game.running && !game.paused) togglePause();
  if (['ad','countdown','authorizing'].includes(phase)) {
    epoch++; adAbort?.abort(); clearInterval(countdownTimer); countdownTimer = null;
    freshGame(); readyPanel();
  }
  if (!viewportNotice) {
    viewportNotice = document.createElement('dialog');
    viewportNotice.id = 'pdViewportNotice'; viewportNotice.className = 'pdViewportNotice';
    viewportNotice.setAttribute('aria-labelledby', 'pdViewportTitle');
    viewportNotice.innerHTML = '<div><h2 id="pdViewportTitle">Cần thêm không gian</h2><p>Xoay máy dọc để nhìn rõ sân chơi và bàn phím. Chuyến bay đang chơi được tạm dừng; điểm và từ đang gõ được giữ lại.</p><div class="pdPanelActions"><button type="button" class="pdButton" data-viewport-hide>Ẩn bàn phím</button><button type="button" class="pdButton pdButton--primary" data-viewport-leave>Về sảnh</button></div></div>';
    viewportNotice.addEventListener('cancel', event => event.preventDefault());
    viewportNotice.querySelector('[data-viewport-hide]').addEventListener('click', () => legacy.VK?.hide({remember:false}));
    viewportNotice.querySelector('[data-viewport-leave]').addEventListener('click', () => leaveGame());
  }
  const parent = document.fullscreenElement || document.body;
  if (viewportNotice.parentElement !== parent) {
    if (viewportNotice.open) viewportNotice.close();
    parent.append(viewportNotice);
  }
  Object.assign(viewportNotice.style, {top:detail.top+'px',left:detail.left+'px',width:detail.width+'px',height:detail.height+'px'});
  if (!viewportNotice.open) viewportNotice.showModal();
}
async function preroll(token) {
  const provider = window.__pandaAds;
  if (typeof provider?.showPreroll !== 'function') return;
  phase = 'ad';
  panel('<p class="pdEyebrow">CHUẨN BỊ CHUYẾN BAY</p><h2 class="pdPanelHeading">Đang mở quảng cáo…</h2><p class="pdLead">Level sẽ bắt đầu sau quảng cáo.</p><button type="button" class="pdButton pdButton--quiet" data-pd="cancel">Quay lại</button>', 'pdPanel--compact');
  const controller = new AbortController(); adAbort = controller;
  let timer;
  try {
    const abort = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('ad-cancelled')), { once:true });
      timer = setTimeout(() => controller.abort(), 90000);
    });
    await Promise.race([Promise.resolve(provider.showPreroll({ signal:controller.signal, topicId:game.topicId })), abort]);
  } catch { if (token === epoch && visible()) feedback('Quảng cáo chưa khả dụng. Chuẩn bị vào ván.'); }
  finally { clearTimeout(timer); controller.abort(); if (adAbort === controller) adAbort = null; }
}
export async function startGame() {
  if (viewportBlocked || ['ad','countdown','authorizing'].includes(phase) || game.running && !game.over) return;
  if (sound) unlockPandaAudio();
  phase = 'authorizing';
  if (!await requireAccount(() => startGame()) || !visible()) { phase = 'ready'; return; }
  if (phase !== 'authorizing') return;
  const token = ++epoch, userId = currentUser()?.id;
  freshGame();
  if (!game.pool.length) { finishPanel(); return; }
  await preroll(token);
  if (token !== epoch || !visible() || currentUser()?.id !== userId || !isStudyAllowed()) return;
  phase = 'countdown'; syncHud();
  let remaining = 3;
  const renderCount = () => panel('<p class="pdEyebrow">LEVEL ' + game.levelId + ' · ' + esc(game.topic.label) + '</p><div class="pdCountdown" aria-live="polite">' + remaining + '</div><p class="pdLead">Gõ Pinyin không dấu để bắn</p>','pdPanel--compact',false);
  renderCount(); clearInterval(countdownTimer);
  const timer = setInterval(() => {
    const stop = () => { clearInterval(timer); if (countdownTimer === timer) countdownTimer = null; };
    if (token !== epoch || !visible() || document.hidden || !isStudyAllowed() || currentUser()?.id !== userId) { stop(); if (token === epoch) readyPanel(); return; }
    if (--remaining > 0) { renderCount(); return; }
    stop(); beginGame(game); phase = 'playing'; lastFrame = 0; hidePanel(); consumeEvents(); syncHud(); ensureFrame();
    document.dispatchEvent(new CustomEvent('gp:game-started'));
  },1000);
  countdownTimer = timer;
}
function finishPanel() {
  phase = 'results';
  if (!resultSaved && saveProgress()) {
    resultSaved = true;
    const result = { topicId:game.topicId, levelId:game.levelId, mode:'learning', score:game.score, wordsDone:game.completedWordIds.length, phrasesDone:game.phrasesDone, phraseScore:game.phraseScore, review:game.review, completedAt:Date.now() };
    learningStorage.setItem('gopinyin:game:lastResult',JSON.stringify(result));
    if (game.wordsDone) document.dispatchEvent(new CustomEvent('gp:activity',{detail:{kind:'game',id:game.topicId+':'+result.completedAt}}));
  }
  const saved = progress(), next = nextTopic(saved), allDone = LEVELS.every(level => levelPassed(saved,level.topics[0]));
  const learned = levelProgress(saved,game.topicId).learned.length;
  const missed = game.topic.words.filter(word => !levelProgress(saved,game.topicId).learned.includes(word.id));
  panel('<p class="pdEyebrow">LEVEL ' + game.levelId + ' · ' + esc(game.topic.label) + '</p><h2 class="pdPanelHeading">Hoàn thành level!</h2><p class="pdLead">Bạn đã gõ đúng ' + learned + '/' + game.totalWords + ' từ' + (game.phrasesDone ? ' và ' + game.phrasesDone + ' câu ngắn' : '') + '.</p><div class="pdResultScore">' + number(game.score) + '<small>điểm</small></div>' + (missed.length ? '<details class="pdMissedWords"><summary>' + missed.length + ' từ cần nhớ thêm</summary>' + missed.map(word => '<p><b lang="zh-CN">' + esc(word.word) + '</b> · ' + esc(word.py) + '<span>' + esc(word.vi) + '</span></p>').join('') + '</details>' : '') + '<div class="pdPanelActions">' + (!allDone ? '<button type="button" class="pdButton pdButton--primary" data-pd="next-topic">Level tiếp theo</button>' : '<p class="pdLead">Bạn đã hoàn thành cả ' + LEVELS.length + ' level.</p>') + '<button type="button" class="pdButton pdButton--quiet" data-pd="levels">Chọn level</button></div>','pdPanel--compact pdPanel--result');
  syncHud();
}
function optionsPanel() {
  if (['ad','countdown','options'].includes(phase) || viewportBlocked) return;
  settingsFrom = phase; modalFocus = document.activeElement; keyboardBeforeOptions = !!legacy.VK?.isOpen();
  if (keyboardBeforeOptions) legacy.VK.hide({remember:false});
  if (game.running) game.paused = true;
  phase = 'options';
  panel('<h2 class="pdPanelHeading">Cài đặt</h2><div class="pdSettings"><label class="pdSettingRow">Âm thanh & đọc từ<input type="checkbox" id="pdSoundSetting" ' + (sound ? 'checked' : '') + '></label></div><div class="pdPanelActions"><button type="button" class="pdButton" data-pd="fullscreen" aria-pressed="' + String(!!document.fullscreenElement) + '">' + (document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình') + '</button><button type="button" class="pdButton pdButton--primary" data-pd="close-options">Xong</button><button type="button" class="pdButton pdButton--quiet" data-pd="leave">Về sảnh</button></div>','pdPanel--compact pdPanel--options');
  syncHud();
}
function closeOptions() {
  if (phase !== 'options') return;
  const restoreKeyboard = keyboardBeforeOptions; keyboardBeforeOptions = false;
  if (game.running) {
    game.paused = false; togglePause();
    if (restoreKeyboard) legacy.VK?.show();
    if (settingsFrom !== 'paused' && !viewportBlocked) { game.paused = false; phase = 'playing'; lastFrame = 0; hidePanel(); }
  } else if (settingsFrom === 'results') finishPanel(); else if (settingsFrom === 'levels') levelsPanel(); else readyPanel();
  if (!game.running && restoreKeyboard) legacy.VK?.show();
  syncHud();
  if (!viewportBlocked && modalFocus?.isConnected && modalFocus.getClientRects().length) modalFocus.focus({preventScroll:true});
  modalFocus = null;
}
export function resumeGame() {
  if (viewportBlocked) return;
  if (!game.suspended) return startGame();
  if (!isStudyAllowed()) return;
  game.suspended = false; game.resumeReady = false; game.running = true; game.paused = false; phase = 'playing'; lastFrame = 0; hidePanel(); syncHud(); ensureFrame();
  document.dispatchEvent(new CustomEvent('gp:game-started'));
}
export function leaveGame({ silent = false } = {}) {
  keyboardBeforeOptions = false;
  viewportBlocked = false;
  if (viewportNotice?.open) viewportNotice.close();
  if (document.fullscreenElement === $('gameCard')) document.exitFullscreen?.().catch(() => {});
  document.body.classList.remove('panda-active');
  epoch++; adAbort?.abort(); clearInterval(countdownTimer); countdownTimer = null;
  if (game.running) { game.suspended = true; game.resumeReady = true; }
  game.running = false; game.paused = false;
  cancelAnimationFrame(frameId); frameId = 0; lastFrame = 0; window.speechSynthesis?.cancel();
  if (!silent) legacy.showView?.('games');
}
export function openGame() {
  document.body.classList.add('panda-active');
  const uid = currentUser()?.id;
  if (owner !== uid) {
    owner = uid; epoch++; clearInterval(countdownTimer); countdownTimer = null;
    preferences = { topicId:'family', showPinyin:true, ...readJSON(PREF_KEY,{}), mode:'practice' };
    // Pinyin is on for the simplified learning flow; the in-game button can hide it.
    if (!preferences.simpleLearning) { preferences.showPinyin = true; preferences.simpleLearning = true; }
    sound = preferences.sound !== false; preferences.topicId = getTopic(preferences.topicId).id;
    if (levelPassed(progress(),preferences.topicId)) preferences.topicId = nextTopic(progress());
    freshGame();
  }
  renderer.resize();
  if (game.suspended && game.pool.length) {
    phase = 'resume';
    panel('<h2 class="pdPanelHeading">Chơi tiếp nhé?</h2><p class="pdLead">Level ' + game.levelId + ' · ' + esc(game.topic.label) + '</p><div class="pdPanelActions"><button type="button" class="pdButton pdButton--primary" data-pd="resume-flight">Tiếp tục</button><button id="gaNewBtn" type="button" class="pdButton pdButton--quiet" data-pd="levels">Chọn level</button></div>','pdPanel--compact');
  } else { freshGame(); readyPanel(); }
  ensureFrame();
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else if ($('gameCard').requestFullscreen) $('gameCard').requestFullscreen().catch(() => feedback('Trình duyệt chưa mở được toàn màn hình.'));
  else feedback('Trình duyệt này chưa hỗ trợ toàn màn hình.');
}
function keydown(event) {
  if (!visible() || studyOverlayOpen() || event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.target;
  if (phase === 'options' && event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); closeOptions(); return; }
  if (target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  if (target?.closest?.('button,a') && ['Enter',' '].includes(event.key)) return;
  if (event.key === 'Escape') {
    if (document.fullscreenElement) return;
    if (phase === 'options') closeOptions(); else if (game.running) togglePause();
    return;
  }
  if (phase === 'options') return;
  if (event.key === 'Enter' && ['ready','playing','paused'].includes(phase)) { event.preventDefault(); togglePinyin(); return; }
  if (event.key === ' ' && game.running) { event.preventDefault(); togglePause(); return; }
  if (phase !== 'playing' || game.paused || !isStudyAllowed()) return;
  if (event.key === 'Backspace') { event.preventDefault(); backspaceTarget(); return; }
  if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); typeChar(event.key); }
}
export function initializePandaGame() {
  if (initialized) return; initialized = true;
  gameSession.state = game; renderer = createPandaRenderer($('gaCanvas'),$('gaPlayer'));
  $('gaCloseBtn').addEventListener('click',() => leaveGame());
  $('gaPyBtn').addEventListener('click',togglePinyin);
  $('gaPauseBtn').addEventListener('click',togglePause);
  $('gaOptionsBtn').addEventListener('click',optionsPanel);
  $('gaOverlay').addEventListener('click',event => {
    const topic = event.target.closest('[data-topic]'); if (topic && !topic.disabled) { chooseTopic(topic.dataset.topic); return; }
    const action = event.target.closest('[data-pd]')?.dataset.pd;
    if (action === 'play') startGame();
    if (action === 'resume') togglePause();
    if (action === 'resume-flight') resumeGame();
    if (action === 'leave') leaveGame();
    if (action === 'levels' || action === 'topics' || action === 'cancel') { epoch++; adAbort?.abort(); clearInterval(countdownTimer); game.suspended = false; game.running = false; freshGame(); levelsPanel(); }
    if (action === 'ready') readyPanel();
    if (action === 'next-topic') chooseTopic(nextTopic(progress()));
    if (action === 'fullscreen') fullscreen();
    if (action === 'close-options') closeOptions();
  });
  $('gaOverlay').addEventListener('change',event => {
    if (event.target.id === 'pdSoundSetting') { sound = event.target.checked; preferences.sound = sound; savePreferences(); if (!sound) window.speechSynthesis?.cancel(); }
  });
  document.addEventListener('keydown',keydown);
  document.addEventListener('gp:game-viewport',event => updateViewport(event.detail));
  document.addEventListener('visibilitychange',() => { if (document.hidden && game.running && !game.paused) togglePause(); });
  window.addEventListener('gp:access-paused',() => { if (game.running && !game.paused) togglePause(); });
  window.addEventListener('resize',() => { if (visible()) renderer.resize(); });
  document.addEventListener('fullscreenchange',() => {
    renderer.resize();
    const button = $('gaOverlay').querySelector('[data-pd="fullscreen"]');
    if (button) { button.textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình'; button.setAttribute('aria-pressed',String(!!document.fullscreenElement)); }
  });
  const observer = new ResizeObserver(() => { if (visible()) renderer.resize(); }); observer.observe($('gaStage'));
  publishLegacy('__game',{ openGame,leaveGame,startGame,resumeGame,togglePause,typeChar,backspaceTarget,nextKey,togglePinyin,draw:() => renderer.draw(game,performance.now()),_update:dt => { updateGame(game,dt); consumeEvents(); syncHud(); },_state:game });
}
