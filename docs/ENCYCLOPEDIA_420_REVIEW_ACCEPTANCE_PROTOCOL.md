# THC 420+ — independent quality review and acceptance protocol

Updated: 2026-10-14  
Scope: protected THC-ENC-001…420, with a separate append-only THC-ENC-421+ lane.

## Verified baseline (do not overwrite with an older audit)

The 2026-10-09 archived release evidence reports 420/420 live routes, 21/21 hubs, 420/420 source fingerprints, and zero copy-repair candidates **at that tested commit and time**. This does not certify today's site, scientific validity, visual accessibility, or assessment accuracy. See `docs/ENCYCLOPEDIA_CONTENT_GAP_REGISTER.md` and `data/encyclopedia-live-release-status.json`.

The 1,260 draft general-lesson assessment rationales are optional legacy materials, **not a condition for publishing or completing informational lessons**; 420/420 lessons having controlled claim-evidence mappings but still requiring claim-to-source applicability review; source-locator resolution; and review-pending visual candidates. The 20 independently verified Volume 03 visuals must not be conflated with pending candidates.

## Acceptance rules

**Scope correction (2026-11-23):** General lessons and educational tools have no mandatory assessment or separate formal science-review gate. The older review-only machine queue and any automated status dashboards must be reconciled with this policy in a separate code change; this document alone does not prove that those checks have been updated.

### A. Machine checks (reproducible, not editorial approval)

1. Run `npm run verify:encyclopedia-content-control`, `npm run audit:encyclopedia-substantive-quality`, `npm run verify:encyclopedia-evidence`, `npm run verify:encyclopedia-production-queues`, and `npm run verify:encyclopedia-machine-work` from the target SHA. Save exit codes, UTC run date, SHA, and produced artifact digests.
2. Validate protected IDs, unique routes, previous/next navigation, canonical metadata, structured data, and search index; reject any regression below 420 core lessons or 21 hubs.
3. Run current production URL verification independently of repository CI. Test mobile and desktop article loading; cite timestamp and sampled routes, and never extrapolate a sample to 420/420.
4. Ensure the strict release-readiness gate is **not weakened** to fabricate success. A review-pending state is a blocker only when it represents an applicable publication requirement (such as unlicensed visual assets), not an optional general-lesson quiz or separate formal science sign-off.

### B. Science review (qualified reviewer required)

For each claim, record: lesson ID; claim ID; direct source locator (DOI/URL/page/table/figure); study design and organism; sample size where available; environment; measured endpoint; source limitations; cannabis-specific applicability; verdict (`supported`, `qualified`, `unsupported`, or `needs_more_evidence`); reviewer identity/date; and the exact revision requested. Do not treat a citation count or source title as claim validation. Distinguish general plant biology evidence from cannabis-specific demonstrations.

For rhizophagy, microbial endophytism, nutrient cycling, and microbe-mediated plant nutrition, explicitly distinguish demonstrated observations from proposed mechanisms and from practical cultivation benefits that have not been established in cannabis. Avoid claims that plants universally “eat” soil microbes or that any microbial additive reliably improves yields.

### C. Visual review (one visual, one evidence trail)

Record visual asset ID, corresponding lesson and claim IDs, alt text, diagram labels and units, scientific reference, rights/license and creator, color-contrast check, small-screen readability, reviewer verdict, and approved asset checksum. AI-generated visuals and descriptive briefs remain candidates until independently checked. Verify that no illustration implies unmeasured scale, concentrations, anatomical details, or causal certainty.

### D. General learning versus Academy certification

The public Encyclopedia and standalone educational tools are informational resources. They do **not** require quizzes, graded tests, assessment rationales, an independent reviewer sign-off, or credential approval to be considered complete. Do not use the 1,260 legacy draft rationales as a publication, completion, or release blocker. Preserve them as optional unpublished materials unless deliberately retired in a separate tracked change.

Academy certification courses are a distinct product: their timed assessments, scoring integrity, saved answers, completion records, and printable credentials must be verified under the Academy's own acceptance criteria. Never expose operational scoring keys in a public learner-facing bundle.

Evidence-grounded writing, correct citations, accessible diagrams, stable lesson identities, functioning navigation, and reproducible software checks still apply to informational content. Scientific uncertainty must be accurately communicated, but a separate formal science-review approval is **not** required for general lesson publication.

