// Presentation rules use the existing public totals; they never award points.
export function rankedEntries(rows, userId, board = 'study') {
  const count = n => Math.max(0, Math.trunc(Number(n) || 0));
  const seen = new Set();
  const entries = (Array.isArray(rows) ? rows : []).filter(e => {
    if (!e?.id || seen.has(e.id)) return false;
    seen.add(e.id); return count(e.correct) > 0;
  }).map(e => ({ ...e, name: String(e.name || 'Người học'), correct: count(e.correct), score: count(e.score), me: e.id === userId }));
  entries.sort((a,b) => b.correct-a.correct || (board === 'game' ? b.score-a.score : 0) || String(a.id).localeCompare(String(b.id)));
  entries.forEach((e,i) => { e.place = i && e.correct === entries[i-1].correct && (board !== 'game' || e.score === entries[i-1].score) ? entries[i-1].place : i+1; });
  return entries;
}
export function personalStanding(entries, userId, scope) {
  const index = entries.findIndex(e => e.id === userId);
  const me = entries[index];
  const goal = scope === 'week' ? 100 : 20;
  const ahead = me && entries.slice(0,index).reverse().find(e => e.correct > me.correct);
  return { me, index, goal, progress: me ? Math.min(me.correct,goal) : 0, gap: ahead ? ahead.correct-me.correct+1 : null };
}
export function periodDetails(scope, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (scope === 'week') start.setDate(start.getDate()-(start.getDay()+6)%7);
  const end = new Date(start); end.setDate(end.getDate()+(scope === 'week' ? 7 : 1));
  const last = new Date(end); last.setDate(last.getDate()-1);
  const fmt = date => String(date.getDate()).padStart(2,'0')+'/'+String(date.getMonth()+1).padStart(2,'0');
  const hours = Math.max(1,Math.ceil((end-now)/3600000));
  return { label: scope === 'week' ? fmt(start)+' – '+fmt(last) : fmt(start), remaining: hours >= 24 ? Math.floor(hours/24)+' ngày '+hours%24+' giờ' : hours+' giờ' };
}
