# GrowLens Code Sourcing and Implementation Map

Date reviewed: 2026-07-13

## Purpose

This document identifies the code GrowLens still needs, the existing code that must be extended, and the external projects or browser standards that are safe to use as references.

The goal is not to copy a different grow application into this repository. GrowLens already has a tested local-first architecture, a Hostinger PHP backend, revision-aware synchronization, private photo storage, complete backups, recurring routines, reports, and guarded deployment. New code must preserve those boundaries.

## Current repository baseline

Already implemented in `apps/growlens-web`:

- local-first grow spaces, cycles, plants, diary, tasks, environment readings, observations, and photos;
- recurring tasks and active-page reminders;
- VPD, DLI, lux-to-PPFD calibration, canopy mapping, and environment reports;
- IndexedDB photo storage and private Hostinger photo endpoints;
- revision-aware account synchronization with explicit conflict choices;
- complete records-plus-photo backups with atomic restore;
- guarded Hostinger deployment and live acceptance tooling.

Do not replace these systems with a third-party application or generic backend framework.

## Priority 1: structured cultivation records

### Code to create

Add first-class record types instead of forcing all measurements into diary notes.

Suggested modules:

```txt
apps/growlens-web/src/cultivationRecordTypes.ts
apps/growlens-web/src/cultivationRecordValidation.ts
apps/growlens-web/src/CultivationRecordsWidget.tsx
apps/growlens-web/src/cultivation-records.css
apps/growlens-web/src/cultivationRecordReporting.ts
apps/growlens-web/e2e/cultivation-records.spec.ts
```

Suggested records:

- `IrrigationRecord`
  - plant, cycle, or whole-space scope
  - input volume and unit
  - runoff volume and percentage
  - input and runoff pH
  - input and runoff EC with explicit unit
  - water temperature
  - irrigation method
  - timestamp and notes
- `FeedingRecord`
  - product or recipe name
  - amount and unit
  - final EC and pH
  - water volume
  - additive categories
  - timestamp and notes
- `HarvestRecord`
  - plant and cycle
  - wet weight
  - dry weight
  - trim weight
  - unit
  - harvest date
  - dry duration
  - final moisture or water-activity reading when available
  - quality notes
- `ObservationOutcome`
  - observation ID
  - verification performed
  - confirmed, ruled out, unresolved, or monitoring status
  - action taken
  - follow-up date
  - resolved date
  - result notes

### Required repository changes

Structured records affect more than the form UI. The same pull request must update:

```txt
apps/growlens-web/src/types.ts
apps/growlens-web/src/storage.ts
apps/growlens-web/src/stateMerge.ts
apps/growlens-web/src/completeBackup.ts
apps/growlens-web/src/reporting.ts
apps/growlens-web/public/api/_shared.php
apps/growlens-web/tests/php-backend-smoke.php
apps/growlens-web/e2e/
```

The data schema should move from version 1 to version 2 with a deterministic migration. Existing version-1 backups and server snapshots must remain importable.

### External dependency decision

Do not add a schema-driven form framework for this layer. The existing React and TypeScript components are sufficient, and a custom form keeps units, range checks, and accessibility explicit.

Do not use a generic grow-journal repository as a code donor. Data models and licenses are inconsistent, and replacing the current state model would create migration and privacy risk.

## Priority 2: conflict-safe background synchronization

### Browser standards and reference code

Use these as technical references:

- Workbox Background Sync documentation and Apache-2.0 code samples:
  - https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
- Background Synchronization API:
  - https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- Web Locks API:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
- Broadcast Channel API:
  - https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
- IndexedDB API:
  - https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

### Important architecture decision

Do not blindly queue and replay raw `POST api/sync.php` requests.

GrowLens synchronization includes:

- an expiring authenticated session;
- a CSRF token;
- an expected server revision;
- explicit handling for HTTP 409 conflicts;
- user-controlled keep-device, keep-account, and merge choices.

A raw replay library can resend an obsolete CSRF token or stale revision. That would either fail repeatedly or risk bypassing the product's conflict workflow.

### Code to create

