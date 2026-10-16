# Production release evidence gate (pilot)

This is a **release-candidate acceptance control**, not proof that production works. Source owners must capture evidence; reviewers must open and verify the URLs. No one should mark an untested gate passed.

## Running

`node --test scripts/verify-release-evidence.test.mjs`

`node scripts/verify-release-evidence.mjs path/to/release-manifest.json`

The validator fails closed for missing fields, incomplete gates and malformed evidence links. Its URL checks are structural; they **do not** perform HTTP checks or assess scientific claims.

## Required gates

- `functional`: tests and real user workflows, including failures and edge cases.
- `scientific`: primary sources, formula accuracy, uncertainty and reviewer sign-off.
- `visual`: mobile and desktop captures, accessibility and genuine image provenance.
- `deployment`: live route checks, release SHA, and rollback validation.
- `outcome`: stated audience/product metric with actual baseline and observed data.

Each gate requires `status: "passed"`, ISO `checkedAt`, and an `evidence` array of HTTPS URLs. Top-level keys: `project`, `release`, `productionUrl`, `gates`.

Do not fabricate metrics or evidence links. For new features with no postrelease outcome yet, leave outcome unpassed and classify as **provisional**, not fully released.

## Ownership

- `Thc`: production integration/release acceptance.
- `Tools`: canonical cultivation tool code.
- `Thc-dataset`: Grow Doc diagnostics and datasets.
- `thc-grow-hub`: Encyclopedia content.
- `Dtf420`: transitional only; no duplicate canonical implementation.

This pilot gate is deliberately **not wired to all existing deployments**: first capture baseline evidence and migrate release jobs carefully, then enforce on designated release workflows.
