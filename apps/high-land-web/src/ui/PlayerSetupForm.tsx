import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { isValidRoomCode, normalizeRoomCode } from '../game/multiplayer/roomCodes';
import { validatePlayerName } from '../game/players/playerIdentity';
import { localMinPlayers, maxPlayers } from '../game/systems/playerSystem';

export type PlayerSetupMode = 'local' | 'create_room' | 'join_room';

export type PlayerSetupSubmit = {
  mode: PlayerSetupMode;
  playerName: string;
  playerNames: string[];
  playerCount: number;
  roomCode: string | null;
};

type PlayerSetupFormProps = {
  mode: PlayerSetupMode;
  initialRoomCode?: string | null;
  initialPlayerName?: string;
  defaultPlayerCount?: number;
  isLoading?: boolean;
  onSubmit: (value: PlayerSetupSubmit) => void;
  onCancel?: () => void;
};

const playerCountOptions = Array.from({ length: maxPlayers - localMinPlayers + 1 }, (_, index) => localMinPlayers + index);

export function PlayerSetupForm({
  mode,
  initialRoomCode = null,
  initialPlayerName = '',
  defaultPlayerCount = 2,
  isLoading = false,
  onSubmit,
  onCancel
}: PlayerSetupFormProps) {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [localPlayerNames, setLocalPlayerNames] = useState<string[]>(() =>
    Array.from({ length: maxPlayers }, (_, index) => index === 0 ? initialPlayerName : `Player ${index + 1}`)
  );
  const [roomCode, setRoomCode] = useState(initialRoomCode ? normalizeRoomCode(initialRoomCode) : '');
  const [submitted, setSubmitted] = useState(false);

  const nameValidation = useMemo(() => validatePlayerName(playerName), [playerName]);
  const roomCodeRequired = mode === 'join_room';
  const roomCodeValid = !roomCodeRequired || isValidRoomCode(roomCode);
  const localNamesValid = mode !== 'local' || localPlayerNames.slice(0, playerCount).every((name) => {
    const normalized = name.trim();
    return normalized.length === 0 || validatePlayerName(normalized).valid;
  });
  const canSubmit = (mode === 'local' ? localNamesValid : nameValidation.valid) && roomCodeValid;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitted(true);

    if (!canSubmit) return;

    const submittedNames = mode === 'local'
      ? localPlayerNames.slice(0, playerCount).map((name, index) => name.trim() || `Player ${index + 1}`)
      : [nameValidation.value];

    onSubmit({
      mode,
      playerName: submittedNames[0] ?? nameValidation.value,
      playerNames: submittedNames,
      playerCount,
      roomCode: roomCode ? normalizeRoomCode(roomCode) : null
    });
  }

  return (
    <form className="controls-card player-setup-form" onSubmit={submit}>
      <p className="eyebrow">Player Setup</p>
      <h2>{getSetupTitle(mode)}</h2>
      <p className="subtitle">{getSetupSubtitle(mode)}</p>

      {mode !== 'local' ? (
        <>
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
        </>
      ) : (
        <>
          <label className="setup-field">
            <span>Players</span>
            <select onChange={(event) => setPlayerCount(Number(event.target.value))} value={playerCount}>
              {playerCountOptions.map((count) => (
                <option key={count} value={count}>{count === 1 ? '1 Player' : `${count} Players`}</option>
              ))}
            </select>
          </label>
          <div className="local-player-name-grid" aria-label="Local player names">
            {localPlayerNames.slice(0, playerCount).map((name, index) => {
              const validation = name.trim() ? validatePlayerName(name) : { valid: true, error: null };
              return (
                <label className="setup-field" key={index}>
                  <span>Player {index + 1} name</span>
                  <input
                    autoComplete={index === 0 ? 'nickname' : 'off'}
                    maxLength={24}
                    onChange={(event) => {
                      const next = [...localPlayerNames];
                      next[index] = event.target.value;
                      setLocalPlayerNames(next);
                    }}
                    placeholder={`Player ${index + 1}`}
                    type="text"
                    value={name}
                  />
                  {submitted && !validation.valid ? <small className="form-error">{validation.error}</small> : null}
                </label>
              );
            })}
          </div>
        </>
      )}

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
        <button className="primary" disabled={isLoading} type="submit">
          {isLoading ? <span className="btn-spinner" aria-label="Loading" /> : null}
          {isLoading ? 'Connecting…' : getSubmitLabel(mode)}
        </button>
        {onCancel ? (
          <button disabled={isLoading} onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
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
  return `Name yourself and choose ${localMinPlayers}-${maxPlayers} local players. Single-player mode is supported for solo playtesting and casual runs.`;
}

function getSubmitLabel(mode: PlayerSetupMode): string {
  if (mode === 'create_room') return 'Create Room';
  if (mode === 'join_room') return 'Join Room';
  return 'Start Game';
}
