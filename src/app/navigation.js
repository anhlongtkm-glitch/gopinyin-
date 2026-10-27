// State and behavior owned by app/navigation. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy, legacy } from "./compatibility.js";
import { writeRoute, markNavigation, navigationVersion } from "./routes.js";
import { rememberLibraryPosition, restoreLibraryPosition } from "./view-context.js";
import { aiEndSession } from "../features/ai/session.js";

import { currentUser, requireAccount } from "../features/auth/service.js";

import { refreshDash } from "../features/dashboard/controller.js";

import { setLibTab } from "../features/library/catalog.js";


import { state as accountStorageState } from "../shared/account-storage.js";

import { state as audioEffectsState } from "../shared/audio/effects.js";



export const state = {};

const appNavigationState = state;


export function enterWorkspace() {
  renderUserChip();
  accountStorageState.$('workspace').classList.remove('hidden');
  window.scrollTo(0, 0);
  showView('dash', { route: false });
  audioEffectsState.Sfx.whoosh();
}

export function renderUserChip() {
  const u = currentUser() || {
    name: 'Khách',
    guest: true
  };
  const nameEl = accountStorageState.$('wsUserName'),
    av = accountStorageState.$('wsAvatar'),
    dn = accountStorageState.$('dashName');
  const nm = u.name || (u.email ? u.email.split('@')[0] : 'Khách');
  if (nameEl) nameEl.textContent = u.guest ? 'Khách' : nm;
  const login = accountStorageState.$('wsLoginBtn');
  const logout = accountStorageState.$('wsLogoutBtn');
  accountStorageState.$('wsUserChip')?.classList.toggle('is-guest', !!u.guest);
  if (login) login.hidden = !u.guest;
  if (logout) logout.hidden = !!u.guest;
  if (av) { av.textContent = (nm[0] || 'K').toUpperCase(); av.tabIndex = u.guest ? -1 : 0; av.setAttribute('role', 'button'); av.setAttribute('aria-label', 'Chỉnh sửa tài khoản'); }
  if (dn) dn.textContent = u.guest ? 'bạn' : nm;
}

