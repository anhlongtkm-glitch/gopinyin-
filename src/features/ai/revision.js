import { normalizeProgress } from '../typing/progress-normalization.js';

// Positions are in study order, not storage order. Preserve stable row IDs.
export function reviseAiLesson(dataset, saved, { prompt, level, currentRowIndex, reviewOrder = [] }) {
  const normalized = normalizeProgress(saved, dataset.rows.length);
  const order = normalized.mainOrder ?? dataset.rows.map((_, i) => i);
  const cursor = normalized.mainIndex;
  const currentPosition = order.indexOf(currentRowIndex);
  const boundary = currentPosition >= 0 ? Math.max(cursor, currentPosition + 1) : cursor + 1;
  const keep = new Set(order.slice(0, Math.min(boundary, order.length)));
  if (Number.isInteger(currentRowIndex)) keep.add(currentRowIndex);
  // Reviewed items must remain addressable even if they are beyond the main cursor.
  for (const index of reviewOrder) keep.add(index);
  const wrongIds = new Set((saved?.wrongIds || []).map(String));
  dataset.rows.forEach((row, index) => {
    if (saved?.reviewById?.[row.id] || wrongIds.has(String(row.id))) keep.add(index);
  });
  const remap = new Map(), rows = [];
  dataset.rows.forEach((row, index) => {
    if (keep.has(index)) { remap.set(index, rows.length); rows.push(row); }
  });
  const mainOrder = order.filter(index => remap.has(index)).map(index => remap.get(index));
  const ids = new Set(rows.map(row => String(row.id)));
  const progress = {
    ...saved, mainOrder, mainIndex: cursor,
    wrongIds: (saved?.wrongIds || []).filter(id => ids.has(String(id))),
    reviewById: Object.fromEntries(Object.entries(saved?.reviewById || {}).filter(([id]) => ids.has(id)))
  };
  return {
    dataset: { ...dataset, prompt, level, rows, rowCount: rows.length, updatedAt: Date.now() },
    progress, remap
  };
}
