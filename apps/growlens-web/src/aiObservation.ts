export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualRegion = {
  label: string;
  confidence: number | null;
  box?: NormalizedBoundingBox;
};

export type VisualObservationEvidence = {
  providerId: string;
  modelId: string;
  mediaRef: string;
  observedAt: string;
  summary: string;
  visibleFindings: string[];
  regions: VisualRegion[];
  limitations: string[];
};

export type CanonicalVisualObservation = {
  schema: 'growlens-visual-observation';
  version: 1;
  id: string;
  source: {
    providerId: string;
    modelId: string;
    mediaRef: string;
  };
  observedAt: string;
  evidence: {
    summary: string;
    visibleFindings: string[];
    regions: VisualRegion[];
    limitations: string[];
  };
  diagnosticClaims: [];
  reviewState: 'machine-observation';
};

function cleanText(value: unknown, max = 1000): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanList(values: unknown, maxItems = 40, maxLength = 160): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function finite01(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeBox(value: unknown): NormalizedBoundingBox | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width: Math.min(1, width),
    height: Math.min(1, height),
  };
}

export function normalizeVisualObservation(input: VisualObservationEvidence): CanonicalVisualObservation {
  const providerId = cleanText(input.providerId, 80);
  const modelId = cleanText(input.modelId, 120);
  const mediaRef = cleanText(input.mediaRef, 240);
  const observedAt = new Date(input.observedAt).toISOString();
  if (!providerId || !modelId || !mediaRef) throw new Error('providerId, modelId, and mediaRef are required.');

  const regions = (Array.isArray(input.regions) ? input.regions : [])
    .map((region) => ({
      label: cleanText(region?.label, 120),
      confidence: finite01(region?.confidence),
      ...(normalizeBox(region?.box) ? { box: normalizeBox(region?.box) } : {}),
    }))
    .filter((region) => region.label)
    .slice(0, 80);

  const visibleFindings = cleanList(input.visibleFindings);
  const limitations = cleanList(input.limitations, 20, 240);
  const summary = cleanText(input.summary, 2000);
  const stableKey = [providerId, modelId, mediaRef, observedAt].join('|');
  let hash = 2166136261;
  for (let i = 0; i < stableKey.length; i += 1) {
    hash ^= stableKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return {
    schema: 'growlens-visual-observation',
    version: 1,
    id: `gvo-${(hash >>> 0).toString(16).padStart(8, '0')}`,
    source: { providerId, modelId, mediaRef },
    observedAt,
    evidence: { summary, visibleFindings, regions, limitations },
    diagnosticClaims: [],
    reviewState: 'machine-observation',
  };
}

export function visualObservationToSymptomCandidates(
  observation: CanonicalVisualObservation,
): string[] {
  return [...new Set([
    ...observation.evidence.visibleFindings,
    ...observation.evidence.regions.map((region) => region.label),
  ].map((value) => cleanText(value, 120)).filter(Boolean))].slice(0, 50);
}
