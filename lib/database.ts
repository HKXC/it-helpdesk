import type { DataStore } from './data-store';
import { createSupabaseStore } from './supabase-store';

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, secret };
}

export function databaseInfo() {
  const { url, secret } = supabaseConfig();
  return { provider: 'supabase', configured: Boolean(url && secret) };
}

export function database(): DataStore {
  const { url, secret } = supabaseConfig();
  if (!url || !secret) throw Error('Supabase configuration incomplete');
  return createSupabaseStore(url, secret);
}
