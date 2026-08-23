#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import pathlib
import sys

# Canonical SHA-256 of the executable v2 deployer after the long-lived guarded
# source normalizations below. Customer-shell release adjustments are applied
# only after this base hash passes and each adjustment must match exactly once.
EXPECTED_SHA256 = "94d88c054dfe9a6c4ed3304b5d553d38a67f06df31b5472ecfc21d05aaf60eb5"
PART_DIR = pathlib.Path(__file__).resolve().parent / "wordpress-suite-v2"
OUTPUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "deploy-public-suite-via-wordpress-v2.mjs")

parts = sorted(PART_DIR.glob("part-*.jsfrag"))
if [p.name for p in parts] != [f"part-{i:02d}.jsfrag" for i in range(7)]:
    raise SystemExit(f"unexpected v2 fragment set: {[p.name for p in parts]}")

raw = b"".join(p.read_bytes() for p in parts)

def replace_once(payload: bytes, old: bytes, new: bytes, label: str) -> bytes:
    count = payload.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} source block, found {count}")
    return payload.replace(old, new, 1)

payload = replace_once(
    raw,
    b"register__rest_route('dtf-suite/v2', '/init'",
    b"register_rest_route('dtf-suite/v2', '/init'",
    "REST-route fragment boundary",
)
if b"register__rest_route" in payload:
    raise SystemExit("double-underscore register__rest_route remains after boundary normalization")

old_wait = b"""async function waitForSnippetApi() {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const r = await wpGetRetry('/wp-json/code-snippets/v1/snippets/schema', { allow: [404] });
      if (r.ok) return true;
    } catch {}
    await sleep(1000 + attempt * 600);
  }
  return false;
}
"""
new_wait = b"""async function waitForSnippetApi(safeMode = false) {
  const suffix = safeMode ? '?snippets-safe-mode=1' : '';
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const r = await wpGetRetry(`/wp-json/code-snippets/v1/snippets/schema${suffix}`, { allow: [404, 500] });
      if (r.ok) return true;
    } catch {}
    await sleep(1000 + attempt * 600);
  }
  return false;
}

function normalizeSnippetCollection(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['snippets', 'data', 'items', 'results']) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

async function removeStaleDeploymentSnippetsSafeMode() {
  if (!(await waitForSnippetApi(true))) return { safeMode: false, candidates: 0, removed: 0 };
  const list = await wpGetRetry('/wp-json/code-snippets/v1/snippets?snippets-safe-mode=1&per_page=100', { allow: [404, 500] });
  if (!list.ok) return { safeMode: true, candidates: 0, removed: 0 };
  const stale = normalizeSnippetCollection(list.body).filter(snippet => String(snippet?.name || '').startsWith('DTF Public Suite Deploy V2 '));
  let removed = 0;
  for (const snippet of stale) {
    const id = Number(snippet?.id || 0);
    if (!id) continue;
    const suffix = '?snippets-safe-mode=1';
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${id}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${id}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
    removed++;
    console.warn(`Removed stale temporary Public Suite deployment snippet id=${id} through authenticated Code Snippets safe mode.`);
  }
  return { safeMode: true, candidates: stale.length, removed };
}
"""
payload = replace_once(payload, old_wait, new_wait, "Code Snippets readiness helper")

old_bootstrap = b"""    if (!(await waitForSnippetApi())) throw new Error('Code Snippets REST API did not become available.');
"""
new_bootstrap = b"""    if (!(await waitForSnippetApi())) {
      const recovery = await removeStaleDeploymentSnippetsSafeMode();
      if (recovery.safeMode) console.warn(`Normal Code Snippets REST was unavailable; authenticated safe mode found ${recovery.candidates} temporary DTF deployment snippet(s) and removed ${recovery.removed}.`);
      if (recovery.removed > 0) await sleep(1800);
      if (!(await waitForSnippetApi())) throw new Error(`Code Snippets REST API did not become available after safe-mode recovery (candidates=${recovery.candidates}, removed=${recovery.removed}).`);
    }
"""
payload = replace_once(payload, old_bootstrap, new_bootstrap, "Code Snippets bootstrap failure branch")

old_cleanup = b"""async function cleanupTemporaryTools() {
  if (snippetId && !rollbackFailed) {
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate`, { method: 'POST', allow: [400, 404] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}`, { method: 'DELETE', allow: [404] }); } catch {}
  }
  if (rollbackFailed) {
    console.error('Rollback failed; temporary recovery snippet is intentionally left active.');
    return;
  }
  if (installedByDeploy && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByDeploy && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}
"""
new_cleanup = b"""async function cleanupTemporaryTools() {
  if (snippetId && !rollbackFailed) {
    let suffix = '';
    if (!(await waitForSnippetApi())) {
      if (await waitForSnippetApi(true)) suffix = '?snippets-safe-mode=1';
    }
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
    try { await wpRequest(`/wp-json/code-snippets/v1/snippets/${snippetId}${suffix}`, { method: 'DELETE', allow: [404, 500] }); } catch {}
  }
  if (rollbackFailed) {
    console.error('Rollback failed; temporary recovery snippet is intentionally left active.');
    return;
  }
  if (installedByDeploy && !pluginWasInstalled) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
    try { await wpRequest(pluginEndpoint(pluginRestId), { method: 'DELETE', allow: [400, 404] }); } catch {}
  } else if (activatedByDeploy && !pluginWasActive) {
    try { await setPluginStatus(pluginRestId, 'inactive'); } catch {}
  }
}
"""
payload = replace_once(payload, old_cleanup, new_cleanup, "temporary-tool cleanup")