Implement a small GrowLens-specific intent queue:

```txt
apps/growlens-web/src/syncIntentStore.ts
apps/growlens-web/src/backgroundSyncCoordinator.ts
apps/growlens-web/src/BackgroundSyncStatus.tsx
apps/growlens-web/src/background-sync.css
apps/growlens-web/src/backgroundSyncCoordinator.test.ts
apps/growlens-web/e2e/background-sync.spec.ts
```

Suggested queue record:

```ts
type SyncIntent = {
  id: string;
  stateHash: string;
  createdAt: string;
  retryCount: number;
  nextAttemptAt: string;
  status: 'pending' | 'blocked-auth' | 'blocked-conflict' | 'failed';
};
```

The queue should not store password, session cookie, CSRF token, or a private server path.

### Replay rules

1. Acquire a same-origin Web Lock so only one tab or worker attempts synchronization.
2. Read the latest local state at replay time instead of persisting an obsolete request body.
3. Fetch a fresh session and CSRF token.
4. Pull current server revision.
5. Upload only when the current local and server state can be reconciled safely.
6. Stop and display the existing conflict UI on HTTP 409.
7. Stop and require sign-in on HTTP 401 or 403.
8. Broadcast status changes to other tabs.
9. Use Background Sync where supported and `online`, focus, and app-start fallback elsewhere.
10. Never cache the request or response in the service worker.

Workbox may be used only for studying retry and IndexedDB queue patterns. A custom coordinator is the safer initial implementation.

## Priority 3: closed-app reminders

### Candidate library

`web-push-libs/web-push-php`

- repository: https://github.com/web-push-libs/web-push-php
- license: MIT
- latest major reviewed: version 10 requires PHP 8.2 or newer;
- PHP 8.1 deployments must use the maintained-compatible version 9 line or upgrade the Hostinger runtime first;
- installation uses Composer.

### Required code

Browser and service worker:

```txt
apps/growlens-web/src/pushSubscription.ts
apps/growlens-web/src/PushReminderSettings.tsx
apps/growlens-web/public/sw.js
```

Hostinger PHP:

```txt
apps/growlens-web/public/api/push-subscribe.php
apps/growlens-web/public/api/push-unsubscribe.php
apps/growlens-web/public/api/push-status.php
scripts/growlens-send-due-reminders.php
```

Private data:

```txt
GROWLENS_DATA_DIR/push-subscriptions/<user-id>.json
GROWLENS_DATA_DIR/push-delivery-log/
```

### Required safeguards

- explicit opt-in after explaining closed-app delivery;
- authenticated subscription ownership;
- CSRF protection on subscribe and unsubscribe;
- VAPID private key only in server environment configuration;
- no plant names, diagnoses, photos, or sensitive notes in push payloads by default;
- rate limiting and delivery deduplication;
- invalid or expired subscription cleanup;
- Hostinger cron job for due-task evaluation;
- one-click disable and full deletion during account deletion;
- live Safari, Chromium, and Android PWA testing before calling the feature supported.

Do not implement this until production deployment confirms the available PHP version, Composer support, cron execution, and required PHP extensions.

## Priority 4: photo comparison and image analysis

### Immediate code without a dependency

Use the existing Canvas API for:

- matched-angle silhouette guides;
- manual opacity overlay;
- crop and rotation controls;
- side-by-side synchronized zoom;
- annotation layers stored separately from the source photo;
- image-quality checks such as blur, darkness, clipping, and framing.

Relevant references:

- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- camera capture: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

Suggested files:

```txt
apps/growlens-web/src/photoAlignment.ts
apps/growlens-web/src/photoQuality.ts
apps/growlens-web/src/PhotoAnnotationCanvas.tsx
apps/growlens-web/src/photoComparison.test.ts
```

### Optional later dependency

OpenCV.js:

- documentation: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- use only for feature matching, geometric alignment, or advanced image processing after the manual workflow is tested;
- load lazily in a worker because the WebAssembly bundle is large;
- do not send private images to a third-party service.

## Priority 5: camera-based AI assistance

### Runtime candidate

MediaPipe Tasks Vision:

- package: `@mediapipe/tasks-vision`
- official guide: https://developers.google.com/edge/mediapipe/solutions/vision/image_classifier/web_js
- official examples and documentation code: Apache-2.0;
- supports image and video classification in browser applications.

### Critical limitation

MediaPipe is an inference runtime, not a cannabis diagnostic model. It requires a compatible trained model whose categories are defined during training.

Do not ship a generic PlantVillage classifier and describe its output as cannabis diagnosis. Those datasets predominantly cover other crops, controlled backgrounds, and limited disease classes. High test accuracy on those datasets does not establish real-world cannabis performance.

### Safe first AI uses

Before disease classification, use on-device image code for lower-risk assistance:

- determine whether the image is too dark or blurred;
- check whether a whole plant or leaf fills the expected frame;
- group visually similar progress photos;
- identify duplicate or near-duplicate uploads;
- produce image embeddings for user-controlled comparison without claiming diagnosis.

### Model-development code needed later

```txt
ml/growlens/dataset-manifest.json
ml/growlens/label-taxonomy.md
ml/growlens/train.py
ml/growlens/evaluate.py
ml/growlens/export_tflite.py
ml/growlens/model-card.md
apps/growlens-web/src/visionWorker.ts
apps/growlens-web/src/visionModel.ts
```

The model card must document training data, label definitions, exclusions, false-positive risks, validation method, device performance, and known failure cases.

## Priority 6: phone light-estimation workflow

### Code source

Use browser camera APIs and the existing GrowLens reference-meter calibration system. There is no trustworthy drop-in JavaScript package that converts every phone camera image into accurate PPFD without device, spectrum, exposure, diffuser, and geometry calibration.

Suggested implementation:

```txt
apps/growlens-web/src/lightMeterCamera.ts
apps/growlens-web/src/lightMeterCalibration.ts
apps/growlens-web/src/LightMeterWidget.tsx
apps/growlens-web/src/light-meter.css
apps/growlens-web/e2e/light-meter.spec.ts
```

Required behavior:

- request the rear camera through `getUserMedia()`;
- display actual track settings and supported capabilities;
- lock or record exposure, white balance, ISO, focus, and zoom only where the browser exposes them;
- sample central-frame luminance over multiple frames;
- reject saturated, unstable, or underexposed readings;
- require a fixture-, diffuser-, distance-, spectrum-, and device-specific reference calibration;
- store a compatibility signature instead of assuming all cameras behave alike;
- label every output as an estimate;
- preserve the manual lux/reference-PPFD workflow as the trusted calibration path.

## Code that should not be added now

- Firebase, Supabase, or another paid backend replacing Hostinger;
- a generic AI diagnosis API that uploads private plant photos;
- automatic treatment recommendations based only on an image;
- blind last-write-wins synchronization;
- a large form framework solely for four structured record forms;
- a full OpenCV.js bundle in the initial application shell;
- push notifications before Hostinger PHP, Composer, cron, and extension compatibility are verified;
- native app code before the PWA production pilot is stable.

## Implementation order

1. Deploy the current green release and complete live pilot acceptance.
2. Add structured irrigation, feeding, harvest, and observation-outcome records with schema migration.
3. Add improved plant, cycle, cultivar, and environment summaries using those records.
4. Add conflict-safe sync intents with explicit conflict blocking.
5. Add manual photo alignment and quality guidance.
6. Validate the camera light-estimation prototype on real supported devices.
7. Decide whether closed-app web push is worth the operating and privacy cost.
8. Build a labeled image dataset and model-development pipeline before enabling AI classification.

## First implementation target

The next production branch should be:

```txt
feature/growlens-structured-cultivation-records
```

Definition of done:

- schema version 2 and version-1 migration;
- irrigation, feeding, harvest, and outcome record types;
- range and unit validation;
- accessible mobile forms;
- plant and cycle history integration;
- CSV, printable report, account sync, complete backup, and merge support;
- PHP snapshot validation;
- desktop and mobile browser tests;
- no regression in accounts, photos, routines, reports, deployment, or recovery tooling.
