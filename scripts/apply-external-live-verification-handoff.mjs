import fs from 'node:fs';

const path = '.github/workflows/deploy-public-suite-wordpress-v2.yml';
let source = fs.readFileSync(path, 'utf8');

const pathAnchor = `      - scripts/promote-public-game-routes-via-wordpress.mjs\n      - scripts/wordpress-suite-v2/**\n`;
const pathReplacement = `      - scripts/promote-public-game-routes-via-wordpress.mjs\n      - scripts/verify-external-release-candidates-live.mjs\n      - scripts/wordpress-suite-v2/**\n`;
if (!source.includes(pathAnchor)) throw new Error('Deployment trigger path anchor not found');
source = source.replace(pathAnchor, pathReplacement);

const dispatchAnchor = `      - name: Dispatch independent feature-surface verification\n        if: always()\n`;
const verificationStep = `      - name: Verify exact external game release candidates\n        shell: bash\n        run: |\n          set -euo pipefail\n          for attempt in 1 2 3 4 5; do\n            echo \"External game live verification attempt $attempt/5\"\n            if node scripts/verify-external-release-candidates-live.mjs; then\n              exit 0\n            fi\n            if [[ \"$attempt\" -lt 5 ]]; then sleep 10; fi\n          done\n          echo 'External game exact live verification failed after 5 attempts.' >&2\n          exit 1\n\n`;
if (!source.includes(dispatchAnchor)) throw new Error('Feature-surface dispatch anchor not found');
source = source.replace(dispatchAnchor, `${verificationStep}${dispatchAnchor}`);

const summaryAnchor = '            echo "- Atlas verification: ${{ steps.live_atlas.outcome }}"\n';
const summaryReplacement = `${summaryAnchor}            echo '- External release candidates: exact source revision, release metadata, and runtime assets verified after publish.'\n`;
if (!source.includes(summaryAnchor)) throw new Error('Deployment summary anchor not found');
source = source.replace(summaryAnchor, summaryReplacement);

fs.writeFileSync(path, source);
console.log('Coupled exact external-game verification to WordPress V2 deployment.');
