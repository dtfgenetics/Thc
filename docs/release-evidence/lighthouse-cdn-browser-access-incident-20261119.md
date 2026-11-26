# Lighthouse CDN browser-access incident — release-blocking

## Evidence (2026-11-19 inspection of 2026-11-14 CI)
- Review PR: https://github.com/dtfgenetics/Thc/pull/2566
- Failed workflow: https://github.com/dtfgenetics/Thc/actions/runs/43565967794
- Failed job: `Lighthouse every discovered page` (job 132359790911)
- Lighthouse Chrome document request: HTTP **403**, response server `hcdn`; Lighthouse reported `ERRORED_DOCUMENT_REQUEST`.
- Same runner's two Node HTTP probes to `https://dtfseeds.com/` (QA user agent and Chrome user-agent string) both received **200**. The Chrome DevTools navigation diagnostic reported **403**. Thus changing the User-Agent string alone is not a proven fix. Browser-specific access behavior requires investigation.
- The independent deterministic route-health job passed, but it does not substitute for a successful real-browser audit.

## Hostinger/CDN remediation procedure
1. Capture the UTC timestamp, public route, failing CI run ID, sanitized response headers and Chrome navigation diagnostic artifact. Do not log cookies, authorization headers, secrets or full client IPs in public CI output.
2. In the Hostinger CDN/WAF/bot-protection dashboard and hosting support logs, correlate the failing request by time and path. Identify the exact rule and whether the 403 is produced by a challenge, rate limit, bot rule or another layer. The `hcdn` server header alone does **not** prove which rule blocked it.
3. Adjust only the rule responsible for blocking authorized monitoring, preferably using a scoped, authenticated or narrowly constrained allow policy supported by the provider. Keep protections for the public site; do **not** globally disable the firewall or relax security for every visitor.
4. Re-run the existing Chrome CDP navigation diagnostic and Lighthouse workflow from GitHub Actions. Require an actual successful HTML document navigation, valid Lighthouse report without runtime errors, and complete applicable release checks. Do not fabricate scores, change failing checks to nonblocking, or treat Node HTTP 200 as browser success.
5. After browser access is repaired, regenerate the canonical Tools mirror against **latest validated Tools main** (including #265, #266 and #269), preserve the Atlas content guard, and verify exact source revision and live site parity before deployment approval.

## Acceptance
- No 403 or challenge on authorized browser audit; valid Lighthouse measurements exist for the selected routes.
- The existing `scripts/validate-lighthouse-regressions.mjs` rejects missing, irrelevant or errored reports; preserve this fail-closed behavior.
- Source mirror parity and Atlas preservation checks pass at the same reviewed SHA.
- Seed purchases remain disabled; public strain information and general education remain available; only certifications contain learner assessments.

**Status: unresolved.** This document is a remediation procedure, not evidence of a CDN configuration change or a successful production release.
