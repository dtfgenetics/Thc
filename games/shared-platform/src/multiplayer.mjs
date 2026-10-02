function requireFn(adapter, name) {
  if (typeof adapter?.[name] !== 'function') throw new Error(`multiplayer adapter must implement ${name}()`);
}

export function validateMultiplayerAdapter(adapter) {
  const errors = [];
  for (const name of ['connect','createRoom','joinRoom','leaveRoom','reconnect','sendAction','subscribeState']) {
    if (typeof adapter?.[name] !== 'function') errors.push(`missing ${name}()`);
  }
  if (!Number.isInteger(adapter?.protocolVersion) || adapter.protocolVersion < 1) {
    errors.push('protocolVersion must be an integer >= 1');
  }
  if (!adapter?.transport || typeof adapter.transport !== 'string') {
    errors.push('transport must be a non-empty string');
  }
  return { valid: errors.length === 0, errors };
}

export function createMultiplayerClient({
  adapter,
  gameId,
  onStatus = null,
} = {}) {
  if (!gameId || typeof gameId !== 'string') throw new Error('gameId is required');
  const validation = validateMultiplayerAdapter(adapter);
  if (!validation.valid) throw new Error(`invalid multiplayer adapter: ${validation.errors.join(', ')}`);

  let status = 'idle';
  let room = null;
  let player = null;

  function setStatus(next, detail = {}) {
    status = next;
    onStatus?.({ gameId, status: next, room, player, ...detail });
  }

  async function connect(options = {}) {
    setStatus('connecting');
    try {
      const result = await adapter.connect(options);
      setStatus('connected');
      return result;
    } catch (error) {
      setStatus('error', { phase: 'connect', error: String(error?.message || error) });
      throw error;
    }
  }

  async function createRoom(options = {}) {
    setStatus('joining');
    const result = await adapter.createRoom(options);
    room = result?.room ?? result ?? null;
    player = result?.player ?? player;
    setStatus('joined');
    return result;
  }

  async function joinRoom(code, options = {}) {
    setStatus('joining');
    const result = await adapter.joinRoom(code, options);
    room = result?.room ?? result ?? null;
    player = result?.player ?? player;
    setStatus('joined');
    return result;
  }

  async function reconnect(token, options = {}) {
    setStatus('reconnecting');
    const result = await adapter.reconnect(token, options);
    room = result?.room ?? room;
    player = result?.player ?? player;
    setStatus('joined');
    return result;
  }

  async function leaveRoom(options = {}) {
    await adapter.leaveRoom(options);
    room = null;
    player = null;
    setStatus('connected');
  }

  function sendAction(type, payload = {}) {
    if (status !== 'joined') throw new Error('cannot send multiplayer action while not joined');
    if (!type || typeof type !== 'string') throw new Error('action type is required');
    return adapter.sendAction(type, payload);
  }

  function subscribeState(listener) {
    if (typeof listener !== 'function') throw new Error('state listener must be a function');
    return adapter.subscribeState(listener);
  }

  return {
    gameId,
    transport: adapter.transport,
    protocolVersion: adapter.protocolVersion,
    connect,
    createRoom,
    joinRoom,
    reconnect,
    leaveRoom,
    sendAction,
    subscribeState,
    status: () => status,
    room: () => room,
    player: () => player,
  };
}
