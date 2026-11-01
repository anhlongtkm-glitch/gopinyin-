import { renderUserChip, showView } from '../../app/navigation.js';
import { doRegister, doLogin, doLogout, currentUser, cancelPendingAction, resumePendingAction, requestPasswordReset, resetPassword, changePassword } from './service.js';
import { getAccountClient } from './client.js';
import { prepareAvatar, saveProfile, avatarUrl } from './profile.js';
import { setConflictResolver, hasLegacyData, importLegacyData, onDataChange, syncStatus } from '../../shared/storage/account-data.js';
import { openModal, closeModal } from '../../shared/dialogs.js';
import { toast } from '../../shared/toast.js';
import { refreshDash } from '../dashboard/controller.js';
import { renderVocab } from '../library/catalog.js';
import { state as typingState } from '../typing/session.js';
import { state as historyState } from '../typing/history.js';
import { loadWeakSpeed } from '../typing/weakness.js';
import { state as gameState } from '../game/session.js';
import { state as pronState } from '../pronunciation/session.js';
import { aiEndSession } from '../ai/session.js';

export const state = { authMode: 'login' };
const $ = id => document.getElementById(id);
let avatarChange, previewUrl, migrationPromise = Promise.resolve(), conflictDone;
const errorText = (id, text) => { $(id).textContent = text || ''; $(id).hidden = !text; };
function showAuthNotice(title, text, action, onAction) {
  $('authNoticeTitle').textContent = title; $('authNoticeText').textContent = text;
  $('authNotice').hidden = false;
  if (action) {
    $('authForm').hidden = true; document.querySelector('.authTabs').hidden = true;
    $('authForgotBtn').hidden = true; $('authBackBtn').hidden = true;
    $('authNoticeAction').textContent = action; $('authNoticeAction').hidden = false;
    $('authNoticeAction').onclick = onAction;
  }
  $('authNotice').focus();
}
export function setAuthMode(mode) {
  if ($('authSubmit').disabled) return;
  state.authMode = mode;
  const register = mode === 'register', recover = mode === 'recovery', forgot = mode === 'forgot';
  document.querySelectorAll('.authTab').forEach(t => { const active = t.dataset.authtab === mode; t.classList.toggle('active', active); t.setAttribute('aria-pressed', String(active)); });
  $('authNameField').hidden = !register;
  $('authEmail').closest('label').hidden = recover;
  $('authPass').closest('label').hidden = forgot;
  $('authForm').hidden = false; $('authNotice').hidden = true; $('authNoticeAction').hidden = true;
  document.querySelector('.authTabs').hidden = recover || forgot;
  $('authForgotBtn').hidden = mode !== 'login'; $('authBackBtn').hidden = !forgot;
  $('authName').required = register; $('authName').disabled = !register;
  $('authEmail').disabled = recover; $('authPass').disabled = forgot;
  $('authConfirmField').hidden = !recover; $('authConfirm').disabled = !recover; $('authConfirm').required = recover;
  $('authPassHint').hidden = !(register || recover);
  $('authPass').value = ''; $('authConfirm').value = ''; $('authPass').type = 'password';
  $('authShowPassword').textContent = 'Hiện'; $('authShowPassword').setAttribute('aria-pressed', 'false'); $('authShowPassword').setAttribute('aria-label', 'Hiện mật khẩu');
  $('authSubmit').textContent = register ? 'Tạo tài khoản' : recover ? 'Lưu mật khẩu mới' : forgot ? 'Gửi liên kết khôi phục' : 'Đăng nhập';
  $('authTitle').textContent = register ? 'Tạo tài khoản GoPinyin' : recover ? 'Đặt lại mật khẩu' : forgot ? 'Quên mật khẩu' : 'Đăng nhập GoPinyin';
  $('authSubtitle').textContent = getAccountClient() ? 'Đăng nhập để học, chơi và đồng bộ tiến độ trên các thiết bị.' : 'Đăng nhập chưa khả dụng: web chưa được cấu hình dịch vụ tài khoản.';
  if (getAccountClient()) $('authSubtitle').textContent = register ? 'Bắt đầu hành trình tiếng Trung của bạn, miễn phí.' : recover ? 'Liên kết đã được xác nhận. Hãy tạo mật khẩu mới để bảo vệ tài khoản.' : forgot ? 'Nhập email tài khoản. Chúng mình sẽ gửi liên kết đặt lại mật khẩu.' : 'Chào mừng bạn trở lại. Tiếp tục hành trình tiếng Trung nhé!';
  $('authPass').autocomplete = register || recover ? 'new-password' : 'current-password';
  $('authPass').minLength = register || recover ? 8 : 0;
  errorText('authError', '');
}
function updateAccount() {
  renderUserChip();
  const user = currentUser();
  $('wsProfileBtn').hidden = false; $('wsProfileBtn').disabled = !user;
  const av = $('wsAvatar'), url = avatarUrl(user?.avatarPath);
  if (url) { const img = document.createElement('img'); img.src = url; img.alt = ''; av.replaceChildren(img); }
  if (user) $('wsUserPlan').textContent = 'Tài khoản miễn phí';
  else $('wsUserPlan').textContent = 'Đăng nhập để học';
  if (!$('rankCard').classList.contains('hidden')) window.renderRank?.('study');
}
function stopActivities() {
  window.__pron?.leave();
  if (gameState.state?.running) window.__game?.leaveGame({ silent: true });
  aiEndSession();
  window.speechSynthesis?.cancel();
}
function clearRuntime() {
  stopActivities();
  document.querySelectorAll('#aiKey,#aiPrompt,#currentPassword,#newPassword').forEach(input => input.value = '');
  typingState.activeDataset = null; typingState.rows = []; typingState.order = []; typingState.wrongIds = new Set();
  typingState.speechRate = 1; typingState.selectedVoiceName = '';
  typingState.reviewById = {};
  historyState.typingHistory = [];
  if (pronState.S) { pronState.S.items = []; pronState.S.progress = null; pronState.S.result = null; pronState.S.record = null; pronState.S.lastSource = ''; pronState.S.source = 'current'; pronState.S.settings = {rate:1,voice:'',autoSample:true,autoNext:false,showPy:true,showHan:true,showVi:true,filter:'all'}; }
  if (gameState.state) { gameState.state.suspended = false; gameState.state.running = false; gameState.state.score = 0; gameState.state.pool = []; }
  loadWeakSpeed(); refreshDash(); renderVocab();
  document.querySelectorAll('#aiSetsList,#pronLibHsk,#rankPodium,#rankBody').forEach(e => e.replaceChildren());
  showView('dash');
}
function syncLabel() {
  const labels = { guest: '', loading: 'Đang tải dữ liệu…', saving: 'Đang lưu…', pending: 'Chờ đồng bộ…', saved: 'Đã đồng bộ', error: 'Lỗi đồng bộ', offline: 'Mất kết nối', conflict: 'Cần chọn bản dữ liệu' };
  $('accountSyncStatus').textContent = labels[syncStatus()] || '';
  if (['error','offline','conflict'].includes(syncStatus()) && currentUser()) window.dispatchEvent(new CustomEvent('gp:access-paused'));
}
async function maybeImport() {
  const user = currentUser();
  if (!user) return;
  const key = 'gp:legacy-decision:' + user.id;
  if (localStorage.getItem(key) || !await hasLegacyData()) return;
  openModal('legacyImportModal');
  await new Promise(resolve => {
    $('legacySkip').onclick = () => { localStorage.setItem(key, 'skipped'); closeModal('legacyImportModal', true); resolve(); };
    $('legacyImport').onclick = async () => {
      $('legacyImport').disabled = true;
      try { await importLegacyData(); localStorage.setItem(key, 'imported'); closeModal('legacyImportModal', true); resolve(); }
      catch (e) { errorText('legacyImportError', e.message); }
      finally { $('legacyImport').disabled = false; }
    };
  });
}
function showAvatar(blob) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = blob ? URL.createObjectURL(blob) : null;
  const src = previewUrl || (avatarChange === null ? '' : avatarUrl(currentUser()?.avatarPath));
  $('profilePreview').hidden = !src; $('profileInitial').hidden = !!src;
  if (src) $('profilePreview').src = src;
  else $('profilePreview').removeAttribute('src');
  $('profileInitial').textContent = (currentUser()?.name || 'H')[0].toUpperCase();
}
function openProfile() {
  if (!currentUser()) return;
  avatarChange = undefined; $('profileFile').value = '';
  $('profileName').value = currentUser().name; $('profileEmail').textContent = currentUser().email;
  $('passwordForm').reset(); errorText('profileError', ''); errorText('passwordError','');
  showAvatar(); openModal('profileModal');
}
export function initializeAuthController() {
  document.querySelectorAll('.authTab').forEach(t => t.onclick = () => setAuthMode(t.dataset.authtab));
  $('authForgotBtn').onclick = () => setAuthMode('forgot');
  $('authBackBtn').onclick = () => setAuthMode('login');
  $('authShowPassword').onclick = () => {
    const visible = $('authPass').type === 'password'; $('authPass').type = visible ? 'text' : 'password';
    $('authShowPassword').textContent = visible ? 'Ẩn' : 'Hiện';
    $('authShowPassword').setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    $('authShowPassword').setAttribute('aria-pressed', String(visible));
  };
  $('authForm').onsubmit = async event => {
    event.preventDefault();
    const btn = $('authSubmit'); if (btn.disabled) return;
    if (!$('authForm').reportValidity()) return;
    const submitLabel = btn.textContent;
    btn.disabled = true; btn.textContent = 'Đang xử lý…'; $('authForm').setAttribute('aria-busy','true'); errorText('authError','');
    try {
      const mode = state.authMode;
      if (mode === 'forgot') {
        if (!$('authEmail').value.trim()) throw new Error('Nhập email để nhận liên kết.');
        await requestPasswordReset($('authEmail').value);
        showAuthNotice('Kiểm tra hộp thư của bạn', 'Nếu email ' + $('authEmail').value.trim() + ' đã có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Kiểm tra cả mục Thư rác. Mở liên kết trên trình duyệt này để tiếp tục.', 'Quay lại đăng nhập', () => setAuthMode('login')); return;
      }
      if (mode === 'recovery') {
        if ($('authPass').value !== $('authConfirm').value) throw new Error('Hai mật khẩu chưa khớp. Vui lòng nhập lại.');
        await resetPassword($('authPass').value); $('authPass').value = ''; $('authConfirm').value = '';
        showAuthNotice('Đã đổi mật khẩu thành công', 'Mật khẩu mới đã được lưu. Lần đăng nhập tiếp theo, hãy sử dụng mật khẩu mới này.', 'Tiếp tục học', async () => { closeModal('authModal', true); await resumePendingAction(); }); return;
      }
      const result = mode === 'register' ? await doRegister($('authName').value, $('authEmail').value, $('authPass').value) : await doLogin($('authEmail').value, $('authPass').value);
      if (!result.ok) throw new Error(result.msg);
      if (result.verification) { $('authPass').value = ''; showAuthNotice('Chỉ còn một bước nữa!', 'Email xác minh đã được gửi đến ' + $('authEmail').value.trim() + '. Mở thư và bấm xác nhận để hoàn tất đăng ký. Kiểm tra cả mục Thư rác và mở liên kết trên trình duyệt này.', 'Quay lại đăng nhập', () => setAuthMode('login')); return; }
      closeModal('authModal', true); $('authPass').value = ''; updateAccount();
      await migrationPromise;
      await resumePendingAction();
      toast('Đăng nhập thành công.', 'ok');
    } catch (e) { errorText('authError', e.message); }
    finally { btn.disabled = false; btn.textContent = submitLabel; $('authForm').removeAttribute('aria-busy'); }
  };
  $('wsLogoutBtn').onclick = async () => { stopActivities(); await doLogout(); setAuthMode('login'); closeModal('profileModal'); };
  $('wsProfileBtn').onclick = openProfile;
  $('wsAvatar').onclick = openProfile;
  $('wsAvatar').onkeydown = e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); openProfile(); } };
  $('profileFile').onchange = async event => {
    try { if (!event.target.files[0]) return; avatarChange = await prepareAvatar(event.target.files[0]); showAvatar(avatarChange); errorText('profileError',''); }
    catch (e) { errorText('profileError',e.message); }
  };
  $('profileRemovePhoto').onclick = () => { avatarChange = null; $('profileFile').value = ''; showAvatar(); };
  $('profileForm').onsubmit = async event => {
    event.preventDefault(); $('profileSave').disabled = true;
    try { await saveProfile($('profileName').value, avatarChange); closeModal('profileModal'); toast('Đã lưu hồ sơ.', 'ok'); }
    catch (e) { errorText('profileError',e.message); }
    finally { $('profileSave').disabled = false; }
  };
  $('passwordForm').onsubmit = async event => {
    event.preventDefault(); const button=event.submitter; button.disabled = true;
    try { await changePassword($('currentPassword').value, $('newPassword').value); $('passwordForm').reset(); errorText('passwordError',''); toast('Đã đổi mật khẩu.','ok'); }
    catch (e) { errorText('passwordError',e.message); }
    finally { button.disabled = false; }
  };
  setConflictResolver(({ local, remote }) => new Promise(resolve => {
    conflictDone = resolve;
    $('syncConflictRecord').textContent = local.record_id;
    $('syncLocalPreview').textContent = 'Trên máy này:\n' + JSON.stringify(local.payload,null,2).slice(0,1500);
    $('syncRemotePreview').textContent = 'Trên máy chủ:\n' + JSON.stringify(remote.payload,null,2).slice(0,1500);
    openModal('syncConflictModal');
    for (const [id,choice] of [['syncKeepLocal','local'],['syncKeepRemote','remote']]) $(id).onclick = () => { conflictDone = null; closeModal('syncConflictModal'); resolve(choice); };
  }));
  window.addEventListener('gp:login-required', () => { setAuthMode('login'); openModal('authModal'); });
  window.addEventListener('gp:password-recovery', () => { setAuthMode('recovery'); openModal('authModal'); });
  window.addEventListener('gp:auth-callback', ({ detail }) => {
    setAuthMode(detail.recovery ? 'forgot' : 'login'); openModal('authModal');
    if (detail.kind === 'verified') showAuthNotice('Xác minh email thành công!', 'Tài khoản của bạn đã được xác nhận. Chào mừng bạn đến với GoPinyin!', 'Bắt đầu học', async () => { closeModal('authModal', true); await resumePendingAction(); });
    else {
      errorText('authError', 'Liên kết không hợp lệ, đã hết hạn hoặc được mở trên trình duyệt khác. ' + (detail.recovery ? 'Nhập email bên dưới để nhận liên kết mới.' : 'Hãy thử đăng nhập nếu bạn đã xác minh; hoặc mở lại thư trên trình duyệt đã đăng ký.'));
      $('authEmail').focus();
    }
  });
  window.addEventListener('gp:account-error', e => toast(e.detail, 'warn', 5500));
  window.addEventListener('gp:account', updateAccount);
  window.addEventListener('gp:account-ready', () => { loadWeakSpeed(); refreshDash(); renderVocab(); migrationPromise = maybeImport(); $('accountAccessNotice').hidden = true; });
  window.addEventListener('gp:account-cleared', () => { if (conflictDone) { conflictDone('cancel'); conflictDone=null; } clearRuntime(); });
  window.addEventListener('gp:remote-record', () => {
    // Discard stale in-memory cursors so the next save cannot overwrite the chosen server copy.
    gameState.suppressSave = true;
    try { clearRuntime(); } finally { gameState.suppressSave = false; }
    toast('Đã chọn bản trên máy chủ. Mở lại bài học hoặc game để tiếp tục.', 'ok', 5000);
  });
  window.addEventListener('gp:access-paused', () => {
    window.__pron?.leave(); if (gameState.state?.running) gameState.state.paused = true;
    $('accountAccessNotice').hidden = false;
    $('accountAccessText').textContent = 'Đã tạm dừng. Cần mạng, phiên hợp lệ và đồng bộ thành công để tiếp tục.';
  });
  $('accountRetry').onclick = async () => {
    const { requireAccount } = await import('./service.js');
    if (await requireAccount()) { $('accountAccessNotice').hidden = true; toast('Đã kết nối. Bạn có thể tiếp tục bài học hoặc game.', 'ok'); }
  };
  window.addEventListener('gp:sync', syncLabel);
  window.addEventListener('gp:modal-closed', e => {
    if (e.detail === 'authModal') cancelPendingAction();
    if (e.detail === 'syncConflictModal' && conflictDone) { conflictDone('cancel'); conflictDone = null; }
    if (e.detail === 'legacyImportModal' && $('legacySkip').onclick) $('legacySkip').onclick();
  });
  onDataChange(() => { loadWeakSpeed(); refreshDash(); renderVocab(); if (!$('aiCard').classList.contains('hidden')) window.renderAiSets?.(); });
  window.addEventListener('focus', async () => {
    if (currentUser()) { const { requireAccount, refreshProfile } = await import('./service.js'); if (await requireAccount()) await refreshProfile().catch(()=>{}); }
  });
  setAuthMode('login'); updateAccount(); syncLabel();
}
