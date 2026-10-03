# DTF site and repository audit — 2026-10-03 UTC
Baseline: dtfgenetics/Thc@42153095b83bdce5e05748ca0bcffa22d4bdb43b.

## Verified findings and next edits
| Priority | Finding | Required work |
|---|---|---|
| High | /dtf-build.json returns 404; source/live revision cannot be compared | Publish a manifest identifying the deployed release, then verify it against immutable release artifacts. |
| Resolved in current main | Earlier substantive audit flagged 178/420 encyclopedia lessons | Current deterministic substantive lesson audit now passes all 420 controlled lessons. Do not use the earlier 178-lesson snapshot as an active work queue; use generated completion/evidence/visual/review ledgers for remaining work. |
| Medium | Certification reference opens Learning Hub | This branch points it to /courses/#credentials, clarifies roadmap wording, and extends composition validation. |
| Medium | /games/phenoquest/, /games/thc-rpg/, /games/ganjumanji/ lack canonical links | Add canonical metadata in each current canonical owner and rebuild/deploy its artifact. |
| Medium | 340 encyclopedia assessment warnings | Review generated checks before materializing them; schema success is not an instructional-quality guarantee. |

## Evidence
- 53/53 configured public routes responded to the convergence audit. This is availability evidence, not gameplay, login, grading, upload or persistence acceptance.
- Repository registry validates 22 repository classifications; it is not a full source audit of all 22 repositories.
- Public navigation, page composition, repository registry and workflow path parity passed.
- Encyclopedia and academy production source-pin checks passed.
- Encyclopedia strict content-control checks passed for 420 unique lesson IDs, while the deeper heuristic audit found substantive gaps.
- Quality issue counts: weak source authority signal 127; thin measurements 108; thin misconceptions 124; thin objectives 20; thin cross-links 15; thin core science 10; thin cultivation relevance 10; thin evidence limits 19; insufficient sources 10; low instructional depth 19. Categories overlap. These are screening flags requiring editorial review, not proof every claim is wrong.
- V6 course catalog render validation and page-composition checks passed after the navigation edit.

## Limits
Main page contents, production route availability and Thc integration source were inspected; package manifests from Dtf420 and Tools were also read. Mobile/desktop visual rendering and all interactive workflows were not exercised. Search retrieval showed an older encyclopedia gateway, while direct HTTP returned newer runtime code, so no stale-production conclusion is based on that cached gateway.
The source correction is not live. WordPress publishing credentials are absent in this session.
