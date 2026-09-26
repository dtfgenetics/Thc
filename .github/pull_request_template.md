## Summary

Describe the change, why it is needed, and which production surface(s) it affects.

## Production standard

Authoritative guidance: `docs/PRODUCTION_STANDARDS.md`.

- [ ] I reviewed the production standard for this change.
- [ ] The canonical source/route owner is known.
- [ ] No placeholder, fake, dead, or unfinished UI is being exposed.
- [ ] Shared components/design-system patterns were reused where appropriate.
- [ ] Related content/tools are cross-linked where appropriate.
- [ ] Terminology and units match existing product conventions.

## Responsive and visual QA

- [ ] Narrow/mobile layout checked.
- [ ] Medium/tablet layout checked.
- [ ] Wide/desktop layout checked.
- [ ] No unintended horizontal overflow or clipped controls.
- [ ] Touch targets and interactive controls remain usable.
- [ ] Images use stable dimensions, correct crops, and valid paths.
- [ ] No rejected/low-quality placeholder visual style was introduced.

## Navigation and UX

- [ ] Header/global navigation behavior remains consistent.
- [ ] Deep pages provide location/return context where applicable.
- [ ] Primary action and information hierarchy are clear.
- [ ] Dense information uses progressive disclosure where appropriate.
- [ ] Empty/error/loading states are intentional and usable.

## Accessibility

- [ ] Semantic headings and landmarks are appropriate.
- [ ] Keyboard operation and visible focus are preserved.
- [ ] Forms have labels and clear errors.
- [ ] Meaningful images have alt text.
- [ ] Contrast/readability are acceptable.
- [ ] Nonessential motion considers reduced-motion behavior.

## Content / education / tools

Complete only the applicable items.

- [ ] Educational content explains both what to do and why.
- [ ] Important claims distinguish evidence strength appropriately.
- [ ] Course work follows the standard lesson structure.
- [ ] Tool work follows Learn -> Interact -> Result -> Interpretation -> Why -> Next action.
- [ ] Certification/assessment behavior preserves independent answering and post-submission grading.
- [ ] Diagnostic work can still begin from a usable photo without mandatory extra fields.

## Deterministic verification

Do not add Playwright to routine validation.

| Command/check | Status | Evidence |
| --- | --- | --- |
| Relevant unit/component tests | NOT TESTED | |
| Relevant content/data validator | NOT TESTED | |
| Route/link/asset validation | NOT TESTED | |
| Responsive-structure validation | NOT TESTED | |
| Build/typecheck/lint as applicable | NOT TESTED | |
| `npm run verify:production-standards` | NOT TESTED | |
| Relevant product-specific preflight | NOT TESTED | |

## Screenshots / manual review

- Mobile:
- Tablet:
- Desktop:
- Live URL and verification date:
- Live status: PASS / FAIL / NOT TESTED

Do not infer live success from local validation.

## Remaining issues

List every known failure, skipped check, manual follow-up, deployment dependency, or risk. Write `None` only when all applicable checks have evidence.

-

## Rollback

- Risk:
- Rollback plan:
