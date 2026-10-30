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

let publicEntries = {};
let rankRequest = 0;
export function rankEntries(board, scope) {
  return (publicEntries[board + ':' + scope] || []).map(e => ({ ...e, me: e.id === currentUser()?.id }));
}



export function rankAvatar(name, extra) {
  const ch = (String(name || '?').trim()[0] || '?').toUpperCase();
  return '<span class="rankAv ' + (extra || '') + '">' + rankingControllerState.escHtml(ch) + '</span>';
}

export function rankRowFor(board, e, place, extra) {
  const isStudy = board === 'study';
  return '<div class="rankRow' + (e.me ? ' isMe' : '') + (extra ? ' ' + extra : '') + '" role="listitem">' + '<span class="rankNo">' + place + '</span>' + '<span class="rankWho">' + rankPhoto(e) + '<span class="rankName"><span class="rankNameTxt">' + rankingControllerState.escHtml(e.name) + '</span>' + (e.me ? '<span class="rankYouTag">Bạn</span>' : '') + '</span></span>' + '<span class="rankCorrect"><b>' + e.correct.toLocaleString('vi-VN') + '</b><i>' + (isStudy ? 'câu luyện' : 'câu/từ') + '</i></span>' + (isStudy ? '<span class="rankScore hidden"></span>' : '<span class="rankScore"><b>' + e.score.toLocaleString('vi-VN') + '</b><i>điểm</i></span>') + '</div>';
}

