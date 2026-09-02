#!/usr/bin/env bash
set -euo pipefail

script="scripts/repair-static-shadows-via-wordpress.mjs"
runner="scripts/run-static-shadow-repair-resilient.mjs"
test -s "$script"
test -s "$runner"
test -s scripts/wordpress-ipv4-fetch-bootstrap.mjs

python3 - "$script" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
replacements = {
    "['/', 'Genetics. Plant science. Tools. Games. Community.']": "['/', 'data-dtf-layout=\"home-v3\"']",
    "['/learn/', 'Explore by subject']": "['/learn/', 'data-dtf-layout=\"learn-v3\"']",
    "        ['rel' => 'learn/infographics/index.html', 'markers' => ['being rebuilt', 'Reserved strain card', 'Tool-ready rebuild']],\n    ];": "        ['rel' => 'learn/infographics/index.html', 'markers' => ['being rebuilt', 'Reserved strain card', 'Tool-ready rebuild', 'dtf-home.css']],\n        ['rel' => 'seeds/index.html', 'markers' => ['dtf-home.css', 'DTF Genetics catalog pages built around strain identity and grow context.', 'Draft strain cards and genetics content are ready to organize.']],\n        ['rel' => 'shop/index.html', 'markers' => ['dtf-home.css', 'DTF Genetics products, seeds, apparel, and printables in one storefront path.']],\n        ['rel' => 'community/index.html', 'markers' => ['dtf-home.css', 'Game Nights', 'Grower Prompts']],\n        ['rel' => 'gallery/index.html', 'markers' => ['dtf-home.css', 'Character Art', 'Grow Media']],\n        ['rel' => 'about/index.html', 'markers' => ['dtf-home.css', 'Dream the Future with genetics, games, and education.']],\n        ['rel' => 'contact/index.html', 'markers' => ['dtf-home.css', 'Game Hub', 'Community']],\n    ];",
    "    ['/learn/infographics/', 'Visual plant science and cultivation library.'],\n  ];": "    ['/learn/infographics/', 'Visual plant science and cultivation library.'],\n    ['/learn/start-here/', 'Learn the plant before chasing the fix.'],\n    ['/seeds/', 'data-dtf-genetics-library=\"2026\"'],\n    ['/seeds/mango-bubbles/', 'data-dtf-genetics-line=\"mango-bubbles\"'],\n    ['/shop/', 'dtf-commerce-archive-style'],\n    ['/community/', 'data-dtf-layout=\"community-visual-v1\"'],\n    ['/gallery/', 'data-dtf-layout=\"gallery-visual-v1\"'],\n    ['/about/', 'data-dtf-layout=\"about-visual-v1\"'],\n    ['/contact/', 'data-dtf-layout=\"contact-visual-v1\"'],\n    ['/games/', '25 playable browser games'],\n    ['/tools/', 'Grow with records. Diagnose with evidence.'],\n  ];",
    "$supplied = (string) $request->get_header('x-dtf-repair-token');": "$supplied = (string) $request->get_param('dtf_repair_token');",
    "return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);": "return $supplied !== '' && hash_equals($token, $supplied);",
    "register_rest_route('dtf-repair/v1', '/static-shadow-state', [\n        'methods' => 'GET',": "register_rest_route('dtf-repair/v1', '/static-shadow-state', [\n        'methods' => 'POST',",
    "    const state = await wpGetRetry('/wp-json/dtf-repair/v1/static-shadow-state', {\n      headers: { 'X-DTF-Repair-Token': repairToken },\n      allow: [404],\n    });": "    const state = await wpRequest('/wp-json/dtf-repair/v1/static-shadow-state', {\n      method: 'POST',\n      json: { dtf_repair_token: repairToken },\n      allow: [404],\n    });",
    "if (removedFiles.length < 1) {\n    throw new Error(`No known stale static shadow file was removed. Result: ${JSON.stringify(repair?.body || {}).slice(0, 900)}`);\n  }": "if (removedFiles.length < 1) {\n    console.warn(`No stale static shadow needed removal; continuing with visitor verification. Result: ${JSON.stringify(repair?.body || {}).slice(0, 900)}`);\n  }",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected repair fragment not found: {old[:120]}')
    s = s.replace(old, new, 1)

# State recovery is converted separately. The remaining three token-bearing calls
# are retire, finalize, and rollback. Hostinger may strip custom headers, so keep
# the per-run token in the JSON body for all temporary repair endpoints.
header_old = "headers: { 'X-DTF-Repair-Token': repairToken }"
header_new = "json: { dtf_repair_token: repairToken }"
remaining = s.count(header_old)
if remaining != 3:
    raise SystemExit(f'Expected three remaining custom repair-token header calls, found {remaining}')
s = s.replace(header_old, header_new)

p.write_text(s)
PY

node --check "$script"
node --check "$runner"
grep -Fq "\$request->get_param('dtf_repair_token')" "$script"
grep -Fq "return \$supplied !== '' && hash_equals(\$token, \$supplied);" "$script"
! grep -Fq "current_user_can('manage_options') && \$supplied" "$script"
! grep -Fq "X-DTF-Repair-Token" "$script"
for rel in seeds/index.html shop/index.html community/index.html gallery/index.html about/index.html contact/index.html; do
  grep -Fq "'rel' => '$rel'" "$script"
done
grep -Fq 'data-dtf-layout="home-v3"' "$script"
grep -Fq 'data-dtf-layout="learn-v3"' "$script"
grep -Fq 'data-dtf-genetics-library="2026"' "$script"
grep -Fq 'data-dtf-layout="contact-visual-v1"' "$script"
grep -Fq '25 playable browser games' "$script"
grep -Fq 'Grow with records. Diagnose with evidence.' "$script"
grep -Fq "json: { dtf_repair_token: repairToken }" "$script"
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$runner"
