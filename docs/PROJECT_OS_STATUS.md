# Project OS status

Generated from canonical repository state on 2026-10-05 UTC.

## Portfolio mode

**Release closure with active regression triage.** Core architecture is established. Remaining work is production verification, stale-branch retirement, human validation, and archive/admin actions.

| Lane | State | Current evidence / next gate |
| --- | --- | --- |
| Encyclopedia | **Infrastructure closed; release acceptance reopened** | 420/420 canonical lesson routes and 21/21 topic hubs were accepted; Volume 03 visual republish merged in #1900. Latest main deployment run `37255465682` failed only at canonical Learn-root ownership because the live page is missing `data-dtf-layout="learn-v3"` and `data-dtf-learning-map="v4"`. Fix/reverify before declaring the current release fully closed. |
| Tools | **Runtime closure merged** | #1909 closed cultivation deployment/MIME/runtime contract; #1930 merged sync observability. Canonical registry contains 22 Tools-owned child routes plus `/tools/` = 23 routes. Prior canonical live verification is 23/23; this session's external crawler resolved the hub but returned crawler-side Internal Error on direct child fetches, so no new 23/23 browser claim is recorded. |
| GrowLens | **Canonical observation producer merged** | #1910 merged the canonical observation producer. Remaining work is production integration evidence and downstream consumption checks. |
| Release observability | **Merged** | #1911 adds release ledger, hashes, and artifact attestations; #1930 adds Tools sync convergence observability. |
| Security | **Enabled** | CodeQL security-extended is active; #1913 added Python coverage. Latest-main CodeQL runs continue on push. |
| Web quality | **Measured gates merged** | #1912 adds Lighthouse/accessibility regression gates. Keep thresholds evidence-based and fail only on measured regressions. |
| Grow Doc | **Dataset advanced; live visual verifier blocked** | #1932 advanced the production dataset pin to `dtfgenetics/Thc-dataset@6cb260b6cfe5cd51fd6586f9898224d3c2aba48c`. #1880 is held because its live visual API verification job is failing. |
| Academy | **Machine layer ready; human gate open** | #1925 remains open because WordPress reconciliation fails. Human pilot/SME/accessibility/assessment governance is still required before certification release claims. |
| Games | **Playtest-gated** | Engine-agent/browser-playtest lane continues. #1926 is held because Parallel Project Safety failed even though game-specific and release-integrity checks passed. |
| Dtf420 / dtf-thc-hub | **Archive candidates** | Dtf420 has 0 open PRs; thc-grow-hub has 1 open PR. Final repository archive requires GitHub repository administration permission not exposed by the current connector. |

## Completed in this closure pass

- #1900 — Volume 03 visual republish merged.
- #1909 — cultivation deployment/MIME/runtime closure merged.
- #1910 — GrowLens canonical observation producer merged.
- #1911 — release observability + artifact attestations merged.
- #1912 — measured Lighthouse/accessibility regression gates merged.
- #1913 — CodeQL Python coverage merged.
- #1932 — Grow Doc production dataset pin replay merged.
- #1930 — canonical Tools sync observability merged.
- #1929 — canonical WordPress H1 semantics merged.
- #1922 — standalone Learn-root writers retired.

## Canonical repository snapshot

| Repository | SHA | Open PRs |
| --- | --- | ---: |
| dtfgenetics/Thc | `49618ca2bb745889d7aae1f24cb9414317c582ed` | 23 |
| dtfgenetics/thc-grow-hub | `874d02b502061544e7cfc3dbc6d43bbecc43c654` | 1 |
| dtfgenetics/Thc-learning-courses- | `ea7b3c7e6d62a51c1b37f332bacc85897d49e5aa` | 0 |
| dtfgenetics/Tools | `c4a7025316875d32028fa7530cb898b2c81c98ce` | 0 |
| dtfgenetics/Thc-dataset | `74251964755616f56bcf4cbd6f5b524941e86786` | 4 |
| dtfgenetics/Dtf420 | `f78279675360cc151ed361c2dafee73e53a40c03` | 0 |

## Immediate blockers

1. Restore canonical Learn-root markers on the live `/learn/` page, rerun Learning Centers deployment, and repeat the 420-route acceptance check.
2. Repair #1880 Grow Doc live visual API verifier before merge.
3. Repair #1925 Academy WordPress reconciliation before merge; do not bypass the gate.
4. Resolve #1926 Parallel Project Safety failure before merging the High Lines autonomous-playtest observability work.
5. Complete the remaining 23 open `Thc` PR triage by superseding stale branches and replaying only current-main changes that still add value.
6. Run the Academy human pilot and capture reviewer, accessibility, scoring, and assessment-governance evidence.
7. Harvest the final useful code/data from Dtf420 and thc-grow-hub, then archive them through an account with repository administration permission.

## Operating rule

Optimize for **closed blockers, verified live routes, and retired stale branches**. A merge is not production success; source, test, package, attestation, deploy, live verification, and checkpoint evidence remain separate release states.