export async function renderRank(board) {
  const requestId = ++rankRequest;
  const connection = getAccountClient();
  const requestedScope = (board === 'study' ? rankingControllerState.studyRankScope : rankingControllerState.rankScope) || 'day';
  const entryKey = board + ':' + requestedScope;
  const status = board === 'study' ? accountStorageState.$('studyRankStatus') : null;
  const rankCard = accountStorageState.$('rankCard');
  let loadError = false;
  if (rankCard) rankCard.setAttribute('aria-busy', 'true');
  if (status) {
    status.hidden = false;
    status.className = 'rankStatus isLoading';
    status.textContent = 'Đang cập nhật bảng xếp hạng…';
  }
  if (connection && navigator.onLine) {
    try {
      const { data, error } = await connection.rpc('public_rankings', { p_board: board, p_scope: requestedScope, p_period: requestedScope === 'week' ? weekStamp() : dayStamp() });
      if (error) {
        console.error('Không thể tải bảng xếp hạng:', error);
        loadError = true;
      } else {
        publicEntries[entryKey] = data || [];
      }
    } catch (error) {
      console.error('Không thể tải bảng xếp hạng:', error);
      loadError = true;
    }
  } else {
    loadError = true;
  }
  if (requestId !== rankRequest) return;
  if (rankCard) rankCard.setAttribute('aria-busy', 'false');
  if (status) {
    if (loadError) {
      status.hidden = false;
      status.className = 'rankStatus isUnavailable';
      const hasCachedEntries = Object.prototype.hasOwnProperty.call(publicEntries, entryKey);
      status.textContent = hasCachedEntries
        ? 'Không thể cập nhật bảng xếp hạng lúc này. Đang hiển thị dữ liệu đã tải trước đó.'
        : navigator.onLine
          ? 'Không thể tải bảng xếp hạng lúc này. Vui lòng thử lại sau.'
          : 'Bạn đang ngoại tuyến. Hãy kết nối Internet để xem bảng xếp hạng trực tuyến.';
    } else {
      status.hidden = true;
      status.textContent = '';
    }
  }

  const isStudy = board === 'study';
  const prefix = isStudy ? 'studyRank' : 'rank';
  const podium = accountStorageState.$(prefix + 'Podium'),
    host = accountStorageState.$(prefix + 'List'),
    meBox = accountStorageState.$(prefix + 'Me'),
    table = accountStorageState.$(prefix + 'Table');
  if (!podium || !host) return;
  const scope = isStudy ? rankingControllerState.studyRankScope : rankingControllerState.rankScope;
  const tabSel = isStudy ? '#rankCard .rankTab' : '#rankCard .rankTab';
  accountStorageState.$$(tabSel).forEach(t => {
    const on = t.dataset.rank === scope;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const note = accountStorageState.$(prefix + 'ScopeNote');
  if (note) {
    const scopeLabel = scope === 'week' ? 'Tuần ' + String(weekStamp()).slice(6) + '/' + String(weekStamp()).slice(0, 4) : 'Hôm nay';
    note.textContent = scopeLabel + ' · ' + (isStudy ? 'xếp hạng trực tuyến — chỉ tính câu gõ đúng.' : 'xếp hạng trực tuyến — câu sai không được tính.');
  }
  const list = rankEntries(board, scope);
  if (!list.length) {
    podium.className = 'rankPodium isEmpty';
    podium.innerHTML = '<div class="rankEmpty"><div class="rankEmptyIcon">' + (loadError ? '📡' : '🌱') + '</div>' + '<div><b>' + (loadError ? 'Chưa thể tải bảng xếp hạng' : 'Chưa có thành tích trong khoảng thời gian này') + '</b><span>' + (loadError ? 'Vui lòng thử lại khi kết nối ổn định.' : 'Hãy hoàn thành một câu luyện gõ đúng để ghi tên mình lên bảng.') + '</span></div></div>';
    host.innerHTML = '';
    if (table) table.classList.add('hidden');
    if (meBox) {
      meBox.classList.add('hidden');
      meBox.innerHTML = '';
    }
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const top = list.slice(0, 3);
  const rows = list.slice(3);
  /* xếp hình bục: hạng 2 – hạng 1 – hạng 3 (dưới 3 người thì xếp thẳng 1→2) */
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top.slice();
  podium.className = 'rankPodium' + (top.length === 1 ? ' p1' : top.length === 2 ? ' p2' : '');
  if (table) table.classList.remove('hidden');
  podium.innerHTML = order.map(e => {
    const place = list.indexOf(e) + 1;
    return '<div class="rankPod pod' + place + (e.me ? ' isMe' : '') + '">' + '<div class="rankPodMedal" aria-label="Hạng ' + place + '">' + medals[place - 1] + '</div>' + rankPhoto(e, 'avBig') + '<div class="rankPodName">' + rankingControllerState.escHtml(e.name) + (e.me ? '<span class="rankYouTag">Bạn</span>' : '') + '</div>' + '<div class="rankPodStats"><b>' + e.correct.toLocaleString('vi-VN') + '</b> ' + (isStudy ? 'câu luyện' : 'đúng') + (isStudy ? '' : '<span class="rankPodDot">·</span><b>' + e.score.toLocaleString('vi-VN') + '</b> điểm') + '</div>' + '</div>';
  }).join('');
  host.innerHTML = rows.map((e, i) => rankRowFor(board, e, i + 4)).join('');
  if (table) table.classList.toggle('hidden', rows.length === 0);
  if (meBox) {
    /* chỉ hiện dòng "vị trí của bạn" khi bạn chưa có dữ liệu (đã có hạng thì đã nằm trong bảng) */
    const meIdx = list.findIndex(e => e.me);
    if (meIdx === -1) {
      const me = lbUser();
      meBox.classList.remove('hidden');
      meBox.innerHTML = rankRowFor(board, {
        name: me.name,
        correct: 0,
        score: 0,
        me: true
      }, '—', 'rankMeRow');
    } else {
      meBox.classList.add('hidden');
      meBox.innerHTML = '';
    }
  }
}
/* ★ Chỉ còn tab BXH Luyện gỗ (#rankCard); BXH game đã bị gỡ bỏ */

/* ★ MỘT LẦN DUY NHẤT cho mỗi tài khoản: nhập "lịch sử học" đã có từ trước
   (tổng stats.correct trong các bộ câu) vào bảng LUYỆN GÕ (gp:lbStudy),
   để bảng xếp hạng không hiện 0 với người đã học trước khi có tính năng này. */
export function lbHistoryCorrect() {
  let total = 0;
  try {
    for (let i = 0; i < learningStorage.length; i++) {
      const k = learningStorage.key(i);
      if (!k || k.indexOf('cts:progress:') !== 0) continue;
      try {
        const p = JSON.parse(learningStorage.getItem(k));
        total += p && p.stats && p.stats.correct || 0;
      } catch (e) {}
    }
  } catch (e) {}
  return total;
}

export function lbMigrate() {
  if (!currentUser()) return;
  const u = lbUser();
  const done = accountStorageState.lsGet('gp:lbSeed', {}) || {};
  if (done[u.id]) return;
  done[u.id] = 1;
  accountStorageState.lsSet('gp:lbSeed', done);
  const base = lbHistoryCorrect();
  if (base <= 0) return;
  const db = accountStorageState.lsGet(rankingControllerState.LB_KEY_STUDY, null) || {};
  db.day = db.day || {};
  db.week = db.week || {};
  const now = Date.now();
  [['day', dayStamp()], ['week', weekStamp()]].forEach(([scope, key]) => {
    const bucket = db[scope][key] = db[scope][key] || {};
    const e = bucket[u.id];
    if (e && e.correct > 0) return; /* đã có số liệu thật → không ghi đè */
    bucket[u.id] = {
      name: u.name,
      correct: base,
      score: 0,
      at: now
    };
  });
  accountStorageState.lsSet(rankingControllerState.LB_KEY_STUDY, db);
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
  rankingControllerState.studyRankScope = 'day';
  rankingControllerState.escHtml = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  /* ★ Chỉ còn tab BXH Luyện gỗ (#rankCard); BXH game đã bị gỡ bỏ */
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

  try {
    lbMigrate();
  } catch (e) {}

  /* ═══════════════ LANDING: HIỆU ỨNG & TƯƠNG TÁC ═══════════════ */
}

function rankPhoto(entry, cls = '') {
  const url = avatarUrl(entry.avatar_path);
  return url ? '<span class="rankAv ' + cls + '"><img src="' + rankingControllerState.escHtml(url) + '" alt=""></span>' : rankAvatar(entry.name, cls);
}
