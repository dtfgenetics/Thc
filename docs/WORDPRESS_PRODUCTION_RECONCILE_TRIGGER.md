# WordPress production reconciliation trigger

This file exists only to provide a reviewable same-repository pull-request event for the guarded `ops/wordpress-production-reconcile` workflow path.

The production workflow checks out trusted `main`, not this branch, before validating or publishing canonical WordPress content. No credentials or production data belong in this file.

Trigger sequence: workflow-run deployment handoff check after split pipeline merge `1cafc7324ab1231b6c619cb99196422e7c945e29`.
