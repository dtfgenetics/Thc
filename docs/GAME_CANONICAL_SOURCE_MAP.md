# DTFSeeds Game Canonical Source Map

Updated: 2026-09-05

This document is the human-readable companion to `data/game-source-map.json`.

## Rule

Never begin a game repair from the deployed HTML, a copied integration bundle, or `dtfgenetics/dtf-thc-hub` merely because that copy is easy to find. Resolve the canonical owner below first, repair and validate there, then integrate through `dtfgenetics/Thc` and the DTFSeeds release pipeline.

## Public game catalog

| Public game | DTFSeeds route | Canonical repository | Canonical source | Integration / packaged route |
| --- | --- | --- | --- | --- |
| High IQ | `/games/high-iq/` | `dtfgenetics/Thc` | `games/high-iq` + `site/public-route-patch/games/high-iq` | same repo/runtime |
| High Life | `/games/high-life/` | `dtfgenetics/Thc` | `games/high-life` | `site/public-route-patch/games/high-life` |
| Seed Man: Sprout Run | `/games/seed-man-platformer/` | `dtfgenetics/Thc` | `games/seed-man-platformer` | `site/public-route-patch/games/seed-man-platformer` |
| Grower Conversations | `/games/grower-conversations/` | `dtfgenetics/Thc` | `games/grower-conversations` | `site/public-route-patch/games/grower-conversations` |
| High Land | `/games/high-land/` | `dtfgenetics/Thc` | `apps/high-land-web` | built by the DTFSeeds public suite |
| Weedopolis | `/games/weedopolis/` | `dtfgenetics/Weedopolis-strain-Edition` | `src`, `digital`, `data` | external canonical build packaged by `dtfgenetics/Thc` |
| Strain Showdown | `/games/strain-showdown/` | `dtfgenetics/Thc` | `games/strain-showdown` | `site/public-route-patch/games/strain-showdown` |
| THC Weekly Crossword | `/games/crossword/` | `dtfgenetics/Thc-crossword-` | `src`, `content`, `public/puzzles` | external canonical build packaged by `dtfgenetics/Thc` |
| Who Took It? | `/games/who-took-it/` | `dtfgenetics/Thc-guess-who` | `03_digital-game` | external canonical build packaged by `dtfgenetics/Thc` |
| Burn Buds | `/games/protect-the-plants/` | `dtfgenetics/Thc` | `games/protect-the-plants` | `site/public-route-patch/games/protect-the-plants` |
| Bud or Bluff | `/games/bud-or-bluff/` | `dtfgenetics/Thc` | `games/bud-or-bluff` | `site/public-route-patch/games/bud-or-bluff` |
| THC U Know | `/games/thc-u-know/` | `dtfgenetics/thc-u-know-card-game-` | `apps/web`, `apps/server`, `packages/shared` | full-stack external runtime integrated by `dtfgenetics/Thc` |
| Kush Kings Chess | `/games/kush-kings-chess/` | `dtfgenetics/Thc-chess-git` | `client` + `server` | frontend `chess.dtfseeds.com`, API `chess-api.dtfseeds.com`, public-route integration after QA |
| Terpocalypse | `/games/terpocalypse/` | `dtfgenetics/Terpocalapse` | `prototypes/web-fps` | verified snapshot at `site/public-route-patch/games/terpocalypse` |
| PhenoQuest | `/games/phenoquest/` | `dtfgenetics/Catching-phenos` | `src`, `data`, `public/games/phenoquest` | external canonical build packaged by `dtfgenetics/Thc` |
| Strain Match | `/games/strain-match/` | `dtfgenetics/Thc` | `games/strain-match` | `site/public-route-patch/games/strain-match` |
| Grow Room Bingo / Bongwater Bingo | `/games/grow-room-bingo/` | `dtfgenetics/Thc` | `games/grow-room-bingo` | `site/public-route-patch/games/grow-room-bingo` |
| Lost in the Terps | `/games/lost-in-the-terps/` | `dtfgenetics/Thc` | `games/lost-in-the-terps` | `site/public-route-patch/games/lost-in-the-terps` |
| Mystery Strain | `/games/mystery-strain/` | `dtfgenetics/Thc` | `games/mystery-strain` | `site/public-route-patch/games/mystery-strain` |
| Spin the Strain | `/games/spin-the-strain/` | `dtfgenetics/Thc` | `games/spin-the-strain` | `site/public-route-patch/games/spin-the-strain` |
| Grow Room Defense | `/games/grow-room-defense/` | `dtfgenetics/Thc` | `games/grow-room-defense` | `site/public-route-patch/games/grow-room-defense` |
| Harvest Hustle | `/games/harvest-hustle/` | `dtfgenetics/Thc` | `games/harvest-hustle` | `site/public-route-patch/games/harvest-hustle` |
| Trichome Trials | `/games/trichome-trials/` | `dtfgenetics/Thc` | `games/trichome-trials` | `site/public-route-patch/games/trichome-trials` |
| Pheno Draft | `/games/pheno-draft/` | `dtfgenetics/Thc` | `games/pheno-draft` | `site/public-route-patch/games/pheno-draft` |
| High Lines | `/games/high-lines/` | `dtfgenetics/Thc` | `games/high-lines` | `site/public-route-patch/games/high-lines` |

