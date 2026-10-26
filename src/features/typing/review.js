const DAY = 86400000;
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
// A deterministic, bounded schedule. Failed items return in ten minutes.
export function nextReview(previous, correct, now = Date.now()) {
  const repetitions = correct ? Math.min(20, number(previous?.repetitions) + 1) : 0;
  const days = correct ? Math.min(60, repetitions === 1 ? 1 : repetitions === 2 ? 3 : (number(previous?.intervalDays) || 3) * 2) : 0;
  return { repetitions, intervalDays: days, lastReviewedAt: now, dueAt: now + (correct ? days * DAY : 600000), lapses: number(previous?.lapses) + (correct ? 0 : 1) };
}
export function selectReviewRows(rows, reviews, wrongIds, kind = 'due', now = Date.now()) {
  const wrong = new Set((wrongIds || []).map(String));
  return rows.map((row, index) => ({ index, review: reviews?.[row.id], wrong: wrong.has(String(row.id)) }))
    .filter(x => kind === 'weak' ? x.wrong : Number.isFinite(x.review?.dueAt) && x.review.dueAt <= now)
    .sort((a, b) => (a.review?.dueAt || 0) - (b.review?.dueAt || 0) || a.index - b.index)
    .slice(0, 20).map(x => x.index);
}
