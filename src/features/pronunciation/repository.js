// State and behavior owned by features/pronunciation/repository. Initialization is orchestrated by app/bootstrap.js.

import { B, hanChars } from "./utils.js";

export const state = {};

const pronunciationRepositoryState = state;

export function initializePronunciationRepository() {
  /* ═══════════════════════════════════════════════════════════
     PronRepo — nội dung lấy từ kho sẵn có
     ═══════════════════════════════════════════════════════════ */
  pronunciationRepositoryState.PronRepo = {
    async sources() {
      const out = [];
      const b = B();
      if (!b) return out;
      const cur = b.rows() || [];
      if (cur.length) out.push({
        id: 'current',
        label: '📌 Bộ đang mở (' + cur.length + ' mục)'
      });
      let sets = [];
      try {
        sets = await (b.dbList ? b.dbList() : b.dbGetAll());
      } catch (e) {}
      for (const s of sets) {
        if (!s || !(s.rowCount || s.rows?.length)) continue;
        if (s.kind === 'ai' || String(s.id || '').startsWith('ai:')) continue;
        out.push({
          id: 'ds:' + s.id,
          label: '💾 ' + (s.name || 'Bộ đã lưu') + ' (' + (s.rowCount || s.rows?.length) + ')'
        });
      }
      const H = b.hskData() || {};
      for (const k of Object.keys(H)) {
        const a = H[k];
        if (!Array.isArray(a) || !a.length) continue;
        const lvl = Number(String(k).replace(/[^0-9]/g, '')) || 0;
        if (!lvl) continue; /* bỏ mảng meta HSK_DATA.hsk */
        out.push({
          id: 'hsk:' + k,
          label: 'HSK ' + lvl + ' (' + a.length + ')'
        });
      }
      return out;
    },
    /* Danh mục cho MÀN CHỌN BỘ CÂU (giống Thư viện bên Luyện gõ).
       Trả về cấu trúc có sẵn số câu để vẽ thẻ, không phải đoán
       từ chuỗi nhãn như sources(). */
    async catalog() {
      const out = {
        hsk: [],
        sets: [],
        current: null
      };
      const b = B();
      if (!b) return out;
      const H = b.hskData() || {};
      const keys = Object.keys(H).sort((x, y) => {
        const n = s => Number(String(s).replace(/[^0-9]/g, '')) || 0;
        return n(x) - n(y);
      });
      for (const k of keys) {
        const a = H[k] || [];
        if (!Array.isArray(a) || !a.length) continue;
        const lvl = Number(String(k).replace(/[^0-9]/g, '')) || 0;
        /* ★ HSK_DATA.hsk là MẢNG META ([key, nhãn, số câu]), không phải một cấp
           → trước đây sinh ra thẻ "HSK 0 (9)" vô nghĩa. */
        if (!lvl) continue;
        /* ★ Tiến độ GÕ của đúng cấp này bên màn Luyện gõ (bộ 'vocab:hsk<N>') —
           để thẻ HSK hiện được "đã gõ x/N" ngay cả khi chưa luyện nói câu nào. */
        let typed = 0;
        try {
          const p = b.loadProgress ? b.loadProgress('vocab:' + k) : null;
          if (p) typed = Math.min(Math.max(p.mainIndex || 0, 0), a.length);
        } catch (e) {
          typed = 0;
        }
        out.hsk.push({
          id: 'hsk:' + k,
          name: 'HSK ' + lvl,
          lvl,
          count: a.length,
          done: typed
        });
      }
      const cur = b.rows() || [];
      if (cur.length) out.current = {
        id: 'current',
        name: 'Bộ đang mở',
        count: cur.length
      };
      let sets = [];
      try {
        sets = await (b.dbList ? b.dbList() : b.dbGetAll());
      } catch (e) {}
      for (const s of sets) {
        if (!s || !(s.rowCount || s.rows?.length)) continue;
        /* ★ D.1: bộ AI đã lưu (kind==='ai') CHỈ hiện ở màn "AI sinh câu",
           không hiện ở Luyện phát âm. (sources() đã lọc, catalog() cũng phải lọc.) */
        if (s.kind === 'ai' || String(s.id || '').startsWith('ai:')) continue;
        out.sets.push({
          id: 'ds:' + s.id,
          name: s.name || 'Bộ đã lưu',
          count: s.rowCount || s.rows?.length,
          locked: false
        });
      }
      /* ★ Đã bỏ danh sách "Bộ câu của bạn (đã học)" — tiến độ nay hiện ngay
         trên từng thẻ HSK (xem out.hsk[].done + libCardHtml). */
      return out;
    },
    /* Khoá tiến độ: bộ đang mở dùng chung khoá với chính bộ đó trong thư viện,
       để tiến độ không bị tách làm hai khi mở từ hai nơi khác nhau. */
    keyOf(srcId) {
      if (srcId === 'current') {
        const b = B();
        const d = b && b.activeDataset && b.activeDataset();
        return d && d.id ? 'ds:' + d.id : 'current';
      }
      return srcId;
    },
    async load(srcId) {
      const b = B();
      if (!b) return [];
      let raw = [];
      if (srcId === 'current') {
        raw = (b.rows() || []).map((r, i) => ({
          id: 'c' + i + ':' + (r.id != null ? r.id : i),
          zh: r.zh,
          py: r.py,
          vi: r.vi
        }));
      } else if (srcId.startsWith('ds:')) {
        const id = srcId.slice(3);
        let ds = null;
        try {
          ds = b.dbGet ? await b.dbGet(id) : (await b.dbGetAll()).find(x => x && x.id === id);
        } catch (e) {}
        raw = (ds && ds.rows || []).map((r, i) => ({
          id: 'd' + i + ':' + (r.id != null ? r.id : i),
          zh: r.zh,
          py: r.py,
          vi: r.vi
        }));
      } else if (srcId.startsWith('hsk:')) {
        const k = srcId.slice(4);
        const a = (b.hskData() || {})[k] || [];
        raw = a.map((x, i) => ({
          id: 'h' + i,
          zh: x[0],
          py: x[1],
          vi: x[2]
        }));
      }
      /* chỉ giữ mục có chữ Hán thật (bỏ câu rỗng / không phải chữ Hán) */
      return raw.filter(it => it && hanChars(it.zh).length);
    },
    /* Âm tiết chuẩn ứng với từng chữ Hán của 1 mục */
    syllables(item) {
      const b = B();
      if (!b) return [];
      const n = hanChars(item.zh).length;
      let marked = [];
      try {
        marked = b.answerWords(item).marked || [];
      } catch (e) {
        marked = [];
      }
      let map = [];
      try {
        map = b.hanSyllableList(item, n) || [];
      } catch (e) {
        map = [];
      }
      const out = [];
      for (let i = 0; i < n; i++) {
        const si = map[i];
        out.push(si != null && marked[si] ? marked[si] : marked[i] || '');
      }
      return out;
    }
  };
}
