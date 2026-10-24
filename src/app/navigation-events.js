// State and behavior owned by app/navigation-events. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "./compatibility.js";

import { enterWorkspace, showView } from "./navigation.js";

import { currentUser } from "../features/auth/service.js";

import { state as accountStorageState } from "../shared/account-storage.js";

import { openModal } from "../shared/dialogs.js";

import { toast } from "../shared/toast.js";

export function initializeAppNavigationEvents() {
  /* ═══════════════ ĐĂNG NHẬP / CTA TỪ LANDING ═══════════════ */
  accountStorageState.$('lpLoginBtn').addEventListener('click', () => {
    if (currentUser()) {
      enterWorkspace();
      return;
    }
    openModal('authModal');
  });
  accountStorageState.$('lpCtaBtn').addEventListener('click', () => {
    if (currentUser()) enterWorkspace();else openModal('authModal');
  });
  accountStorageState.$('heroStartBtn').addEventListener('click', () => {
    if (currentUser()) {
      enterWorkspace();
      return;
    }
    openModal('authModal');
  });
  accountStorageState.$$('[data-open="auth"]').forEach(b => b.addEventListener('click', () => openModal('authModal')));
  accountStorageState.$$('[data-goto]').forEach(a => a.addEventListener('click', () => {
    if (!currentUser()) {
      openModal('authModal');
      toast('Đăng nhập để vào học nhé!', 'warn');
      return;
    }
    enterWorkspace();
    /* ★ 'typing' và 'vocab' đều nằm trong Thư viện; trước đây 'vocab' được truyền
       thẳng vào showView() — mà showView không có view tên 'vocab' → ẩn HẾT các
       mục và người dùng nhận một màn trắng. */
    const g = a.dataset.goto;
    const view = g === 'typing' || g === 'vocab' ? 'library' : g;
    setTimeout(() => {
      showView(view);
      if (g === 'vocab') {
        const t = document.querySelector('.modeBtn[data-vtab="topic"]');
        if (t) setTimeout(() => {
          try {
            t.click();
          } catch (e) {}
        }, 0);
      }
    }, 80);
  }));
  accountStorageState.$$('.ws-navItem').forEach(b => {
    const label = b.querySelector('.ws-navLabel')?.textContent.trim() || b.dataset.view;
    b.setAttribute('aria-label', label + (b.dataset.view === 'ai' ? ', Pro' : ''));
    b.title = label + (b.dataset.view === 'ai' ? ', Pro' : '');
    b.addEventListener('click', () => showView(b.dataset.view));
  });
  accountStorageState.$('dashContinueBtn').addEventListener('click', async () => {
    const button = accountStorageState.$('dashContinueBtn');
    const id = button.dataset.datasetId;
    if (!id) {
      showView('library');
      return;
    }
    button.disabled = true;
    try {
      showView('library');
      await legacy.__gpBridge.resumeDataset(id);
    } catch (error) {
      console.error('Không thể mở bộ học đang tiếp tục:', error);
      toast('Không mở được bộ học này: ' + error.message, 'bad', 5000);
    } finally {
      button.disabled = false;
    }
  });
  /* ★ Thẻ game trong sảnh "Game từ vựng": bấm vào mở game tương ứng (data-view).
     Giữ nguyên mảng data-view ở trên; chỉ gắn thêm class .gameTile. */
  accountStorageState.$$('.gameTile[data-view]').forEach(b => {
    b.addEventListener('click', () => showView(b.dataset.view));
    b.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showView(b.dataset.view);
      }
    });
  });
  accountStorageState.$$('[data-view]').filter(b => b.classList.contains('dashCard') || b.classList.contains('dashRecentItem') || b.classList.contains('dashFeature')).forEach(b => b.addEventListener('click', () => {
    showView(b.dataset.view);
    /* ★ Thẻ lối tắt có thể chỉ định sẵn tab từ vựng cần mở.
       PHẢI nhắm đúng nút tab (.modeBtn) — trước đây dùng querySelector('[data-vtab]')
       nên khớp lại CHÍNH thẻ này (nó cũng mang data-vtab) → click dồn click vô hạn. */
    if (b.dataset.vtab) {
      const t = document.querySelector('.modeBtn[data-vtab="' + b.dataset.vtab + '"]');
      if (t && t !== b) setTimeout(() => {
        try {
          t.click();
        } catch (e) {}
      }, 0);
    }
  }));

  /* ═══════════════ THEME ĐỒNG BỘ ═══════════════ */
}
