import { describe, expect, it } from 'vitest';
import { createSupabaseBrowserClient, getSupabaseBrowserConfig } from './supabaseClient';

function env(values: Record<string, string> = {}): ImportMetaEnv {
  return values as ImportMetaEnv;
}

describe('Supabase browser client', () => {
  it('falls back safely when browser env variables are missing', async () => {
    const status = getSupabaseBrowserConfig(env());

    expect(status.connected).toBe(false);
    expect(status.reason).toContain('Local-only gameplay can still run');
    await expect(createSupabaseBrowserClient(env())).resolves.toBeNull();
  });

  it('creates a browser client from public Supabase configuration', async () => {
    const client = await createSupabaseBrowserClient(env({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example'
    }));

    expect(client).not.toBeNull();
    expect(client?.supabaseUrl).toBe('https://example.supabase.co');
  });

  it('rejects malformed Supabase project URLs', async () => {
    await expect(createSupabaseBrowserClient(env({
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example'
    }))).resolves.toBeNull();
  });
});

