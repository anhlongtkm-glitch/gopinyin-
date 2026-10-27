import { learningStorage } from '../storage/account-data.js';

const SETTINGS_KEY = 'gp:pron:settings';

function savedSettings() {
  try {
    const value = JSON.parse(learningStorage.getItem(SETTINGS_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

// Keep shared audio choices in the existing account-scoped settings record.
// Legacy lesson choices remain intact until an audio selector is changed.
export function speechPreferences(fallback = {}) {
  const saved = savedSettings().sharedAudio || {};
  const rate = Number(saved.rate ?? fallback.rate);
  return {
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    voice: typeof saved.voice === 'string' ? saved.voice : String(fallback.voice || '')
  };
}

export function saveSpeechPreference(change) {
  const settings = savedSettings();
  const sharedAudio = { ...settings.sharedAudio };
  if (Object.hasOwn(change, 'voice')) sharedAudio.voice = String(change.voice || '');
  if (Number(change.rate) > 0) sharedAudio.rate = Number(change.rate);
  learningStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, sharedAudio }));
}

export function sharedSpeechPreferences() { return savedSettings().sharedAudio; }

export function setSpeechRateSelect(select, rate) {
  if (!select) return;
  const value = String(rate);
  if (!Array.from(select.options).some(option => option.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value + '×';
    select.append(option);
  }
  select.value = value;
}

export function chineseVoices() {
  try {
    return (window.speechSynthesis?.getVoices() || []).filter(v => /^zh/i.test(v.lang || '') || /Chinese|Mandarin|Xiaoxiao|Xiaoyi|Xiaomo|Xiaoxuan|Xiaohan|Yaoyao|Huihui|Yunxi|Yunjian|Yunyang|Yunhao|Yunze|Yunfeng|Kangkang/i.test(v.name || ''));
  } catch { return []; }
}

export function voiceGender(voice) {
  const name = String(voice?.name || '').toLowerCase();
  // Test female first: the word "female" also contains "male".
  if (/xiaoxiao|xiaoyi|xiaomo|xiaoxuan|xiaohan|yaoyao|huihui|\bfemale\b/.test(name)) return 'female';
  if (/yunxi|yunjian|yunyang|yunhao|yunze|yunfeng|kangkang|danny|\bmale\b/.test(name)) return 'male';
  return 'unknown';
}

function mainland(voice) {
  return /^zh[-_]?(CN|Hans)/i.test(voice.lang || '') || /Mandarin|普通话|中国大陆|Mainland/i.test(voice.name || '');
}

export function chooseChineseVoice(voices, preference = '') {
  if (!voices.length) return null;
  const exact = voices.find(v => v.name === preference);
  if (exact) return exact;
  const google = voices.find(v => /google/i.test(v.name || '') && mainland(v) && voiceGender(v) !== 'male');
  if (preference === '__male__') return voices.find(v => voiceGender(v) === 'male') || voices.find(mainland) || voices[0];
  if (preference === '__female__') return google || voices.find(v => mainland(v) && voiceGender(v) === 'female') || voices.find(v => voiceGender(v) === 'female') || voices.find(mainland) || voices[0];
  return google || voices.find(v => mainland(v) && voiceGender(v) === 'female') || voices.find(mainland) || voices.find(v => voiceGender(v) === 'female') || voices[0];
}

export function onVoicesChanged(callback) {
  if (!window.speechSynthesis) return () => {};
  if (window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', callback);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
  }
  else {
    const previous = window.speechSynthesis.onvoiceschanged;
    const handler = event => { previous?.(event); callback(event); };
    window.speechSynthesis.onvoiceschanged = handler;
    return () => { if (window.speechSynthesis.onvoiceschanged === handler) window.speechSynthesis.onvoiceschanged = previous; };
  }
}
