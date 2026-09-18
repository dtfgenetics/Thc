# Seed Man: Grow. Fight. Restore.

## Canonical Game Direction & Production Master

**Project:** Seed Man: Grow. Fight. Restore.  
**Studio / Brand:** DTF Genetics  
**Canonical repository:** `dtfgenetics/Thc`  
**Game source:** `games/seed-man-platformer/`  
**Public production bundle:** `site/public-route-patch/games/seed-man-platformer/`  
**Public route:** `https://dtfseeds.com/games/seed-man-platformer/`  
**Campaign target:** 20 levels / 5 worlds / 6 bosses  
**Production character contract:** approved green-armored plant-hero Seed Man  
**Core phenotype forms:** Plant, Fire, Electric, Ice  
**Document role:** long-term source of truth for design, engineering, art, content, QA, and production direction.

---

## 1. Purpose of This Document

This document defines what Seed Man is, what it must become, how its systems should fit together, which content is canonical, what visual direction must be protected, what technical architecture owns each responsibility, and how future additions should be evaluated.

It exists to prevent the project from drifting back into older prototypes, duplicated runtimes, inconsistent character art, conflicting campaign counts, temporary one-off patches, or gameplay systems that are disconnected from the intended final game.

Whenever a new feature, level, enemy, power, animation, UI element, visual asset, audio system, or deployment change is proposed, it should be checked against this document.

If implementation details change later, update this document alongside the code so future development always has an accurate map of the intended game.

---

# 2. Game Identity

## Title

**Seed Man: Grow. Fight. Restore.**

The title communicates the three pillars of the game:

1. **Grow** — Seed Man represents plant life, genetics, cultivation, environmental recovery, and transformation.
2. **Fight** — the game is an action platformer with active combat, enemy encounters, phenotype abilities, bosses, hazards, and movement challenges.
3. **Restore** — the campaign moves from living natural spaces into increasingly damaged environments, culminating in a battle to restore the final seed and defeat the Blight King.

The public game should not be presented as the older names **Sprout Run**, **Greenhouse Gauntlet**, or any retired 11-level / 15-level prototype identity.

---

# 3. High-Level Game Vision

Seed Man is a polished browser action-platformer inspired by the readability, responsiveness, exploration, transformation, and power-copy fantasy of classic platform games while remaining an original DTF Genetics world.

The intended player fantasy is:

> Play as the approved Seed Man hero, travel through five increasingly dangerous plant-inspired worlds, use tight movement and ranged combat, defeat enemies that carry temporary phenotype powers, transform into Fire, Electric, or Ice forms for 30 seconds, defeat world bosses, discover secrets, collect seeds, and restore the world before confronting the Blight King.

The game should feel immediately readable for a casual player while still supporting replay value through mastery, secrets, collectible completion, fast clears, phenotype routing, and optional challenges.

---

# 4. Design Pillars

## 4.1 Responsive Movement

Movement must feel precise before any art polish is considered complete.

Core movement includes:

- left/right movement
- acceleration and deceleration
- jump
- double jump
- coyote time
- jump buffering
- variable jump height
- controlled falling
- strong landing feedback
- knockback and recovery
- moving-platform attachment
- spring / bounce surfaces
- slippery ice
- wind zones
- world-specific traversal mechanics

The game should never feel like Seed Man is sliding unintentionally, missing inputs, snapping unpredictably, or colliding with invisible geometry.

## 4.2 Readable Combat

Combat should be simple to understand but expressive enough to support mastery.

Base combat:

- Seed Man always retains a basic Seed Slinger attack.
- Enemy attacks must telegraph before dangerous actions.
- Hits should produce visible and audible feedback.
- Enemies need readable silhouettes and roles.
- Bosses need clearly communicated phases and vulnerabilities.

## 4.3 Phenotype Transformation

Phenotype absorption is the signature system.

Seed Man's permanent identity is **Plant**.

Three temporary combat phenotypes are canonical:

