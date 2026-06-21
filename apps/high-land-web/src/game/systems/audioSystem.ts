let context: AudioContext | null = null;
let muted = true;
let musicTimer: number | null = null;

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getContext(): AudioContext | null {
  if (muted) return null;
  if (!context) {
    const audioWindow = window as WindowWithWebkitAudio;
    const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (muted) stopBackgroundMusic();
  else startBackgroundMusic();
}

export function isMuted(): boolean {
  return muted;
}

export function playTone(frequency = 440, durationMs = 90, volume = 0.04): void {
  const audioContext = getContext();
  if (!audioContext) return;
  scheduleTone(audioContext, frequency, audioContext.currentTime, durationMs / 1000, volume, 'sine');
}

export function startBackgroundMusic(): void {
  if (muted || musicTimer !== null) return;
  const audioContext = getContext();
  if (!audioContext) return;

  playMusicPhrase(audioContext);
  musicTimer = window.setInterval(() => {
    const activeContext = getContext();
    if (activeContext) playMusicPhrase(activeContext);
  }, 7200);
}

export function stopBackgroundMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function playRollSound(): void {
  playTone(220, 70);
  window.setTimeout(() => playTone(330, 70), 75);
  window.setTimeout(() => playTone(440, 70), 150);
}

export function playCardSound(): void {
  playTone(660, 110);
}

export function playWinSound(): void {
  playTone(523, 120);
  window.setTimeout(() => playTone(659, 120), 130);
  window.setTimeout(() => playTone(784, 180), 260);
}

function playMusicPhrase(audioContext: AudioContext): void {
  const notes = [164.81, 220, 246.94, 220, 196, 246.94];
  const start = audioContext.currentTime + 0.05;
  notes.forEach((frequency, index) => {
    scheduleTone(audioContext, frequency, start + index * 1.05, 1.45, 0.008, index % 2 === 0 ? 'triangle' : 'sine');
  });
}

function scheduleTone(
  audioContext: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType
): void {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}
