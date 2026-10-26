import { getAccountClient } from './client.js';
import { currentUser, refreshProfile } from './service.js';

export function avatarUrl(path) {
  if (!path || !/^[a-f0-9-]+\/[a-zA-Z0-9.-]+$/.test(path)) return '';
  return getAccountClient()?.storage.from('avatars').getPublicUrl(path).data.publicUrl || '';
}
export async function prepareAvatar(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Chọn ảnh JPEG, PNG hoặc WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Không đọc được ảnh này.'); }
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 256, 256);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob || blob.size > 262144) throw new Error('Không nén được ảnh. Vui lòng chọn ảnh khác.');
    return blob;
  } finally { bitmap.close(); }
}
export async function saveProfile(name, avatarChange) {
  const user = currentUser(), c = getAccountClient();
  name = String(name).trim();
  if (!user || !c || !navigator.onLine) throw new Error('Cần đăng nhập và có mạng.');
  if (!name || [...name].length > 50) throw new Error('Tên cần từ 1–50 ký tự.');
  let path = user.avatarPath || null, uploaded;
  if (avatarChange instanceof Blob) {
    path = user.id + '/' + crypto.randomUUID() + '.webp';
    const { error } = await c.storage.from('avatars').upload(path, avatarChange, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    uploaded = path;
  } else if (avatarChange === null) path = null;
  const { error } = await c.from('profiles').update({ display_name: name, avatar_path: path }).eq('id', user.id);
  if (error) { if (uploaded) await c.storage.from('avatars').remove([uploaded]); throw error; }
  if (user.avatarPath && path !== user.avatarPath) await c.storage.from('avatars').remove([user.avatarPath]);
  await refreshProfile();
}
