# Priority Game Art Production — Wave 1

Status: ACTIVE
Updated: 2026-09-08

This document locks the first visual-development wave for DTFSeeds games. Artwork must support the canonical gameplay implementation rather than inventing a disconnected presentation. High In is intentionally excluded from this wave.

## Shared production rules

- Every game gets its own visual identity. Do not reskin one shared DTF template.
- Gameplay readability wins over decoration.
- Desktop and mobile compositions are designed together.
- Text-heavy browser UI remains DOM-first; artwork supports the play surface instead of burying it.
- Generated characters/objects must be normalized into reusable production assets before integration.
- Final assets require an explicit filename, dimensions/aspect ratio, transparent/opaque background rule, gameplay state, and intended code surface.
- Key art is not a gameplay asset. Production manifests must distinguish marketing/key art from runtime art.
- Strong motion is reserved for decisions, reveals, rewards, danger, and state transitions.
- No third-party game characters, logos, layouts, or protected franchise artwork may be copied.

---

# 1. Who Took It?

Canonical owner: `dtfgenetics/Thc-guess-who`
Canonical source: `03_digital-game`
Priority: P0

## Existing gameplay that art must support

- 25 suspects on a 5×5 board
- 5 missing items
- preset binary questions
- suspect elimination
- item elimination
- accusation and reveal
- single-player, shared mystery/host, and local duel modes

## Visual fantasy

A playful late-night grow-room mystery presented like an original illustrated case file. The player is investigating which distinctive grower/character took a missing cultivation-related object. The visual language combines warm grow-room practical lighting, evidence-board organization, collectible portrait cards, and bold readable deduction controls.

## Style pillars

1. Distinctive original suspects readable at thumbnail size.
2. Portraits feel like a coherent cast but have strongly different silhouettes, hair/headwear, expressions, accessories, and clothing.
3. Mystery atmosphere without becoming grim or photorealistic crime imagery.
4. Cannabis/grow references live in environment and character details rather than covering every surface with leaf icons.
5. Eliminated suspects remain recognizable under the elimination treatment.

## Runtime asset manifest — first pass

### Suspects
- 25 final suspect portraits, 1:1, master 1024×1024, crop-safe for square cards.
- Each portrait: neutral gameplay expression plus optional reveal/win expression later.
- Consistent camera: chest-up / portrait framing, similar eye-line and scale.
- Character traits must map cleanly to the existing binary question data before final approval.

### Missing items
- 5 final item icons, transparent background, master 1024×1024.
- Readable at 64 px.
- Each item needs neutral, selected, eliminated, and reveal presentation states; states can be CSS treatments when possible rather than duplicate raster art.

### Environment/UI art
- Main mystery-board background, 16:9 master with mobile-safe center crop.
- Evidence-board texture/panel treatment.
- Suspect-card frame family: normal / hover / selected / eliminated / accused / culprit reveal.
- Item-card frame family.
- YES / NO response treatment.
- Question-card panel.
- Accusation modal art treatment.
- Victory reveal burst and failure/retry treatment.
- Title/key art separate from runtime board.

## First concept sheet

One 16:9 concept board showing: title treatment, six representative suspect portraits, two item icons, normal/eliminated suspect card, question panel, YES/NO controls, and culprit reveal state. This is the approval gate before producing all 25 portraits.

## Anti-patterns

- Generic Guess Who board imitation.
- 25 near-identical AI faces.
- Tiny decorative text baked into portraits.
- Excessive smoke obscuring faces.
- Real celebrity likenesses.

---

# 2. High Life: From Bagseed to Legacy

Canonical owner: `dtfgenetics/Thc`
Canonical source: `games/high-life`
Priority: P0

## Existing gameplay that art must support

- 18-turn career
- three eras: Underground → Medical → Legal
- career decisions plus seeded era events
- resources: reputation, cash, knowledge, assets, compliance, brand, operations, genetics
- preparation gates at era transitions
- Legacy scoring

## Visual fantasy

An illustrated cannabis-industry life journey where the world visibly evolves across three eras. The presentation should feel like traveling through a living timeline rather than moving around a circular property board.

## Era art direction

### Underground
Warm basement/garage grow aesthetic, improvised equipment, analog notes, hand-painted signs, clandestine nighttime atmosphere, gritty but inviting.

### Medical
Early dispensary and caregiver era, cleaner grow rooms, clinic/collective cues, paperwork and patient/community iconography, transitional optimism.