- **Fire**
- **Electric**
- **Ice**

These forms are obtained by defeating phenotype carrier enemies or specific minor encounters.

Each temporary phenotype lasts **30 seconds** unless a future explicitly approved upgrade system modifies that duration.

The phenotype timer must be visible and easy to understand.

The transformation must affect:

- character appearance
- attacks
- VFX
- audio
- HUD
- enemy reactions
- tactical choices

The forms must remain clearly recognizable as the same approved Seed Man character rather than unrelated alternate characters.

## 4.4 World Personality

Every world must have its own:

- foreground tiles
- background
- midground layers
- environmental props
- ambience
- hazards
- traversal mechanics
- enemy mix
- particles
- lighting treatment
- audio palette
- boss arena identity

A new world cannot simply be the same platforms with a different background color.

## 4.5 Clear Progression

Players should always understand:

- current level
- current world
- collectible progress
- phenotype state and remaining time
- boss state
- checkpoint state
- whether the finish is available
- campaign completion
- optional completion goals

---

# 5. Canonical Character Direction

## 5.1 Seed Man Production Character

The production platformer character is the **approved green-armored plant-hero Seed Man**.

Key visual traits:

- large leaf-shaped head silhouette
- expressive face
- green / white / black body treatment
- white gloves
- white boots
- heroic but approachable platform-game proportions
- strong readable silhouette at gameplay scale
- consistent body proportions across all frames

The older simple brown oval Seed Man mascot should not replace this production character inside the platformer.

## 5.2 Required Animation States

The minimum complete production character animation set is:

- idle
- walk
- run
- jump
- fall
- land
- attack
- hit
- victory

Recommended expansion states:

- crouch / look down
- skid / turn
- ledge anticipation
- respawn
- death / defeat
- checkpoint celebration
- phenotype transformation in
- phenotype transformation out
- boss-intro reaction
- final victory

## 5.3 Phenotype Animation Coverage

Plant, Fire, Electric, and Ice must eventually support the same core animation state machine.

The production runtime must not treat Fire, Electric, or Ice as a single static replacement frame while Seed Man moves through different poses.

Target matrix:

| Form | Idle | Walk | Run | Jump | Fall | Land | Attack | Hit | Victory |
|---|---|---|---|---|---|---|---|---|---|
| Plant | Required | Required | Required | Required | Required | Required | Required | Required | Required |
| Fire | Required | Required | Required | Required | Required | Required | Required | Required | Required |
| Electric | Required | Required | Required | Required | Required | Required | Required | Required | Required |
| Ice | Required | Required | Required | Required | Required | Required | Required | Required | Required |

---

# 6. Phenotype Powers

## Plant

Plant is the permanent base form.

Base identity:

- Seed Slinger projectile
- balanced movement
- no expiration timer
- primary recognizable Seed Man appearance

Potential future Plant abilities:

- vine pull
- root stomp
- seed burst
- temporary sprout platform

These are expansion ideas, not mandatory current production behavior.

## Fire

Gameplay role:

- aggressive damage
- burning projectile
- damage-over-time pressure
- stronger visual impact

Visual language:

- flame trails
- orange/red energy
- glowing leaf edges
- ember particles
- heat distortion

## Electric

Gameplay role:

- fast attack
- chain damage
- strong multi-target utility

Visual language:

- branching arcs
- bright electric flashes
- violet/white highlights
- rapid energy pulses

Potential advanced behavior:

- lightning strike from above
- temporary conductive environmental interactions

## Ice

Gameplay role:

- crowd control
- freezing enemies
- safer traversal through dangerous encounters

Visual language:

- icy highlights
- frost mist
- crystal shards
- cold particle trails

Potential advanced behavior:

- frozen temporary enemy platforms
- interaction with water or moving hazards

---

# 7. Canonical Campaign

The campaign contains **20 contiguous levels** across **five worlds**, four levels per world.

## World 1 — Greenhouse Valley

### Level 1 — Sprout Steps

