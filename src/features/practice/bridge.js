// Shared content context; the typing and pronunciation graders keep their own progress.
import { state as typing, currentRow } from '../typing/session.js';
import { openDataset } from '../typing/datasets.js';
import { render, renderStatsOnly } from '../typing/render.js';
import { save } from '../typing/progress.js';
import { state as pron } from '../pronunciation/session.js';
import { startSource } from '../pronunciation/library.js';
import { currentItem, gotoItem, rebuildOrder } from '../pronunciation/lesson.js';
import { saveSettings, syncToolbar } from '../pronunciation/settings.js';
import { stopRecording } from '../pronunciation/recording.js';
import { showView } from '../../app/navigation.js';
import { markNavigation, navigationVersion, writeRoute } from '../../app/routes.js';
import { currentUser, isStudyAllowed } from '../auth/service.js';
import { learningStorage } from '../../shared/storage/account-data.js';
import { openVocabSource } from '../library/catalog.js';
import { studyOverlayOpen } from '../../shared/study/interactions.js';

let switching = false, initialized = false;
const drafts = new Map();
const $ = id => document.getElementById(id);
const visible = id => !!$(id)?.getClientRects().length;
const sourceId = () => typing.activeDataset?.id || 'current';
const modeKey = id => 'cts:progress:practice-mode:' + id;
const draftKey = row => JSON.stringify([sourceId(), row?.id]);
const pronSource = () => /^vocab:hsk[1-9]$/.test(sourceId()) ? 'hsk:' + sourceId().slice(6) : typing.activeDataset ? 'ds:' + sourceId() : 'current';

function captureDraft() {
  const row = currentRow(), input = $('pinyinInput');
  if (!row || !input) return;
  const runtime = {};
  for (const field of ['awaitingEnter','lastValidInput','curHadError','suppressSentenceSpeech','lastTypedSpoken','hanWrongSig','sentStartTs']) runtime[field] = typing[field];
  drafts.set(draftKey(row), {value:input.value,start:input.selectionStart,end:input.selectionEnd,readOnly:input.readOnly,className:input.className,feedback:$('feedback').innerHTML,feedbackClass:$('feedback').className,runtime});
}

function restoreDraft() {
  const draft = drafts.get(draftKey(currentRow()));
  if (!draft) return;
  Object.assign(typing, draft.runtime);
  const input = $('pinyinInput');
  input.value = draft.value; input.readOnly = draft.readOnly; input.className = draft.className;
  input.setSelectionRange(draft.start, draft.end);
  $('feedback').innerHTML = draft.feedback; $('feedback').className = draft.feedbackClass;
  $('typingFeedbackRow').hidden = $('feedback').classList.contains('hidden');
  renderStatsOnly();
}

function matchingPronPosition() {
  const row = currentRow(), original = typing.rows.indexOf(row);
  if (!row) return -1;
  const expectedId = pron.S.source.startsWith('hsk:') ? 'h' + original : pron.S.source.startsWith('ds:') ? 'd' + original + ':' + row.id : 'c' + original + ':' + row.id;
  let position = pron.S.order.findIndex(i => pron.S.items[i]?.id === expectedId);
  if (position < 0) position = pron.S.order.findIndex(i => pron.S.items[i]?.zh === row.zh && pron.S.items[i]?.py === row.py);
  return position;
}

