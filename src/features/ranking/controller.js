import { rankedEntries, personalStanding, periodDetails } from './model.js';
import { learningStorage } from "../../shared/storage/account-data.js";
import { getAccountClient } from "../auth/client.js";
import { avatarUrl } from "../auth/profile.js";
import { isStudyAllowed } from "../auth/service.js";
// State and behavior owned by features/ranking/controller. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { currentUser } from "../auth/service.js";

import { bumpDaily, refreshDash } from "../dashboard/controller.js";

import { state as accountStorageState } from "../../shared/account-storage.js";

import { state as audioEffectsState } from "../../shared/audio/effects.js";

export const state = {};

const rankingControllerState = state;

export function dayStamp(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + rankingControllerState.pad2(d.getMonth() + 1) + '-' + rankingControllerState.pad2(d.getDate());
}

export function weekStamp(d) {
  d = d || new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7; /* Thứ 2 = 0 */
  t.setDate(t.getDate() - dow + 3); /* dịch về thứ Năm của tuần ISO */
  const jan4 = new Date(t.getFullYear(), 0, 4);
  jan4.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + 3);
  const wk = 1 + Math.round((t - jan4) / (7 * 86400000));
  return t.getFullYear() + '-W' + rankingControllerState.pad2(wk);
}

export function lbUser() {
  const u = currentUser();
  if (!u) return {
    id: 'guest:khach',
    name: 'Khách'
  };
  if (u.guest) return {
    id: 'guest:' + String(u.name || 'Khách'),
    name: String(u.name || 'Khách')
  };
  const email = String(u.email || '').toLowerCase();
  return {
    id: u.id || email || 'name:' + (u.name || 'hocvien'),
    name: u.name || email.split('@')[0] || 'Học viên'
  };
}

export function rankStore(board) {
  return board === 'study' ? rankingControllerState.LB_KEY_STUDY : rankingControllerState.LB_KEY_GAME;
}

export function lbPrune(db) {
  const cut = dayStamp(new Date(Date.now() - (rankingControllerState.LB_KEEP_DAYS - 1) * 86400000));
  Object.keys(db.day || {}).forEach(k => {
    if (k < cut) delete db.day[k];
  });
  Object.keys(db.week || {}).sort().reverse().slice(rankingControllerState.LB_KEEP_WEEKS).forEach(k => {
    delete db.week[k];
  });
}
/* Cộng dồn vào cả bảng ngày và bảng tuần của người đang đăng nhập.
   board = 'game' (chỉ game) | 'study' (chỉ luyện gõ) */

/* Cộng dồn vào cả bảng ngày và bảng tuần của người đang đăng nhập.
   board = 'game' (chỉ game) | 'study' (chỉ luyện gõ) */
export function lbBump(board, patch) {
  if (!isStudyAllowed()) return;
  const u = lbUser();
  const db = accountStorageState.lsGet(rankStore(board), null) || {};
  db.day = db.day || {};
  db.week = db.week || {};
  const now = Date.now();
  [['day', dayStamp()], ['week', weekStamp()]].forEach(([scope, key]) => {
    const bucket = db[scope][key] = db[scope][key] || {};
    const e = bucket[u.id] = bucket[u.id] || {
      name: u.name,
      correct: 0,
      score: 0,
      at: now
    };
    e.name = u.name;
    e.at = now;
    if (patch.correct) e.correct = (e.correct || 0) + patch.correct;
    if (patch.score) e.score = (e.score || 0) + patch.score;
  });
  lbPrune(db);
  accountStorageState.lsSet(rankStore(board), db);
}
/* ★ expose cho app-core (panel BXH) gọi khi mở / có điểm mới */