Purpose:

- movement introduction
- jumping
- double jump
- Seed Slinger introduction
- early Sproutling / Root Crawler encounters

### Level 2 — Sunny Glade

Purpose:

- moving platforms
- Toxic Spore introduction
- first phenotype carrier opportunity

### Level 3 — Waterfall Way

Purpose:

- vertical traversal
- springs
- flying enemies
- larger environmental motion

### Level 4 — Greenhouse Hub

Boss:

**Overgrown Guardian**

Purpose:

- first arena lock
- first full boss tutorial

---

## World 2 — Forest Ruins

### Level 5 — Mossy Paths

Themes:

- dense plant growth
- vine platforms
- root hazards

### Level 6 — Broken Bridges

Themes:

- collapsing traversal
- airborne pressure
- dangerous gaps

### Level 7 — Hollow Trunk

Themes:

- dark internal spaces
- toxic spores
- ambushes
- teleporting roots

### Level 8 — Temple of Trees

Boss:

**Ancient Dryad**

---

## World 3 — Desert Canyon

### Level 9 — Red Rock Run

Themes:

- speed
- heat
- lava
- rockfall
- updraft traversal

### Level 10 — Canyon Cliffs

Themes:

- vertical cliff routes
- moving platforms
- stronger enemy combinations

### Level 11 — Dusty Winds

Themes:

- sandstorm
- wind zones
- reduced stability / directional pressure

### Level 12 — Sun Spire

Boss:

**Scorchroot Titan**

---

## World 4 — Frozen Peaks

Canonical world key:

`frozen-peaks`

Do not reintroduce `frozen-peak` as the primary production key.

### Level 13 — Icy Pass

Themes:

- slippery ground
- ice spikes

### Level 14 — Crystal Caverns

Themes:

- crystal bounce
- falling icicles
- reflective / refractive visual identity

### Level 15 — Frozen Bridges

Themes:

- breakaway ice
- wind
- collapsing traversal

### Level 16 — Glacier Gate

Boss:

**Frostbite Colossus**

---

## World 5 — Eco City

### Level 17 — Toxic Outskirts

Themes:

- toxic runoff
- electric floors
- industrial contamination

### Level 18 — Industrial Zone

Themes:

- machinery
- lasers
- crushers
- timed doors

### Level 19 — Reactor Core

Boss:

**Eco Sentinel**

This is an important pre-finale escalation stage.

### Level 20 — The Last Seed

Final Boss:

**The Blight King**

This level should feel unlike any ordinary level.

Required features:

- final gauntlet
- phenotype cycle mechanic
- major arena presentation
- four boss phases
- final restoration sequence
- satisfying campaign ending

---

# 8. Enemy Catalog

Canonical common enemy archetypes:

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

## Enemy Role Goals

### Sproutling

Basic walker. Teaches direct combat and spacing.

### Root Crawler

Low crawler. Encourages jump timing and lower-target awareness.

### Toxic Spore

Ranged pressure enemy.

### Drone Bot

Flying technology enemy, especially appropriate for later industrial areas.

### Thorn Beetle

Charge-oriented enemy.

### Sky Wasp

Fast airborne dive attacker.

### Spike Plant

Stationary turret / area denial enemy.

### Sludge Monster

Slow high-health tank.

### Bone Weed

Ambush / burst enemy.

### Shadow Root

Teleporting or repositioning threat.

---

# 9. Phenotype Carriers

The canonical phenotype carrier model uses existing enemy archetypes with visually recognizable empowered variants.

Current intended mapping:

- Fire carrier → Thorn Beetle base
- Electric carrier → Drone Bot base
- Ice carrier → Root Crawler base

Carrier requirements:

- unmistakable visual aura
- unique VFX
- readable phenotype color
- stronger than ordinary version
- explicit defeat feedback
- 30-second power drop
- transformation cue when collected / absorbed

A phenotype carrier must never look identical to its standard enemy.

---

