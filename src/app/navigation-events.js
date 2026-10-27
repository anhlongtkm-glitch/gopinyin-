// State and behavior owned by app/navigation-events. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "./compatibility.js";

import { showView } from "./navigation.js";


import { state as accountStorageState } from "../shared/account-storage.js";

import { openModal } from "../shared/dialogs.js";

import { toast } from "../shared/toast.js";

export function initializeAppNavigationEvents() {
  const tools=document.querySelector('.workspaceTools');
  if(tools){
    document.addEventListener('click',event=>{if(tools.open&&!tools.contains(event.target))tools.open=false;});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tools.open){tools.open=false;tools.querySelector('summary').focus();event.stopPropagation();}});
    document.addEventListener('gp:view-changed',()=>{tools.open=false;});
  }
  accountStorageState.$$('[data-open="auth"]').forEach(b => b.addEventListener('click', () => openModal('authModal')));
  accountStorageState.$$('.ws-navItem').forEach(b => {
    const label = b.querySelector('.ws-navLabel')?.textContent.trim() || b.dataset.view;
    b.setAttribute('aria-label', label);
    b.title = label;
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
