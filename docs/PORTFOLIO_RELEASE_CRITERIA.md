# DTF / THC Portfolio Release Criteria

This document defines the minimum release gate for every DTF Genetics / THC project. It applies to games, websites, apps, education, books, diagnostic tools, automation, and print products.

## Canonical ownership

- Google Drive master source owns human-readable approved/source assets, research, print masters, controlled evidence, proofs, and release packages.
- GitHub owns code, machine-readable data, tests, schemas, build/deployment configuration, and automation.
- ChatGPT Library is a temporary working surface only.
- A working file is not a release merely because it exists or looks finished.

## Required release states

Every releasable artifact must use one of these states:

1. `draft` — active work, not publishable.
2. `review` — candidate awaiting required QA.
3. `approved` — content/art/code approved but not yet packaged.
4. `release-candidate` — packaged and awaiting final verification.
5. `released` — verified published/printed/distributed version.
6. `superseded` — retained for history, not current.
7. `quarantined` — duplicate, conflicting, corrupt, or unresolved.

## Universal release gate

A release is complete only when all applicable checks pass:

- Project has a canonical project ID in `data/project-registry.json`.
- Canonical Drive and GitHub ownership are unambiguous.
- A source-of-truth document exists for the project or its umbrella.
- Version/release ID is unique and recorded.
- Required source files exist.
- Required output files exist.
- No unreviewed duplicate is being used as the release master.
- Public text has spelling/grammar QA.
- Images have approval status and known source/creation provenance.
- Third-party assets have a compatible license or documented permission.
- Machine-readable files validate.
- Code builds and required tests pass.
- URLs/routes referenced by the release are checked.
- Secrets/private customer data are absent from public repositories and artifacts.
- Rollback/source archive is retained.
- Release is entered in the project tracker or project release ledger.

## Web/app gate

Additionally require:

- production URL mapped in `data/site-registry.json`;
- repository and branch recorded;
- build command recorded;
- output/deployment target recorded;
- route/base-path behavior verified;
- browser console free of release-blocking errors;
- mobile/responsive smoke test;
- critical interaction smoke test;
- live deployment verification after publish.

## Game gate

Additionally require:

- locked rules master;
- locked game-data master;
- board/deck/component counts validated;
- playtest record exists;
- digital rules match physical rules when both exist;
- original/approved art only;
- win/end state verified;
- release package separated from drafts.

## Education gate

Additionally require:

- claims traceable to sources;
- wording reviewed for accuracy and scope;
- image/source licensing recorded;
- lesson/course IDs unique;
- glossary/cross-links validated where applicable;
- public content passes release gates in the education repository.

## Diagnostic gate

Additionally require:

- evidence/source and image-license metadata separated;
- visual-only findings do not claim laboratory confirmation;
- provenance and review status recorded for reference assets;
- dataset split/version documented;
- diagnostic output clearly distinguishes evidence for, evidence against, missing evidence, and uncertainty;
- code/data checks pass in `dtfgenetics/Thc-dataset`.

## Book/print gate

Additionally require:

- manuscript version locked;
- illustration placement locked;
- trim/bleed/DPI requirements checked;
- proof reviewed;
- source/editable files retained;
- release PDF/export saved separately from working drafts.

## Automation/content-engine gate

Additionally require:

- input originals remain untouched;
- generated output package contains a manifest;
- no secrets/tokens/private media committed;
- recipe/tool schema validation passes;
- connector writes require explicit approved configuration.

## Release folder rule

Where a Drive project uses `07 Approved Release`, `09 Print`, `06 Approved Releases`, or another mature equivalent, preserve that established structure. New/light projects should use `07 Approved Release` unless their project bible defines another canonical release location.

No release folder may be used as a scratch workspace.
