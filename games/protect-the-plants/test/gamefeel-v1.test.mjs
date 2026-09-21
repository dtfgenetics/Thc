import fs from 'node:fs';
import assert from 'node:assert/strict';

const root='site/public-route-patch/games/protect-the-plants';
const html=fs.readFileSync(`${root}/index.html`,'utf8');
const baseCss=fs.readFileSync(`${root}/styles.css`,'utf8');
const css=fs.readFileSync(`${root}/gamefeel-v1.css`,'utf8');
const battleCss=fs.readFileSync(`${root}/gameplay-v4.css`,'utf8');
const sw=fs.readFileSync(`${root}/sw.js`,'utf8');
const CURRENT_CACHE='ptp-shell-v11-burn-buds-v7-battlefield-20260920';

assert.match(html,/gamefeel-v1\.css/,'game-feel stylesheet must load');
assert.match(css,/burn-primary-board/,'active battle board must receive primary emphasis');
assert.match(css,/burn-secondary-board/,'secondary board must be visually de-emphasized');
assert.match(css,/burn-armed-target/,'armed mobile target must remain obvious');
assert.match(css,/@media\(max-width:900px\)/,'mobile battle layout must be explicit');
assert.match(css,/prefers-reduced-motion/,'game-feel motion must respect reduced motion');
assert.match(battleCss,/Burn Buds battlefield v4\.1/,'battlefield presentation layer must remain present');
assert.match(battleCss,/\.board\{[\s\S]*repeating-linear-gradient/,'15×15 board must use the tactical garden surface');
assert.match(battleCss,/body\.burn-my-turn[\s\S]*board-card:nth-child\(2\)/,'opponent battlefield must receive active-turn emphasis');
assert.match(battleCss,/\.burn-turn-banner\.fire::before\{animation:burn-buds-scan/,'fire turn banner must retain the tactical scan cue');
assert.match(battleCss,/\.fleet-chip:not\(\.sunk\)::after/,'remaining formations must keep an intact-state cue');
assert.match(battleCss,/prefers-reduced-motion/,'battlefield motion must respect reduced motion');
assert.match(battleCss,/forced-colors/,'battlefield visuals must preserve forced-colors support');

assert.match(baseCss,/body\{[^}]*overflow-x:hidden/is,'fixture must continue detecting the legacy base overflow mask until base CSS is refactored');
assert.match(css,/body\{min-width:0;overflow-x:visible/,'late game-feel layer must release the page-root overflow mask');
assert.match(css,/\.shell,.main,.sitebar,.navlinks,.lobby-stage,.game-layout,.play-zone,.boards,.board-card,.coordinate-grid,.side-panel,.chat,.battle-log,.formation-strip\{min-width:0\}/,'Burn Buds surfaces must allow intrinsic shrinking');
assert.match(css,/\.btn,.input,.navlink,.mobile-tab\{min-height:44px\}/,'non-grid game controls must preserve a 44px touch target');
assert.match(css,/body:has\(> \.dtf-global-header\) \.sitebar,[\s\S]*body:has\(> \.dtf-global-header\) \.battle-top\{top:var\(--dtf-global-header-height,92px\)\}/,'desktop local sticky bars must clear the canonical V6 header');
assert.match(css,/@media\(max-width:900px\)[\s\S]*body:has\(> \.dtf-global-header\) \.sitebar,body:has\(> \.dtf-global-header\) \.battle-top\{top:var\(--dtf-global-header-height,74px\)\}/,'tablet/mobile battle HUD must use the compact V6 header contract');
assert.match(css,/body:has\(> \.dtf-global-header\) \.mobile-tabs\{top:calc\(var\(--dtf-global-header-height,74px\) \+ 64px\)\}/,'mobile board tabs must remain below the V6 header and battle HUD');
assert.match(css,/body:has\(> \.dtf-global-header\) \.burn-target-readout\{top:calc\(var\(--dtf-global-header-height,74px\) \+ 108px\)\}/,'mobile targeting readout must remain below the stacked sticky controls');
assert.match(css,/@media\(max-width:430px\)[\s\S]*\.board-card\{padding:6px\}/,'narrow-phone board spacing must preserve the 15×15 playfield');
assert.match(css,/@media\\(max-width:640px\\)[\\s\\S]*safe-area-inset-bottom/,'narrow-phone game padding must clear the bottom safe area');
assert.match(css,/@media\\(max-width:430px\\)[\\s\\S]*safe-area-inset-left[\\s\\S]*safe-area-inset-right/,'small-phone game and sitebar padding must clear horizontal safe areas');

assert.ok(sw.includes(CURRENT_CACHE),`service-worker cache identity must refresh the current V6 gameplay-focus shell: ${CURRENT_CACHE}`);
assert.match(sw,/\.\/gamefeel-v1\.css/,'game-feel layer must be available offline');
console.log('Burn Buds game-feel, V6 sticky-header, responsive containment and V10 offline-shell contract passed.');
