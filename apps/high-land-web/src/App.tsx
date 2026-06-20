import { useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { createInitialGame, restartGame, rollCurrentTurn } from './game/systems/gameEngine';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';

const playerOptions = [2, 3, 4];

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
    if (gameState.phase === 'game_over') return;
    playRollSound();
    const next = rollCurrentTurn(gameState);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  function restart(): void {
    setGameState(restartGame(playerCount));
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
          <p className="subtitle">Roll, move, draw action cards, dodge skips, and race to the finish.</p>
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

          <div className="turn-box">
            <span>Current Turn</span>
            <strong>{currentPlayer?.name ?? 'None'}</strong>
          </div>

          <div className="dice-box">
            <span>Last Roll</span>
            <strong>{gameState.lastRoll ?? '-'}</strong>
          </div>

          <div className="button-row">
            <button className="primary" disabled={gameState.phase === 'game_over'} onClick={roll} type="button">
              Roll Dice
            </button>
            <button onClick={restart} type="button">Restart</button>
            <button onClick={toggleMute} type="button">{muted ? 'Unmute' : 'Mute'}</button>
          </div>
        </div>

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameState.message}</p>
          {gameState.lastCard && (
            <div className="card-readout">
              <span>Last Card</span>
              <strong>{gameState.lastCard.title}</strong>
              <p>{gameState.lastCard.text}</p>
            </div>
          )}
        </div>

        <div className="players-card">
          {gameState.players.map((player) => (
            <article className="player-chip" key={player.id} style={{ borderColor: player.color }}>
              <span className="token-dot" style={{ background: player.color }} />
              <div>
                <strong>{player.name}</strong>
                <p>Space {player.positionIndex} {player.skipTurns > 0 ? `• Skip x${player.skipTurns}` : ''}</p>
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
