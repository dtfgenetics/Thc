import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const overflowFixes = read('./overflowFixes.css');
const siteShell = read('./siteShellV5.css');
const boardPriority = read('./highLandBoardPriority.css');
const gamefeel = read('./highLandGamefeelV2.css');
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

  it('loads production polish after the site-shell and board-priority layers', () => {
    const controlsIndex = main.indexOf("import './productionControls.css';");
    const shellIndex = main.indexOf("import './siteShellV5.css';");
    const priorityIndex = main.indexOf("import './highLandBoardPriority.css';");
    const gamefeelIndex = main.indexOf("import './highLandGamefeelV2.css';");
    expect(controlsIndex).toBeGreaterThan(-1);
    expect(shellIndex).toBeGreaterThan(controlsIndex);
    expect(priorityIndex).toBeGreaterThan(shellIndex);
    expect(gamefeelIndex).toBeGreaterThan(priorityIndex);
  });

  it('preserves narrow-screen board containment without disabling the board', () => {
    expect(siteShell).toContain('max-height: min(66svh, 620px)');
    expect(siteShell).toContain('.phaser-board canvas');
    expect(siteShell).not.toMatch(/display\s*:\s*none[^}]*phaser-board/i);
  });

  it('makes the board the mobile visual priority and keeps touch targets usable', () => {
    expect(boardPriority).toContain('--hl-min-target: 44px');
    expect(boardPriority).toContain("'brand status'");
    expect(boardPriority).toContain("'players players'");
    expect(boardPriority).toContain('max-height: min(70svh, 660px)');
    expect(boardPriority).toContain('max-height: min(68svh, 590px)');
    expect(boardPriority).toContain('env(safe-area-inset-bottom)');
  });

  it('identifies the current player without relying on player color alone', () => {
    expect(boardPriority).toContain(".player-chip.active::after");
    expect(boardPriority).toContain("content: 'TURN'");
    expect(boardPriority).toContain('@media (forced-colors: active)');
    expect(boardPriority).toContain('outline: 2px solid Highlight');
  });

  it('keeps HIT-card actions accessible and motion preferences respected', () => {
    expect(gamefeel).toContain('--hl-action-target: 44px');
    expect(gamefeel).toContain('.hit-card-player-choices button');
    expect(gamefeel).toContain('.hit-card-close');
    expect(gamefeel).toContain('max-height: min(92svh, 820px)');
    expect(gamefeel).toContain('env(safe-area-inset-top)');
    expect(gamefeel).toContain('@media (prefers-reduced-motion: reduce)');
    expect(gamefeel).toContain('@media (forced-colors: active)');
    expect(gamefeel).toContain("content: '✓'");
  });
});
