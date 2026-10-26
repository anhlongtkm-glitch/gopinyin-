import { requireAccount, currentUser } from "../auth/service.js";
import { writeRoute, navigationVersion, markNavigation } from "../../app/routes.js";
import { showView } from "../../app/navigation.js";
import { selectReviewRows } from "./review.js";
// State and behavior owned by features/typing/datasets. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { aiEndSession } from "../ai/session.js";

import { updateSoundUI, updateReadTypeUI, updateViUI, updateHanUI, updateModeUI } from "./controls.js";

import { loadHistory, renderAppHistory } from "./history.js";

import { resetSessionRuntime, loadProgress } from "./progress.js";

import { render } from "./render.js";

import { state as typingSessionState } from "./session.js";

import { populateVoiceSelect } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { dbList, dbGet, progressKey } from "../../shared/storage/lesson-repository.js";

import { shuffle, escapeHtml } from "../../shared/utils.js";

/* ── Dataset Management ── */
export async function openDataset(id, options = {}) {
  const navigation = options.navigation ?? markNavigation();
  if (!await requireAccount(() => openDataset(id, { ...options, navigation: undefined }))) return;
  if (navigation !== navigationVersion()) return;
  const accountId = currentUser().id;
  const ds = await dbGet(id);
  if (currentUser()?.id !== accountId || navigation !== navigationVersion()) return;
  if (!ds) return false;
  /* Ghi nhớ đang mở từ màn nào để nút "← ..." quay lại đúng chỗ */
  const aiVisible = !!(domState.$('aiCard') && !domState.$('aiCard').classList.contains('hidden'));
  await showView('library', { route: false, navigation });
  if (navigation !== navigationVersion() || currentUser()?.id !== accountId) return;
  typingSessionState.studyOrigin = aiVisible ? 'ai' : 'library';
  aiEndSession(); // rời phiên AI (không lưu gì) nếu đang học câu do AI tạo
  resetSessionRuntime();
  typingSessionState.activeDataset = ds;
  typingSessionState.awaitingEnter = false;
  typingSessionState.curHadError = false;
  typingSessionState.rows = ds.rows;
  typingSessionState.currentFileKey = progressKey(ds.id);
  typingSessionState.pinyinHint = false; // ★ mới vào chế độ gỗ → pinyin luôn ẩn, muốn xem thì bật
  const saved = loadProgress(ds.id);
  typingSessionState.reviewById = saved?.reviewById && typeof saved.reviewById === 'object' ? saved.reviewById : {};
  const validOrder = o => Array.isArray(o) && o.every(i => Number.isInteger(i) && i >= 0 && i < typingSessionState.rows.length);
  if (saved && validOrder(saved.mainOrder) && saved.mainOrder.length === typingSessionState.rows.length) {
    typingSessionState.mainOrder = saved.mainOrder;
    typingSessionState.mainIndex = saved.mainIndex || 0;
    typingSessionState.stats = saved.stats || typingSessionState.stats;
    typingSessionState.wrongIds = new Set(saved.wrongIds || []);
    typingSessionState.autoSound = saved.autoSound !== false;
    typingSessionState.speechRate = Number(saved.speechRate) || 0.8;
    typingSessionState.selectedVoiceName = String(saved.selectedVoiceName || '');
    typingSessionState.showVietnamese = saved.showVietnamese !== false;
    typingSessionState.showHanzi = saved.showHanzi !== false;
    typingSessionState.readOnType = saved.readOnType !== false;
  } else if (saved && validOrder(saved.mainOrder) && saved.mainOrder.length) {
    /* ★ Bộ câu ĐÃ LỚN THÊM (AI viết tiếp sau khi lưu) → giữ nguyên tiến độ cũ,
       chỉ nối các câu mới vào CUỐI. Trước đây độ dài lệch là xoá sạch tiến độ
       và xáo lại từ đầu — mất đúng câu người dùng đang học dở. */
    const seen = new Set(),
      ord = [];
    for (const i of saved.mainOrder) {
      if (!seen.has(i)) {
        seen.add(i);
        ord.push(i);
      }
    }
    for (let i = 0; i < typingSessionState.rows.length; i++) if (!seen.has(i)) ord.push(i);
    typingSessionState.mainOrder = ord;
    typingSessionState.mainIndex = Math.min(saved.mainIndex || 0, ord.length);
    typingSessionState.stats = saved.stats || typingSessionState.stats;
    typingSessionState.wrongIds = new Set(saved.wrongIds || []);
    typingSessionState.autoSound = saved.autoSound !== false;
    typingSessionState.speechRate = Number(saved.speechRate) || 0.8;
    typingSessionState.selectedVoiceName = String(saved.selectedVoiceName || '');
    typingSessionState.showVietnamese = saved.showVietnamese !== false;
    typingSessionState.showHanzi = saved.showHanzi !== false;
    typingSessionState.readOnType = saved.readOnType !== false;
  } else {
    typingSessionState.mainOrder = shuffle(typingSessionState.rows.map((_, i) => i));
    typingSessionState.mainIndex = 0;
    typingSessionState.stats = {
      correct: 0,
      wrong: 0,
      combo: 0,
      bestCombo: 0,
      attempts: 0
    };
    typingSessionState.wrongIds = new Set();
    typingSessionState.autoSound = true;
    typingSessionState.speechRate = .8;
    typingSessionState.selectedVoiceName = '';
    typingSessionState.showVietnamese = true;
    typingSessionState.readOnType = true;
  }
  typingSessionState.mode = 'all';
  typingSessionState.order = [...typingSessionState.mainOrder];
  typingSessionState.index = typingSessionState.mainIndex;
  if (['due', 'weak'].includes(options.review)) {
    typingSessionState.mode = 'review';
    typingSessionState.order = selectReviewRows(typingSessionState.rows, typingSessionState.reviewById, [...typingSessionState.wrongIds], options.review);
    typingSessionState.index = 0;
  }
  domState.$('rateSelect').value = String(typingSessionState.speechRate);
  populateVoiceSelect();
  updateSoundUI();
  updateReadTypeUI();
  updateViUI();
  updateHanUI();
  updateModeUI();
  domState.$('libraryCard').classList.add('hidden');
  domState.$('aiCard')?.classList.add('hidden');
  domState.$('appCard').classList.remove('hidden');
  /* ★ Không còn nút "← Thư viện" trên thanh tiêu đề: màn luyện gõ đã có nút
     "← Bộ khác" trong nhóm "📚 Nội dung" — giống hệt màn Luyện phát âm. */
  domState.$('backLibrary').classList.add('hidden');
  /* ★ Màn luyện gõ dùng CHUNG khung với màn Luyện phát âm: khoá trang đúng
     1 khung hình + đổ danh sách bộ câu vào nhóm "📚 Nội dung". */
  document.body.classList.add('studyFit');
  try {
    fillAppSource();
  } catch (e) {}
  render();
  loadHistory();
  renderAppHistory();
  if (options.route !== false) writeRoute('study', id, false, options.review);
  return true;
}

