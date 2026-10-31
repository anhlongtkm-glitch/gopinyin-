import { currentUser } from '../auth/service.js';
import { openDataset } from '../typing/datasets.js';
import { state as typing } from '../typing/session.js';
import { dbGet } from '../../shared/storage/lesson-repository.js';
import { syncStatus } from '../../shared/storage/account-data.js';
import { navigationVersion } from '../../app/routes.js';
import { aiEditPause, aiUpdateSavedRequest } from './session.js';
import { toast } from '../../shared/toast.js';
import { trapTab } from '../../shared/focus.js';

const $ = id => document.getElementById(id);
let editing = null, returnFocus;
export function aiSyncSaveStatus() {
  const text = {
    pending: 'Đã lưu trên máy · Chờ đồng bộ', saving: 'Đã lưu trên máy · Đang đồng bộ',
    saved: 'Đã đồng bộ', offline: 'Đã lưu trên máy · Chờ có mạng',
    error: 'Lưu hoặc đồng bộ gặp lỗi · Kiểm tra trạng thái tài khoản',
    conflict: 'Cần giải quyết xung đột đồng bộ', loading: 'Đang tải dữ liệu', guest: ''
  }[syncStatus()] || '';
  document.querySelectorAll('[data-ai-save-status]').forEach(el => { el.textContent = text; });
}
export function aiSyncStudyTools() {
  const visible = typing.activeDataset?.kind === 'ai';
  $('aiStudyTools').hidden = !visible;
  aiSyncSaveStatus();
}
export async function openAiEditor(id) {
  if ($('aiEditDialog').open) return;
  const uid = currentUser()?.id, navigation = navigationVersion();
  const dataset = await dbGet(id);
  if (!dataset || dataset.kind !== 'ai' || !uid || currentUser()?.id !== uid || navigation !== navigationVersion() || $('aiEditDialog').open) return;
  editing = { id, uid, navigation, inStudy: !$('appCard').classList.contains('hidden') && typing.activeDataset?.id === id };
  returnFocus = document.activeElement;
  $('aiEditPrompt').value = dataset.prompt || '';
  $('aiEditLevel').value = dataset.level || '';
  $('aiEditLessonName').textContent = dataset.name;
  $('aiEditError').textContent = '';
  $('aiEditPrompt').removeAttribute('aria-invalid');
  aiEditPause(true);
  $('aiEditDialog').showModal();
  $('aiEditPrompt').focus();
}
export function initializeAiEditor() {
  $('aiEditDialog').addEventListener('keydown', event => trapTab(event, $('aiEditDialog')));
  $('aiEditLevel').innerHTML = $('aiLevel').innerHTML;
  $('aiEditClose').onclick = $('aiEditCancel').onclick = () => $('aiEditDialog').close();
  $('aiEditDialog').addEventListener('close', () => {
    editing = null;
    aiEditPause(false);
    if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus({ preventScroll: true });
  });
  $('aiStudyEdit').onclick = () => openAiEditor(typing.activeDataset?.id);
  $('aiEditForm').onsubmit = async event => {
    event.preventDefault();
    const context = editing;
    if (!context || !$('aiEditDialog').open || $('aiEditSave').disabled) return;
    const prompt = $('aiEditPrompt').value.trim();
    if (!prompt) {
      $('aiEditError').textContent = 'Hãy nhập yêu cầu AI.';
      $('aiEditPrompt').setAttribute('aria-invalid', 'true');
      $('aiEditPrompt').focus(); return;
    }
    if (currentUser()?.id !== context.uid || navigationVersion() !== context.navigation) { $('aiEditDialog').close(); return; }
    $('aiEditSave').disabled = true;
    $('aiEditPrompt').removeAttribute('aria-invalid');
    $('aiEditSave').textContent = 'Đang lưu…';
    $('aiEditError').textContent = '';
    try {
      const result = await aiUpdateSavedRequest(context.id, prompt, $('aiEditLevel').value);
      if (editing !== context || currentUser()?.id !== context.uid) return;
      $('aiEditDialog').close();
      toast(result.review ? 'Đã lưu yêu cầu mới. Nội dung mới xuất hiện khi quay lại học chính.' : 'Đã lưu yêu cầu mới trên máy. AI sẽ tạo tiếp ngay sau mục đang học.', 'ok');
      if (!context.inStudy) await openDataset(context.id);
      aiSyncStudyTools();
    } catch (error) {
      if (editing === context) $('aiEditError').textContent = error.message;
    } finally {
      $('aiEditSave').disabled = false;
      $('aiEditSave').textContent = 'Lưu và học tiếp';
    }
  };
  document.addEventListener('gp:typing-opened', aiSyncStudyTools);
  document.addEventListener('gp:ai-study-started', aiSyncStudyTools);
  document.addEventListener('gp:view-changed', () => {
    aiSyncStudyTools();
    if (editing && navigationVersion() !== editing.navigation) $('aiEditDialog').close();
  });
  window.addEventListener('gp:sync', () => {
    aiSyncSaveStatus();
    if (editing && currentUser()?.id !== editing.uid) $('aiEditDialog').close();
  });
  window.addEventListener('gp:account-cleared', () => {
    if ($('aiEditDialog').open) $('aiEditDialog').close();
  });
}
