const fs = require('node:fs');
const path = require('node:path');

const routeFile = process.env.WEB_QA_ROUTE_FILE || '.artifacts/web-qa/routes.json';
const artifactDir = process.env.WEB_QA_ARTIFACT_DIR || '.artifacts/web-qa';
const baseUrl = process.env.WEB_QA_BASE_URL || 'https://dtfseeds.com';
const enforce = process.env.WEB_QA_ENFORCE === '1';
const level = enforce ? 'error' : 'warn';
let urls = [baseUrl];

if (fs.existsSync(routeFile)) {
  const parsed = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
  if (Array.isArray(parsed.routes) && parsed.routes.length) urls = parsed.routes;
}

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: Number(process.env.LHCI_RUNS || (enforce ? 3 : 1)),
      settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': [level, { minScore: 1 }],
        'categories:accessibility': [level, { minScore: 1 }],
        'categories:best-practices': [level, { minScore: 1 }],
        'categories:seo': [level, { minScore: 1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: path.join(artifactDir, 'lighthouse'),
    },
  },
};
