import { readFile } from 'node:fs/promises';

// Lightweight route-ownership guard for production-affecting changes. It checks
// who is allowed to write each route and where visitor verification is owned.
const files = {
  canonicalPages: 'scripts/apply-wordpress-public-content-rest.mjs',
  ownershipWrapper: 'scripts/apply-wordpress-public-content-owned-routes.mjs',
  ownershipVerifier: 'scripts/verify-wordpress-owned-route-preservation.mjs',
  commerceVisuals: 'scripts/rebuild-wordpress-commerce-visuals.mjs',
  canonicalWorkflow: '.github/workflows/wordpress-canonical-production.yml',
  learningWorkflow: '.github/workflows/wordpress-learning-experience-v3-production.yml',
  learningTransaction: 'scripts/run-learning-v3-connected-production.sh',
  learningV3AtlasPrepare: 'scripts/prepare-learning-v3-atlas-publisher.mjs',
  learningV3Prepare: 'scripts/prepare-learning-v3-owner-aware-publisher.mjs',
  learningFollowupPrepare: 'scripts/prepare-learning-owner-aware-followup-publishers.mjs',
  learningExpanded: 'scripts/publish-learning-expanded-references-owner-aware.mjs',
  learningStorage: 'scripts/verify-learning-owner-storage.mjs',
  productionGateway: '.github/workflows/dtfseeds-production-gateway.yml',
  educationNavigation: 'scripts/update-wordpress-learn-expansion-v1.mjs',
  educationWorkflow: '.github/workflows/deploy-thc-learning-center-expansion-v1.yml',
  harvestOutdoorWorkflow: '.github/workflows/wordpress-harvest-outdoor-v6-production.yml',
  geneticsWorkflow: '.github/workflows/wordpress-genetics-library-production.yml',
};

const content = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')]))
);

const failures = [];
const failIf = (condition, message) => {
  if (condition) failures.push(message);
};
const requireText = (key, text, message) => failIf(!content[key].includes(text), message || `${files[key]} is missing ${text}`);
const rejectText = (key, text, message) => failIf(content[key].includes(text), message || `${files[key]} still contains ${text}`);

