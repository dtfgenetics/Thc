# THC community growth integration V1

## Scope
- Canonical WordPress community page: `site/wordpress/pages/community.html` (existing design preserved)
- Learn page: `site/wordpress/pages/learn.html` adds a contextual community call to action
- Verification: `node --test scripts/test-thc-community-growth.mjs`

## Attribution contract
- Internal referral URL `/community/?source=learn` identifies Learn traffic *in the landing URL only*. It is **not** a claim of logged analytics or join conversion.
- Use separate Discord-issued invite links for website / creator / QR / events when a server admin configures them. Do not append UTM values to Discord invite URLs, and do not invent codes.
- The currently configured code is `ZzYTUWKKW` as recorded in canonical repository documentation. Confirm validity with a Discord server admin before deploying; other user-shared code `xJbUeHFPMt` requires reconciliation.
- To measure: count landing-page views by first-party source parameter and Discord invite uses from server invite statistics; calculate clicks or conversions only after suitable privacy-respecting instrumentation is deployed.

## Publishing and rollback
- Changes are source-only in a PR. Do not claim WordPress deployment or a working invitation without browser verification.
- Publishing goes through the repository's canonical WordPress-owned routes pipeline; legacy support-page V1 writer is blocked.
- Rollback by reverting the merged commit or restoring the previous canonical page source and republishing through protected workflow.

## QA checklist
- Run Node tests, inspect changed source, validate mobile 360px and desktop 1280px in staging, verify contrast/keyboard focus, inspect outgoing invite, check actual visitor HTML and event attribution, and verify existing canonical page links remain usable.
