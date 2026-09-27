# THC Certification & Assessment Code Harvest — 2026-09-27

Status: implementation research / architecture lock candidate  
Scope: THC Academy course assessments, certification exams, attempt tracking, scoring, certificate issuance, verification, and interoperability.

## Critical discovery after cross-repo audit

The canonical learning repository `dtfgenetics/Thc-learning-courses-` already contains a substantial first-party assessment implementation. This changes the implementation priority.

Existing reusable code includes:

- `packages/domain/assessment-runtime.mjs`
- `packages/domain/course-assessment-runtime.mjs`
- `apps/api/src/course-assessment-service.mjs`
- `apps/api/src/secure-assessment-store-adapter.mjs`
- `schemas/question.schema.json`
- `schemas/exam-form.schema.json`
- `docs/ASSESSMENT-MODEL.md`
- `docs/operations/SECURE-ASSESSMENT-RUNTIME-INTEGRATION.md`
- `docs/academy-v2/TECHNICIAN_I_ASSESSMENT_BLUEPRINT.md`

Therefore, **do not replace the THC assessment engine with SurveyJS/H5P**. Treat the learning-repo runtime as canonical. External projects are now gap-fillers and interoperability references.

Immediate priority:

1. audit the existing runtime/service/store code against production requirements;
2. identify missing persistence, authentication, timing, attempt-rule, scoring-type, practical-evidence, credential-decision, certificate, and verification features;
3. package the learning-repo runtime for reuse by the dtfseeds.com delivery surface instead of duplicating it inside WordPress publishing scripts;
4. keep secure operational item banks private and never promote public development `ITEM-*` content into live credential forms;
5. use SurveyJS/H5P only where their renderer/accessibility patterns materially improve the existing front end;
6. use QTI/Open Badges/pdf-lib/qrcode for interoperability and credential artifacts after the core runtime integration is stable.

## Implementation progress — 2026-09-27

A code-hardening branch and draft PR now exist in the canonical learning repository:

- Repository: `dtfgenetics/Thc-learning-courses-`
- Branch: `assessment-runtime-hardening-2026-09-27`
- Superseded draft PR: #733 — closed after the branch became stale behind newer certificate/QR work.
- Current draft PR: #734 — Harden certification scoring and credential verification
- Current branch: `certification-runtime-hardening-v2-2026-09-27`

Current PR #734 includes:

- fail-closed validation for invalid passing-score percentages;
- optional numeric answer tolerance through `extensions.numericTolerance`, while exact numeric scoring remains the default;
- deterministic regression coverage in `scripts/test-assessment-runtime-hardening.mjs`;
- computed public credential `valid` state from lifecycle status plus `expiresAt`;
- certificate-printing and verification UI guards that require `record.valid === true`;
- deterministic credential verification UI coverage in `scripts/test-credential-verification-ui.mjs`;
- npm commands `assessment:runtime-hardening:test` and `credential:verification-ui:test`;
- MIT license/provenance notice for the vendored QRCode.js used by printable verification certificates.

Further audit also confirmed that the learning repo already contains:

- server-side attempt expiry enforcement;
- max-attempt and cooldown rules;
- answer autosave;
- server-side scoring;
- practical evidence submission;
- credential eligibility logic;
- signed credential issuance;
- public credential lookup;
- learner credential views;
- printable certificate rendering;
- QR verification links;
- credential status lifecycle support.

This narrows the remaining implementation work. Prioritize actual gaps instead of rebuilding existing features.

## Current repository findings

The THC repository already contains:

- public course publishing and verification scripts;
- certification catalog publishing logic;
- course-level assessment plans and competency language;
- production standards requiring real attempts, answer persistence, submission locking, automatic grading, passing thresholds, certificate gating, randomized question pools, progress visibility, and deterministic QA;
- an explicit public/private boundary: public academic training can be learner-facing, while professional credential exams, credential decisions, pilot/calibration evidence, secure credential forms, and issuance controls remain restricted.

What is still missing as a coherent reusable subsystem is a centralized assessment runtime and credential lifecycle.

## Recommended architecture

Build one first-party THC assessment engine with two modes:

1. **Learning assessment mode**
   - public
   - formative knowledge checks
   - explanations after answering/submission
   - can allow retries
   - may persist locally for anonymous users and server-side for signed-in users

2. **Certification assessment mode**
   - authenticated / protected
   - server-authoritative attempt creation
   - server-authoritative timing
   - randomized blueprint-based item selection
   - answers persisted during attempt
   - immutable submission record
   - grading performed server-side
   - explicit pass/fail decision rule
   - attempt limits / cooldown rules
   - evidence record
   - certificate eligibility only after all declared requirements are satisfied
   - certificate issuance and revocation handled separately from course completion

Do not expose certification answer keys, scoring secrets, or credential decision logic in public JavaScript bundles.

