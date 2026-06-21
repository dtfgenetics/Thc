import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game/types/gameTypes';
import {
  clearRoomCredentials,
  commitRoomState,
  createRoom,
  inspectRoom,
  joinRoom,
  loadRoomCredentials,
  normalizeGameId,
  reconnectRoom,
  RoomApiError,
  saveRoomCredentials,
  startRoom
} from './roomClient';
import type { ConnectionStatus, InviteStatus, RoomCredentials, RoomSnapshot } from './roomTypes';
import { mergeRoomSnapshot } from './roomSync';

const pollIntervalMs = 1_000;

export function useHighLandRoom() {
  const rawInviteId = new URLSearchParams(window.location.search).get('game');
  const inviteGameId = normalizeGameId(rawInviteId);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(() =>
    inviteGameId ? loadRoomCredentials(inviteGameId) : null
  );
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(inviteGameId ? 'connecting' : 'idle');
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>(rawInviteId ? 'checking' : 'none');
  const [error, setError] = useState<string | null>(
    rawInviteId && !inviteGameId ? 'This game invite could not be found. Create a new High Land game.' : null
  );
  const [actionPending, setActionPending] = useState(false);
  const roomRef = useRef<RoomSnapshot | null>(null);
  roomRef.current = room;

  const acceptResponse = useCallback((nextRoom: RoomSnapshot, nextCredentials?: RoomCredentials) => {
    setRoom((current) => mergeRoomSnapshot(current, nextRoom));
    setConnectionStatus('connected');
    setInviteStatus(nextRoom.players.length >= nextRoom.maxPlayers ? 'full' : 'joinable');
    setError(null);
    if (nextCredentials) {
      saveRoomCredentials(nextCredentials);
      setCredentials(nextCredentials);
    }
  }, []);

  const handleError = useCallback((caught: unknown) => {
    const roomError = caught instanceof RoomApiError
      ? caught
      : new RoomApiError('Connection failed. You can still play High Land locally.');
    if (roomError.room) setRoom(roomError.room);
    if (roomError.code === 'reconnect_failed' && inviteGameId) {
      clearRoomCredentials(inviteGameId);
      setCredentials(null);
    }
    setConnectionStatus(roomError.code === 'not_found' || roomError.code === 'room_full' ? 'idle' : 'offline');
    setInviteStatus(roomError.code === 'not_found' ? 'invalid' : roomError.code === 'room_full' ? 'full' : 'joinable');
    setError(roomError.message);
  }, [inviteGameId]);

  useEffect(() => {
    if (!inviteGameId) return;
    let active = true;

    const connect = async () => {
      try {
        const response = credentials
          ? await reconnectRoom(credentials)
          : await inspectRoom(inviteGameId);
        if (active) acceptResponse(response.room, response.credentials);
      } catch (caught) {
        if (active) handleError(caught);
      }
    };

    void connect();
    return () => { active = false; };
  }, [acceptResponse, credentials, handleError, inviteGameId]);

  useEffect(() => {
    if (!credentials) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await reconnectRoom(credentials);
        if (active) acceptResponse(response.room);
      } catch (caught) {
        if (active) handleError(caught);
      }
    };
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [acceptResponse, credentials, handleError]);

  const create = useCallback(async (name: string) => {
    setActionPending(true);
    setConnectionStatus('connecting');
    try {
      const response = await createRoom(name);
      if (!response.credentials) throw new RoomApiError('The game lobby could not be created.');
      const params = new URLSearchParams(window.location.search);
      params.set('game', response.room.gameId);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      acceptResponse(response.room, response.credentials);
    } catch (caught) {
      handleError(caught);
    } finally {
      setActionPending(false);
    }
  }, [acceptResponse, handleError]);

  const join = useCallback(async (name: string) => {
    if (!inviteGameId) return;
    setActionPending(true);
    setConnectionStatus('connecting');
    try {
      const response = await joinRoom(inviteGameId, name);
      if (!response.credentials) throw new RoomApiError('The game lobby could not be joined.');
      acceptResponse(response.room, response.credentials);
    } catch (caught) {
      handleError(caught);
    } finally {
      setActionPending(false);
    }
  }, [acceptResponse, handleError, inviteGameId]);

  const start = useCallback(async () => {
    if (!credentials) return;
    setActionPending(true);
    try {
      const response = await startRoom(credentials);
      acceptResponse(response.room);
    } catch (caught) {
      handleError(caught);
    } finally {
      setActionPending(false);
    }
  }, [acceptResponse, credentials, handleError]);

  const commit = useCallback(async (gameState: GameState): Promise<boolean> => {
    const currentRoom = roomRef.current;
    if (!credentials || !currentRoom) return false;
    setActionPending(true);
    try {
      const response = await commitRoomState(credentials, currentRoom.version, gameState);
      acceptResponse(response.room);
      return true;
    } catch (caught) {
      handleError(caught);
      return false;
    } finally {
      setActionPending(false);
    }
  }, [acceptResponse, credentials, handleError]);

  const leave = useCallback(() => {
    if (credentials) clearRoomCredentials(credentials.gameId);
    setCredentials(null);
    setRoom(null);
    setConnectionStatus('idle');
    setInviteStatus('none');
    setError(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('game');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [credentials]);

  return {
    inviteGameId,
    inviteStatus,
    credentials,
    room,
    connectionStatus,
    actionPending,
    error,
    create,
    join,
    start,
    commit,
    leave
  };
}
