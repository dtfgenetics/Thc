# Seed Man: Grow. Fight. Restore. — Game Direction & Production Bible

> **Canonical project direction for the DTF Genetics Seed Man browser action-platformer.**
>
> This document is designed to remain expandable. Future gameplay, visual, audio, level, accessibility, QA, deployment, and content decisions should be added here when they become approved production direction.
>
> **Production route:** `https://dtfseeds.com/games/seed-man-platformer/`  
> **Canonical repository:** `dtfgenetics/Thc`  
> **Canonical source root:** `games/seed-man-platformer/`  
> **Public runtime root:** `site/public-route-patch/games/seed-man-platformer/`  
> **Current campaign contract:** v20 — 20 levels, 5 worlds, 6 bosses  
> **Approved art authority:** `approved-showcase-2026-09-08`  
> **Character contract:** `green-armored-plant-hero`

---

## 1. Product vision

**Seed Man: Grow. Fight. Restore.** is DTF Genetics' flagship browser action-platformer. It combines responsive side-scrolling traversal, lightweight combat, temporary phenotype transformations, collection/progression systems, world-specific environmental mechanics, and multi-phase boss fights inside a stylized cannabis-inspired fantasy world.

The intended experience is not a disposable mini-game or endless-runner prototype. It is a polished campaign game that can continue expanding with additional worlds, challenge modes, secrets, collectibles, art, enemy variants, accessibility features, and seasonal/community content without rewriting the core architecture.

The game should feel immediately playable on desktop and mobile while still providing enough mechanical depth to support mastery. Movement must be responsive, character readability must remain high, combat must be legible, and each world must visually communicate its own identity before the player reads any UI text.

The central player fantasy is:

1. **Grow** — move through living environments, collect seeds/resources, discover routes, and restore damaged spaces.
2. **Fight** — battle pests, corrupted plant life, machines, environmental threats, elite phenotype carriers, and bosses.
3. **Restore** — clear each region, defeat its corruption source, unlock progression, and ultimately defeat the Blight King.

The game should remain recognizably DTF Genetics through the Seed Man character, plant-science-inspired world language, phenotype powers, environmental storytelling, and the **Dream the Future** identity without turning the experience into an advertisement.

---

## 2. Non-negotiable production rules

These rules define the project boundary and should be treated as release requirements.

### 2.1 One canonical campaign

Production is the **20-level v20 campaign**. Retired 11-level and 15-level implementations are not alternate designs and must not regain production ownership.

Production must not use retired identifiers or assumptions such as:

- `sprout-run` as the campaign identity
- the 15-level Greenhouse Gauntlet campaign
- `campaign-ui-v15.js`
- `world-five-v1.js`
- `levels-12-15.json`
- `seed-man-production-v1`
- `seed-man-locked-v1`
- old brown-seed character artwork
- procedural character fallback
- legacy sprite-atlas fallback

Compatibility files may exist temporarily only when an active v20 migration path still requires them. They may never define public copy, level count, world count, production readiness, or visual authority.

### 2.2 One approved Seed Man identity

The playable character is the approved **green armored plant-hero Seed Man**:

- large leaf-shaped head silhouette
- expressive face
- green / white / black body treatment
- white gloves
- white boots
- consistent heroic platformer proportions
- same character identity in every phenotype form

The older simple brown seed mascot is not the production game character.

### 2.3 Approved art is authoritative

Production rendering must use approved artwork through stable manifest keys. Raw filenames are implementation details, not a public asset API.

Procedural replacement art must not silently appear if approved art fails. Missing required production art is a release failure and must be reported loudly.

### 2.4 Simulation owns gameplay

Gameplay state is owned by deterministic systems. Renderers present state; they do not become the source of truth for collision, progression, boss state, save state, phenotype timing, or level completion.

### 2.5 No Playwright in the Seed Man production workflow

Seed Man validation should use deterministic Node tests, syntax validation, build verification, release-contract checks, route/static checks, live HTTP verification, Lighthouse where appropriate, and other non-Playwright tooling.

---

## 3. Canonical campaign structure

The campaign contains **20 contiguous levels across five worlds**, four levels per world.

### World 1 — Greenhouse Valley

**Visual identity:** lush greenhouse glass, oversized leaves, irrigation tubing, warm sunlight, humidity, clean nursery spaces, condensation, healthy plant life.