# 10. Bosses

Canonical bosses:

1. Overgrown Guardian
2. Ancient Dryad
3. Scorchroot Titan
4. Frostbite Colossus
5. Eco Sentinel
6. Blight King

## Boss Production Requirements

Every boss must have:

- unique silhouette
- intro presentation
- arena framing
- telegraphs
- attack states
- hit state
- phase transition behavior
- clear health feedback
- defeat animation
- unique audio identity
- visual effects

## Blight King

The final boss should cycle weaknesses:

1. Plant
2. Fire
3. Electric
4. Ice

The weakness cycle must be visible through:

- boss color/state
- HUD indicator
- arena effects
- audio cue
- attack pattern change

The player should never have to guess which phase is active.

---

# 11. Level Design Framework

Each level should contain all of the following design beats:

1. **Arrival / orientation**
2. **Mechanic introduction**
3. **safe practice**
4. **mechanic + enemy combination**
5. **escalation**
6. **checkpoint**
7. **variation or optional route**
8. **strong encounter**
9. **final traversal / arena**
10. **finish payoff**

## Level Content Expectations

Every level should eventually include:

- authored terrain
- at least one distinctive visual landmark
- enemy encounter composition
- secrets
- collectibles
- checkpoints
- environmental storytelling
- optional challenge route
- world-specific mechanics
- audiovisual progression

Procedural generation may support prototyping, but final production levels should increasingly become hand-authored or hand-tuned.

---

# 12. Collectibles and Progression

Current collectible foundation:

- seeds
- checkpoints
- level completion

Recommended production progression:

- DTF tokens
- hidden seed vault items
- phenotype challenge medals
- boss medals
- secret-room completion
- world completion percentage
- best clear time
- no-death challenge
- all-seeds challenge
- all-carriers challenge

Recommended per-level result screen:

- Seeds collected
- Secrets discovered
- Deaths / falls
- Clear time
- Phenotypes used
- Challenge completion
- Best score / medal

---

# 13. Visual Direction

## 13.1 Overall Quality Target

The game should look like a cohesive professional platformer, not a browser prototype with flat rectangles layered over unrelated art.

Required visual qualities:

- approved Seed Man identity
- strong silhouettes
- layered scenes
- foreground depth
- atmospheric midground
- animated backgrounds
- cohesive palette per world
- readable collision surfaces
- visual hierarchy
- polished HUD
- high-quality effects
- consistent enemy scale
- strong boss scale contrast

## 13.2 Character Art Rule

Approved artwork is authoritative.

Production rules:

- no procedural replacement character
- no legacy atlas fallback
- no unrelated brown mascot substitution
- no silent fallback if approved production art is missing

If required art is absent, production validation should fail loudly.

## 13.3 World Art Package

Every world ultimately needs:

### Foreground

- ground tiles
- platform edges
- walls
- slopes where supported
- bridges
- destructible / collapsing elements

### Midground

- plants
- architecture
- ruins
- machinery
- crystals
- environmental structures

### Background

- panoramic backdrop
- multiple parallax layers
- skyline / canopy / canyon / mountain / city silhouettes

### Props

- signs
- pipes
- irrigation
- rocks
- vines
- fans
- machinery
- lamps
- crystals
- grow equipment
- environmental storytelling objects

### Effects

- dust
- pollen
- spores
- leaves
- rain / mist
- snow
- wind
- heat shimmer
- sparks
- steam
- smoke
- electricity
- ice particles

---

# 14. World-Specific Visual Enhancement Plan

## Greenhouse Valley

Visual goal:

Bright, alive, healthy, optimistic starting world.

Needs:

- glass greenhouse structures
- irrigation lines
- giant leaves
- planter beds
- warm sunlight shafts
- water droplets
- pollen motes
- subtle fans
- animated irrigation

## Forest Ruins

Visual goal:

Ancient overgrown plant civilization.

Needs:

