import type { ObservationPlantLocation, ObservationTissue } from './types';

export type DiagnosticEvidenceQuality = 'pattern' | 'contextual' | 'direct';

export type DiagnosticContext = {
  locationOnPlant?: ObservationPlantLocation | '';
  tissue?: ObservationTissue | '';
};

export type DiagnosticResult = {
  cause: string;
  confidence: 'low' | 'medium' | 'high';
  evidenceQuality: DiagnosticEvidenceQuality;
  score: number;
  evidence: string[];
  contextualEvidence: string[];
  conflicts: string[];
  verifyNext: string[];
};

type Rule = {
  cause: string;
  supports: Record<string, number>;
  conflicts: Record<string, number>;
  directSymptoms?: string[];
  locations?: Partial<Record<ObservationPlantLocation, number>>;
  tissues?: Partial<Record<ObservationTissue, number>>;
  verifyNext: string[];
};

const rules: Rule[] = [
  {
    cause: 'Possible nitrogen deficiency',
    supports: { 'older-leaves-yellow': 3, 'slow-growth': 1, 'uniform-pale-color': 2 },
    conflicts: { 'new-growth-yellow': 2, 'leaf-tips-burned': 1 },
    locations: { 'lower-canopy': 1 },
    tissues: { leaf: 1 },
    verifyNext: ['Confirm yellowing begins on older leaves.', 'Review recent feed strength and root-zone pH.', 'Check whether the plant is naturally fading late in flower.'],
  },
  {
    cause: 'Possible magnesium deficiency or uptake issue',
    supports: { 'interveinal-yellowing': 3, 'older-leaves-yellow': 1, 'rust-spots': 2 },
    conflicts: { 'new-growth-twisted': 2 },
    locations: { 'lower-canopy': 1 },
    tissues: { leaf: 1 },
    verifyNext: ['Inspect whether veins remain green between yellow areas.', 'Measure root-zone pH before adding supplements.', 'Compare symptoms across plants sharing the same irrigation.'],
  },
  {
    cause: 'Possible calcium deficiency or transport issue',
    supports: { 'new-growth-twisted': 3, 'rust-spots': 2, 'leaf-edges-necrotic': 1 },
    conflicts: { 'older-leaves-yellow': 1 },
    locations: { 'new-growth': 1, 'upper-canopy': 1 },
    tissues: { leaf: 1, flower: 1 },
    verifyNext: ['Inspect the newest growth and active growing tips.', 'Check transpiration conditions and root-zone moisture.', 'Review water source and substrate buffering.'],
  },
  {
    cause: 'Possible overwatering or low root-zone oxygen',
    supports: { 'drooping-wet-medium': 4, 'slow-growth': 1, 'lower-leaf-yellowing': 2 },
    conflicts: { 'drooping-dry-medium': 3 },
    directSymptoms: ['drooping-wet-medium'],
    locations: { 'whole-plant': 1, 'root-zone': 1 },
    verifyNext: ['Check pot weight and moisture at depth.', 'Confirm drainage and root-zone aeration.', 'Inspect roots for odor, discoloration, or decay if safe to do so.'],
  },
  {
    cause: 'Possible underwatering',
    supports: { 'drooping-dry-medium': 4, 'leaf-edges-dry': 2 },
    conflicts: { 'drooping-wet-medium': 3 },
    directSymptoms: ['drooping-dry-medium'],
    locations: { 'whole-plant': 1, 'root-zone': 1 },
    verifyNext: ['Check container weight and moisture at root depth.', 'Confirm irrigation volume reaches the full root ball.', 'Observe recovery after a measured irrigation.'],
  },
  {
    cause: 'Possible excessive light or heat stress',
    supports: { 'top-leaves-bleached': 4, 'leaf-edges-curl-up': 2, canoeing: 2 },
    conflicts: { 'lower-leaves-only': 2 },
    locations: { 'upper-canopy': 1, 'new-growth': 1 },
    tissues: { leaf: 1 },
    verifyNext: ['Measure PPFD at the affected canopy height.', 'Compare leaf-surface and room temperature.', 'Look for a gradient that worsens nearest the fixture.'],
  },
  {
    cause: 'Possible nutrient excess or high root-zone EC',
    supports: { 'leaf-tips-burned': 3, 'dark-green-leaves': 2, clawing: 2 },
    conflicts: { 'uniform-pale-color': 1 },
    tissues: { leaf: 1 },
    verifyNext: ['Measure input and runoff or substrate EC using a consistent method.', 'Review recent feed changes and dryback.', 'Check whether symptoms progressed after concentration increased.'],
  },
  {
    cause: 'Possible pest pressure',
    supports: { stippling: 3, webbing: 5, 'silver-streaks': 3, 'visible-insects': 5 },
    conflicts: {},
    directSymptoms: ['webbing', 'visible-insects'],
    tissues: { leaf: 1, flower: 1, stem: 1 },
    verifyNext: ['Inspect leaf undersides with magnification.', 'Check multiple plants and canopy zones.', 'Use sticky cards and record pest counts before treatment.'],
  },
];

