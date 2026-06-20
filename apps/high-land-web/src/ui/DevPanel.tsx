import type { GameState } from '../game/types/gameTypes';

type DevPanelProps = {
  state: GameState;
};

export function DevPanel({ state }: DevPanelProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <details className="message-card">
      <summary>Developer State</summary>
      <pre>{JSON.stringify({
        phase: state.phase,
        currentPlayerIndex: state.currentPlayerIndex,
        turnDirection: state.turnDirection,
        reverseTurnsRemaining: state.reverseTurnsRemaining,
        lastRoll: state.lastRoll,
        lastCard: state.lastCard?.id,
        winnerId: state.winnerId,
        cardCursor: state.cardCursor,
        players: state.players.map((player) => ({
          id: player.id,
          positionIndex: player.positionIndex,
          skipTurns: player.skipTurns,
          protectedFromBackward: player.protectedFromBackward
        }))
      }, null, 2)}</pre>
    </details>
  );
}
