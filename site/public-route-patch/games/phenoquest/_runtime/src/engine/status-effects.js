export const STATUS_EFFECTS = {
  wilted: {
    id: 'wilted',
    displayName: 'Wilted',
    description: 'Lower Vigor pressure state.',
    duration: 3
  },
  rootbound: {
    id: 'rootbound',
    displayName: 'Rootbound',
    description: 'Lower Speed pressure state.',
    duration: 2
  },
  unstable: {
    id: 'unstable',
    displayName: 'Unstable',
    description: 'Lower Stability pressure state.',
    duration: 2
  },
  locked_out: {
    id: 'locked_out',
    displayName: 'Locked Out',
    description: 'Team Lockout interference state.',
    duration: 2
  },
  shielded: {
    id: 'shielded',
    displayName: 'Shielded',
    description: 'Reduces pressure from the next exchange.',
    duration: 1
  },
  aroma_charged: {
    id: 'aroma_charged',
    displayName: 'Aroma Charged',
    description: 'Improves aroma-style reward potential.',
    duration: 2
  }
};

export function addStatus(combatant, statusId, duration = STATUS_EFFECTS[statusId]?.duration ?? 1) {
  const statuses = combatant.statuses ?? [];
  const existing = statuses.find((status) => status.id === statusId);
  const nextStatuses = existing
    ? statuses.map((status) => status.id === statusId ? { ...status, duration: Math.max(status.duration, duration) } : status)
    : [...statuses, { id: statusId, duration }];

  return {
    ...combatant,
    statuses: nextStatuses
  };
}

export function hasStatus(combatant, statusId) {
  return (combatant.statuses ?? []).some((status) => status.id === statusId && status.duration > 0);
}

export function tickStatuses(combatant) {
  return {
    ...combatant,
    statuses: (combatant.statuses ?? [])
      .map((status) => ({ ...status, duration: status.duration - 1 }))
      .filter((status) => status.duration > 0)
  };
}

export function getStatusSummary(combatant) {
  return (combatant.statuses ?? [])
    .map((status) => `${STATUS_EFFECTS[status.id]?.displayName ?? status.id} (${status.duration})`)
    .join(', ');
}