// Generic editorial page reconciliation must never own the Seeds route.
failIf(
  /\[\s*['"]seeds['"]\s*,/m.test(content.canonicalPages) || /pageDefinitions[\s\S]{0,1200}['"]seeds['"]/m.test(content.canonicalPages),
  'Generic WordPress page reconciliation includes the Seeds route.'
);
failIf(/getPage\(\s*['"]seeds['"]\s*\)/m.test(content.commerceVisuals), 'Commerce visual publisher fetches the Seeds page.');
failIf(/backupAndUpdate\(\s*seeds\b/m.test(content.commerceVisuals), 'Commerce visual publisher updates the Seeds page.');

// Canonical WordPress may run before the learning owner, but must preserve
// Home/Learn and must not mutate the Learning-owned pages.
requireText('canonicalWorkflow', 'node scripts/apply-wordpress-public-content-owned-routes.mjs', 'Canonical WordPress workflow no longer uses the ownership-preserving reconciliation wrapper.');
rejectText('canonicalWorkflow', 'node scripts/apply-wordpress-public-content-rest.mjs', 'Canonical WordPress workflow directly invokes the broad page writer.');
rejectText('canonicalWorkflow', 'node scripts/rebuild-wordpress-visual-site.mjs', 'Canonical WordPress workflow still invokes the legacy Home/Learn visual writer.');
failIf(/verify_page\s+['"]\/learn\//m.test(content.canonicalWorkflow), 'Canonical WordPress workflow verifies /learn/ as if it owned the route.');
requireText('ownershipWrapper', "const delegatedSlugs = ['home', 'learn']", 'Ownership wrapper does not declare Home and Learn as delegated routes.');
requireText('ownershipWrapper', "process.env.DTF_PRESERVE_PAGE_SLUGS = delegatedSlugs.join(',')", 'Ownership wrapper does not hand delegated routes to the generic read-only policy.');
requireText('canonicalPages', 'DTF_PRESERVE_PAGE_SLUGS', 'Generic reconciler does not read delegated route preservation settings.');
requireText('canonicalPages', "action: preserved ? 'preserve'", 'Generic reconciler does not preserve delegated routes.');
requireText('ownershipWrapper', 'Canonical WordPress lane attempted to mutate delegated', 'Ownership wrapper does not fail closed on delegated-route mutation evidence.');
requireText('ownershipWrapper', 'canonicalLaneMutation = false', 'Ownership wrapper no longer records no-write transaction evidence.');
requireText('ownershipVerifier', "ownerStage = 'base-learning-owner'", 'Owned-route verifier no longer proves base Home/Learn ownership.');
requireText('ownershipVerifier', "downstreamStageVerification = 'delegated-to-learning-production'", 'Owned-route verifier no longer delegates downstream Learning markers.');
rejectText('ownershipVerifier', 'content changed during canonical reconciliation', 'Owned-route verifier still requires global Home/Learn hash stability.');

// Education navigation is read-only; Learning V3 remains the Home/Learn owner.
failIf(/method:\s*['"]POST['"][\s\S]{0,300}\/wp-json\/wp\/v2\/pages/m.test(content.educationNavigation) || /\/wp-json\/wp\/v2\/pages\/\$\{/m.test(content.educationNavigation), 'Education expansion navigation step still writes the Learn root.');
requireText('educationNavigation', "mutation: 'none'", 'Education expansion navigation step is not explicitly read-only.');
requireText('learningWorkflow', 'bash scripts/run-learning-v3-connected-production.sh', 'Learning V3 workflow no longer invokes its connected owner transaction.');
requireText('learningTransaction', 'prepare-learning-v3-atlas-publisher.mjs', 'Learning transaction no longer prepares the Atlas affordance.');
requireText('learningTransaction', 'prepare-learning-v3-owner-aware-publisher.mjs', 'Learning transaction no longer runs the owner-aware V3 publisher.');
requireText('learningTransaction', 'prepare-learning-owner-aware-followup-publishers.mjs', 'Learning transaction no longer runs owner-aware follow-up publishers.');
requireText('learningTransaction', 'publish-learning-expanded-references-owner-aware.mjs', 'Learning transaction no longer publishes expanded references through ownership.');
for (const stage of ['v3', 'v4', 'expanded', 'visual']) requireText('learningTransaction', `LEARNING_OWNER_STAGE=${stage}`, `Learning owner transaction no longer verifies ${stage} through storage.`);
requireText('learningV3AtlasPrepare', '/learn/atlas/', 'Learning V3 Atlas preparation no longer links the Atlas route.');
requireText('learningV3AtlasPrepare', 'Open the THC Living Plant Atlas', 'Learning V3 Atlas preparation no longer adds the Atlas affordance.');
requireText('learningV3Prepare', "rootVerification: 'wordpress-rest'", 'Learning V3 preparation no longer proves root storage through WordPress REST.');
requireText('learningV3Prepare', "topicVerification: 'anonymous-public'", 'Learning V3 preparation no longer separates topic visitor proof.');
requireText('learningStorage', "verification: 'wordpress-rest-storage'", 'Learning root storage verifier no longer proves WordPress storage.');
requireText('learningStorage', 'Open the THC Living Plant Atlas', 'Learning root storage verifier no longer proves the Atlas affordance.');
requireText('learningStorage', 'data-dtf-learning-map=\\"v4\\"', 'Learning root storage verifier no longer proves V4 ownership.');
requireText('learningStorage', 'data-dtf-learning-expanded-reference=\\"v1\\"', 'Learning root storage verifier no longer proves expanded-reference ownership.');
requireText('learningFollowupPrepare', 'Stored Learn V4 owner verification failed', 'Learning follow-up publisher no longer fails closed on V4 storage proof.');
requireText('learningFollowupPrepare', 'Learning Visual V1 verification failed', 'Learning follow-up publisher no longer fails closed on visual storage proof.');
requireText('learningExpanded', "storageVerification: 'success'", 'Expanded Learning references are no longer verified through stored Learn ownership.');

// The gateway verifies broad roots by stable visitor semantics, but delegated
// education/Harvest/Outdoor route details are owned by their child workflows.
requireText('productionGateway', "check '/' 'Genetics first. Learn the plant behind the pack.'", 'Production gateway no longer verifies Home through stable visitor semantics.');
requireText('productionGateway', "check '/learn/' 'Learn in a sequence that makes the plant easier to understand.'", 'Production gateway no longer verifies Learn through stable visitor semantics.');
rejectText('productionGateway', "check '/' 'data-dtf-layout=\"home-v3\"'", 'Production gateway again treats private Home storage attributes as visitor requirements.');
rejectText('productionGateway', "check '/learn/' 'data-dtf-layout=\"learn-v3\"'", 'Production gateway again treats private Learn storage attributes as visitor requirements.');
requireText('productionGateway', 'Trust education child workflow verification', 'Production gateway no longer delegates education visitor proof to the child workflow.');
requireText('productionGateway', 'Trust Harvest and Outdoor child workflow verification', 'Production gateway no longer delegates Harvest/Outdoor visitor proof to the child workflow.');
requireText('productionGateway', "steps.education_publish.outcome == 'success'", 'Gateway education verification is not gated on successful child publication.');
requireText('productionGateway', "steps.harvest_outdoor_publish.outcome == 'success'", 'Gateway Harvest/Outdoor verification is not gated on successful child publication.');

const educationMarkers = [
  "plant-health) public_marker='Plant Health, IPM'",
  "cultivation-science) public_marker='Cultivation Science Reference Library'",
  "symptoms) public_marker='Visual Symptom Differential Library'",
  "tools) public_marker='Printable Learning Tools'",
  "sources) public_marker='Current sources'",
  'Teaching Healthy Cultivation',
  'Mystery_Line_F1_Regular_DTF_Strain_Card',
  'Rainbow_Bubblegum_F1_Regular_DTF_Strain_Card',
];
for (const marker of educationMarkers) requireText('educationWorkflow', marker, `Education child workflow no longer verifies marker: ${marker}`);
for (const marker of ['data-dtf-harvest-postharvest-v6="true"', 'data-dtf-outdoor-v6="true"', 'data-dtf-outdoor-quantification-v1="true"', 'data-thc-outdoor-applied-v1="true"']) {
  requireText('harvestOutdoorWorkflow', marker, `Harvest/Outdoor child workflow no longer verifies marker: ${marker}`);
}

// The broad canonical workflow should not own Seeds; the dedicated genetics
// workflow must keep Seeds publication and verification responsibility.
failIf(/verify_page\s+['"]\/seeds\//m.test(content.canonicalWorkflow), 'Canonical WordPress workflow verifies /seeds/ as if it owned the route.');
requireText('geneticsWorkflow', 'publish-wordpress-genetics-library-cdn.mjs', 'Dedicated genetics workflow no longer invokes the genetics library publisher.');
failIf(!/(verify|verification)[\s\S]{0,1200}(\/seeds\/|seeds)/im.test(content.geneticsWorkflow), 'Dedicated genetics workflow no longer contains a Seeds verification gate.');

if (failures.length) {
  console.error('DTFSeeds route ownership validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DTFSeeds route ownership validation passed.');
console.log('- /seeds/ is excluded from generic WordPress page reconciliation.');
console.log('- canonical WordPress production preserves Home/Learn and records transaction-level no-write evidence.');
console.log('- Learning V3 owns Home/Learn through WordPress storage while topic and child routes remain visitor-verified.');
console.log('- the cumulative gateway verifies broad roots and delegates education/Harvest/Outdoor detail proof to authoritative child workflows.');
console.log('- the dedicated genetics workflow retains publisher + verification ownership.');
