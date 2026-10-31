import { dataOwner, writeRecords } from "../../shared/storage/account-data.js";
import { navigationVersion } from '../../app/routes.js';
// State and behavior owned by features/ai/saved-sets. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { aiKindMeta } from "./client.js";

import { openDataset } from "../typing/datasets.js";

import { loadProgress } from "../typing/progress.js";

import { state as domState } from "../../shared/dom.js";

import { appPrompt, appConfirm } from "../../shared/modal.js";

import { dbList, dbGet, dbPut, progressKey } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { escapeHtml } from "../../shared/utils.js";
import { openAiEditor, aiSyncSaveStatus } from './editor.js';

let query = '', renderVersion = 0;
function setCard(ds, recent = false) {
  const total = ds.rowCount, p = loadProgress(ds.id);
  const done = Math.min(p?.mainIndex || 0, total), pct = total ? Math.round(done / total * 100) : 0;
  const km = aiKindMeta(ds.contentType), id = escapeHtml(ds.id);
  return '<article class="libraryItem studiedItem aiSetCard" data-aiid="' + id + '">' +
    (recent ? '<span class="featureEyebrow">Bài học gần nhất</span>' : '') +
    '<h3>' + escapeHtml(ds.name || 'Bộ AI') + '</h3>' +
    '<div class="aiSetBadges"><span class="aiSetBadge k-' + escapeHtml(ds.contentType || 'sentence') + '">' + escapeHtml(km.label) + '</span><span class="aiSetBadge">' + escapeHtml(ds.level || 'Không giới hạn') + '</span></div>' +
    '<p class="aiSetPrompt">' + escapeHtml(ds.prompt || '') + '</p>' +
    '<div class="libraryMeta">' + total + ' ' + km.unit + ' · đã học ' + done + '/' + total + ((p?.wrongIds || []).length ? ' · ' + p.wrongIds.length + ' cần ôn' : '') + '</div>' +
    '<div class="aiSetBar" role="progressbar" aria-label="Tiến độ học" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '"><i style="width:' + pct + '%"></i></div>' +
    '<div class="aiSetActs"><button type="button" class="miniBtn primary" data-aiact="study" data-id="' + id + '">' + (done ? 'Học tiếp' : 'Bắt đầu học') + '</button>' +
    '<button type="button" class="miniBtn" data-aiact="edit" data-id="' + id + '">Sửa yêu cầu AI</button>' +
    (recent ? '' : '<button type="button" class="miniBtn" data-aiact="rename" data-id="' + id + '">Đổi tên</button><button type="button" class="miniBtn" data-aiact="del" data-id="' + id + '">Xóa</button>') + '</div></article>';
}

/* ═══════════════════════════════════════════════════════════
   ★ BỘ CÂU AI ĐÃ LƯU (kind==='ai') — hiện ngay dưới khung "AI sinh câu".
   Mỗi thẻ cho biết số câu + đã học bao nhiêu + thanh tiến độ, và nút
   "Học tiếp" mở đúng câu đang học dở (openDataset khôi phục mainIndex).
   ═══════════════════════════════════════════════════════════ */
export async function renderAiSets() {
  const grid = domState.$('aiSets');
  if (!grid) return;
  const version = ++renderVersion;
  const owner = dataOwner();
  let sets = await dbList();
  if (version !== renderVersion || owner !== dataOwner()) return;
  sets = sets.filter(ds => ds && ds.kind === 'ai');
  sets.sort((a, b) => (loadProgress(b.id)?.lastStudiedAt || 0) - (loadProgress(a.id)?.lastStudiedAt || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const recent = domState.$('aiContinue');
  recent.innerHTML = sets.length ? setCard(sets[0], true) : '<div class="aiWelcome"><h3>Bắt đầu bài học đầu tiên</h3><p>Viết chủ đề và yêu cầu bạn muốn học trong ô bên dưới.</p><button type="button" class="miniBtn primary" data-ai-create>Tạo bài mới</button></div>';
  const filtered = sets.filter(ds => (ds.name + ' ' + ds.prompt).toLocaleLowerCase('vi').includes(query));
  if (!sets.length) {
    grid.innerHTML = '<div class="aiSetsEmpty">Chưa có bộ AI nào được lưu. Bật “Lưu bài để học tiếp” khi tạo bài mới.</div>';
    return;
  }
  grid.innerHTML = filtered.length ? filtered.map(ds => setCard(ds)).join('') : '<p class="aiSetsEmpty">Không tìm thấy bài phù hợp. Thử tên hoặc chủ đề khác.</p>';
  aiSyncSaveStatus();
}

export function aiSetsWire() {
  const grid = domState.$('aiSets');
  if (!grid || grid.dataset.wired) return;
  grid.dataset.wired = '1';
  domState.$('aiSetSearch').addEventListener('input', event => {
    query = event.target.value.trim().toLocaleLowerCase('vi'); renderAiSets();
  });
  domState.$('aiCard').addEventListener('click', async e => {
    try {
      if (e.target.closest('[data-ai-create]')) { domState.$('aiPrompt').focus(); return; }
      const b = e.target.closest('button[data-aiact]');
      if (!b) return;
      const id = b.dataset.id,
        act = b.dataset.aiact;
      const owner = dataOwner(), navigation = navigationVersion();
      const active = () => owner && owner === dataOwner() && navigation === navigationVersion();
      const ds = await dbGet(id);
      if (!ds || !active()) return;
      if (act === 'edit') { await openAiEditor(id); return; }
      if (act === 'study') {
        await openDataset(id);
        return;
      }
      if (act === 'rename') {
        const name = await appPrompt('Nhập tên mới cho bộ câu này:', ds.name || '', {
          title: 'Đổi tên bộ câu',
          okText: 'Lưu'
        });
        if (!name || !active()) return;
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
        if (!ok || !active()) return;
        writeRecords([
          { kind: 'dataset', id, payload: null, deleted: true },
          { kind: 'kv', id: progressKey(id), payload: null, deleted: true }
        ]);
        toast('Đã xóa bộ câu.', 'ok');
        renderAiSets();
        return;
      }
    } catch (error) { toast(error.message, 'bad'); }
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
