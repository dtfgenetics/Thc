import { describe, expect, it, vi } from 'vitest';
import { defaultWebsiteRoomApiBase } from './websiteRoomApi';

describe('website room api base', () => {
  it('uses the High Land api folder on the live route', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land/') as unknown as Location);
    expect(defaultWebsiteRoomApiBase()).toBe('https://dtfseeds.com/games/high-land/api/');
    vi.unstubAllGlobals();
  });

  it('uses the same api folder when the live route has no trailing slash', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land') as unknown as Location);
    expect(defaultWebsiteRoomApiBase()).toBe('https://dtfseeds.com/games/high-land/api/');
    vi.unstubAllGlobals();
  });
});
