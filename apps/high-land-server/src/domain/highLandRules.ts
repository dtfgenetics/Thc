import { findColorSpace, isHighLandActionSpace } from './highLandBoard.js';
import { drawHighLandCard } from './highLandCards.js';
import {
  HIGH_LAND_FINISH_INDEX,
  type ActionCard,
  type ActionCardEffect,
  type AuthoritativeGameState,
  type GamePlayer,
  type TurnDirection
} from './roomTypes.js';

export function rollHighLandTurn(state: AuthoritativeGameState, random: () => number): AuthoritativeGameState {
  if (state.phase === 'game_over') return state;
  const nextState = structuredClone(state);
  const currentPlayer = nextState.players[nextState.currentPlayerIndex];
  if (!currentPlayer) return nextState;

  if (currentPlayer.skipTurns > 0) {
    currentPlayer.skipTurns -= 1;
    const direction = reduceReverseTurnCounter(nextState);
    nextState.turnDirection = direction.turnDirection;
    nextState.reverseTurnsRemaining = direction.reverseTurnsRemaining;
    nextState.currentPlayerIndex = nextPlayerIndex(nextState.players, nextState.currentPlayerIndex, nextState.turnDirection);
    nextState.phase = 'ready';
    nextState.lastRoll = null;
    nextState.lastMove = null;
    nextState.lastCard = null;
    nextState.message = `${currentPlayer.name} skipped this turn.`;
    return nextState;
  }

  const roll = rollDie(random);
  const fromIndex = currentPlayer.positionIndex;
  const toIndex = clampPosition(fromIndex + roll);
  currentPlayer.positionIndex = toIndex;
  nextState.lastRoll = roll;
  nextState.lastMove = {
    playerId: currentPlayer.id,
    fromIndex,
    toIndex,
    traversedIndexes: createTraversedIndexes(fromIndex, toIndex)
  };
  nextState.lastCard = null;

  if (toIndex >= HIGH_LAND_FINISH_INDEX) {
    nextState.phase = 'game_over';
    nextState.winnerId = currentPlayer.id;
    nextState.message = `${currentPlayer.name} rolled ${roll} and reached the finish.`;
    return nextState;
  }

  if (isHighLandActionSpace(toIndex)) {
    const drawnCard = drawHighLandCard(random);
    nextState.cardCursor += 1;
    nextState.phase = 'resolving_card';
    nextState.lastCard = drawnCard;
    nextState.message = `${currentPlayer.name} rolled ${roll}, landed on HIT, and drew ${drawnCard.title}.`;
    return applyHighLandCard(nextState, drawnCard, random);
  }

  const direction = reduceReverseTurnCounter(nextState);
  nextState.turnDirection = direction.turnDirection;
  nextState.reverseTurnsRemaining = direction.reverseTurnsRemaining;
  nextState.currentPlayerIndex = nextPlayerIndex(nextState.players, nextState.currentPlayerIndex, nextState.turnDirection);
  nextState.phase = 'ready';
  nextState.message = `${currentPlayer.name} rolled ${roll} and moved to space ${currentPlayer.positionIndex + 1}.`;
  return nextState;
}

export function applyHighLandCard(
  state: AuthoritativeGameState,
  card: ActionCard,
  random: () => number,
  chainDepth = 0
): AuthoritativeGameState {
  const nextState = structuredClone(state);
  const currentPlayer = nextState.players[nextState.currentPlayerIndex];
  if (!currentPlayer) return nextState;

  const resolution = applyEffect(nextState, currentPlayer, card.effect, random);
  const winner = findWinner(resolution.state.players);
  resolution.state.lastCard = card;
  resolution.state.phase = winner ? 'game_over' : 'ready';
  resolution.state.winnerId = winner?.id ?? null;
  resolution.state.currentPlayerIndex = winner || resolution.keepTurn || resolution.drawAgain
    ? state.currentPlayerIndex
    : nextPlayerIndex(resolution.state.players, state.currentPlayerIndex, resolution.state.turnDirection);
  resolution.state.message = winner
    ? `${winner.name} reached the finish.`
    : `${currentPlayer.name}: ${card.title}. ${card.text}`;

  if (resolution.drawAgain && !winner && chainDepth < 2) {
    const nextCard = drawHighLandCard(random);
    resolution.state.cardCursor += 1;
    resolution.state.lastCard = nextCard;
    resolution.state.phase = 'resolving_card';
    return applyHighLandCard(resolution.state, nextCard, random, chainDepth + 1);
  }

  return resolution.state;
}

