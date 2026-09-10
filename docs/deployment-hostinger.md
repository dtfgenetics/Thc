# Hostinger Deployment Guide

Use this document when the current implementation deploys through Hostinger. It does not lock a game to Hostinger, a particular repository path, build command, output directory, route, renderer, backend, or QA tool.

## Current High Land deployment reference

At the time of writing, High Land is built from `dtfgenetics/Thc`, currently lives under `apps/high-land-web`, and is served at `https://dtfseeds.com/games/high-land/`. These values may change during redesign or migration.

## Repository validation

Run the tests, build, browser checks, PHP lint, asset validation, and other QA appropriate to the implementation being deployed. Current commands such as `npm run test:high-land` and `npm run build:high-land` are baselines only while they remain relevant.

Record the exact source revision and resulting artifact. Local or CI success does not prove the public site changed.

## Upload / publish

Deploy the exact tested artifact to the configured production destination. Preserve required directory structure and binary assets. Keep credentials, private room data, and secret configuration outside public web content.

If the game changes its route, output folder, backend, or hosting method, update deployment metadata before release rather than forcing the new implementation into an obsolete path.

## Live verification

Test the actual public origin after deployment. Confirm the expected game loads, required scripts/styles/assets resolve, core gameplay can start and transition meaningfully, phone/tablet/desktop layouts are usable, and browser/network errors are reviewed.

When multiplayer exists, verify room/session behavior, authority, reconnect, synchronization, and private-state handling with at least two independent sessions.

## Recovery

For production-changing releases, keep a practical recovery path such as a prior artifact, commit, backup, or reversible migration. If live verification fails, record the failing revision and observed evidence, recover the site, then repair the implementation.

## Deployment record

- Source revision:
- Build/package result:
- Deployment destination:
- Public URL:
- Deployment time:
- Live verification: PASS / FAIL / NOT TESTED
- Responsive/browser evidence:
- Multiplayer evidence when applicable:
- Recovery reference:
- Remaining issues:
