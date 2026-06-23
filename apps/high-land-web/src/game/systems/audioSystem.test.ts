import { describe, expect, it } from 'vitest';
import { playCardSound, playRollSound, playTone, playWinSound, setMuted } from './audioSystem';

describe('audio system', () => {
  it('does not throw outside the browser', () => {
    setMuted(false);

    expect(() => playTone()).not.toThrow();
    expect(() => playRollSound()).not.toThrow();
    expect(() => playCardSound()).not.toThrow();
    expect(() => playWinSound()).not.toThrow();
  });
});
