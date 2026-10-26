// Only whitelisted learning records enter the account cache or cloud outbox.
const ALLOWED = /^(cts:(progress:|history:|weak|speed:)|gp:(pron:|dailyGoal$|daily$|streak$|bestScore$|lbGame$|lbStudy$|lbSeed$)|gopinyin:game:)/;
let owner = null, client = null, records = {}, generation = 0, timer, inflight;
let datasetLoader = async () => [], conflictResolver = async () => 'cancel', status = 'guest';
const listeners = new Set();
function report(value) { status = value; window.dispatchEvent(new CustomEvent('gp:sync', { detail: value })); }
export function syncStatus() { return status; }
export function dataOwner() { return owner; }
export function onDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setDatasetLoader(fn) { datasetLoader = fn; }
export function setConflictResolver(fn) { conflictResolver = fn; }
const keyOf = (kind, id) => JSON.stringify([kind, id]);
const cacheKey = uid => 'gp:account-cache:' + uid;
function persist() {
  if (!owner) return;
  try { localStorage.setItem(cacheKey(owner), JSON.stringify(records)); }
  catch { report('error'); throw new Error('Không lưu được bản dự phòng trên máy. Kiểm tra dung lượng trình duyệt và thử đồng bộ lại.'); }
}
function notify() { for (const fn of listeners) fn(); }
export function readRecord(kind, id) {
  const r = records[keyOf(kind, id)];
  return !r || r.deleted ? null : structuredClone(r.payload);
}
export function listRecords(kind) {
  return Object.values(records).filter(r => r.kind === kind && !r.deleted).map(r => structuredClone(r.payload));
}
export function writeRecord(kind, id, payload, deleted = false) {
  if (!owner) return;
  const key = keyOf(kind, id), old = records[key];
  records[key] = { kind, record_id: id, payload, deleted, version: old?.version || 0, dirty: true, edit: (old?.edit || 0) + 1 };
  persist(); report(navigator.onLine ? 'pending' : 'offline'); clearTimeout(timer);
  timer = setTimeout(() => flushAccountData().catch(() => {}), 200);
}
export const learningStorage = {
  getItem(key) { return readRecord('kv', key); },
  setItem(key, value) { if (ALLOWED.test(key)) writeRecord('kv', key, String(value)); },
  removeItem(key) { if (ALLOWED.test(key)) writeRecord('kv', key, null, true); },
  key(index) { return Object.values(records).filter(r => r.kind === 'kv' && !r.deleted)[index]?.record_id || null; },
  get length() { return Object.values(records).filter(r => r.kind === 'kv' && !r.deleted).length; }
};
export function detachAccountData() {
  generation++; clearTimeout(timer); owner = null; client = null; records = {}; inflight = null;
  report('guest'); notify();
}
export async function attachAccountData(uid, connection) {
  detachAccountData(); owner = uid; client = connection;
  try { records = JSON.parse(localStorage.getItem(cacheKey(uid)) || '{}'); } catch { records = {}; }
  await pullAccountData(); await flushAccountData(); notify();
}
async function reconcile(remote, epoch, fromConflict = false) {
  const key = keyOf(remote.kind, remote.record_id), local = records[key];
  if (!fromConflict && local && local.version > remote.version) return; // A stale pull cannot roll back an acknowledged save.
  let remoteChosen = false;
  if (local?.dirty && local.version !== remote.version) {
    report('conflict'); const choice = await conflictResolver({ local: structuredClone(local), remote });
    if (epoch !== generation) return;
    if (choice === 'local') { local.version = remote.version; return; }
    if (choice !== 'remote') throw new Error('Cần giải quyết xung đột trước khi tiếp tục.');
    remoteChosen = true;
  } else if (local?.dirty) return;
  records[key] = { ...remote, dirty: false };
  if (remoteChosen) window.dispatchEvent(new CustomEvent('gp:remote-record', { detail: remote.record_id }));
}
export async function pullAccountData() {
  if (!owner || !client) return;
  if (!navigator.onLine) { report('offline'); throw new Error('Cần kết nối mạng để đồng bộ.'); }
  const epoch = generation; report('loading');
  try {
    let offset = 0;
    while (true) {
      const { data, error } = await client.from('learning_records').select('*').eq('user_id', owner).order('kind').order('record_id').range(offset, offset + 499);
      if (error) throw error;
      if (epoch !== generation) return;
      for (const remote of data) await reconcile(remote, epoch);
      if (data.length < 500) break;
      offset += 500;
    }
    if (epoch !== generation) return;
    persist(); report(Object.values(records).some(r => r.dirty) ? 'pending' : 'saved'); notify();
  } catch (error) { if (epoch === generation) report('error'); throw error; }
}
export async function flushAccountData() {
  if (inflight) return inflight;
  if (!owner || !client) return;
  const epoch = generation, connection = client;
  const operation = (async () => {
    if (!navigator.onLine) { report('offline'); throw new Error('Chưa có mạng; thay đổi được giữ trên thiết bị.'); }
    report('saving');
    while (epoch === generation && Object.values(records).some(r => r.dirty)) {
    for (const key of Object.keys(records)) {
      let row = records[key];
      while (row?.dirty && epoch === generation) {
        const sent = structuredClone(row);
        const { data, error } = await connection.rpc('put_learning_record', {
          p_kind: sent.kind, p_record_id: sent.record_id, p_payload: sent.payload,
          p_expected_version: sent.version, p_deleted: sent.deleted
        });
        if (error) throw error;
        if (epoch !== generation) return;
        if (data.conflict) { await reconcile(data.record || { ...sent, payload:null, deleted:true, version:0 }, epoch, true); row = records[key]; continue; }
        row = records[key];
        if (row.edit === sent.edit) records[key] = { ...data.record, dirty: false };
        else row.version = data.record.version;
        persist(); row = records[key];
      }
    }
    }
    if (epoch === generation) { report('saved'); notify(); }
  })();
  inflight = operation;
  try { await operation; }
  catch (error) { if (epoch === generation) report('error'); throw error; }
  finally { if (inflight === operation) inflight = null; }
}
export async function synchronizeAccountData() { await flushAccountData(); await pullAccountData(); await flushAccountData(); }
export async function hasLegacyData() {
  if (Object.keys(localStorage).some(k => ALLOWED.test(k))) return true;
  return (await datasetLoader()).length > 0;
}
export async function importLegacyData() {
  if (!owner) throw new Error('Cần đăng nhập.');
  const epoch = generation;
  for (const key of Object.keys(localStorage)) {
    if (ALLOWED.test(key) && !records[keyOf('kv', key)]) learningStorage.setItem(key, localStorage.getItem(key));
  }
  for (const ds of await datasetLoader()) {
    if (epoch !== generation) throw new Error('Tài khoản đã thay đổi.');
    if (!records[keyOf('dataset', ds.id)]) {
      const value = structuredClone(ds); if (value.builtin) delete value.rows;
      writeRecord('dataset', ds.id, value);
    }
  }
  await flushAccountData();
}
