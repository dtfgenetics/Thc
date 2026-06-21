import { useMemo, useState } from 'react';
import { gameAssetPath } from '../game/systems/assetPath';
import type { InviteStatus } from '../multiplayer/roomTypes';

type SetupScreenProps = {
  inviteRequested: boolean;
  inviteGameId: string | null;
  inviteStatus: InviteStatus;
  busy: boolean;
  error: string | null;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (name: string) => void;
  onStartLocal: (names: string[]) => void;
};

const playerCounts = Array.from({ length: 10 }, (_, index) => index + 1);
const sessionNameKey = 'high-land-display-name-v1';

export function SetupScreen({
  inviteRequested,
  inviteGameId,
  inviteStatus,
  busy,
  error,
  onCreateRoom,
  onJoinRoom,
  onStartLocal
}: SetupScreenProps) {
  const [mode, setMode] = useState<'online' | 'local'>(inviteRequested ? 'online' : 'online');
  const [displayName, setDisplayName] = useState(() => readSessionName());
  const [localPlayerCount, setLocalPlayerCount] = useState(1);
  const [localNames, setLocalNames] = useState<string[]>(() => [readSessionName()]);
  const isInvalidInvite = inviteRequested && (!inviteGameId || inviteStatus === 'invalid');
  const isFull = inviteStatus === 'full';
  const localInputs = useMemo(
    () => Array.from({ length: localPlayerCount }, (_, index) => localNames[index] ?? ''),
    [localNames, localPlayerCount]
  );

  function rememberName(name: string): void {
    try {
      window.sessionStorage.setItem(sessionNameKey, name.trim());
    } catch {
      // The game still works when session storage is unavailable.
    }
  }

  function submitOnline(): void {
    rememberName(displayName);
    if (inviteGameId) onJoinRoom(displayName);
    else onCreateRoom(displayName);
  }

  function updateLocalName(index: number, value: string): void {
    setLocalNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function startLocal(): void {
    rememberName(localInputs[0] ?? '');
    onStartLocal(localInputs);
  }

  return (
    <main className="setup-shell">
      <section className="setup-art" aria-label="HIGH LAND game board preview">
        <img src={gameAssetPath('assets/images/board/high-land-board.jpg')} alt="HIGH LAND fantasy board" />
      </section>

      <section className="setup-panel">
        <div className="setup-title">
          <p className="eyebrow">21+ Fantasy Board Game</p>
          <h1><span>HIGH LAND</span><small>The Sweet Escape</small></h1>
        </div>

        {!inviteRequested ? (
          <div className="mode-tabs" role="tablist" aria-label="Game mode">
            <button
              aria-selected={mode === 'online'}
              className={mode === 'online' ? 'selected' : ''}
              onClick={() => setMode('online')}
              role="tab"
              type="button"
            >
              Online Game
            </button>
            <button
              aria-selected={mode === 'local'}
              className={mode === 'local' ? 'selected' : ''}
              onClick={() => setMode('local')}
              role="tab"
              type="button"
            >
              Local Play
            </button>
          </div>
        ) : null}

        {mode === 'online' ? (
          <div className="setup-form">
            <div className="setup-heading">
              <span>{inviteRequested ? 'Game Invite' : 'Create a Lobby'}</span>
              <strong>{inviteGameId ? `Room ${inviteGameId}` : inviteRequested ? 'Invite unavailable' : 'Host a new game'}</strong>
            </div>

            <label>
              Display name
              <input
                autoComplete="nickname"
                maxLength={24}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Player 1"
                value={displayName}
              />
            </label>

            {isInvalidInvite ? <p className="setup-error">This game invite could not be found. Create a new High Land game.</p> : null}
            {isFull ? <p className="setup-error">This High Land game is full.</p> : null}
            {error && !isInvalidInvite && !isFull ? <p className="setup-error">{error}</p> : null}

            <button
              className="primary setup-action"
              disabled={busy || isInvalidInvite || isFull || inviteStatus === 'checking'}
              onClick={submitOnline}
              type="button"
            >
              {busy || inviteStatus === 'checking' ? 'Connecting...' : inviteGameId ? 'Join Game' : 'Create Game'}
            </button>

            {error ? (
              <button className="secondary-action" onClick={() => setMode('local')} type="button">
                Play locally instead
              </button>
            ) : null}
          </div>
        ) : (
          <div className="setup-form">
            <label>
              Number of local players
              <select
                onChange={(event) => setLocalPlayerCount(Number(event.target.value))}
                value={localPlayerCount}
              >
                {playerCounts.map((count) => (
                  <option key={count} value={count}>{count} {count === 1 ? 'player' : 'players'}</option>
                ))}
              </select>
            </label>

            <div className="local-name-list">
              {localInputs.map((name, index) => (
                <label key={index}>
                  Player {index + 1} name
                  <input
                    maxLength={24}
                    onChange={(event) => updateLocalName(index, event.target.value)}
                    placeholder={`Player ${index + 1}`}
                    value={name}
                  />
                </label>
              ))}
            </div>

            <button className="primary setup-action" onClick={startLocal} type="button">
              Start Local Game
            </button>
          </div>
        )}

        <p className="setup-legal">For adults 21+. Entertainment only. Follow local laws.</p>
      </section>
    </main>
  );
}

function readSessionName(): string {
  try {
    return window.sessionStorage.getItem(sessionNameKey) ?? '';
  } catch {
    return '';
  }
}
