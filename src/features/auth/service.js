import { getAccountClient, accountRedirect } from './client.js';
import { attachAccountData, detachAccountData, synchronizeAccountData, flushAccountData, syncStatus } from '../../shared/storage/account-data.js';
import { navigationVersion } from '../../app/routes.js';

export const state = { user: null, ready: false, profile: null, recovery: false };
let pendingAction = null, activation, activeId = null, epoch = 0;
const emit = name => window.dispatchEvent(new CustomEvent(name));
export function currentUser() { return state.user; }
export function isStudyAllowed() { return !!state.user && state.ready && navigator.onLine && !['error','offline','loading','conflict'].includes(syncStatus()); }
export function cancelPendingAction() { pendingAction = null; }
export function doGuest() { return { ok: false, msg: 'Vui lòng đăng nhập để học hoặc chơi.' }; }
function fail(error) { return { ok: false, msg: error?.message || 'Không thể kết nối dịch vụ tài khoản.' }; }
function connection() {
  const c = getAccountClient();
  if (!c) throw new Error('Đăng nhập chưa khả dụng. Web chưa được cấu hình Supabase.');
  if (!navigator.onLine) throw new Error('Cần kết nối mạng để đăng nhập hoặc học.');
  return c;
}
async function activate(user) {
  if (activation && activeId === user.id) return activation;
  const ticket = ++epoch;
  activeId = user.id; state.ready = false;
  activation = (async () => {
    const c = connection();
    const { data: profile, error } = await c.from('profiles').select('id,display_name,avatar_path').eq('id', user.id).single();
    if (error) throw error;
    if (ticket !== epoch) return;
    state.profile = profile;
    state.user = { id: user.id, email: user.email, name: profile.display_name, avatarPath: profile.avatar_path, guest: false };
    emit('gp:account');
    await attachAccountData(user.id, c);
    if (ticket !== epoch) return;
    state.ready = true; emit('gp:account-ready');
  })();
  try { await activation; } finally { activation = null; }
}
export async function requireAccount(action) {
  const navigation = navigationVersion();
  if (!state.user) { pendingAction = action ? { run: action, navigation } : null; emit('gp:login-required'); return false; }
  try {
    const c = connection(), uid = state.user.id;
    const { data, error } = await c.auth.getUser();
    if (state.user?.id !== uid) return false;
    if (error && ![401,403].includes(error.status)) throw error;
    if (error || !data.user || data.user.id !== state.user.id || !data.user.email_confirmed_at) {
      const stillCurrent = navigation === navigationVersion();
      clearAccount();
      if (stillCurrent) {
        // Account cleanup may navigate to the dashboard; preserve only this current intent.
        pendingAction = action ? { run: action, navigation: navigationVersion() } : null;
        emit('gp:login-required');
      }
      return false;
    }
    if (!state.ready) await activate(data.user);
    await synchronizeAccountData();
    return isStudyAllowed();
  } catch (error) { emit('gp:access-paused'); window.dispatchEvent(new CustomEvent('gp:account-error', { detail: error.message })); return false; }
}
export async function resumePendingAction() {
  const action = pendingAction; pendingAction = null;
  if (action?.navigation === navigationVersion()) await action.run();
}
export async function doLogin(email, password) {
  try {
    const c = connection();
    const { data, error } = await c.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) throw error;
    if (!data.user.email_confirmed_at) throw new Error('Vui lòng xác minh email trước khi đăng nhập.');
    localStorage.removeItem('gp:local-signout');
    await activate(data.user);
    return { ok: true, user: state.user };
  } catch (error) { return fail(error); }
}
export async function doRegister(name, email, password) {
  try {
    name = String(name).trim();
    if (!name || [...name].length > 50) throw new Error('Tên cần từ 1–50 ký tự.');
    if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
    const { data, error } = await connection().auth.signUp({ email: String(email).trim(), password, options: { data: { display_name: name }, emailRedirectTo: accountRedirect() } });
    if (error) throw error;
    if (data.session && data.user.email_confirmed_at) { localStorage.removeItem('gp:local-signout'); await activate(data.user); }
    return { ok: true, verification: !state.ready };
  } catch (error) { return fail(error); }
}
export async function requestPasswordReset(email) {
  const { error } = await connection().auth.resetPasswordForEmail(String(email).trim(), { redirectTo: accountRedirect() + '?account=recovery' });
  if (error) throw error;
}
export async function resetPassword(password) {
  if (!state.recovery) throw new Error('Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
  if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
  const { error } = await connection().auth.updateUser({ password });
  if (error) throw error;
  state.recovery = false;
}
export async function changePassword(current, password) {
  if (!state.user) throw new Error('Cần đăng nhập.');
  if (password.length < 8) throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
  const { error } = await connection().auth.signInWithPassword({ email: state.user.email, password: current });
  if (error) throw new Error('Mật khẩu hiện tại không đúng.');
  const result = await connection().auth.updateUser({ password });
  if (result.error) throw result.error;
}
export async function accessToken() {
  const { data, error } = await connection().auth.getSession();
  if (error || !data.session) throw new Error('Phiên đăng nhập đã hết hạn.');
  return data.session.access_token;
}
export function clearAccount() {
  epoch++; activeId = null; state.user = null; state.profile = null; state.ready = false;
  detachAccountData(); emit('gp:account-cleared'); emit('gp:account');
}
export async function doLogout() {
  pendingAction = null; localStorage.setItem('gp:local-signout', 'true');
  try { await flushAccountData(); } catch { /* The outbox remains scoped to its account. */ }
  clearAccount();
  const c = getAccountClient();
  if (c) await c.auth.signOut({ scope: 'local' });
}
export async function refreshProfile() {
  if (!state.user) return;
  const uid = state.user.id;
  const { data, error } = await connection().from('profiles').select('id,display_name,avatar_path').eq('id', state.user.id).single();
  if (error) throw error;
  if (state.user?.id !== uid) return;
  state.profile = data; state.user.name = data.display_name; state.user.avatarPath = data.avatar_path; emit('gp:account');
}
export function initializeAuthService() {
  const c = getAccountClient();
  if (c) c.auth.onAuthStateChange((event, session) => {
    // Supabase holds an auth lock during this callback: schedule subsequent SDK calls.
    setTimeout(async () => {
      try {
        // Opening a recovery link is an explicit sign-in action after logout.
        if (event === 'PASSWORD_RECOVERY' && session) localStorage.removeItem('gp:local-signout');
        if (session && localStorage.getItem('gp:local-signout')) return;
        if (!session) { if (state.user) clearAccount(); return; }
        if (event === 'PASSWORD_RECOVERY') { state.recovery = true; emit('gp:password-recovery'); }
        const { data, error } = await c.auth.getUser();
        if (error || !data.user?.email_confirmed_at) { clearAccount(); return; }
        if (state.user?.id !== data.user.id || !state.ready) await activate(data.user);
      } catch (error) { state.ready = false; window.dispatchEvent(new CustomEvent('gp:account-error', { detail: error.message })); }
    }, 0);
  });
  window.addEventListener('offline', () => emit('gp:access-paused'));
  window.addEventListener('online', () => { if (state.user) requireAccount().then(ok => { if (ok) emit('gp:account-ready'); }); });
  setInterval(() => { if (state.user && navigator.onLine) requireAccount().catch(() => {}); }, 60000);
}
