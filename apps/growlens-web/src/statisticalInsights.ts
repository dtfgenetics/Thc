export type NumericDistribution = {
  count: number;
  minimum: number;
  q1: number;
  median: number;
  q3: number;
  maximum: number;
  average: number;
};

export type CorrelationResult = {
  count: number;
  r: number | null;
  strength: 'insufficient-data' | 'very-weak' | 'weak' | 'moderate' | 'strong' | 'very-strong';
  direction: 'none' | 'positive' | 'negative';
};

export type LinearTrend = {
  count: number;
  slopePerDay: number | null;
  intercept: number | null;
};

function valid(values: number[]): number[] {
  return values.filter(Number.isFinite);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function quantile(values: number[], probability: number): number | null {
  const sorted = valid(values).sort((a, b) => a - b);
  if (!sorted.length || probability < 0 || probability > 1) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower));
}

export function distribution(values: number[]): NumericDistribution | null {
  const xs = valid(values);
  if (!xs.length) return null;
  const total = xs.reduce((sum, value) => sum + value, 0);
  return {
    count: xs.length,
    minimum: Math.min(...xs),
    q1: quantile(xs, .25)!,
    median: quantile(xs, .5)!,
    q3: quantile(xs, .75)!,
    maximum: Math.max(...xs),
    average: total / xs.length,
  };
}

export function pearsonCorrelation(pairs: Array<[number, number]>, minimumSamples = 5): CorrelationResult {
  const clean = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length < minimumSamples) {
    return { count: clean.length, r: null, strength: 'insufficient-data', direction: 'none' };
  }
  const meanX = clean.reduce((sum, [x]) => sum + x, 0) / clean.length;
  const meanY = clean.reduce((sum, [, y]) => sum + y, 0) / clean.length;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const [x, y] of clean) {
    const dx = x - meanX;
    const dy = y - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) {
    return { count: clean.length, r: null, strength: 'insufficient-data', direction: 'none' };
  }
  const r = Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceX * varianceY)));
  const magnitude = Math.abs(r);
  const strength = magnitude < .1 ? 'very-weak'
    : magnitude < .3 ? 'weak'
    : magnitude < .5 ? 'moderate'
    : magnitude < .7 ? 'strong'
    : 'very-strong';
  return {
    count: clean.length,
    r: round(r),
    strength,
    direction: r > .02 ? 'positive' : r < -.02 ? 'negative' : 'none',
  };
}

export function linearTrendByTime(points: Array<{ timestamp: string; value: number }>, minimumSamples = 3): LinearTrend {
  const clean = points
    .map((point) => ({ time: new Date(point.timestamp).getTime(), value: point.value }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);
  if (clean.length < minimumSamples) return { count: clean.length, slopePerDay: null, intercept: null };
  const origin = clean[0].time;
  const pairs = clean.map((point) => [(point.time - origin) / 86_400_000, point.value] as const);
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of pairs) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  if (denominator === 0) return { count: clean.length, slopePerDay: null, intercept: null };
  const slope = numerator / denominator;
  return { count: clean.length, slopePerDay: round(slope, 4), intercept: round(meanY - (slope * meanX), 4) };
}
