import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { isValidRoomCode, normalizeRoomCode } from '../game/multiplayer/roomCodes';
import { validatePlayerName } from '../game/players/playerIdentity';
import { maxPlayers, minPlayers } from '../game/systems/playerSystem';

export type PlayerSetupMode = 'local' | 'create_room' | 'join_room';

export type PlayerSetupSubmit = {
  mode: PlayerSetupMode;
  playerName: string;
  playerCount: number;
  roomCode: string | null;
};

type PlayerSetupFormProps = {
  mode: PlayerSetupMode;
  initialRoomCode?: string | null;
  initialPlayerName?: string;
  defaultPlayerCount?: number;
  onSubmit: (value: PlayerSetupSubmit) => void;
  onCancel?: () => void;
};

const playerCountOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, index) => minPlayers + index);

export function PlayerSetupForm({
  mode,
  initialRoomCode = null,
  initialPlayerName = '',
  defaultPlayerCount = 2,
  onSubmit,
  onCancel
}: PlayerSetupFormProps) {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [roomCode, setRoomCode] = useState(initialRoomCode ? normalizeRoomCode(initialRoomCode) : '');
  const [submitted, setSubmitted] = useState(false);

  const nameValidation = useMemo(() => validatePlayerName(playerName), [playerName]);
  const roomCodeRequired = mode === 'join_room';
  const roomCodeValid = !roomCodeRequired || isValidRoomCode(roomCode);
  const canSubmit = nameValidation.valid && roomCodeValid;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);

    if (!canSubmit) return;

    onSubmit({
      mode,
      playerName: nameValidation.value,
      playerCount,
      roomCode: roomCode ? normalizeRoomCode(roomCode) : null
    });
  }

  return (
    <form className="controls-card player-setup-form" onSubmit={submit}>
      <p className="eyebrow">Player Setup</p>
      <h2>{getSetupTitle(mode)}</h2>
      <p className="subtitle">{getSetupSubtitle(mode)}</p>

      <label className="setup-field">
        <span>Player name</span>
        <input
          autoComplete="nickname"
          maxLength={24}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Enter your player name"
          type="text"
          value={playerName}
        />
      </label>
      {submitted && !nameValidation.valid ? <p className="form-error">{nameValidation.error}</p> : null}

      {mode === 'local' ? (
        <label className="setup-field">
          <span>Players</span>
          <select onChange={(event) => setPlayerCount(Number(event.target.value))} value={playerCount}>
            {playerCountOptions.map((count) => (
              <option key={count} value={count}>{count} Players</option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === 'join_room' ? (
        <label className="setup-field">
          <span>Room code</span>
          <input
            maxLength={8}
            onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
            placeholder="Room code"
            type="text"
            value={roomCode}
          />
        </label>
      ) : null}
      {submitted && !roomCodeValid ? <p className="form-error">Enter a valid 4-8 character room code.</p> : null}

      <div className="button-row">
        <button className="primary" type="submit">{getSubmitLabel(mode)}</button>
        {onCancel ? <button onClick={onCancel} type="button">Cancel</button> : null}
      </div>
    </form>
  );
}

function getSetupTitle(mode: PlayerSetupMode): string {
  if (mode === 'create_room') return 'Create a High Land room';
  if (mode === 'join_room') return 'Join a High Land room';
  return 'Start local High Land';
}

function getSetupSubtitle(mode: PlayerSetupMode): string {
  if (mode === 'create_room') return `Name yourself, create an invite room, then share the link. Online rooms support up to ${maxPlayers} players.`;
  if (mode === 'join_room') return 'Name yourself and enter the invite code so this device joins the same room.';
  return 'Name yourself before starting so tokens and turns track the real player.';
}

function getSubmitLabel(mode: PlayerSetupMode): string {
  if (mode === 'create_room') return 'Create Room';
  if (mode === 'join_room') return 'Join Room';
  return 'Start Game';
}
