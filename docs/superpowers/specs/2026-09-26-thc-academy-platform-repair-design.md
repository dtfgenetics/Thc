# THC Academy / DTFSeeds Production Architecture Repair Design

Date: 2026-09-26
Status: Proposed implementation design
Scope: DTFSeeds Academy, Courses, Learning Hub, shared publishing, and live-site integration

## 1. Product goal

DTFSeeds will present one coherent THC Academy learning platform instead of multiple competing Academy surfaces.

The learner-facing system must connect four distinct layers without collapsing their responsibilities:

1. THC Plant Science Encyclopedia — the 420-topic reference library.
2. THC Learning Hub — structured courses, lessons, practice, course tests, progress, and practical work.
3. THC Academy — professional credential pathways, credential governance, secure assessment boundaries, issuance, and verification.
4. DTFSeeds — the public site shell, navigation, account context, publishing, deployment, and live integration.

The public experience should feel like one product even though source ownership spans multiple repositories.

## 2. User journey

The primary learner journey is:

Courses -> Program / Credential -> Course -> Module -> Lesson -> Practice -> Course Assessment -> Progress -> Next Course -> Credential Eligibility

Supporting learning resources may branch to:

- Plant Atlas
- Terpene Atlas
- THC Grow Doc
- cultivation reference tools
- Plant Science Encyclopedia
- evidence and source pages

These supporting systems remain separate products or resources and do not become substitute course instruction.

## 3. Public route model

### Canonical Academy entry

`/courses/` becomes the primary public THC Academy entry point.

It should provide:

- Academy identity and purpose;
- program / credential pathways;
- course catalog;
- learner progress entry points;
- assessment entry points;
- certification / credential explanation;
- clear links to supporting reference systems.

### Course routes

Existing stable Learning Hub routes may remain in place during migration, especially current descendants of:

`/learn/learning-hub/`

These URLs are compatibility paths, not a second product identity.

The final visitor-facing hierarchy should present them under Courses / THC Academy even when historical route structure still contains `/learn/`.

### /learn/academy/

`/learn/academy/` must stop acting as an independently authored Academy product.

Target behavior:

- its useful UI and interaction patterns may be migrated into the canonical Academy experience;
- it must not maintain an independent curriculum copy;
- once parity is reached, it should redirect to the canonical Academy entry or become a documented compatibility route;
- it must not be promoted by a separate publishing path that can drift from the canonical course source.

### /learn/

`/learn/` remains the topic-first plant-science and cultivation reference root.

It must not become the Academy catalog.

## 4. Canonical ownership

### dtfgenetics/Thc-learning-courses-

Canonical for:

- Academy curriculum;
- course structure;
- lessons;
- objectives;
- formative assessment definitions;
- course tests;
- practicals;
- credential pathway metadata;
- credential rules;
- learner-tool contracts;
- public assessment definitions;
- course release metadata.

It must not own DTFSeeds global publishing, WordPress shell mutation, or site-wide navigation.

### dtfgenetics/Thc

Canonical for:

- DTFSeeds integration;
- shared navigation and shell;
- WordPress publication adapters;
- public route registry;
- Academy production packaging;
- source-SHA pinning;
- deployment;
- live-route validation;
- redirects / compatibility routing;
- production ownership enforcement.

### dtfgenetics/thc-grow-hub

Canonical for the broader THC educational/reference platform and machine-readable education content where already assigned.

It should support Academy learning through references and cross-links, not duplicate certification-course source.

### Dtf420

Dtf420 may supply reusable UI patterns, components, or migration assets.

It must not remain an independent public authority for Academy curriculum or Academy route ownership.

## 5. Architecture

The target publication chain is:

```text
Thc-learning-courses-
        |
        | exact approved curriculum revision
        v
Academy publication contract
        |
        v
dtfgenetics/Thc
        |
        +-- /courses/
        +-- current course / module / lesson routes
        +-- compatibility routes
        +-- shared DTFSeeds shell
        +-- progress / account integration boundary
        |
        v
dtfseeds.com
        |
        v
anonymous + authenticated live verification
```

No downstream publisher may silently mutate Academy academic content.

No upstream curriculum repository may directly publish competing DTFSeeds shell or route ownership.

## 6. Shared UI contract

All Academy learner surfaces must use the shared DTFSeeds production design contract:

- canonical primary navigation;
- shared page widths and gutters;
- shared typography scale;
- shared header/footer behavior;
- shared mobile breakpoints;
- minimum touch-target rules;
- accessible focus and semantic controls;
- consistent loading, empty, error, and unavailable states;
- responsive tables, assessments, diagrams, and course navigation;
- no hidden overflow as a substitute for responsive layout.

Academy-specific presentation may have its own visual identity inside this shell, but must not fork global navigation or container rules.

## 7. Course experience

A production course should expose, where applicable:

- course identity and pathway context;
- objectives;
- prerequisites;
- module navigation;
- lesson content;
- scientific explanation;
- instructional visuals;
- worked or applied examples;
- practice;
- knowledge checks;
- course assessment;
- progress state;
- supporting references;
- next-course / next-action guidance.

Reference material must remain distinguishable from required course instruction.

## 8. Assessment and credential boundaries

The system retains three distinct assessment layers:

1. formative learning assessment;
2. course-level summative assessment;
3. professional credential assessment.

Learners must independently select answers.

For course tests:

- selections are persisted;
- grading occurs after submission;
- submission locks the attempt as required;
- test / version / learner identity are retained;
- score and pass/fail are recorded;
- time limits are enforced where defined;
- remediation and retake rules are explicit.

Professional credential exams, answer pools, secure keys, psychometric records, and operational exam-security data must not be exposed in public client code or public repositories.

A completed course must never automatically imply a professional credential unless every credential gate is satisfied.

## 9. Data and identity boundaries

Public repositories may contain curriculum, objectives, public assessment definitions, release metadata, schemas, and QA records.

Production learner records must live outside public Git source.

Learner state should support:

- user identity;
- course identity;
- course version;
- lesson progress;
- assessment attempt ID;
- submitted responses;
- timestamps;
- score;
- pass/fail state;
- retake eligibility;
- certificate or credential eligibility state.

The implementation plan must choose the existing production-safe persistence mechanism rather than inventing a second user database.

## 10. Publishing and release

Academy publication must be source-revision based.

A release is not complete at commit or build.

Required chain:

1. canonical course repo revision selected;
2. integration repo pins the exact revision;
3. deterministic curriculum validation passes;
4. publication artifact is built;
5. shared shell is applied;
6. route ownership checks pass;
7. production publish runs through protected workflow;
8. caches are purged where required;
9. exact public routes are verified;
10. expected source/version markers are confirmed;
11. stale Academy fingerprints are rejected.

## 11. Verification

Verification should remain deterministic and should not depend on Playwright for routine project QA.

Required coverage should include:

- curriculum/schema validation;
- route ownership;
- source revision parity;
- catalog/course relationship integrity;
- shared navigation consistency;
- responsive structural validation;
- accessibility structure;
- asset existence;
- internal links;
- assessment state rules;
- course/version identity;
- release package integrity;
- live anonymous route checks;
- authenticated checks where required for learner state;
- rejection of stale /learn/academy/ overlays after migration.

## 12. Migration strategy

### Phase A — inventory and convergence

Map all existing Academy/Courses/Learning Hub routes, publishers, source revisions, redirects, overlays, and live fingerprints.

Classify each route as:

- canonical;
- compatibility;
- redirect;
- obsolete;
- broken / drifted.

### Phase B — canonical Academy shell

Make `/courses/` the definitive Academy entry experience.

Bring forward the strongest useful UI from the current Academy overlay without duplicating its curriculum source.

### Phase C — course template convergence

Move course, module, lesson, progress, and assessment presentation onto one responsive Academy pattern.

### Phase D — route reconciliation

Stop independently promoting a competing `/learn/academy/` curriculum surface.

Replace it with a compatibility route or redirect after feature parity is proven.

Preserve established Learning Hub child routes until deliberate redirects are implemented and verified.

### Phase E — assessment / progress integration

Connect persisted learner state, submitted answers, grading, course completion, and credential-eligibility boundaries.

### Phase F — release hardening

Add deterministic parity checks across source revision, generated package, shared shell, route ownership, and live visitor result.

## 13. Non-goals

This repair does not:

- merge encyclopedia topics into certification courses;
- expose secure professional credential exams;
- rewrite every DTFSeeds subsystem;
- replace Grow Doc, Atlas, Terpene Atlas, or cultivation tools;
- make Dtf420 the production authority;
- discard stable Learning Hub URLs before redirect coverage exists;
- claim credentials are issuance-ready without their independent release gates.

## 14. Success criteria

The architecture is successful when:

- a learner sees one THC Academy identity;
- `/courses/` is the obvious entry;
- one canonical course source exists;
- Academy content cannot drift between two public publishers;
- every course shows the same navigation and responsive behavior;
- existing course links continue to work;
- course progress and assessment state are coherent;
- reference tools connect contextually to learning;
- professional certification boundaries remain accurate;
- route/source ownership is machine-readable;
- the live site can prove which curriculum revision it serves;
- production verification fails when a stale Academy overlay or shell is present.

## 15. Primary implementation decision

Adopt the following direction:

- `/courses/` is the main THC Academy experience;
- `dtfgenetics/Thc-learning-courses-` is the canonical curriculum source;
- `dtfgenetics/Thc` is the production integration and publishing controller;
- `/learn/academy/` is retired as an independent Academy authority after its useful UI is migrated and parity is verified;
- stable Learning Hub child URLs remain supported during migration;
- Dtf420 becomes a reusable implementation/migration source rather than a competing production owner.
