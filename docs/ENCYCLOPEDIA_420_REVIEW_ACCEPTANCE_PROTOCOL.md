# THC 420+ — independent quality review and acceptance protocol

Updated: 2026-10-14  
Scope: protected THC-ENC-001…420, with a separate append-only THC-ENC-421+ lane.

## Verified baseline (do not overwrite with an older audit)

The 2026-10-09 archived release evidence reports 420/420 live routes, 21/21 hubs, 420/420 source fingerprints, and zero copy-repair candidates **at that tested commit and time**. This does not certify today's site, scientific validity, visual accessibility, or assessment accuracy. See `docs/ENCYCLOPEDIA_CONTENT_GAP_REGISTER.md` and `data/encyclopedia-live-release-status.json`.

Current documented remaining work includes 1,260 draft assessment rationales awaiting independent review; 420/420 lessons having controlled claim-evidence mappings but still requiring claim-to-source applicability review; source-locator resolution; and review-pending visual candidates. The 20 independently verified Volume 03 visuals must not be conflated with pending candidates.

## Acceptance rules

### A. Machine checks (reproducible, not editorial approval)

1. Run `npm run verify:encyclopedia-content-control`, `npm run audit:encyclopedia-substantive-quality`, `npm run verify:encyclopedia-evidence`, `npm run verify:encyclopedia-production-queues`, and `npm run verify:encyclopedia-machine-work` from the target SHA. Save exit codes, UTC run date, SHA, and produced artifact digests.
2. Validate protected IDs, unique routes, previous/next navigation, canonical metadata, structured data, and search index; reject any regression below 420 core lessons or 21 hubs.
3. Run current production URL verification independently of repository CI. Test mobile and desktop article loading; cite timestamp and sampled routes, and never extrapolate a sample to 420/420.
4. Ensure the strict release-readiness gate is **not weakened** to fabricate success. A review-pending state is a valid blocker, not a script defect.

### B. Science review (qualified reviewer required)

For each claim, record: lesson ID; claim ID; direct source locator (DOI/URL/page/table/figure); study design and organism; sample size where available; environment; measured endpoint; source limitations; cannabis-specific applicability; verdict (`supported`, `qualified`, `unsupported`, or `needs_more_evidence`); reviewer identity/date; and the exact revision requested. Do not treat a citation count or source title as claim validation. Distinguish general plant biology evidence from cannabis-specific demonstrations.

For rhizophagy, microbial endophytism, nutrient cycling, and microbe-mediated plant nutrition, explicitly distinguish demonstrated observations from proposed mechanisms and from practical cultivation benefits that have not been established in cannabis. Avoid claims that plants universally “eat” soil microbes or that any microbial additive reliably improves yields.

### C. Visual review (one visual, one evidence trail)

Record visual asset ID, corresponding lesson and claim IDs, alt text, diagram labels and units, scientific reference, rights/license and creator, color-contrast check, small-screen readability, reviewer verdict, and approved asset checksum. AI-generated visuals and descriptive briefs remain candidates until independently checked. Verify that no illustration implies unmeasured scale, concentrations, anatomical details, or causal certainty.

### D. Assessment review (separate from Academy certification)

For every lesson's three questions, verify unique prompt, correct scoring expectation, scientific rationale, sufficient lesson grounding, acceptable alternate responses, ambiguity, accessibility, and reviewer decision. Preserve all 1,260 rationale drafts as **pending** until reviewed; never automatically publish answer keys or equate an encyclopedia check with an accredited certification.

### E. Public experience and deployment

At minimum, assess search queries by topic, common symptom, glossary term, and spelling variation; filters; topic hubs; breadcrumbs; related lessons; citation links; downloadable workbooks; screen-reader semantics; keyboard controls; and 360px/768px/desktop layouts. Archive route-level failures and screenshots rather than reporting blanket pass/fail without evidence.

For production acceptance, record source SHA, deployment SHA, workflow/run URL, route list, start/end timestamps, representative browser and viewport, actual HTTP/DOM checks, and regression/rollback decision.

## Suggested prioritized review slices

| Priority | Slice | Why |
| --- | --- | --- |
| P0 | Claims that imply diagnosis, safety, universal targets, or microbial nutrient transfer | Misinterpretation can cause crop harm or misinformation. |
| P0 | Unresolved image rights or non-verifiable citations | Publication trust and licensing risk. |
| P1 | The 1,260 pending answer rationales | Needed for meaningful educational assessment. |
| P1 | Review-pending teaching diagrams outside the already approved Volume 03 set | Accuracy, readability, and rights gaps. |
| P1 | Source exact-locator queue, ordered by claim risk | Resolves traceability, not just reference counts. |
| P2 | Practical record templates for earlier lesson parts | Strengthens application of the science. |

## Review record template

```json
{
  "lessonId": "THC-ENC-001",
  "itemType": "claim",
  "itemId": "REPLACE_WITH_EXISTING_ID",
  "sourceLocator": null,
  "applicability": null,
  "reviewer": null,
  "reviewedAt": null,
  "verdict": "pending",
  "notes": null,
  "revisionCommit": null,
  "assetSha256": null
}
```

This is a human-review template, **not** a replacement for the canonical schemas or a fabricated approval event. A release decision must reference actual signed/reviewed records and current live verification.

## Completion definition

**Published core** = canonical lessons discoverable and working live, proven at a specified revision/time.  
**Machine-complete** = deterministic checks pass at that revision.  
**Scientifically reviewed** = independent claim-level decisions with traceable source locators.  
**Visually approved** = rights, labels, accuracy, accessibility, and fixed artifact hash verified.  
**Assessment approved** = independent rationales and scoring reviewed.  
**Fully complete** = all required release gates pass without suppressing pending findings.

Avoid changing protected IDs or reclassifying draft/review-pending records as approved merely to make dashboards green.
