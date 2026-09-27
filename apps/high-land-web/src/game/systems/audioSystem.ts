import { gameAssetPath } from './assetPath';

const audioFiles = {
  background: 'assets/high-land/audio/background-loop.mp3',
  roll: 'assets/high-land/audio/dice-roll.mp3',
  card: 'assets/high-land/audio/card-draw.mp3',
  move: 'assets/high-land/audio/move-tick.mp3',
  win: 'assets/high-land/audio/win.mp3'
} as const;

let muted = false;
let backgroundMusic: HighLandHowl | null = null;
const effects = new Map<keyof typeof audioFiles, HighLandHowl>();

function createHowl(path: string, volume: number, loop = false): HighLandHowl | null {
  const Howl = window.Howl;
  if (!Howl) return null;
  return new Howl({
    src: [gameAssetPath(path)],
    volume,
    loop,
    preload: true,
    onplayerror: (id) => {
      try { effects.forEach((sound) => sound.stop(id)); } catch {}
    }
  });
}

function effect(name: Exclude<keyof typeof audioFiles, 'background'>, volume: number): HighLandHowl | null {
  let sound = effects.get(name) || null;
  if (!sound) {
    sound = createHowl(audioFiles[name], volume);
    if (sound) effects.set(name, sound);
  }
  return sound;
}

function play(sound: HighLandHowl | null): void {
  if (muted || !sound) return;
  try { sound.play(); } catch {}
}

export function startBackgroundMusic(): void {
  if (muted) return;
  if (!backgroundMusic) backgroundMusic = createHowl(audioFiles.background, 0.2, true);
  if (!backgroundMusic) return;
  try {
    backgroundMusic.mute(false);
    if (!backgroundMusic.playing()) backgroundMusic.play();
  } catch {}
}

export function setMuted(value: boolean): void {
  muted = value;
  try { window.Howler?.mute(value); } catch {}
  if (value) {
    try { backgroundMusic?.pause(); } catch {}
    effects.forEach((sound) => {
      try { sound.stop(); } catch {}
    });
  }
}

export function isMuted(): boolean {
  return muted;
}

export function playRollSound(): void {
  startBackgroundMusic();
  play(effect('roll', 0.72));
}

export function playCardSound(): void {
  play(effect('card', 0.62));
}

export function playMoveTickSound(): void {
  play(effect('move', 0.34));
}

export function playWinSound(): void {
  try { backgroundMusic?.pause(); } catch {}
  play(effect('win', 0.8));
}

export function unloadAudio(): void {
  try { backgroundMusic?.unload(); } catch {}
  backgroundMusic = null;
  effects.forEach((sound) => {
    try { sound.unload(); } catch {}
  });
  effects.clear();
}
