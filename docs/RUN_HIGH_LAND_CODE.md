# Run High Land Code

Use this guide when Codex is unavailable or timing out.

## Best backup: GitHub Codespaces

GitHub Codespaces is the best Codex-like backup for this repo because it opens the GitHub repository in a cloud development environment with a terminal, Node.js, Git, GitHub auth, port forwarding, and VS Code-style editing.

### Open the repo in Codespaces

1. Open the GitHub repository: `dtfgenetics/Thc`.
2. Click **Code**.
3. Click **Codespaces**.
4. Click **Create codespace on main**.
5. Wait for setup to finish. The repo now has `.devcontainer/devcontainer.json`, so Codespaces should install dependencies automatically.

### Run checks

From the Codespaces terminal:

```bash
npm run test:high-land
npm run build:high-land
npm run test:e2e:high-land
```

For the app package directly:

```bash
cd apps/high-land-web
npm run test
npm run build
npm run test:e2e
```

If Playwright browsers are missing, install Chromium first:

```bash
npm --workspace apps/high-land-web exec -- playwright install --with-deps chromium
```

### Run the game preview

```bash
cd apps/high-land-web
npm run dev
```

Open the forwarded port for the dev server. The production preview route is:

```txt
/games/high-land/
```

## Gitpod backup

Gitpod is another Codex-like browser coding environment that can open the GitHub repo, install dependencies, run commands, and show a forwarded preview.

The repo now has `.gitpod.yml`.

Recommended flow:

1. Open Gitpod.
2. Import/open GitHub repo `dtfgenetics/Thc`.
3. Let the workspace run `npm install`.
4. It should start `npm run dev:high-land`.
5. Use the forwarded `5173` preview for the dev server.

Manual checks:

```bash
npm run test:high-land
npm run build:high-land
npm --workspace apps/high-land-web exec -- playwright install --with-deps chromium
npm run test:e2e:high-land
```

## GitHub Actions manual run

The workflow `.github/workflows/high-land-ci.yml` now has `workflow_dispatch`, so it can be manually run.

1. Open the repo on GitHub.
2. Click **Actions**.
3. Choose **High Land CI**.
4. Click **Run workflow**.
5. Pick `main` and start the run.

The workflow runs:

```bash
npm install
npm run test:high-land
npm run build:high-land
npm --workspace apps/high-land-web exec -- playwright install --with-deps chromium
npm run test:e2e:high-land
```

## Replit backup

Replit is useful if you want a browser IDE with a Run button and AI help. It can import a GitHub repo, run Node/TypeScript apps, and provide a preview. Use it as a second backup after Codespaces/Gitpod.

Recommended setup:

```txt
Import from GitHub: dtfgenetics/Thc
Install command: npm install
Run command: npm run dev:high-land
Build command: npm run build:high-land
```

For preview issues, run from the app folder:

```bash
cd apps/high-land-web
npm run dev
```

## Cursor / Windsurf desktop backup

Use Cursor or Windsurf if you want a desktop AI coding app. They are good for code editing and terminal work, but they require your local machine to have Git and Node working.

Recommended commands:

```bash
git clone https://github.com/dtfgenetics/Thc.git
cd Thc
npm install
npm run test:high-land
npm run build:high-land
npm --workspace apps/high-land-web exec -- playwright install --with-deps chromium
npm run test:e2e:high-land
```

## What to send any coding app

Use this prompt:

```txt
Open dtfgenetics/Thc. Focus on apps/high-land-web. Run npm install, npm run test:high-land, npm run build:high-land, install Playwright Chromium if needed, and run npm run test:e2e:high-land from the repo root. Fix TypeScript, Vitest, Playwright, and Vite build errors only. Do not add new gameplay features until tests and build pass. Preserve the current High Land room flow: local play, create room, invite link, add test player, start lobby, roll through room runtime, restart room runtime. Do not commit secrets. After fixing, summarize every changed file and the test/build output.
```

## Current priority

```txt
1. Get unit tests, build, and browser smoke tests running in Codespaces, Gitpod, or GitHub Actions.
2. Fix any actual output errors.
3. Only then continue the Hostinger Website Room API live multiplayer checks.
```