### Legal
Modern cultivation/brand world, polished retail and greenhouse/indoor production cues, compliance systems, packaging/brand decisions, brighter metropolitan/industrial atmosphere.

The three eras must remain visually connected as one journey while being identifiable immediately.

## Runtime asset manifest — first pass

- Three panoramic era environments, each designed as a branch/path play surface.
- Era transition illustrations: Underground→Medical and Medical→Legal.
- Eight resource icons: reputation, cash, knowledge, assets, compliance, brand, operations, genetics.
- Event-card frame system with era variants.
- Decision/action-card frame system.
- Player journey marker/token family.
- Preparation-gate visual.
- Legacy score crest/badge.
- Positive event, negative event, opportunity, warning, and milestone VFX/icon language.
- Results/legacy scene.
- Title/key art.

## First concept sheet

One wide triptych showing the same player's journey through Underground, Medical, and Legal environments, plus the eight resource icons and one representative event card. This locks the era language before final board geometry is illustrated.

## Anti-patterns

- Monopoly-like square perimeter.
- Life-game spinner imitation.
- One generic green board for all eras.
- Photoreal collage that cannot become coherent game UI.

---

# 3. High IQ — Test Higher Cognition

Canonical owner: `dtfgenetics/Thc`
Canonical source: `games/high-iq` + active public runtime
Priority: P0

## Existing gameplay that art must support

High IQ already has a mature browser gameplay surface. Art work is a presentation upgrade, not a scoring/content rewrite. The active question must remain dominant, with large answer targets, compact sticky score/streak/accuracy information, clear selected/correct/incorrect feedback, and mobile-safe controls.

## Visual fantasy

A premium cannabis plant-science quiz show: botanical laboratory meets energetic game-show stage. It should communicate knowledge and competition without looking like an LMS dashboard.

## Visual pillars

- Deep botanical/science atmosphere.
- Bright reward energy for streaks and correct answers.
- Strong A/B/C/D readability.
- Scientific motifs: trichome macro forms, leaf venation, microscope/light-spectrum shapes, root/network patterns used abstractly.
- Minimal persistent chrome during active questions.

## Runtime asset manifest — first pass

- Responsive quiz-stage background: desktop 16:9 + mobile-safe treatment.
- 10 topic-domain emblem/icon slots driven by the canonical topic list.
- Difficulty badge family: Easy / Medium / Hard / Expert.
- Streak flame/energy emblem.
- Accuracy/score icon treatment.
- Correct-answer burst.
- Incorrect-answer pulse/shock treatment.
- Daily 10 badge.
- Results trophy/brain-botanical emblem.
- Source/explanation panel visual treatment.
- Mode-selection artwork kept secondary to gameplay.
- Key art/title treatment.

## First concept sheet

One desktop active-question mockup and one 390×844 mobile active-question mockup using the existing information hierarchy. Include correct-answer and streak states. No changes to question/scoring logic.

## Anti-patterns

- Generic school/education dashboard.
- Decorative art competing with question text.
- Tiny answers.
- Constant animated backgrounds.
- Cannabis leaf wallpaper.

---

# 4. Bud or Bluff

Canonical owner: `dtfgenetics/Thc`
Canonical source: `games/bud-or-bluff`
Priority: P0

## Existing gameplay/content that art must support

The core judgment is binary: BUD = documented real cultivar/strain name; BLUFF = invented and checked as not known real at approval time. The research set already contains a substantial verified BUD pool. Artwork must not imply unsupported lineage, potency, medical effect, or cultivar appearance claims.

## Visual fantasy

A fast social bluffing game presented like a late-night strain-name challenge: bold typography, tactile cards, confident reveal moments, and enough botanical texture to feel premium without pretending a generic bud image represents a specific cultivar.

## Runtime asset manifest — first pass

- Master question/name card front.
- BUD choice button/card.
- BLUFF choice button/card.
- Neutral card back.
- BUD reveal stamp/badge.
- BLUFF reveal stamp/badge.
- Correct reveal celebration.
- Wrong reveal fake-out/shake treatment.
- Round counter and score treatment.
- Streak/reward emblem.
- Multiplayer/table background treatment.
- Results screen art.
- Key art/title lockup.

## Important accuracy rule

Do not generate cultivar-specific flower portraits and label them as factual depictions unless a verified image source/license and cultivar identity exist. Prefer abstract botanical macro textures and fictional decorative buds for the general visual system.

