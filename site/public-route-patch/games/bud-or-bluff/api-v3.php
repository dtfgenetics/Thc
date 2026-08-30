<?php
declare(strict_types=1);

/**
 * Bud or Bluff production persistence bootstrap.
 *
 * The v2 game API intentionally supports a filesystem fallback when WordPress
 * cannot be resolved from its physical deployment path. On the transactional
 * DTFSeeds deploy, PHP's system temp directory is not a durable cross-request
 * room store, so create could succeed and the immediately following state
 * request could report the room missing. This wrapper gives the unchanged,
 * tested v2 API a stable private temp directory before it initializes.
 */

function bob_runtime_storage_dir(): string
{
    $documentRoot = trim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $candidates = [];

    if ($documentRoot !== '') {
        $realRoot = realpath($documentRoot) ?: $documentRoot;
        $candidates[] = dirname($realRoot) . '/.dtf-bud-or-bluff-runtime';
        $candidates[] = rtrim($realRoot, '/\\') . '/wp-content/uploads/.dtf-bud-or-bluff-runtime';
    }

    $candidates[] = __DIR__ . '/.dtf-bud-or-bluff-runtime';

    foreach (array_unique($candidates) as $candidate) {
        if (!is_dir($candidate) && !@mkdir($candidate, 0700, true) && !is_dir($candidate)) {
            continue;
        }
        if (!is_writable($candidate)) {
            continue;
        }

        $denyFile = $candidate . '/.htaccess';
        if (!is_file($denyFile)) {
            @file_put_contents(
                $denyFile,
                "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n",
                LOCK_EX
            );
        }
        return $candidate;
    }

    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    echo json_encode(['error' => 'Durable room storage is unavailable.'], JSON_UNESCAPED_SLASHES);
    exit;
}

$storageDir = bob_runtime_storage_dir();
putenv('TMPDIR=' . $storageDir);
header('X-DTF-Bud-Or-Bluff-Storage: durable-v3');

require __DIR__ . '/api-v2.php';
