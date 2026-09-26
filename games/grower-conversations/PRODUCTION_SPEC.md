# Grow Room Confessions — Production Specification

## Product identity

**Title:** Grow Room Confessions  
**Tagline:** A conversation game for cultivators, breeders, and growers who have stories.  
**Legacy route:** `/games/grower-conversations/` remains valid for link stability.  
**Internal project ID:** `grower-conversations`.

This is a social conversation game, not High IQ trivia and not a scored knowledge test. There are no right-answer cards. The product should create stories, debate, reflection, grow-room psychology, breeder talk, and memorable table moments.

## Release target

The physical first edition target is **200 prompt cards**, plus non-prompt support cards/tokens as required by the final production layout. The current 96-card browser deck is a **digital preview**, not the complete physical first edition.

Internal stable IDs are required for synchronization, QA, analytics, print manifests, and digital state. **IDs, serials, page numbers, and card numbers must never be visible on card faces.**

## Eight prompt lanes

The 200-card edition uses eight recognizable conversation lanes:

1. **Confessions** — mistakes, disasters, shortcuts, lucky saves, embarrassing lessons, and stories growers usually only tell other growers.
2. **Hot Takes** — opinions worth defending; no factual-answer framing.
3. **Would You Rather** — forced tradeoffs that reveal priorities and cultivation philosophy.
4. **Grow Room Debates** — competing approaches, methods, and decision styles.
5. **Grower Psychology** — habits, ego, patience, risk, attachment, bias, overreaction, and decision-making.
6. **Call Your Shot** — predictions, choices under uncertainty, and “what would you do next?” scenarios without a single scored answer.
7. **Strain Talk** — phenotypes, breeders, selection, aroma, structure, line memory, favorites, disappointments, and preservation.
8. **Wild Cards** — table votes, story-required prompts, callouts, twists, and group interaction.

The machine IDs may remain stable and terse, but public labels must use the names above.

## Intensity system

Every prompt carries one of three intensity levels:

- **Chill** — easy opener; low pressure; works with mixed-experience groups.
- **Real** — personal experience, stronger opinions, or meaningful disagreement.
- **Deep** — vulnerable stories, difficult tradeoffs, breeder philosophy, psychology, or technical reasoning.

Intensity is an invitation, not a skill rating.

## Signature interaction system

Three optional table tokens create interaction without turning the game into trivia:

- **Go Deeper** — ask the current player to expand the answer with the story, reasoning, or lesson behind it.
- **Call It Out** — challenge a claim, inconsistency, or hot take and invite the table to discuss it.
- **Respect** — acknowledge an answer, lesson, or story that deserves recognition and ends the challenge cleanly.

Tokens are optional in relaxed play and active in competitive/social modes.

## Keeper system

A **Keeper** is awarded to a response the table wants to remember. A Keeper can represent the funniest confession, strongest story, sharpest lesson, most convincing take, or best piece of grower wisdom.

Keeper scoring is intentionally subjective and social. It must never imply that one cultivation method is scientifically “correct” merely because the table rewarded it.

Recommended default: first to 5 Keepers wins a short session; highest total after a fixed number of rounds wins a longer session.

## Play modes

### Smoke Circle
No winner required. Draw, answer, react, pass.

### Grower’s Court
Hot Takes and Debates are emphasized. The table may use Call It Out and Respect tokens. Keepers reward the most convincing or memorable defense.

### Deep Roots
Reflective and psychology-heavy cards. Go Deeper is the primary interaction token. Keeper scoring is optional.

### Hotbox Debate
Fast rotation. One prompt, two or more positions, short defenses, then the table moves on.

### Chaos Grow
Wild Cards are mixed heavily into the deck. Table-vote and interaction cards can alter who answers, who challenges, or whether the group must tell a related story.

### Solo Grow Journal
Use prompts as private reflection or grow-log entries. Tokens and Keepers are disabled.

## Host card / table rules

The host establishes three rules before play:

1. **Pass means pass.** Any player may skip a card without explanation.
2. **Debate the take, not the person.** No attacking players.
3. **Stories stay at the table unless the storyteller says otherwise.**

Optional fourth rule: factual cultivation claims may be discussed, but the deck itself does not certify them as correct.

## Content boundaries

Prompts may discuss legal cultivation experiences, plant science, grow-room decisions, mistakes, genetics, post-harvest work, and community culture. They should not encourage unsafe electrical work, pesticide-label violations, illegal diversion, evasion of law enforcement, theft, violence, or dangerous chemical handling.

Prompts should sound like real growers talking, not generic therapy cards or classroom quiz questions.

## Browser product requirements

The browser edition must:

- use the Grow Room Confessions title and tagline;
- keep the legacy route working;
- never render internal card IDs;
- support category and intensity filtering;
- preserve no-repeat draws within the active pool;
- save session progress locally;
- provide optional game-mode presets;
- support Keeper counts and the three signature tokens;
- work keyboard-first and touch-first;
- support reduced motion and forced-colors accessibility;
- present the deck like a physical premium card game rather than an educational dashboard.

## Physical production requirements

Final print package needs:

- poker-size or equivalent production card dimensions selected before imposition;
- front safe zone, bleed, trim, and corner-radius specification;
- shared card back;
- eight category treatments that still look like one deck;
- intensity indicator that is immediately legible but not dominant;
- Host/rules card;
- mode reference card(s);
- Keeper cards or tokens;
- Call It Out / Go Deeper / Respect tokens;
- box front/back/spine copy;
- print manifest;
- proof sheet;
- duplicate-text audit;
- profanity/readability/editorial pass;
- final human playtest sign-off.

## Visual direction

Premium grow-room lounge / workbench atmosphere:
- forest green, near-black, warm cream, restrained metallic gold;
- tactile card stock, practical warm light, subtle cultivation objects;
- confident adult social-game tone;
- no dashboard look;
- no cartoon overload;
- DTF Genetics branding should be present but secondary to the game title;
- internal IDs never appear on card faces.

## Completion gates

The game is not “finished” until all of these are true:

- [x] Core social-game identity is defined.
- [x] Title and tagline are defined.
- [x] Eight prompt lanes are defined.
- [x] Six play modes are defined.
- [x] Signature token system is defined.
- [x] Keeper scoring concept is defined.
- [x] Internal-ID / no-visible-ID rule is defined.
- [ ] Canonical 200-card prompt bank is complete and QA-clean.
- [ ] Browser schema supports the production lanes + intensity metadata.
- [ ] Browser UI supports mode presets, Keepers, and tokens.
- [ ] Browser visual presentation matches the premium tabletop direction.
- [ ] Physical card fronts/backs are templated.
- [ ] Box and support components are templated.
- [ ] Print-ready imposition is generated.
- [ ] Safety/editorial review is complete.
- [ ] Playtest findings are logged and resolved.
- [ ] Release build passes deterministic validation.
