# Simple Info Graphics Asset Sync

Last consolidated: 2026-08-16

## Canonical architecture

**Drive** is authoritative for full-resolution and native-source assets.  
**GitHub (`dtfgenetics/Thc`)** is the tool-facing mirror for manifests and project source material.

## Drive hierarchy

`06 Visual Education`
- `00 Project Sources and Manifests`
- `01 Simple User Guide — ACTIVE CONTROLLED`
- `02 Shared Infographic Library — CONTROLLED`
- `90 Simple User Guide — SUPERSEDED`
- `99 Simple User Guide — QUARANTINE`

The shared library is divided into Environment/Equipment, Lifecycle/Propagation, Nutrition/Root Zone, Plant Anatomy/Botany, IPM/Plant Health, Harvest/Postharvest, Training/Canopy, Outdoor/Ecology, Advanced Plant Science, Needs Review/Superseded, and Quarantine.

## Recovery snapshot

The local recovery pass represented **54** records: **48** valid visuals and **6** invalid/quarantine binaries. The historical Drive raw archive contains additional opaque THC media; those files remain controlled intake unless positively identified. This intentionally follows the project's no-blind-move rule.

## Repository contract

`assets/education/simple-info-graphics/manifest.json`
: Primary machine-readable index, including canonical Drive folder IDs, asset status, category, and source SHA-256 values.

`assets/education/simple-info-graphics/source/Grower Terminology Guide.txt`
: Source terminology and the locked 10-page Simple User Guide structure.

## Status rules

- `active-candidate`: usable only after the asset's named QA gates.
- `review-candidate`: not approved.
- `legacy-or-derivative`: reference only.
- `quarantine-invalid-binary`: never load as an image.
- Historical catalog rows with unavailable binaries are requirements/provenance records, not finished artwork.

## Missing current masters

The recovered Simple User Guide does not contain verified standalone current masters for Flower, Dry, Cure, Pests, and Tips. Legacy versions remain preserved but must not be promoted as current without rebuild/verification.
