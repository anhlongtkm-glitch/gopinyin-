// State and behavior owned by features/dashboard/controller. Initialization is orchestrated by app/bootstrap.js.

import { lessonRepository } from "../../shared/lesson-bridge.js";
import { listRecordEntries } from "../../shared/storage/account-data.js";
import { openDataset } from "../typing/datasets.js";
import { state as dataCatalogState } from "../../data/catalog.js";


import { state as accountStorageState } from "../../shared/account-storage.js";

export const state = {};

const dashboardControllerState = state;

export function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

export function bumpDaily() {
  const d = accountStorageState.lsGet(accountStorageState.LS.daily, {
    date: todayKey(),
    count: 0
  }) || {
    date: todayKey(),
    count: 0
  };
  if (d.date !== todayKey()) {
    d.date = todayKey();
    d.count = 0;
  }
  d.count++;
  accountStorageState.lsSet(accountStorageState.LS.daily, d);
  /* Streak */
  const st = accountStorageState.lsGet(accountStorageState.LS.streak, {
    last: '',
    days: 0
  }) || {
    last: '',
    days: 0
  };
  const y = new Date(Date.now() - 86400000);
  const yk = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
  if (st.last !== todayKey()) {
    st.days = st.last === yk ? (st.days || 0) + 1 : 1;
    st.last = todayKey();
    accountStorageState.lsSet(accountStorageState.LS.streak, st);
  }
  return d.count;
}

export async function refreshDashContinue() {
  const request = ++dashboardControllerState.continueRequest;
  const button = accountStorageState.$('dashContinueBtn');
  if (!button) return;
  try {
    const next = lessonRepository && (await lessonRepository.continueDataset());
    if (request !== dashboardControllerState.continueRequest) return;
    const eyebrow = accountStorageState.$('dashContinueEyebrow');
    const title = accountStorageState.$('dashContinueTitle');
    const sub = accountStorageState.$('dashContinueSub');
    const action = accountStorageState.$('dashContinueAction');
    const progress = accountStorageState.$('dashContinueProgress');
    const fill = accountStorageState.$('dashContinueProgressFill');
    if (!next) {
      button.dataset.datasetId = '';
      button.setAttribute('aria-label', 'Khám phá thư viện học tập');
      eyebrow.textContent = 'Lộ trình học tập';
      title.textContent = 'Chọn bài học đầu tiên';
      sub.textContent = 'Khám phá thư viện HSK và chủ đề từ vựng để bắt đầu.';
      action.firstChild.nodeValue = 'Khám phá thư viện ';
      progress.hidden = true;
      fill.style.width = '0%';
      progress.setAttribute('aria-valuenow', '0');
      return;
    }
    const completed = Math.min(next.completed, next.total);
    const percent = next.total ? Math.round(completed / next.total * 100) : 0;
    button.dataset.datasetId = next.id;
    button.setAttribute('aria-label', 'Tiếp tục học ' + next.name + ', tiến độ ' + completed + ' trên ' + next.total);
    eyebrow.textContent = 'Đang học';
    title.textContent = next.name;
    sub.textContent = completed.toLocaleString('vi-VN') + ' / ' + next.total.toLocaleString('vi-VN') + ' câu đã hoàn thành · ' + percent + '%';
    action.firstChild.nodeValue = 'Tiếp tục học ';
    progress.hidden = false;
    progress.setAttribute('aria-valuenow', String(percent));
    fill.style.width = percent + '%';
  } catch (error) {
    if (request !== dashboardControllerState.continueRequest) return;
    console.error('Không tải được bộ học tiếp tục:', error);
    accountStorageState.$('dashContinueEyebrow').textContent = 'Lộ trình học tập';
    accountStorageState.$('dashContinueTitle').textContent = 'Mở thư viện học tập';
    accountStorageState.$('dashContinueSub').textContent = 'Chưa tải được tiến độ gần đây. Bạn vẫn có thể mở thư viện để chọn bài học.';
    accountStorageState.$('dashContinueAction').firstChild.nodeValue = 'Mở thư viện ';
    button.dataset.datasetId = '';
    button.setAttribute('aria-label', 'Mở thư viện học tập');
    accountStorageState.$('dashContinueProgress').hidden = true;
  }
}

