// State and behavior owned by features/library/controller. Initialization is orchestrated by app/bootstrap.js.

import { renderVocab } from "./catalog.js";

import { loadProgress } from "../typing/progress.js";

import { state as domState } from "../../shared/dom.js";

export const state = {};

const libraryControllerState = state;

/* ★ Thư viện (kho có sẵn HSK / chủ đề) — không còn danh sách bộ câu người dùng ở đây */
export function renderLibrary() {
  domState.$('appCard').classList.add('hidden');
  domState.$('libraryCard').classList.remove('hidden');
  domState.$('backLibrary').classList.add('hidden');
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

/* ═══════════════════════════════════════════════════════════
   ★ TIẾN ĐỘ NGAY TRÊN THẺ CHỦ ĐỀ / CẤP HSK
   Thay cho khối "📖 Bộ câu của bạn (đã học)" đã được bỏ: người dùng thấy
   ngay "đã học bao nhiêu câu" trên chính thẻ mình sắp bấm vào → giao diện
   gọn hơn hẳn mà vẫn không mất thông tin.
   Nguồn tiến độ: bộ luyện tương ứng có id 'vocab:<srcId>' (do openVocabSource tạo).
   ═══════════════════════════════════════════════════════════ */
export function srcProgress(srcId, total, unit) {
  if (!total) return '';
  let p = null;
  try {
    p = loadProgress('vocab:' + srcId);
  } catch (e) {
    p = null;
  }
  const done = p ? Math.min(Math.max(p.mainIndex || 0, 0), total) : 0;
  const wrong = p ? (p.wrongIds || []).length : 0;
  const pct = Math.round(done / total * 100);
  /* thanh 5px: 1/301 vẫn phải thấy một vạch nhỏ → tối thiểu 2% khi đã học */
  const w = done > 0 ? Math.max(pct, 2) : 0;
  /* ★ Luôn có thanh tiến độ (kể cả thẻ chưa học) để lưới thẻ trông đều nhau;
     chỉ khi ĐÃ học mới thêm dòng chữ "x/N · y%" — tránh 206 thẻ đầy chữ. */
  return '<span class="vocabProg' + (done || wrong ? '' : ' isZero') + '"><i style="width:' + w + '%"></i></span>' + (done || wrong ? '<span class="vocabMeta">' + done + '/' + total + ' ' + unit + (pct > 0 ? ' · ' + pct + '%' : '') + (wrong ? ' · <em>' + wrong + ' cần ôn</em>' : '') + '</span>' : '');
}
/* ═══════════════════════════════════════════════════════════
   ★ BỘ CÂU AI ĐÃ LƯU (kind==='ai') — hiện ngay dưới khung "AI sinh câu".
   Mỗi thẻ cho biết số câu + đã học bao nhiêu + thanh tiến độ, và nút
   "Học tiếp" mở đúng câu đang học dở (openDataset khôi phục mainIndex).
   ═══════════════════════════════════════════════════════════ */

export function initializeLibraryController() {
  /* ── Library ── */
  libraryControllerState.libraryQuery = '';
  libraryControllerState.librarySortBy = 'recent';
}
