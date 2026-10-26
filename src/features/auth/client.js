import { createClient } from '@supabase/supabase-js';
let client;
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
