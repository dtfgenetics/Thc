import assert from 'node:assert/strict';
import {
  DEFAULT_GAME_SETTINGS,
  createGameSettingsStore,
  effectiveAudioGain,
  createReplayRecorder,
  parseReplayBundle,
  serializeReplayBundle,
  createTelemetryBuffer,
  validateTelemetryEvent,
  createInputActionMap,
  createGameAudioManager,
} from '../src/index.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function eventTarget() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, listener) { handlers.set(type, listener); },
    removeEventListener(type, listener) { if (handlers.get(type) === listener) handlers.delete(type); },
  };
}

class FakeAudioParam {
  constructor() { this.value = 1; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeAudioNode {
  constructor() { this.connected = []; }
  connect(target) { this.connected.push(target); return target; }
  disconnect() { this.connected = []; }
}

class FakeOscillator extends FakeAudioNode {
  constructor() {
    super();
    this.frequency = new FakeAudioParam();
    this.type = 'sine';
    this.listeners = new Map();
  }
  start() {}
  stop() { this.listeners.get('ended')?.(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 1;
    this.destination = new FakeAudioNode();
  }
  async resume() { this.state = 'running'; }
  createGain() { const node = new FakeAudioNode(); node.gain = new FakeAudioParam(); return node; }
  createOscillator() { return new FakeOscillator(); }
  async close() { this.state = 'closed'; }
}

{
  const storage = memoryStorage();
  const store = createGameSettingsStore({ gameId: 'test-game', storage });
  assert.equal(store.get().masterVolume, DEFAULT_GAME_SETTINGS.masterVolume);
  store.update({ masterVolume: 2, musicVolume: -1, uiScale: 9, reducedMotion: 'on' });
  assert.equal(store.get().masterVolume, 1);
  assert.equal(store.get().musicVolume, 0);
  assert.equal(store.get().uiScale, 1.35);
  assert.equal(store.resolveAccessibility(() => ({ matches: false })).reducedMotion, true);
  assert.equal(effectiveAudioGain({ ...store.get(), muted: true }, 'music'), 0);

  const reloaded = createGameSettingsStore({ gameId: 'test-game', storage });
  assert.deepEqual(reloaded.get(), store.get());
  reloaded.reset();
  assert.deepEqual(reloaded.get(), DEFAULT_GAME_SETTINGS);
}

{
  let tick = 1000;
  const recorder = createReplayRecorder({
    gameId: 'test-game',
    releaseVersion: '1.2.3',
    seedOrCode: 'ABC123',
    saveVersion: 2,
    now: () => tick,
    client: { viewport: '390x844', inputMode: 'touch' },
  });
  tick += 16;
  recorder.record('start');
  tick += 24;
  recorder.record('move', { direction: 'left', value: 2, strainName: 'Blue Mango' });
  recorder.setStateSnapshot({ round: 1, score: 4, cardName: 'Keeper Cut' });
  recorder.setResult({ completed: false });
  tick += 10;
  const text = serializeReplayBundle(recorder.exportBundle());
  const parsed = parseReplayBundle(text, { expectedGameId: 'test-game' });
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[1].atMs, 40);
  assert.equal(parsed.actions[1].payload.strainName, 'Blue Mango');
  assert.equal(parsed.state.cardName, 'Keeper Cut');
  assert.equal(parsed.client.inputMode, 'touch');

  assert.throws(() => recorder.record('unsafe', { authToken: 'do-not-export' }), /forbidden\/private fields/);
  assert.throws(() => recorder.setStateSnapshot({ playerName: 'private identity' }), /forbidden\/private fields/);
}

{
  let tick = 500;
  const telemetry = createTelemetryBuffer({ gameId: 'test-game', releaseVersion: '1.2.3', now: () => tick });
  assert.equal(telemetry.track('game_start'), null, 'telemetry must be disabled by default');
  telemetry.setEnabled(true);
  tick += 20;
  const event = telemetry.track('game_start', { difficulty: 'medium', strainName: 'Blue Mango', familyName: 'Fruit' });
  assert.equal(event.atMs, 20);
  assert.equal(event.payload.strainName, 'Blue Mango');
  assert.equal(validateTelemetryEvent(event).valid, true);
  assert.throws(() => telemetry.track('game_complete', { playerEmail: 'private@example.com' }), /private fields/);
  assert.throws(() => telemetry.track('game_complete', { playerName: 'private identity' }), /private fields/);

  const batches = [];
  const flushResult = await telemetry.flush(async (batch) => batches.push(batch));
  assert.equal(flushResult.sent, 1);
  assert.equal(batches[0][0].name, 'game_start');
  assert.equal(telemetry.peek().length, 0);
}

{
  const target = eventTarget();
  const input = createInputActionMap({ actionMap: { confirm: ['KeyX'] }, target });
  const events = [];
  input.subscribe('confirm', (event) => events.push(event));
  assert.equal(input.attach(), true);
  let prevented = false;
  target.handlers.get('keydown')({ code: 'KeyX', repeat: false, target: {}, preventDefault() { prevented = true; } });
  target.handlers.get('keyup')({ code: 'KeyX', repeat: false, target: {}, preventDefault() {} });
  assert.equal(prevented, true);
  assert.equal(events.length, 2);
  assert.equal(events[0].phase, 'press');
  assert.equal(events[1].phase, 'release');
  input.trigger('confirm', { source: 'touch' });
  assert.equal(events.at(-1).source, 'touch');
  input.setEnabled(false);
  assert.equal(input.trigger('confirm'), false);
  assert.equal(input.detach(), true);
}

{
  const storage = memoryStorage();
  const store = createGameSettingsStore({ gameId: 'audio-test', storage });
  const audio = createGameAudioManager({ settingsStore: store, AudioContextClass: FakeAudioContext });
  assert.equal(audio.isUnlocked(), false);
  assert.equal(audio.playTone(), false, 'audio must not play before explicit unlock');
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.contextState(), 'running');
  assert.equal(audio.playTone({ category: 'music', frequency: 440 }), true);
  store.update({ muted: true });
  assert.equal(effectiveAudioGain(store.get(), 'music'), 0);
  await audio.close();
  assert.equal(audio.contextState(), 'unavailable');
}

console.log('shared game platform runtime tests passed');