export async function showView(v, options = {}) {
  const practice = v === 'practice';
  if (practice) v = 'library';
  const navigation = options.navigation ?? markNavigation();
  if (navigation !== navigationVersion()) return false;
  if (!options.preserveStudy) aiEndSession();
  if (['game', 'pronStudy'].includes(v) && !await requireAccount(() => showView(v, { ...options, navigation: undefined }))) return false;
  if (navigation !== navigationVersion()) return false;
  /* ★ Chốt an toàn: tên view lạ → về Bảng điều khiển. Nếu không, mọi section
     đều bị ẩn và người dùng chỉ thấy một khung trắng. */
  if (!appNavigationState.VIEW_META[v]) v = 'dash';
  document.dispatchEvent(new CustomEvent('gp:view-leaving',{detail:v}));
  if (appNavigationState.currentView === 'library') rememberLibraryPosition();
  if (appNavigationState.currentView === 'pron') rememberLibraryPosition('pronLibCard');

  /* rời màn luyện phát âm → TẮT MIC ngay (không ghi âm ngoài ý muốn) */
  if ((appNavigationState.currentView === 'pron' || appNavigationState.currentView === 'pronStudy') && v !== 'pronStudy' && legacy.__pron) {
    try {
      legacy.__pron.leave();
    } catch (e) {}
  }
  /* ★ Rời khỏi màn chơi game (bấm mục khác trên thanh bên) → dừng ván đang chơi
     và lưu tiến độ, nhưng KHÔNG tự nhảy màn (showView lo phần hiển thị).
     PHẢI kiểm tra TRƯỚC khi ghi đè currentView. */
  if (appNavigationState.currentView === 'game' && v !== 'game' && legacy.__game && legacy.__game.leaveGame) {
    try {
      legacy.__game.leaveGame({
        silent: true
      });
    } catch (e) {}
  }
  appNavigationState.currentView = v;
  /* rời khỏi màn học → mở khoá cuộn trang (khung .studyShell chỉ khoá khi
     đang thật sự ở trong màn luyện gõ / luyện phát âm). */
  document.body.classList.remove('studyFit');
  accountStorageState.$('dashView').classList.toggle('hidden', v !== 'dash');
  accountStorageState.$('libraryCard').classList.toggle('hidden', v !== 'library');
  accountStorageState.$('rankCard').classList.toggle('hidden', v !== 'rank');
  accountStorageState.$('aiCard').classList.toggle('hidden', v !== 'ai');
  accountStorageState.$('pronLibCard')?.classList.toggle('hidden', v !== 'pron');
  // Expose the speaking controls only after settings/source initialization settles.
  // Otherwise a quick shortcut can be overwritten by the late loadSettings().
  accountStorageState.$('pronCard')?.classList.add('hidden');
  accountStorageState.$('appCard').classList.toggle('hidden', true);
  for (const key of ['readings','tones','shadow','shadowVideo','shadowText','bear']) accountStorageState.$(key+'Card')?.classList.toggle('hidden',v!==key);
  accountStorageState.$('gamesCard')?.classList.toggle('hidden', v !== 'games');
  accountStorageState.$('gameCard').classList.toggle('hidden', v !== 'game');
  if (v === 'library') {
    setLibTab('vocab');
    /* ★ Đã bỏ mục "📖 Bộ câu của bạn": tiến độ giờ vẽ trực tiếp trên từng thẻ
       chủ đề / cấp HSK bên trong renderVocab(). */
  }
  if (v === 'rank') {
    try {
      if (typeof legacy.renderRank === 'function') legacy.renderRank('study');
    } catch (e) {}
  }
  if (v === 'ai') {
    if (typeof legacy.aiProviderRefresh === 'function') {
      try {
        legacy.aiProviderRefresh();
      } catch (e) {}
    }
    try {
      if (typeof legacy.aiSyncKindUI === 'function') legacy.aiSyncKindUI();
    } catch (e) {}
    /* ★ Bộ câu AI đã lưu — vẽ lại mỗi lần vào để tiến độ luôn mới */
    try {
      if (typeof legacy.aiSetsWire === 'function') legacy.aiSetsWire();
    } catch (e) {}
    try {
      if (typeof legacy.renderAiSets === 'function') legacy.renderAiSets();
    } catch (e) {}
  }
  /* ★ Luyện phát âm: "pron" = màn CHỌN BỘ CÂU, "pronStudy" = màn luyện.
     Chọn bộ ở đây rồi mới vào học — giống luồng của màn Luyện gõ. */
  if (v === 'pron' && legacy.__pron) {
    try {
      await legacy.__pron.openLib();
    } catch (e) {}
  }
  if (v === 'pronStudy' && legacy.__pron) {
    try {
      await legacy.__pron.open();
    } catch (e) {}
  }
  if (navigation !== navigationVersion()) return false;
  if (v === 'pronStudy') accountStorageState.$('pronCard')?.classList.remove('hidden');
  accountStorageState.$('backLibrary').classList.toggle('hidden', v !== 'game');
  const meta = appNavigationState.VIEW_META[v] || appNavigationState.VIEW_META.dash;
  accountStorageState.$('wsViewTitle').textContent = meta[0];
  accountStorageState.$('wsViewSub').textContent = meta[1];
  /* "pronStudy" là màn con của mục "pron"; "game" là màn con của mục "games"
     → vẫn tô sáng đúng mục cha trên thanh bên khi đang ở màn con. */
  const navKey = ['pronStudy','pron','library'].includes(v) ? 'practice' : v === 'game' ? 'games' : ['shadowVideo','shadowText'].includes(v) ? 'shadow' : v;
  accountStorageState.$$('.ws-navItem').forEach(b => b.classList.toggle('active', b.dataset.view === navKey));
  if (v === 'game' && legacy.__game && legacy.__game.openGame) legacy.__game.openGame();
  if (v === 'dash') refreshDash();
  /* ★ phát lại hiệu ứng xuất hiện mỗi lần chuyển mục */
  if (v !== 'game') replayFx(viewEl(v));
  audioEffectsState.Sfx.page();
  if (options.route !== false) writeRoute(practice ? 'practice' : v === 'pronStudy' ? 'pron' : v);
  if (v === 'library') restoreLibraryPosition();
  else if (v !== 'pron' && !options.preserveStudy) window.scrollTo({top:0,behavior:'instant'});
  document.dispatchEvent(new CustomEvent('gp:view-changed', { detail: v }));
  return true;
}
/* ★ expose cho app-core gọi (vd nút Quay lại trong appCard khi đang học bộ câu cá nhân) */

