// State and behavior owned by features/typing/navigation. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";
import { writeRoute } from "../../app/routes.js";

import { aiEndSession } from "../ai/session.js";

import { openVocabSource } from "../library/catalog.js";

import { renderLibrary } from "../library/controller.js";

import { openDataset } from "./datasets.js";

import { save, exportProgress, importProgress } from "./progress.js";

import { state as typingSessionState } from "./session.js";

import { state as domState } from "../../shared/dom.js";

import { toggleTheme } from "../../shared/theme.js";

import { toast } from "../../shared/toast.js";

/* ── Event Listeners ── */
/* ★ Đã bỏ handler của "Bộ câu của bạn" (#studiedSets) — mục này không còn,
   tiến độ giờ nằm ngay trên từng thẻ chủ đề / cấp HSK. */
/* ★ Rời màn học: lưu tiến độ rồi quay về ĐÚNG nơi đã mở bộ câu.
   Mở từ màn "AI sinh câu" → về lại đó (thấy ngay danh sách bộ đã lưu).
   Mở từ thư viện → về thư viện như cũ. */
export function leaveStudy() {
  save();
  aiEndSession();
  typingSessionState.activeDataset = null;
  const origin = typingSessionState.studyOrigin;
  typingSessionState.studyOrigin = 'library';
  if (origin === 'ai' && typeof legacy.showView === 'function') {
    legacy.showView('ai');
    return;
  }
  renderLibrary();
  writeRoute('library');
}
/* ★ NÚT QUAY LẠI (#backLibrary) — dùng chung cho nhiều màn nên gắn MỘT
   handler duy nhất và tự phân nhánh theo màn đang mở:
   - Đang ở màn chơi GAME  → về sảnh "Game từ vựng" (mục cha của game).
   - Đang ở màn học (gõ / AI) → về đúng nơi đã mở (AI sinh câu hoặc Thư viện).
   ★ Trước đây nút này bị gán 2 handler CHỒNG nhau (leaveGame trong game +
     leaveStudy ở ngoài) → bấm ở màn game sẽ mở cả Thư viện đè lên sảnh game. */

/* ★ NÚT QUAY LẠI (#backLibrary) — dùng chung cho nhiều màn nên gắn MỘT
   handler duy nhất và tự phân nhánh theo màn đang mở:
   - Đang ở màn chơi GAME  → về sảnh "Game từ vựng" (mục cha của game).
   - Đang ở màn học (gõ / AI) → về đúng nơi đã mở (AI sinh câu hoặc Thư viện).
   ★ Trước đây nút này bị gán 2 handler CHỒNG nhau (leaveGame trong game +
     leaveStudy ở ngoài) → bấm ở màn game sẽ mở cả Thư viện đè lên sảnh game. */
export function onBackClick() {
  const gc = domState.$('gameCard');
  const inGame = !!(gc && !gc.classList.contains('hidden'));
  if (inGame && legacy.__game && legacy.__game.leaveGame) {
    legacy.__game.leaveGame();
    return;
  }
  leaveStudy();
}

export function initializeTypingNavigation() {
  domState.$('backLibrary').onclick = onBackClick;
  /* ★ Nút "← Bộ khác" + select "📚 Nội dung" trong màn luyện gõ
     (giống hệt cặp nút/select bên màn Luyện phát âm). */
  if (domState.$('appBackBtn')) domState.$('appBackBtn').onclick = leaveStudy;
  if (domState.$('appSource')) domState.$('appSource').onchange = async e => {
    const v = e.target.value || '';
    if (!v) return;
    try {
      if (v.indexOf('src:') === 0) await openVocabSource(v.slice(4));else if (v.indexOf('id:') === 0) await openDataset(v.slice(3));
    } catch (err) {
      toast('Không mở được bộ này: ' + err.message, 'bad', 5200);
    }
  };
  // ★ Theme toggle
  domState.$('themeToggle').onclick = toggleTheme;
  // ★ Export / Import tiến độ
  domState.$('exportProgressBtn').onclick = exportProgress;
  domState.$('importProgressBtn').onclick = () => domState.$('progressFileInput').click();
  domState.$('progressFileInput').onchange = e => {
    const f = e.target.files?.[0];
    if (f) importProgress(f);
    e.target.value = '';
  };
  // ★ Kho từ vựng: chuyển tab nguồn (Kho câu giao tiếp / Bộ câu của tôi)
  // ★ Mở bộ câu: bấm nút "Học tiếp" trong Thư viện / Bộ câu của bạn
  // ★ AI sinh câu: viết prompt → học ngay / đổi nhà cung cấp / lưu key
}