1. **Sprout Steps** — movement onboarding and basic combat introduction.
2. **Sunny Glade** — introduces vertical traversal and more deliberate enemy placement.
3. **Waterfall Way** — introduces water/environmental movement language and layered routes.
4. **Greenhouse Hub** — boss stage against **Overgrown Guardian**.

World purpose: teach the game's baseline movement, Seed Slinger combat, collectibles, checkpoints, simple phenotype acquisition, enemy tells, and boss-arena language.

### World 2 — Forest Ruins

**Visual identity:** ancient forest architecture reclaimed by plant growth, moss, roots, broken bridges, hollow trees, forgotten stone structures.

5. **Mossy Paths**
6. **Broken Bridges**
7. **Hollow Trunk**
8. **Temple of Trees** — **Ancient Dryad** boss.

World purpose: increase traversal complexity, introduce layered paths, stronger ambush encounters, vertical combat, and environmental storytelling.

### World 3 — Desert Canyon

**Visual identity:** red rock, harsh sunlight, dry plant forms, canyon shadows, wind, sand, heat shimmer, elevated rock platforms.

9. **Red Rock Run**
10. **Canyon Cliffs**
11. **Dusty Winds**
12. **Sun Spire** — **Scorchroot Titan** boss.

World purpose: emphasize momentum, wind, gaps, heat hazards, aggressive enemy pressure, and Fire-form visual contrast.

### World 4 — Frozen Peaks

**Canonical world key:** `frozen-peaks`

**Visual identity:** snow, ice, crystalline caves, frozen bridges, cold atmospheric haze, blue-white highlights, reflected light, icicles, frost particles.

13. **Icy Pass**
14. **Crystal Caverns**
15. **Frozen Bridges**
16. **Glacier Gate** — **Frostbite Colossus** boss.

World purpose: change movement feel through ice/slip surfaces, create tighter hazard timing, emphasize Ice-form control, and increase boss telegraph complexity.

### World 5 — Eco City

**Visual identity:** green futuristic infrastructure, industrial decay, energy systems, pipes, reactor structures, toxic outskirts, plant technology reclaiming machinery.

17. **Toxic Outskirts**
18. **Industrial Zone**
19. **Reactor Core** — **Eco Sentinel** boss.
20. **The Last Seed** — final confrontation with **Blight King**.

World purpose: combine the campaign's learned mechanics, increase mixed enemy compositions, use environmental hazards aggressively, and resolve the story through the Blight King finale.

---

## 4. Player movement and feel

Movement quality is a first-class feature. A beautiful game that feels bad to control is not production complete.

### Baseline movement

The player must support:

- left/right movement
- acceleration and deceleration
- jump
- double jump
- variable jump height
- coyote time
- jump buffering
- landing response
- fall state
- moving-platform attachment
- spring/bounce surfaces
- ice friction
- knockback
- short invulnerability frames after damage
- responsive keyboard controls
- responsive touch controls

### Target feel

Seed Man should feel agile but grounded. The character should have enough acceleration to communicate weight, but input latency must remain extremely low. Stopping should feel controlled rather than slippery except on intentionally slippery surfaces.

Jump arcs must support both deliberate platform placement and reaction play. Players should be able to correct slightly in the air without making movement feel weightless.

### Movement states

The visual/state system should explicitly support:

- idle
- walk
- run
- jump rise
- fall
- land
- attack
- phenotype attack
- hit/hurt
- knockback
- death/fall recovery
- victory
- transformation

A single generic airborne frame is acceptable only as a temporary implementation step. Production art should distinguish jump rise and fall because silhouette/readability improves immediately.

---

## 5. Combat system

Seed Man has a permanent baseline weapon plus temporary phenotype combat forms.

### Seed Slinger

The base Plant form uses the **Seed Slinger** as the always-available attack.

Design goals:

- fast response
- clear projectile silhouette
- low input delay
- consistent hit feedback
- modest baseline damage
- sufficient range for airborne enemies
- no dependency on temporary powers for basic progress

### Combat feel requirements

Combat should eventually include:

- attack anticipation where appropriate
- impact frame / subtle hit stop
- enemy hit flash
- knockback
- impact particles
- unique status particles for burn/freeze/electric chain
- small camera impulse for heavy hits
- clear enemy death feedback
- boss hit confirmation
- readable telegraphs before dangerous attacks

