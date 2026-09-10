# DTF / THC Portfolio Release Criteria

This document defines quality evidence for releases across games, websites, apps, education, books, diagnostic tools, automation, and print products. It does not lock repository ownership, folder structure, route structure, renderer, backend, workflow, release-state vocabulary, or implementation architecture.

## General release evidence

A release should have enough evidence to identify what was shipped and verify that it works in its intended environment. Applicable checks may include:

- source revision or release identifier recorded;
- required source/output files present;
- machine-readable files validate where relevant;
- code builds or otherwise runs successfully using the current architecture;
- tests appropriate to changed behavior pass;
- public routes and asset paths are verified when relevant;
- spelling/grammar/content QA is performed where relevant;
- third-party assets/code have compatible licensing or permission;
- credentials, private user data, and private multiplayer state are not exposed;
- a practical recovery/rollback path exists for production-changing work;
- exact visitor-facing production behavior is checked after deployment before calling the release live.

Project registries, Drive folders, GitHub repositories, route maps, and release ledgers may be used when helpful, but they are not mandatory ownership locks. Update or replace them when the architecture changes.

## Web/app evidence

For a web/app release, verify the current production route or destination, build/package output where applicable, required assets, critical interactions, browser/runtime errors, and responsive behavior on relevant phone/tablet/desktop sizes.

The hosting provider, branch, build command, output folder, deployment mechanism, and route may change with the implementation.

## Game evidence

For a game release, verify the intended current gameplay rather than a historical fixed rules master. Useful evidence includes:

- a complete start-to-finish core loop;
- coherent state/rules/content data;
- win/end/failure states when applicable;
- input and feedback appropriate to the game;
- phone/tablet/desktop presentation where supported;
- asset loading without broken-image placeholders;
- multiplayer authority/synchronization/privacy checks when multiplayer exists;
- playtesting appropriate to the scale of the change.

Rules, board/deck/component counts, art direction, renderer, mechanics, player limits, routes, engines, and data models may be deliberately redesigned. Update tests and release checks to represent the new intended game.

## Education evidence

For educational material, keep factual claims traceable to suitable sources, review wording for accuracy/scope, verify relevant image/source rights, and validate IDs/cross-links/data where they are part of the current system. Presentation and file structure remain free to change.

## Diagnostic evidence

For diagnostic systems, separate observation from unsupported certainty, preserve useful provenance/review metadata, document dataset/model versions when needed, and validate code/data appropriate to the current architecture. The model stack, repository, schema, and UI may change.

## Print evidence

For print deliverables, verify the current manuscript/artwork, trim/bleed/resolution requirements, proof output, and editable/source retention needed for future revision. File names, folder structure, and production workflow are not locked.

## Automation/content-engine evidence

For automation, validate current inputs/outputs, manifests or schemas when useful, credential handling, and connector behavior. Tool choice and workflow architecture may be changed or replaced.

## Working principle

Release checks are evidence systems. They should fail when the resulting product is broken, incomplete, insecure, or inaccurately represented—not because a developer changed an old implementation detail on purpose.