export function refreshDash() {
  /* Only the active account's records contribute, never shared legacy storage. */
  let learned = 0,
    correct = 0,
    wrong = 0,
    bestCombo = 0;
  try {
    for (const record of listRecordEntries('kv')) {
      if (record.record_id?.startsWith('cts:progress:')) {
        let p = null;
        try {
          p = JSON.parse(record.payload);
        } catch (e) {}
        if (!p) continue;
        const number = v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
        const done = Math.min(number(p.mainIndex), Array.isArray(p.mainOrder) ? p.mainOrder.length : 999999);
        learned += done;
        const s = p.stats || {};
        correct += number(s.correct);
        wrong += number(s.wrong);
        bestCombo = Math.max(bestCombo, number(s.bestCombo), number(s.combo));
      }
    }
  } catch (e) {}
  const att = correct + wrong;
  /* Chưa làm câu nào thì KHÔNG phải 100% — hiện "—" cho trung thực */
  const acc = att ? Math.round(correct / att * 100) : null;
  countUp(accountStorageState.$('dashLearned'), learned);
  if (acc === null) {
    const el = accountStorageState.$('dashAcc');
    if (el) { cancelAnimationFrame(dashboardControllerState.countFrames.get(el)); dashboardControllerState._countCache.delete(el); el.textContent = '—'; }
  } else {
    countUp(accountStorageState.$('dashAcc'), acc, '%');
  }
  countUp(accountStorageState.$('dashCombo'), bestCombo);
  countUp(accountStorageState.$('dashBest'), accountStorageState.lsGet(accountStorageState.LS.best, 0) || 0);
  /* Vòng mục tiêu */
  const d = accountStorageState.lsGet(accountStorageState.LS.daily, {
    date: todayKey(),
    count: 0
  }) || {
    date: todayKey(),
    count: 0
  };
  const cnt = d.date === todayKey() ? d.count : 0;
  accountStorageState.$('dashGoalNum').textContent = Math.min(cnt, dashboardControllerState.DAILY_GOAL) + '/' + dashboardControllerState.DAILY_GOAL;
  const ring = accountStorageState.$('dashRingFg'),
    C = 326.7;
  ring.style.strokeDashoffset = String(C - C * Math.min(cnt / dashboardControllerState.DAILY_GOAL, 1));
  /* Streak */
  const st = accountStorageState.lsGet(accountStorageState.LS.streak, {
    last: '',
    days: 0
  }) || {
    last: '',
    days: 0
  };
  const chip = accountStorageState.$('wsStreakChip');
  if (st.last === todayKey() && st.days > 0) {
    chip.classList.remove('hidden');
    accountStorageState.$('wsStreakNum').textContent = st.days;
  } else chip.classList.add('hidden');
  refreshDashContinue();
  refreshReviewPlan();
}

function refreshReviewPlan() {
  const available = new Set(listRecordEntries('dataset').map(r => r.record_id));
  const due = [], weak = [];
  for (const entry of listRecordEntries('kv')) {
    if (!entry.record_id.startsWith('cts:progress:')) continue;
    const id = entry.record_id.slice('cts:progress:'.length);
    if (!available.has(id)) continue;
    try {
      const progress = JSON.parse(entry.payload);
      const reviews = Object.values(progress.reviewById || {}).filter(r => Number.isFinite(r?.dueAt) && r.dueAt <= Date.now());
      if (reviews.length) due.push({ id, count: reviews.length, at: reviews.reduce((min, r) => Math.min(min, r.dueAt), Infinity) });
      if (progress.wrongIds?.length) weak.push({ id, count: progress.wrongIds.length });
    } catch { /* Ignore individual damaged records. */ }
  }
  due.sort((a, b) => a.at - b.at); weak.sort((a, b) => b.count - a.count);
  for (const [kind, items, buttonId, countId] of [['due', due, 'dashReviewBtn', 'dashReviewCount'], ['weak', weak, 'dashWeakBtn', 'dashWeakCount']]) {
    const button = accountStorageState.$(buttonId);
    if (!button) continue;
    button.disabled = !items.length;
    button.dataset.datasetId = items[0]?.id || '';
    button.dataset.review = kind;
    accountStorageState.$(countId).textContent = String(items.reduce((sum, item) => sum + item.count, 0));
  }
}
/* ★ Đếm số chạy lên cho các ô thống kê (chỉ chạy khi giá trị thay đổi) */

