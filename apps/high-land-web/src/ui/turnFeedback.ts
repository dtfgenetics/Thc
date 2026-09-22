import { boardPath, finishIndex } from '../game/data/boardPath';
import type { GameState } from '../game/types/gameTypes';

export function describeDiceMove(playerName: string, state: GameState): string {
  const roll = state.lastRoll;
  const move = state.lastMove;

  if (!roll || !move) return state.message || 'No movement this turn.';

  const movedSpaces = move.traversedIndexes.length;
  const destination = boardPath[move.toIndex];
  const spaceWord = movedSpaces === 1 ? 'space' : 'spaces';
  const destinationLabel = destination?.type === 'finish'
    ? 'FINISH'
    : destination?.label === 'HIT'
      ? 'HIT'
      : `space ${move.toIndex + 1}`;

  const clampedAtFinish = move.toIndex === finishIndex && movedSpaces < roll;
  const movementText = clampedAtFinish
    ? `Moved ${movedSpaces} ${spaceWord} to FINISH; the board ended before all ${roll} rolled spaces were needed.`
    : `Moved ${movedSpaces} ${spaceWord} to ${destinationLabel}.`;

  const hitText = destination?.action === 'draw_hit_card'
    ? ' HIT card effect applies after the dice move.'
    : '';

  return `${playerName} rolled ${roll}. ${movementText}${hitText}`;
}
