import { readFile } from 'node:fs/promises';

const files = {
  canonicalPages: 'scripts/apply-wordpress-public-content-rest.mjs',
  commerceVisuals: 'scripts/rebuild-wordpress-commerce-visuals.mjs',
  canonicalWorkflow: '.github/workflows/wordpress-canonical-production.yml',
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
console.log('- canonical WordPress verification does not claim /seeds/.');
console.log('- the dedicated genetics workflow retains publisher + verification ownership.');
