# DTF technology adoption registry

This inventory tracks third-party technology candidates from discovery through live verification. It **does not** grant permission to copy proprietary code or deploy plugins.

## Lifecycle
- `discovered`: source and DTF use case recorded; no compatibility claim.
- `evaluated`: tested suitability and documented risks; not approved.
- `approved`: verified license evidence and security review.
- `integrated`: PR and test evidence for a change in the canonical owning repository.
- `production-verified`: exact deployment SHA and observable live evidence.

## Ownership
Resolve a public cultivation route against `data/tool-execution-registry.json` before editing. Never modify the `Thc` deployment mirror for a `Tools`-owned feature or move Grow Doc source outside `Thc-dataset`.

## Use
```sh
node scripts/validate-technology-adoption-registry.mjs
```

For imported code, update `docs/THIRD_PARTY_NOTICES.md` and `docs/CODE_HARVEST_ATTRIBUTION.md` as applicable. Check actual upstream license/version, dependency advisories, data privacy, accessibility and performance in review. Vendor/model repositories may have separate restrictions for assets and weights.

This registry deliberately starts with `discovered` entries: none has been approved or installed by the registry change.
