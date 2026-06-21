import { useState } from 'react';
import { createInitialGame } from './game/systems/gameEngine';
import type { GameState } from './game/types/gameTypes';
import { useHighLandRoom } from './multiplayer/useHighLandRoom';
import { GameScreen } from './ui/GameScreen';
import { LobbyScreen } from './ui/LobbyScreen';
import { SetupScreen } from './ui/SetupScreen';

export default function App() {
  const multiplayer = useHighLandRoom();
  const [localGame, setLocalGame] = useState<GameState | null>(null);
  const inviteRequested = new URLSearchParams(window.location.search).has('game');

  function startLocal(names: string[]): void {
    setLocalGame(createInitialGame(names.length, names));
  }

  function leaveOnline(): void {
    multiplayer.leave();
  }

  if (localGame) {
    return (
      <GameScreen
        gameState={localGame}
        mode="local"
        onExit={() => setLocalGame(null)}
        onStateChange={(nextState) => {
          setLocalGame(nextState);
          return true;
        }}
      />
    );
  }

  if (multiplayer.room?.gameState && multiplayer.credentials && multiplayer.room.status !== 'lobby') {
    return (
      <GameScreen
        actionPending={multiplayer.actionPending}
        connectionStatus={multiplayer.connectionStatus}
        gameState={multiplayer.room.gameState}
        mode="online"
        onlinePlayerId={multiplayer.credentials.playerId}
        onExit={leaveOnline}
        onStateChange={multiplayer.commit}
        roomCode={multiplayer.room.gameId}
      />
    );
  }

  if (multiplayer.room && multiplayer.credentials) {
    return (
      <LobbyScreen
        busy={multiplayer.actionPending}
        connectionStatus={multiplayer.connectionStatus}
        credentials={multiplayer.credentials}
        error={multiplayer.error}
        onLeave={leaveOnline}
        onLocalFallback={() => {
          multiplayer.leave();
          startLocal(['']);
        }}
        onStart={() => void multiplayer.start()}
        room={multiplayer.room}
      />
    );
  }

  return (
    <SetupScreen
      busy={multiplayer.actionPending}
      error={multiplayer.error}
      inviteGameId={multiplayer.inviteGameId}
      inviteRequested={inviteRequested}
      inviteStatus={multiplayer.inviteStatus}
      onCreateRoom={(name) => void multiplayer.create(name)}
      onJoinRoom={(name) => void multiplayer.join(name)}
      onStartLocal={startLocal}
    />
  );
}
