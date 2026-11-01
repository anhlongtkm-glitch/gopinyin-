// State and behavior owned by features/ai/controller. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { aiUnitOf } from "./client.js";

import { aiLsSet, state as aiProvidersState, aiLsGet, aiKeyStore, aiKeyLoad } from "./providers.js";

import { aiStartStudy } from "./session.js";
import { initializeAiEditor } from './editor.js';


import { state as libraryCatalogState, renderVocab, openVocabSource } from "../library/catalog.js";

import { speakChinese } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { _modalClose, state as modalState } from "../../shared/modal.js";
import { aiProxyUrl } from "../../shared/service-config.js";


export const state = {};

const aiControllerState = state;

export function aiShowSection(section, focusPrompt = false) {
  // Creation and saved lessons share one screen; retain the shortcut API.
  domState.$('aiPane').hidden = false;
  domState.$('aiSetsWrap').hidden = false;
  if (section === 'create' && focusPrompt) {
    domState.$('aiPrompt').focus();
    domState.$('aiPane').scrollIntoView({block:'start',behavior:'auto'});
  }
}

export function aiSyncKindUI() {
  const kind = domState.$('aiKind')?.value || '';
  const ui = aiControllerState.AI_KIND_UI[kind] || aiControllerState.AI_KIND_UI.sentence;
  const lab = domState.$('aiPromptLabelText'),
    sub = domState.$('aiPromptSub'),
    ta = domState.$('aiPrompt');
  if (lab) lab.textContent = ui.q;
  if (sub) sub.textContent = ui.sub;
  if (ta) ta.placeholder = ui.ph;
  const button = domState.$('aiStartBtn');
  if (button && !button.disabled) button.textContent = kind === 'word' ? 'Tạo từ vựng và học' : kind === 'both' ? 'Tạo bài và học' : 'Tạo câu và học';
  domState.$('aiKindHint').textContent = kind ? 'Chọn cả hai để luyện câu xen kẽ từ vựng.' : 'Chọn ít nhất Câu hoặc Từ vựng để bắt đầu.';
}

/* ★ Cập nhật hàng "Lấy API key" theo nhà cung cấp đang chọn:
   link + chữ trên nút + hướng dẫn + placeholder ô key đều đổi theo. */
export function aiProviderRefresh() {
  const sel = domState.$('aiProvider'),
    prov = sel && sel.value || aiProvidersState.AI_DEFAULT_PROVIDER;
  const cfg = aiProvidersState.AI_PROVIDERS[prov] || aiProvidersState.AI_PROVIDERS[aiProvidersState.AI_DEFAULT_PROVIDER];
  const a = domState.$('keyHelpLink'),
    h = domState.$('keyHelpHint'),
    k = domState.$('aiKey');
  if (a) {
    a.href = cfg.keyUrl;
    a.textContent = cfg.keyBtn;
  }
  if (h) h.innerHTML = cfg.keyHint;
  if (k) k.placeholder = cfg.ph;
  const proxy = !!aiProxyUrl();
  const setup = domState.$('aiProviderSetup');
  if (setup) setup.hidden = proxy;
  document.querySelector('.aiDetails').hidden = proxy;
  if (sel) {
    sel.disabled = proxy;
    if (proxy) sel.value = aiProvidersState.AI_DEFAULT_PROVIDER;
  }
  if (k) { k.disabled = proxy; if (proxy) k.value = ''; }
  if (a) a.hidden = proxy;
  if (h && proxy) h.textContent = 'Dịch vụ AI đã sẵn sàng. Bạn không cần nhập API key cá nhân.';
}