base_actual = hashlib.sha256(payload).hexdigest()
if base_actual != EXPECTED_SHA256:
    raise SystemExit(f"v2 deployer fragment SHA-256 mismatch: expected {EXPECTED_SHA256}, got {base_actual}")

# Guarded customer-shell release adjustments. These intentionally happen only
# after the canonical base payload hash is verified, and each source shape must
# appear exactly once so drift fails closed instead of silently broadening the
# deployment boundary.
payload = replace_once(
    payload,
    b"'games/index.html','games/dtf-route.css','games/high-land'",
    b"'games/index.html','games/dtf-route.css','games/dtf-shell.css','games/high-land'",
    "customer-shell target allowlist",
)
payload = replace_once(
    payload,
    b"'games/index.html','games/high-land/index.html'",
    b"'games/index.html','games/dtf-shell.css','games/high-land/index.html'",
    "customer-shell required-file list",
)
payload = replace_once(
    payload,
    b"$exact_files = ['games/index.html','games/dtf-route.css'];",
    b"$exact_files = ['games/index.html','games/dtf-route.css','games/dtf-shell.css'];",
    "customer-shell exact-file allowlist",
)

# Protect the Plants is a packaged static/PHP game. Keep the canonical bridge
# fragments immutable, then widen only the guarded post-hash deployment scope.
payload = replace_once(
    payload,
    b"'games/grower-conversations','games/seed-man-platformer','games/weedopolis'",
    b"'games/grower-conversations','games/seed-man-platformer','games/protect-the-plants','games/weedopolis'",
    "Protect the Plants target allowlist",
)
payload = replace_once(
    payload,
    b"'games/grower-conversations/index.html','games/seed-man-platformer/index.html','games/weedopolis/index.html'",
    b"'games/grower-conversations/index.html','games/seed-man-platformer/index.html','games/protect-the-plants/index.html','games/protect-the-plants/api.php','games/weedopolis/index.html'",
    "Protect the Plants required-file list",
)
payload = replace_once(
    payload,
    b"'games/high-land/','games/high-iq/','games/high-life/','games/grower-conversations/','games/seed-man-platformer/',\n        'games/weedopolis/'",
    b"'games/high-land/','games/high-iq/','games/high-life/','games/grower-conversations/','games/seed-man-platformer/',\n        'games/protect-the-plants/','games/weedopolis/'",
    "Protect the Plants prefix allowlist",
)

payload = replace_once(
    payload,
    b"['/games/', 'Original cannabis games built to play, learn, compete, and share.']",
    b"['/games/', 'Pick what is playable. See what is coming next.']",
    "Games live-verification marker",
)
payload = replace_once(
    payload,
    b"['/tools/', 'Practical tools built around observation, records, and evidence.']",
    b"['/tools/', 'Measure it. Document it. Diagnose with context.']",
    "Tools live-verification marker",
)
payload = replace_once(
    payload,
    b"['/projects/', 'One place to see what is playable, usable, and still being built.']",
    b"['/projects/', 'What is live, what is growing, and where it belongs.']",
    "Projects live-verification marker",
)
payload = replace_once(
    payload,
    b"await verifyRoute('/', 'Genetics, cultivation education, practical tools, and original cannabis games.'",
    b"await verifyRoute('/', 'Genetics first. Learn the plant behind the pack.'",
    "Home live-verification marker",
)
payload = replace_once(
    payload,
    b"await verifyRoute('/learn/', 'Understand the plant. Build the environment. Make better decisions.'",
    b"await verifyRoute('/learn/', 'Teaching Healthy Cultivation'",
    "Learn ownership-verification marker",
)

# Transport hardening: keep the canonical guarded deployer intact, then widen
# only the read-retry window used to discover WordPress/plugin state. Hostinger
# occasionally drops a full TLS connection window even when the site and build
# are healthy. This makes publication resilient to that transient condition
# without changing write scope, authorization, archive limits, or rollback.
payload = replace_once(
    payload,
    b"""async function wpGetRetry(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) { last = error; await sleep(1000 + attempt * 900); }
  }
  throw last || new Error(`GET ${path} failed after retries.`);
}
""",
    b"""async function wpGetRetry(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 12; attempt++) {
    try { return await wpRequest(path, { ...options, method: 'GET' }); }
    catch (error) {
      last = error;
      const delay = Math.min(15000, 1200 + attempt * 1200);
      console.warn(`WordPress GET retry ${attempt}/12 for ${path}: ${error?.message || error}`);
      await sleep(delay);
    }
  }
  throw last || new Error(`GET ${path} failed after retries.`);
}
""",
    "WordPress GET transport retry window",
)

final_actual = hashlib.sha256(payload).hexdigest()
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(payload)
print(f"assembled={OUTPUT} bytes={len(payload)} base_sha256={base_actual} sha256={final_actual}")
