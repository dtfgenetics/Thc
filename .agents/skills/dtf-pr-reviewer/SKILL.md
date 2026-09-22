---
name: dtf-pr-reviewer
description: >
  Review DTF pull requests like an independent code-review service. Use for every substantive PR before merge and for recurring review sweeps. Inspect the exact diff, surrounding code, repository instructions, CI evidence, security risk, tests, routes, assets, game state, deployment impact, and unresolved review threads. Post concise actionable GitHub review findings, re-review changed heads, and never substitute AI review for deterministic verification.
---

# DTF PR Reviewer

Act as an independent reviewer, not as the author defending the change.

The purpose of this skill is to catch regressions early without slowing normal development with low-value style comments.

## Review principles

- Review the exact PR head SHA, not a stale branch state.
- Read repository `AGENTS.md`, relevant subsystem skills, and source-of-truth docs before judging intent.
- Inspect the PR diff plus enough surrounding code to understand behavior.
- Prefer correctness, security, data integrity, runtime behavior, accessibility, mobile usability, and maintainability findings over style preferences.
- Do not use or recommend Playwright.
- Treat deterministic tests, lint, typecheck, build, route verification, asset verification, game-specific verification, and release gates as authoritative evidence.
- An AI review that finds no issues is not proof that code works.
- Do not request changes for cosmetic formatting unless it causes a real defect.
- Do not repeat the same finding after it has been fixed.
- If a previous review exists, compare the new head to the previously reviewed head and focus incremental review on the new delta plus any affected behavior.

## Severity

Use four severities:

- `P0 BLOCKER`: secret exposure, destructive data loss, production takeover, authentication/authorization bypass, release/deployment corruption, or a change that cannot safely merge.
- `P1 HIGH`: likely runtime failure, broken primary route/game loop, invalid state transition, serious security flaw, major data/content corruption, broken deployment, or failure that affects many users.
- `P2 MEDIUM`: meaningful bug, accessibility failure, mobile usability break, error-handling gap, incorrect edge case, missing regression coverage for risky logic, or maintainability problem likely to create defects.
- `P3 LOW`: worthwhile improvement with limited user impact. Keep these sparse during active development.

Only P0/P1 findings should normally justify `REQUEST_CHANGES` during active development. P2/P3 should normally be advisory unless repository policy explicitly requires them.

## Review sequence

### 1. Establish the review packet

Collect:

- repository and PR number;
- base branch and base SHA;
- head branch and exact head SHA;
- changed files and diff size;
- open review threads/comments;
- CI/check status for the exact head;
- relevant recent commits if needed;
- repository instructions and subsystem skills;
- overlap with other active PRs touching the same ownership surface.

If the PR head moved after review begins, refresh and review the new head.

### 2. Classify changed files

Group the diff into:

- application/UI;
- game logic/state;
- API/backend/data;
- content/education/genetics data;
- assets and asset manifests;
- scripts/verifiers;
- GitHub Actions;
- deployment/configuration;
- dependencies/lockfiles;
- docs only.

Do not spend semantic-review time on binary image/audio/model bytes. Review their paths, manifests, references, licensing/provenance records, dimensions/format expectations, and integration code instead.

### 3. Core correctness pass

Look for:

- broken imports/exports;
- renamed or deleted symbols still referenced elsewhere;
- invalid route/link changes;
- missing or case-mismatched assets;
- stale environment assumptions;
- swallowed exceptions or false-success paths;
- async/race problems;
- unsafe null/undefined assumptions;
- state that can become impossible or unrecoverable;
- duplicate implementations that split source of truth;
- placeholder/demo/mock behavior reaching production;
- tests or checks weakened merely to make a change pass;
- accidental deletion of canonical content/data;
- large file replacements where a narrow patch should have preserved newer work.

### 4. Security pass

Look for:

- credentials, tokens, private keys, passwords, or sensitive URLs;
- unsafe interpolation/eval/command execution;
- injection risks;
- authorization checks removed or bypassed;
- dangerous CORS/auth/session changes;
- untrusted input used as file paths, HTML, shell, SQL/query fragments, or redirects;
- dependency changes with security implications;
- GitHub Actions permissions broader than needed;
- secret exposure in workflows/logging;
- untrusted PR code gaining write tokens/secrets;
- deployment changes that allow an unverified artifact to reach production.