export async function switchPracticeMode(target, {resume = false} = {}) {
  const fromTyping = visible('appCard'), fromPron = visible('pronCard');
  if (!fromTyping && !fromPron) return showView(target === 'speaking' ? 'pron' : 'practice');
  const next = target || (fromTyping ? 'speaking' : 'typing');
  if (switching || studyOverlayOpen() || typing.composing || (next === 'typing' && fromTyping) || (next === 'speaking' && fromPron)) return;
  if (fromPron && pron.S.phase === 'analyzing') return;
  switching = true;
  const uid = currentUser()?.id;
  let rows = typing.rows, dataset = typing.activeDataset;
  try {
    if (next === 'speaking') {
      if (!typing.rows.length) return;
      if (currentRow()) captureDraft(); else resume = true;
      save();
      const source = pronSource();
      if (!resume && pron.S.items.length && pron.S.source === source) await showView('pronStudy', {preserveStudy:true});
      else await startSource(source, {preserveStudy:true});
      if (currentUser()?.id !== uid || rows !== typing.rows || !visible('pronCard') || pron.S.source !== source) return;
      let position = resume ? pron.S.index : matchingPronPosition();
      if (position < 0) { pron.S.settings.filter = 'all'; rebuildOrder(); saveSettings(); syncToolbar(); position = matchingPronPosition(); }
      if (position >= 0 && position !== pron.S.index) gotoItem(position);
      learningStorage.setItem(modeKey(sourceId()), 'speaking');
      if (dataset) writeRoute('study',dataset.id,false,'','speaking');
      if (!studyOverlayOpen() && !$('pronMicBtn').disabled) $('pronMicBtn').focus({preventScroll:true});
    } else {
      const item = currentItem();
      const intent = navigationVersion();
      if (pron.S.phase === 'recording') await stopRecording('manual');
      if (intent !== navigationVersion() || currentUser()?.id !== uid || !visible('pronCard')) return;
      const source = pron.S.source;
      const expectedDataset = source.startsWith('hsk:') ? 'vocab:'+source.slice(4) : source.startsWith('ds:') ? source.slice(3) : null;
      if (expectedDataset && expectedDataset !== dataset?.id) {
        if (source.startsWith('hsk:')) await openVocabSource(source.slice(4),{practiceMode:'typing'});
        else await openDataset(expectedDataset);
        if (currentUser()?.id !== uid || !visible('appCard') || typing.activeDataset?.id !== expectedDataset) return;
        rows = typing.rows; dataset = typing.activeDataset;
      }
      const rowIndex = typing.rows.findIndex((row, i) => item && (
        item.id === (pron.S.source.startsWith('hsk:') ? 'h' + i : pron.S.source.startsWith('ds:') ? 'd' + i + ':' + row.id : 'c' + i + ':' + row.id)
      ));
      const navigation = markNavigation();
      if (!await showView('library', {route:false,navigation,preserveStudy:true}) || navigation !== navigationVersion() || currentUser()?.id !== uid) return;
      if (typing.rows !== rows || typing.activeDataset !== dataset || !typing.rows.length || !isStudyAllowed()) return;
      $('libraryCard').classList.add('hidden'); $('appCard').classList.remove('hidden'); document.body.classList.add('studyFit');
      let position = rowIndex >= 0 ? typing.order.indexOf(rowIndex) : -1;
      if (rowIndex >= 0 && position < 0) { typing.mode = 'all'; typing.order = [...typing.mainOrder]; position = typing.order.indexOf(rowIndex); }
      if (position >= 0 && position !== typing.index) { typing.linkedPractice = true; typing.index = position; render(); restoreDraft(); }
      else restoreDraft();
      learningStorage.setItem(modeKey(sourceId()), 'typing');
      writeRoute('study', dataset?.id || '');
      document.dispatchEvent(new CustomEvent('gp:view-changed', {detail:'study'}));
      if (!studyOverlayOpen()) $('pinyinInput').focus({preventScroll:true});
    }
    syncPracticeModes();
  } finally { switching = false; }
}

function syncPracticeModes() {
  const speaking = visible('pronCard');
  document.querySelectorAll('[data-practice-mode]').forEach(button => {
    const selected = speaking ? button.dataset.practiceMode === 'speaking' : button.dataset.practiceMode === 'typing';
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
  if (visible('appCard') || speaking) {
    document.querySelectorAll('.ws-navItem').forEach(button => button.classList.toggle('active', ['practice','library'].includes(button.dataset.view)));
  }
}

export function initializePracticeBridge() {
  if (initialized) return; initialized = true;
  for (const id of ['appCard','pronCard']) {
    const card = $(id); if (!card) continue;
    const bar = document.createElement('div'); bar.className = 'practiceModeBar'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','Chế độ luyện tập');
    bar.innerHTML = '<span>Cùng một bộ, hai cách luyện</span><div><button type="button" data-practice-mode="typing">Gõ</button><button type="button" data-practice-mode="speaking">Nói</button></div>';
    card.prepend(bar);
    new MutationObserver(syncPracticeModes).observe(card,{attributes:true,attributeFilter:['class']});
  }
  document.addEventListener('click', event => {
    const mode = event.target.closest('[data-practice-mode]'); if (mode) void switchPracticeMode(mode.dataset.practiceMode);
    const quick = event.target.closest('[data-practice-source]');
    if (quick) {
      void openVocabSource(quick.dataset.practiceSource,{practiceMode:quick.dataset.startMode});
    }
  });
  document.addEventListener('gp:typing-opened', () => {
    drafts.clear();
    syncPracticeModes();
  });
  for (const event of ['gp:account-cleared','gp:account-ready']) window.addEventListener(event, () => {drafts.clear();});
  document.addEventListener('gp:view-changed', syncPracticeModes);
  document.addEventListener('gp:practice-restore',event=>void switchPracticeMode(event.detail,{resume:true}));
}
