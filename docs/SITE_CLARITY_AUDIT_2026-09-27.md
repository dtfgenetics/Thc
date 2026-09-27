# DTFSeeds Site Clarity Audit — 2026-09-27

## Goal
Make the public site understandable without requiring visitors to learn the internal content architecture first.

## Highest-impact findings

1. **Too many parallel entry points.** Learn, Courses, Tools, diagnostics, atlases, references, and deeper libraries are all valid, but their roles overlap in first-contact copy.
2. **The homepage explains the system before helping the visitor choose a task.** The first decision should be intent: genetics, learning, plant problem, or tools.
3. **Learn vs. Courses is not obvious enough.** Learn is topic-first explanation/reference. Courses is ordered training with assessments.
4. **The Tools hub exposes the large catalog before the two primary workflows.** GrowLens and Grow Doc should appear before the expanded toolbox.
5. **Internal terminology leaks into visitor-facing copy.** Words such as “system,” “depth,” “suite,” “reference,” and product names should be secondary to plain-language jobs.

## Production rules

- Lead with **what the visitor wants to do**, not the site taxonomy.
- Every major hub gets one plain-language sentence explaining its job.
- Keep top-level meanings stable:
  - **Seeds:** genetics and releases.
  - **Learn:** explanations, subject study, and reference.
  - **Courses:** structured training and assessments.
  - **Tools:** measurement, tracking, calculators, and Grow Doc.
  - **Games:** playable experiences.
  - **Community:** participation, grow-offs, feedback, and Discord.
  - **Shop:** purchasing.
- Put primary workflows before complete catalogs.
- Introduce specialized terminology only after the visitor has chosen a task.
- On mobile, the first viewport should answer: **Where am I? What can I do here? What should I tap first?**

## Changes in this branch

- Homepage hero rewritten around four visitor intents.
- Homepage first section renamed from internal “three jobs” framing to “What do you want to do?”
- Learn copy now explicitly distinguishes Learn from Courses.
- Learning-format language changed from abstract “depth” terminology to task-oriented learning choices.
- Tools hero simplified.
- Tools navigation renamed in plain language.
- GrowLens/Grow Doc chooser moved before the expanded tool catalog.
- Courses catalog intro now explicitly explains the difference between Courses and Learn.

## Follow-up QA

Before production deployment:
- Rebuild the WordPress learning/home output from the updated generator.
- Run existing deterministic navigation, route, shared UI, and learning validation scripts.
- Verify homepage, Learn, Courses, and Tools at mobile, tablet, and desktop widths.
- Confirm no post-processing script restores older homepage copy.
- Confirm the Tools public-route package preserves the new section order.