## First concept sheet

A card-table scene showing one neutral strain-name card, BUD and BLUFF choices, both reveal treatments, score/streak UI, and end-of-round feedback.

## Anti-patterns

- Unverified strain photos presented as evidence.
- Joke typography that harms readability.
- BUD and BLUFF states distinguished only by color.
- Trademarked/celebrity imagery used as decoration.

---

# 5. Terpocalypse — retro FPS parody project

Canonical owner: `dtfgenetics/Terpocalapse`
Canonical production source: `prototypes/web-fps` until V2 reaches parity
Priority: P0

## Existing gameplay that art must support

Current V1 includes Trim Shears, pH Blaster, Neem Cannon; Spider Mite Swarm, Powdery Mildew Ghoul, and Nute Burn Imp enemies; health, armor, ammo, key and overdrive pickups; maze/room traversal and combat.

## Visual fantasy

An original exaggerated retro-FPS grow-room apocalypse. The influence is the readability and speed of classic 1990s shooters, not copied DOOM art. Environments turn cultivation problems into monsters and combat spaces: infested grow rooms, contaminated corridors, nutrient-lab hazards and corrupted cultivation equipment.

## Visual pillars

1. Chunky retro-FPS silhouettes with modern high-resolution masters.
2. Enemy type readable instantly at distance.
3. Grow-room materials: mylar, trays, ducting, lights, fans, reservoirs, concrete, cables.
4. Aggressive but playful plant-science parody.
5. Low-chrome HUD that leaves the center and lower-middle combat view clear.

## Runtime asset manifest — first pass

### Weapons
- Trim Shears first-person idle/attack frames.
- pH Blaster first-person idle/fire/reload/impact family.
- Neem Cannon first-person idle/fire/reload/impact family.

### Enemies
- Spider Mite Swarm: idle/move/attack/hit/death visual states.
- Powdery Mildew Ghoul: idle/move/attack/hit/death.
- Nute Burn Imp: idle/move/ranged attack/hit/death + projectile.

### Pickups
- pH Blaster pickup.
- Neem Cannon pickup.
- Cure Jar Health.
- Kief Armor.
- Light Ammo Box.
- Heavy Ammo Box.
- Green Keycard.
- Grow Light Overdrive.

### Environment
- Wall/floor/ceiling material kit.
- Grow-room door and locked-door treatment.
- Infestation decals.
- Mildew contamination decals.
- Nutrient-burn hazard props.
- Grow-light fixtures.
- Fans/ducting/trays/reservoir props.
- Exit/goal treatment.

### HUD/VFX
- Health, armor, ammo, weapon slot and key indicators.
- Crosshair family.
- Damage direction flash.
- Pickup toast.
- Enemy hit feedback.
- Muzzle flashes / projectiles / impacts.
- Overdrive state treatment.
- Pause/settings overlay designed to stop fighting pointer/camera input.
- Title/key art.

## First concept sheet

A first-person combat scene in an infested grow room showing one weapon, all three enemy silhouettes, representative pickups, environmental material language and the low-chrome HUD. This becomes the visual benchmark before animation-frame production.

## Anti-patterns

- Copying DOOM demons, weapons, HUD face, logo, textures, levels, or sprites.
- Large permanent UI panels covering combat.
- Enemies that differ only by tint.
- Photoreal enemies pasted over stylized environments.

---

# Wave 1 approval and production gates

For each game:

1. Canonical mechanics checked.
2. Concept sheet generated.
3. Visual direction reviewed against gameplay readability.
4. Asset IDs and filenames added to a manifest.
5. Production masters generated.
6. Assets normalized/cropped/exported for runtime.
7. Runtime integration performed without replacing canonical mechanics.
8. Desktop browser playtest.
9. Mobile browser playtest.
10. Screenshot comparison against approved visual target.
11. Accessibility/reduced-motion/contrast review where applicable.
12. Package through the canonical DTFSeeds release path only after the game-specific gate passes.

## Production order

1. Who Took It? — concept sheet + suspect/item production language.
2. High IQ — active gameplay visual upgrade.
3. Terpocalypse — FPS benchmark scene + enemy/weapon language.
4. High Life — three-era triptych and resource system.
5. Bud or Bluff — card/reveal system.

The order reflects immediate visual leverage and how clearly current mechanics define the art requirements; it is not a statement that later games are less important.
