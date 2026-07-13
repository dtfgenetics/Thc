<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

const GROWLENS_STORAGE_LOCK_WAIT_MS = 15000;

/**
 * Hold a shared request lock for the lifetime of the PHP request.
 *
 * The private-data snapshot command takes an exclusive lock on the same file.
 * This prevents a backup from observing a half-finished multi-file operation
 * while still allowing normal GrowLens requests to run concurrently.
 */
function growlens_begin_storage_access(int $waitMilliseconds = GROWLENS_STORAGE_LOCK_WAIT_MS): void
{
    static $handle = null;
    if (is_resource($handle)) {
        return;
    }

    $path = growlens_private_root() . DIRECTORY_SEPARATOR . 'operations.lock';
    $lock = fopen($path, 'c');
    if ($lock === false) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Private storage coordination is unavailable.'
        ], 503);
    }
    @chmod($path, 0600);

    $deadline = microtime(true) + (max(100, $waitMilliseconds) / 1000);
    $acquired = false;
    do {
        if (flock($lock, LOCK_SH | LOCK_NB)) {
            $acquired = true;
            break;
        }
        usleep(100000);
    } while (microtime(true) < $deadline);

    if (!$acquired) {
        fclose($lock);
        header('Retry-After: 5');
        growlens_send_json([
            'ok' => false,
            'error' => 'GrowLens storage is temporarily paused for a verified backup.'
        ], 503);
    }

    $handle = $lock;
    register_shutdown_function(static function () use ($lock): void {
        if (is_resource($lock)) {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    });
}
