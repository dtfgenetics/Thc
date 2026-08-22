#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import pathlib
import sys

# Canonical SHA-256 of the executable v2 deployer after guarded source
# normalizations below. Update only after the read-only semantic gate reports
# and validates the newly assembled payload.
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

actual = hashlib.sha256(payload).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f"v2 deployer fragment SHA-256 mismatch: expected {EXPECTED_SHA256}, got {actual}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(payload)
print(f"assembled={OUTPUT} bytes={len(payload)} sha256={actual}")