## External code / standards to use

### 1. SurveyJS Form Library — use selectively

Repository: https://github.com/surveyjs/survey-library  
License: MIT

Useful for:

- JSON-driven question rendering
- single choice / multiple choice / text / matrix-style inputs
- validation
- multi-page navigation
- accessible form behavior
- configurable themes
- plain JavaScript support in addition to framework integrations

Recommended usage:

- Evaluate `survey-core` / Form Library as the renderer for learner-facing and authenticated exam item presentation.
- Keep THC's scoring, attempt state, timing, item selection, credential logic, and answer-key protection first-party and server-side.
- Do **not** depend on the commercial Survey Creator for core operation.

### 2. H5P Question Set / Question libraries — pattern source and optional interoperability layer

Repositories:

- https://github.com/h5p/h5p-question-set
- https://github.com/h5p/h5p-question
- https://github.com/h5p/h5p-multi-choice
- https://github.com/h5p/h5p-true-false

License: MIT for the referenced libraries.

Useful patterns:

- question-set lifecycle
- retry / show-solution state machines
- score aggregation
- question semantics
- reusable question type contracts
- accessibility behavior

Recommended usage:

- Use H5P's question semantics and state patterns as implementation references.
- Do not pull the entire H5P runtime into THC unless a later requirement specifically needs H5P package compatibility; it would add a dependency system larger than the current WordPress/Node publishing architecture needs.

### 3. QTI 3.0 — adopt as the import/export contract

Standard: 1EdTech Question & Test Interoperability 3.x  
Reference examples: https://github.com/1EdTech/qti-examples

Useful for:

- portable question banks
- assessment item import/export
- future LMS compatibility
- standardized metadata
- accessibility-oriented item representation

Recommended usage:

- Keep THC's internal canonical JSON schema simple and purpose-built.
- Add QTI 3 import/export adapters around the canonical schema.
- Do not model the entire runtime directly as raw QTI XML.

### 4. Open Badges 3.0 / Verifiable Credentials — credential interoperability target

Reference implementation:
https://github.com/digitalcredentials/verifier-plus

Reference course-certificate examples:
https://github.com/digitalcredentials/mit-learn-obv3-template

Useful for:

- machine-verifiable credentials
- public credential verification
- issuer identity
- expiration / revocation-aware verification
- wallet-compatible future credentials

Recommended usage:

- Start with a THC certificate record and public verification route.
- Keep the data model compatible with later Open Badges 3.0 issuance.
- Add cryptographic verifiable credentials only after the underlying eligibility, identity, revocation, and issuer lifecycle is stable.

### 5. pdf-lib — use for certificate PDF generation

Repository: https://github.com/Hopding/pdf-lib

Useful for:

- server-side or browser-side PDF creation
- embedding a certificate ID
- learner name / credential name / issue date
- QR code placement
- template-based certificate generation

Recommended usage:

- Generate the PDF only after a server-authoritative issuance record exists.
- Treat the PDF as a presentation artifact, not the source of truth.

### 6. node-qrcode (`qrcode`) — use for certificate verification QR codes

Repository: https://github.com/soldair/node-qrcode  
License: MIT

Useful for:

- certificate verification URL QR
- shareable credential links

QR should resolve to a THC verification route containing an opaque certificate identifier, not personally sensitive data.

## Code to reference but not copy directly into THC core

### Moodle quiz engine

Moodle's assessment model is mature, but its GPL code and PHP/LMS architecture make it a poor direct source for transplanting implementation into the current THC codebase.

Use it only for behavioral research:

- attempts
- question behavior
- review permissions
- timing
- grade aggregation
- question-bank organization

### Open edX assessment code

Use for architecture and product-behavior research only. Its platform footprint and licensing/deployment model are much heavier than the THC WordPress + Node publishing system.

## Canonical first-party data model

The THC engine should introduce these entities.

### Question

Required fields:

- `id`
- `version`
- `status`
- `type`
- `prompt`
- `choices` where applicable
- `correctResponse` in protected source only
- `explanation`
- `difficulty`
- `objectives[]`
- `competencies[]`
- `tags[]`
- `evidenceRefs[]`
- `accessibility`
- `authoringMetadata`

### Exam blueprint

Required fields:

- `id`
- `version`
- `credentialId`
- `sections[]`
- item pool rules per section
- required objectives / competencies
- difficulty distribution
- total item count
- timing rule
- passing rule
- attempt rule
- randomization rule
- review / explanation policy

### Attempt

Required fields:

- `attemptId`
- `userId`
- `examId`
- `examVersion`
- `questionSnapshot[]`
- `startedAt`
- `expiresAt`
- `submittedAt`
- `status`
- `answers`
- `scoreResult`
- `integrityMetadata`

### Score result

Required fields:

- raw score
- possible score
- percentage
- section scores
- competency scores
- pass threshold
- pass/fail result
- rule version

