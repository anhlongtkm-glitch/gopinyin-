const counter = value => {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(number) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number))) : 0;
};

function normalizeStats(saved) {
  const combo = counter(saved?.combo);
  return {
    correct: counter(saved?.correct),
    wrong: counter(saved?.wrong),
    combo,
    bestCombo: Math.max(combo, counter(saved?.bestCombo)),
    attempts: counter(saved?.attempts)
  };
}

// Saved positions refer to the old order, before invalid/duplicate entries are removed.
export function normalizeProgress(saved, rowCount) {
  const oldOrder = Array.isArray(saved?.mainOrder) ? saved.mainOrder : [];
  const completed = Math.min(counter(saved?.mainIndex), oldOrder.length);
  const mainOrder = [], seen = new Set();
  let mainIndex = 0;
  for (let position = 0; position < oldOrder.length; position++) {
    const index = oldOrder[position];
    if (!Number.isInteger(index) || index < 0 || index >= rowCount || seen.has(index)) continue;
    seen.add(index);
    mainOrder.push(index);
    if (position < completed) mainIndex++;
  }
  if (!mainOrder.length && !(rowCount === 0 && Array.isArray(saved?.mainOrder))) {
    return { mainOrder: null, mainIndex: 0, stats: normalizeStats(null) };
  }
  // Preserve the old sequence and leave newly added or missing rows unanswered.
  for (let index = 0; index < rowCount; index++) if (!seen.has(index)) mainOrder.push(index);
  return { mainOrder, mainIndex, stats: normalizeStats(saved?.stats) };
}
