import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/ai/saved-sets. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { aiKindMeta } from "./client.js";

import { openDataset } from "../typing/datasets.js";

import { loadProgress } from "../typing/progress.js";

import { state as domState } from "../../shared/dom.js";

import { appPrompt, appConfirm } from "../../shared/modal.js";

import { dbList, dbGet, dbPut, dbDelete, progressKey } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { escapeHtml } from "../../shared/utils.js";

/* ═══════════════════════════════════════════════════════════
   ★ BỘ CÂU AI ĐÃ LƯU (kind==='ai') — hiện ngay dưới khung "AI sinh câu".
   Mỗi thẻ cho biết số câu + đã học bao nhiêu + thanh tiến độ, và nút
   "Học tiếp" mở đúng câu đang học dở (openDataset khôi phục mainIndex).
   ═══════════════════════════════════════════════════════════ */
export async function renderAiSets() {
  const grid = domState.$('aiSets');
  if (!grid) return;
  let sets = await dbList();
  sets = sets.filter(ds => ds && ds.kind === 'ai');
  sets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!sets.length) {
    grid.innerHTML = '<div class="aiSetsEmpty"><span class="emoji">📭</span>' + 'Chưa có bộ AI nào được lưu.<br>Viết chủ đề ở trên → bấm tạo → chọn <b>“💾 Lưu lại”</b> để bộ xuất hiện ở đây.</div>';
    return;
  }
  grid.innerHTML = sets.map(ds => {
    const total = ds.rowCount;
    const p = loadProgress(ds.id);
    const done = Math.min(p?.mainIndex || 0, total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const wrong = (p?.wrongIds || []).length;
    const promptTxt = ds.prompt ? String(ds.prompt).replace(/\s+/g, ' ').trim() : '';
    const km = aiKindMeta(ds.contentType);
    return '<article class="libraryItem studiedItem aiSetCard" data-aiid="' + escapeHtml(ds.id) + '">' + '<h3>' + escapeHtml(ds.name || 'Bộ AI') + '</h3>' + '<div class="aiSetBadges"><span class="aiSetBadge k-' + (ds.contentType || 'sentence') + '">' + km.ico + ' ' + km.label + '</span></div>' + (promptTxt ? '<div class="aiSetPrompt" title="' + escapeHtml(promptTxt) + '">💬 ' + escapeHtml(promptTxt) + '</div>' : '') + '<div class="libraryMeta">' + total + ' ' + km.unit + ' · đã học ' + done + '/' + total + (wrong ? ' · <b style="color:var(--bad,#e5484d)">' + wrong + ' cần ôn</b>' : '') + '</div>' + '<div class="aiSetBar"><i style="width:' + pct + '%"></i></div>' + '<div class="aiSetActs">' + '<button type="button" class="miniBtn primary" data-aiact="study" data-id="' + escapeHtml(ds.id) + '">' + (done > 0 ? '▶ Học tiếp' : '▶ Bắt đầu học') + '</button>' + '<button type="button" class="miniBtn" data-aiact="rename" data-id="' + escapeHtml(ds.id) + '">✏️ Đổi tên</button>' + '<button type="button" class="miniBtn" data-aiact="del" data-id="' + escapeHtml(ds.id) + '">✕ Xóa</button>' + '</div>' + '</article>';
  }).join('');
}

/* Một listener duy nhất cho cả lưới (thẻ được vẽ lại nhiều lần) */
export function aiSetsWire() {
  const grid = domState.$('aiSets');
  if (!grid || grid.dataset.wired) return;
  grid.dataset.wired = '1';
  grid.addEventListener('click', async e => {
    const b = e.target.closest('button[data-aiact]');
    if (!b) return;
    const id = b.dataset.id,
      act = b.dataset.aiact;
    const ds = await dbGet(id);
    if (!ds) return;
    if (act === 'study') {
      await openDataset(id);
      return;
    }
    if (act === 'rename') {
      const name = await appPrompt('Nhập tên mới cho bộ câu này:', ds.name || '', {
        title: 'Đổi tên bộ câu',
        okText: 'Lưu'
      });
      if (!name) return;
      ds.name = name.slice(0, 80);
      ds.updatedAt = Date.now();
      await dbPut(ds);
      toast('Đã đổi tên thành “' + ds.name + '”.', 'ok');
      renderAiSets();
      return;
    }
    if (act === 'del') {
      const ok = await appConfirm('Xóa bộ câu “' + ds.name + '” và tiến độ của nó? Không khôi phục được.', {
        title: 'Xóa bộ câu',
        okText: 'Xóa',
        danger: true
      });
      if (!ok) return;
      await dbDelete(id);
      try {
        learningStorage.removeItem(progressKey(id));
      } catch (e) {}
      toast('Đã xóa bộ câu.', 'ok');
      renderAiSets();
      return;
    }
  });
}

export function initializeAiSavedSets() {
  publishLegacy("renderAiSets", renderAiSets);
  /* Một listener duy nhất cho cả lưới (thẻ được vẽ lại nhiều lần) */

  publishLegacy("aiSetsWire", aiSetsWire);
  /* ═══════════════════════════════════════════════════════════
     ★ BỘ CÂU HSK 1–9 (nhúng sẵn — KHÔNG cần mạng)
     ★ 100% là CÂU hoàn chỉnh, KHÔNG có từ đơn lẻ
     ★ Nguồn: hsk-sentences-audio (chuẩn HSK 3.0 / GF0025-2021)
     ★ Mỗi câu: [chữ Hán, pinyin, nghĩa tiếng Việt]
     ═══════════════════════════════════════════════════════════ */
}
