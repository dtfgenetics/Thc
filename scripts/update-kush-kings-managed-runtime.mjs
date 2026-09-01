import fs from 'node:fs';

const path = 'site/deployment/public-apps.json';
const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);

const app = data.apps.find((entry) => entry.id === 'kush-kings');
if (!app) throw new Error('kush-kings registry entry not found');
if (app.repository !== 'dtfgenetics/Thc-chess-git') {
  throw new Error(`unexpected Kush Kings repository: ${app.repository}`);
}

app.runtime = 'node-full-stack-postgres';
app.status = 'runtime-integration';
app.build = 'pnpm check:rebrand && pnpm build:client && pnpm build:server';
app.notes = '3D Next.js client and server-authoritative Express/Socket.io multiplayer are merged and CI verified. PostgreSQL supports either PG* variables or DATABASE_URL. Preferred managed path is two Hostinger Web Apps (chess.dtfseeds.com + chess-api.dtfseeds.com) with managed/external PostgreSQL such as Hostinger-connected Supabase; Docker/VPS/Caddy remains a supported fallback. Do not replace legal-move authority with the legacy PHP shell. Cut over the public route only after two-browser and mobile/WebGL QA.';
data.updated = '2026-09-01';

fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('Updated Kush Kings production registry entry.');
