import { gameAssetPath } from './assetPath';

const audioFiles = {
  background: 'assets/high-land/audio/background-loop.mp3',
  roll: 'assets/high-land/audio/dice-roll.mp3',
  card: 'assets/high-land/audio/card-draw.mp3',
  move: 'assets/high-land/audio/move-tick.mp3',
  win: 'assets/high-land/audio/win.mp3'
} as const;

let muted = false;
let backgroundMusic: HTMLAudioElement | null = null;
const activeEffects = new Set<HTMLAudioElement>();

function createAudio(path: string, volume: number): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;

  const audio = new Audio(gameAssetPath(path));
  audio.preload = 'auto';
  audio.volume = volume;
  audio.muted = muted;
  return audio;
}

function safelyPlay(audio: HTMLAudioElement, onFailure?: () => void): void {
  try {
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => onFailure?.());
    }
  } catch {
    onFailure?.();
  }
}

function playEffect(path: string, volume: number): void {
  if (muted) return;
  const audio = createAudio(path, volume);
  if (!audio) return;

  const release = () => activeEffects.delete(audio);
  audio.addEventListener?.('ended', release, { once: true });
  audio.addEventListener?.('error', release, { once: true });
  activeEffects.add(audio);
  safelyPlay(audio, release);
}

export function startBackgroundMusic(): void {
  if (muted) return;

  if (!backgroundMusic) {
    backgroundMusic = createAudio(audioFiles.background, 0.2);
    if (!backgroundMusic) return;
    backgroundMusic.loop = true;
  }

  backgroundMusic.muted = false;
  safelyPlay(backgroundMusic);
}

export function setMuted(value: boolean): void {
  muted = value;

  if (backgroundMusic) {
    backgroundMusic.muted = value;
    if (value) backgroundMusic.pause();
  }

  activeEffects.forEach((audio) => {
    audio.muted = value;
    if (value) {
      audio.pause();
      audio.currentTime = 0;
    }
  });

  if (value) activeEffects.clear();
}

export function isMuted(): boolean {
  return muted;
}

export function playRollSound(): void {
  startBackgroundMusic();
  playEffect(audioFiles.roll, 0.72);
}

export function playCardSound(): void {
  playEffect(audioFiles.card, 0.62);
}

export function playMoveTickSound(): void {
  playEffect(audioFiles.move, 0.34);
}

export function playWinSound(): void {
  backgroundMusic?.pause();
  playEffect(audioFiles.win, 0.8);
}