## Development projects shown on the Game Hub

| Project | Canonical repository | Current gate |
| --- | --- | --- |
| Ganjumanji | `dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple` | canonical release candidate `0.3.0`; standalone tests, build, route validation, desktop/mobile Playwright, screenshot evidence, and production artifact are green at `e82580d`; DTFSeeds packaging and exact live-route verification remain required |
| THC RPG | `dtfgenetics/Thc-rpg` | playable browser vertical slice with environment/equipment systems, phenotype journal, Keeper selection and clonal cutting loop; central packaging and production-route verification are still open |

## Known ownership defects being corrected

### Burn Buds / Protect the Plants / Cannabis Fleet Battle

The public product is **Burn Buds** and the stable route/machine compatibility ID remains `protect-the-plants`. The canonical implementation is `games/protect-the-plants`.

`data/project-registry.json` still contains the older `cannabis-fleet-battle` project identity for the earlier engine scaffold. `data/game-source-map.json` explicitly overrides the production source path so agents do not repair the retired scaffold. The registry should be migrated carefully in a follow-up without breaking active room, route, persistence, or deployment compatibility.

### Terpocalypse V1 vs V2

The stable playable source currently packaged by DTFSeeds is `dtfgenetics/Terpocalapse/prototypes/web-fps`.

`prototypes/web-fps-v2` is a next-generation experimental implementation and its own content-status file says V1 remains authoritative until V2 reaches feature parity. Any documentation that directs production repairs to V2 before parity is stale and must be corrected.

### PhenoQuest status

`dtfgenetics/Catching-phenos` now contains a playable vertical slice and self-contained website build. Older source-of-truth wording that describes the repository as design-only preproduction is stale; it must be updated without implying the full RPG is finished.

### Ganjumanji status

`dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple` is no longer a design-only placeholder. Canonical `main` now contains a complete three-region release-candidate campaign with deterministic model/storage/records, solvability validation, desktop/mobile browser acceptance, and a production build artifact. Central integration must pin the exact passing revision and must not promote the game to the public playable count until DTFSeeds packaging plus live-route verification pass.

### THC RPG status

`dtfgenetics/Thc-rpg` is no longer a concept-only placeholder. It contains a tested executable browser vertical slice. The current progression reaches persistent phenotype journaling, Keeper selection, and deterministic replanting from preserved Keeper cutting stock. It remains outside the public playable catalog until central packaging and production-route verification are added.

## Release path

For every game:

1. resolve this canonical owner;
2. read that game's source-of-truth document and current `main`;
3. branch and repair canonical source;
4. run canonical tests/build/validators;
5. merge the canonical repair;
6. sync or package the exact passing source through `dtfgenetics/Thc`;
7. run the DTFSeeds public-suite and release-integrity gates;
8. deploy through the production workflow;
9. verify the exact live route and essential assets;
10. browser-playtest the critical loop and mobile behavior separately.

A source test is not a browser playtest, and a successful deploy is not proof that the route is serving the intended game.
