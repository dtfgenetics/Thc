import { describe, expect, it, vi } from 'vitest';
import { resolveDefaultRoomTransportMode } from './roomTransportFactory';

describe('room transport mode defaults', () => {
  it('uses website mode on dtfseeds High Land route', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land/') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('website');
    vi.unstubAllGlobals();
  });

  it('honors transport query override', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land/?transport=offline') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('offline');
    vi.unstubAllGlobals();
  });

  it('uses local mode outside the live route', () => {
    vi.stubGlobal('location', new URL('http://localhost:5173/games/high-land/') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('local');
    vi.unstubAllGlobals();
  });
});
