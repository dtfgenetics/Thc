import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const responsiveCss = readFileSync(new URL('./workspace-responsive.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

describe('GrowLens responsive workspace contract', () => {
  it('loads the responsive workspace layer last', () => {
    expect(mainSource).toContain("import './workspace-responsive.css';");
    expect(mainSource.lastIndexOf("import './workspace-responsive.css';"))
      .toBeGreaterThan(mainSource.lastIndexOf("import './accessibility.css';"));
  });

  it('keeps fixed app chrome below the DTFSeeds V5 shell', () => {
    expect(responsiveCss).toContain('body:has(> .dtf-global-header) .sidebar');
    expect(responsiveCss).toContain('top: 92px;');
    expect(responsiveCss).toContain('@media (max-width: 1120px)');
    expect(responsiveCss).toContain('top: 74px;');
    expect(responsiveCss).toContain('body:has(> .dtf-global-header) .mobile-header');
  });

  it('contains dense phone grids without hiding overflow regressions', () => {
    expect(responsiveCss).toContain('@media (max-width: 560px)');
    expect(responsiveCss).toContain('.canopy-grid');
    expect(responsiveCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(responsiveCss).toContain('@media (max-width: 380px)');
    expect(responsiveCss).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(responsiveCss).not.toContain('overflow-x: hidden');
  });

  it('keeps overlays inside the visible workspace below the global header', () => {
    for (const selector of [
      '.account-overlay',
      '.camera-overlay',
      '.backup-overlay',
      '.reports-overlay',
      '.routines-overlay',
      '.photo-history-overlay',
    ]) {
      expect(responsiveCss).toContain(selector);
    }
    expect(responsiveCss).toContain('max-height: 100%;');
  });
});
