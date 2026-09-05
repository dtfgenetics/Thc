import { readFile } from 'node:fs/promises';

// This validator is intentionally lightweight so every ownership-affecting push can run it.
const files = {
  canonicalPages: 'scripts/apply-wordpress-public-content-rest.mjs',
  ownershipWrapper: 'scripts/apply-wordpress-public-content-owned-routes.mjs',
  ownershipVerifier: 'scripts/verify-wordpress-owned-route-preservation.mjs',
  commerceVisuals: 'scripts/rebuild-wordpress-commerce-visuals.mjs',
  canonicalWorkflow: '.github/workflows/wordpress-canonical-production.yml',
  learningWorkflow: '.github/workflows/wordpress-learning-experience-v3-production.yml',
  learningTransaction: 'scripts/run-learning-v3-connected-production.sh',
  educationNavigation: 'scripts/update-wordpress-learn-expansion-v1.mjs',
  geneticsWorkflow: '.github/workflows/wordpress-genetics-library-production.yml'
};

const content = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
  )
);

const failures = [];
const failIf = (condition, message) => {
  if (condition) failures.push(message);
};

// Generic editorial page reconciliation must never own the Seeds root.
failIf(
  /\[\s*['"]seeds['"]\s*,/m.test(content.canonicalPages) ||
    /pageDefinitions[\s\S]{0,1200}['"]seeds['"]/m.test(content.canonicalPages),
  'Generic WordPress page reconciliation includes the Seeds route.'
);

// Commerce visual composition may link to /seeds/ but must not load or update it.
failIf(
  /getPage\(\s*['"]seeds['"]\s*\)/m.test(content.commerceVisuals),
  'Commerce visual publisher fetches the Seeds page.'
);
failIf(
  /backupAndUpdate\(\s*seeds\b/m.test(content.commerceVisuals),
  'Commerce visual publisher updates the Seeds page.'
);

// The broad canonical workflow must preserve the Learning-owned Home/Learn
// content and must not invoke the old visual writer or gate /learn/ itself.
failIf(
  !/node scripts\/apply-wordpress-public-content-owned-routes\.mjs/m.test(content.canonicalWorkflow),
  'Canonical WordPress workflow no longer uses the ownership-preserving reconciliation wrapper.'
);
failIf(
  /node scripts\/apply-wordpress-public-content-rest\.mjs/m.test(content.canonicalWorkflow),
  'Canonical WordPress workflow directly invokes the broad page writer instead of the ownership-preserving wrapper.'
);
failIf(
  /node scripts\/rebuild-wordpress-visual-site\.mjs/m.test(content.canonicalWorkflow),
  'Canonical WordPress workflow still invokes the legacy Home/Learn visual writer.'
);
failIf(
  /verify_page\s+['"]\/learn\//m.test(content.canonicalWorkflow),
  'Canonical WordPress workflow verifies /learn/ as if it owned the route.'
);

// Delegated Home/Learn protection is a write-path policy, not a global hash
// freeze. The wrapper must declare both delegated slugs, hand that policy to
// the generic reconciler, and fail unless transaction evidence proves no broad
// create/update occurred. The verifier may accept a later legitimate owner
// advance only while identity and canonical owner markers remain valid.
failIf(
  !/const delegatedSlugs = \['home', 'learn'\]/m.test(content.ownershipWrapper),
  'Ownership-preserving reconciliation wrapper does not declare both Home and Learn as delegated routes.'
);
failIf(
  !/process\.env\.DTF_PRESERVE_PAGE_SLUGS = delegatedSlugs\.join\(','\)/m.test(content.ownershipWrapper),
  'Ownership-preserving wrapper does not hand delegated routes to the generic read-only policy.'
);
failIf(
  !/DTF_PRESERVE_PAGE_SLUGS/m.test(content.canonicalPages) ||
    !/action: preserved \? 'preserve'/m.test(content.canonicalPages) ||
    !/Preserved delegated \/\$\{item\.slug\}\/ owner without mutation/m.test(content.canonicalPages),
  'Generic WordPress reconciliation does not enforce delegated route preservation.'
);
failIf(
  !/Canonical WordPress lane attempted to mutate delegated/m.test(content.ownershipWrapper) ||
    !/canonicalLaneMutation = false/m.test(content.ownershipWrapper),
  'Ownership wrapper does not fail closed on Home/Learn transaction mutation evidence.'
);
failIf(
  !/canonicalLaneMutation !== false/m.test(content.ownershipVerifier) ||
    !/ownerAdvanced/m.test(content.ownershipVerifier) ||
    !/data-dtf-layout=\\?"home-v3\\?"/m.test(content.ownershipVerifier) ||
    !/data-dtf-learning-map=\\?"v4\\?"/m.test(content.ownershipVerifier),
  'Owned-route verifier does not distinguish canonical-lane mutation from a legitimate Learning owner advance.'
);
failIf(
  /content changed during canonical reconciliation/m.test(content.ownershipVerifier),
  'Owned-route verifier still requires global Home/Learn hash stability instead of transaction-level no-write proof.'
);

// Education child publishers may observe the Learn root but must not write it.
failIf(
  /method:\s*['"]POST['"][\s\S]{0,300}\/wp-json\/wp\/v2\/pages/m.test(content.educationNavigation) ||
    /\/wp-json\/wp\/v2\/pages\/\$\{/m.test(content.educationNavigation),
  'Education expansion navigation compatibility step still writes the Learn root.'
);
failIf(
  !/mutation:\s*['"]none['"]/m.test(content.educationNavigation),
  'Education expansion navigation step is not explicitly read-only.'
);

// Learning V3 remains the automatic Learn owner and its serialized transaction
// must carry both the connected map and expanded reference-system links.
failIf(
  !/bash scripts\/run-learning-v3-connected-production\.sh/m.test(content.learningWorkflow),
  'Learning V3 workflow no longer invokes its connected owner transaction.'
);
failIf(
  !/data-dtf-learning-expanded-reference=\\?"v1\\?"/m.test(content.learningTransaction),
  'Learning V3 owner transaction no longer publishes expanded reference links.'
);
failIf(
  !/Learn the plant as a connected system\./m.test(content.learningTransaction),
  'Learning V3 owner transaction no longer carries the public Learn ownership fingerprint.'
);

// The broad canonical workflow should not make an obsolete Seeds-layout check
// part of its own release gate; dedicated genetics production owns that proof.
failIf(
  /verify_page\s+['"]\/seeds\//m.test(content.canonicalWorkflow),
  'Canonical WordPress workflow verifies /seeds/ as if it owned the route.'
);

// The dedicated genetics workflow must continue to carry Seeds ownership.
failIf(
  !/publish-wordpress-genetics-library-cdn\.mjs/m.test(content.geneticsWorkflow),
  'Dedicated genetics workflow no longer invokes the genetics library publisher.'
);
failIf(
  !/(verify|verification)[\s\S]{0,1200}(\/seeds\/|seeds)/im.test(content.geneticsWorkflow),
  'Dedicated genetics workflow no longer contains a Seeds verification gate.'
);

if (failures.length) {
  console.error('DTFSeeds route ownership validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DTFSeeds route ownership validation passed.');
console.log('- /seeds/ is excluded from generic WordPress page reconciliation.');
console.log('- commerce visual publishing does not fetch or update /seeds/.');
console.log('- canonical WordPress production makes Home/Learn transactionally read-only and accepts only valid owner advances.');
console.log('- education child publishing cannot mutate the Learn root.');
console.log('- Learning Experience V3 retains connected-map and expanded-reference ownership.');
console.log('- the dedicated genetics workflow retains publisher + verification ownership.');
