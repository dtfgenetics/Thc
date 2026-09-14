#!/usr/bin/env bash
set -euo pipefail

# RETIRED PRODUCTION TRANSACTION.
# The former canonical pipeline imported queued binaries, committed them back to
# main, uploaded them as dtf-edu-* WordPress media, rewrote Learning subject
# pages, and required 117+ public infographic cards. That behavior is incompatible
# with the current approved-only visual policy. Fail before intake, git writes,
# WordPress writes, or cache mutation can occur.

policy="${DTF_VISUAL_QUALITY_POLICY:-site/wordpress/visual-quality-policy.json}"
test -s "$policy" || { echo "Visual quality policy is missing: $policy" >&2; exit 1; }
node - "$policy" <<'NODE'
const fs=require('fs');
const p=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(Number(p.schemaVersion)<3 || p.mode!=='quarantine') throw new Error('Visual quality quarantine policy v3+ is required.');
if(p.replacementPolicy?.legacyAutomaticInfographicPublishingAllowed!==false) throw new Error('Legacy automatic infographic publishing must remain disabled.');
if(p.replacementPolicy?.legacyInfographicReuseAllowed!==false) throw new Error('Legacy infographic reuse must remain disabled.');
if(p.replacementPolicy?.automaticKeywordMediaSelectionAllowed!==false) throw new Error('Automatic keyword media selection must remain disabled.');
if(!(p.bannedMedia?.slugPrefixes||[]).includes('dtf-edu-')) throw new Error('dtf-edu-* must remain quarantined.');
NODE

echo 'publish-wordpress-infographics-canonical.sh is retired.' >&2
echo 'No intake, git push, WordPress media upload, page rewrite, or cache mutation was performed.' >&2
echo 'Use scripts/publish-wordpress-approved-visual-library.mjs plus role-specific dtf-approved-visual-* replacements.' >&2
exit 64
