#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "deploy-public-suite-v2.mjs")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label} block, found {count}")
    text = text.replace(old, new, 1)


def replace_once_or_present(old: str, new: str, label: str, marker: str) -> None:
    global text
    if marker in text:
        return
    replace_once(old, new, label)


# Hostinger can occasionally lose visibility of the small WordPress option used
# as the deployment lease between /init and a following /chunk request. Recover
# only when the persisted transaction belongs to this deployment, is still in
# the non-mutating upload phase, and no different lock holder is visible. This
# keeps the deployment serialized while allowing a safe lease to be reacquired.
old_chunk_prefix = """        'callback' => static function (WP_REST_Request $r) use ($safe_id, $safe_sha, $owns_lock, $state_key) {
            $id = (string) $r->get_param('deployment_id');
            $offset = (int) $r->get_param('offset');
            $chunk_sha = strtolower((string) $r->get_param('chunk_sha256'));
            $b64 = (string) $r->get_param('data_b64');
            if (!$safe_id($id) || !$safe_sha($chunk_sha) || !$owns_lock($id)) return new WP_Error('dtf_bad_chunk', 'Invalid or unlocked chunk.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state) || ($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_chunk_state', 'Deployment is not accepting chunks.', ['status' => 409]);
"""
new_chunk_prefix = """        'callback' => static function (WP_REST_Request $r) use ($safe_id, $safe_sha, $owns_lock, $state_key, $lock_key) {
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
replace_once_or_present(
    old_chunk_prefix,
    new_chunk_prefix,
    "upload lock recovery",
    "$lock_recovered = false;",
)

old_chunk_tail = """            $state['uploaded_bytes'] = (int) filesize($part);
            update_option($state_key($id), $state, false);
            return rest_ensure_response(['ok'=>true,'uploaded_bytes'=>$state['uploaded_bytes']]);
"""
new_chunk_tail = """            $state['uploaded_bytes'] = (int) filesize($part);
            if ($lock_recovered) $state['lock_recovered_at'] = gmdate('c');
            update_option($state_key($id), $state, false);
            update_option($lock_key, ['id' => $id, 'ts' => time()], false);
            return rest_ensure_response(['ok'=>true,'uploaded_bytes'=>$state['uploaded_bytes'],'lock_recovered'=>$lock_recovered]);
"""
replace_once_or_present(
    old_chunk_tail,
    new_chunk_tail,
    "upload lock lease refresh",
    "'lock_recovered'=>$lock_recovered",
)

# Make commit idempotent and give it the same safe pre-mutation lease recovery.
# The archive has already been fully hashed at this point; we still refuse to
# reacquire if any different deployment holds the lock or this transaction has
# already begun mutating live targets.
old_commit_prefix = """            $id = (string) $r->get_param('deployment_id');
            if (!$safe_id($id) || !$owns_lock($id)) return new WP_Error('dtf_bad_commit', 'Invalid or unlocked deployment.', ['status' => 400]);
            $state = get_option($state_key($id), []);
            if (!is_array($state)) return new WP_Error('dtf_missing_state', 'Deployment state is missing.', ['status' => 404]);
            if (($state['status'] ?? '') === 'deployed') return rest_ensure_response(['ok'=>true,'status'=>'deployed','recovered'=>true]);
            if (($state['status'] ?? '') !== 'uploading') return new WP_Error('dtf_commit_state', 'Deployment cannot commit from current state.', ['status' => 409]);
"""
new_commit_prefix = """            $id = (string) $r->get_param('deployment_id');
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
replace_once_or_present(
    old_commit_prefix,
    new_commit_prefix,
    "commit lock recovery",
    "Invalid deployment identifier.",
)

# The canonical deploy workflow currently adds Atlas to the generated bridge
# after assembly. The recovery publisher must preserve the exact same scope so
# the app-only archive and bridge agree about every production target.
atlas_replacements = [
    (
        "'growlens','thc-grow-doc','tools','projects','puzzles'\n    ];",
        "'growlens','thc-grow-doc','tools','projects','puzzles','atlas','assets/images/atlas'\n    ];",
        "Atlas deployment target allowlist",
        "'atlas','assets/images/atlas'",
    ),
    (
        "'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json'\n    ];",
        "'thc-grow-doc/api/visual-observations.php','tools/index.html','projects/index.html','puzzles/current.json',\n        'atlas/index.html','atlas/root-system/index.html','atlas/root-system/rhizosphere/index.html','atlas/downloads/index.html',\n        'assets/images/atlas/root-system/rhizosphere-microbe-interaction.svg'\n    ];",
        "Atlas required-file allowlist",
        "'atlas/root-system/rhizosphere/index.html'",
    ),
    (
        "'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/','thc-grow-doc/','tools/','projects/','puzzles/'\n    ];",
        "'games/protect-the-plants/','games/weedopolis/','games/crossword/','games/who-took-it/','growlens/','thc-grow-doc/','tools/','projects/','puzzles/',\n        'atlas/','assets/images/atlas/'\n    ];",
        "Atlas prefix allowlist",
        "'assets/images/atlas/'",
    ),
]
for old, new, label, marker in atlas_replacements:
    replace_once_or_present(old, new, label, marker)

required_markers = [
    "$lock_recovered = false;",
    "Could not safely reacquire deployment lock.",
    "update_option($lock_key, ['id' => $id, 'ts' => time()], false);",
    "'lock_recovered'=>$lock_recovered",
    "'atlas','assets/images/atlas'",
]
missing = [marker for marker in required_markers if marker not in text]
if missing:
    raise SystemExit(f"Hardened deployer is missing required markers: {missing}")

path.write_text(text)
print(f"hardened={path} bytes={path.stat().st_size}")
