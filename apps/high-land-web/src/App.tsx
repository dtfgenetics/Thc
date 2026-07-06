import { useEffect, useMemo, useState } from 'react';
import { PhaserBoard } from './ui/PhaserBoard';
import { DiceDisplay } from './ui/DiceDisplay';
import { CardRevealModal } from './ui/CardRevealModal';
import { GameRulesPanel } from './ui/GameRulesPanel';
import { DevPanel } from './ui/DevPanel';
import { PlayerSetupForm, type PlayerSetupMode, type PlayerSetupSubmit } from './ui/PlayerSetupForm';
import { RoomLobby } from './ui/RoomLobby';
import {
  addLocalTestPlayerMode,
  createTransportRoomMode,
  joinTransportRoomMode
} from './app/highLandRoomModeService';
import { rollRoomRuntime, startRoomRuntime } from './app/highLandRoomRuntime';
import { starterActionCards } from './game/data/actionCards';
import { approvedBoardSpaceCount, boardPath } from './game/data/boardPath';
import { rollCurrentTurn } from './game/systems/gameEngine';
import { createNamedLocalGame } from './game/multiplayer/roomGameFactory';
import { parseInviteLink } from './game/multiplayer/inviteLinks';
import {
  isMuted,
  playCardSound,
  playRollSound,
  playWinSound,
  setMuted as setAudioMuted,
  startBackgroundMusic
} from './game/systems/audioSystem';
import { maxPlayers, minPlayers } from './game/systems/playerSystem';
import { canPlayerRoll } from './game/multiplayer/roomState';
import { createRoomTransport, resolveDefaultRoomTransportMode } from './game/multiplayer/roomTransportFactory';
import { getSavedLocalPlayerName } from './game/players/playerIdentity';
import type { HighLandRoomState } from './game/multiplayer/roomState';
import type { GameState } from './game/types/gameTypes';

const playerOptions = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, index) => minPlayers + index);
type ScreenMode = 'landing' | PlayerSetupMode | 'lobby' | 'playing';

