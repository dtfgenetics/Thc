import {
  normalizeVisualObservation,
  type CanonicalVisualObservation,
  type VisualObservationEvidence,
} from './aiObservation';

type FetchLike = typeof fetch;

type AnalyzeVisualResponse = {
  ok?: boolean;
  observation?: VisualObservationEvidence;
  diagnosticClaims?: unknown[];
  error?: string;
};

export function createGrowLensAiApi(baseUrl = './api', fetcher: FetchLike = globalThis.fetch.bind(globalThis)) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  return {
    async analyzeVisual(photoId: string, csrfToken: string): Promise<CanonicalVisualObservation> {
      const response = await fetcher(`${normalizedBase}/analyze-visual.php`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ photoId }),
      });
      const payload = await response.json() as AnalyzeVisualResponse;
      if (!response.ok || !payload.ok || !payload.observation) {
        throw new Error(payload.error || `Visual analysis failed with HTTP ${response.status}.`);
      }
      if (Array.isArray(payload.diagnosticClaims) && payload.diagnosticClaims.length > 0) {
        throw new Error('Vision gateway violated the observation-only contract.');
      }
      return normalizeVisualObservation(payload.observation);
    },
  };
}

export const growLensAiApi = createGrowLensAiApi();
