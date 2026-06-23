import { describe, expect, it } from 'vitest';
import { createInviteLink, parseInviteLink } from './inviteLinks';

describe('invite links', () => {
  it('creates invite links for valid room codes', () => {
    const invite = createInviteLink('ABCD23', { origin: 'https://dtfseeds.com' });

    expect(invite.roomCode).toBe('ABCD23');
    expect(invite.url).toBe('https://dtfseeds.com/games/high-land/?room=ABCD23');
  });

  it('parses and normalizes valid invite room codes', () => {
    expect(parseInviteLink('https://dtfseeds.com/games/high-land/?room=abcd23')).toBe('ABCD23');
  });

  it('returns null for unsupported invite room codes', () => {
    expect(parseInviteLink('https://dtfseeds.com/games/high-land/?room=O0I1')).toBeNull();
  });
});
