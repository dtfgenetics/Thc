import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  static instances: FakeAudio[] = [];

  currentTime = 0;
  loop = false;
  muted = false;
  pause = vi.fn();
  play = vi.fn(() => Promise.resolve());
  preload = '';
  volume = 1;

  constructor(public readonly src: string) {
    FakeAudio.instances.push(this);
  }

  addEventListener(): void {}
}

describe('file-backed audio system', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.resetModules();
    vi.stubGlobal('Audio', FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not create or play audio before a user-triggered call', async () => {
    await import('./audioSystem');
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('plays the background loop and real roll, card, movement, and win files', async () => {
    const audio = await import('./audioSystem');

    audio.playRollSound();
    audio.playCardSound();
    audio.playMoveTickSound();
    audio.playWinSound();

    expect(FakeAudio.instances.map((instance) => instance.src)).toEqual([
      '/assets/high-land/audio/background-loop.mp3',
      '/assets/high-land/audio/dice-roll.mp3',
      '/assets/high-land/audio/card-draw.mp3',
      '/assets/high-land/audio/move-tick.mp3',
      '/assets/high-land/audio/win.mp3'
    ]);
    expect(FakeAudio.instances[0].loop).toBe(true);
    expect(FakeAudio.instances.every((instance) => instance.play.mock.calls.length === 1)).toBe(true);
  });

  it('mutes and pauses all active audio', async () => {
    const audio = await import('./audioSystem');

    audio.playRollSound();
    audio.playMoveTickSound();
    audio.setMuted(true);

    expect(audio.isMuted()).toBe(true);
    expect(FakeAudio.instances.every((instance) => instance.muted)).toBe(true);
    expect(FakeAudio.instances.every((instance) => instance.pause.mock.calls.length === 1)).toBe(true);

    const instanceCount = FakeAudio.instances.length;
    audio.playCardSound();
    expect(FakeAudio.instances).toHaveLength(instanceCount);
  });

  it('does not throw when the browser Audio API is unavailable', async () => {
    vi.stubGlobal('Audio', undefined);
    const audio = await import('./audioSystem');

    expect(() => audio.playRollSound()).not.toThrow();
    expect(() => audio.playCardSound()).not.toThrow();
    expect(() => audio.playMoveTickSound()).not.toThrow();
    expect(() => audio.playWinSound()).not.toThrow();
  });
});