Use current authoritative research when security behavior or dependency/platform behavior is version-sensitive.

### 5. DTF site/UI pass

For Next.js/React/site code, check:

- server/client boundary mistakes;
- hydration hazards;
- dead routes and incorrect redirects;
- loading/error/empty states;
- responsive behavior for phone/tablet/desktop;
- keyboard access and semantic controls;
- focus behavior for dialogs/menus;
- missing labels/alt text where meaningful;
- shared-shell/header/navigation consistency;
- production ownership boundaries between `Dtf420` and `Thc`.

### 6. DTF game pass

For games, also load `dtf-game-router`.

Check:

- canonical game state remains serializable and distinct from rendering state;
- turn order and win/loss conditions;
- invalid duplicate actions;
- lobby/room/player identity behavior;
- reconnect/disconnect edge cases when multiplayer exists;
- deterministic card/deck/dice/state transitions;
- asset paths and approved assets;
- input on keyboard/touch;
- viewport/mobile HUD usability;
- scene lifecycle cleanup;
- collision/picking coordinates;
- primary gameplay loop remains possible from start to completion;
- no placeholder art replacing approved assets.

### 7. Education/content/data pass

Check:

- canonical records are not silently overwritten/truncated;
- facts are not promoted beyond evidence;
- source/evidence links remain traceable;
- structured data stays valid;
- internal educational navigation works;
- generation/strain/lineage labels are exact where applicable;
- content changes do not accidentally remove approved material.

### 8. CI/workflow/deployment pass

Check:

- workflows operate on the exact intended SHA;
- no stale-green merge behavior;
- concurrency does not silently skip required validation;
- cancelled checks are not treated as success;
- permissions follow least privilege;
- build artifacts are the ones later deployed;
- staging/production ownership is explicit;
- rollback remains possible;
- no dual writers for the same production route;
- no claim that a merge equals a deployment or live verification.

### 9. Evidence check

Inspect checks for the exact head SHA.

Required repository checks vary, but for `Dtf420` the normal evidence includes relevant feature verifiers plus:

- `npm run verify`;
- lint;
- TypeScript typecheck;
- production build;
- route/asset checks;
- game-specific verification when game code changed;
- release/live verification when production state is claimed.

Do not approve around a failed/cancelled required gate.

### 10. Post the review

Prefer one consolidated GitHub review over many noisy comments.

Format:

`DTF PR Review — <head SHA short>`

Then include only useful findings, ordered by severity. Each finding should contain:

- severity;
- path/area;
- concrete failure mode;
- why it matters;
- the smallest correct fix or verification needed.

Finish with:

- checks observed;
- unresolved blockers;
- advisory findings count;
- reviewed head SHA.

Use `REQUEST_CHANGES` only when a real merge blocker exists. Otherwise use `COMMENT`. Do not self-approve merely because no issue was found; report that no blocking issue was found and let repository merge policy decide.

## Incremental re-review

When the PR changes after review:

1. read the new head SHA;
2. compare old reviewed SHA to new SHA;
3. verify whether each prior finding was fixed;
4. review the new delta;
5. re-check affected surrounding behavior;
6. update or reply to old threads rather than duplicating them;
7. post a new concise review tied to the new head.

## Merge handoff

When no blocking review finding remains, hand off to `dtf-release-pipeline` for changes intended for production.

The reviewer must never bypass:

- exact-SHA CI;
- required tests;
- merge/release rules;
- deployment ownership;
- live verification.

## Recurring sweep behavior

For scheduled repository sweeps:

1. list open non-draft PRs;
2. skip PRs whose exact head SHA already has a current DTF review and no new commits;
3. review changed/new PRs using this skill;
4. post findings to the PR;
5. re-check unresolved P0/P1 findings;
6. notify the user only for meaningful blockers, security issues, failed gates requiring action, or a PR that becomes clean/ready for its normal release pipeline.
