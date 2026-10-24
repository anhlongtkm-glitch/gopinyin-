// State and behavior owned by shared/storage/import-files. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const storageImportFilesState = state;

export function loadXLSX() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  if (storageImportFilesState.__xlsxLoading) return storageImportFilesState.__xlsxLoading;
  storageImportFilesState.__xlsxLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => {
      storageImportFilesState.__xlsxLoading = null;
      reject(new Error('Không tải được thư viện Excel (mất mạng hoặc CDN bị chặn).'));
    };
    document.head.appendChild(s);
  });
  return storageImportFilesState.__xlsxLoading;
}

export async function ensureXLSX() {
  await loadXLSX();
}
// ★ Tách cột "Nghĩa từ" theo dấu | (hỗ trợ thoát \| để nghĩa chứa được dấu |)
// Không dùng regex lookbehind để tương thích cả trình duyệt cũ

// ★ Tách cột "Nghĩa từ" theo dấu | (hỗ trợ thoát \| để nghĩa chứa được dấu |)
// Không dùng regex lookbehind để tương thích cả trình duyệt cũ
export function splitWv(raw) {
  if (!raw) return [];
  const out = [];
  let cur = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && (raw[i + 1] === '|' || raw[i + 1] === '｜')) {
      cur += raw[i + 1];
      i++;
      continue;
    }
    if (ch === '|' || ch === '｜') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/* ── Dataset Management ── */

export function initializeStorageImportFiles() {
  /* ── File Parsing ── */
  /* ★ Nạp lười (lazy-load) thư viện SheetJS/xlsx: chỉ tải từ CDN khi thực sự cần
     (trước đây bị load trên MỌI trang qua thẻ <script> tĩnh → tốn băng thông,
     dễ bị trình chặn CDN làm lỗi). Gọi `await ensureXLSX()` trước khi dùng XLSX. */
  storageImportFilesState.__xlsxLoading = null;
}