export function viewEl(v) {
  if (['readings','tones','shadow','shadowVideo','shadowText','bear'].includes(v)) return accountStorageState.$(v+'Card');
  if (v === 'pronStudy') return accountStorageState.$('pronCard');
  if (v === 'pron') return accountStorageState.$('pronLibCard');
  return v === 'dash' ? accountStorageState.$('dashView') : v === 'ai' ? accountStorageState.$('aiCard') : v === 'rank' ? accountStorageState.$('rankCard') : v === 'games' ? accountStorageState.$('gamesCard') : accountStorageState.$('libraryCard');
}

export function replayFx(el) {
  if (!el) return;
  el.classList.remove('fx-in');
  void el.offsetWidth; /* ép reflow để animation chạy lại */
  el.classList.add('fx-in');
}

/* ═══════════════ MODAL PLUMBING ═══════════════ */
/* Resolve dialog aliases to their element IDs. */

export function initializeAppNavigation() {
  /* ═══════════════ ĐIỀU HƯỚNG LANDING ↔ WORKSPACE ═══════════════ */
  appNavigationState.VIEW_META = {
    readings: ['Bài khóa','Đọc, nghe và hiểu những đoạn hội thoại HSK 1'],
    tones: ['Thanh điệu','Nghe và nhận biết 5 thanh cơ bản'],
    shadow: ['Shadowing','Chọn video YouTube theo HSK 1–4 và chủ đề giao tiếp'],
    shadowVideo: ['Shadowing Video','Nghe, nói theo và viết chính tả với video YouTube'],
    shadowText: ['Shadowing Bài khóa','Nghe mẫu, nói theo và tự đối chiếu bản ghi'],
    bear: ['Gấu của bạn','Nhiệm vụ, thử thách và hành trình lên cấp'],
    dash: ['Tổng quan', 'Một bài học nhỏ, một bước tiến mỗi ngày'],
    library: ['Luyện tập', 'Chọn HSK hoặc chủ đề, luyện Gõ / Nói trong cùng một bộ'],
    pron: ['Luyện phát âm', 'Chọn bộ câu theo cấp HSK — nói bằng micro, chấm điểm từng chữ'],
    pronStudy: ['Luyện phát âm', 'Nói tiếng Trung bằng micro — chấm điểm từng chữ, nghe lại và sửa ngay'],
    rank: ['Bảng xếp hạng', 'Bảng xếp hạng luyện gõ theo ngày / tuần — tính theo số câu luyện được'],
    ai: ['AI sinh câu', 'Viết prompt, AI tạo câu mới kèm pinyin + nghĩa'],
    games: ['Game từ vựng', 'Chọn một trò chơi từ vựng để vừa chơi vừa nhớ chữ Hán'],
    game: ['Game bắn chữ', 'Gõ pinyin để bắn nổ chữ — nhấn Enter để xem/ẩn gợi ý pinyin']
  };
  appNavigationState.currentView = 'dash';
  publishLegacy("enterWorkspace", enterWorkspace);
  /* ★ expose cho app-core gọi (vd nút Quay lại trong appCard khi đang học bộ câu cá nhân) */
  publishLegacy("showView", showView);
}
