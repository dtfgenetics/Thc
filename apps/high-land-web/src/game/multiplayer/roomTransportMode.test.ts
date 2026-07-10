import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDefaultRoomTransportMode } from './roomTransportFactory';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('room transport mode defaults', () => {
  it('uses website mode on the existing dtfseeds High Land route', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land/') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('website');
  });

  it('uses the authoritative server transport on the dtf420 game hub', () => {
    vi.stubGlobal('location', new URL('https://dtf420.com/games/high-land/') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('server');
  });

  it('honors transport query override', () => {
    vi.stubGlobal('location', new URL('https://dtf420.com/games/high-land/?transport=offline') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('offline');
  });

  it('uses local mode outside the live routes when no API is configured', () => {
    vi.stubGlobal('location', new URL('http://localhost:5173/games/high-land/') as unknown as Location);
    expect(resolveDefaultRoomTransportMode()).toBe('local');
  });
});
