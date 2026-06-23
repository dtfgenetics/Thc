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

export function RoomLobby({ room, localPlayerId, inviteUrl, onStartGame, onLeave, onCopyInvite, onAddLocalGuest }: RoomLobbyProps) {
  const startAllowed = canStartRoom(room, localPlayerId);
  const localPlayer = room.players.find((player) => player.id === localPlayerId) ?? null;
  const roomIsFull = room.players.length >= maxPlayers;

  function copyInvite(): void {
    if (onCopyInvite) {
      onCopyInvite(inviteUrl);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(inviteUrl);
    }
  }

  return (
    <section className="controls-card room-lobby" aria-label="High Land room lobby">
      <p className="eyebrow">Room Lobby</p>
      <h2>High Land Room {room.code}</h2>
      <p className="subtitle">
        Share the invite link, wait for players to join, then start when everyone is ready. Add a local test player until Supabase sync is connected.
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
        <button onClick={onLeave} type="button">Leave</button>
      </div>

      {roomIsFull ? <p className="form-note">Room is full at {maxPlayers} players.</p> : null}

      {!startAllowed ? (
        <p className="form-note">
          {localPlayer?.host ? 'Need at least 2 players before the host can start.' : 'Only the host can start the room.'}
        </p>
      ) : null}

      <div className="players-card room-player-list">
        {room.players.map((player) => (
          <article className={`player-chip ${player.id === localPlayerId ? 'active' : ''}`} key={player.id} style={{ borderColor: player.color }}>
            <span className="token-dot" style={{ background: player.color }} />
            <div>
              <strong>{player.name}</strong>
              <p>
                {player.host ? 'Host' : 'Player'} • {player.connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
