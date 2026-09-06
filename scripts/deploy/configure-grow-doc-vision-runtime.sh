#!/usr/bin/env bash
set -euo pipefail

public_root="${1:-}"
if [[ -z "$public_root" || "$public_root" != /*/public_html ]]; then
  echo 'Expected absolute Hostinger public root ending in /public_html.' >&2
  exit 1
fi

wp_config="$public_root/wp-config.php"
secret_file="$HOME/.dtf-deploy/secrets/grow-doc-gemini-key"
[[ -s "$wp_config" ]] || { echo "WordPress config not found: $wp_config" >&2; exit 1; }
[[ -s "$secret_file" ]] || { echo 'Grow Doc Gemini key staging file is missing or empty.' >&2; exit 1; }

backup_root="$HOME/.dtf-deploy/backups/grow-doc-vision"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_root"
cp -p "$wp_config" "$backup_root/wp-config.php.$stamp"

WP_CONFIG="$wp_config" SECRET_FILE="$secret_file" python3 - <<'PY'
from pathlib import Path
import os

config_path = Path(os.environ['WP_CONFIG'])
secret_path = Path(os.environ['SECRET_FILE'])
secret = secret_path.read_text(encoding='utf-8').strip()
if not secret:
    raise SystemExit('Grow Doc Gemini key is empty.')

source = config_path.read_text(encoding='utf-8')
start = '// DTF Grow Doc vision runtime begin'
end = '// DTF Grow Doc vision runtime end'

# Escape for a single-quoted PHP string without ever printing the secret.
escaped = secret.replace('\\', '\\\\').replace("'", "\\'")
block = (
    f"{start}\n"
    "if (!defined('THC_GROW_DOC_GEMINI_API_KEY')) {\n"
    f"    define('THC_GROW_DOC_GEMINI_API_KEY', '{escaped}');\n"
    "}\n"
    f"{end}"
)

if start in source and end in source:
    before, rest = source.split(start, 1)
    _, after = rest.split(end, 1)
    next_source = before + block + after
else:
    anchor = "/* That's all, stop editing!"
    if anchor in source:
        next_source = source.replace(anchor, block + "\n\n" + anchor, 1)
    else:
        next_source = source.rstrip() + "\n\n" + block + "\n"

config_path.write_text(next_source, encoding='utf-8')
PY

chmod --reference="$backup_root/wp-config.php.$stamp" "$wp_config" 2>/dev/null || true
php -l "$wp_config" >/dev/null
rm -f "$secret_file"

echo "configured=true"
echo "backup=$backup_root/wp-config.php.$stamp"