Combat must never become visually noisy enough to obscure platforms or hazards.

---

## 6. Phenotype system

Phenotype absorption is one of the game's signature mechanics.

### Canonical forms

#### Plant

Permanent base form.

Role:

- standard Seed Slinger attack
- reliable neutral gameplay
- no timer
- baseline visual identity

#### Fire

Temporary **30-second** form.

Role:

- stronger projectile damage
- burn status
- warm/orange-red VFX
- fire trails and impact sparks

#### Electric

Temporary **30-second** form.

Role:

- fast attack cadence
- chain damage to nearby enemies
- electric arc VFX
- bright electric pulse on impact

#### Ice

Temporary **30-second** form.

Role:

- freeze/control enemies
- icy projectile and crystal impact VFX
- cold rim-light effect around Seed Man

### Acquisition

Fire, Electric, and Ice are earned by defeating phenotype carriers or selected minor encounters. Carriers must visually communicate their form before the player defeats them.

Examples:

- Fire carrier based on Thorn Beetle
- Electric carrier based on Drone Bot
- Ice carrier based on Root Crawler

### Transformation experience

Acquisition should feel important:

1. enemy defeat
2. phenotype energy/core leaves carrier
3. energy travels toward Seed Man
4. short transformation flash
5. approved phenotype character artwork appears
6. HUD changes color and form name
7. timer begins at 30 seconds
8. appropriate audio sting plays

Expiration should similarly communicate the return to Plant form instead of silently changing sprites.

### Power philosophy

Temporary powers should create tactical opportunities, not mandatory keys that permanently block progress. Levels can reward a specific form with optional routes, faster enemy clears, secrets, or challenge medals without making ordinary completion impossible after the timer expires.

---

## 7. Enemy system

The canonical enemy catalog contains ten core archetypes:

1. Sproutling
2. Root Crawler
3. Toxic Spore
4. Drone Bot
5. Thorn Beetle
6. Sky Wasp
7. Spike Plant
8. Sludge Monster
9. Bone Weed
10. Shadow Root

### Enemy design requirements

Every production enemy should define:

- visual silhouette
- world placement rules
- movement role
- health
- speed
- attack pattern
- telegraph timing
- hit reaction
- death animation
- status reactions
- drop behavior
- audio events
- animation states
- encounter difficulty role

### Required animation states

At minimum:

- idle
- move
- attack anticipation
- attack
- hit
- defeated

Flying or teleporting enemies require movement-specific states.

### Encounter composition

Enemy placement should derive from each canonical level's `enemyPool` instead of hard-coded retired level IDs. Difficulty should increase through composition, timing, terrain interaction, and combinations—not only increased health.

Worlds should introduce enemies gradually, then reuse them in more complex combinations later.

---

## 8. Boss direction

Bosses should feel like authored encounters, not oversized normal enemies.

### Boss roster

1. Overgrown Guardian
2. Ancient Dryad
3. Scorchroot Titan
4. Frostbite Colossus
5. Eco Sentinel
6. Blight King

### Common boss requirements

Every boss needs:

- entrance presentation
- dedicated arena composition
- readable health bar
- unique silhouette
- at least two attacks
- telegraphed dangerous attacks
- vulnerability windows
- phase or intensity escalation
- hit feedback
- defeat animation
- world restoration/result moment
- boss-specific music layer or track

### Blight King

The Blight King is the four-phase final boss and should be treated as a full finale.

Canonical weakness progression:

1. Plant
2. Fire
3. Electric
4. Ice

Visual requirements:

- each phase must communicate its active weakness without relying only on text
- arena lighting/environment should change with phases
- attack patterns should escalate
- transitions should include strong audiovisual feedback
- the final defeat should trigger a clear campaign-completion sequence rather than instantly returning to a menu

---

## 9. Level design rules

Every level should be hand-authored/tuned even if procedural utilities help generate initial geometry.

A finished level needs:

- readable opening/tutorial moment
- one primary mechanical theme
- progressive escalation
- traversal challenge
- at least one meaningful combat composition
- environmental storytelling
- collectible placement
- checkpoint placement
- optional route or secret
- recognizable visual landmark
- strong final approach
- readable finish goal

