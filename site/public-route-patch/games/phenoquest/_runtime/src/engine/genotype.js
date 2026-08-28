const MARKER_SCORE = {
  low: 0,
  locked: 0,
  normal: 1,
  open: 1,
  high: 2,
  rare: 3,
  unstable: -1
};

export function getMarkerScore(value) {
  return MARKER_SCORE[value] ?? 0;
}

export function scoreMarkers(markers = {}) {
  return Object.values(markers).reduce((sum, value) => sum + getMarkerScore(value), 0);
}

export function mergeMarkerBias(parentMarkersA = {}, parentMarkersB = {}, ruleBias = {}) {
  const output = {};
  const markerIds = new Set([
    ...Object.keys(parentMarkersA),
    ...Object.keys(parentMarkersB),
    ...Object.keys(ruleBias)
  ]);

  for (const markerId of markerIds) {
    output[markerId] = ruleBias[markerId] ?? pickHigherMarker(parentMarkersA[markerId], parentMarkersB[markerId]);
  }

  return output;
}

export function pickHigherMarker(valueA = 'normal', valueB = 'normal') {
  return getMarkerScore(valueA) >= getMarkerScore(valueB) ? valueA : valueB;
}

export function estimateMarkerQuality(markers = {}) {
  const score = scoreMarkers(markers);
  if (score >= 15) return 'keeper_candidate';
  if (score >= 10) return 'strong';
  if (score >= 5) return 'stable';
  return 'weak';
}
