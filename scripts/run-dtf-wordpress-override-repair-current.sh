#!/usr/bin/env bash
set -euo pipefail

script="scripts/repair-dtf-wordpress-override.mjs"
test -s "$script"
test -s scripts/wordpress-ipv4-fetch-bootstrap.mjs

python3 - "$script" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
replacements={
    "$supplied = (string) $request->get_header('x-dtf-repair-token');": "$supplied = (string) $request->get_param('dtf_repair_token');",
    "return current_user_can('manage_options') && $supplied !== '' && hash_equals($token, $supplied);": "return $supplied !== '' && hash_equals($token, $supplied);",
    "'Genetics, cultivation education, practical tools, and original cannabis games.'": "'data-dtf-layout=\"home-v3\"'",
    "'Understand the plant. Build the environment. Make better decisions.'": "'data-dtf-layout=\"learn-v3\"'",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected MU repair fragment not found: {old[:120]}')
    s=s.replace(old,new,1)

header_old="headers: { 'X-DTF-Repair-Token': token }"
header_new="json: { dtf_repair_token: token }"
if s.count(header_old) != 2:
    raise SystemExit(f'Expected two MU repair token header calls, found {s.count(header_old)}')
s=s.replace(header_old,header_new)

checks_old='''  const checks = [
    [`/index.php?dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="home-v3"', 'THC Grow Doc, genetics, cultivation education, and games in one home.'],
    [`/index.php?pagename=learn&dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="learn-v3"', 'Grow education belongs in a clean, readable library.'],
  ];'''
checks_new='''  const checks = [
    [`/index.php?dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="home-v3"', 'THC Grow Doc, genetics, cultivation education, and games in one home.'],
    [`/index.php?pagename=learn&dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="learn-v3"', 'Grow education belongs in a clean, readable library.'],
    [`/?dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="home-v3"', 'THC Grow Doc, genetics, cultivation education, and games in one home.'],
    [`/learn/?dtf_origin_check=${encodeURIComponent(token)}`, 'data-dtf-layout="learn-v3"', 'Grow education belongs in a clean, readable library.'],
    [`/games/?dtf_origin_check=${encodeURIComponent(token)}`, '25 playable browser games', '__dtf_no_stale_games_marker__'],
    [`/tools/?dtf_origin_check=${encodeURIComponent(token)}`, 'Grow with records. Diagnose with evidence.', '__dtf_no_stale_tools_marker__'],
  ];'''
if checks_old not in s:
    raise SystemExit('Expected current MU repair origin-check array not found')
s=s.replace(checks_old,checks_new,1)
p.write_text(s)
PY

node --check "$script"
grep -Fq "get_param('dtf_repair_token')" "$script"
grep -Fq "return \$supplied !== '' && hash_equals(\$token, \$supplied);" "$script"
grep -Fq 'data-dtf-layout="home-v3"' "$script"
grep -Fq 'data-dtf-layout="learn-v3"' "$script"
grep -Fq '25 playable browser games' "$script"
grep -Fq 'Grow with records. Diagnose with evidence.' "$script"
grep -Fq 'json: { dtf_repair_token: token }' "$script"
! grep -Fq 'X-DTF-Repair-Token' "$script"
grep -Fq "const expectedSha = 'a32f9a10a5f79580d665d8d2c4718993a9d4bc14070eb8a26a4a2386f8535a3c'" "$script"
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$script"
