# WordPress production reconciliation trigger

This file exists only to provide a reviewable same-repository pull-request event for the guarded `ops/wordpress-production-reconcile` workflow path.

The production workflow checks out trusted `main`, not this branch, before validating or publishing canonical WordPress content. No credentials or production data belong in this file.

Trigger sequence: three-stage production chain check after `main` commit `0ef15ebd36e5bcb1ccbbb9e1d2cbc2de6720cf71`.