### Evidence record

Required fields:

- learner identity reference
- credential target
- completed required courses
- passed required assessments
- practical evidence / evaluator evidence where applicable
- decision rule version
- eligibility status
- timestamped audit trail

### Credential record

Required fields:

- `credentialId`
- `certificateNumber`
- `recipientId`
- `credentialDefinitionId`
- `issuedAt`
- `expiresAt` where applicable
- `status` (active / revoked / expired)
- `evidenceRecordId`
- `verificationSlug`
- `pdfArtifact`
- future `openBadgeCredential`

## Required runtime behavior

1. Create an attempt server-side.
2. Resolve an exam blueprint version.
3. Select questions server-side from approved item pools.
4. Persist a question snapshot so later bank edits cannot silently alter a started attempt.
5. Send only render-safe question data to the client.
6. Autosave answers.
7. Enforce timing on the server, not only with a browser countdown.
8. Lock the attempt on submission or expiration.
9. Grade server-side against the protected snapshot / key.
10. Persist score and competency evidence.
11. Evaluate credential eligibility independently from raw quiz completion.
12. Issue a credential only when all eligibility conditions are true.
13. Create a verification record and QR target.
14. Generate PDF presentation artifact.
15. Support revocation / expiration without deleting the historical issuance record.

## Question types for v1

Ship these first:

- single choice
- multiple select
- true/false
- numeric response with tolerance
- ordered sequence
- matching
- scenario-based single/multiple choice

Then add:

- image hotspot / identification
- branching scenario
- practical observation rubric
- evaluator-scored performance task

Free-text responses should not be auto-scored for professional certification unless a controlled rubric and human review path are implemented.

## Security rules

Certification mode must fail closed.

- No answer keys in public JSON.
- No grading logic that trusts browser-submitted scores.
- No certificate issuance triggered directly by a client flag.
- No reusable predictable certificate IDs.
- No editable submitted attempts.
- Record exam and scoring-rule versions.
- Keep public training quizzes separated from credential exams.
- Rate-limit attempt creation and credential verification endpoints where appropriate.
- Do not put sensitive learner data into QR payloads.

## Deterministic QA required

Add tests for:

- item-bank schema validity
- duplicate question IDs
- orphan objectives
- unassessed required competencies
- invalid answer keys
- impossible scoring totals
- blueprint pool shortages
- randomization staying within blueprint constraints
- timer expiration
- autosave restoration
- immutable submission
- retake rule enforcement
- pass threshold edge cases
- certificate gating
- revocation
- verification lookup
- no protected answers emitted in public bundles
- public course data never claiming professional credential issuance is open when it is not

Do not add Playwright to the required production validation path.

## Implementation sequence

### Phase 1 — assessment contract

Create:

- `site/wordpress/education/assessment/question-schema-v1.json`
- `site/wordpress/education/assessment/exam-blueprint-schema-v1.json`
- `site/wordpress/education/assessment/credential-schema-v1.json`
- `scripts/validate-assessment-bank.mjs`
- `scripts/test-assessment-engine.mjs`

### Phase 2 — public learning runtime

Create reusable learner quiz UI with:

- accessible controls
- answer persistence
- submission state
- explanations
- retry policy
- progress
- responsive mobile layout

### Phase 3 — protected certification service

Create authenticated endpoints for:

- attempt creation
- autosave
- submission
- grading
- results
- eligibility
- issuance
- verification

### Phase 4 — credential artifacts

Add:

- pdf-lib certificate generation
- QR verification links
- public certificate verification page
- revocation status

### Phase 5 — standards adapters

Add:

- QTI 3 import
- QTI 3 export
- Open Badges 3 credential mapping

## Harvest decision matrix

| Source | Use directly? | Purpose | Decision |
|---|---|---|---|
| SurveyJS Form Library | Yes, selectively | JSON-driven rendering / accessible forms | Strong candidate |
| H5P question libraries | Selected MIT patterns / possible components | question state and UX | Reference first; embed only if needed |
| QTI 3 | Yes as standard | import/export interoperability | Adopt boundary format |
| Verifier Plus | Reference / integration target | credential verification behavior | Reference architecture |
| Open Badges 3 examples | Yes as standards examples | credential data model | Future-compatible target |
| pdf-lib | Yes | certificate PDF | Adopt |
| qrcode | Yes | verification QR | Adopt |
| Moodle | No direct transplant | mature quiz behavior reference | Reference only |
| Open edX | No direct transplant | architecture reference | Reference only |

## Key implementation principle

Do not make the certification system a page-level feature inside the current publishing scripts.

Publishing scripts should continue to publish course/catalog surfaces. The assessment engine should become a reusable subsystem with explicit contracts, protected state, deterministic tests, and a credential lifecycle. That prevents the same scoring, progress, and certificate logic from being reimplemented differently across every course.
