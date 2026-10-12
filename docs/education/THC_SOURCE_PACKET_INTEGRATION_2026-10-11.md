# THC education source-packet integration and release gaps

Status: **working integration note — not publication approval**  
Date: 2026-10-11  
Scope: Cannabis Plant Science Encyclopedia, User Guides, cultivation SOPs, and related education QA.

## Source material received

1. `THC-UG-000_Master_Project_Source_Reference_v0.1.docx` — User Guide Manual Series policy and build order; working reference v0.1.
2. `THC_Cultivation_SOP_Source_Materials_Packet_v1.docx` — separate cultivation SOP scope, citation hierarchy, legal/safety controls, source map and coverage checklist.
3. `THC_Cannabis_Plant_Science_Source_Packet_v1.docx` — scientific foundation for anatomy, development, physiology, chemotypes, propagation, root zone, nutrition and evidence limitations.

These are supplied project source packets, **not** independently approved scientific claims or automatically publishable lessons. Preserve source provenance and fact-check material before release.

## Ownership and boundaries

| Surface | Audience / job | Source policy | Release requirement |
| --- | --- | --- | --- |
| Encyclopedia | In-depth plant-science reference | Cite scientific mechanisms, distinguish cannabis-specific findings from general horticultural extrapolation | Canonical lesson + approved meaningful visuals + validated evidence and navigation |
| User Guides (`THC-UG-###`) | Plain-language step-by-step lawful plant care | Master User Guide v0.1 structure; references and measured targets | Complete guide sections, safety, checklist, review, printable editable file |
| Professional SOPs | Repeatable documented lawful operations | Source packet's 4-tier evidence hierarchy and jurisdiction review | SOP controls, roles, records, safety, verification and source notes |
| Academy | Curriculum, student assessments, certification | Course-owned learning outcomes and assessment evidence | Human pilot, functioning grade/progress/certificate behavior |

**Do not** use SOP checklists as substitutes for science lessons; do not count encyclopedia records as certification course completion. The repository's `scripts/audit-encyclopedia-learning-quality.mjs` already explicitly separates encyclopedia and Academy completeness.

## Verified repository observations at integration time

- `dtfgenetics/Thc` contains `content/encyclopedia/`, a canonical lesson loader, discovery-index builder, quality audit, lifecycle/assessment validators and UI validator. **Existence of these scripts does not prove every public route or teaching visual passes.**
- `scripts/audit-encyclopedia-learning-quality.mjs` reports represented lessons, individual canonical files, approved visuals, assessment materialization, rationales, malformed source labels and placeholders; `--strict` applies additional gates.
- `docs/PRODUCTION_STANDARDS.md` already defines educational page structure, visual semantics, accessibility, site-wide IA, deterministic checks and release criteria. Reuse these instead of introducing a competing standard.
- `dtfgenetics/Thc-dataset` README currently describes **THC Grow Doc** diagnostic code, not the authoritative encyclopedia content tree. Avoid assuming that repository owns encyclopedia publications without a separate migration/ownership decision.

## Required evidence fields for every new or revised scientific claim

Record: `claim_id`, `lesson_or_guide_id`, the exact claim text, `source_identifier`, `source_type` (regulator | university/standards | peer-reviewed cannabis | contextual industry), `cannabis_specific` (true/false), `evidence_status` (verified | preliminary | extrapolated | unresolved), `jurisdiction` where applicable, `reviewer`, `review_date`, and `source_locator` (URL/DOI + section/page).

Numerical targets also require `units`, `measurement_location`, `crop_stage`, `context`, and `target_basis` (regulatory | experimentally supported | product-specific | cultivar-specific | practical starting range). Never silently promote practical starting ranges into universal optimal targets.

### Quality stop conditions

- Any chemical/pesticide recommendation lacking a current product-label and jurisdiction-specific applicability check.
- Unverified legal statements implying cultivation permission in all locations.
- Unsupported fixed environmental, feeding, lighting or cure numbers.
- A visual marked approved without a real resolved asset, teaching caption and provenance/usage rights.
- Unresolved generic placeholders, source-copy corruption, or references that cannot be traced.
- A lesson marked public solely because a JSON record or URL exists.

## Next executable batch (in dependency order)

1. **Capture current audit baselines:** run `node scripts/audit-encyclopedia-learning-quality.mjs --strict` in a full checkout; preserve exit code and `data/encyclopedia-learning-quality-audit.json`. Also run lifecycle, assessment and experience-UI validators. Do not report success until commands actually pass.
2. **Select a small failing lesson batch** by audit results. Repair canonical source claims, citations, teaching visuals and assessment rationales. Only use approved visual assets.
3. **Validate search and public routes** against generated discovery index and real deployed pages; report failed routes separately from present source records.
4. **Start the User Guide release lane:** create the controlled User Guide tracker; review `THC-UG-000` for all required User Guide fields; then draft `THC-UG-001`. Keep User Guide file IDs independent of `THC-ENC-###` identities.
5. **SOP lane:** build a per-topic gap list against the SOP source packet; begin with lawful-use, electrical/water/chemical/CO2/UV safety, biosecurity and measurement documentation.
6. **Human review:** scientific evidence reviewer, legal/jurisdiction reviewer when needed, instructional/editorial review, and a hands-on/mobile usability pass precede public publication.

## User Guide acceptance checklist

Every `THC-UG-###` draft needs: title, controlled ID, version/status, prepared-for line, audience, learning goals, relevance, lawful-use/safety, terms, materials, context-qualified ranges, steps, common mistakes, troubleshooting, success criteria, recordkeeping, escalation/stop conditions, source notes and user checklist. Include companion worksheets/charts/decision trees only where they improve learning.

## Evidence/provenance caution

This integration note is derived from the **three supplied project packets** and a **read-only inspection of selected repository files on 2026-10-11**. It does not certify scientific accuracy, guarantee the current live website is correct, or report any command/test run as passed.
