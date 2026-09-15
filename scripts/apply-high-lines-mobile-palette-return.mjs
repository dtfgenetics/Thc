import fs from 'node:fs';

const appPath = 'site/public-route-patch/games/high-lines/app.js';
const testPath = 'games/high-lines/test/public-runtime.test.mjs';

let app = fs.readFileSync(appPath, 'utf8');
const handlerAnchor = "ui.palette.addEventListener('click', (event) => {\n";
const helper = `function revealBoardAfterPaletteSelection() {
  const stacked = Boolean(globalThis.matchMedia?.('(max-width: 980px)').matches);
  if (!stacked || !ui.art?.scrollIntoView) return;
  const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  window.requestAnimationFrame(() => {
    ui.art.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
  });
}

`;
if (!app.includes('function revealBoardAfterPaletteSelection()')) {
  if (!app.includes(handlerAnchor)) throw new Error('High Lines palette handler anchor not found');
  app = app.replace(handlerAnchor, `${helper}${handlerAnchor}`);
}
const clickAnchor = "  refreshSvgState();\n  ui.announce.textContent = `${currentColor().label} selected.`;\n});";
const clickReplacement = "  refreshSvgState();\n  revealBoardAfterPaletteSelection();\n  ui.announce.textContent = `${currentColor().label} selected.`;\n});";
if (!app.includes('refreshSvgState();\n  revealBoardAfterPaletteSelection();')) {
  if (!app.includes(clickAnchor)) throw new Error('High Lines palette click update anchor not found');
  app = app.replace(clickAnchor, clickReplacement);
}
fs.writeFileSync(appPath, app);

let test = fs.readFileSync(testPath, 'utf8');
const testAnchor = "assert.match(app, /navigator\\.clipboard\\?\\.writeText/);\n";
const assertions = `assert.match(app, /function revealBoardAfterPaletteSelection\\(\\)/, 'stacked layouts must return to the board after a palette-button choice');
assert.match(app, /\\(max-width: 980px\\)/, 'palette return must stay scoped to the existing stacked layout breakpoint');
assert.match(app, /\\(prefers-reduced-motion: reduce\\)/, 'palette return must respect reduced motion');
assert.match(app, /window\\.requestAnimationFrame/, 'palette return must wait for selected-state rendering');
assert.match(app, /ui\\.art\\.scrollIntoView\\(\\{ behavior: reducedMotion \\? 'auto' : 'smooth', block: 'center', inline: 'nearest' \\}\\)/, 'stacked palette selection must reveal the coloring board without horizontal page movement');
assert.match(app, /refreshSvgState\\(\\);\\s*revealBoardAfterPaletteSelection\\(\\);\\s*ui\\.announce\\.textContent = `\\$\\{currentColor\\(\\)\\.label\\} selected\\.`/, 'palette-button activation must reveal the board after its selected state renders');
`;
if (!test.includes('stacked layouts must return to the board after a palette-button choice')) {
  if (!test.includes(testAnchor)) throw new Error('High Lines runtime test anchor not found');
  test = test.replace(testAnchor, `${testAnchor}${assertions}`);
}
fs.writeFileSync(testPath, test);

console.log('High Lines mobile palette-to-board return patch applied.');