/* ★ CẢNH TRÚC TRONG THẺ CÂU — màn Luyện gõ vẽ sẵn trong HTML, màn Luyện phát âm
   nhân bản đúng hình đó để hai thẻ câu trông y hệt nhau (khỏi chép 3KB SVG). */

/* ★ NHÓM "📚 NỘI DUNG" CỦA MÀN LUYỆN GÕ (giống hệt bên Luyện phát âm):
   đang học bộ nào thì hiện bộ đó trước, sau là các bộ đã học, rồi các cấp HSK.
   Chọn bộ khác là đổi ngay tại chỗ, không phải quay ra Thư viện. */
export async function fillAppSource() {
  const sel = domState.$('appSource');
  if (!sel) return;
  const cur = typingSessionState.activeDataset ? typingSessionState.activeDataset.id : '';
  const out = [];
  if (typingSessionState.activeDataset) {
    out.push({
      v: 'id:' + cur,
      t: '📌 ' + (typingSessionState.activeDataset.name || 'Bộ đang mở') + ' (' + typingSessionState.rows.length + ')'
    });
  } else {
    out.push({
      v: '',
      t: '🤖 Câu do AI tạo (chưa lưu)'
    });
  }
  let sets = [];
  try {
    sets = await dbList();
  } catch (e) {
    sets = [];
  }
  sets.filter(ds => ds && ds.builtin && ds.rowCount && ds.id !== cur).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(ds => out.push({
    v: 'id:' + ds.id,
    t: '💾 ' + ds.name + ' (' + ds.rowCount + ')'
  }));
  /* Cấp HSK nào đã tạo bộ (id "vocab:hskN") thì thôi, không liệt kê 2 lần */
  const have = new Set(sets.map(ds => ds && ds.id));
  (dataCatalogState.VOCAB_GROUPS.hsk || []).forEach(x => {
    if ('vocab:' + x[0] === cur || have.has('vocab:' + x[0])) return;
    out.push({
      v: 'src:' + x[0],
      t: '🎓 ' + x[1]
    });
  });
  sel.innerHTML = out.map(o => '<option value="' + escapeHtml(o.v) + '">' + escapeHtml(o.t) + '</option>').join('');
  sel.value = typingSessionState.activeDataset ? 'id:' + cur : '';
}

/* ── Chinese Word Rendering ── */
/* ★ Bộ tách từ tiếng Hán (maximal matching trên từ điển HSK 3.0).
   Mục đích: nhóm các chữ thuộc CÙNG MỘT TỪ lại với nhau (vd 听见, 你的…)
   để hiển thị chữ trong cùng từ sát nhau, còn giữa các TỪ có khe rộng hơn. */
/* Bộ tách từ tiếng Hán bằng VITERBI có trọng số tần suất.
   → Sửa lỗi greedy maximal-matching chọn nhầm từ dài hiếm (vd "有时" thay vì "时间").
   Với mỗi vị trí, tính chi phí = log(hạng tần suất); chọn đường có tổng chi phí nhỏ nhất. */

export function initializeTypingDatasets() {
  /* ★ CẢNH TRÚC TRONG THẺ CÂU — màn Luyện gõ vẽ sẵn trong HTML, màn Luyện phát âm
     nhân bản đúng hình đó để hai thẻ câu trông y hệt nhau (khỏi chép 3KB SVG). */
  (function () {
    try {
      const src = document.querySelector('#appCard .qbScenery');
      const box = document.querySelector('#pronCard .pronBox');
      if (src && box && !box.querySelector('.qbScenery')) {
        box.insertBefore(src.cloneNode(true), box.firstChild);
      }
    } catch (e) {}
  })();

  /* ★ NHÓM "📚 NỘI DUNG" CỦA MÀN LUYỆN GÕ (giống hệt bên Luyện phát âm):
     đang học bộ nào thì hiện bộ đó trước, sau là các bộ đã học, rồi các cấp HSK.
     Chọn bộ khác là đổi ngay tại chỗ, không phải quay ra Thư viện. */
}