- giant roots
- moss-covered stone
- ruined arches
- hollow trunks
- bioluminescent fungus
- deep parallax foliage
- drifting spores

## Desert Canyon

Visual goal:

Harsh heat and exposed geology.

Needs:

- red canyon walls
- layered mesas
- dry root structures
- heat shimmer
- sand particles
- falling rock VFX
- sun glare

## Frozen Peaks

Visual goal:

Cold high-altitude crystalline world.

Needs:

- ice cliffs
- snow layers
- crystal formations
- blizzard particles
- frozen vegetation
- visible wind
- reflective ice
- frozen waterfalls

## Eco City

Visual goal:

Industrial environmental conflict with pockets of plant recovery.

Needs:

- neon industrial structures
- pipes
- toxic runoff
- reactor lighting
- drones
- electrical arcs
- conveyor systems
- pollution haze
- restored-green contrast zones

---

# 15. UI / UX Direction

## Required HUD

The production HUD should support:

- health / damage state
- collectible count
- level progress
- current level
- world
- phenotype form
- phenotype timer
- boss health
- checkpoint feedback
- pause status

## Menus

Required production menus:

- Start / Continue
- Level Select
- Pause
- Settings
- Controls
- Accessibility
- Campaign completion

## Accessibility

Recommended support:

- keyboard remapping
- controller support
- touch controls
- reduced motion
- screen shake toggle
- VFX intensity option
- text scaling
- high-contrast HUD option
- audio sliders

---

# 16. Audio Direction

The game needs a complete audio identity.

## Music

Each world needs a distinct musical palette.

Bosses should receive either dedicated tracks or clearly intensified arrangements.

The final boss should have unique music.

## SFX

Required categories:

- footsteps / movement
- jump
- double jump
- land
- skid
- Seed Slinger
- Fire attack
- Electric attack
- Ice attack
- phenotype transform
- phenotype expiration
- enemy attack
- enemy hit
- enemy defeat
- player hit
- checkpoint
- collectible
- level finish
- menu UI
- boss phase transition
- boss defeat
- final restoration

---

# 17. Camera and Presentation

Camera should:

- lead slightly in movement direction
- avoid excessive jitter
- support vertical platforming
- frame boss arenas
- use restrained impact shake
- keep player readable on mobile

Potential cinematic moments:

- world introduction
- boss reveal
- phenotype first-use
- final Blight King phase
- Last Seed restoration

---

# 18. VFX Direction

Recommended shared VFX system:

- landing dust
- running dust
- foliage disturbance
- projectile trails
- impact burst
- hit flash
- enemy defeat burst
- phenotype pickup burst
- transformation aura
- checkpoint activation
- collectible sparkle
- finish flag / portal effect

Elemental VFX:

### Fire

- embers
- flame trail
- burn status
- heat distortion

### Electric

- arcs
- lightning streak
- chained target indicator

### Ice

- frost cloud
- crystal shards
- freeze shell
- shatter effect

---

# 19. Technical Architecture

Production architecture principle:

> Simulation owns gameplay. Rendering presents gameplay state.

The renderer must not secretly become the source of gameplay truth.

## Canonical Source

`games/seed-man-platformer/`

Contains canonical systems, data, tests, and production contracts.

## Public Bundle

`site/public-route-patch/games/seed-man-platformer/`

Contains the production browser bundle deployed to the public route.

## Canonical Campaign Data

- `games/seed-man-platformer/data/campaign.json`
- `games/seed-man-platformer/data/levels-20-v1.json`

## Enemy / Boss Data

- `games/seed-man-platformer/data/enemy-catalog-v1.json`
- `games/seed-man-platformer/data/boss-catalog-v1.json`

## Art Contract

- `games/seed-man-platformer/data/seed-man-art-manifest-v1.json`
- `games/seed-man-platformer/src/render/art-registry.mjs`
- `games/seed-man-platformer/src/render/visual-runtime-v2.mjs`
- `games/seed-man-platformer/src/render/approved-art-loader.mjs`

