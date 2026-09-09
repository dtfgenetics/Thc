# Seed Man legacy script archive

This directory preserves retired one-off migration and reconciliation helpers for historical reference only.

Active Seed Man production automation belongs in the current game/release toolchain and must target the canonical production contract. Archived scripts must not be referenced by GitHub Actions, package scripts, deployment workflows, or release gates.

## legacy-15-level/

Contains helpers written for the retired 11-level compatibility runtime / 15-level expanded campaign era. These files are intentionally isolated so they cannot silently rewrite the current Seed Man production state.
