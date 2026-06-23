import { useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { GameRulesPanel } from './ui/GameRulesPanel';
import { DevPanel } from './ui/DevPanel';
import { PlayerSetupForm, type PlayerSetupMode, type PlayerSetupSubmit } from './ui/PlayerSetupForm';
import { RoomLobby } from './ui/RoomLobby';
import {
  addLocalTestPlayerMode,
  createLocalRoomMode,
  joinLocalRoomMode
} from './app/highLandRoomModeService';
import { rollRoomRuntime, startRoomRuntime } from './app/highLandRoomRuntime';
import { approvedBoardSpaceCount } from './game/data/boardPath';
import { rollCurrentTurn } from './game/systems/gameEngine';
import { createNamedLocalGame } from './game/multiplayer/roomGameFactory';
import { parseInviteLink } from './game/multiplayer/inviteLinks';
import { isMuted, playCardSound, playRollSound, playWinSound, setMuted as setAudioMuted } from './game/systems/audioSystem';
import { clearSavedGameState, loadGameState, saveGameState } from './game/systems/storageSystem';
import { maxPlayers, minPlayers } from './game/systems/playerSystem';
import type { HighLandRoomState } from './game/multiplayer/roomState';

const playerOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, index) => minPlayers + index);
type ScreenMode = 'landing' | PlayerSetupMode | 'lobby' | 'playing';

