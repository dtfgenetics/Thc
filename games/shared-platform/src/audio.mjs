import { effectiveAudioGain, normalizeGameSettings } from './settings.mjs';

export function createGameAudioManager({
  settingsStore,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  if (!settingsStore?.get || !settingsStore?.subscribe) {
    throw new Error('settingsStore with get() and subscribe() is required');
  }

  let context = null;
  let unlocked = false;
  const categoryGains = new Map();
  const activeNodes = new Set();
  let unsubscribeSettings = null;

  function ensureContext() {
    if (context) return context;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    return context;
  }

  async function unlock() {
    const audioContext = ensureContext();
    if (!audioContext) return false;
    try {
      if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
        await audioContext.resume();
      }
      unlocked = audioContext.state === 'running' || audioContext.state === 'interrupted';
      syncVolumes();
      return unlocked;
    } catch {
      return false;
    }
  }

  function getCategoryNode(category = 'sfx') {
    const audioContext = ensureContext();
    if (!audioContext) return null;
    if (!categoryGains.has(category)) {
      const gain = audioContext.createGain();
      gain.connect(audioContext.destination);
      categoryGains.set(category, gain);
    }
    return categoryGains.get(category);
  }

  function syncVolumes() {
    const settings = normalizeGameSettings(settingsStore.get());
    for (const [category, gain] of categoryGains.entries()) {
      const value = effectiveAudioGain(settings, category);
      try {
        gain.gain.setValueAtTime(value, context?.currentTime ?? 0);
      } catch {
        gain.gain.value = value;
      }
    }
  }

  function connect(node, category = 'sfx') {
    const target = getCategoryNode(category);
    if (!target || !node?.connect) return false;
    node.connect(target);
    activeNodes.add(node);
    return true;
  }

  function disconnect(node) {
    if (!node) return false;
    try { node.disconnect(); } catch {}
    activeNodes.delete(node);
    return true;
  }

  function playTone({ frequency = 240, durationMs = 50, category = 'sfx', gain = 0.04, type = 'sine' } = {}) {
    if (!unlocked) return false;
    const audioContext = ensureContext();
    if (!audioContext) return false;
    const oscillator = audioContext.createOscillator();
    const localGain = audioContext.createGain();
    const now = audioContext.currentTime;
    const duration = Math.max(0.01, Number(durationMs) / 1000);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Number(frequency) || 240, now);
    localGain.gain.setValueAtTime(Math.max(0.0001, Number(gain) || 0.04), now);
    localGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(localGain);
    connect(localGain, category);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.addEventListener?.('ended', () => {
      disconnect(localGain);
      try { oscillator.disconnect(); } catch {}
    }, { once: true });
    return true;
  }

  function stopAll() {
    for (const node of [...activeNodes]) disconnect(node);
  }

  async function close() {
    stopAll();
    unsubscribeSettings?.();
    unsubscribeSettings = null;
    if (context?.close) {
      try { await context.close(); } catch {}
    }
    context = null;
    unlocked = false;
  }

  unsubscribeSettings = settingsStore.subscribe(syncVolumes);

  return {
    unlock,
    ensureContext,
    connect,
    disconnect,
    playTone,
    stopAll,
    syncVolumes,
    close,
    isUnlocked: () => unlocked,
    contextState: () => context?.state ?? 'unavailable',
  };
}