## Browser Runtime

The public runtime should converge on:

- one v20 campaign runtime
- one current combat runtime
- one current hostile-attack runtime
- one approved-art path
- one public deployment path

Avoid duplicated active implementations.

---

# 20. Runtime Ownership Rules

## Campaign owns

- current world
- current level
- level ordering
- boss assignment
- level metadata
- campaign completion

## Simulation owns

- player position
- velocity
- collision
- hazards
- checkpoints
- pickups
- movement state

## Combat owns

- enemies
- enemy health
- player attacks
- phenotype state
- phenotype timer
- status effects
- combat rewards

## Enemy attack runtime owns

- hostile telegraphs
- hostile projectiles
- attack hitboxes
- enemy attack timing

## Renderer owns

- sprites
- animation
- backgrounds
- effects
- visual state

Renderer must not invent alternate game state.

---

# 21. Asset API Rule

Raw filenames should not become permanent gameplay API.

Runtime code should refer to stable asset keys where possible.

Examples:

- `character.seedman.plant.run`
- `character.seedman.fire.attack`
- `enemy.thorn-beetle.attack`
- `boss.blight-king.phase-3`
- `world.frozen-peaks.background`

This allows source art to change without rewriting gameplay code.

---

# 22. Current Known Technical Gaps

This section should be maintained as defects are discovered and resolved.

## Recently identified

### Legacy combat level IDs

Older browser combat adapters were keyed to retired level IDs such as:

- `sprout-run`
- `nursery-night-shift`
- `reservoir-run`

Canonical v20 level IDs are different.

The older runtime silently fell back to Sprout Run encounters when it could not find a current level ID.

**Direction:** derive v20 enemy composition from canonical `level.enemyPool` / enemy catalog rather than a second hard-coded level map.

### Legacy generic powerups

The v20 browser campaign generator still contains prototype powerups:

- speed
- shield
- magnet
- jump

These conflict with the intended phenotype-centered combat identity.

**Direction:** Plant / Fire / Electric / Ice should own the primary transformation system. Prototype traversal powerups should be removed from the production campaign or reintroduced later only as intentionally designed separate pickups.

### Bootstrap drift

The public entrypoint historically included a large embedded Sprout Run prototype level before the v20 runtime replaced it.

**Direction:** bootstrap data must use a canonical v20 ID and contain no retired progression contract.

### Static phenotype frames

Existing approved art handling does not yet provide full animation-state coverage for every phenotype.

**Direction:** build full per-form animation sets.

### World art coverage

World backgrounds exist, but complete production-grade tiles, props, ambience, enemy animation, and boss arena art are still incomplete.

### Procedural level structure

The v20 browser runtime generates substantial platform layout procedurally.

**Direction:** use procedural generation only as scaffolding. Hand-author / hand-tune production levels over time.

---

# 23. Production Deployment Rules

Seed Man is independently published through its dedicated production workflow.

The release system must verify:

- exactly 20 levels
- five worlds
- six bosses
- final boss = Blight King
- approved character art contract
- canonical Frozen Peaks key = `frozen-peaks`
- current v20 campaign runtime
- current combat runtime
- current hostile attack runtime
- all public index scripts exist
- public campaign data matches canonical campaign data
- no active v15 runtime imports
- no active Sprout Run production identity

Deployment verification must check the actual live route after publication.

---

# 24. QA Strategy

Do not use Playwright for routine Seed Man QA.

Preferred deterministic checks:

- Node unit tests
- simulation tests
- campaign contract tests
- static route validation
- asset manifest validation
- syntax checks
- build checks
- deterministic browser-runtime contract checks where possible without Playwright
- Lighthouse for public page quality/performance
- direct live HTTP verification

## Required Contract Tests

Test that:

1. campaign contains exactly 20 unique contiguous level orders
2. all levels reference valid worlds
3. all enemyPool entries exist in enemy catalog
4. all bosses exist in boss catalog
5. all world art keys resolve
6. all required player animation states resolve
7. all current public index scripts exist
8. no retired v15 script is loaded
9. no production runtime falls back to `sprout-run`
10. phenotype duration is 30 seconds
11. only Plant / Fire / Electric / Ice are public production forms
12. enemy carriers resolve valid base enemies
13. final level resolves Blight King
14. Blight King has four phases
15. build output matches public deployment package

---

# 25. Performance Targets

Browser game performance should target:

- stable 60 FPS on modern desktop hardware
- usable 30–60 FPS on mid-range mobile devices
- minimized layout shifts
- compressed images
- optimized texture sizes
- sprite atlases where appropriate
- limited unnecessary DOM work during gameplay
- pooled particle effects where needed
- capped active projectiles
- deterministic update step

Avoid loading all world art at full resolution if only one world is active.

---

# 26. Visual Production Backlog

Priority order:

## P0 — Character Fidelity

- complete Plant animation sheet
- complete Fire animation sheet
- complete Electric animation sheet
- complete Ice animation sheet
- transform-in / transform-out animation

## P0 — Runtime Visual Integration

- state-to-animation mapping
- no static phenotype pose replacement
- correct sprite anchors
- consistent scale
- facing / flip behavior
- animation timing

## P1 — World Packages

Complete visual packages for all five worlds.

## P1 — Enemy Animation

For all ten canonical enemies:

- idle
- move
- attack
- hit
- defeat

## P1 — Phenotype Carrier Variants

- Fire carrier
- Electric carrier
- Ice carrier

## P1 — Boss Art

Six complete boss sets.

## P2 — Environmental VFX

- leaves
- dust
- pollen
- water
- snow
- sand
- steam
- electricity
- reactor effects

## P2 — UI Polish

- modern HUD
- boss HUD
- transformation timer
- level transition cards
- results screen

## P3 — Cinematics

- world intros
- boss intros
- ending sequence

---

# 27. Gameplay Production Backlog

## P0

- eliminate legacy combat fallbacks
- connect enemy encounters to canonical level enemy pools
- remove prototype powerups from active v20 identity
- guarantee phenotype carrier placement
- complete Fire / Electric / Ice behavior
- verify 30-second lifecycle

## P1

- boss encounters
- boss phase mechanics
- Blight King weakness cycle
- world hazards
- moving platforms
- collapsing platforms
- springs
- wind
- ice friction
- conveyor systems

## P2

- secrets
- alternate routes
- medals
- challenges
- replay rewards

---

# 28. Visual Audit Checklist

When reviewing the live game, evaluate each item from 1–5.

## Character

- approved silhouette
- sprite clarity
- animation smoothness
- form consistency
- readable attack state
- readable hit state

## World

- background depth
- tile quality
- prop density
- environmental motion
- lighting
- palette consistency

## Combat

- enemy readability
- telegraph visibility
- hit feedback
- projectile clarity
- phenotype distinction

## UI

- information hierarchy
- mobile readability
- timer clarity
- boss readability
- menu polish

## Overall

- does this look like one game?
- does any asset look like temporary programmer art?
- is the next action obvious?
- does every world feel unique?
- does the player character remain the visual focal point?

Any item scoring below 4 should enter the visual production backlog.

---

# 29. Live Audit Procedure

For every production release:

1. Confirm production workflow success.
2. Confirm exact deployed commit SHA.
3. Fetch the public route using a cache-busting URL.
4. Verify page title.
5. Verify v20 release marker.
6. Verify 20-level marker.
7. Verify approved-art marker.
8. Verify current runtime script filenames.
9. Verify campaign data reports 20 levels.
10. Verify no legacy `sprout-run` production identity is present.
11. Verify Game Hub card uses current title and description.
12. Verify public navigation uses current title.
13. Run Lighthouse.
14. Confirm desktop controls.
15. Confirm touch controls.
16. Confirm Level 1 loads.
17. Confirm level selector reaches Level 20.
18. Confirm Fire, Electric, Ice carriers appear.
19. Confirm phenotype timer expires correctly.
20. Confirm boss stage transitions.