export function initializeAiController() {
  initializeAiEditor();
  publishLegacy('aiShowSection', aiShowSection);
  document.querySelectorAll('[data-ai-kind]').forEach(input => input.addEventListener('change', () => {
    const sentence = domState.$('aiSentenceChoice').checked, word = domState.$('aiWordChoice').checked;
    domState.$('aiKind').value = sentence && word ? 'both' : sentence ? 'sentence' : word ? 'word' : '';
    aiSyncKindUI();
  }));
  // ★ Kho từ vựng: chuyển tab nguồn (Kho câu giao tiếp / Bộ câu của tôi)
  // ★ Mở bộ câu: bấm nút "Học tiếp" trong Thư viện / Bộ câu của bạn
  // ★ AI sinh câu: viết prompt → học ngay / đổi nhà cung cấp / lưu key
  domState.$('aiStartBtn').onclick = aiStartStudy;
  /* ★ Chọn "Học gì" (câu / từ vựng / cả hai) → đổi nhãn câu hỏi, gợi ý, placeholder
     và nhãn số lượng ("5 câu" ↔ "5 từ" ↔ "5 mục") cho khớp nội dung sẽ tạo. */
  aiControllerState.AI_KIND_UI = {
    sentence: {
      q: 'Bạn muốn học câu tiếng Trung về chủ đề gì?',
      sub: 'AI sẽ viết câu hoàn chỉnh kèm pinyin & nghĩa tiếng Việt.',
      ph: 'Ví dụ: hội thoại khi đi mua đồ ở chợ, nói thẳng, dùng được ngày mai'
    },
    word: {
      q: 'Bạn muốn học TỪ VỰNG tiếng Trung về chủ đề gì?',
      sub: 'AI sẽ tạo từ / cụm từ ngắn kèm pinyin & nghĩa tiếng Việt — không phải câu dài.',
      ph: 'Ví dụ: từ vựng chuyên ngành bao bì carton, công xưởng, mỗi từ dưới 3 chữ'
    },
    both: {
      q: 'Bạn muốn học CÂU và TỪ VỰNG về chủ đề gì?',
      sub: 'AI sẽ tạo một nửa là từ vựng, một nửa là câu hoàn chỉnh cùng chủ đề.',
      ph: 'Ví dụ: đi khám bệnh — nửa là từ vựng triệu chứng, nửa là câu nói với bác sĩ'
    }
  };
  if (domState.$('aiKind')) domState.$('aiKind').addEventListener('change', aiSyncKindUI);
  publishLegacy("aiSyncKindUI", aiSyncKindUI);
  /* ★ Cập nhật hàng "Lấy API key" theo nhà cung cấp đang chọn:
     link + chữ trên nút + hướng dẫn + placeholder ô key đều đổi theo. */

  domState.$('aiProvider').addEventListener('change', e => {
    const v = e.target.value;
    const prev = aiLsGet(aiProvidersState.AI_PROV_KEY, aiProvidersState.AI_DEFAULT_PROVIDER);
    const k = domState.$('aiKey');
    /* ★ Mỗi nhà cung cấp có key RIÊNG → đổi qua lại không mất key đã dán. */
    if (k && prev && prev !== v) aiKeyStore(prev, k.value.trim());
    aiLsSet(aiProvidersState.AI_PROV_KEY, v);
    if (k) k.value = aiKeyLoad(v);
    aiProviderRefresh();
  });
  domState.$('aiKey').addEventListener('change', e => {
    const sel = domState.$('aiProvider');
    aiKeyStore(sel && sel.value || aiProvidersState.AI_DEFAULT_PROVIDER, e.target.value.trim());
  });
  // ★ Khôi phục tuỳ chọn AI đã lưu
  (function () {
    const p = aiLsGet(aiProvidersState.AI_PROV_KEY, aiProvidersState.AI_DEFAULT_PROVIDER),
      sel = domState.$('aiProvider');
    /* ★ Giá trị cũ có thể là 'puter'/'poll' (đã bỏ) → tự đưa về mặc định Gemini. */
    const use = aiProvidersState.AI_PROVIDERS[p] ? p : aiProvidersState.AI_DEFAULT_PROVIDER;
    if (sel) sel.value = use;
    if (use !== p) aiLsSet(aiProvidersState.AI_PROV_KEY, use);
    const k = domState.$('aiKey');
    if (k) k.value = aiKeyLoad(use);
    aiProviderRefresh();
    aiSyncKindUI(); // đồng bộ nhãn "Học gì" ngay lần đầu
  })();
  // ★ Kho từ vựng: chuyển nhóm (HSK / Chủ đề / Khác) + tìm kiếm + chọn mục
  /* ★ Chỉ gắn cho NÚT TAB thật (.modeBtn). Trước đây quét mọi [data-vtab] nên thẻ
     lối tắt trên Bảng điều khiển (cũng có data-vtab) bị gán nhầm handler đổi tab. */
  document.querySelectorAll('.modeBtn[data-vtab]').forEach(b => {
    b.onclick = () => {
      libraryCatalogState.vocabTab = b.dataset.vtab;
      document.querySelectorAll('.modeBtn[data-vtab]').forEach(x => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      libraryCatalogState.vocabQuery = '';
      const s = domState.$('vocabSearch');
      if (s) s.value = '';
      renderVocab();
    };
  });
  domState.$('vocabSearch').addEventListener('input', e => {
    libraryCatalogState.vocabQuery = e.target.value || '';
    renderVocab();
  });
  domState.$('vocabList').addEventListener('click', e => {
    const b = e.target.closest('[data-vsrc]');
    if (b) openVocabSource(b.dataset.vsrc);
  });
  // ★ App modal — nút và bàn phím
  domState.$('appModalOk').onclick = () => _modalClose(modalState._modalIsInput ? domState.$('appModalInput').value : true);
  domState.$('appModalCancel').onclick = () => _modalClose(modalState._modalIsInput ? null : false);
  domState.$('appModalInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      _modalClose(domState.$('appModalInput').value);
    }
  });
  domState.$('appModal').addEventListener('click', e => {
    if (e.target === domState.$('appModal')) _modalClose(modalState._modalIsInput ? null : false);
  });
  document.addEventListener('keydown', e => {
    if (!domState.$('appModal').classList.contains('show')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      _modalClose(modalState._modalIsInput ? null : false);
    }
  }, true);
  domState.$('audioBtn').onclick = speakChinese;
  /* ★ Gõ sai → có HIỆU ỨNG LỖI (rung ô gõ + báo bằng chứng), ký tự sai vẫn
     KHÔNG vào ô gõ. Người dùng không bị "mất chữ" mà vẫn biết mình gõ sai. */
}
