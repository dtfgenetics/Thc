# dtfseeds.com Hostinger Git Deployment

## Repository and branch

The DTFSeeds integration/deployment repository is `dtfgenetics/Thc` on `main`.

## GrowLens

GrowLens remains owned and built from:

```txt
apps/growlens-web
```

Build it with:

```bash
npm install
npm run build:growlens
```

Output:

```txt
apps/growlens-web/dist
```

GrowLens no longer owns the Plant Atlas or Terpene Atlas static source trees.

## Cultivation tools and atlases

The canonical source for the cultivation tool suite, Plant Atlas, and Terpene Atlas is:

```txt
dtfgenetics/Tools
```

The matching paths under `dtfgenetics/Thc/site/public-route-patch/` are synchronized deployment mirrors used by the DTFSeeds public-suite/WordPress/Hostinger release system.

Canonical Atlas routes:

```txt
https://dtfseeds.com/atlas/
https://dtfseeds.com/terpene-atlas/
```

Do not restore `apps/growlens-web/public/atlas/` or `apps/growlens-web/public/terpene-atlas/` as authoring locations. Tool and Atlas changes originate in `dtfgenetics/Tools`, then synchronize into the THC integration repository.

## Hostinger hPanel

```txt
Websites → dtfseeds.com → Dashboard → Advanced → Git
```

Use the existing DTFSeeds deployment system. Do not create a separate Hostinger site for the canonical Tools repository.
