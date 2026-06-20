import { useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { createInitialGame, restartGame, rollCurrentTurn } from './game/systems/gameEngine';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';
import { clearSavedGameState, loadGameState, saveGameState } from './game/systems/storageSystem';

const playerOptions = [2, 3, 4, 5, 6, 8, 10];

export default function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [gameState, setGameState] = useState(() => createInitialGame(2));
  const [muted, setMuted] = useState(isMuted());

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );

  function startGame(count: number): void {
    setPlayerCount(count);
    setGameState(createInitialGame(count));
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
    const next = restartGame(playerCount);
    setGameState(next);
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
          <p className="subtitle">Roll, move, draw action cards, dodge skips, and race to the finish with up to 10 players.</p>
        </div>

        <div className="controls-card">
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
            <span>Current Turn</span>
            <strong>{currentPlayer?.name ?? 'None'}</strong>
          </div>

          <DiceDisplay value={gameState.lastRoll} />

          <div className="button-row">
            <button className="primary" disabled={gameState.phase === 'game_over'} onClick={roll} type="button">
              Roll Dice
            </button>
            <button onClick={restart} type="button">Restart</button>
            <button onClick={save} type="button">Save</button>
            <button onClick={load} type="button">Load</button>
            <button onClick={toggleMute} type="button">{muted ? 'Unmute' : 'Mute'}</button>
          </div>
        </div>

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameState.message}</p>
        </div>

        <CardRevealModal card={gameState.lastCard} />

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
