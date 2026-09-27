import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(new URL('../../../scripts/verify-grow-doc-production.mjs', import.meta.url), 'utf8');

describe('Grow Doc production identity verifier contract', () => {
  it('loads the repository pin as the default expected source SHA', () => {
    expect(verifier).toContain("release-source-revisions/thc-grow-doc.txt");
    expect(verifier).toContain("process.env.EXPECTED_SOURCE_SHA || localRevision.commit");
  });

  it('fetches and verifies the deployed source-revision marker', () => {
    expect(verifier).toContain("const revisionRoute = '/thc-grow-doc/source-revision.txt'");
    expect(verifier).toContain("liveRevision.repository === 'dtfgenetics/Thc-dataset'");
    expect(verifier).toContain("liveRevision.route === route");
    expect(verifier).toContain("liveRevision.commit === expectedSourceSha");
  });

  it('reports exact source identity in the production report', () => {
    expect(verifier).toContain('sourceRevision: {');
    expect(verifier).toContain('expectedCommit: expectedSourceSha');
    expect(verifier).toContain('exactMatch: liveRevision.commit === expectedSourceSha');
  });
});
