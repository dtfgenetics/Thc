import { useRef, useState } from 'react';
import { canStartRoom, type HighLandRoomState } from '../game/multiplayer/roomState';
import { maxPlayers } from '../game/systems/playerSystem';
import { shareOrCopyInvite } from '../game/browserExperience';

type RoomLobbyProps = {
  room: HighLandRoomState;
  localPlayerId: string;
  inviteUrl: string;
  onStartGame: () => void;
  onLeave: () => void;
  onCopyInvite?: (inviteUrl: string) => void;
  onAddLocalGuest?: () => void;
};

type CopyState = 'idle' | 'shared' | 'copied' | 'manual';

export function RoomLobby({ room, localPlayerId, inviteUrl, onStartGame, onLeave, onCopyInvite, onAddLocalGuest }: RoomLobbyProps) {
  const startAllowed = canStartRoom(room, localPlayerId);
  const localPlayer = room.players.find((player) => player.id === localPlayerId) ?? null;
  const roomIsFull = room.players.length >= maxPlayers;
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  async function shareInvite(): Promise<void> {
    setCopyState('idle');

    if (onCopyInvite) {
      onCopyInvite(inviteUrl);
      setCopyState('copied');
      return;
    }

    const result = await shareOrCopyInvite(inviteUrl, {
      text: `Join my High Land room ${room.code}.`
    });

    if (result === 'shared') {
      setCopyState('shared');
      return;
    }
    if (result === 'copied') {
      setCopyState('copied');
      return;
    }
    if (result === 'manual') {
      inviteInputRef.current?.focus();
      inviteInputRef.current?.select();
      setCopyState('manual');
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
        <input ref={inviteInputRef} readOnly type="text" value={inviteUrl} />
      </label>

      <div className="button-row">
        <button onClick={() => void shareInvite()} type="button">
          {copyState === 'shared' ? 'Invite Shared' : copyState === 'copied' ? 'Invite Copied' : 'Share Invite'}
        </button>
        {onAddLocalGuest ? <button disabled={roomIsFull} onClick={onAddLocalGuest} type="button">Add Test Player</button> : null}
        <button className="primary" disabled={!startAllowed} onClick={onStartGame} type="button">Start Game</button>
        <button onClick={onLeave} type="button">Leave</button>
      </div>

      <p className="form-note room-copy-status" aria-live="polite">
        {copyState === 'shared' ? 'Invite opened in your device sharing menu.' : null}
        {copyState === 'copied' ? 'Invite link copied. Send it to the players you want in this room.' : null}
        {copyState === 'manual' ? 'Automatic sharing and copy are unavailable. The invite link is selected above so you can copy it manually.' : null}
      </p>

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
