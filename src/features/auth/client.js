import { createClient } from '@supabase/supabase-js';
let client;
// Snapshot before Supabase consumes callback credentials.
const callbackUrl = new URL(location.href);
const callbackHash = new URLSearchParams(callbackUrl.hash.slice(1));
export const authCallback = {
  kind: callbackUrl.searchParams.get('account') || callbackHash.get('type'),
  credentials: callbackUrl.searchParams.has('code') || callbackHash.has('access_token'),
  pkce: callbackUrl.searchParams.has('code'),
  error: callbackUrl.searchParams.get('error') || callbackHash.get('error') || callbackUrl.searchParams.get('error_code') || callbackHash.get('error_code')
};
export function cleanAuthCallback() {
  const url = new URL(location.href);
  for (const key of ['account', 'code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
  if (callbackHash.has('access_token') || callbackHash.has('error') || callbackHash.has('error_code')) url.hash = '';
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
export function getAccountClient() {
  if (client) return client;
  const config = window.APP_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) return null;
  client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });
  return client;
}
export function accountRedirect() { return location.origin + location.pathname; }
