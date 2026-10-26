'use strict';
const { createClient } = require('@supabase/supabase-js');
let client;
async function verifyAccount(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) return { status: 401, error: 'Đăng nhập để dùng dịch vụ này.' };
  const url = process.env.SUPABASE_URL || process.env.GOPINYIN_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.GOPINYIN_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: 503, error: 'Server chưa cấu hình dịch vụ tài khoản.' };
  try {
    client ||= createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) }
    });
    const { data, error } = await client.auth.getUser(match[1]);
    if (error && (!error.status || error.status >= 500)) return { status: 503, error: 'Không thể xác minh phiên đăng nhập. Thử lại khi có mạng.' };
    if (error || !data.user?.id || !data.user.email_confirmed_at || data.user.is_anonymous) return { status: 401, error: 'Phiên đăng nhập không hợp lệ hoặc email chưa xác minh.' };
    return { user: data.user };
  } catch { return { status: 503, error: 'Không thể xác minh phiên đăng nhập. Thử lại khi có mạng.' }; }
}
module.exports = { verifyAccount };
