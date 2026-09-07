# Shared DTF Game Systems Catalog

Use this reference during portfolio audits to identify platform capabilities that should be built once and reused.

Shared does not mean mandatory. Each integration must improve the title and preserve its canonical architecture.

## 1. DTF Game QA Harness

### Purpose

Standardize browser and release-quality evidence across the portfolio.

### Core capabilities

- desktop + phone viewport smoke tests;
- hard-refresh/direct-route boot;
- console/page/network error capture;
- screenshot capture at representative gameplay states;
- start/new game, primary action, meaningful state transition, completion/failure, restart;
- resize/orientation sanity;
- mobile overflow and touch-target checks;
- reduced-motion run;
- save/load/revisit lifecycle when applicable;
- two-independent-session flow for multiplayer games;
- artifact upload on failure;
- optional visual-regression baselines for stable UI.

### Best candidates

All public browser games. Highest initial value: High Land, Ganjumanji, THC RPG, PhenoQuest, Strain Showdown, thin vertical slices awaiting browser/mobile QA.

## 2. Deterministic Replay and Debug Export

### Purpose

Make player-reported failures reproducible.

### Recommended export

```json
{
  "gameId": "example",
  "releaseVersion": "1.2.3",
  "seedOrCode": "ABC123",
  "actions": [],
  "saveVersion": 1,
  "result": {},
  "client": {
    "viewport": "390x844",
    "inputMode": "touch"
  }
}
```

Do not include private room secrets, credentials, chat history, personal data, or hidden opponent state unless the export is explicitly authorized and safely sanitized.

### Best candidates

Seeded/deterministic games, board/card games, simulations, puzzle games, RPG saves, multiplayer desync diagnosis.

## 3. Shared Input/Action Mapping

### Purpose

Map physical controls to game actions without putting browser key names inside rules/simulation code.

### Standard action examples

- move-left/right/up/down
- confirm
- cancel
- primary-action
- secondary-action
- pause
- restart
- open-journal
- ability-1/2

### Requirements

- keyboard + pointer/touch mapping where relevant;
- modal/input gating;
- duplicate-action protection;
- optional controller adapter;
- game-specific actions remain allowed.

## 4. Shared Audio and Settings Manager

### Purpose

Avoid every game reinventing browser audio policy and preference storage.

### Capabilities

- user-initiated audio start/unlock;
- master volume;
- music volume/mute;
- SFX volume/mute;
- voice/narration volume where relevant;
- persistent preferences;
- reduced-sensory/reduced-motion hooks;
- no uncontrolled stacking of repeated SFX;
- stable asset IDs/manifests.

### Audio production categories

- music;
- ambience;
- UI;
- gameplay SFX;
- character/NPC voice;
- narration/tutorial.

Use ElevenLabs only where voice/narration materially benefits the title and preserve source script/provenance/version metadata.

## 5. DTF Player Passport

### Purpose

Create optional cross-game retention without making accounts mandatory for basic play.

### Phase 1: local-first

- game completion markers;
- best scores/times;
- achievements;
- streaks;
- daily/weekly challenge history;
- recent games;
- accessibility/settings sync on-device.

### Later account-backed phase

Only after privacy, identity, migration, conflict resolution, and offline behavior are designed.

### Guardrails

- do not gate core games behind login;
- do not fabricate competitive global leaderboards from client-submitted values;
- server-validate competitive scores where leaderboards matter;
- version achievement contracts.

## 6. Telemetry and Balance Events

### Purpose

Turn real play into evidence for balance and UX decisions.

### Useful anonymous events

- game_start;
- tutorial_complete;
- game_complete;
- game_abandon;
- restart;
- failure_reason;
- run_duration;
- level/round reached;
- choice/action distributions;
- difficulty selected;
- major resource/economy outcomes;
- multiplayer room create/join/reconnect failures.

### Guardrails

- collect only what is needed;
- document event schemas;
- avoid sensitive/private payloads;
- separate analytics from authoritative game state;
- never trust analytics events as competitive scores.

## 7. Content Authoring and Validation Toolkit

### Purpose

Make content expansion safe and repeatable for question/card/case/deck/level-driven games.

