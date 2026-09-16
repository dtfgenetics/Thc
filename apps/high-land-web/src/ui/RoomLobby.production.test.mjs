import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./RoomLobby.tsx', import.meta.url), 'utf8');

describe('High Land room invite handoff', () => {
  it('reports successful invite copy and preserves a manual fallback', () => {
    expect(source).toContain("type CopyState = 'idle' | 'copied' | 'manual'");
    expect(source).toContain('navigator.clipboard.writeText(inviteUrl)');
    expect(source).toContain('inviteInputRef.current?.select()');
    expect(source).toContain("setCopyState('manual')");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('Invite link copied.');
    expect(source).toContain('Automatic copy is unavailable.');
  });

  it('keeps host start authorization and room capacity messaging intact', () => {
    expect(source).toContain('canStartRoom(room, localPlayerId)');
    expect(source).toContain('room.players.length >= maxPlayers');
    expect(source).toContain('Need at least 2 players before the host can start.');
    expect(source).toContain('Only the host can start the room.');
  });
});
