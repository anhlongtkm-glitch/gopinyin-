import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/typing/weakness. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const typingWeaknessState = state;

export function loadWeakSpeed() {
  try {
    typingWeaknessState.weakStats = JSON.parse(learningStorage.getItem(typingWeaknessState.WEAK_KEY) || '{}') || {};
  } catch (e) {
    typingWeaknessState.weakStats = {};
  }
  try {
    const s = JSON.parse(learningStorage.getItem(typingWeaknessState.SPEED_KEY) || '{}');
    typingWeaknessState.speedStats = {
      chars: Number(s.chars) || 0,
      ms: Number(s.ms) || 0
    };
  } catch (e) {}
}

export function saveWeak() {
  try {
    learningStorage.setItem(typingWeaknessState.WEAK_KEY, JSON.stringify(typingWeaknessState.weakStats));
  } catch (e) {}
}

export function saveSpeed() {
  try {
    learningStorage.setItem(typingWeaknessState.SPEED_KEY, JSON.stringify(typingWeaknessState.speedStats));
  } catch (e) {}
}
/* +1 đúng/sai cho 1 âm tiết (chấu theo pinyin, không phụ thuộc kiểu gõ) */

/* +1 đúng/sai cho 1 âm tiết (chấu theo pinyin, không phụ thuộc kiểu gõ) */
export function weakInc(word, ok) {
  const w = String(word || '').toLowerCase().replace(/[^a-züv]/g, '');
  if (!w) return;
  const r = typingWeaknessState.weakStats[w] || (typingWeaknessState.weakStats[w] = {
    ok: 0,
    wrong: 0
  });
  if (ok) r.ok++;else r.wrong++;
}

/* ★ Từ yếu = gõ sai ≥2 lần VÀ tỉ lệ sai ≥25% (không đòi "sai > đúng" tuyệt đối —
   người luyện nhiều sẽ có ok rất cao, nếu so tuyệt đối thì không bao giờ thấy điểm yếu). */

/* ★ Từ yếu = gõ sai ≥2 lần VÀ tỉ lệ sai ≥25% (không đòi "sai > đúng" tuyệt đối —
   người luyện nhiều sẽ có ok rất cao, nếu so tuyệt đối thì không bao giờ thấy điểm yếu). */
export function topWeakWords(limit) {
  return Object.keys(typingWeaknessState.weakStats).map(w => ({
    w,
    ok: typingWeaknessState.weakStats[w].ok || 0,
    wrong: typingWeaknessState.weakStats[w].wrong || 0
  })).filter(x => x.wrong >= 2 && x.wrong / (x.ok + x.wrong) >= 0.25).sort((a, b) => b.wrong / (b.ok + b.wrong) - a.wrong / (a.ok + a.wrong) || b.wrong - a.wrong).slice(0, limit || 20);
}

export function speedRecord(chars, ms) {
  if (chars > 0 && ms > 400 && ms < 600000) {
    typingWeaknessState.speedStats.chars += chars;
    typingWeaknessState.speedStats.ms += ms;
    saveSpeed();
  }
}

export function speedCpm() {
  if (!typingWeaknessState.speedStats.ms) return 0;
  return Math.round(typingWeaknessState.speedStats.chars / typingWeaknessState.speedStats.ms * 60000);
}

export function speedReset() {
  typingWeaknessState.speedStats = {
    chars: 0,
    ms: 0
  };
  saveSpeed();
}

export function initializeTypingWeakness() {
  /* ═══ THỐNG KÊ ĐIỂM YẾU (theo âm tiết) + TỐC ĐỘ — lưu localStorage toàn cục ═══ */
  typingWeaknessState.WEAK_KEY = 'cts:weak:v1';
  typingWeaknessState.SPEED_KEY = 'cts:speed:v1';
  typingWeaknessState.weakStats = {};
  typingWeaknessState.speedStats = {
    chars: 0,
    ms: 0
  };
}
