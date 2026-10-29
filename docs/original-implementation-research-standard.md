# Original DTF implementation standards

External repositories in `configuration/upstream-source-intake.json` are **functional research references only**. Do not download, vendor, copy/paste, or port their implementations. Develop and test original DTF-owned code within existing canonical components.

## Required workflow

1. Inventory existing DTF code and open PRs to avoid duplicate implementations.
2. Define user-visible behavior and identify a gap reproducible in the current implementation.
3. Write a DTF-specific contract and examples (inputs, outputs, errors, state transitions, accessibility).
4. Implement the smallest maintainable fix in the owning module; keep compatibility unless migration is demonstrated safe.
5. Test normal operation, edge cases, invalid input, state recovery, and production integration.
6. Review mobile and desktop interface states, instructional copy, imagery rights and content evidence where relevant.
7. Verify exact-head CI and runtime deployment before changing completion status.

## Product architecture research map

| DTF application | Reference for capabilities (not source code) | Original DTF deliverable |
| --- | --- | --- |
| High Land / Weedopolis | boardgame.io | Pure transition/reducer functions; legal-move validation; turn/phase engine; serializable state; fixtures and replay tests |
| Real-time multiplayer games | Colyseus | Server-owned rooms, versioned events, participant authentication, disconnect/reconnect contracts |
| THC Encyclopedia | Pagefind / Docusaurus | Search index based on 420 canonical lesson records, text snippets, filters, accessible navigation, permalink stability |
| THC Academy | Moodle / Open edX | Assessment bank, immutable attempt snapshots, grading, progress and certificate auditing |
| Grow Doc | PlantVillage research methodology | Evidence provenance, grouped held-out data, abstention paths, cross-crop transfer controls |

## Acceptance expectations

- **Games:** Start -> legitimate turns -> victory/loss -> restart; random seeds reproducible; malformed/duplicate events rejected; browser and mobile playtests.
- **Encyclopedia:** Search finds controlled content, relevant snippets and category filters, lesson IDs remain stable, images are published only when approved.
- **Academy:** Students cannot grade themselves, timeout/retry policies enforced, result linked to exact exam version, certificate validity verifiable.
- **Cultivation tools:** Units explicit; reference formulas independently checked; uncertain claims labeled; impossible inputs rejected.
- **Design:** Common navigation, component scales, focus/keyboard behavior, responsive states, helpful loading/error/empty copy and meaningful visual learning assets.

Research is not completion. Every feature must have evidence: source commit, passing tests, a runtime acceptance result and deployment identity.
