import { useEffect, useMemo, useRef, useState } from 'react';
import { boardPath } from '../game/data/boardPath';
import { resolvePendingPlayerChoice } from '../game/systems/effectResolver';
import { createInitialGame, rollCurrentTurn } from '../game/systems/gameEngine';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from '../game/systems/audioSystem';
import { loadGameState, saveGameState } from '../game/systems/storageSystem';
import type { GameState } from '../game/types/gameTypes';
import type { ConnectionStatus } from '../multiplayer/roomTypes';
import { CardRevealModal } from './CardRevealModal';
import { DevPanel } from './DevPanel';
import { DiceDisplay } from './DiceDisplay';
import { GameRulesPanel } from './GameRulesPanel';
import { PhaserBoard } from './PhaserBoard';

type GameScreenProps = {
  gameState: GameState;
  mode: 'local' | 'online';
  onlinePlayerId?: string;
  roomCode?: string;
  connectionStatus?: ConnectionStatus;
  actionPending?: boolean;
  onStateChange: (nextState: GameState) => Promise<boolean> | boolean;
  onExit: () => void;
};

export function GameScreen({
  gameState,
  mode,
  onlinePlayerId,
  roomCode,
  connectionStatus = 'connected',
  actionPending = false,
  onStateChange,
  onExit
}: GameScreenProps) {
  const [muted, setMuted] = useState(isMuted());
  const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const testRolls = useRef(readLocalTestRolls());
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentSpace = currentPlayer ? boardPath[currentPlayer.positionIndex] : null;
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );
  const visibleCard = gameState.lastCard?.id === dismissedCardId ? null : gameState.lastCard;
  const choicePlayers = gameState.pendingChoice
    ? gameState.players.filter((player) => player.id !== gameState.pendingChoice?.sourcePlayerId)
    : [];
  const isMyTurn = mode === 'local' || currentPlayer?.id === onlinePlayerId;
  const canAct = isMyTurn && connectionStatus !== 'offline' && !submitting && !actionPending;
  const showDevPanel = import.meta.env.DEV && new URLSearchParams(window.location.search).has('hlDev');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  async function submit(nextState: GameState): Promise<boolean> {
    setSubmitting(true);
    try {
      return await onStateChange(nextState);
    } finally {
      setSubmitting(false);
    }
  }

  async function roll(): Promise<void> {
    if (!canAct || gameState.phase === 'game_over' || gameState.phase === 'choosing_player') return;
    playRollSound();
    setDismissedCardId(null);
    const forcedRoll = testRolls.current.shift();
    const next = rollCurrentTurn(gameState, forcedRoll ? () => (forcedRoll - 0.5) / 6 : Math.random);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    await submit(next);
  }

  async function restartLocal(): Promise<void> {
    if (mode !== 'local') return;
    const names = gameState.players.map((player) => player.name);
    await submit(createInitialGame(names.length, names));
    setDismissedCardId(null);
  }

  function save(): void {
    if (mode === 'local') saveGameState(gameState);
  }

  async function load(): Promise<void> {
    if (mode !== 'local') return;
    const saved = loadGameState();
    if (saved) await submit(saved);
    setDismissedCardId(null);
  }

  function toggleMute(): void {
    const nextMuted = !muted;
    setAudioMuted(nextMuted);
    setMuted(nextMuted);
  }

  async function choosePlayer(playerId: string): Promise<void> {
    if (!canAct) return;
    const next = resolvePendingPlayerChoice(gameState, playerId);
    if (next.winnerId) playWinSound();
    const accepted = await submit(next);
    if (accepted) setDismissedCardId(gameState.lastCard?.id ?? null);
  }

  const rollLabel = gameState.phase === 'game_over'
    ? 'Game Over'
    : !isMyTurn && mode === 'online'
      ? `Waiting for ${currentPlayer?.name ?? 'player'}`
      : submitting || actionPending
        ? 'Syncing...'
        : 'Roll Dice';

  return (
    <main className="app-shell">
      <section className="game-panel">
        <div className="title-card">
          <p className="eyebrow">21+ Fantasy Board Game {roomCode ? `/ Room ${roomCode}` : '/ Local Play'}</p>
          <h1><span>HIGH LAND</span><small>The Sweet Escape</small></h1>
        </div>

        <div className="controls-card">
          <div className="turn-box" style={{ borderColor: currentPlayer?.color ?? 'transparent' }}>
            <div>
              <span>{winner ? 'Winner' : 'Current Turn'}</span>
              <strong>{winner?.name ?? currentPlayer?.name ?? 'None'}</strong>
            </div>
            <small>{currentSpace?.zone ?? 'Rolling Hills'} / Space {currentPlayer?.positionIndex ?? 0}</small>
          </div>

          <p className="turn-announcement">
            {winner ? `${winner.name} reached Cloud 9 Citadel and wins!` : `${currentPlayer?.name ?? 'Player'}'s turn`}
          </p>

          <DiceDisplay value={gameState.lastRoll} />

          <div className="button-row">
            <button
              className="primary"
              disabled={!canAct || gameState.phase === 'game_over' || gameState.phase === 'choosing_player'}
              onClick={() => void roll()}
              type="button"
            >
              {rollLabel}
            </button>
            {mode === 'local' ? <button onClick={() => void restartLocal()} type="button">Restart</button> : null}
            {mode === 'local' ? <button onClick={save} type="button">Save</button> : null}
            {mode === 'local' ? <button onClick={() => void load()} type="button">Load</button> : null}
            <button aria-pressed={!muted} onClick={toggleMute} type="button">{muted ? 'Music On' : 'Audio Off'}</button>
            <button onClick={onExit} type="button">Exit Game</button>
          </div>
        </div>

        <div className="message-card">
          <strong>Latest Move</strong>
          <p>{winner ? `${winner.name} reached Cloud 9 Citadel and wins!` : gameState.message}</p>
          {mode === 'online' ? (
            <small className={`sync-status ${connectionStatus}`}>
              {connectionStatus === 'offline' ? 'Connection lost. Reconnecting...' : 'All players synced'}
            </small>
          ) : null}
        </div>

        <CardRevealModal
          card={visibleCard}
          choicePlayers={choicePlayers}
          choiceRequired={gameState.phase === 'choosing_player' && canAct}
          waitingForChoice={gameState.phase === 'choosing_player' && !canAct}
          onChoosePlayer={(playerId) => void choosePlayer(playerId)}
          onDismiss={() => setDismissedCardId(gameState.lastCard?.id ?? null)}
        />
        <GameRulesPanel />
        {showDevPanel ? <DevPanel state={gameState} /> : null}

        <div className="players-card" aria-label="Turn order">
          {gameState.players.map((player, index) => (
            <article
              className={`player-chip ${player.id === currentPlayer?.id ? 'active' : ''}`}
              data-player-id={player.id}
              key={player.id}
              style={{ borderColor: player.color }}
            >
              <span className="turn-order-number">{index + 1}</span>
              <span className="token-dot" style={{ background: player.color }} />
              <div>
                <strong>{player.name}{player.id === onlinePlayerId ? ' (You)' : ''}</strong>
                <p>
                  Space {player.positionIndex}
                  {player.skipTurns > 0 ? ` | Skip x${player.skipTurns}` : ''}
                  {player.protectedFromBackward > 0 ? ` | Protected x${player.protectedFromBackward}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="board-wrap" aria-label="Game board">
        <PhaserBoard state={gameState} />
      </section>
      <p className="legal-note">For adults 21+. Entertainment only. Follow local laws.</p>
    </main>
  );
}

function readLocalTestRolls(): number[] {
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return [];
  const value = new URLSearchParams(window.location.search).get('hlTestRolls');
  if (!value) return [];
  return value
    .split(',')
    .map(Number)
    .filter((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 6);
}
