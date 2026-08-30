#!/usr/bin/env python3
"""Synchronize and harden the WordPress Public Suite bridge.

The canonical bridge remains hash-pinned. This module is applied only after that
base hash passes. It performs three narrow post-hash operations:

1. harden the upload/commit lease so the same untouched transaction can recover
   when Hostinger/WordPress temporarily loses visibility of its option-backed
   deployment lock between requests;
2. derive only local, static, ready-to-package game routes from the canonical
   public-app registry and widen the bridge with those exact directories; and
3. allow one isolated Dtf420 staging namespace (`dtf-content-overlay`) that can
   never directly claim `/learn`, `/community`, `/games`, or the site root.

No wildcard games/ or learn/ ownership is permitted, and lock recovery is
forbidden after live-target mutation has begun or when a different deployment
owns the lock.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

SAFE_TARGET = re.compile(r"^games/[a-z0-9][a-z0-9-]*$")
OVERLAY_TARGET = "dtf-content-overlay"
OVERLAY_REQUIRED = "dtf-content-overlay/overlay-manifest.json"
OVERLAY_PREFIX = "dtf-content-overlay/"


def _replace_once(payload: bytes, old: bytes, new: bytes, label: str) -> bytes:
    count = payload.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} anchor, found {count}")
    return payload.replace(old, new, 1)


def _apply_upload_lock_recovery(payload: bytes) -> bytes:
    """Allow safe lease recovery only before a deployment mutates live targets."""
    old_chunk_prefix = b"""        'callback' => static function (WP_REST_Request $r) use ($safe_id, $safe_sha, $owns_lock, $state_key) {
            $id = (string) $r->get_param('deployment_id');
            $offset = (int) $r->get_param('offset');
            $chunk_sha = strtolower((string) $r->get_param('chunk_sha256'));
            $b64 = (string) $r->get_param('data_b64');
            if (!$safe_id($id) || !$safe_sha($chunk_sha) || !$owns_lock($id)) return new WP_Error('dtf_bad_chunk', 'Invalid or unlocked chunk.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || ($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_chunk_state', 'Deployment is not accepting chunks.', ['status' => 409]);
"""
    new_chunk_prefix = b"""        'callback' => static function (WP_REST_Request $r) use ($safe_id, $safe_sha, $owns_lock, $state_key, $lock_key) {
            $id = (string) $r->get_param('deployment_id');
            $offset = (int) $r->get_param('offset');
            $chunk_sha = strtolower((string) $r->get_param('chunk_sha256'));
            $b64 = (string) $r->get_param('data_b64');
            if (!$safe_id($id) || !$safe_sha($chunk_sha)) return new WP_Error('dtf_bad_chunk', 'Invalid chunk metadata.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || ($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_chunk_state', 'Deployment is not accepting chunks.', ['status' => 409]);
            $lock_recovered = false;
            if (!$owns_lock($id)) {
                if (function_exists('wp_cache_delete')) wp_cache_delete($lock_key, 'options');
                $lock = get_option($lock_key, []);
                $lock_id = is_array($lock) ? (string) ($lock['id'] ?? '') : '';
                $untouched = empty($state['current']) && (!is_array($state['applied'] ?? null) || count($state['applied']) === 0);
                if (!$untouched) return new WP_Error('dtf_bad_chunk', 'Deployment lock was lost after mutation began.', ['status' => 409]);
                if ($lock_id !== '' && $lock_id !== $id) return new WP_Error('dtf_bad_chunk', 'A different deployment owns the server lock.', ['status' => 409, 'lock_id' => $lock_id]);
                if ($lock_id === '') {
                    if (!add_option($lock_key, ['id' => $id, 'ts' => time()], '', false)) {
                        if (function_exists('wp_cache_delete')) wp_cache_delete($lock_key, 'options');
                        $lock = get_option($lock_key, []);
                        if (!is_array($lock) || ($lock['id'] ?? '') !== $id) return new WP_Error('dtf_bad_chunk', 'Could not safely reacquire deployment lock.', ['status' => 409]);
                    }
                    $lock_recovered = true;
                }
            }
            update_option($lock_key, ['id' => $id, 'ts' => time()], false);
"""
    payload = _replace_once(payload, old_chunk_prefix, new_chunk_prefix, "upload lock recovery")

    old_chunk_tail = b"""            $state['uploaded_bytes'] = (int) filesize($part);
            update_option($state_key($id), $state, false);
            return rest_ensure_response(['ok'=>true,'uploaded_bytes'=>$state['uploaded_bytes']]);
"""
    new_chunk_tail = b"""            $state['uploaded_bytes'] = (int) filesize($part);
            if ($lock_recovered) $state['lock_recovered_at'] = gmdate('c');
            update_option($state_key($id), $state, false);
            update_option($lock_key, ['id' => $id, 'ts' => time()], false);
            return rest_ensure_response(['ok'=>true,'uploaded_bytes'=>$state['uploaded_bytes'],'lock_recovered'=>$lock_recovered]);
"""
    payload = _replace_once(payload, old_chunk_tail, new_chunk_tail, "upload lock lease refresh")

    old_commit_prefix = b"""            $id = (string) $r->get_param('deployment_id');
            if (!$safe_id($id) || !$owns_lock($id)) return new WP_Error('dtf_bad_commit', 'Invalid or unlocked deployment.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state)) return new WP_Error('dtf_missing_state', 'Deployment state is missing.', ['status' => 404]);
            if (($state['status'] ?? '') === 'deployed') return rest_ensure_response(['ok'=>true,'status'=>'deployed','recovered'=>true]);
            if (($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_commit_state', 'Deployment cannot commit from current state.', ['status' => 409]);
"""
    new_commit_prefix = b"""            $id = (string) $r->get_param('deployment_id');
            if (!$safe_id($id)) return new WP_Error('dtf_bad_commit', 'Invalid deployment identifier.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state)) return new WP_Error('dtf_missing_state', 'Deployment state is missing.', ['status' => 404]);
            if (($state['status'] ?? '') === 'deployed') return rest_ensure_response(['ok'=>true,'status'=>'deployed','recovered'=>true]);
            if (($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_commit_state', 'Deployment cannot commit from current state.', ['status' => 409]);
            if (!$owns_lock($id)) {
                if (function_exists('wp_cache_delete')) wp_cache_delete($lock_key, 'options');
                $lock = get_option($lock_key, []);
                $lock_id = is_array($lock) ? (string) ($lock['id'] ?? '') : '';
                $untouched = empty($state['current']) && (!is_array($state['applied'] ?? null) || count($state['applied']) === 0);
                if (!$untouched) return new WP_Error('dtf_bad_commit', 'Deployment lock was lost after mutation began.', ['status' => 409]);
                if ($lock_id !== '' && $lock_id !== $id) return new WP_Error('dtf_bad_commit', 'A different deployment owns the server lock.', ['status' => 409, 'lock_id' => $lock_id]);
                if ($lock_id === '' && !add_option($lock_key, ['id' => $id, 'ts' => time()], '', false)) {
                    if (function_exists('wp_cache_delete')) wp_cache_delete($lock_key, 'options');
                    $lock = get_option($lock_key, []);
                    if (!is_array($lock) || ($lock['id'] ?? '') !== $id) return new WP_Error('dtf_bad_commit', 'Could not safely reacquire deployment lock.', ['status' => 409]);
                }
            }
            update_option($lock_key, ['id' => $id, 'ts' => time()], false);
"""
    payload = _replace_once(payload, old_commit_prefix, new_commit_prefix, "commit lock recovery")
    return payload


def _apply_overlay_staging_scope(payload: bytes) -> bytes:
    """Permit only the isolated overlay staging directory, never direct child routes."""
    targets = _array_values(payload, b"targets")
    if OVERLAY_TARGET not in targets:
        payload = _replace_once(
            payload,
            b"        'games/index.html','games/dtf-route.css','games/dtf-shell.css','games/high-land'",
            b"        'games/index.html','games/dtf-route.css','games/dtf-shell.css','dtf-content-overlay','games/high-land'",
            "Dtf420 overlay staging target",
        )

    required = _array_values(payload, b"required")
    if OVERLAY_REQUIRED not in required:
        payload = _replace_once(
            payload,
            b"        'games/index.html','games/dtf-shell.css','games/high-land/index.html'",
            b"        'games/index.html','games/dtf-shell.css','dtf-content-overlay/overlay-manifest.json','games/high-land/index.html'",
            "Dtf420 overlay required manifest",
        )

    prefixes = _array_values(payload, b"prefixes")
    if OVERLAY_PREFIX not in prefixes:
        payload = _replace_once(
            payload,
            b"        'games/high-land/','games/high-iq/'",
            b"        'dtf-content-overlay/','games/high-land/','games/high-iq/'",
            "Dtf420 overlay staging prefix",
        )

    return payload


def registered_local_static_games(repo_root: pathlib.Path) -> list[str]:
    registry_path = repo_root / "site" / "deployment" / "public-apps.json"
    registry = json.loads(registry_path.read_text())
    targets: list[str] = []
    for app in registry.get("apps", []):
        source = str(app.get("sourcePath") or "").rstrip("/")
        route = str(app.get("route") or "")
        if not (
            app.get("repository") == "dtfgenetics/Thc"
            and app.get("runtime") == "static"
            and app.get("status") == "ready-to-package"
            and source.startswith("site/public-route-patch/games/")
            and route.startswith("/games/")
            and route.endswith("/")
        ):
            continue
        target = route.strip("/")
        if not SAFE_TARGET.fullmatch(target):
            raise SystemExit(f"unsafe registered local game target: {target!r}")
        expected_source = f"site/public-route-patch/{target}"
        if source != expected_source:
            raise SystemExit(
                f"registry source/route mismatch for {target}: source={source!r}, expected={expected_source!r}"
            )
        targets.append(target)
    if len(targets) != len(set(targets)):
        raise SystemExit("duplicate local static game targets in public-apps registry")
    return sorted(targets)


def _array_values(payload: bytes, variable: bytes) -> set[str]:
    pattern = rb"\$" + re.escape(variable) + rb"\s*=\s*\[(.*?)\n\s*\];"
    match = re.search(pattern, payload, re.S)
    if not match:
        raise SystemExit(f"bridge array ${variable.decode()} not found")
    return {item.decode() for item in re.findall(rb"'([^']+)'", match.group(1))}


def patch_payload(payload: bytes, repo_root: pathlib.Path) -> bytes:
    payload = _apply_upload_lock_recovery(payload)
    payload = _apply_overlay_staging_scope(payload)
    registry_targets = registered_local_static_games(repo_root)

    existing_targets = _array_values(payload, b"targets")
    missing_targets = [target for target in registry_targets if target not in existing_targets]
    if missing_targets:
        insertion = "        " + ",".join(repr(target) for target in missing_targets) + ",\n"
        payload = _replace_once(
            payload,
            b"        'growlens','thc-grow-doc','tools','projects','puzzles'\n",
            insertion.encode() + b"        'growlens','thc-grow-doc','tools','projects','puzzles'\n",
            "registry target tail",
        )

    existing_required = _array_values(payload, b"required")
    missing_required = [f"{target}/index.html" for target in registry_targets if f"{target}/index.html" not in existing_required]
    if missing_required:
        insertion = "        " + ",".join(repr(path) for path in missing_required) + ",\n"
        payload = _replace_once(
            payload,
            b"        'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n",
            insertion.encode() + b"        'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n",
            "registry required-file tail",
        )

    existing_prefixes = _array_values(payload, b"prefixes")
    missing_prefixes = [f"{target}/" for target in registry_targets if f"{target}/" not in existing_prefixes]
    if missing_prefixes:
        insertion = ",".join(repr(prefix) for prefix in missing_prefixes) + ","
        payload = _replace_once(
            payload,
            b"'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/'",
            insertion.encode() + b"'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/'",
            "registry prefix tail",
        )

    targets = _array_values(payload, b"targets")
    required = _array_values(payload, b"required")
    prefixes = _array_values(payload, b"prefixes")
    for target in registry_targets:
        if target not in targets:
            raise SystemExit(f"bridge target missing after registry patch: {target}")
        if f"{target}/index.html" not in required:
            raise SystemExit(f"bridge required index missing after registry patch: {target}/index.html")
        if f"{target}/" not in prefixes:
            raise SystemExit(f"bridge prefix missing after registry patch: {target}/")

    if OVERLAY_TARGET not in targets or OVERLAY_REQUIRED not in required or OVERLAY_PREFIX not in prefixes:
        raise SystemExit("isolated Dtf420 overlay staging scope is missing from bridge")
    if "games/" in prefixes or "learn/" in prefixes:
        raise SystemExit("unsafe broad game/learn prefix is forbidden")
    for forbidden in ("index.html", "learn", "blog", "community", "games"):
        if forbidden in targets:
            raise SystemExit(f"WordPress-owned target entered bridge: {forbidden}")

    return payload


def validate_payload(payload: bytes, repo_root: pathlib.Path) -> dict[str, object]:
    registry_targets = registered_local_static_games(repo_root)
    targets = _array_values(payload, b"targets")
    required = _array_values(payload, b"required")
    prefixes = _array_values(payload, b"prefixes")
    missing = []
    for target in registry_targets:
        if target not in targets:
            missing.append(target)
        if f"{target}/index.html" not in required:
            missing.append(f"{target}/index.html")
        if f"{target}/" not in prefixes:
            missing.append(f"{target}/")
    for value, collection in (
        (OVERLAY_TARGET, targets),
        (OVERLAY_REQUIRED, required),
        (OVERLAY_PREFIX, prefixes),
    ):
        if value not in collection:
            missing.append(value)
    if missing:
        raise SystemExit("bridge/registry parity failure: " + ", ".join(missing))
    if "games/" in prefixes or "learn/" in prefixes:
        raise SystemExit("unsafe broad game/learn prefix is forbidden")

    lock_markers = (
        b"$lock_recovered = false;",
        b"Could not safely reacquire deployment lock.",
        b"'lock_recovered'=>$lock_recovered",
        b"Invalid deployment identifier.",
    )
    absent_lock_markers = [marker.decode() for marker in lock_markers if marker not in payload]
    if absent_lock_markers:
        raise SystemExit("bridge upload-lock recovery missing: " + ", ".join(absent_lock_markers))

    return {
        "ok": True,
        "lockRecovery": True,
        "dtf420OverlayStaging": True,
        "registeredLocalStaticGames": registry_targets,
        "targets": len(targets),
        "required": len(required),
        "prefixes": len(prefixes),
    }


def main() -> None:
    repo_root = pathlib.Path(__file__).resolve().parents[1]
    if len(sys.argv) != 2:
        raise SystemExit("usage: wordpress_suite_registry_patch.py ASSEMBLED_DEPLOYER")
    path = pathlib.Path(sys.argv[1])
    payload = path.read_bytes()
    report = validate_payload(payload, repo_root)
    print(json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
