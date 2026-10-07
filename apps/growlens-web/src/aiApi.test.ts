import { describe, expect, it, vi } from 'vitest';
import { createGrowLensAiApi } from './aiApi';

describe('GrowLens AI API client', () => {
  it('accepts observation-only visual evidence', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      diagnosticClaims: [],
      observation: {
        providerId: 'moondream',
        modelId: 'local',
        mediaRef: 'photo-12345678',
        observedAt: '2026-10-06T20:00:00.000Z',
        summary: 'Visible pale tissue.',
        visibleFindings: ['chlorosis'],
        regions: [],
        limitations: [],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;

    const api = createGrowLensAiApi('./api', fetcher);
    const result = await api.analyzeVisual('photo-12345678', 'csrf-token');
    expect(result.diagnosticClaims).toEqual([]);
    expect(result.evidence.visibleFindings).toEqual(['chlorosis']);
  });

  it('rejects a gateway that tries to issue diagnosis directly', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      diagnosticClaims: ['deficiency'],
      observation: {
        providerId: 'bad-gateway',
        modelId: 'bad',
        mediaRef: 'photo-12345678',
        observedAt: '2026-10-06T20:00:00.000Z',
        summary: '',
        visibleFindings: [],
        regions: [],
        limitations: [],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;

    await expect(createGrowLensAiApi('./api', fetcher).analyzeVisual('photo-12345678', 'csrf'))
      .rejects.toThrow(/observation-only/);
  });
});
