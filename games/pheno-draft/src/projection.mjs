import { goalFit } from './engine.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function projectedCrossLine(currentLine, parentCard, data) {
  if (!currentLine?.traits || !parentCard?.traits || !Array.isArray(data?.traits)) {
    throw new Error('Current line, parent card, and trait data are required for a projection.');
  }

  const traits = {};
  for (const trait of data.traits) {
    const left = Number(currentLine.traits[trait.id]);
    const right = Number(parentCard.traits[trait.id]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      throw new Error(`Missing numeric trait values for ${trait.id}.`);
    }
    traits[trait.id] = Math.round((left + right) / 2);
  }

  return {
    lineId: `projection-${parentCard.id}`,
    label: `${currentLine.label} × ${parentCard.label}`,
    family: `${currentLine.family} × ${parentCard.family}`,
    hue: Math.round((Number(currentLine.hue) + Number(parentCard.hue)) / 2) % 360,
    generation: Number(currentLine.generation ?? 0) + 1,
    traits,
    sourceCardIds: [...new Set([...(currentLine.sourceCardIds ?? []), parentCard.id])]
  };
}

export function projectedCrossFit(currentLine, parentCard, goal, data) {
  return goalFit(projectedCrossLine(currentLine, parentCard, data), goal, data);
}

export function projectionSummary(currentLine, parentCard, goal, data) {
  const line = projectedCrossLine(currentLine, parentCard, data);
  const fit = goalFit(line, goal, data);
  const currentFit = goalFit(clone(currentLine), goal, data);
  return {
    fit,
    delta: fit - currentFit,
    line
  };
}