Boss stages additionally need:

- approach/build-up
- arena reveal
- boss entrance
- safe learning phase
- escalation
- defeat sequence

### Difficulty curve

Difficulty should grow across dimensions:

- narrower recovery windows
- more complex enemy combinations
- more layered traversal
- environmental hazards
- altered movement surfaces
- multi-directional threats
- longer sequencing between checkpoints

Avoid simply increasing enemy HP as the primary difficulty mechanic.

---

## 10. Collectibles and progression

Baseline progression includes level completion and seed/resource collection. The long-term system should support replayability.

Potential progression layers:

- hidden DTF tokens
- seed vault collectibles
- world completion percentage
- time medals
- no-hit medals
- phenotype challenges
- secret-room completion
- boss medals
- collectible encyclopedia entries
- campaign completion rewards

These should be data-driven so additional challenge categories can be introduced later without rewriting every level.

---

## 11. World visual direction

The visual target is a polished **2D / 2.5D illustrated platformer presentation** using approved hero and creature artwork with depth, lighting, environmental motion, particles, and layered parallax.

The current game must move away from flat prototype geometry and generic primitive enemies.

### Layering model

Each world should support:

1. far background / sky
2. distant silhouettes
3. midground environmental structures
4. gameplay terrain
5. foreground decoration
6. atmospheric particles
7. interactive VFX

Parallax should be subtle and should never interfere with gameplay readability.

### Greenhouse Valley enhancements

- glasshouse roof structures
- sunlight shafts
- condensation
- irrigation tubes
- hanging lights
- trays/benches
- oversized healthy foliage
- water droplets
- gentle leaf motion
- warm humid haze

### Forest Ruins enhancements

- layered tree trunks
- moss-covered ruins
- giant roots
- shafts of forest light
- drifting pollen/spores
- vines
- broken masonry
- hollow-tree interiors
- ancient carved plant motifs

### Desert Canyon enhancements

- distant mesas
- heat shimmer
- dust particles
- wind-driven debris
- dry plant silhouettes
- stratified rock platforms
- strong light/shadow separation

### Frozen Peaks enhancements

- crystalline depth layers
- blowing snow
- ice reflection
- cold fog
- icicle particles
- frozen waterfalls
- distant mountain silhouettes
- subtle aurora/sky variation where appropriate

### Eco City enhancements

- layered industrial architecture
- pipes and conduits
- green energy systems
- toxic runoff
- reactor glow
- warning lights
- reclaimed vegetation
- moving machinery
- electrical arcs
- environmental steam

---

## 12. Character visual production

The approved Seed Man atlas currently establishes the visual identity but production needs complete motion coverage.

### Required Plant-form animation set

- idle loop
- walk
- run
- jump rise
- jump apex
- fall
- land
- Seed Slinger attack
- phenotype ability pose
- hit
- knockback
- defeat/fall
- checkpoint activation
- transformation start
- transformation end
- victory

### Required phenotype animation coverage

Fire, Electric, and Ice should not remain one static form image while the character moves.

Each form should eventually support at least:

- idle
- run
- jump
- fall
- attack
- hit
- transformation in
- transformation out

The silhouette and proportions must remain Seed Man in every form.

### Animation principles

- readable at small mobile scale
- strong anticipation on attacks
- feet align consistently with collision ground
- no visual sliding during run cycle
- facing flip must not break asymmetric details
- attack VFX should originate from consistent hand/weapon points

---

## 13. Enemy and boss art production

The current primitive Canvas enemy rendering is a temporary implementation layer. Production should replace those shapes with approved atlas/sprite rendering while preserving deterministic hitboxes.

For every enemy and boss create:

- concept sheet
- turnaround/reference where useful
- idle frame(s)
- move animation
- attack anticipation
- attack animation
- hit reaction
- defeat animation
- phenotype-carrier treatment where applicable
- status overlays for burn/freeze/electric
- shadow
- optional portrait/icon for HUD/bestiary

Bosses additionally need phase visual variants and attack VFX.

---

## 14. VFX direction

VFX should reinforce mechanics and world identity.

Core VFX library should include:

- landing dust
- jump puff
- sprint dust/trail
- seed projectile trail
- seed impact
- fire projectile
- burn particles
- electric arc
- chain hit
- ice projectile
- freeze crystal
- enemy hit flash
- enemy defeat burst
- phenotype absorption trail
- transformation flash
- timer-expiration dissolve
- checkpoint activation
- collectible burst
- boss impact
- boss phase transition
- final victory/restoration sequence

World-specific atmospheric VFX should be separate from gameplay-significant VFX so readability remains controllable.

---

## 15. Camera direction

Camera behavior should support play rather than merely follow the player center.

Target features:

- horizontal look-ahead based on movement direction
- vertical anticipation for large jumps/falls
- boss arena lock
- mild landing impulse
- restrained impact shake on heavy attacks
- smooth checkpoint respawn positioning
- reduced-motion option that removes camera shake

Camera shake must never make mobile play difficult.

---

## 16. HUD and menus

Production HUD should display only immediately useful information while preserving visual clarity.

Required HUD information:

- health/damage state
- seed/collectible progress
- current phenotype
- phenotype timer
- current level/world
- boss health when applicable
- checkpoint feedback

Menus/surfaces needed:

- title/start screen
- level select
- world progression
- pause
- settings
- controls
- accessibility
- completion results
- campaign completion

Touch controls should preserve gameplay visibility and adapt to narrow screens.

---

## 17. Audio direction

The game needs a cohesive audio system rather than isolated effects.

### Music

- title theme
- one musical identity per world
- boss variation for each world
- Blight King finale track
- victory/restoration cue

### SFX

- movement
- jump/double jump
- landing
- Seed Slinger
- Plant impact
- Fire attack/impact/burn
- Electric attack/chain
- Ice attack/freeze
- player damage
- enemy damage
- enemy defeat
- boss telegraph
- boss hit
- checkpoint
- collectible
- UI focus/select/back
- phenotype absorption
- phenotype expiration
- victory

Environmental loops should be world specific and subtle.

---

## 18. Accessibility

Accessibility is part of production quality.

Target support:

- keyboard controls
- touch controls
- controller mapping when implemented
- reduced motion
- adjustable music/SFX
- readable UI contrast
- scalable UI/text where practical
- color + shape/icon communication for phenotype forms
- non-color boss weakness cues
- pause-safe gameplay
- clear focus states
- semantic DOM for menus/settings
- canvas instructions/alternative status text where meaningful

---

## 19. Runtime architecture

The intended ownership model is:

### Simulation

Owns:

- movement
- collision
- enemy state
- combat state
- boss state
- phenotype timing
- pickups
- checkpoints
- progression
- save state

### Renderer

Owns:

- approved character presentation
- approved enemy/boss presentation
- world art
- animation playback
- particles
- lighting
- camera presentation

### DOM/UI

Owns:

- HUD
- menus
- level selection
- settings
- accessibility surfaces
- status messaging

### Data

Owns:

- campaign structure
- level definitions
- enemy definitions
- boss definitions
- visual manifest keys
- collectible definitions
- audio event definitions

---

## 20. Key source files

### Campaign

- `data/campaign.json`
- `data/campaign-20-v1.json`
- `data/levels-20-v1.json`
- `src/systems/level-catalog.mjs`
- `src/systems/level-runtime.mjs`
- `src/systems/campaign-state-v2.mjs`
- `src/systems/save-state-v2.mjs`

### Combat / enemies

- `data/enemy-catalog-v1.json`
- `src/systems/phenotype-system.mjs`
- `src/systems/power-drop.mjs`
- `src/systems/boss-state-machine.mjs`
- `src/systems/final-boss-director.mjs`
- `src/systems/world-boss-map.mjs`
- public v20 combat/enemy adapters under `site/public-route-patch/games/seed-man-platformer/`

### Art

- `data/seed-man-art-manifest-v1.json`
- `src/render/art-registry.mjs`
- `src/render/visual-runtime-v2.mjs`
- `src/render/approved-art-loader.mjs`
- public `approved-art-core-v1.js`
- public `approved-art-runtime-v1.js`
- public `seed-man-production-art.js`

### World systems

- `src/systems/world-theme.mjs`
- `src/systems/platform-surface-map.mjs`
- `src/systems/vfx-catalog.mjs`
- `src/systems/audio-events.mjs`
- `src/systems/collectible-catalog.mjs`

### Production