export function countUp(el, target, suffix) {
  if (!el) return;
  cancelAnimationFrame(dashboardControllerState.countFrames.get(el));
  const key = String(target) + '|' + (suffix || '');
  if (dashboardControllerState._countCache.get(el) === key) {
    el.textContent = Number(target).toLocaleString('vi-VN') + (suffix || '');
    return;
  }
  dashboardControllerState._countCache.set(el, key);
  const to = Number(target) || 0;
  const from = Number(String(el.textContent).replace(/[^\d]/g, '')) || 0;
  if (from === to || !to) {
    el.textContent = to.toLocaleString('vi-VN') + (suffix || '');
    return;
  }
  const t0 = performance.now(),
    dur = 700;
  const tick = t => {
    const k = Math.min((t - t0) / dur, 1),
      e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString('vi-VN') + (suffix || '');
    if (k < 1) dashboardControllerState.countFrames.set(el, requestAnimationFrame(tick));
  };
  dashboardControllerState.countFrames.set(el, requestAnimationFrame(tick));
}
/* Theo dõi tiến độ học để cộng mục tiêu ngày + điểm game cao nhất */
/* ★ Mục tiêu ngày + streak: được cộng từ __gpOnSentenceCorrect (mỗi CÂU ĐÚNG
   đúng 1 lần). Trước đây chỗ này đoán bằng cách so `#progressText` mỗi 1,2s →
   Xoá tiến độ / đổi bộ / quay lại màn khác cũng làm số đổi → cộng mục tiêu OAN. */

export function initializeDashboardController() {
  /* ═══════════════ DASHBOARD ═══════════════ */
  dashboardControllerState.DAILY_GOAL = 20;
  dashboardControllerState.continueRequest = 0;
  /* ★ Đếm số chạy lên cho các ô thống kê (chỉ chạy khi giá trị thay đổi) */
  dashboardControllerState._countCache = new WeakMap();
  dashboardControllerState.countFrames = new WeakMap();
  const count = Object.values(dataCatalogState.HSK_DATA || {}).reduce((sum, rows) => sum + rows.filter(row => row && row[0] && row[2]).length, 0);
  document.querySelectorAll('[data-catalog-sentences]').forEach(el => { el.textContent = count.toLocaleString('vi-VN'); });
  setInterval(() => { if (!accountStorageState.$('dashView').classList.contains('hidden')) refreshReviewPlan(); }, 60000);
  for (const id of ['dashReviewBtn', 'dashWeakBtn']) {
    accountStorageState.$(id)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!button.dataset.datasetId) return;
      button.disabled = true;
      try { await openDataset(button.dataset.datasetId, { review: button.dataset.review }); }
      catch (error) { console.error('Không mở được bài ôn:', error); }
      finally { refreshReviewPlan(); }
    });
  }
  /* Theo dõi tiến độ học để cộng mục tiêu ngày + điểm game cao nhất */
  /* ★ Mục tiêu ngày + streak: được cộng từ __gpOnSentenceCorrect (mỗi CÂU ĐÚNG
     đúng 1 lần). Trước đây chỗ này đoán bằng cách so `#progressText` mỗi 1,2s →
     Xoá tiến độ / đổi bộ / quay lại màn khác cũng làm số đổi → cộng mục tiêu OAN. */
  setInterval(() => {
    if (accountStorageState.$('workspace').classList.contains('hidden')) return;
    const gs = accountStorageState.$('gaScoreNum');
    if (gs && !accountStorageState.$('gameCard').classList.contains('hidden')) {
      const v = parseInt(String(gs.textContent).replace(/[^\d-]/g, ''), 10);
      if (!isNaN(v) && v > (accountStorageState.lsGet(accountStorageState.LS.best, 0) || 0)) accountStorageState.lsSet(accountStorageState.LS.best, v);
    }
  }, 1200);

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
}
