import { publishLegacy, legacy } from '../../app/compatibility.js';
import { currentUser, requireAccount, isStudyAllowed } from '../auth/service.js';
import { learningStorage } from '../../shared/storage/account-data.js';
import { studyOverlayOpen } from '../../shared/study/interactions.js';
import { speakText } from '../../shared/audio/tts.js';
import { sfxShot } from '../../shared/audio/typing-sfx.js';
import { state as gameSession } from './session.js';
import { TOPICS, getTopic, CONTENT_VERSION } from './panda-content.js';
import { createGame, beginGame, updateGame, typeGameChar, changeTarget, activateFocus, setPinyin, comboMultiplier, RULES_VERSION } from './panda-model.js';
import { createPandaRenderer } from './panda-renderer.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const number = value => Number(value || 0).toLocaleString('vi-VN');
const PREF_KEY = 'gopinyin:game:panda:preferences';
const game = createGame();
let renderer, phase = 'ready', frameId = 0, lastFrame = 0, epoch = 0, initialized = false, owner = null;
let sound = true, countdownTimer = null, feedbackTimer = null, resultSaved = false, settingsFrom = '', modalFocus = null, adAbort = null;
let preferences = { topicId:'family', mode:'practice', showPinyin:false };
let runReviewIds = [];
let viewportBlocked = false, viewportNotice, layoutPhase = '';
let keyboardBeforeOptions = false;

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
const searchText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
function topicCards(query = '') {
  const filtered = TOPICS.filter(topic => searchText(topic.label + ' ' + topic.subtitle).includes(searchText(query)));
  return filtered.length ? filtered.map(topic => '<button type="button" class="pdTopicCard ' + (topic.id === preferences.topicId ? 'is-active' : '') + '" data-topic="' + topic.id + '" aria-pressed="' + (topic.id === preferences.topicId) + '"><span class="pdTopicArt pdPlanet--' + topic.id + '" style="--pd-planet-color:' + topic.color + '" aria-hidden="true"></span><span class="pdTopicName">' + esc(topic.label) + '</span><span class="pdTopicMeta">' + topic.words.length + ' từ · ' + esc(topic.subtitle) + '</span></button>').join('') : '<p class="pdHintLabel">Chưa tìm thấy chủ đề. Thử tên khác nhé.</p>';
}
const visible = () => !!$('gameCard') && !$('gameCard').classList.contains('hidden');
const clock = seconds => { const s = Math.max(0, Math.ceil(seconds)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const bestKey = (topicId, mode, seed = 'daily:' + today()) => 'gopinyin:game:panda:best:' + topicId + ':' + mode + ':' + RULES_VERSION + ':' + CONTENT_VERSION + (mode === 'challenge' ? ':' + seed : '');
function readJSON(key, fallback) { try { return JSON.parse(learningStorage.getItem(key)) || fallback; } catch { return fallback; } }
function feedback(message) {
  clearTimeout(feedbackTimer); $('pdFeedback').textContent = message;
  feedbackTimer = setTimeout(() => { $('pdFeedback').textContent = ''; }, 2400);
}
function freshGame(reviewWordIds = []) {
  const seed = preferences.mode === 'challenge' ? 'daily:' + today() : 'practice:' + Date.now();
  Object.assign(game, createGame({ ...preferences, seed, reviewWordIds }));
  runReviewIds = game.reviewWordIds.slice();
  game.interruptedChallenge = false; game.newRecord = false;
  resultSaved = false; renderer?.clear(); syncHud();
}
function savePreferences() {
  learningStorage.setItem(PREF_KEY, JSON.stringify(preferences));
}
function panel(html, className = '', autofocus = true) {
  const overlay = $('gaOverlay');
  overlay.innerHTML = '<div class="pdPanel ' + className + '" tabindex="-1">' + html + '</div>';
  overlay.classList.remove('hidden');
  overlay.scrollTop = 0;
  if (autofocus) requestAnimationFrame(() => {
    if (visible() && !studyOverlayOpen() && !overlay.classList.contains('hidden')) overlay.firstElementChild?.focus({ preventScroll:true });
  });
}
function hidePanel() { $('gaOverlay').classList.add('hidden'); $('gaStage').focus({ preventScroll:true }); }
function readyPanel() {
  phase = 'ready';
  const best = readJSON(bestKey(preferences.topicId, preferences.mode), null);
  panel('<p class="pdEyebrow">KHÁM PHÁ THIÊN HÀ TỪ VỰNG</p><h2 class="pdPanelHeading">Chọn hành tinh của bạn</h2>' +
    '<p class="pdLead">Gõ chữ, tiếp năng lượng cho phi thuyền. Một chuyến bay 90 giây để nhớ thêm những từ thật gần gũi.</p>' +
    '<div class="pdTopicSearch"><label for="pdTopicSearch">' + TOPICS.length + ' hành tinh · ' + TOPICS.reduce((sum, topic) => sum + topic.words.length, 0) + ' từ vựng</label><input id="pdTopicSearch" type="search" placeholder="Tìm chủ đề…" autocomplete="off"></div>' +
    '<div class="pdTopicGrid" id="pdTopicGrid" role="group" aria-label="Chọn chủ đề">' + topicCards() + '</div>' +
    '<div class="pdModeSwitch" role="group" aria-label="Chế độ chơi"><button type="button" data-mode="practice" class="' + (preferences.mode === 'practice' ? 'is-active' : '') + '" aria-pressed="' + (preferences.mode === 'practice') + '">Luyện chủ đề <small>Bật/tắt gợi ý tự do</small></button><button type="button" data-mode="challenge" class="' + (preferences.mode === 'challenge' ? 'is-active' : '') + '" aria-pressed="' + (preferences.mode === 'challenge') + '">Thử thách 90 giây <small>Ẩn Pinyin · Vượt kỷ lục</small></button></div>' +
    '<label class="pdInlineToggle pdPreflightPinyin"><input type="checkbox" id="pdReadyPinyin" ' + (game.showPinyin ? 'checked' : '') + (game.mode === 'challenge' ? ' disabled' : '') + '><span>' + (game.mode === 'challenge' ? 'Pinyin ẩn trong thử thách' : 'Hiện Pinyin từ đầu chuyến bay') + '</span></label>' +
    '<div class="pdRules"><span><b>Nhịp chậm</b> · Tối đa 2 mục tiêu</span><span><b>3 lá chắn</b> · Bỏ lỡ từ mất 1</span><span><b>Shift</b> · Dùng Tập trung</span></div>' +
    '<p class="pdHintLabel">Gõ không dấu, không khoảng trắng: 爸爸 → <b>baba</b>, 女儿 → <b>nver</b>. Enter bật/tắt Pinyin khi luyện.</p>' +
    '<div class="pdPanelActions"><button id="gaStartBtn" type="button" class="pdButton pdButton--primary" data-pd="play">Bắt đầu chuyến bay <span aria-hidden="true">↗</span></button>' +
    (best ? '<span class="pdHintLabel">Kỷ lục của bạn <b>' + number(best.score) + '</b></span>' : '<span class="pdHintLabel">' + (preferences.mode === 'challenge' ? 'Cùng đề mỗi ngày · Thành tích cá nhân' : 'Chơi và học theo nhịp của bạn') + '</span>') + '</div>' +
    (typeof window.__pandaAds?.showPreroll === 'function' ? '<p class="pdHintLabel pdAdNote">Có quảng cáo trước chuyến bay.</p>' : ''));
  syncHud();
  requestAnimationFrame(() => {
    const grid = $('pdTopicGrid'), selected = grid?.querySelector('[aria-pressed="true"]');
    if (phase === 'ready' && selected) grid.scrollTop = Math.max(0, selected.offsetTop - 5);
  });
}
function syncHud() {
  if (!$('pdClock')) return;
  $('gameCard').classList.toggle('is-preparing', ['ready','resume','ad','countdown','authorizing'].includes(phase));
  $('pdTopicLabel').textContent = 'Hành tinh ' + game.topic.label;
  $('pdClock').textContent = clock(game.duration - game.elapsed);
  $('pdTimeFill').style.transform = 'scaleX(' + Math.max(0, 1 - game.elapsed / game.duration) + ')';
  $('pdTyped').textContent = game.buffer || '…';
  const dock = $('pdInputDock');
  const dockParent = document.body.classList.contains('vk-open') && matchMedia('(max-width:600px)').matches
    ? document.querySelector('#gameCard .pdSubHud') : document.querySelector('#gameCard .pdFlightBar');
  if (dock.parentElement !== dockParent) {
    if (dockParent.classList.contains('pdSubHud')) dockParent.insertBefore(dock, $('pdMission'));
    else dockParent.insertBefore(dock, document.querySelector('#gameCard .pdFlightTools'));
  }
  $('pdClock').classList.toggle('pdUrgent', game.duration - game.elapsed <= 15);
  $('gaScoreNum').textContent = number(game.score);
  $('gaHearts').textContent = Math.max(0, game.lives) + '/3';
  $('gaHearts').setAttribute('aria-label', 'Còn ' + Math.max(0, game.lives) + ' trên 3 mức lá chắn');
  document.querySelectorAll('.pdShieldMark').forEach((mark, i) => mark.classList.toggle('is-lost', i >= game.lives));
  const multiplier = comboMultiplier(game.combo);
  $('pdCombo').textContent = 'Combo ×' + String(multiplier).replace('.', ',');
  const next = game.combo < 5 ? 5 : game.combo < 10 ? 10 : game.combo < 15 ? 15 : null;
  $('pdComboHint').textContent = next ? (next - game.combo) + ' từ sạch để lên mức tiếp' : 'Chuỗi ' + game.combo + ' từ đúng';
  $('pdRunKind').textContent = game.isReview ? 'Ôn riêng · ' + game.pool.length + ' từ' : game.mode === 'challenge' ? 'Thử thách · ' + today() : 'Luyện chủ đề';
  $('pdMission').textContent = game.stage === 3 ? game.topic.mission + ' · ' + game.missionDone + '/3' : 'Đợt ' + game.stage + '/3';
  $('gaFocusBtn').disabled = !game.running || game.paused || !game.focusCharges || game.focusLeft > 0;
  $('pdFocusLabel').textContent = game.focusLeft > 0 ? 'Đang dùng · ' + game.focusLeft.toFixed(1) + 's' : game.focusCharges ? 'Sẵn sàng' : 'Cần ' + (5 - game.focusProgress) + ' từ sạch';
  $('gaFocusBtn').setAttribute('aria-label', 'Tập trung: ' + $('pdFocusLabel').textContent);
  $('gaFocusBtn').setAttribute('aria-pressed', String(game.focusLeft > 0));
  $('gaPyBtn').disabled = game.mode === 'challenge' || ['ad','countdown'].includes(phase);
  $('gaPyBtn').setAttribute('aria-pressed', String(game.showPinyin));
  $('pdPinyinLabel').textContent = game.mode === 'challenge' ? 'Pinyin khóa' : game.showPinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin';
  $('gaPyBtn').title = game.mode === 'challenge' ? 'Thử thách ẩn Pinyin để so điểm cùng điều kiện' : 'Enter: ' + (game.showPinyin ? 'ẩn' : 'hiện') + ' Pinyin';
  $('gaPauseBtn').disabled = !game.running || phase === 'options';
  $('gaKbdBtn').disabled = phase === 'options';
  $('gaPauseBtn').setAttribute('aria-label', game.paused ? 'Tiếp tục ván' : 'Tạm dừng ván');
  if (layoutPhase !== phase) {
    layoutPhase = phase;
    document.dispatchEvent(new Event('gp:game-layout'));
  }
}
function consumeEvents() {
  const events = game.events.splice(0);
  renderer.receive(events);
  for (const event of events) {
    if (event.type === 'wrong') {
      $('pdInputDock').classList.remove('is-error');
      void $('pdInputDock').offsetWidth;
      $('pdInputDock').classList.add('is-error');
      feedback('Chưa đúng · Thử lại ký tự này');
    }
    if (event.type === 'shot') $('pdInputDock').classList.remove('is-error');
    if (event.type === 'shot' && sound) { try { sfxShot(.38); } catch {} }
    if (event.type === 'complete') {
      if (sound) { try { sfxShot(.7); speakText(event.word); } catch {} }
    }
    if (event.type === 'stage') feedback(event.stage === 3 ? game.topic.mission + ' · Săn đủ 3 thẻ nhiệm vụ!' : 'Đợt ' + event.stage + ' · Giữ vững nhịp gõ!');
    if (event.type === 'focus') feedback('Tập trung · Thẻ chậm lại trong 4 giây');
    if (event.type === 'miss') feedback('Bỏ lỡ ' + event.word + ' · Còn ' + event.lives + ' lá chắn');
    if (event.type === 'finish') finishPanel();
  }
}
function frame(now) {
  frameId = 0;
  if (!visible()) { lastFrame = 0; return; }
  const dt = lastFrame ? Math.min(.25, Math.max(0, (now - lastFrame) / 1000)) : 0;
  const gameDt = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (game.running && !game.paused && isStudyAllowed()) { updateGame(game, gameDt); consumeEvents(); }
  else if (game.running && !game.paused) togglePause();
  renderer.draw(game, now, game.paused ? 0 : dt);
  syncHud();
  frameId = requestAnimationFrame(frame);
}
function ensureFrame() { if (!frameId && visible()) { lastFrame = 0; frameId = requestAnimationFrame(frame); } }
function downgradeForPause() {
  if (game.mode === 'challenge') {
    game.mode = 'practice';
    game.interruptedChallenge = true;
    feedback('Đã tạm dừng: ván này chuyển sang luyện, không ghi kỷ lục thử thách.');
  }
}
export function togglePause() {
  if (!game.running) return;
  if (viewportBlocked && game.paused) return;
  if (!game.paused) {
    downgradeForPause(); game.paused = true; phase = 'paused';
    panel('<p class="pdEyebrow">PHI THUYỀN ĐANG NGHỈ</p><h2 class="pdPanelHeading">Tạm dừng chuyến bay</h2><p class="pdLead">' + (game.interruptedChallenge ? 'Ván đã chuyển sang luyện vì có tạm dừng. Điểm và từ đang gõ được giữ lại.' : 'Điểm, lá chắn và từ đang gõ được giữ nguyên.') + '</p><div class="pdPanelActions"><button class="pdButton pdButton--primary" type="button" data-pd="resume">Tiếp tục</button><button class="pdButton pdButton--quiet" type="button" data-pd="leave">Về sảnh</button></div><p class="pdHintLabel">Space hoặc Esc để tiếp tục · Enter bật/tắt Pinyin</p>', 'pdPanel--compact', !studyOverlayOpen());
    window.speechSynthesis?.cancel();
  } else { game.paused = false; lastFrame = 0; phase = 'playing'; hidePanel(); }
  syncHud();
}
export function togglePinyin() {
  if (['ad','countdown'].includes(phase)) return;
  if (!setPinyin(game, !game.showPinyin)) { feedback('Thử thách luôn ẩn Pinyin. Chọn Luyện chủ đề để dùng gợi ý.'); return; }
  preferences.showPinyin = game.showPinyin; savePreferences(); syncHud();
  if ($('pdReadyPinyin')) $('pdReadyPinyin').checked = game.showPinyin;
  if (game.running) feedback(game.showPinyin ? 'Đã hiện Pinyin · Từ dùng gợi ý được ghi vào danh sách ôn' : 'Đã ẩn Pinyin');
}
export function typeChar(ch) {
  if (!visible() || !isStudyAllowed() || phase !== 'playing' || studyOverlayOpen()) return false;
  const result = typeGameChar(game, ch); consumeEvents(); syncHud(); return result;
}
export function backspaceTarget() {
  if (phase === 'playing' && isStudyAllowed() && !studyOverlayOpen() && changeTarget(game)) feedback('Đã bỏ khóa · Gõ chữ đầu để chọn mục tiêu khác');
}
export function nextKey() {
  return game.mode === 'practice' && game.showPinyin && game.running && !game.paused && game.locked ? game.locked.src.pyPlain[game.buffer.length] || '' : '';
}
function chooseTopic(id) { preferences.topicId = getTopic(id).id; savePreferences(); freshGame(); readyPanel(); }
function chooseMode(mode) { preferences.mode = mode === 'challenge' ? 'challenge' : 'practice'; savePreferences(); freshGame(); readyPanel(); }

// Host integration contract: configure window.__pandaAds.showPreroll({signal,topicId}).
// No provider is fabricated: unavailable inventory falls through to the real countdown.
async function preroll(token) {
  const provider = window.__pandaAds;
  if (typeof provider?.showPreroll !== 'function') return;
  phase = 'ad';
  panel('<p class="pdEyebrow">CHUẨN BỊ CHUYẾN BAY</p><h2 class="pdPanelHeading">Đang mở quảng cáo…</h2><p class="pdLead">Đồng hồ ván chơi chưa bắt đầu.</p><button type="button" class="pdButton pdButton--quiet" data-pd="cancel">Quay lại</button>', 'pdPanel--compact');
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
export async function startGame(reviewWordIds = runReviewIds) {
  if (viewportBlocked) return;
  if (['ad','countdown','authorizing'].includes(phase) || game.running && !game.over) return;
  phase = 'authorizing';
  if (!await requireAccount(() => startGame(reviewWordIds)) || !visible()) { phase = 'ready'; return; }
  if (phase !== 'authorizing') return;
  const token = ++epoch, userId = currentUser()?.id;
  freshGame(reviewWordIds);
  await preroll(token);
  if (token !== epoch || !visible() || currentUser()?.id !== userId || !isStudyAllowed()) return;
  phase = 'countdown'; syncHud();
  let remaining = 3;
  const renderCount = () => panel('<p class="pdEyebrow">' + esc(game.topic.label) + ' · 90 GIÂY</p><div class="pdCountdown" aria-live="polite">' + remaining + '</div><p class="pdLead">Gõ không dấu · Mỗi từ là một bước khám phá</p>', 'pdPanel--compact', false);
  renderCount();
  clearInterval(countdownTimer);
  const timer = setInterval(() => {
    const stop = () => { clearInterval(timer); if (countdownTimer === timer) countdownTimer = null; };
    if (token !== epoch || !visible() || document.hidden || !isStudyAllowed() || currentUser()?.id !== userId) { stop(); if (token === epoch) { phase = 'ready'; readyPanel(); } return; }
    remaining--;
    if (remaining > 0) { renderCount(); return; }
    stop();
    beginGame(game); phase = 'playing'; lastFrame = 0; hidePanel(); syncHud(); ensureFrame();
    document.dispatchEvent(new CustomEvent('gp:game-started'));
  }, 1000);
  countdownTimer = timer;
}
function finishPanel() {
  phase = 'results';
  if (!resultSaved) {
    resultSaved = true;
    const result = { topicId:game.topicId, mode:game.mode, isReview:game.isReview, seed:game.seed, rulesVersion:game.rulesVersion, contentVersion:game.contentVersion, score:game.score, wordsDone:game.wordsDone, uniqueWords:game.completedWordIds.length, bestCombo:game.bestCombo, accuracy:game.accuracy, missionDone:game.missionDone, review:game.review, completedAt:Date.now() };
    const previous = readJSON(bestKey(game.topicId, game.mode, game.seed), null);
    game.newRecord = !game.isReview && game.score > 0 && (!previous || game.score > previous.score);
    if (game.newRecord) learningStorage.setItem(bestKey(game.topicId, game.mode, game.seed), JSON.stringify(result));
    learningStorage.setItem(game.isReview ? 'gopinyin:game:panda:lastReview' : 'gopinyin:game:lastResult', JSON.stringify(result));
    if (game.wordsDone) document.dispatchEvent(new CustomEvent('gp:activity', { detail:{ kind:'game', id:game.topicId + ':' + result.completedAt } }));
  }
  const accuracy = game.accuracy == null ? 'Chưa gõ' : game.accuracy + '%';
  panel('<p class="pdEyebrow">' + esc(game.topic.label) + ' · ' + (game.newRecord ? 'KỶ LỤC CÁ NHÂN MỚI' : game.isReview ? 'PHIÊN ÔN HOÀN TẤT' : 'CHUYẾN BAY HOÀN TẤT') + '</p><h2 class="pdPanelHeading">' + (game.newRecord ? 'Bạn đã vượt chính mình!' : game.finishReason === 'lives' ? 'Hẹn chuyến bay tiếp theo!' : 'Chạm thêm một vùng kiến thức') + '</h2><p class="pdLead">' + (game.finishReason === 'lives' ? 'Lá chắn đã hết. ' : 'Đã hoàn thành 90 giây. ') + 'Bạn có ' + game.wordsDone + ' lượt gõ thành công và ' + game.review.length + ' từ nên ôn lại.</p>' +
    '<div class="pdStatGrid">' + [[number(game.score),'Điểm'],[game.wordsDone,'Lượt hoàn thành'],[accuracy,'Chính xác khi gõ'],[game.bestCombo,'Combo cao nhất']].map(([value,label]) => '<div class="pdStat"><strong class="pdStatValue">' + value + '</strong><span class="pdStatLabel">' + label + '</span></div>').join('') + '</div>' +
    '<p class="pdHintLabel">' + game.completedWordIds.length + ' từ khác nhau' + (game.isReview ? ' · Phiên ôn riêng, không ghi kỷ lục chủ đề' : '') + '</p>' +
    '<p class="pdHintLabel">Điểm từ ' + number(game.wordScore) + ' · Thẻ vàng +' + number(game.goldScore) + ' · Nhiệm vụ +' + number(game.missionScore) + '</p><p class="pdHintLabel">' + esc(game.topic.mission) + ': ' + game.missionDone + '/3' + (game.interruptedChallenge ? ' · Ván có tạm dừng, tính là luyện' : '') + '</p>' +
    '<div class="pdPanelActions"><button class="pdButton pdButton--primary" type="button" data-pd="play">Chơi lại</button>' + (game.review.length ? '<button class="pdButton" type="button" data-pd="review">Ôn ' + game.review.length + ' từ</button>' : '') + '<button class="pdButton pdButton--quiet" type="button" data-pd="topics">Đổi chủ đề</button></div>', 'pdPanel--result');
  syncHud();
}
function reviewPanel() {
  phase = 'review';
  panel('<p class="pdEyebrow">HÀNH TRANG SAU CHUYẾN BAY</p><h2 class="pdPanelHeading">Nhớ chắc hơn từng từ</h2><p class="pdLead">Nghe lại cách đọc hoặc luyện một chuyến bay chỉ gồm ' + game.review.length + ' từ dưới đây.</p><div class="pdReviewList">' + game.review.map(row => '<div><span lang="zh-CN"><b>' + esc(row.word) + '</b><small>' + esc(row.py) + '</small></span><span>' + esc(row.vi) + '<small>' + (row.reasons.includes('missed') ? 'Đã bỏ lỡ' : row.reasons.includes('wrong') ? 'Cần sửa cách gõ' : 'Đã dùng gợi ý') + '</small></span><button type="button" class="pdButton pdButton--quiet" data-speak="' + esc(row.id) + '" aria-label="Nghe ' + esc(row.word) + '">Nghe</button></div>').join('') + '</div><div class="pdPanelActions"><button type="button" class="pdButton pdButton--primary" data-pd="practice-review">Luyện nhóm từ này</button><button type="button" class="pdButton pdButton--quiet" data-pd="results">Về kết quả</button></div>', 'pdPanel--result');
}
function optionsPanel() {
  if (['ad','countdown','options'].includes(phase) || viewportBlocked) return;
  settingsFrom = phase;
  modalFocus = document.activeElement;
  keyboardBeforeOptions = !!legacy.VK?.isOpen();
  if (keyboardBeforeOptions) legacy.VK.hide({remember:false});
  if (game.running && !game.paused) { downgradeForPause(); game.paused = true; }
  phase = 'options';
  panel('<p class="pdEyebrow">BUỒNG ĐIỀU KHIỂN</p><h2 class="pdPanelHeading">Tùy chọn chuyến bay</h2><div class="pdSettings"><label class="pdSettingRow">Âm thanh & đọc từ<input type="checkbox" id="pdSoundSetting" ' + (sound ? 'checked' : '') + '></label><label class="pdSettingRow">Hiện Pinyin khi luyện<input type="checkbox" id="pdPinyinSetting" ' + (game.showPinyin ? 'checked' : '') + (game.mode === 'challenge' ? ' disabled' : '') + '></label></div><p class="pdHintLabel">Thử thách luôn ẩn Pinyin. Nếu tạm dừng ván thử thách, kết quả chuyển sang luyện.</p><div class="pdPanelActions"><button type="button" class="pdButton" data-pd="fullscreen" aria-pressed="' + String(!!document.fullscreenElement) + '">' + (document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình') + '</button><button type="button" class="pdButton" data-pd="leave">Về sảnh</button><button type="button" class="pdButton pdButton--primary" data-pd="close-options">' + (game.running && settingsFrom !== 'paused' ? 'Tiếp tục chuyến bay' : 'Xong') + '</button></div>', 'pdPanel--compact pdPanel--options');
  syncHud();
}
function closeOptions() {
  if (phase !== 'options') return;
  const restoreKeyboard = keyboardBeforeOptions;
  keyboardBeforeOptions = false;
  if (game.running) {
    // Restore the keyboard while paused so a changed viewport cannot resume a hidden flight.
    game.paused = false; togglePause();
    if (restoreKeyboard) legacy.VK?.show();
    if (settingsFrom !== 'paused' && !viewportBlocked) {
      game.paused = false; phase = 'playing'; lastFrame = 0; hidePanel();
    }
  } else if (settingsFrom === 'results' || settingsFrom === 'review') finishPanel();
  else readyPanel();
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
  if (game.running) { downgradeForPause(); game.suspended = true; game.resumeReady = true; }
  game.running = false; game.paused = false;
  cancelAnimationFrame(frameId); frameId = 0; lastFrame = 0; window.speechSynthesis?.cancel();
  if (!silent) legacy.showView?.('games');
}
export function openGame() {
  document.body.classList.add('panda-active');
  const uid = currentUser()?.id;
  if (owner !== uid) {
    owner = uid; epoch++; clearInterval(countdownTimer); countdownTimer = null;
    preferences = { topicId:'family', mode:'practice', showPinyin:false, ...readJSON(PREF_KEY, {}) };
    sound = preferences.sound !== false;
    preferences.topicId = getTopic(preferences.topicId).id; freshGame();
  }
  renderer.resize();
  if (game.suspended && game.pool.length) {
    phase = 'resume';
    panel('<p class="pdEyebrow">' + esc(game.topic.label) + '</p><h2 class="pdPanelHeading">Chuyến bay đang dở</h2><p class="pdLead">' + number(game.score) + ' điểm · Còn ' + clock(game.duration - game.elapsed) + '. Tiếp tục với điểm và từ đang gõ được giữ lại.</p><div class="pdPanelActions"><button type="button" class="pdButton pdButton--primary" data-pd="resume-flight">Tiếp tục</button><button id="gaNewBtn" type="button" class="pdButton pdButton--quiet" data-pd="topics">Ván mới</button></div>', 'pdPanel--compact');
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
  if (event.key === 'Shift') { event.preventDefault(); activateFocus(game); consumeEvents(); syncHud(); return; }
  if (event.key === 'Backspace') { event.preventDefault(); backspaceTarget(); return; }
  if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); typeChar(event.key); }
}
export function initializePandaGame() {
  if (initialized) return; initialized = true;
  gameSession.state = game;
  renderer = createPandaRenderer($('gaCanvas'), $('gaPlayer'));
  const shieldMarks = document.createElement('span');
  shieldMarks.className = 'pdShieldMarks'; shieldMarks.setAttribute('aria-hidden', 'true');
  shieldMarks.innerHTML = Array.from({ length:3 }, () => '<svg class="pdShieldMark" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/></svg>').join('');
  $('gaHearts').after(shieldMarks);
  $('gaCloseBtn').addEventListener('click', () => leaveGame());
  $('gaPyBtn').addEventListener('click', togglePinyin);
  $('gaPauseBtn').addEventListener('click', togglePause);
  $('gaOptionsBtn').addEventListener('click', optionsPanel);
  $('gaFocusBtn').addEventListener('click', () => { activateFocus(game); consumeEvents(); syncHud(); $('gaStage').focus({preventScroll:true}); });
  $('gaOverlay').addEventListener('click', event => {
    const topic = event.target.closest('[data-topic]'); if (topic) { chooseTopic(topic.dataset.topic); return; }
    const mode = event.target.closest('[data-mode]'); if (mode) { chooseMode(mode.dataset.mode); return; }
    const speak = event.target.closest('[data-speak]'); if (speak) { const row = game.review.find(word => word.id === speak.dataset.speak); if (row && sound) speakText(row.word); return; }
    const action = event.target.closest('[data-pd]')?.dataset.pd;
    if (action === 'play') startGame();
    if (action === 'resume') togglePause();
    if (action === 'resume-flight') resumeGame();
    if (action === 'leave') leaveGame();
    if (action === 'topics' || action === 'cancel') { epoch++; adAbort?.abort(); clearInterval(countdownTimer); freshGame(); readyPanel(); }
    if (action === 'review') reviewPanel();
    if (action === 'practice-review') startGame(game.review.map(word => word.id));
    if (action === 'results') finishPanel();
    if (action === 'fullscreen') fullscreen();
    if (action === 'close-options') closeOptions();
  });
  $('gaOverlay').addEventListener('change', event => {
    if (event.target.id === 'pdSoundSetting') { sound = event.target.checked; preferences.sound = sound; savePreferences(); if (!sound) window.speechSynthesis?.cancel(); }
    if (event.target.id === 'pdPinyinSetting') togglePinyin();
    if (event.target.id === 'pdReadyPinyin') togglePinyin();
  });
  $('gaOverlay').addEventListener('input', event => {
    if (event.target.id === 'pdTopicSearch' && phase === 'ready') $('pdTopicGrid').innerHTML = topicCards(event.target.value);
  });
  document.addEventListener('keydown', keydown);
  document.addEventListener('gp:game-viewport', event => updateViewport(event.detail));
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.running && !game.paused) togglePause(); });
  window.addEventListener('gp:access-paused', () => { if (game.running && !game.paused) togglePause(); });
  window.addEventListener('resize', () => { if (visible()) renderer.resize(); });
  document.addEventListener('fullscreenchange', () => {
    renderer.resize();
    const button = $('gaOverlay').querySelector('[data-pd="fullscreen"]');
    if (button) {
      button.textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình';
      button.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    }
  });
  const observer = new ResizeObserver(() => { if (visible()) renderer.resize(); }); observer.observe($('gaStage'));
  publishLegacy('__game', { openGame, leaveGame, startGame, resumeGame, togglePause, typeChar, backspaceTarget, nextKey, togglePinyin, draw:() => renderer.draw(game, performance.now()), _update:dt => { updateGame(game, dt); consumeEvents(); syncHud(); }, _state:game });
}
