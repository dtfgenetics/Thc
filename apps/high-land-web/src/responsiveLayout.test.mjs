import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const overflowFixes = read('./overflowFixes.css');
const siteShell = read('./siteShellV5.css');
const main = read('./main.tsx');

describe('High Land responsive production shell', () => {
  it('fixes intrinsic layout widths instead of hiding page overflow', () => {
    expect(overflowFixes).not.toMatch(/overflow-x\s*:\s*hidden/i);
    expect(overflowFixes).toContain('.game-stage > *');
    expect(overflowFixes).toContain('min-width: 0');
    expect(overflowFixes).toContain('grid-template-columns: minmax(0, 1fr) minmax(260px, 340px)');
  });

  it('keeps sticky controls and game overlays below the V5 global header', () => {
    expect(siteShell).toContain('--hl-site-header-offset: 92px');
    expect(siteShell).toContain('--hl-site-header-offset: 74px');
    expect(siteShell).toContain('top: calc(var(--hl-site-header-offset) + 1rem)');
    expect(siteShell).toContain('inset: var(--hl-site-header-offset) 0 0');
    expect(siteShell).toContain('100svh');
  });

  it('loads the site-shell integration after all presentation layers', () => {
    const controlsIndex = main.indexOf("import './productionControls.css';");
    const shellIndex = main.indexOf("import './siteShellV5.css';");
    expect(controlsIndex).toBeGreaterThan(-1);
    expect(shellIndex).toBeGreaterThan(controlsIndex);
  });

  it('preserves narrow-screen board containment without disabling the board', () => {
    expect(siteShell).toContain('max-height: min(66svh, 620px)');
    expect(siteShell).toContain('.phaser-board canvas');
    expect(siteShell).not.toMatch(/display\s*:\s*none[^}]*phaser-board/i);
  });
});