export const symptomOptions = [
  ['older-leaves-yellow', 'Older leaves yellow first'],
  ['new-growth-yellow', 'Newest growth is yellow'],
  ['uniform-pale-color', 'Plant is uniformly pale'],
  ['interveinal-yellowing', 'Yellowing between green veins'],
  ['rust-spots', 'Rust-colored spotting'],
  ['new-growth-twisted', 'New growth is twisted or malformed'],
  ['leaf-edges-necrotic', 'Leaf edges are dying'],
  ['drooping-wet-medium', 'Drooping while medium is wet'],
  ['drooping-dry-medium', 'Drooping while medium is dry'],
  ['lower-leaf-yellowing', 'Lower leaves are yellowing'],
  ['leaf-edges-dry', 'Leaf edges feel dry or crisp'],
  ['top-leaves-bleached', 'Top leaves are bleached'],
  ['leaf-edges-curl-up', 'Leaf edges curl upward'],
  ['canoeing', 'Leaves are canoeing or tacoing'],
  ['lower-leaves-only', 'Symptoms only affect lower leaves'],
  ['leaf-tips-burned', 'Leaf tips are burned'],
  ['dark-green-leaves', 'Leaves are unusually dark green'],
  ['clawing', 'Leaf tips claw downward'],
  ['stippling', 'Fine pale stippling on leaves'],
  ['webbing', 'Fine webbing is present'],
  ['silver-streaks', 'Silver streaks or scarring'],
  ['visible-insects', 'Insects or mites are visible'],
  ['slow-growth', 'Growth has slowed'],
] as const;

export function diagnoseSymptoms(
  selectedSymptoms: string[],
  context: DiagnosticContext = {},
): DiagnosticResult[] {
  const selected = new Set(selectedSymptoms);
  return rules
    .map((rule) => {
      const evidence = Object.keys(rule.supports).filter((symptom) => selected.has(symptom));
      const conflicts = Object.keys(rule.conflicts).filter((symptom) => selected.has(symptom));
      const contextualEvidence: string[] = [];
      let contextScore = 0;

      if (context.locationOnPlant && rule.locations?.[context.locationOnPlant]) {
        contextScore += rule.locations[context.locationOnPlant] ?? 0;
        contextualEvidence.push(`location:${context.locationOnPlant}`);
      }
      if (context.tissue && rule.tissues?.[context.tissue]) {
        contextScore += rule.tissues[context.tissue] ?? 0;
        contextualEvidence.push(`tissue:${context.tissue}`);
      }

      const positive = evidence.reduce((sum, symptom) => sum + rule.supports[symptom], 0) + contextScore;
      const negative = conflicts.reduce((sum, symptom) => sum + rule.conflicts[symptom], 0);
      const score = Math.max(0, positive - negative);
      const hasDirectEvidence = (rule.directSymptoms ?? []).some((symptom) => selected.has(symptom));
      const evidenceQuality: DiagnosticEvidenceQuality = hasDirectEvidence
        ? 'direct'
        : contextualEvidence.length
          ? 'contextual'
          : 'pattern';

      let confidence: DiagnosticResult['confidence'] = score >= 3 ? 'medium' : 'low';
      if (score >= 6 && hasDirectEvidence) confidence = 'high';

      return {
        cause: rule.cause,
        confidence,
        evidenceQuality,
        score,
        evidence,
        contextualEvidence,
        conflicts,
        verifyNext: rule.verifyNext,
      } satisfies DiagnosticResult;
    })
    .filter((result) => result.score > 0 && result.evidence.length > 0)
    .sort((a, b) => b.score - a.score || b.evidence.length - a.evidence.length)
    .slice(0, 4);
}
