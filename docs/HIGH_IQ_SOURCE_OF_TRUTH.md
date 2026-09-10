# High IQ — Current State Reference

High IQ is the cannabis grower trivia game. This document describes the current implementation and data history; it does not lock the game to a repository, route, renderer, card format, question count, storage location, UI structure, or deployment system.

## Current implementation

- Current browser source/data lives under `games/high-iq/` and `site/public-route-patch/games/high-iq/`.
- Current public route is `https://dtfseeds.com/games/high-iq/`.
- Current dataset version is v2.4 with 200 approved/PASS questions, 50 registered sources, 10 topic domains, and Easy/Medium/Hard/Expert difficulty labels.
- Current browser features include mixed sessions, Daily 10, scoring, accuracy/streak tracking, explanations, verification sources, missed-question review, local history, sharing, accessibility support, and data diagnostics.
- Historical Drive production artifacts remain useful provenance for the earlier print/question sets.

These are current-state facts, not future restrictions. High IQ may be redesigned, moved, rewritten, merged, split, or migrated. The question model, UI, scoring, route, data format, renderer, repository, deployment path, and feature set may change when that improves the game.

## Data quality

When educational trivia content is retained or expanded, verify answer correctness, source alignment, duplicate handling, difficulty/category metadata, and the relationship between displayed answers and explanations. These checks protect content quality rather than freezing the current presentation.

## Migration guidance

If the game moves to a new frontend, repository, route, or data model, migrate the content and features that are still desired for the new design, update tests/validators to the new schema, and update deployment/navigation metadata to match. There is no requirement to preserve the current HTML/CSS/JavaScript shell or A/B/C/D presentation.

## Release evidence

Use tests, content validation, build/package checks, responsive/browser review, and exact live-route verification appropriate to the resulting implementation. Repository success and live production verification remain separate evidence levels.
