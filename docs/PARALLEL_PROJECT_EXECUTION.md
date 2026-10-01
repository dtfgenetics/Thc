# Parallel Project Execution

This is the operating contract for simultaneous DTF chats/agents.

## One chat, one session

Every new unit of work gets its own branch:

`work/<project-id>/<task>/<session-id>`

Never let two chats share one mutable branch. Resume an existing session only when the user intentionally wants that exact work continued.

Use `multi/<task>` only for deliberate cross-project integration. It is not a normal development branch.

## Resolve ownership before editing

Run:

```bash
npm run project:plan -- <project-id-or-alias>
```

Examples:

```bash
npm run project:plan -- plant-atlas
npm run project:plan -- grow-doc
npm run project:plan -- encyclopedia
npm run project:plan -- academy
npm run project:plan -- high-iq
```

The planner returns the canonical repository, session branch pattern, owned source paths, validation command, and production/integration handoff.

The machine-readable authority is `data/project-execution-registry.json`, backed by `data/repository-registry.json` and `data/project-registry.json`.

## Parallel workflow

1. Resolve project ownership.
2. Create a unique work session in the canonical repository.
3. Edit only canonical source, never a generated production mirror.
4. Run the narrow focused validation first, then the repository's required validation.
5. Push one PR for that session.
6. Use Studio overlap/doctor for work in `dtfgenetics/Thc`.
7. Keep unrelated sessions moving even when one session is Yellow.
8. Resolve Red/file conflicts at integration.
9. Integrate the exact checked PR head against current main.
10. For external canonical repos, hand off an immutable commit/artifact to `dtfgenetics/Thc` and update the source pin.
11. Verify the live route only after the production integration pipeline completes.

## Canonical homes

| Project | Canonical repository |
| --- | --- |
| Platform / deployment / shared site integration | `dtfgenetics/Thc` |
| GrowLens | `dtfgenetics/Thc` |
| Monorepo games | `dtfgenetics/Thc` |
| Focused cultivation tools | `dtfgenetics/Tools` |
| Plant Atlas | `dtfgenetics/Tools` |
| Terpene Atlas | `dtfgenetics/Tools` |
| Grow Doc | `dtfgenetics/Thc-dataset` |
| Encyclopedia / general cultivation education | `dtfgenetics/thc-grow-hub` |
| Academy / certification | `dtfgenetics/Thc-learning-courses-` |
| Dtf420 future shell | `dtfgenetics/Dtf420` migration-only |

Named game projects not listed above resolve through `data/project-registry.json`; standalone game repositories keep their registered owner until an explicit migration is completed.

## Shared-resource rule

Multiple chats may work at the same time, including on the same project, but same-file or same-resource overlap must be visible before integration. Parallel Studio uses optimistic development: it does not globally lock the repo. Yellow overlap continues; Red integration conflicts must be repaired before merge.

Shared repository-control files, navigation, design system, deployment registries, release workflows and root manifests should normally be changed in dedicated platform sessions, not mixed into feature sessions.