export default function App() {
  const [initialInviteRoomCode] = useState(() => getInitialInviteRoomCode());
  const [playerCount, setPlayerCount] = useState(2);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('local-player-1');
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => (initialInviteRoomCode ? 'join_room' : 'landing'));
  const [room, setRoom] = useState<HighLandRoomState | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [gameState, setGameState] = useState(() => createNamedLocalGame(2, 'Player 1'));
  const [muted, setMuted] = useState(isMuted());
  const [statusMessage, setStatusMessage] = useState(() =>
    initialInviteRoomCode ? `Invite detected for room ${initialInviteRoomCode}. Enter your player name to join.` : 'Choose local play, create a room, or join a room.'
  );

  const gameStarted = screenMode === 'playing';
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );

  function handleSetupSubmit(setup: PlayerSetupSubmit): void {
    if (setup.mode === 'local') {
      beginLocalGame(setup.playerCount, setup.playerName);
      return;
    }

    if (setup.mode === 'create_room') {
      const result = createLocalRoomMode(setup.playerName, setup.playerCount);
      setRoomMode(result.room, result.localPlayerId, result.localPlayerName, result.inviteUrl, result.playerCount);
      setStatusMessage(`Room ${result.room.code} created locally. Share the invite when Supabase sync is wired.`);
      return;
    }

    if (setup.mode === 'join_room') {
      try {
        const result = joinLocalRoomMode(setup.roomCode ?? '', setup.playerName);
        setRoomMode(result.room, result.localPlayerId, result.localPlayerName, result.inviteUrl, result.playerCount);
        setStatusMessage(`Joined local room ${result.room.code}.`);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Could not join that room.');
      }
    }
  }

  function beginLocalGame(count: number, playerName: string): void {
    setPlayerCount(count);
    setLocalPlayerName(playerName);
    setRoom(null);
    setInviteUrl('');
    setGameState(createNamedLocalGame(count, playerName));
    setScreenMode('playing');
    setStatusMessage(`${playerName}, roll to begin.`);
    clearSavedGameState();
  }

  async function startRoomGame(): Promise<void> {
    if (!room) return;
    const result = await startRoomRuntime(room);
    setRoom(result.room);
    setPlayerCount(result.playerCount);
    setLocalPlayerName(result.leadPlayerName);
    if (result.room.gameState) setGameState(result.room.gameState);
    setScreenMode('playing');
    setStatusMessage(result.message);
    clearSavedGameState();
  }

  function addLocalTestPlayer(): void {
    if (!room) return;
    try {
      const result = addLocalTestPlayerMode(room);
      setRoom(result.room);
      setInviteUrl(result.inviteUrl);
      setPlayerCount(result.playerCount);
      setScreenMode('lobby');
      setStatusMessage(`Added a local test player to room ${result.room.code}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not add another local test player.');
    }
  }

  function setRoomMode(nextRoom: HighLandRoomState, playerId: string, playerName: string, nextInviteUrl: string, count: number): void {
    setRoom(nextRoom);
    setLocalPlayerId(playerId);
    setLocalPlayerName(playerName);
    setInviteUrl(nextInviteUrl);
    setPlayerCount(count);
    setScreenMode('lobby');
  }

  function leaveRoom(): void {
    setRoom(null);
    setInviteUrl('');
    setScreenMode('landing');
    setStatusMessage('Left the room. Choose a play mode.');
  }

  function startGame(count: number): void {
    const leadName = localPlayerName ?? 'Player 1';
    setPlayerCount(count);
    setRoom(null);
    setInviteUrl('');
    setGameState(createNamedLocalGame(count, leadName));
    setScreenMode('playing');
  }

  async function roll(): Promise<void> {
    if (!gameStarted || gameState.phase === 'game_over' || gameState.phase === 'moving' || gameState.phase === 'resolving_card') return;
    playRollSound();

    if (room && room.status === 'playing') {
      const result = await rollRoomRuntime(room);
      const nextGameState = result.room.gameState;
      if (!nextGameState) return;
      if (nextGameState.lastCard) playCardSound();
      if (nextGameState.winnerId) playWinSound();
      setRoom(result.room);
      setPlayerCount(result.playerCount);
      setLocalPlayerName(result.leadPlayerName);
      setGameState(nextGameState);
      setStatusMessage(result.message);
      return;
    }

    const next = rollCurrentTurn(gameState);
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  async function restart(): Promise<void> {
    if (room) {
      const restartableRoom: HighLandRoomState = { ...room, status: 'waiting', gameState: null };
      const result = await startRoomRuntime(restartableRoom);
      setRoom(result.room);
      setPlayerCount(result.playerCount);
      setLocalPlayerName(result.leadPlayerName);
      if (result.room.gameState) setGameState(result.room.gameState);
      setStatusMessage(result.message);
      clearSavedGameState();
      return;
    }

    const next = createNamedLocalGame(playerCount, localPlayerName ?? 'Player 1');
    setGameState(next);
    clearSavedGameState();
  }

  function save(): void {
    if (room) return;
    saveGameState(gameState);
  }

  function load(): void {
    if (room) return;
    const saved = loadGameState();
    if (!saved) return;
    setRoom(null);
    setInviteUrl('');
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
          <p className="eyebrow">Browser Board Game</p>
          <h1>High Land: The Sweet Escape</h1>
          <p className="subtitle">Roll, move, draw HIT cards, handle card effects, and race to the finish with up to 10 players.</p>
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
          <PlayerSetupForm
            mode={screenMode}
            initialRoomCode={screenMode === 'join_room' ? initialInviteRoomCode : null}
            defaultPlayerCount={playerCount}
            onCancel={() => setScreenMode('landing')}
            onSubmit={handleSetupSubmit}
          />
        ) : null}

        {screenMode === 'lobby' && room ? (
          <RoomLobby
            room={room}
            localPlayerId={localPlayerId}
            inviteUrl={inviteUrl}
            onAddLocalGuest={addLocalTestPlayer}
            onLeave={leaveRoom}
            onStartGame={startRoomGame}
          />
        ) : null}

        {screenMode === 'playing' ? (
          <div className="controls-card">
            {!room ? (
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
            ) : null}

            <div className="turn-box" style={{ borderColor: currentPlayer?.color ?? 'transparent' }}>
              <span>{room ? `Room ${room.code}` : 'Current Turn'}</span>
              <strong>{currentPlayer?.name ?? 'None'}</strong>
            </div>

            <DiceDisplay value={gameState.lastRoll} />

            <div className="button-row">
              <button className="primary" disabled={gameState.phase === 'game_over'} onClick={roll} type="button">
                Roll Dice
              </button>
              <button onClick={restart} type="button">Restart</button>
              {!room ? <button onClick={save} type="button">Save</button> : null}
              {!room ? <button onClick={load} type="button">Load</button> : null}
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
                  Space {player.positionIndex + 1} of {approvedBoardSpaceCount}
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

function getInitialInviteRoomCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return parseInviteLink(window.location.href);
  } catch {
    return null;
  }
}
