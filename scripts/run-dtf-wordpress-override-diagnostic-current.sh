#!/usr/bin/env bash
set -euo pipefail

script="scripts/diagnose-dtf-wordpress-override.mjs"
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
    "register_rest_route('dtf-repair/v1', '/override-owner', [\n        'methods' => 'GET',": "register_rest_route('dtf-repair/v1', '/override-owner', [\n        'methods' => 'POST',",
    "const result = await wpGetRetry('/wp-json/dtf-repair/v1/override-owner', { headers: { 'X-DTF-Repair-Token': token } });": "const result = await wpRequest('/wp-json/dtf-repair/v1/override-owner', { method: 'POST', json: { dtf_repair_token: token } });",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected override diagnostic fragment not found: {old[:120]}')
    s=s.replace(old,new,1)
p.write_text(s)
PY

node --check "$script"
grep -Fq "get_param('dtf_repair_token')" "$script"
grep -Fq "return \$supplied !== '' && hash_equals(\$token, \$supplied);" "$script"
grep -Fq "'methods' => 'POST'" "$script"
grep -Fq "json: { dtf_repair_token: token }" "$script"
! grep -Fq 'X-DTF-Repair-Token' "$script"
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$script"
