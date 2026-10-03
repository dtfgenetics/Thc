---
name: thc-encyclopedia-production
description: Build, audit, repair, expand, index, render, validate, and safely publish the THC Cannabis Plant Science Encyclopedia as a repeatable 420+ knowledge system. Use when work involves THC-ENC lessons, encyclopedia search/discovery, content completeness, lesson UX, visuals, assessments, cross-links, source control, new THC-ENC-421+ topics, WordPress encyclopedia publication, or encyclopedia production readiness.
compatibility: dtfgenetics/Thc with GitHub/repository access. Use current authoritative sources for scientific updates and repository release controls for publication.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# THC Encyclopedia Production

Use this skill as the repeatable production system for the THC Cannabis Plant Science Encyclopedia.

The target is not a fixed count of pages. The controlled base is THC-ENC-001 through THC-ENC-420, and legitimate non-duplicate topics may expand through THC-ENC-421+ while preserving every existing permanent ID, route, citation, assessment reference, and cross-link.

This skill specializes encyclopedia production. The encyclopedia is its own canonical reference system. Academy/courses are separate curriculum products with their own lesson sequencing, progress, assessment, practical, and certification controls. Reuse shared evidence/visual standards where appropriate, but never make Academy/course membership a prerequisite for encyclopedia completeness or publication.

## Goal

Maintain one durable pipeline:

```text
controlled registry
  -> lesson source
  -> completeness scorecard
  -> search/discovery document
  -> lesson renderer
  -> visuals/tools/cross-links
  -> assessments/evidence
  -> validation gates
  -> publication candidate
  -> WordPress publish
  -> live verification
  -> usage/search-gap feedback
  -> next repair or THC-ENC-421+ expansion
```

A lesson existing in source is not the same as being production complete, publication authorized, deployed, or live.

## Required source-of-truth files

Read before editing:

- `content/encyclopedia/current-controlled-registry.json`
- `configuration/encyclopedia-topics.json`
- `configuration/encyclopedia-search-language.json`
- `configuration/encyclopedia-search-benchmark.json`
- `content/encyclopedia/lesson-template.json`
- `content/encyclopedia/coverage-baseline.json`
- `docs/ENCYCLOPEDIA_CONTENT_GAP_REGISTER.md`
- `site/wordpress/education/encyclopedia/full-controlled-catalog.json` — full 420-lesson release/search authority
- `site/wordpress/education/encyclopedia/current-production-batch.json` — legacy/targeted batch pointer only
- `data/encyclopedia-completion-scorecard.json` when generated
- `scripts/build-encyclopedia-completion-scorecard.mjs`
- `scripts/build-encyclopedia-discovery-index.mjs`
- `scripts/publish-wordpress-encyclopedia-canonical-batch.mjs`
- `site/wordpress/mu-plugins/dtf-learning-search.php`
- `scripts/build-wordpress-learning-search-runtime.mjs`
- `scripts/validate-encyclopedia-content-control.mjs`

Also read `.agents/skills/dtf-education-production/SKILL.md`, `.agents/skills/dtf-content-preservation/SKILL.md`, and the publishing skill when live state is in scope.

## Permanent identity contract

- Never recycle or renumber a THC-ENC ID.
- Never change an existing permanent ID merely to reorganize subjects.
- Stable IDs and stable public routes must survive title edits.
- Add THC-ENC-421+ only for a genuinely distinct topic, not to inflate the lesson count.
- New entries must be added to the controlled registry and the appropriate topic/part architecture before publication.
- If future expansion requires Part 22+, add a controlled topic definition rather than forcing unrelated lessons into Part 21.

## Repeatable operating loop

### 1. Audit

Run the scorecard and strict content checks. Group gaps by:
- missing/weak content fields;
- evidence/source control;
- visual production;
- assessment/rationale;
- cross-links/tools/downloads;
- search metadata;
- release state;
- renderer/UI;
- live mismatch.

Work from the highest-leverage shared defect before hand-editing hundreds of lessons.

### 2. Repair the canonical source

Repair lesson source objects, not generated website output. Preserve:
- objective;
- controlled terminology;
- mechanism/core science;
- cultivation relevance;
- measurement/record guidance;
- misconceptions;
- evidence limits;
- cross-links;
- sources;
- visual contract;
- knowledge checks and rationale;
- revision/release state.

Use batch repair only when the transformation is semantically safe. Do not generate generic assessments or generic filler merely to satisfy counts.

### 3. Build discovery/search

Run the discovery-index builder after content changes.

The search document must support more than titles. Index:
- ID and title;
- topic/part;
- objective;
- terms and synonyms;
- core-science text;
- cultivation relevance;
- measurements;
- misconceptions;
- symptoms/diagnostic language where present;
- evidence-limit language;
- related tools/routes;
- publication state;
- format and visual type.

Expose filterable facets for topic, format, status, and other stable metadata.

Maintain the controlled search-language map for common grower terms, abbreviations, spelling variants, and symptom descriptions. These aliases are retrieval aids only: never convert a slang phrase into a diagnosis or scientific claim. Search state should remain deep-linkable through URL query/filter parameters. Maintain a real-query benchmark and fail CI when representative grower/science queries stop reaching their expected subject areas. Search results should explain why they matched by surfacing the matching field/snippet rather than presenting ranking as a black box.

Search architecture is provider-independent. The canonical search document is the contract; Fuse, MiniSearch, Pagefind, Algolia DocSearch, Typesense, or another frontend may consume it later without changing lesson identity.

