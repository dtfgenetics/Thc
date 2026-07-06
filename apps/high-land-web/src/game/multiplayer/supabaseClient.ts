import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseClientFactory = (
  url: string,
  publishableKey: string,
  options: { auth: { autoRefreshToken: boolean; persistSession: boolean; detectSessionInUrl: boolean } }
) => SupabaseClient;

export type SupabaseBrowserConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseConfigStatus =
  | { connected: true; config: SupabaseBrowserConfig; reason: null }
  | { connected: false; config: null; reason: string };

export function getSupabaseBrowserConfig(env: ImportMetaEnv = import.meta.env): SupabaseConfigStatus {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return {
      connected: false,
      config: null,
      reason: 'Supabase browser env variables are missing. Local-only gameplay can still run.'
    };
  }

  if (!isLikelySupabaseUrl(url)) {
    return {
      connected: false,
      config: null,
      reason: 'VITE_SUPABASE_URL does not look like a valid Supabase project URL.'
    };
  }

  return {
    connected: true,
    config: {
      url,
      publishableKey
    },
    reason: null
  };
}

export function isLikelySupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('supabase');
  } catch {
    return false;
  }
}

export async function createSupabaseBrowserClient(
  env: ImportMetaEnv = import.meta.env,
  clientFactory?: SupabaseClientFactory
): Promise<SupabaseClient | null> {
  const status = getSupabaseBrowserConfig(env);
  if (!status.connected) return null;

  const createClient = clientFactory ?? (await import('@supabase/supabase-js')).createClient;
  return createClient(status.config.url, status.config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
}

export function getSupabaseInstallNote(): string {
  return 'The guarded Supabase browser client is installed. Live room transport still requires the approved schema and RLS policies.';
}