type EffectResolution = {
  state: AuthoritativeGameState;
  keepTurn: boolean;
  drawAgain: boolean;
};

function applyEffect(
  state: AuthoritativeGameState,
  currentPlayer: GamePlayer,
  effect: ActionCardEffect,
  random: () => number
): EffectResolution {
  let nextState = state;
  let keepTurn = false;
  let drawAgain = false;

  switch (effect.type) {
    case 'move':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      break;
    case 'skip_turns':
      nextState = updatePlayer(nextState, currentPlayer.id, (player) => ({
        ...player,
        skipTurns: player.skipTurns + effect.amount
      }));
      break;
    case 'go_to_space':
      nextState = setPlayerPosition(nextState, currentPlayer.id, effect.index);
      break;
    case 'swap_position':
      nextState = swapWithTarget(nextState, currentPlayer, effect.target, random);
      break;
    case 'roll_again':
      keepTurn = true;
      break;
    case 'move_to_color': {
      const target = findColorSpace(currentPlayer.positionIndex, effect.color, effect.direction);
      if (target !== null) nextState = setPlayerPosition(nextState, currentPlayer.id, target);
      break;
    }
    case 'move_all': {
      const targets = filterPlayersForGroupMove(nextState.players, currentPlayer, effect.filter);
      for (const player of targets) nextState = movePlayer(nextState, player.id, effect.amount);
      break;
    }
    case 'move_leader': {
      const leader = findLeader(nextState.players);
      if (leader) nextState = movePlayer(nextState, leader.id, effect.amount);
      break;
    }
    case 'reverse_turn_order':
      nextState = {
        ...nextState,
        turnDirection: nextState.turnDirection === 1 ? -1 : 1,
        reverseTurnsRemaining: effect.turns
      };
      break;
    case 'protect_from_backward':
      nextState = updatePlayer(nextState, currentPlayer.id, (player) => ({
        ...player,
        protectedFromBackward: player.protectedFromBackward + effect.uses
      }));
      break;
    case 'draw_again':
      drawAgain = true;
      break;
    case 'move_and_roll_again':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      keepTurn = true;
      break;
    case 'move_and_draw_again':
      nextState = movePlayer(nextState, currentPlayer.id, effect.amount);
      drawAgain = true;
      break;
    case 'skip_others':
      nextState = {
        ...nextState,
        players: nextState.players.map((player) =>
          player.id === currentPlayer.id ? player : { ...player, skipTurns: player.skipTurns + effect.amount }
        )
      };
      break;
    case 'choose_player_move': {
      nextState = movePlayer(nextState, currentPlayer.id, effect.currentAmount);
      const updatedCurrentPlayer = nextState.players.find((player) => player.id === currentPlayer.id) ?? currentPlayer;
      const target = findPlayerBehind(nextState.players, updatedCurrentPlayer)
        ?? pickRandomOtherPlayer(nextState.players, currentPlayer.id, random);
      if (target) nextState = movePlayer(nextState, target.id, effect.targetAmount);
      break;
    }
  }

  return { state: nextState, keepTurn, drawAgain };
}

function movePlayer(state: AuthoritativeGameState, playerId: string, amount: number): AuthoritativeGameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId) return player;
      if (amount < 0 && player.protectedFromBackward > 0) {
        return { ...player, protectedFromBackward: player.protectedFromBackward - 1 };
      }
      return { ...player, positionIndex: clampPosition(player.positionIndex + amount) };
    })
  };
}

function setPlayerPosition(state: AuthoritativeGameState, playerId: string, positionIndex: number): AuthoritativeGameState {
  return updatePlayer(state, playerId, (player) => ({ ...player, positionIndex: clampPosition(positionIndex) }));
}

