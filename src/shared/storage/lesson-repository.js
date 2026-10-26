import { dataOwner, listRecords, writeRecord, setDatasetLoader } from "./account-data.js";
import { findVocabSource, fetchVocabItems } from "../../features/library/catalog.js";
import { fixPinyin } from "../language/pinyin.js";
// State and behavior owned by shared/storage/lesson-repository. Initialization is orchestrated by app/bootstrap.js.

import { hideStorageWarn } from "../../features/library/catalog.js";

export const state = {};

const storageLessonRepositoryState = state;

export function initDB() {
  if (storageLessonRepositoryState.dbReady) return storageLessonRepositoryState.dbReady;
  storageLessonRepositoryState.dbReady = new Promise(resolve => {
    let req = null;
    try {
      req = indexedDB.open(storageLessonRepositoryState.DB_NAME, storageLessonRepositoryState.DB_VERSION);
    } catch (e) {
      storageLessonRepositoryState.dbBroken = true;
      resolve(null);
      return;
    }
    let settled = false;
    const fin = ok => {
      if (settled) return;
      settled = true;
      if (!ok) storageLessonRepositoryState.dbBroken = true;
      resolve(storageLessonRepositoryState.db);
    };
    req.onupgradeneeded = () => {
      try {
        const d = req.result;
        if (!d.objectStoreNames.contains(storageLessonRepositoryState.STORE)) d.createObjectStore(storageLessonRepositoryState.STORE, {
          keyPath: 'id'
        });
        if (!d.objectStoreNames.contains(storageLessonRepositoryState.VSTORE)) d.createObjectStore(storageLessonRepositoryState.VSTORE, {
          keyPath: 'file'
        });
      } catch (e) {}
    };
    req.onsuccess = () => {
      storageLessonRepositoryState.db = req.result;
      storageLessonRepositoryState.dbBroken = false;
      hideStorageWarn();
      try {
        storageLessonRepositoryState.db.onversionchange = () => {
          try {
            storageLessonRepositoryState.db.close();
          } catch {}
          ;
          storageLessonRepositoryState.db = null;
          storageLessonRepositoryState.dbReady = null;
        };
      } catch (e) {}
      ;
      fin(true);
    };
    req.onerror = () => fin(false);
    req.onblocked = () => fin(false); // tab khác đang giữ phiên bản DB cũ → không treo vô hạn
    setTimeout(() => fin(false), 5000); // chốt an toàn: tối đa 5s
  });
  return storageLessonRepositoryState.dbReady;
}

export function openDB() {
  return initDB();
}

export async function legacyDatasets() {
  await initDB();
  if (!storageLessonRepositoryState.db) return [...storageLessonRepositoryState.memDB.values()];
  return new Promise(res => {
    try {
      const r = storageLessonRepositoryState.db.transaction(storageLessonRepositoryState.STORE, 'readonly').objectStore(storageLessonRepositoryState.STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => {
        storageLessonRepositoryState.dbBroken = true;
        res([...storageLessonRepositoryState.memDB.values()]);
      };
    } catch (e) {
      res([...storageLessonRepositoryState.memDB.values()]);
    }
  });
}

export async function dbGetAll() {
  if (!dataOwner()) return [];
  const result = [];
  for (const ds of listRecords('dataset')) {
    if (ds.builtin && !ds.rows) {
      const src = findVocabSource(ds.id.replace(/^vocab:/, ''));
      if (!src) continue;
      try { ds.rows = (await fetchVocabItems(src.file)).map((it, i) => ({ id:i, vi:it.m, py:fixPinyin(it.p), zh:it.w, wv:[] })); }
      catch { continue; }
    }
    result.push(ds);
  }
  return result;
}
export async function dbPut(value) {
  if (!dataOwner()) throw new Error('Cần đăng nhập để lưu bộ câu.');
  const stored = structuredClone(value);
  if (stored.builtin) delete stored.rows;
  writeRecord('dataset', value.id, stored);
  return value;
}
export async function dbDelete(id) { writeRecord('dataset', id, null, true); }

export function progressKey(id) {
  return 'cts:progress:' + id;
}
// ★ Cache dữ liệu kho từ vựng (IndexedDB store riêng) — tải 1 lần, dùng offline về sau

// ★ Cache dữ liệu kho từ vựng (IndexedDB store riêng) — tải 1 lần, dùng offline về sau
export function vcacheGet(file) {
  return initDB().then(() => {
    if (!storageLessonRepositoryState.db) return storageLessonRepositoryState.memVcache.get(file) || null;
    return new Promise(res => {
      try {
        const r = storageLessonRepositoryState.db.transaction(storageLessonRepositoryState.VSTORE, 'readonly').objectStore(storageLessonRepositoryState.VSTORE).get(file);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => res(null);
      } catch (e) {
        res(null);
      }
    });
  });
}

export function vcachePut(v) {
  return initDB().then(() => {
    if (!storageLessonRepositoryState.db) {
      storageLessonRepositoryState.memVcache.set(v.file, v);
      return v;
    }
    return new Promise(res => {
      try {
        const r = storageLessonRepositoryState.db.transaction(storageLessonRepositoryState.VSTORE, 'readwrite').objectStore(storageLessonRepositoryState.VSTORE).put(v);
        r.onsuccess = () => res(v);
        r.onerror = () => res(null);
      } catch (e) {
        res(null);
      }
    });
  });
}

/* ── Utilities ── */
/* ★ Chuẩn hoá về chữ thường không dấu để SO KHỚP GÕ.
   NFD bóc được ă/â/ê/ô + mọi dấu thanh, NHƯNG ơ (U+01A1) và ư (U+01B0)
   KHÔNG có dạng phân rã → phải thay tường Minh. Nếu không, khi người dùng
   bật gõ tiếng Việt (Telex: "o"+"w"→"ơ"), ký tự này rơi vào [^a-z0-9\s]
   bị đổi thành KHOẢNG TRẮNG → so khớp báo SAI oan (Bug "w lúc đúng lúc sai"). */

export function initializeStorageLessonRepository() {
  setDatasetLoader(legacyDatasets);
  storageLessonRepositoryState.DB_NAME = 'ChineseTypingStudioDB';
  storageLessonRepositoryState.DB_VERSION = 2;
  storageLessonRepositoryState.STORE = 'datasets';
  storageLessonRepositoryState.VSTORE = 'vocabCache';
}

export function initializeStorageLessonRepository2() {
  storageLessonRepositoryState.db = null;
  /* ── IndexedDB (tự dự phòng bộ nhớ khi trình duyệt chặn lưu trữ) ── */
  storageLessonRepositoryState.dbReady = null;
  storageLessonRepositoryState.dbBroken = false;
}

export function initializeStorageLessonRepository3() {
  storageLessonRepositoryState.memDB = new Map();
  storageLessonRepositoryState.memVcache = new Map();
}