export default function App() {
  const [initialInviteRoomCode] = useState(() => getInitialInviteRoomCode());
  const [playerCount, setPlayerCount] = useState(2);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(() => getInitialPlayerName());
  const [localPlayerId, setLocalPlayerId] = useState<string>('local-player-1');
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => (initialInviteRoomCode ? 'join_room' : 'landing'));
  const [room, setRoom] = useState<HighLandRoomState | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [gameState, setGameState] = useState(() => createNamedLocalGame(2, 'Player 1'));
  const [muted, setMuted] = useState(isMuted());
  const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
  const [previewCardIndex, setPreviewCardIndex] = useState<number | null>(null);
  const [cardAnimationNonce, setCardAnimationNonce] = useState(0);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [moveAnnouncement, setMoveAnnouncement] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(() =>
    initialInviteRoomCode ? `Invite detected for room ${initialInviteRoomCode}. Enter your player name to join.` : 'Choose local play, create a room, or join a room.'
  );
  const roomTransport = useMemo(() => createRoomTransport(), []);
  const roomTransportMode = useMemo(() => resolveDefaultRoomTransportMode(), []);

  const gameStarted = screenMode === 'playing';
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentSpace = currentPlayer ? boardPath[currentPlayer.positionIndex] : null;
  const winner = useMemo(
    () => gameState.players.find((player) => player.id === gameState.winnerId),
    [gameState.players, gameState.winnerId]
  );
  const previewHitCard = previewCardIndex === null ? null : starterActionCards[previewCardIndex] ?? null;
  const liveHitCard = gameState.lastCard && gameState.lastCard.id !== dismissedCardId ? gameState.lastCard : null;
  const visibleHitCard = previewHitCard ?? liveHitCard;
  const canRollNow = !room || canPlayerRoll(room, localPlayerId);
  const canRestartNow = !room || room.hostPlayerId === localPlayerId;

  useEffect(() => {
    if (!initialInviteRoomCode || !localPlayerName || screenMode !== 'join_room') return;
    let active = true;

    void joinTransportRoomMode(initialInviteRoomCode, localPlayerName, roomTransport)
      .then((result) => {
        if (!active) return;
        setRoomMode(result.room, result.localPlayerId, result.localPlayerName, result.inviteUrl, result.playerCount);
        setStatusMessage(`Reconnected to room ${result.room.code}.`);
      })
      .catch((error) => {
        if (!active) return;
        setStatusMessage(getRoomErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [initialInviteRoomCode, localPlayerName, roomTransport, screenMode]);

  useEffect(() => {
    if (!room?.code) return;

    return roomTransport.subscribe(room.code, (snapshot) => {
      if (snapshot.status === 'error') {
        setStatusMessage(snapshot.error ?? 'The room connection was interrupted.');
        return;
      }
      if (!snapshot.room) return;

      const nextRoom = snapshot.room;
      setRoom(nextRoom);
      setPlayerCount(Math.max(2, nextRoom.players.length));
      if (nextRoom.gameState) {
        setGameState(nextRoom.gameState);
        if (nextRoom.status === 'playing' || nextRoom.status === 'complete') setScreenMode('playing');
      }
    });
  }, [room?.code, roomTransport]);

  function resetTransientFeedback(): void {
    setDismissedCardId(null);
    setPreviewCardIndex(null);
    setMoveAnnouncement(null);
    setDiceAnimating(false);
  }

  async function handleSetupSubmit(setup: PlayerSetupSubmit): Promise<void> {
    startBackgroundMusic();
    resetTransientFeedback();

    if (setup.mode === 'local') {
      beginLocalGame(setup.playerCount, setup.playerName);
      return;
    }

    if (setup.mode === 'create_room') {
      try {
        const result = await createTransportRoomMode(setup.playerName, setup.playerCount, roomTransport);
        setRoomMode(result.room, result.localPlayerId, result.localPlayerName, result.inviteUrl, result.playerCount);
        setInviteInAddressBar(result.room.code);
        setStatusMessage(roomTransportMode === 'website' ? `Room ${result.room.code} is online and ready for players.` : `Room ${result.room.code} created for local testing.`);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Could not create a High Land room. Local Play is still available.');
      }
      return;
    }

    if (setup.mode === 'join_room') {
      try {
        const result = await joinTransportRoomMode(setup.roomCode ?? '', setup.playerName, roomTransport);
        setRoomMode(result.room, result.localPlayerId, result.localPlayerName, result.inviteUrl, result.playerCount);
        setInviteInAddressBar(result.room.code);
        setStatusMessage(`Joined room ${result.room.code}. Waiting for the host to start.`);
      } catch (error) {
        setStatusMessage(getRoomErrorMessage(error));
      }
    }
  }

  function beginLocalGame(count: number, playerName: string): void {
    setPlayerCount(count);
    setLocalPlayerName(playerName);
    setRoom(null);
    setInviteUrl('');
    resetTransientFeedback();
    setGameState(createNamedLocalGame(count, playerName));
    setScreenMode('playing');
    setStatusMessage(`${playerName}, roll to begin.`);
  }

  async function startRoomGame(): Promise<void> {
    if (!room) return;
    startBackgroundMusic();
    resetTransientFeedback();
    try {
      const result = await startRoomRuntime(room, localPlayerId, roomTransport);
      setRoom(result.room);
      setPlayerCount(result.playerCount);
      if (result.room.gameState) setGameState(result.room.gameState);
      setScreenMode('playing');
      setStatusMessage(result.message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not start this room.');
    }
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
    resetTransientFeedback();
    setScreenMode('landing');
    clearInviteFromAddressBar();
    setStatusMessage('Left the room. Choose a play mode.');
  }

  function startGame(count: number): void {
    startBackgroundMusic();
    resetTransientFeedback();
    const leadName = localPlayerName ?? 'Player 1';
    setPlayerCount(count);
    setRoom(null);
    setInviteUrl('');
    setGameState(createNamedLocalGame(count, leadName));
    setScreenMode('playing');
  }

  async function roll(): Promise<void> {
    if (!gameStarted || !canRollNow || diceAnimating || gameState.phase === 'game_over' || gameState.phase === 'moving' || gameState.phase === 'resolving_card') return;
    setDismissedCardId(null);
    setPreviewCardIndex(null);
    setMoveAnnouncement('Rolling the dice...');
    setDiceAnimating(true);
    window.setTimeout(() => setDiceAnimating(false), 700);
    playRollSound();

    if (room && room.status === 'playing') {
      const activeName = currentPlayer?.name ?? localPlayerName ?? 'Player';
      try {
        const result = await rollRoomRuntime(room, localPlayerId, roomTransport, getTestAwareRandom());
        const nextGameState = result.room.gameState;
        if (!nextGameState) return;
        setMoveAnnouncement(describeDiceMove(activeName, nextGameState));
        if (nextGameState.lastCard) playCardSound();
        if (nextGameState.winnerId) playWinSound();
        setRoom(result.room);
        setPlayerCount(result.playerCount);
        setGameState(nextGameState);
        setStatusMessage(result.message);
      } catch (error) {
        setMoveAnnouncement(null);
        setStatusMessage(error instanceof Error ? error.message : 'The roll could not be synchronized.');
      }
      return;
    }

    const activeName = currentPlayer?.name ?? localPlayerName ?? 'Player';
    const next = rollCurrentTurn(gameState, getTestAwareRandom());
    setMoveAnnouncement(describeDiceMove(activeName, next));
    if (next.lastCard) playCardSound();
    if (next.winnerId) playWinSound();
    setGameState(next);
  }

  async function restart(): Promise<void> {
    resetTransientFeedback();
    if (room) {
      try {
        const restartableRoom: HighLandRoomState = { ...room, status: 'waiting', gameState: null };
        const result = await startRoomRuntime(restartableRoom, localPlayerId, roomTransport);
        setRoom(result.room);
        setPlayerCount(result.playerCount);
        if (result.room.gameState) setGameState(result.room.gameState);
        setStatusMessage(result.message);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'The room could not be restarted.');
      }
      return;
    }

    const next = createNamedLocalGame(playerCount, localPlayerName ?? 'Player 1');
    setGameState(next);
  }

  function previewHitAnimation(): void {
    const nextIndex = previewCardIndex === null ? 0 : (previewCardIndex + 1) % starterActionCards.length;
    setDismissedCardId(null);
    setPreviewCardIndex(nextIndex);
    setCardAnimationNonce((value) => value + 1);
    playCardSound();
  }

  function dismissHitCard(): void {
    if (previewCardIndex !== null) {
      setPreviewCardIndex(null);
      return;
    }
    setDismissedCardId(gameState.lastCard?.id ?? null);
  }

  function toggleMute(): void {
    const nextMuted = !muted;
    setAudioMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) startBackgroundMusic();
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
            <p className="subtitle">Play together on one device or create an online invite room for friends.</p>
            <div className="button-row">
              <button className="primary" onClick={() => setScreenMode('local')} type="button">Local Play</button>
              <button onClick={() => setScreenMode('create_room')} type="button">Create Room</button>
              <button onClick={() => setScreenMode('join_room')} type="button">Join Room</button>
              <button onClick={previewHitAnimation} type="button">Preview HIT Animation</button>
            </div>
          </div>
        ) : null}

        {screenMode === 'local' || screenMode === 'create_room' || screenMode === 'join_room' ? (
          <PlayerSetupForm
            mode={screenMode}
            initialRoomCode={screenMode === 'join_room' ? initialInviteRoomCode : null}
            initialPlayerName={localPlayerName ?? ''}
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
            onAddLocalGuest={roomTransportMode === 'local' ? addLocalTestPlayer : undefined}
            onLeave={leaveRoom}
            onStartGame={startRoomGame}
          />
        ) : null}

        <div className="message-card">
          <strong>Status</strong>
          <p>{winner ? `${winner.name} wins!` : gameStarted ? gameState.message : statusMessage}</p>
        </div>

        {gameStarted ? (
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
        ) : null}

        <GameRulesPanel />
        {gameStarted ? <DevPanel state={gameState} /> : null}
      </section>

      {gameStarted ? (
        <section className="game-stage" aria-label="High Land game board and controls">
          <div className="board-wrap" aria-label="Game board">
            <PhaserBoard state={gameState} />
          </div>

          <div className="board-controls-card">
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

            {currentSpace ? (
              <div className="turn-box" aria-label="Current board space" style={{ borderColor: currentPlayer?.color ?? 'transparent' }}>
                <span>Current Space</span>
                <strong>
                  #{currentSpace.index + 1} • {currentSpace.color.toUpperCase()}
                  {currentSpace.label ? ` • ${currentSpace.label}` : ''}
                </strong>
                <p>{currentSpace.zone}</p>
              </div>
            ) : null}

            <DiceDisplay value={gameState.lastRoll} isRolling={diceAnimating} moveLabel={moveAnnouncement} />

            <div className="button-row board-button-row">
              <button className="primary roll-button" disabled={!canRollNow || diceAnimating || gameState.phase === 'game_over'} onClick={roll} type="button">
                Roll Dice
              </button>
              <button onClick={previewHitAnimation} type="button">Preview HIT Animation</button>
              <button disabled={!canRestartNow} onClick={restart} type="button">Restart</button>
              <button onClick={toggleMute} type="button">{muted ? 'Unmute' : 'Mute'}</button>
            </div>
          </div>
        </section>
      ) : null}

      <CardRevealModal
        key={visibleHitCard ? `${visibleHitCard.id}-${cardAnimationNonce}` : 'no-hit-card'}
        card={visibleHitCard}
        onDismiss={dismissHitCard}
      />
    </main>
  );
}

function describeDiceMove(playerName: string, state: GameState): string {
  const roll = state.lastRoll;
  if (!roll) return 'No movement this turn.';
  const hitText = state.lastCard ? ' Landed on HIT — card effect applies.' : '';
  return `${playerName} rolled ${roll}. Move ${roll} space${roll === 1 ? '' : 's'}.${hitText}`;
}

function getInitialInviteRoomCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return parseInviteLink(window.location.href);
  } catch {
    return null;
  }
}

function getInitialPlayerName(): string | null {
  if (typeof window === 'undefined') return null;
  return getSavedLocalPlayerName(window.sessionStorage) || null;
}

function setInviteInAddressBar(roomCode: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('game', roomCode);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function clearInviteFromAddressBar(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('game');
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function getRoomErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not join that room.';
  if (message.toLowerCase().includes('not found')) return 'This game invite could not be found. Create a new High Land game.';
  if (message.toLowerCase().includes('full')) return 'This High Land game is full.';
  return message;
}

function getTestAwareRandom(): () => number {
  if (typeof window === 'undefined') return Math.random;
  if (window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') return Math.random;
  const forcedRoll = Number(new URLSearchParams(window.location.search).get('hlTestRoll'));
  if (!Number.isInteger(forcedRoll) || forcedRoll < 1 || forcedRoll > 6) return Math.random;
  return () => (forcedRoll - 1) / 6 + 0.01;
}