- `src/systems/production-assets.mjs`
- `src/systems/production-bootstrap.mjs`
- `src/systems/game-contract.mjs`
- `src/systems/production-readiness.mjs`
- `src/systems/release-contract.mjs`
- `scripts/verify-seed-man-production-v20.mjs`
- `scripts/validate-seed-man-production-bundle.mjs`

---

## 21. Current known technical debt / active correction list

This section should be updated whenever a defect is found or closed.

### Deployment/public-surface drift

The repository v20 build and the visitor-facing WordPress route have previously diverged, leaving old Sprout Run / Greenhouse Gauntlet content visible after v20 source changes.

Release requirement:

- source → generated public bundle → WordPress publication → live route must be verified as one chain
- live verification must use v20 markers
- old Sprout Run markers must fail the release
- Game Hub copy must match the canonical v20 identity

### Bootstrap level debt

The public `index.html` still contains an embedded bootstrap level based on the old 7,800px / 24-seed prototype and legacy `speed`, `shield`, `magnet`, and `jump` powerups.

Direction:

- bootstrap should become the smallest safe loading state possible
- it must not visually masquerade as a valid production level
- canonical v20 campaign data must replace it immediately during boot
- legacy traversal powerups must not be confused with phenotype powers

### Campaign powerup debt

`campaign-v20-runtime.js` still generates prototype `speed`, `shield`, `magnet`, and `jump` powerups.

Direction:

- separate traversal modifiers from phenotype drops if traversal modifiers remain desired
- temporary combat phenotype ownership must remain Plant / Fire / Electric / Ice
- phenotype carriers should be produced from canonical enemy data/runtime

### Combat adapter debt

The older `combat-browser-v1.js` and `enemy-attacks-browser-v1.js` contain retired level identifiers such as `sprout-run`, `nursery-night-shift`, and `reservoir-run`.

This creates a severe fallback risk: current v20 level IDs can inherit the same retired Sprout Run encounter definitions.

Direction:

- current encounters must derive from each v20 level's `enemyPool`
- boss instances must derive from current `level.boss`
- hostile attack definitions should derive from the same encounter instances rather than maintain a duplicate static level table
- phenotype carriers must expose only Fire, Electric, and Ice temporary forms

### Character animation debt

The approved production renderer currently has explicit atlas regions for idle/run/jump/attack/hurt/victory plus static Plant/Fire/Electric/Ice form regions.

Direction:

- add walk/fall/land animation coverage
- add full pose animation per phenotype
- avoid displaying a single static phenotype image for every movement state
- maintain approved art-only policy

### Enemy visual debt

Current browser combat still contains primitive Canvas shapes for enemies and bosses.

Direction:

- replace primitive drawing with approved asset-manifest-driven enemy/boss art
- preserve collision boxes independently from sprite dimensions
- create complete state animation coverage

---

## 22. Visual enhancement roadmap

### Phase A — Character fidelity

1. Finish approved Plant animation set.
2. Finish Fire animation set.
3. Finish Electric animation set.
4. Finish Ice animation set.
5. Add transformation sequences.
6. Add attack origin/socket metadata.
7. Add production shadows and contact effects.

### Phase B — Enemy readability

1. Produce all ten enemy art sets.
2. Add attack anticipation frames.
3. Add hit/death states.
4. Add Fire/Electric/Ice carrier variants.
5. Replace primitive Canvas enemy rendering.

### Phase C — World depth

For each world create:

- background panorama
- midground layer
- foreground terrain tiles
- props
- hazards
- checkpoint art
- finish/exit art
- atmospheric particles
- ambient animation
- lighting treatment
- boss arena set

### Phase D — Boss spectacle

1. Approved boss character sheets.
2. Idle/attack/hit/phase/defeat animation.
3. Telegraph VFX.
4. Arena-specific environmental animation.
5. Boss HUD treatment.
6. Music and impact audio.
7. Blight King four-phase visual transformation system.

### Phase E — Presentation polish

- title screen
- world map / level select
- animated world transitions
- checkpoint sequence
- results screen
- campaign ending
- collectible reveal animations
- improved mobile HUD
- accessibility settings

---

## 23. Production QA checklist

Before a Seed Man release is called production-ready:

### Source

