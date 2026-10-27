import { learningStorage } from "../../shared/storage/account-data.js";
import { rememberFocus, restoreFocus } from "../../shared/focus.js";
// State and behavior owned by features/typing/history. Initialization is orchestrated by app/bootstrap.js.

import { aiSessionLive, state as aiSessionState } from "../ai/session.js";

import { resetProgress, switchMode, toggleAutoSound, toggleReadType, toggleVietnamese, toggleHanziLine } from "./controls.js";

import { gotoRowById, buildWeakDataset } from "./input.js";

import { leaveStudy } from "./navigation.js";

import { state as typingSessionState } from "./session.js";

import { topWeakWords } from "./weakness.js";

import { state as domState } from "../../shared/dom.js";

import { gtReset } from "../../shared/translation.js";

import { escapeHtml } from "../../shared/utils.js";

export const state = {};

const typingHistoryState = state;

export function initializeTypingHistoryState() {
  state.typingHistory = [];
  state.histFilter = 'done';
  state.HIST_KEY_PREFIX = 'cts:history:';
}

export function histKey() {
  if (aiSessionLive()) return typingHistoryState.HIST_KEY_PREFIX + 'ai:' + (aiSessionState.aiSession && aiSessionState.aiSession.prompt ? String(aiSessionState.aiSession.prompt).slice(0, 40) : 'default');
  return typingHistoryState.HIST_KEY_PREFIX + (typingSessionState.activeDataset ? typingSessionState.activeDataset.id : '__none__');
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function loadHistory() {
  typingHistoryState.typingHistory = [];
  try {
    const raw = learningStorage.getItem(histKey());
    if (raw) typingHistoryState.typingHistory = JSON.parse(raw) || [];
  } catch (e) {
    typingHistoryState.typingHistory = [];
  }
  typingHistoryState.typingHistory.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function saveHistory() {
  try {
    learningStorage.setItem(histKey(), JSON.stringify(typingHistoryState.typingHistory));
  } catch (e) {}
}
/* ghi/ghi đè 1 câu vào lịch sử (status: 'ok' | 'wrong') */

/* ghi/ghi đè 1 câu vào lịch sử (status: 'ok' | 'wrong') */
export function recordHistory(q, status) {
  if (!q || !q.id) return;
  const t = todayStr();
  let rec = typingHistoryState.typingHistory.find(r => r.id === q.id);
  if (!rec) {
    rec = {
      id: q.id,
      zh: '',
      py: '',
      vi: '',
      status: 'ok',
      ts: 0,
      date: ''
    };
    typingHistoryState.typingHistory.push(rec);
  }
  if (!rec.zh) rec.zh = q.zh || '';
  if (!rec.py) rec.py = (q.py || '').toString();
  if (!rec.vi) rec.vi = q.vi || '';
  rec.status = status;
  rec.ts = Date.now();
  rec.date = t;
  typingHistoryState.typingHistory.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  saveHistory();
  renderAppHistory();
}

export function setHistFilter(f) {
  typingHistoryState.histFilter = f;
  document.querySelectorAll('.appHistoryTab').forEach(b => {
    const on = b.dataset.tab === f;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  renderAppHistory();
}

export function renderAppHistory() {
  const list = domState.$('app-history-list');
  if (!list) return;
  const totalDone = typingHistoryState.typingHistory.length;
  const totalWrong = typingHistoryState.typingHistory.filter(r => r.status === 'wrong').length;
  const badge = domState.$('app-history-done');
  if (badge) badge.textContent = totalDone + ' đã làm';
  const hc = domState.$('historyCount');
  if (hc) hc.textContent = totalDone;
  const cD = domState.$('app-hist-cnt-done');
  if (cD) cD.textContent = totalDone;
  const cW = domState.$('app-hist-cnt-wrong');
  if (cW) cW.textContent = totalWrong;
  const weakList = topWeakWords(50);
  const cWk = domState.$('app-hist-cnt-weak');
  if (cWk) cWk.textContent = weakList.length;
  /* ★ Tab "Điểm yếu": các âm tiết hay gõ sai (sai > đúng, sai ≥ 2) */
  if (typingHistoryState.histFilter === 'weak') {
    if (!weakList.length) {
      list.innerHTML = '<div class="appHistoryEmpty">Chưa đủ dữ liệu điểm yếu. Hãy luyện thêm vài câu — app ghi lại những âm tiết bạn hay gõ sai để tạo bộ ôn riêng.</div>';
      return;
    }
    list.innerHTML = '<div class="weakList">' + weakList.map(x => '<div class="weakItem"><b class="weakWord">' + escapeHtml(x.w) + '</b>' + '<span class="weakNum"><i class="bad">sai ' + x.wrong + '</i> · đúng ' + x.ok + '</span></div>').join('') + '</div>';
    return;
  }
  let items = typingHistoryState.typingHistory;
  if (typingHistoryState.histFilter === 'wrong') items = typingHistoryState.typingHistory.filter(r => r.status === 'wrong');
  if (!items.length) {
    list.innerHTML = '<div class="appHistoryEmpty">Chưa có câu nào. Hãy gõ thử vài câu — chúng sẽ hiện ở đây để bạn ôn lại.</div>';
    return;
  }
  const shown = items.slice(0, 200);
  list.innerHTML = shown.map(r => {
    const cls = ['appHistoryItem'];
    if (r.status === 'wrong') cls.push('isWrong');else cls.push('isOk');
    const stt = r.status === 'wrong' ? '<span class="appHistoryStt bad">Sai</span>' : '<span class="appHistoryStt ok">Đúng</span>';
    return '<div class="' + cls.join(' ') + '" role="listitem" data-id="' + escapeHtml(r.id) + '" tabindex="0">' + '<div class="appHistoryTop">' + stt + '</div>' + '<div class="appHistoryHan">' + escapeHtml(r.zh || '—') + '</div>' + (r.py ? '<div class="appHistoryPy">' + escapeHtml(r.py) + '</div>' : '') + (r.vi ? '<div class="appHistoryVi">' + escapeHtml(r.vi) + '</div>' : '') + '<div class="appHistoryMeta"><span class="appHistoryTime">' + fmtHistTime(r.ts) + '</span></div>' + '</div>';
  }).join('');
}

export function fmtHistTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts),
      now = Date.now(),
      diff = now - ts;
    if (diff < 60000) return 'vừa xong';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' phút trước';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' giờ trước';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit'
    }) + ' ' + d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
}
/* ★ Nhảy tới 1 câu theo id (để làm lại).
   LỖI CŨ (đã sửa): id trong `rows` là SỐ, còn id lấy từ DOM (`dataset.id`) là
   CHUỖI → so sánh `===` không bao giờ khớp. Tệ hơn, hàm ĐỔI `mode`/`order`
   TRƯỚC khi biết có tìm thấy câu hay không, rồi `return` → giao diện vẫn hiển
   thị câu cũ nhưng `order` đã thành danh sách mới, nên bộ lọc gõ so với MỘT CÂU
   KHÁC (vd đang xem "现在是零点。" nhưng đòi gõ "谢…" của "谢谢你！").
   Nay: so sánh bằng String(), và chỉ đổi trạng thái SAU KHI đã tìm thấy câu. */

