# Deployment Runbook

This runbook describes release evidence, not a fixed game architecture, build tool, hosting path, route owner, or deployment provider.

## Build and validation

Run the tests, build, static analysis, browser checks, asset checks, and packaging steps appropriate to the implementation being deployed. Existing game-specific npm commands are useful only while they match the current architecture.

## Artifact

Identify the exact built/package artifact or source revision being deployed. The artifact directory may change when a game is restructured.

## Destination

Record the actual deployment target and public route for the current implementation. Hostinger, WordPress, another host, or a different route structure may be used when the project changes.

## Live verification

After deployment, verify the actual visitor-facing route. At minimum confirm:

- the expected game/application loads;
- required assets resolve without broken-image placeholders;
- core controls and a meaningful gameplay transition work;
- responsive phone/tablet/desktop composition is usable when relevant;
- browser/network/runtime errors are reviewed;
- multiplayer is checked with independent sessions when relevant.

A repository commit, build, merge, or upload is not by itself proof that production changed. Record the exact live URL, revision, verification time, and observed result.
