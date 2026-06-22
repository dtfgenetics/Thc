import { useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { GameRulesPanel } from './ui/GameRulesPanel';
import { DevPanel } from './ui/DevPanel';
import { PlayerSetupForm, type PlayerSetupMode, type PlayerSetupSubmit } from './ui/PlayerSetupForm';
import { RoomLobby } from './ui/RoomLobby';
import { createInitialGame, rollCurrentTurn } from './game/systems/gameEngine';
import { tokenColors, tokenOrder } from './game/systems/playerSystem';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';
import { clearSavedGameState, loadGameState, saveGameState } from './game/systems/storageSystem';
import { createInviteLink } from './game/multiplayer/inviteLinks';
import { createLocalRoom, joinLocalRoom, type LocalRoomPlayerInput } from './game/multiplayer/localRoomRepository';
import type { HighLandRoomState } from './game/multiplayer/roomState';
import type { GameState } from './game/types/gameTypes';

const playerOptions = [2, 3, 4, 5, 6, 8, 10];
type ScreenMode = 'landing' | PlayerSetupMode | 'lobby' | 'playing';

export default function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('local-player-1');
  const [screenMode, setScreenMode] = useState<ScreenMode>('landing');
  const [room, setRoom] = useState<HighLandRoomState | null>(null);
  const [gameState, setGameState] = useState(() => createNamedGame(2, 'Player 1'));
  const [muted, setMuted] = useState(isMuted());
  const [statusMessage, setStatusMessage] = useState('Choose local play, create a room, or join a room.');

  const gameStarted = screenMode === 'playing';
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );
  const inviteUrl = room ? createInviteLink(room.code).url : '';

  function handleSetupSubmit(setup: PlayerSetupSubmit): void {
    if (setup.mode === 'local') {
      beginLocalGame(setup.playerCount, setup.playerName);
      return;
    }

    if (setup.mode === 'create_room') {
      const hostPlayer = createRoomPlayer(setup.playerName, 0);
      const nextRoom = createLocalRoom(hostPlayer);
      setRoom(nextRoom);
      setLocalPlayerId(hostPlayer.id);
      setLocalPlayerName(setup.playerName);
      setPlayerCount(setup.playerCount);
      setScreenMode('lobby');
      setStatusMessage(`Room ${nextRoom.code} created locally. Share the invite when Supabase sync is wired.`);
      return;
    }

    if (setup.mode === 'join_room') {
      try {
        const code = setup.roomCode ?? '';
        const joinedPlayer = createRoomPlayer(setup.playerName, 1);
        const nextRoom = joinLocalRoom(code, joinedPlayer);
        setRoom(nextRoom);
        setLocalPlayerId(joinedPlayer.id);
        setLocalPlayerName(setup.playerName);
        setPlayerCount(Math.max(2, nextRoom.players.length));
        setScreenMode('lobby');
        setStatusMessage(`Joined local room ${nextRoom.code}.`);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Could not join that room.');
      }
    }
  }

  function beginLocalGame(count: number, playerName: string): void {
    setPlayerCount(count);
    setLocalPlayerName(playerName);
    setRoom(null);
    setGameState(createNamedGame(count, playerName));
    setScreenMode('playing');
    setStatusMessage(`${playerName}, roll to begin.`);
    clearSavedGameState();
  }

  function startRoomGame(): void {
    if (!room) return;
    const leadName = room.players[0]?.name ?? localPlayerName ?? 'Player 1';
    const count = Math.max(2, room.players.length);
    setPlayerCount(count);
    setGameState(createNamedGame(count, leadName, room.players.map((player) => player.name)));
    setScreenMode('playing');
    setStatusMessage(`${leadName}, roll to begin.`);
    clearSavedGameState();
  }

  function leaveRoom(): void {
    setRoom(null);
    setScreenMode('landing');
    setStatusMessage('Left the room. Choose a play mode.');
  }

  function startGame(count: number): void {
    const leadName = localPlayerName ?? 'Player 1';
    setPlayerCount(count);
    setGameState(createNamedGame(count, leadName));
    setScreenMode('playing');
  }

  function roll(): void {
    if (!gameStarted || gameState.phase === 'game_over' || gameState.phase === 'moving' || gameState.phase === 'resolving_card') return;
    playRollSound();
    const next = rollCurrentTurn(gameState);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  function restart(): void {
    const next = createNamedGame(playerCount, localPlayerName ?? 'Player 1');
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
    setLocalPlayerName(saved.players[0]?.name ?? null);
    setGameState(saved);
    setScreenMode('playing');
    setStatusMessage('Saved game loaded.');
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

        {screenMode === 'landing' ? (
          <div className="controls-card">
            <p className="eyebrow">Choose Mode</p>
            <h2>Start High Land</h2>
            <p className="subtitle">Local play works now. Room flow is a local fallback until Supabase sync is connected.</p>
            <div className="button-row">
              <button className="primary" onClick={() => setScreenMode('local')} type="button">Local Play</button>
              <button onClick={() => setScreenMode('create_room')} type="button">Create Room</button>
              <button onClick={() => setScreenMode('join_room')} type="button">Join Room</button>
              <button onClick={load} type="button">Load Saved</button>
            </div>
          </div>
        ) : null}

        {screenMode === 'local' || screenMode === 'create_room' || screenMode === 'join_room' ? (
          <PlayerSetupForm mode={screenMode} defaultPlayerCount={playerCount} onCancel={() => setScreenMode('landing')} onSubmit={handleSetupSubmit} />
        ) : null}

        {screenMode === 'lobby' && room ? (
          <RoomLobby room={room} localPlayerId={localPlayerId} inviteUrl={inviteUrl} onLeave={leaveRoom} onStartGame={startRoomGame} />
        ) : null}

        {screenMode === 'playing' ? (
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
        ) : null}

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameStarted ? gameState.message : statusMessage}</p>
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

function createNamedGame(playerCount: number, playerName: string, playerNames: string[] = []): GameState {
  const game = createInitialGame(playerCount);
  const leadName = playerName.trim().replace(/\s+/g, ' ') || 'Player 1';
  const names = playerNames.length > 0 ? playerNames : [leadName];

  return {
    ...game,
    players: game.players.map((player, index) => ({ ...player, name: names[index] ?? player.name })),
    message: `${leadName}, roll to begin.`
  };
}

function createRoomPlayer(playerName: string, index: number): LocalRoomPlayerInput {
  const tokenIndex = Math.max(0, Math.min(index, tokenOrder.length - 1));

  return {
    id: `local-player-${tokenIndex + 1}`,
    name: playerName.trim().replace(/\s+/g, ' ') || `Player ${tokenIndex + 1}`,
    token: tokenOrder[tokenIndex],
    color: tokenColors[tokenIndex]
  };
}
