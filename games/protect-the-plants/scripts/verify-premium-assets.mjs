import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const gameRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(gameRoot, '..', '..');
const publicRoot = path.join(repoRoot, 'site', 'public-route-patch', 'games', 'protect-the-plants');

const required = [
  'assets/branding/burn-buds-logo-v1.webp',
  'assets/branding/burn-buds-cover-desktop-v1.svg',
  'assets/branding/burn-buds-cover-mobile-v1.svg',
  'assets/branding/compact-mark-v1.svg',
  'assets/branding/loading-frame-v1.svg',
  'assets/battlefields/grid-soil-v1.svg',
  'assets/battlefields/grid-scorched-v1.svg',
  'assets/battlefields/enemy-fog-v1.svg',
  'assets/battlefields/opponent-garden-v1.svg',
  'assets/layouts/desktop-dual-board-v1.svg',
  'assets/layouts/tablet-board-v1.svg',
  'assets/layouts/phone-single-board-v1.svg',
  'assets/layouts/gameplay-key-scene-v1.svg',
  'assets/formations/mother-row-v1.svg',
  'assets/formations/trellis-row-v1.svg',
  'assets/formations/tall-pheno-v1.svg',
  'assets/formations/bushy-pheno-v1.svg',
  'assets/formations/solo-pots-v1.svg',
  'assets/fx/target-reticle-v1.svg',
  'assets/fx/target-lock-v1.svg',
  'assets/fx/hit-burst-v1.svg',
  'assets/fx/miss-puff-v1.svg',
  'assets/fx/smoke-cloud-v1.svg',
  'assets/fx/embers-v1.svg',
  'assets/placement/placement-valid-v1.svg',
  'assets/placement/placement-invalid-v1.svg',
  'assets/placement/formation-selected-v1.svg',
  'assets/placement/placement-ghost-v1.svg',
  'assets/placement/rotate-control-v1.svg',
  'assets/placement/lock-stash-v1.svg',
  'assets/ui/host-battle-frame-v1.svg',
  'assets/ui/join-battle-frame-v1.svg',
  'assets/ui/waiting-player-slot-v1.svg',
  'assets/ui/room-code-panel-v1.svg',
  'assets/ui/chat-drawer-v1.svg',
  'assets/ui/mobile-nav-v1.svg',
  'assets/ui/hud/player-banner-v1.svg',
  'assets/ui/hud/opponent-banner-v1.svg',
  'assets/ui/hud/turn-indicator-v1.svg',
  'assets/ui/hud/fleet-status-frame-v1.svg',
  'assets/ui/hud/network-reconnect-v1.svg',
  'assets/ui/hud/coordinate-readout-v1.svg',
  'assets/results/victory-garden-v1.svg',
  'assets/results/burnout-defeat-v1.svg',
  'assets/ui/notifications/toast-player-joined-v1.svg',
  'assets/ui/notifications/toast-player-left-v1.svg',
  'assets/ui/notifications/toast-your-turn-v1.svg',
  'assets/ui/notifications/toast-victory-v1.svg',
  'assets/ui/notifications/toast-defeat-v1.svg',
  'assets/ui/reactions/reaction-fire-v1.svg',
  'assets/ui/reactions/reaction-leaf-v1.svg',
  'assets/ui/reactions/reaction-heart-v1.svg',
  'assets/ui/reactions/reaction-smoke-v1.svg',
  'assets/ui/reactions/reaction-trophy-v1.svg',
  'assets/ui/reactions/reaction-gg-v1.svg',
  'assets/ui/reactions/reaction-laugh-v1.svg',
  'assets/ui/reactions/reaction-target-v1.svg'
];

const failures = [];
for (const rel of required) {
  const canonical = path.join(gameRoot, rel);
  const publicFile = path.join(publicRoot, rel);
  if (!fs.existsSync(canonical)) failures.push(`missing canonical: ${rel}`);
  if (!fs.existsSync(publicFile)) failures.push(`missing public mirror: ${rel}`);
  if (fs.existsSync(canonical) && fs.existsSync(publicFile)) {
    const a = fs.readFileSync(canonical);
    const b = fs.readFileSync(publicFile);
    if (!a.equals(b)) failures.push(`mirror mismatch: ${rel}`);
  }
}

const statusPath = path.join(gameRoot, 'assets', 'burn-buds-asset-status.json');
if (!fs.existsSync(statusPath)) failures.push('missing burn-buds-asset-status.json');
else {
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  if (status.verification?.playwrightUsed !== false) failures.push('status must explicitly keep Playwright disabled');
}

if (failures.length) {
  console.error('Burn Buds premium asset verification failed:\n' + failures.map(x => `- ${x}`).join('\n'));
  process.exit(1);
}

console.log(`Burn Buds premium asset verification passed: ${required.length} canonical assets + public mirrors.`);
