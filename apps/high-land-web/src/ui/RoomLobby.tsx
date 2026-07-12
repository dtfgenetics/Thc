import { useState } from 'react';
import { canStartRoom, type HighLandRoomState } from '../game/multiplayer/roomState';
import { maxPlayers } from '../game/systems/playerSystem';

type RoomLobbyProps = {
  room: HighLandRoomState;
  localPlayerId: string;
  inviteUrl: string;
  onStartGame: () => void;
  onLeave: () => void;
  onCopyInvite?: (inviteUrl: string) => void;
  onAddLocalGuest?: () => void;
};

type ServerBackedRoom = HighLandRoomState & { version?: number };
type StoredRoomSession = { playerId?: string; reconnectToken?: string };

const SESSION_KEY_PREFIX = 'high-land-room-session:';

export function RoomLobby({ room, localPlayerId, inviteUrl, onStartGame, onLeave, onCopyInvite, onAddLocalGuest }: RoomLobbyProps) {
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const startAllowed = canStartRoom(room, localPlayerId);
  const localPlayer = room.players.find((player) => player.id === localPlayerId) ?? null;
  const roomIsFull = room.players.length >= maxPlayers;
  const waitingOnReady = room.players.filter((player) => player.ready === false);

  function copyInvite(): void {
    if (onCopyInvite) {
      onCopyInvite(inviteUrl);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(inviteUrl);
    }
  }

  async function leaveRoom(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);

    try {
      await notifyServerBeforeLeaving(room as ServerBackedRoom);
      onLeave();
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : 'Could not leave this room cleanly.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="controls-card room-lobby" aria-label="High Land room lobby">
      <p className="eyebrow">Room Lobby</p>
      <h2>High Land Room {room.code}</h2>
      <p className="subtitle">
        Share the invite link, wait for players to join, then start when everyone is ready. The lobby updates automatically.
      </p>

      <div className="turn-box">
        <span>Status</span>
        <strong>{room.status}</strong>
      </div>

      <label className="setup-field">
        <span>Invite link</span>
        <input readOnly type="text" value={inviteUrl} />
      </label>

      <div className="button-row">
        <button onClick={copyInvite} type="button">Copy Invite</button>
        {onAddLocalGuest ? <button disabled={roomIsFull} onClick={onAddLocalGuest} type="button">Add Test Player</button> : null}
        <button className="primary" disabled={!startAllowed} onClick={onStartGame} type="button">Start Game</button>
        <button disabled={leaving} onClick={() => void leaveRoom()} type="button">{leaving ? 'Leaving…' : 'Leave'}</button>
      </div>

      {roomIsFull ? <p className="form-note">Room is full at {maxPlayers} players.</p> : null}
      {leaveError ? <p className="form-note" role="alert">{leaveError}</p> : null}

      {!startAllowed ? (
        <p className="form-note">
          {!localPlayer?.host
            ? 'Only the host can start the room.'
            : room.players.length < 2
              ? 'Need at least 2 players before the host can start.'
              : waitingOnReady.length > 0
                ? `Waiting for ${waitingOnReady.map((player) => player.name).join(', ')} to be ready.`
                : 'The room is not ready to start yet.'}
        </p>
      ) : null}

      <div className="players-card room-player-list">
        {room.players.map((player) => (
          <article className={`player-chip ${player.id === localPlayerId ? 'active' : ''}`} key={player.id} style={{ borderColor: player.color }}>
            <span className="token-dot" style={{ background: player.color }} />
            <div>
              <strong>{player.name}</strong>
              <p>
                {player.host ? 'Host' : 'Player'} • {player.connected ? 'Connected' : 'Disconnected'} • {player.ready === false ? 'Not Ready' : 'Ready'}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

async function notifyServerBeforeLeaving(room: ServerBackedRoom): Promise<void> {
  if (!Number.isInteger(room.version) || typeof window === 'undefined') return;

  const storageKey = `${SESSION_KEY_PREFIX}${room.code}`;
  const rawSession = window.localStorage.getItem(storageKey);
  if (!rawSession) return;

  let session: StoredRoomSession;
  try {
    session = JSON.parse(rawSession) as StoredRoomSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return;
  }

  if (!session.playerId || !session.reconnectToken) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  const configuredBase = (import.meta.env.VITE_MULTIPLAYER_API_URL as string | undefined)?.trim();
  const apiBase = (configuredBase || `${window.location.origin}/api/v1`).replace(/\/+$/, '');
  const response = await fetch(`${apiBase}/rooms/${room.code}/leave`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Player-Id': session.playerId,
      'X-Session-Token': session.reconnectToken
    },
    body: JSON.stringify({ expectedVersion: room.version })
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? `Could not leave room ${room.code}.`);
  }

  window.localStorage.removeItem(storageKey);
}
