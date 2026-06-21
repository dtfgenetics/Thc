import { useMemo, useRef, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { GameRulesPanel } from './ui/GameRulesPanel';
import { DevPanel } from './ui/DevPanel';
import { createInitialGame, restartGame, rollCurrentTurn } from './game/systems/gameEngine';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';
import { clearSavedGameState, loadGameState, saveGameState } from './game/systems/storageSystem';
import { resolvePendingPlayerChoice } from './game/systems/effectResolver';
import { boardPath } from './game/data/boardPath';

const playerOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [gameState, setGameState] = useState(() => createInitialGame(2));
  const [muted, setMuted] = useState(isMuted());
  const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
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
  const showDevPanel = import.meta.env.DEV && new URLSearchParams(window.location.search).has('hlDev');

  function startGame(count: number): void {
    setPlayerCount(count);
    setGameState(createInitialGame(count));
    setDismissedCardId(null);
  }

  function roll(): void {
    if (gameState.phase === 'game_over' || gameState.phase === 'moving' || gameState.phase === 'resolving_card' || gameState.phase === 'choosing_player') return;
    playRollSound();
    setDismissedCardId(null);
    const forcedRoll = testRolls.current.shift();
    const next = rollCurrentTurn(gameState, forcedRoll ? () => (forcedRoll - 0.5) / 6 : Math.random);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  function restart(): void {
    const next = restartGame(playerCount);
    setGameState(next);
    setDismissedCardId(null);
    clearSavedGameState();
  }

  function save(): void {
    saveGameState(gameState);
  }

  function load(): void {
    const saved = loadGameState();
    if (!saved) return;
    setPlayerCount(saved.players.length);
    setGameState(saved);
    setDismissedCardId(null);
  }

  function toggleMute(): void {
    const nextMuted = !muted;
    setAudioMuted(nextMuted);
    setMuted(nextMuted);
  }

  function choosePlayer(playerId: string): void {
    const next = resolvePendingPlayerChoice(gameState, playerId);
    if (next.winnerId) playWinSound();
    setGameState(next);
    setDismissedCardId(gameState.lastCard?.id ?? null);
  }

  return (
    <main className="app-shell">
      <section className="game-panel">
        <div className="title-card">
          <p className="eyebrow">21+ Fantasy Board Game</p>
          <h1><span>HIGH LAND</span><small>The Sweet Escape</small></h1>
          <p className="subtitle">Roll, move, draw action cards, dodge skips, and race to the finish with up to 10 players.</p>
        </div>

        <div className="controls-card">
          <span className="control-label">New Game: choose players</span>
          <div className="player-select" aria-label="Player count">
            {playerOptions.map((count) => (
              <button
                className={count === playerCount ? 'selected' : ''}
                key={count}
                onClick={() => startGame(count)}
                type="button"
              >
                {count} Players
              </button>
            ))}
          </div>

          <div className="turn-box" style={{ borderColor: currentPlayer?.color ?? 'transparent' }}>
            <div>
              <span>Current Turn</span>
              <strong>{currentPlayer?.name ?? 'None'}</strong>
            </div>
            <small>{currentSpace?.zone ?? 'Rolling Hills'} / Space {currentPlayer?.positionIndex ?? 0}</small>
          </div>

          <DiceDisplay value={gameState.lastRoll} />

          <div className="button-row">
            <button className="primary" disabled={gameState.phase === 'game_over' || gameState.phase === 'choosing_player'} onClick={roll} type="button">
              Roll Dice
            </button>
            <button onClick={restart} type="button">Restart</button>
            <button onClick={save} type="button">Save</button>
            <button onClick={load} type="button">Load</button>
            <button aria-pressed={!muted} onClick={toggleMute} type="button">{muted ? 'Music On' : 'Audio Off'}</button>
          </div>
        </div>

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameState.message}</p>
        </div>

        <CardRevealModal
          card={visibleCard}
          choicePlayers={choicePlayers}
          choiceRequired={gameState.phase === 'choosing_player'}
          onChoosePlayer={choosePlayer}
          onDismiss={() => setDismissedCardId(gameState.lastCard?.id ?? null)}
        />
        <GameRulesPanel />
        {showDevPanel ? <DevPanel state={gameState} /> : null}

        <div className="players-card">
          {gameState.players.map((player) => (
            <article
              className={`player-chip ${player.id === currentPlayer?.id ? 'active' : ''}`}
              data-player-id={player.id}
              key={player.id}
              style={{ borderColor: player.color }}
            >
              <span className="token-dot" style={{ background: player.color }} />
              <div>
                <strong>{player.name}</strong>
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