### WordPress search runtime contract

Do not place executable search modules or large search payloads inside WordPress post/page content. WordPress sanitization can strip scripts even when the REST page write succeeds.

The production model is:
- semantic page HTML remains normal WordPress content;
- `dtf-learning-search.php` is a repository-managed MU-plugin;
- the MU-plugin injects the search bootstrap from `wp_footer` only on the search and encyclopedia routes;
- generated runtime assets live under `wp-content/mu-plugins/dtf-learning-search/`;
- authenticated publisher requests update the two indexes through `/wp-json/dtf-learning/v1/index/*`;
- public search reads those indexes through read-only REST endpoints;
- review-only catalog entries must not expose unreleased lesson body fields in public indexes;
- runtime deployment, index publication, and visitor verification are separate release gates.

### 4. Render

Every published lesson should use the canonical renderer. It should provide:
- strong lesson title/summary;
- what-you-will-learn;
- terms;
- readable science sections;
- cultivation relevance;
- measure-and-record panel;
- misconceptions/corrections;
- evidence limits;
- real approved teaching visual when available;
- related tools;
- related lessons;
- knowledge check;
- source notes;
- previous/next navigation;
- mobile-first responsive layout;
- accessible semantics and alt text.

Never emit fake image placeholders as if a lesson had visual coverage.

### 5. Cross-link the knowledge system

A lesson should connect to the rest of THC when relevant:
- Plant Atlas;
- Terpene Atlas;
- Grow Doc;
- GrowLens;
- measurement/calculation tools;
- SOPs;
- glossary;
- records/downloads;
- optional Academy/course links when they genuinely help a learner continue into structured training;
- related encyclopedia topics.

Encyclopedia-to-course links are navigation aids only. A lesson must remain complete, understandable, assessable, and publishable without belonging to a course. Prefer deterministic mappings derived from lesson metadata and topic ownership. Hand-authored exceptions are allowed when the science requires them.

### 6. Visual production

Use the lesson visual contract. A visual brief needs:
- asset ID;
- teaching purpose;
- factual/label requirements;
- type;
- placement;
- caption;
- alt text;
- rights status;
- QA status.

Only approved/verified assets count as scorecard visual coverage.

### 7. Assessments

For each lesson:
- at least one mechanism/application check;
- one measurement/verification check where appropriate;
- one misconception/evidence-limit challenge;
- answer rationale;
- scoring intent/completion rule.

Assessment must test content actually taught by that lesson.

### 8. Release control

Do not infer publication authorization from completeness score.

For full-catalog publication:
- generate `site/wordpress/education/encyclopedia/full-controlled-catalog.json` from the controlled registry and require byte-for-byte parity in CI;
- use the full-catalog manifest for discovery/search publication state;
- canonical lesson changes publish through `.github/workflows/wordpress-encyclopedia-full-catalog.yml`;
- `current-production-batch.json` is reserved for deliberate targeted/legacy batch work and must not define the full-catalog search cutoff;
- full-catalog and targeted WordPress writes share one concurrency group so they cannot overwrite each other in parallel.

Before publishing:
- lesson identity matches registry;
- required evidence/review state is satisfied;
- publication authorization is explicit;
- renderer and search index are current;
- backups/recovery contract is active;
- exact candidate source is known.

### 9. Verify production

After publication, verify:
- public lesson route;
- encyclopedia index;
- search discoverability;
- related links;
- mobile rendering;
- no internal control language leaked to learners;
- correct publication state;
- current content/version.

A successful GitHub merge or WordPress API write is not live verification.

## Search/product patterns to preserve

Use patterns proven by modern documentation systems:

- separate indexing from search UI;
- generate navigation/facets from content metadata;
- stable IDs/URLs independent of display title;
- contextual topic filtering;
- instant fuzzy/prefix search;
- next/previous navigation;
- breadcrumbs/topic context;
- search query deep links;
- search analytics/gap feedback when a provider supports it;
- crawler/build regeneration instead of hand-maintained search lists.

See `references/search-and-knowledge-system-patterns.md`.

## Commands

Run as applicable:

```bash
npm run build:encyclopedia-scorecard
npm run verify:encyclopedia-scorecard
npm run build:encyclopedia-discovery
npm run build:education-search
npm run validate:education-search
npm run verify:encyclopedia-search-benchmark
npm run verify:wordpress-learning-search
npm run verify:encyclopedia-content-control
npm run verify:encyclopedia-content-strict
npm run verify:encyclopedia-assessments
npm run verify:encyclopedia-renderer
npm run verify:project-os
```

## Expansion gate for THC-ENC-421+

Before adding a new topic, verify:
1. it is not adequately covered by an existing lesson;
2. search queries and cross-links justify distinct treatment;
3. the topic has a clear learning objective;
4. authoritative evidence exists;
5. it has a subject/part owner;
6. its route/slug does not collide;
7. it can meet the same lesson contract as the controlled base.

## Completion definition

The encyclopedia system is healthy when:
- all controlled lessons are represented in the registry and discovery index;
- production readiness is measurable;
- published lessons use the canonical renderer;
- search covers lesson content, not only titles;
- relevant tools and atlases connect back to lessons, while course links remain optional navigation;
- review-only content remains protected;
- new 421+ topics can be added without changing old identities;
- validation fails closed when required contracts drift;
- live pages match the current authorized source.
