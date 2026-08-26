# DTFSeeds Production Release Ledger

Updated: 2026-08-26

Status vocabulary:

- **LIVE VERIFIED** — protected publication and fresh/public verification passed.
- **LIVE / FOLLOW-UP** — publication succeeded but a separate quality or presentation verifier still fails.
- **READY / NOT VERIFIED** — source is prepared but final production proof is incomplete.
- **NEEDS ASSET / QA** — source/planning exists but required finished assets are not approved.
- **WIP / DO NOT PUBLISH** — incomplete, draft, superseded, or failed release gates.

## Current production inventory

| Area | Status | Verified evidence / current state | Next action |
|---|---|---|---|
| Seeds / genetics library | **LIVE VERIFIED** | Protected genetics production run `33015896023` succeeded: Seeds library + line pages success, live verification success, 11 published line profiles, 13 reviewed catalog cards. | Keep dedicated genetics publisher as sole `/seeds/` writer and re-check after broad WordPress deployments. |
| Genetics route ownership | **LIVE VERIFIED (source)** | Generic WordPress and commerce-visual writers were removed from `/seeds/` ownership in commits `4743577`, `6a842e6`, and `4be8371`. | Add/retain CI guard against future route reintroduction. |
| THC infographic library | **LIVE VERIFIED** | Independent live verification reported HTTP 200, 75 rendered cards, 75 WordPress media URLs, and 20/20 sampled previews live. | Expand verifier toward complete-card coverage and continue quality-gated additions. |
| Encyclopedia | **LIVE VERIFIED** | Production reconciliation explicitly republished/verified 171–175; release batch 176–180 was merged and published; aggregate encyclopedia structure is 177 articles (Part 1 = 17, Parts 2–9 = 20 each). Current production manifest restored to Volume 09 Batch 04. | Continue next authorized release batch; keep manifest current. |
| Academy V2 | **LIVE VERIFIED** | Public Academy V2 previously verified with 12 courses, 60 guided units, 24 practical exercises, and 12 capstones. | Audit discoverability and supporting visuals rather than rebuilding the course structure. |
| Tools | **LIVE VERIFIED** | Public tools hub includes GrowLens and Grow Doc. | Audit current tool accuracy, UX, and reference-data coverage separately. |
| Games hub | **LIVE VERIFIED** | Public games hub is populated; draft/WIP game branches remain excluded from production. | Promote only branches that pass gameplay/CI/release gates. |
| Responsive THC education images | **LIVE / FOLLOW-UP** | Latest protected enforcement run `33015860327`: WordPress optimization succeeded, fresh-visitor verification failed. The run reported 207 image tags matched to canonical WordPress media and 207 responsive attachment candidates/changes. | Diagnose visitor-render/cache verification before marking fully verified. |
| WooCommerce reviewed product-copy reconciliation | **READY / NOT VERIFIED** | One-shot protected runs failed after writes because strict post-write verification rejected normalized WordPress/WooCommerce HTML; automatic rollback succeeded. Transaction fields remained outside the intended scope. | Requires an authorized transaction-facing maintenance path; do not repeatedly retry from generic site deployment. |
| Harvest & Post-Harvest finished infographics | **NEEDS ASSET / QA** | Topic content/visual planning exists, but finished QA-approved full-sheet infographic inventory is still incomplete. | Produce and approve final academic-quality artwork before publication. |
| Outdoor Cultivation finished infographics | **NEEDS ASSET / QA** | Topic content/visual planning exists, but finished QA-approved full-sheet infographic inventory is still incomplete. | Produce and approve final academic-quality artwork before publication. |
| Draft multiplayer/security work | **WIP / DO NOT PUBLISH** | Draft branches/PRs have unresolved CI/release concerns. | Keep isolated until tests and release gates pass. |
| Older strain-card PR #107 | **SUPERSEDED / DO NOT MERGE** | Current `main` genetics catalog is newer and the dedicated genetics publisher already publishes the authoritative library. | Close/archive when convenient; do not merge as a shortcut. |

## Immediate queue

1. **Responsive-image verification** — determine why fresh anonymous HTML does not reflect the WordPress optimization that reports success.
2. **Complete repo-to-live inventory** — scan remaining manifests/assets/branches and classify each item using this ledger vocabulary.
3. **Education publication wave** — publish only items classified READY after validation; do not mix unfinished visual briefs with finished infographic inventory.
4. **Navigation/search audit** — ensure every LIVE VERIFIED resource is reachable through site navigation and search/index structures.
5. **Branch cleanup** — identify merged/superseded/WIP branches so they stop masquerading as missing production content.

## Release gate

For non-transactional website content, the required production sequence is:

`source complete -> asset/route validation -> QA -> approved manifest -> protected publisher -> fresh anonymous verification -> ledger update`

A release must not be marked LIVE VERIFIED because a GitHub commit exists or because WordPress accepted a write. Public verification is required.
