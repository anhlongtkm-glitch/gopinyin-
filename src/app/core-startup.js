// State and behavior owned by app/core-startup. Initialization is orchestrated by app/bootstrap.js.

import { showStorageWarn } from "../features/library/catalog.js";

import { renderLibrary } from "../features/library/controller.js";

import { loadWeakSpeed } from "../features/typing/weakness.js";

import { initDB, state as storageLessonRepositoryState } from "../shared/storage/lesson-repository.js";

import { initTheme } from "../shared/theme.js";

import { toast } from "../shared/toast.js";

export function initializeAppCoreStartup() {
  /* ── Init ── */
  initTheme();
  loadWeakSpeed();
  (async () => {
    await initDB();
    if (storageLessonRepositoryState.dbBroken) showStorageWarn();
    try {
      renderLibrary();
    } catch (e) {
      toast('Không tải được thư viện: ' + e.message, 'bad', 5000);
    }
  })();

  /* ═══════════════════════════════════════════════════════════════
     ★ CẦU NỐI CHO MODULE "LUYỆN PHÁT ÂM" (assets/pronounce.js)
     ───────────────────────────────────────────────────────────────
     Module luyện phát âm nằm ở file riêng để không phình to file này,
     nhưng phải DÙNG CHUNG kho dữ liệu + tiện ích với phần luyện gõ.
     Thay vì để file kia chọc thẳng vào biến nội bộ (dễ vỡ khi refactor),
     ở đây mở ra một mặt tiếp xúc nhỏ, chỉ đọc.
     ═══════════════════════════════════════════════════════════════ */
}