/* Nút chế độ đã bỏ — không còn binding allModeBtn/wrongModeBtn */
/* ★ Nút “Câu đã làm”: mở BẢNG LỚN liệt kê TẤT CẢ câu đã làm (modal) */
export function openHistModal() {
  const m = domState.$('histModal');
  if (!m) return;
  rememberFocus(m);
  setHistFilter('done');
  renderAppHistory();
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  try {
    (m.querySelector('.modalClose') || m).focus();
  } catch (e) {}
}

export function closeHistModal() {
  const m = domState.$('histModal');
  if (!m || m.hidden) return;
  m.hidden = true;
  restoreFocus(m);
  if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
}

export function showHistoryPanel() {
  openHistModal();
}

export function initializeTypingHistoryEvents() {
  /* ★ Side panel "Câu đã gõ": click để làm lại */
  typingHistoryState.histPanel = domState.$('app-history-panel');
  if (typingHistoryState.histPanel) {
    typingHistoryState.histPanel.addEventListener('click', e => {
      const tab = e.target.closest('.appHistoryTab');
      if (tab) {
        setHistFilter(tab.dataset.tab);
        return;
      }
      const item = e.target.closest('.appHistoryItem[data-id]');
      if (item) {
        closeHistModal();
        gotoRowById(item.dataset.id);
      }
    });
    typingHistoryState.histPanel.addEventListener('keydown', e => {
      const item = e.target.closest('.appHistoryItem[data-id]');
      if (item && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        closeHistModal();
        gotoRowById(item.dataset.id);
      }
    });
  }
  domState.$('resetBtn').onclick = resetProgress;
  domState.$('restartBtn').onclick = () => {
    if (typingSessionState.mode === 'wrong') switchMode('all');else leaveStudy();
  };
  /* Nút chế độ đã bỏ — không còn binding allModeBtn/wrongModeBtn */
  /* ★ Nút “Câu đã làm”: mở BẢNG LỚN liệt kê TẤT CẢ câu đã làm (modal) */

  if (domState.$('historyBtn')) domState.$('historyBtn').onclick = showHistoryPanel;
  document.querySelectorAll('#histModal [data-close]').forEach(el => el.addEventListener('click', closeHistModal));
  if (domState.$('weakBuildBtn')) domState.$('weakBuildBtn').onclick = buildWeakDataset;
  domState.$('soundToggle').onclick = toggleAutoSound;
  if (domState.$('readTypeToggle')) domState.$('readTypeToggle').onclick = toggleReadType;
  domState.$('viToggle').onclick = toggleVietnamese;
  if (domState.$('hanToggle')) domState.$('hanToggle').onclick = toggleHanziLine;
  // ★ Đóng bubble Google Dịch — nút ✕, gõ phím bất kỳ, hoặc click ra ngoài
  domState.$('gtClose').onclick = gtReset;
  /* ★ Tra nghĩa online: luôn bật (đã bỏ nút bật/tắt) — gọi thẳng MyMemory qua HTTPS */
  // ★ Gõ BẤT KỲ phím nào → tự tắt popup (Esc cũng tắt)
}
