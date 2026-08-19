# WordPress production reconciliation trigger

This file exists only to provide a reviewable same-repository pull-request event for the guarded `ops/wordpress-production-reconcile` workflow path.

The production workflow checks out trusted `main`, not this branch, before validating or publishing canonical WordPress content. No credentials or production data belong in this file.

Trigger sequence: minimal workflow registration check after `main` commit `30ffc9f6789eac93eaa24b749b7bb553da870c99`.
