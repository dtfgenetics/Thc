# THC Tools Bootstrap Bundle

This directory is a staging contract for creating `dtfgenetics/thc-tools`.

It is intentionally kept inside `dtfgenetics/Thc` until the target repository exists. It does **not** change production ownership or deployment by itself.

## Contents

- `bootstrap-manifest.json` — canonical list of route surfaces, shared assets, source aliases, deployment/navigation IDs, GrowLens bridge flags, and third-party notice files.
- `repo-package.json` — seed package metadata for the new repository.
- `repo-README.md` — seed README for the new repository.
- `scripts/build-thc-tools-bootstrap.mjs` — deterministic exporter used from the source repository.

## Transfer rule

The exporter must copy only files declared by the bootstrap manifest plus the canonical registry and migration documentation. It must never delete source files.

After transfer, the new repository must pass its own registry/runtime/route tests before any deployment integration changes are made.
