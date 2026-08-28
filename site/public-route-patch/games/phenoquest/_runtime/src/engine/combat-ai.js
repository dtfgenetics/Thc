export function chooseEnemyAction({ opponent, player, actions }) {
  const usableActions = (actions ?? []).filter(Boolean);
  if (!usableActions.length) return null;

  const lowVigor = opponent.vigor <= Math.ceil(opponent.maxVigor * 0.35);
  const guardAction = usableActions.find((action) => action.category === 'guard');
  const statusAction = usableActions.find((action) => action.category === 'status');
  const damageActions = usableActions.filter((action) => (action.power ?? 0) > 0);

  if (lowVigor && guardAction) return guardAction;
  if (player.stability <= 3 && damageActions.length) return pickHighestPowerAction(damageActions);
  if (statusAction && opponent.stability >= 5) return statusAction;

  return pickHighestPowerAction(damageActions) ?? usableActions[0];
}

export function pickHighestPowerAction(actions) {
  return [...(actions ?? [])].sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0] ?? null;
}
