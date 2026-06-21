import { useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { GameRulesPanel } from './ui/GameRulesPanel';
import { DevPanel } from './ui/DevPanel';
import { createInitialGame, restartGame, rollCurrentTurn } from './game/systems/gameEngine';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';
import { normalizePlayerName } from './game/systems/finalBoardMovement';

const playerOptions = [2, 3, 4];

function defaultNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`);
}

export default function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(() => defaultNames(2));
  const [gameState, setGameState] = useState(() => createInitialGame(2, defaultNames(2)));
  const [muted, setMuted] = useState(isMuted());

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );

  function setCount(count: number): void {
    setPlayerCount(count);
    setPlayerNames((names) => Array.from({ length: count }, (_, index) => names[index] ?? `Player ${index + 1}`));
  }

  function setName(index: number, value: string): void {
    setPlayerNames((names) => names.map((name, nameIndex) => (nameIndex === index ? value : name)));
  }

  function normalizedNames(): string[] {
    return playerNames.map((name, index) => normalizePlayerName(name, `Player ${index + 1}`));
  }

  function startGame(): void {
    setGameState(createInitialGame(playerCount, normalizedNames()));
  }

  function roll(): void {
    if (gameState.phase === 'game_over' || gameState.phase === 'moving' || gameState.phase === 'resolving_card') return;
    playRollSound();
    const next = rollCurrentTurn(gameState);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  function restart(): void {
    setGameState(restartGame(playerCount, normalizedNames()));
  }

  function toggleMute(): void {
    const nextMuted = !muted;
    setAudioMuted(nextMuted);
    setMuted(nextMuted);
  }

  return (
    <main className="app-shell">
      <section className="game-panel">
        <div className="title-card">
          <p className="eyebrow">Browser Board Game Prototype</p>
          <h1>High Land: The Sweet Escape</h1>
          <p className="subtitle">Roll, move, draw HIT cards, and race across the finish line with 2-4 named players.</p>
        </div>

        <div className="controls-card">
          <div className="player-select" aria-label="Player count">
            {playerOptions.map((count) => (
              <button
                className={count === playerCount ? 'selected' : ''}
                key={count}
                onClick={() => setCount(count)}
                type="button"
              >
                {count} Players
              </button>
            ))}
          </div>

          <div className="name-grid" aria-label="Player names">
            {playerNames.map((name, index) => (
              <label key={`player-name-${index + 1}`}>
                <span>Player {index + 1}</span>
                <input
                  maxLength={18}
                  onChange={(event) => setName(index, event.target.value)}
                  placeholder={`Player ${index + 1}`}
                  type="text"
                  value={name}
                />
              </label>
            ))}
          </div>

          <div className="turn-box" style={{ borderColor: currentPlayer?.color ?? 'transparent' }}>
            <span>Current Turn</span>
            <strong>{currentPlayer?.name ?? 'None'}</strong>
          </div>

          <DiceDisplay value={gameState.lastRoll} />

          <div className="button-row">
            <button className="primary" disabled={gameState.phase === 'game_over'} onClick={roll} type="button">
              Roll Dice
            </button>
            <button onClick={startGame} type="button">Start Named Game</button>
            <button onClick={restart} type="button">Restart</button>
            <button onClick={toggleMute} type="button">{muted ? 'Unmute' : 'Mute'}</button>
          </div>
        </div>

        {winner ? (
          <div className="winner-modal" role="status" aria-live="polite">
            <strong>{winner.name} wins!</strong>
            <p>{winner.name} crossed the finish line.</p>
          </div>
        ) : null}

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameState.message}</p>
        </div>

        <CardRevealModal card={gameState.lastCard} />
        <GameRulesPanel />
        <DevPanel state={gameState} />

        <div className="players-card">
          {gameState.players.map((player) => (
            <article
              className={`player-chip ${player.id === currentPlayer?.id ? 'active' : ''}`}
              key={player.id}
              style={{ borderColor: player.color }}
            >
              <span className="token-dot" style={{ background: player.color }} />
              <div>
                <strong>{player.name}</strong>
                <p>
                  Space {player.positionIndex}
                  {player.skipTurns > 0 ? ` • Skip x${player.skipTurns}` : ''}
                  {player.protectedFromBackward > 0 ? ` • Protected x${player.protectedFromBackward}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="board-wrap" aria-label="Game board">
        <PhaserBoard state={gameState} />
      </section>
    </main>
  );
}
