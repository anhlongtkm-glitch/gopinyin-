// Pure reward rules. Completion IDs are content IDs, never button presses.
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function bearLevel(xp = 0) {
  let level = 1, remaining = Math.max(0, Number(xp) || 0);
  while (level < 20 && remaining >= 100 + 25 * (level-1)) { remaining -= 100 + 25 * (level-1); level++; }
  return {level, current:remaining, needed:level === 20 ? 0 : 100 + 25 * (level-1)};
}
export function weekStart(date = new Date()) {
  const value = new Date(date); value.setDate(value.getDate()-((value.getDay()+6)%7)); return localDay(value);
}
export function weeklyProgress(days, now = new Date()) {
  const weeks = new Map();
  for(const day of days) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||day.date>localDay(now)||!Object.keys(day.events||{}).length)continue;
    const [y,m,d]=day.date.split('-').map(Number), key=weekStart(new Date(y,m-1,d));
    if(!weeks.has(key))weeks.set(key,new Set());weeks.get(key).add(day.date);
  }
  return {activeDays:weeks.get(weekStart(now))?.size||0, earned:[...weeks].filter(([,dates])=>dates.size>=4).map(([key])=>key)};
}
export const quests = [
  {id:'typing', title:'Khởi động đôi tay', text:'Gõ đúng 5 câu khác nhau', target:5, view:'practice'},
  {id:'voice', title:'Cất tiếng tự tin', text:'Luyện nói 3 câu khác nhau', target:3, view:'practice'},
  {id:'explore', title:'Khám phá điều mới', text:'Hoàn thành Bài khóa, Thanh điệu hoặc Shadowing', target:1, view:'readings'}
];
export function emptyDay() { return {xp:0, events:{}, counts:{typing:0,voice:0,explore:0}, claimed:[], gameXp:0}; }
export function applyActivity(day, kind, id) {
  const rewards = {typing:3,voice:0,tone:10,shadow:5,reading:20,game:10};
  if (!(kind in rewards) || !id || id.length > 800) return {day, added:0, quests:[]};
  const key = JSON.stringify([kind,id]);
  if (day.events[key] || Object.keys(day.events).length >= 1500) return {day, added:0, quests:[]};
  const next = structuredClone(day);
  next.events[key] = true;
  let added = rewards[kind];
  if (kind === 'game') { added = Math.min(added, Math.max(0,20-next.gameXp)); next.gameXp += added; }
  if (kind === 'typing') next.counts.typing++;
  if (kind === 'voice') next.counts.voice++;
  if (['tone','shadow','reading'].includes(kind)) next.counts.explore++;
  const completed = quests.filter(q => next.counts[q.id] >= q.target && !next.claimed.includes(q.id));
  for (const q of completed) { next.claimed.push(q.id); added += 5; }
  next.xp += added;
  return {day:next, added, quests:completed};
}
