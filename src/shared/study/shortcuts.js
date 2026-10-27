// One keyboard map for both study modes. Text entry and native controls retain
// Enter/Space; lesson shortcuts never run during an IME composition or a dialog.
import { switchPracticeMode } from '../../features/practice/bridge.js';
import { legacy } from '../../app/compatibility.js';
import { showView } from '../../app/navigation.js';
import { state as typing } from '../../features/typing/session.js';
import { openHelpModal } from '../help.js';
import { studyOverlayOpen } from './interactions.js';

export const STUDY_SHORTCUTS = Object.freeze([
  { id: 'hanzi', key: '1', label: 'Ẩn / hiện chữ Hán', controls: ['hanToggle', 'pronHanToggle', 'typingQuickHanToggle', 'pronQuickHanToggle'] },
  { id: 'pinyin', key: '2', label: 'Ẩn / hiện Pinyin', controls: ['hintBtn', 'typingPyToggle', 'pronPyToggle', 'pronQuickPyToggle'] },
  { id: 'meaning', key: '3', label: 'Ẩn / hiện nghĩa Việt', controls: ['viToggle', 'pronViToggle', 'typingQuickViToggle', 'pronQuickViToggle'] },
  { id: 'listen', key: '4', label: 'Nghe mẫu', controls: ['audioBtn', 'pronSampleBtn'] },
  { id: 'next', key: '5', label: 'Câu tiếp khi đã hoàn tất', controls: ['typingNextBtn', 'pronNextBtn'] },
  { id: 'microphone', key: 'Enter', label: 'Bắt đầu / dừng nói', controls: ['pronMicBtn'] },
  { id: 'switch', key: '0', label: 'Đổi Gõ / Nói', controls: ['typingSwitchModeBtn', 'pronSwitchModeBtn'] },
  { id: 'help', key: '?', label: 'Xem phím tắt', controls: ['helpBtn', 'pronHelpBtn'] }
]);

const $ = id => document.getElementById(id);
const visible = id => { const el = $(id); return !!el && !el.hidden && !el.classList.contains('hidden') && !!el.getClientRects().length; };
let initialized = false;
let composing = false;
let imeSettlingUntil = 0;

export function activeStudyMode() {
  if (visible('appCard')) return 'typing';
  if (visible('pronCard')) return 'pron';
  if (visible('libraryCard')) return 'typing-picker';
  if (visible('pronLibCard')) return 'pron-picker';
  return null;
}

function clickControl(id) {
  const button = $(id);
  if (!button || button.disabled || button.hidden || button.classList.contains('hidden')) return false;
  button.click();
  return true;
}

function focusStudy(mode) {
  if (studyOverlayOpen()) return;
  const target = mode === 'typing' ? $('pinyinInput') : mode === 'pron' ? $('pronMicBtn') : document.querySelector(mode === 'pron-picker' ? '#pronLibHsk button' : '#libraryCard .vocabCard');
  if (target?.getClientRects().length && !target.disabled) target.focus({ preventScroll: true });
}

export async function switchStudyMode() {
  const mode = activeStudyMode();
  if (!mode || studyOverlayOpen()) return;
  if (mode.endsWith('picker')) { if(mode.startsWith('pron')) await showView('practice'); return; }
  return switchPracticeMode();
}

function runShortcut(id, mode) {
  if (id === 'help') { openHelpModal(); return; }
  if (id === 'switch') { void switchStudyMode(); return; }
  if (mode.endsWith('picker')) return;
  const pron = mode === 'pron';
  const ids = pron
    ? { pinyin: 'pronPyToggle', hanzi: 'pronHanToggle', meaning: 'pronViToggle', listen: 'pronSampleBtn', microphone: 'pronMicBtn' }
    : { pinyin: 'hintBtn', hanzi: 'hanToggle', meaning: 'viToggle', listen: 'audioBtn' };
  if (id === 'next') {
    if (pron) {
      const state = legacy.__pron?._state;
      if (state?.result && state.phase === 'result' && !state.busy) clickControl('pronNextBtn');
    } else if (typing.awaitingEnter && !typing.composing) clickControl('typingNextBtn');
    return;
  }
  if (ids[id]) clickControl(ids[id]);
}

function onKeydown(event) {
  if (event.repeat && event.key === 'Enter' && event.target?.closest?.('#pronMicBtn,#typingNextBtn,#pronNextBtn')) { event.preventDefault(); return; }
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || composing || typing.composing || performance.now() < imeSettlingUntil) return;
  if (event.altKey || event.ctrlKey || event.metaKey || (event.shiftKey && event.key !== '?') || event.getModifierState?.('AltGraph')) return;
  const mode = activeStudyMode();
  if (!mode || studyOverlayOpen()) return;
  const shortcut = event.key === 'Enter' && mode === 'typing'
    ? STUDY_SHORTCUTS.find(item => item.id === 'next')
    : STUDY_SHORTCUTS.find(item => item.key === event.key);
  if (!shortcut) return;
  const input = $('pinyinInput');
  const editable = event.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"]');
  if (editable && editable !== input) return;
  // Enter activates whichever control was reached with Tab, exactly once.
  if (event.key === 'Enter' && event.target?.closest?.('button,a,summary,[role="button"],[role="tab"],[role="switch"]')) return;
  if (mode.endsWith('picker') && !['help', 'switch'].includes(shortcut.id)) return;
  if (shortcut.id === 'microphone' && mode !== 'pron') return;
  event.preventDefault();
  runShortcut(shortcut.id, mode);
}

export function initializeStudyShortcuts() {
  if (initialized) return;
  initialized = true;
  for (const shortcut of STUDY_SHORTCUTS) {
    for (const id of shortcut.controls) {
      const control = $(id);
      if (!control) continue;
      control.setAttribute('aria-keyshortcuts', id === 'typingNextBtn' ? '5 Enter' : shortcut.key === '?' ? 'Shift+/' : shortcut.key);
      control.title = shortcut.label + ' (' + (id === 'typingNextBtn' ? '5 hoặc Enter' : shortcut.key) + ')';
      if (!control.querySelector('kbd,.kbd,.pronMicSub')) {
        const hint = document.createElement('kbd');
        hint.className = 'studyKey';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = shortcut.key;
        control.append(hint);
      }
    }
    document.querySelectorAll('[data-shortcut="' + shortcut.id + '"]').forEach(el => { el.textContent = shortcut.key; });
  }
  const table = $('helpShortcutRows');
  if (table) for (const shortcut of STUDY_SHORTCUTS) {
    const row = document.createElement('div');
    row.className = 'shortcutRow';
    const key = document.createElement('kbd');
    key.textContent = shortcut.key;
    const label = document.createElement('span');
    label.textContent = shortcut.id === 'microphone' ? 'Gõ: câu tiếp khi đúng · Nói: bắt đầu / dừng micro' : shortcut.label;
    row.append(key, label);
    table.append(row);
  }
  document.querySelectorAll('[data-switch-study]').forEach(button => button.addEventListener('click', switchStudyMode));
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', () => { composing = false; imeSettlingUntil = performance.now() + 80; }, true);
  window.addEventListener('blur', () => { composing = false; });
  document.addEventListener('keydown', onKeydown);
}
