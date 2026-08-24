# dtfseeds.com Hostinger Git Deployment

This is the canonical deployment path for the existing dtfseeds.com site work.

## Correct repository

```txt
dtfgenetics/Thc
```

## Correct branch

```txt
main
```

## Correct app for THC GrowLens / Atlas

```txt
apps/growlens-web
```

## Hostinger hPanel path

```txt
Websites → dtfseeds.com → Dashboard → Advanced → Git
```

Use Hostinger Git integration for the existing site. Do not create a new Hostinger Horizons site for dtfseeds.com.

## Build commands

From the repository root:

```bash
npm install
npm run build:growlens
```

## Build output directory

```txt
apps/growlens-web/dist
```

## Living Plant Atlas source route

```txt
apps/growlens-web/public/atlas/index.html
apps/growlens-web/public/atlas/deploy-version.txt
```

Because `apps/growlens-web` is a Vite app, files under `public/` are copied into `dist/` at build time.

## Expected built files

```txt
apps/growlens-web/dist/atlas/index.html
apps/growlens-web/dist/atlas/deploy-version.txt
```

## Expected live URLs

```txt
https://dtfseeds.com/atlas/
https://dtfseeds.com/atlas/deploy-version.txt
```

## Verification checklist

After Hostinger pulls `main` and runs the GrowLens build:

1. Visit `https://dtfseeds.com/atlas/deploy-version.txt`.
2. Confirm it mentions `repo=dtfgenetics/Thc` and `app=apps/growlens-web`.
3. Visit `https://dtfseeds.com/atlas/`.
4. Confirm the page title is `THC Living Plant Atlas`.
5. Click plant hotspots: Seed, Roots, Stem, Nodes, Leaves, Flowers, Trichomes, Sex / Seed, Environment, Diagnostics.

## Current Atlas implementation status

The Atlas currently exists as a static public route inside the GrowLens app. This is intentional because it is low-risk: it does not alter the main GrowLens React app logic and should deploy through the same Hostinger Git build.

Next integration step: add a link from the main GrowLens dashboard/navigation to `/atlas/` after the static route is confirmed live.