### Shared validation patterns

- stable IDs;
- duplicate IDs/content detection;
- schema validation;
- category/difficulty coverage;
- source/provenance validation where factual claims exist;
- canonical/public sync verification;
- deterministic seed/code validation;
- unreachable or contradictory content checks;
- explicit promotion status (draft/reviewed/approved).

### Game-specific extensions

- High IQ: answer/source integrity;
- Crossword: clue/answer/layout quality;
- Mystery Strain: information gain/trait uniqueness;
- Root Cause: ambiguity and clue/diagnosis coverage;
- Strain Showdown: effect vocabulary and balance profiles;
- Pheno Draft: generated-trait constraints;
- High Lines: SVG region/ID/fill validation.

## 8. Asset Manifest and Budget Validator

### Purpose

Prevent missing, oversized, duplicated, or stale runtime assets.

### Capabilities

- stable manifest keys;
- existence/content-type checks;
- source vs runtime separation;
- image dimensions and compression budgets;
- audio duration/size checks;
- GLB/glTF size, texture, naming, pivot/scale checks where possible;
- stale/unused asset reporting;
- public-route asset verification after packaging.

### Browser 3D defaults

- GLB/glTF 2.0;
- pruning/deduplication;
- mesh compression when justified;
- KTX2/BasisU where supported;
- collision proxies/LODs for repeated or complex assets.

## 9. Accessibility Preference Layer

### Purpose

Reuse accessibility infrastructure while allowing game-specific UI.

### Capabilities

- reduced motion;
- high-contrast/forced-colors support hooks;
- large text/UI scale where practical;
- visible keyboard focus;
- semantic DOM controls;
- no color-only game state;
- accessible status announcements;
- input help;
- alternate interaction for drag/visual-only tasks where practical.

## 10. Multiplayer Room/Invite Primitives

### Purpose

Reuse safe patterns for games that genuinely need online rooms.

### Capabilities

- validated room codes;
- player naming;
- invite URL and optional QR;
- authoritative server state;
- reconnect/resume tokens;
- host/player authorization;
- room lifecycle/expiry;
- presence;
- rematch/session restart;
- spectator role where valuable;
- hidden-state privacy;
- two-session acceptance harness.

### Guardrail

Do not force one backend onto games whose canonical project already has a working authoritative backend. Standardize contracts and acceptance behavior first; migrate infrastructure only with explicit justification.

## 11. Live Route Verification Framework

### Purpose

Prevent false releases caused by HTTP 200 responses serving stale or wrong content.

### Per-game verifier contract

- exact route;
- no unexpected redirect;
- positive release markers;
- required JS/CSS/data/assets;
- expected version/source fingerprint;
- stale/dev fingerprints absent;
- route does not fall back to the Game Hub;
- cache-busted request;
- explicit failure output.

## 12. Performance Budget Harness

### Purpose

Make performance measurable before art/content expansion creates regressions.

### Track

- initial HTML/JS/CSS payload;
- lazy-loaded payload;
- biggest assets;
- image/audio/texture totals;
- frame-time/FPS on representative desktop/mobile;
- long tasks/input latency;
- memory/listener/timer growth during restart/revisit;
- WebGL draw-call/material/texture pressure where relevant.

## 13. Achievement/Daily Challenge Contract

### Purpose

Reuse retention plumbing while keeping game-specific challenge design.

### Shared fields

- challenge ID;
- game ID;
- start/end date;
- deterministic seed/code/version;
- completion criteria;
- scoring summary;
- share result metadata;
- validation authority.

Avoid creating daily challenges for games where random daily content would weaken educational review or balance integrity.

## Adoption order

Recommended first shared infrastructure build order:

1. QA harness + evidence artifacts.
2. Replay/debug export contract.
3. Audio/settings + accessibility preference primitives.
4. Asset/performance validation.
5. Content authoring/validation primitives.
6. Local-first Player Passport/achievements.
7. Telemetry/balance schemas.
8. Multiplayer primitives where existing games demonstrate common requirements.

Build shared systems incrementally. A platform abstraction is successful only when multiple real games adopt it without weakening their canonical source boundaries.