import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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
  defaultPlayerCount?: number;
  onSubmit: (value: PlayerSetupSubmit) => void;
  onCancel?: () => void;
};

const playerCountOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, index) => minPlayers + index);

export function PlayerSetupForm({
  mode,
  initialRoomCode = null,
  defaultPlayerCount = 2,
  onSubmit,
  onCancel
}: PlayerSetupFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? '');
  const [submitted, setSubmitted] = useState(false);

  const nameValidation = useMemo(() => validatePlayerName(playerName), [playerName]);
  const roomCodeRequired = mode === 'join_room';
  const roomCodeValid = !roomCodeRequired || roomCode.trim().length >= 4;
  const canSubmit = nameValidation.valid && roomCodeValid;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);

    if (!canSubmit) return;

    onSubmit({
      mode,
      playerName: nameValidation.value,
      playerCount,
      roomCode: roomCode.trim() || null
    });
  }

  return (
    <form className="controls-card player-setup-form" onSubmit={submit}>
      <p className="eyebrow">Player Setup</p>
      <h2>{getSetupTitle(mode)}</h2>
      <p className="subtitle">Name yourself before starting so tokens, turns, rooms, and invites can track the real player.</p>

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

      {mode !== 'join_room' ? (
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
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="Room code"
            type="text"
            value={roomCode}
          />
        </label>
      ) : null}
      {submitted && !roomCodeValid ? <p className="form-error">Room code is required to join.</p> : null}

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

function getSubmitLabel(mode: PlayerSetupMode): string {
  if (mode === 'create_room') return 'Create Room';
  if (mode === 'join_room') return 'Join Room';
  return 'Start Game';
}