---

# 30. Expansion Philosophy

New content should extend the established systems rather than creating parallel systems.

Good expansion examples:

- new enemy archetype added to canonical catalog
- new world with world data + art package + hazards + boss
- new optional challenge using existing movement/combat systems
- new collectible tracked by campaign progression
- new animation state added through stable character manifest

Poor expansion examples:

- another hard-coded level table inside a browser adapter
- another independent character renderer
- another production campaign count
- another fallback mascot
- another deploy script that can overwrite the canonical route

---

# 31. Potential Future Content

These are expansion concepts, not current production requirements.

## Optional Challenge Rooms

- phenotype mastery rooms
- time trials
- no-hit arenas
- seed collection races

## Secret Seed Vaults

Hidden rooms containing lore, concept art, collectibles, or unlocks.

## World Remix Mode

Harder variants after campaign completion.

## Boss Rush

All six bosses in sequence.

## Daily Challenge

Seeded deterministic level challenge or score challenge.

## Leaderboards

Possible metrics:

- fastest clear
- full campaign time
- fewest deaths
- maximum completion

## Cooperative / Multiplayer Expansion

Only consider after the single-player simulation is stable and deterministic.

---

# 32. Definition of Production-Ready

Seed Man should only be described as fully production-ready when:

- all 20 levels are playable start-to-finish
- all five worlds have complete production art
- all required Seed Man animations exist in all four forms
- all ten enemy archetypes have production animation
- all six bosses have complete encounters and art
- phenotype transformation is visually and mechanically complete
- the final boss works as designed
- no legacy runtime owns active production behavior
- the Game Hub and public route show the same current identity
- deterministic tests pass
- production build passes
- live route verification passes
- mobile and desktop controls work
- public performance is acceptable
- no broken links or missing assets remain

---

# 33. Immediate Next Production Sequence

Use this order unless a blocking defect requires otherwise:

1. Finish canonical v20 combat ownership.
2. Remove all active legacy encounter fallbacks.
3. Ensure Fire / Electric / Ice carrier generation across campaign.
4. Remove generic prototype powerups from v20 gameplay.
5. Validate public release manifest uploads all new runtime files.
6. Merge through PR.
7. Run deterministic production contracts.
8. Publish dedicated Seed Man route.
9. Verify live route with cache busting.
10. Complete Seed Man animation matrix.
11. Complete enemy animation sets.
12. Complete world art packages.
13. Complete boss encounters and art.
14. Improve movement/combat feel.
15. Hand-author / tune all 20 levels.
16. Add VFX and audio.
17. Polish HUD and menus.
18. Add progression / secrets / challenge systems.
19. Perform full campaign balancing.
20. Final cross-device production QA.

---

# 34. Change Log

## 2026-09-09

- canonical public identity standardized as **Seed Man: Grow. Fight. Restore.**
- campaign standardized to 20 levels / 5 worlds / 6 bosses
- Frozen Peaks canonicalized as `frozen-peaks`
- retired v15 public release ownership removed from production contracts
- dedicated Seed Man WordPress publisher established as route owner
- obsolete Seed Man Playwright browser suites retired
- Game Hub / navigation / homepage reconciliation automation expanded for v20 public identity
- identified legacy browser combat fallback problem
- started canonical v20 enemy-runtime replacement based on `level.enemyPool`
- started removal of generic prototype speed/shield/magnet/jump powerups from active campaign identity

---

# 35. Maintenance Rule

Whenever a meaningful design or architecture decision changes, update this document in the same development cycle.

At minimum, update:

- Current Known Technical Gaps
- Visual Production Backlog
- Gameplay Production Backlog
- Immediate Next Production Sequence
- Change Log

This document should remain the human-readable master direction for Seed Man while machine-readable contracts continue to live in campaign data, manifests, tests, and release configuration.
