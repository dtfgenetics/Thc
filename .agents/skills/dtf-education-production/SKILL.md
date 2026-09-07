---
name: dtf-education-production
description: Build and advance DTF/THC educational material from research-backed lesson authoring through objectives, assessments, certification mapping, visuals, review state, registry integration, web presentation, and release readiness without falsely claiming scientific/editorial approval. Use for THC learning courses, encyclopedia, SOP/home manuals, certification, glossary, assessments, references, infographics, or educational UI.
compatibility: DTF curriculum/content repositories with GitHub access; use current authoritative scientific sources for material claims and repository-specific validation/release rules.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Education Production

Use this skill as the education-specific production pipeline. Its job is to turn a topic into a complete, evidence-aware learning asset that can move through review, assessment, certification, visual production, web integration, and controlled release.

## Production lifecycle

1. Resolve the canonical course/lesson/topic and current source object.
2. Identify audience level, prerequisite knowledge, competencies, and measurable learning objectives.
3. Research/update authoritative evidence and preserve claim-to-source traceability.
4. Expand the lesson with clear explanation, vocabulary, mechanisms, applied examples, common errors/misconceptions, practical exercises, and bounded takeaways.
5. Build formative/summative assessment coverage that actually tests declared objectives.
6. Map objectives and assessments into the correct course/certification credential graph.
7. Define required visuals: diagrams, scientific plates, photographs, tables, charts, interactive elements, and downloadable resources.
8. Add glossary/cross-linking and beginner→advanced progression links.
9. Run registry/object/schema/content-quality tests against the generated working registry.
10. Keep review/publication state truthful. Draft or review-candidate material stays draft/review-candidate until independent approval requirements are actually satisfied.
11. Validate education UI with `dtf-web-quality-gate`.
12. For public release, rebuild and verify committed release registries/artifacts through the release gate.

## Content completeness standard

A production lesson should normally contain:

- concise purpose and learner outcome;
- measurable objectives;
- controlled terminology/vocabulary;
- mechanism/process explanation;
- cultivation or observational relevance;
- multiple applied examples/scenarios;
- common mistakes and interpretation traps;
- practical observation/exercise/SOP connection where appropriate;
- evidence/references tied to meaningful claims;
- assessment coverage for each objective;
- related lessons/glossary links;
- visual brief/placement contract;
- accessibility text for meaningful visuals;
- explicit limitations/uncertainty where evidence is context-dependent.

Do not pad content merely to increase length. Expansion must increase conceptual coverage, usable examples, evidence, assessment value, or learner clarity.

## Evidence boundaries

- Separate cannabis-specific evidence from general horticulture evidence.
- State genotype, environment, system, measurement, or treatment limits when they materially affect interpretation.
- Do not turn one study, manufacturer claim, or practitioner convention into a universal crop target.
- Legal, pesticide, electrical, engineering, safety, medical, and chemical-use statements must keep jurisdiction/device/label/professional boundaries explicit.
- Never mark `scientific_approved`, `editorial_approved`, certification-ready, or equivalent merely because automated checks pass.

## Certification contract

Certification is not a badge attached to lesson completion. Require an explicit chain:

competency → learning objectives → instruction → assessment items/tasks → scoring/decision rule → evidence record → credential eligibility → credential lifecycle.

Check for orphan objectives, unassessed competencies, duplicate/overlapping items, weak distractors, answer leakage, inconsistent difficulty, missing practical evidence, and credentials that can be issued without the declared evidence.

## Visual production contract

For every major topic, define a visual set proportionate to the lesson rather than treating visuals as decoration. Each visual brief should identify teaching purpose, factual content, labels, source/evidence boundary, desired format, accessibility text, and placement. Final approved visual assets must be tied back to the lesson/registry and verified on the target page.

## Authoring versus release registry

During ordinary authoring, generate the working registry from source objects and run the complete content/credential suite against it. Do not require draft authors to hand-maintain generated registry churn.

For production release, rebuild the registry and fail closed if the committed release registry differs from source objects. This preserves strict publication consistency while keeping authoring efficient.

## Handoffs

- Repository/CI/integration → `github-repo-manager`.
- Broad education prioritization → `dtf-system-orchestrator`.
- Visual/browser/accessibility QA → `dtf-web-quality-gate`.
- Canonical content preservation → `dtf-content-preservation`.
- Public release/live verification → DTF publishing/repair skills.
