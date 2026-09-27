import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeHowl {
  static instances: FakeHowl[] = [];
  static options: any[] = [];

  play = vi.fn(() => 1);
  pause = vi.fn(() => this);
  stop = vi.fn(() => this);
  mute = vi.fn(() => this);
  volume = vi.fn(() => this);
  playing = vi.fn(() => false);
  unload = vi.fn();

  constructor(options: any) {
    FakeHowl.instances.push(this);
    FakeHowl.options.push(options);
  }
}

const howlerMute = vi.fn();

describe('file-backed audio system', () => {
  beforeEach(() => {
    FakeHowl.instances = [];
    FakeHowl.options = [];
    howlerMute.mockReset();
    vi.resetModules();
    vi.stubGlobal('window', {
      Howl: FakeHowl,
      Howler: { mute: howlerMute }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not instantiate audio before a user-triggered call', async () => {
    await import('./audioSystem');
    expect(FakeHowl.instances).toHaveLength(0);
  });

  it('uses the real High Land music and SFX files with a looping background track', async () => {
    const audio = await import('./audioSystem');

    audio.playRollSound();
    audio.playCardSound();
    audio.playMoveTickSound();
    audio.playWinSound();

    expect(FakeHowl.options.map((options) => options.src[0])).toEqual([
      '/assets/high-land/audio/background-loop.mp3',
      '/assets/high-land/audio/dice-roll.mp3',
      '/assets/high-land/audio/card-draw.mp3',
      '/assets/high-land/audio/move-tick.mp3',
      '/assets/high-land/audio/win.mp3'
    ]);
    expect(FakeHowl.options[0].loop).toBe(true);
    expect(FakeHowl.options[0].volume).toBe(0.2);
    expect(FakeHowl.instances.every((instance) => instance.play.mock.calls.length >= 1)).toBe(true);
  });

  it('reuses effect pools instead of allocating a new audio object for every play', async () => {
    const audio = await import('./audioSystem');

    audio.playCardSound();
    audio.playCardSound();
    audio.playCardSound();

    const cardHowls = FakeHowl.options.filter((options) => options.src[0].includes('card-draw'));
    expect(cardHowls).toHaveLength(1);
    expect(FakeHowl.instances[0].play).toHaveBeenCalledTimes(3);
  });

  it('uses Howler global mute and stops active effects', async () => {
    const audio = await import('./audioSystem');

    audio.playRollSound();
    audio.playMoveTickSound();
    audio.setMuted(true);

    expect(audio.isMuted()).toBe(true);
    expect(howlerMute).toHaveBeenCalledWith(true);
    expect(FakeHowl.instances.slice(1).every((instance) => instance.stop.mock.calls.length === 1)).toBe(true);

    const count = FakeHowl.instances.length;
    audio.playCardSound();
    expect(FakeHowl.instances).toHaveLength(count);
  });

  it('degrades safely if the vendored Howler runtime is unavailable', async () => {
    vi.stubGlobal('window', { Howl: undefined, Howler: undefined });
    const audio = await import('./audioSystem');

    expect(() => audio.playRollSound()).not.toThrow();
    expect(() => audio.playCardSound()).not.toThrow();
    expect(() => audio.playMoveTickSound()).not.toThrow();
    expect(() => audio.playWinSound()).not.toThrow();
  });
});
