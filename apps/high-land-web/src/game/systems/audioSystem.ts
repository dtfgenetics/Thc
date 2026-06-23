let context: AudioContext | null = null;
let muted = false;

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getContext(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!context) {
    const audioWindow = window as WindowWithWebkitAudio;
    const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  return context;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

export function playTone(frequency = 440, durationMs = 90): void {
  const audioContext = getContext();
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + durationMs / 1000);
}

export function playRollSound(): void {
  playTone(220, 70);
  if (typeof window === 'undefined') return;
  window.setTimeout(() => playTone(330, 70), 75);
  window.setTimeout(() => playTone(440, 70), 150);
}

export function playCardSound(): void {
  playTone(660, 110);
}

export function playWinSound(): void {
  playTone(523, 120);
  if (typeof window === 'undefined') return;
  window.setTimeout(() => playTone(659, 120), 130);
  window.setTimeout(() => playTone(784, 180), 260);
}
