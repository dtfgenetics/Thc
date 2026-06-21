import { useMemo, useState } from 'react';
import type { ConnectionStatus, RoomCredentials, RoomSnapshot } from '../multiplayer/roomTypes';

type LobbyScreenProps = {
  room: RoomSnapshot;
  credentials: RoomCredentials;
  connectionStatus: ConnectionStatus;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onLeave: () => void;
  onLocalFallback: () => void;
};

export function LobbyScreen({
  room,
  credentials,
  connectionStatus,
  busy,
  error,
  onStart,
  onLeave,
  onLocalFallback
}: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const isHost = credentials.playerId === room.hostPlayerId;
  const inviteUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?game=${room.gameId}`,
    [room.gameId]
  );

  async function copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.querySelector<HTMLInputElement>('#invite-link');
      input?.focus();
      input?.select();
    }
  }

  return (
    <main className="lobby-shell">
      <section className="lobby-panel">
        <div className="lobby-header">
          <div>
            <p className="eyebrow">HIGH LAND Online Lobby</p>
            <h1><span>ROOM {room.gameId}</span><small>The Sweet Escape</small></h1>
          </div>
          <span className={`connection-chip ${connectionStatus}`}>{connectionStatus}</span>
        </div>

        <div className="invite-box">
          <label htmlFor="invite-link">Invite link</label>
          <div>
            <input id="invite-link" readOnly value={inviteUrl} />
            <button onClick={() => void copyInvite()} type="button">{copied ? 'Copied' : 'Copy Link'}</button>
          </div>
        </div>

        <section className="lobby-players" aria-label="Joined players">
          <div className="lobby-section-title">
            <strong>Joined Players</strong>
            <span>{room.players.length} / {room.maxPlayers}</span>
          </div>
          {room.players.map((player, index) => (
            <article className="lobby-player" data-lobby-player-id={player.id} key={player.id}>
              <span className="token-dot" style={{ background: player.color }} />
              <div>
                <strong>{player.name}</strong>
                <small>
                  {player.id === room.hostPlayerId ? 'Host' : `Player ${index + 1}`}
                  {player.id === credentials.playerId ? ' / You' : ''}
                </small>
              </div>
              <span className={player.connected ? 'presence online' : 'presence'}>
                {player.connected ? 'Connected' : 'Reconnecting'}
              </span>
            </article>
          ))}
        </section>

        {error ? <p className="setup-error">{error}</p> : null}

        <div className="lobby-actions">
          {isHost ? (
            <button
              className="primary"
              disabled={busy || room.players.length < 2 || connectionStatus === 'offline'}
              onClick={onStart}
              type="button"
            >
              {room.players.length < 2 ? 'Waiting for one more player' : busy ? 'Starting...' : 'Start Game'}
            </button>
          ) : (
            <div className="waiting-message">Waiting for the host to start the game.</div>
          )}
          <button onClick={onLeave} type="button">Leave Lobby</button>
          {connectionStatus === 'offline' ? <button onClick={onLocalFallback} type="button">Play Locally</button> : null}
        </div>
      </section>
    </main>
  );
}
