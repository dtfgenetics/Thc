# Three-Pass Game Audit

This audit is a reusable quality check, not a locked game-plan validator. It may be applied to any DTFSeeds game regardless of renderer, backend, route, player count, board structure, repository layout, or test tooling.

## Pass 1 — Does the current code match the current intended game?

Inspect the implementation that actually exists and compare it with the current user-directed goal. Identify mismatches in gameplay, progression, controls, state, multiplayer, content, or platform support.

Fix the underlying systems wherever they live. A repair may be a small change, a refactor, a migration, or a full rebuild. Update tests so they validate the intended current behavior rather than historical assumptions.

## Pass 2 — Do data, content, and rules agree?

Check that cards, levels, enemies, questions, board data, scoring, dialogue, encounters, effects, and other content agree with the runtime behavior that consumes them.

Look for stale schemas, duplicate data, orphaned assets, dead code, mismatched IDs, impossible states, hidden hard-coded limits, and validators that require retired implementation details. Remove or replace those blockers as part of the repair.

## Pass 3 — Does the result look and feel production quality?

Verify the actual game presentation rather than only checking that code exists. Inspect phone, tablet, laptop, and desktop compositions; gameplay focus; controls; animation; VFX; typography; asset loading; responsive behavior; accessibility; and error states.

The renderer, UI structure, art style, asset pipeline, input system, and layout may all be redesigned. A fallback is acceptable only when it serves the current product rather than preserving obsolete visuals.

## Verification

Use the tests, builds, browser automation, visual regression, static checks, profiling, live HTTP checks, multiplayer sessions, or other tools appropriate to the resulting architecture. No particular QA tool or command is required solely because an earlier build used it.

Repository verification and live visitor-facing verification are separate evidence levels. Do not call a deployment live until the exact public route has been checked after release.
