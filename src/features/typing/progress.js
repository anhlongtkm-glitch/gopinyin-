import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/typing/progress. Initialization is orchestrated by app/bootstrap.js.

import { renderLibrary } from "../library/controller.js";

import { state as typingSessionState } from "./session.js";

import { progressKey, dbGetAll } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

// ★ AI viết thêm câu cho bộ đang học (không giới hạn số lượng)
export function loadProgress(id) {
  try {
    return JSON.parse(learningStorage.getItem(progressKey(id)) || 'null');
  } catch {
    return null;
  }
}
/* ★ Reset trạng thái runtime của phiên (mốc đo tốc độ CPM) */

/* ★ Reset trạng thái runtime của phiên (mốc đo tốc độ CPM) */
export function resetSessionRuntime() {
  typingSessionState.sentStartTs = 0;
}

export function save() {
  if (!typingSessionState.activeDataset) return;
  if (typingSessionState.mode === 'all') {
    typingSessionState.mainOrder = [...typingSessionState.order];
    typingSessionState.mainIndex = typingSessionState.index;
  }
  learningStorage.setItem(progressKey(typingSessionState.activeDataset.id), JSON.stringify({
    mainOrder: typingSessionState.mainOrder,
    mainIndex: typingSessionState.mainIndex,
    stats: typingSessionState.stats,
    wrongIds: [...typingSessionState.wrongIds],
    reviewById: typingSessionState.reviewById,
    autoSound: typingSessionState.autoSound,
    speechRate: typingSessionState.speechRate,
    selectedVoiceName: typingSessionState.selectedVoiceName,
    showVietnamese: typingSessionState.showVietnamese,
    showHanzi: typingSessionState.showHanzi,
    readOnType: typingSessionState.readOnType,
    lastStudiedAt: Date.now()
  }));
}

/* ── Export / Import tiến độ ── */
// ★ Xuất theo TÊN bộ câu để có thể khôi phục trên máy/trình duyệt khác

/* ── Export / Import tiến độ ── */
// ★ Xuất theo TÊN bộ câu để có thể khôi phục trên máy/trình duyệt khác
export async function exportProgress() {
  const sets = await dbGetAll();
  if (!sets.length) {
    toast('Chưa có dữ liệu để xuất.', 'warn');
    return;
  }
  const items = [];
  for (const ds of sets) {
    const p = loadProgress(ds.id);
    if (p) items.push({
      name: ds.name,
      progress: p
    });
  }
  if (!items.length) {
    toast('Chưa có tiến độ nào để xuất.', 'warn');
    return;
  }
  const payload = {
    app: 'ChineseTypingStudio',
    version: 1,
    exportedAt: Date.now(),
    items
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chinese-typing-progress-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Đã xuất tiến độ ' + items.length + ' bộ câu.', 'ok');
}

export async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'ChineseTypingStudio' || !Array.isArray(data.items)) throw new Error('File không đúng định dạng tiến độ.');
    const sets = await dbGetAll();
    let restored = 0,
      skipped = 0;
    for (const item of data.items) {
      const ds = sets.find(s => s.name === item.name);
      if (!ds) {
        skipped++;
        continue;
      }
      learningStorage.setItem(progressKey(ds.id), JSON.stringify(item.progress));
      restored++;
    }
    await renderLibrary();
    if (restored && !skipped) toast('Đã khôi phục tiến độ ' + restored + ' bộ câu.', 'ok');else if (restored && skipped) toast('Khôi phục ' + restored + ' bộ, bỏ qua ' + skipped + ' bộ không có trong thư viện.', 'warn', 4600);else toast('Không tìm thấy bộ câu nào khớp để khôi phục.', 'warn', 4600);
  } catch (e) {
    toast('Không nhập được tiến độ: ' + e.message, 'bad', 5200);
  }
}

/* ── File Parsing ── */
/* ★ Nạp lười (lazy-load) thư viện SheetJS/xlsx: chỉ tải từ CDN khi thực sự cần
   (trước đây bị load trên MỌI trang qua thẻ <script> tĩnh → tốn băng thông,
   dễ bị trình chặn CDN làm lỗi). Gọi `await ensureXLSX()` trước khi dùng XLSX. */