function updatePlayer(
  state: AuthoritativeGameState,
  playerId: string,
  updater: (player: GamePlayer) => GamePlayer
): AuthoritativeGameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player))
  };
}

function swapWithTarget(
  state: AuthoritativeGameState,
  currentPlayer: GamePlayer,
  targetType: 'leader' | 'random' | 'behind' | 'last_place',
  random: () => number
): AuthoritativeGameState {
  let target: GamePlayer | null = null;
  if (targetType === 'leader') target = findLeader(state.players);
  if (targetType === 'last_place') target = findLastPlace(state.players);
  if (targetType === 'behind') target = findPlayerBehind(state.players, currentPlayer);
  if (targetType === 'random') target = pickRandomOtherPlayer(state.players, currentPlayer.id, random);
  if (!target || target.id === currentPlayer.id) return state;

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === currentPlayer.id) return { ...player, positionIndex: target.positionIndex };
      if (player.id === target.id) return { ...player, positionIndex: currentPlayer.positionIndex };
      return player;
    })
  };
}

function filterPlayersForGroupMove(
  players: GamePlayer[],
  currentPlayer: GamePlayer,
  filter: 'everyone' | 'except_current' | 'ahead' | 'behind'
): GamePlayer[] {
  if (filter === 'everyone') return players;
  if (filter === 'except_current') return players.filter((player) => player.id !== currentPlayer.id);
  if (filter === 'ahead') return players.filter((player) => player.positionIndex > currentPlayer.positionIndex);
  return players.filter((player) => player.positionIndex < currentPlayer.positionIndex);
}

function findLeader(players: GamePlayer[]): GamePlayer | null {
  return [...players].sort((left, right) => right.positionIndex - left.positionIndex)[0] ?? null;
}

function findLastPlace(players: GamePlayer[]): GamePlayer | null {
  return [...players].sort((left, right) => left.positionIndex - right.positionIndex)[0] ?? null;
}

function findPlayerBehind(players: GamePlayer[], currentPlayer: GamePlayer): GamePlayer | null {
  return [...players]
    .filter((player) => player.id !== currentPlayer.id && player.positionIndex < currentPlayer.positionIndex)
    .sort((left, right) => right.positionIndex - left.positionIndex)[0] ?? null;
}

function pickRandomOtherPlayer(players: GamePlayer[], currentPlayerId: string, random: () => number): GamePlayer | null {
  const candidates = players.filter((player) => player.id !== currentPlayerId);
  if (candidates.length === 0) return null;
  const value = Math.max(0, Math.min(0.999999999999, random()));
  return candidates[Math.floor(value * candidates.length)] ?? candidates[0];
}

function findWinner(players: GamePlayer[]): GamePlayer | null {
  return players.find((player) => player.positionIndex >= HIGH_LAND_FINISH_INDEX) ?? null;
}

function reduceReverseTurnCounter(state: AuthoritativeGameState): Pick<AuthoritativeGameState, 'turnDirection' | 'reverseTurnsRemaining'> {
  if (state.reverseTurnsRemaining <= 0) {
    return { turnDirection: state.turnDirection, reverseTurnsRemaining: 0 };
  }
  const remaining = state.reverseTurnsRemaining - 1;
  const turnDirection: TurnDirection = remaining <= 0 ? 1 : state.turnDirection;
  return { turnDirection, reverseTurnsRemaining: remaining };
}

function nextPlayerIndex(players: GamePlayer[], currentIndex: number, direction: TurnDirection): number {
  if (players.length === 0) return 0;
  return (currentIndex + direction + players.length) % players.length;
}

function rollDie(random: () => number): number {
  const value = Math.max(0, Math.min(0.999999999999, random()));
  return Math.floor(value * 6) + 1;
}

function clampPosition(positionIndex: number): number {
  return Math.max(0, Math.min(HIGH_LAND_FINISH_INDEX, positionIndex));
}

function createTraversedIndexes(fromIndex: number, toIndex: number): number[] {
  const indexes: number[] = [];
  const direction = toIndex >= fromIndex ? 1 : -1;
  for (let index = fromIndex + direction; direction > 0 ? index <= toIndex : index >= toIndex; index += direction) {
    indexes.push(index);
  }
  return indexes;
}