- [ ] campaign contains exactly 20 levels
- [ ] five canonical worlds
- [ ] six canonical bosses
- [ ] Level 20 contains Blight King
- [ ] `frozen-peaks` key is consistent
- [ ] Plant/Fire/Electric/Ice phenotype contract passes
- [ ] no active v15 imports
- [ ] no Playwright Seed Man release tests

### Art

- [ ] approved character manifest loads
- [ ] procedural character fallback disabled
- [ ] legacy atlas fallback disabled
- [ ] every required production art key exists
- [ ] world art keys resolve
- [ ] phenotype visual states resolve

### Gameplay

- [ ] all 20 levels load
- [ ] level selection works
- [ ] checkpoints restore correctly
- [ ] save migration works
- [ ] enemy pools match level data
- [ ] phenotype carriers work
- [ ] 30-second expiry works
- [ ] bosses instantiate from campaign data
- [ ] Blight King phases work
- [ ] final completion works

### Build

Run:

```bash
npm --prefix games/seed-man-platformer run test:production-contracts
npm --prefix games/seed-man-platformer run build:three-public
node scripts/verify-seed-man-production-v20.mjs
node scripts/validate-seed-man-production-bundle.mjs
```

### Live release

- [ ] dedicated Seed Man publisher succeeds
- [ ] Public Suite/Game Hub publisher succeeds where relevant
- [ ] live route HTTP 200
- [ ] no redirect to stale route
- [ ] live HTML contains `20260908-v20`
- [ ] live page says 20 levels / 5 worlds
- [ ] current campaign runtime is reachable
- [ ] approved art runtime is reachable
- [ ] old Greenhouse Gauntlet markers absent
- [ ] old Sprout Run public copy absent
- [ ] Game Hub uses canonical title/copy

---

## 24. Development workflow

Preferred workflow for normal changes:

1. identify canonical source owner
2. create focused branch
3. implement source change
4. update public mirror only where production requires it
5. add/update deterministic tests
6. run release contracts
7. open PR
8. review CI failures as defects, not obstacles
9. merge through PR
10. allow/trigger production publisher
11. verify visitor-facing live route
12. update this document when direction or ownership changes

Emergency direct-to-main fixes should remain exceptional because the repository's Main PR audit is intended to detect bypassed governance.

---

## 25. Expansion model

The architecture should allow future content without replacing v20 fundamentals.

Possible future expansions:

- bonus levels
- challenge rooms
- time trials
- boss rush
- collectible hunt mode
- community event levels
- seasonal visual variants
- additional world after the canonical campaign
- optional new phenotype forms only after Plant/Fire/Electric/Ice are fully polished
- cosmetic Seed Man variants that preserve collision/gameplay identity
- achievements
- bestiary
- lore/seed vault gallery
- local challenge leaderboards
- multiplayer race mode if architecture later supports it cleanly

Any expansion must preserve compatibility with existing saves or include an explicit migration.

---

## 26. Definition of done

Seed Man is not considered complete merely because all 20 level records exist or the route returns HTTP 200.

A production-quality milestone requires:

- responsive movement
- coherent combat
- canonical phenotype mechanics
- authored encounters
- functioning bosses
- complete approved character animation
- strong world art
- enemy/boss art replacing primitives
- polished HUD
- audio
- VFX
- accessibility
- reliable save/progression
- mobile usability
- deterministic automated validation
- correct WordPress deployment
- independent live-route verification

The final standard is that the live browser game visually and mechanically resembles the approved Seed Man game direction—not the historical prototype that happened to exist first.

---

## 27. Living-document update protocol

When adding approved direction, append it to the most relevant section and update the **Change Log** below. Avoid creating competing design documents unless the material is a specialized technical specification that links back here.

When a previous direction is retired:

- mark it clearly as retired
- identify its replacement
- update code/data contracts
- update release checks
- remove stale production references

Do not leave two contradictory rules both described as current.

### Change Log

- **2026-09-09** — Created comprehensive canonical Game Direction & Production Bible for the Seed Man v20 campaign. Consolidated campaign, visual, gameplay, combat, phenotype, enemy, boss, architecture, deployment, QA, accessibility, audio, level-design, art-production, technical-debt, and expansion direction. Recorded current deployment drift, prototype bootstrap/powerup debt, retired combat adapter level-ID mismatch, and incomplete phenotype animation coverage as active correction targets.
