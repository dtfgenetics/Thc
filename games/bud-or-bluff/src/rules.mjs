export const MAX_PLAYERS = 10;
export const DEFAULT_ROUNDS = 12;
export const VOTE_SECONDS = 24;
export const REVEAL_SECONDS = 9;

export function scoreVote(vote, answer, useDouble = false) {
  const correct = vote === answer;
  if (useDouble) return { correct, delta: correct ? 2 : -1 };
  return { correct, delta: correct ? 1 : 0 };
}

export function applyVoteResult(player, vote, answer, useDouble = false) {
  const result = scoreVote(vote, answer, useDouble);
  return {
    ...player,
    score: (player.score || 0) + result.delta,
    streak: result.correct ? (player.streak || 0) + 1 : 0,
    bestStreak: result.correct ? Math.max(player.bestStreak || 0, (player.streak || 0) + 1) : (player.bestStreak || 0),
    doubleUsed: Boolean(player.doubleUsed || useDouble),
  };
}

export function rankPlayers(players) {
  return [...players].sort((a, b) => (b.score - a.score) || ((b.bestStreak || 0) - (a.bestStreak || 0)) || a.name.localeCompare(b.name));
}