let publicEntries = new Map(), rankRequest = 0, nearMe = false, lastRender;
const entryKey = (board,scope) => board + ':' + scope + ':' + (scope === 'week' ? weekStamp() : dayStamp());
export function rankEntries(board, scope) {
  return rankedEntries(publicEntries.get(entryKey(board,scope))?.rows, currentUser()?.id, board);
}
export function rankAvatar(name, extra = '') {
  return '<span class="rankAv '+extra+'">'+rankingControllerState.escHtml((String(name || '?').trim()[0] || '?').toUpperCase())+'</span>';
}
export function rankRowFor(board, e, place, extra = '') {
  const safe = rankingControllerState.escHtml;
  return '<div class="rankRow'+(e.me?' isMe':'')+' '+extra+'" role="listitem"'+(e.me?' aria-label="Vị trí của bạn: hạng '+place+'"':'')+'><span class="rankNo">'+place+'</span><span class="rankWho">'+rankPhoto(e)+'<span class="rankName"><span class="rankNameTxt">'+safe(e.name)+'</span>'+(e.me?'<span class="rankYouTag">Bạn</span>':'')+'</span></span><span class="rankCorrect"><b>'+e.correct.toLocaleString('vi-VN')+'</b><i>câu đúng</i></span></div>';
}
function updateRankPeriod(scope) {
  const period = periodDetails(scope);
  accountStorageState.$('rankPeriodLabel').textContent = (scope === 'week' ? 'Tuần này · ' : 'Hôm nay · ')+period.label;
  accountStorageState.$('rankRemaining').textContent = 'Còn khoảng '+period.remaining;
}
function paintRanking(scope, loadError) {
  const $ = accountStorageState.$, safe = rankingControllerState.escHtml;
  const list = rankEntries('study',scope), cached = publicEntries.get(entryKey('study',scope));
  const {me,index,goal,progress,gap} = personalStanding(list,currentUser()?.id,scope);
  lastRender = {scope,loadError};
  updateRankPeriod(scope);
  $('rankParticipantCount').textContent = list.length ? '· '+list.length+(list.length===100?' người trong top 100':' người') : '';
  $('rankNearMe').disabled = !me;
  if (!me) nearMe = false;
  $('rankNearMe').textContent = nearMe ? 'Xem toàn bộ top 100' : 'Gần vị trí của tôi';
  $('rankNearMe').setAttribute('aria-pressed',String(nearMe));
  const podium = $('studyRankPodium');
  if (!list.length) {
    podium.className = 'rankPodium isEmpty';
    podium.innerHTML = '<div class="rankEmpty"><span class="rankEmptySymbol" aria-hidden="true">'+(loadError?'…':'+')+'</span><b>'+(loadError?'Bảng thành tích đang chờ kết nối':'Một khởi đầu mới đang chờ bạn')+'</b><p>'+(loadError?'Bấm Cập nhật khi có mạng để thử lại.':'Gõ đúng câu đầu tiên để ghi tên mình vào bảng '+(scope==='week'?'tuần này.':'hôm nay.'))+'</p></div>';
  } else {
    const top = list.slice(0,3), order = top.length===3?[1,0,2]:top.map((_,i)=>i);
    podium.className = 'rankPodium p'+top.length;
    podium.innerHTML = order.map(i=>{const e=top[i];return '<div class="rankPod pod'+(i+1)+(e.me?' isMe':'')+'"><span class="rankPodMedal">Hạng '+e.place+'</span>'+rankPhoto(e,'avBig')+'<div class="rankPodName">'+safe(e.name)+(e.me?'<span class="rankYouTag">Bạn</span>':'')+'</div><div class="rankPodStats"><b>'+e.correct.toLocaleString('vi-VN')+'</b><span>câu đúng</span></div></div>';}).join('');
  }
  const rows = nearMe ? list.slice(Math.max(0,index-2),Math.min(list.length,index+3)) : list;
  $('studyRankList').innerHTML = rows.map(e=>rankRowFor('study',e,e.place)).join('');
  $('studyRankTable').classList.toggle('hidden',!list.length);
  $('studyRankScopeNote').textContent = cached ? (loadError?'Dữ liệu lần trước · ':'Đã cập nhật lúc ')+cached.at.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})+' · Chỉ tính câu gõ đúng.' : 'Kết nối mạng để tải thành tích cộng đồng.';
  const user=currentUser(), unknown=loadError&&!cached || !me&&list.length===100;
  let title,description;
  if (!user) { title='Hành trình bắt đầu từ bạn'; description='Đăng nhập để lưu thành tích và tìm vị trí của mình trong cộng đồng.'; }
  else if (unknown) {title='Tiếp tục nhịp học của bạn';description=loadError&&!cached?'Chưa tải được thành tích của bạn. Hãy thử cập nhật lại.':'Bạn chưa có tên trong top 100 đang hiển thị. Tiến độ học của bạn vẫn được lưu đầy đủ.';}
  else if (!me) {title='Câu đúng đầu tiên đang chờ';description='Hoàn thành một câu luyện gõ để tham gia bảng '+(scope==='week'?'tuần này.':'hôm nay.');}
  else if (me.place===1) {title='Bạn đang ở nhóm dẫn đầu!';description='Giữ nhịp học của mình. Mỗi câu đúng đều là một bước tiến.';}
  else {title='Từng câu một, gần hơn mỗi ngày';description=gap?'Thêm '+gap.toLocaleString('vi-VN')+' câu đúng để vượt người có thành tích cao hơn gần nhất.':'Bạn đang có cùng thành tích với nhóm dẫn đầu.';}
  $('studyRankMe').innerHTML='<span class="featureEyebrow">VỊ TRÍ CỦA BẠN</span><div class="rankPersonalPlace">'+(me?'#'+me.place:'—')+'</div><h3>'+title+'</h3><p>'+description+'</p>'+(user?'<div class="rankGoalHeading"><span>Mốc cá nhân '+(scope==='week'?'tuần':'ngày')+'</span><b>'+(unknown?'—':(me?.correct||0).toLocaleString('vi-VN'))+' / '+goal+'</b></div><progress max="'+goal+'" value="'+progress+'" aria-label="Mốc cá nhân '+goal+' câu đúng"></progress><small>'+(unknown?'Xếp hạng cá nhân chỉ hiện khi có dữ liệu.':progress>=goal?'Đã đạt mốc. Tuyệt lắm, bạn đã giữ nhịp học!':'Mỗi câu đúng giúp bạn tiến gần hơn.')+'</small>':'')+'<button type="button" id="rankPractice" class="btn primary full">'+(user?'Luyện thêm một chút →':'Đăng nhập để tham gia')+'</button>';
  $('rankPractice').onclick=()=>user?window.showView('hsk'):$('wsLoginBtn').click();
}
export async function renderRank(board = 'study') {
  if (board !== 'study') return;
  const request=++rankRequest, scope=rankingControllerState.studyRankScope||'week', key=entryKey(board,scope);
  const $=accountStorageState.$, status=$('studyRankStatus');
  const connection=getAccountClient();
  nearMe=false;
  $('rankCard').setAttribute('aria-busy','true'); $('rankRefresh').disabled=true;
  accountStorageState.$$('#rankCard .rankTab').forEach(b=>{const active=b.dataset.rank===scope;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  status.hidden=false;status.className='rankStatus isLoading';status.textContent='Đang cập nhật thành tích…';
  let loadError=false;
  try {
    if (!connection || !navigator.onLine) throw new Error('offline');
    const {data,error}=await connection.rpc('public_rankings',{p_board:board,p_scope:scope,p_period:scope==='week'?weekStamp():dayStamp()});
    if (error) throw error;
    if (request!==rankRequest) return;
    publicEntries.set(key,{rows:data||[],at:new Date()});
  } catch {loadError=true;}
  if (request!==rankRequest) return;
  // Midnight may have changed the period while the request was in flight.
  if (key!==entryKey(board,scope)) {void renderRank(board);return;}
  $('rankCard').setAttribute('aria-busy','false');$('rankRefresh').disabled=false;
  status.hidden=!loadError;status.className='rankStatus isUnavailable';
  status.textContent=loadError?(publicEntries.has(key)?'Chưa cập nhật được. Đang hiển thị dữ liệu đã tải trước đó.':'Chưa tải được bảng xếp hạng. Kiểm tra kết nối và bấm Cập nhật để thử lại.'):'';
  paintRanking(scope,loadError);
}

export function initializeRankingController() {
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
  rankingControllerState.LB_KEY_GAME = 'gp:lbGame';
  rankingControllerState.LB_KEY_STUDY = 'gp:lbStudy';
  rankingControllerState.LB_KEEP_DAYS = 21;
  rankingControllerState.LB_KEEP_WEEKS = 10;
  rankingControllerState.pad2 = n => String(n).padStart(2, '0');
  /* ★ expose cho app-core (panel BXH) gọi khi mở / có điểm mới */
  publishLegacy("renderRank", renderRank);
  rankingControllerState.rankScope = 'day';
  rankingControllerState.studyRankScope = 'week';
  rankingControllerState.escHtml = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  /* ★ Chỉ còn tab BXH Luyện gỗ (#rankCard); BXH game đã bị gỡ bỏ */
  accountStorageState.$('rankRefresh').onclick = () => renderRank('study');
  accountStorageState.$('rankNearMe').onclick = () => { nearMe = !nearMe; if (lastRender) paintRanking(lastRender.scope,lastRender.loadError); };
  let refreshTimer;
  window.addEventListener('gp:sync', () => {
    if (accountStorageState.$('rankCard').classList.contains('hidden')) return;
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => renderRank('study'),700);
  });
  window.addEventListener('gp:account-cleared', () => { publicEntries.clear(); nearMe = false; });
  setInterval(() => {
    if (accountStorageState.$('rankCard').classList.contains('hidden')) return;
    const scope = rankingControllerState.studyRankScope;
    if (lastRender && !publicEntries.has(entryKey('study',scope))) void renderRank('study');
    else updateRankPeriod(scope);
  },60000);
  accountStorageState.$$('#rankCard .rankTab').forEach(t => t.addEventListener('click', () => {
    rankingControllerState.studyRankScope = t.dataset.rank === 'week' ? 'week' : 'day';
    renderRank('study');
    audioEffectsState.Sfx.click();
  }));
  /* ★ Hai nguồn điểm, mỗi nguồn một bảng riêng:
     • study → câu gõ đúng trong Luyện gõ (bảng luyện gỗ) */
  /* ★ Game bắn chữ KHÔNG còn bảng xếp hạng (người dùng yêu cầu gỡ bỏ) */
  publishLegacy("__gpOnGamePoint", function () {});
  publishLegacy("__gpOnSentenceCorrect", () => {
    lbBump('study', {
      correct: 1
    });
    /* ★ Mục tiêu ngày + chuỗi ngày học: cộng đúng 1 lần cho mỗi câu gõ ĐÚNG */
    try {
      bumpDaily();
    } catch (e) {}
    /* chỉ vẽ lại dashboard khi nó đang hiện (tránh tính toán thừa mỗi câu) */
    try {
      if (accountStorageState.$('dashView') && !accountStorageState.$('dashView').classList.contains('hidden')) refreshDash();
    } catch (e) {}
  });
  publishLegacy("__gpRankBump", lbBump);

  /* ★ Chuyển tiếp (lần đầu): dữ liệu bảng xếp hạng CŨ (gp:lb, kết hợp game+study)
     → đưa vào bảng GAME (gp:lbGame) để không mất thành tích đã chơi. Bảng study
     được seed riêng từ lịch sử luyện gõ bên dưới. */
  (function carryOldLb() {
    try {
      if (accountStorageState.lsGet(rankingControllerState.LB_KEY_GAME, null)) return;
      const old = accountStorageState.lsGet('gp:lb', null);
      if (old && (old.day || old.week)) accountStorageState.lsSet(rankingControllerState.LB_KEY_GAME, old);
    } catch (e) {}
  })();

  /* ★ MỘT LẦN DUY NHẤT cho mỗi tài khoản: nhập "lịch sử học" đã có từ trước
     (tổng stats.correct trong các bộ câu) vào bảng LUYỆN GÕ (gp:lbStudy),
     để bảng xếp hạng không hiện 0 với người đã học trước khi có tính năng này. */

  // Historical progress is never seeded into a new daily or weekly competition.

  /* ═══════════════ LANDING: HIỆU ỨNG & TƯƠNG TÁC ═══════════════ */
}

function rankPhoto(entry, cls = '') {
  const url = avatarUrl(entry.avatar_path);
  return url ? '<span class="rankAv ' + cls + '"><img src="' + rankingControllerState.escHtml(url) + '" alt=""></span>' : rankAvatar(entry.name, cls);
}
