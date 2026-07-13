<?php
/**
 * GrowLens schema-version 2 state helpers.
 *
 * This adapter is intentionally separate from the authentication and storage
 * helpers so existing accounts can be migrated on read without rewriting user,
 * session, or image records. All writes use the same revision lock and private
 * data path as the original API.
 */

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

function growlens_v2_collections(): array
{
    return [
        'spaces',
        'cycles',
        'plants',
        'diary',
        'tasks',
        'readings',
        'calibrationProfiles',
        'observations',
        'irrigationRecords',
        'feedingRecords',
        'reservoirRecords',
        'harvestRecords',
        'observationOutcomes'
    ];
}

function growlens_v2_default_state(): array
{
    $state = ['schemaVersion' => 2];
    foreach (growlens_v2_collections() as $collection) {
        $state[$collection] = [];
    }
    return $state;
}

function growlens_v2_validate_state($state): array
{
    if (!is_array($state)) {
        growlens_send_json(['ok' => false, 'error' => 'Grow state must be an object.'], 400);
    }

    $normalized = ['schemaVersion' => 2];
    foreach (growlens_v2_collections() as $collection) {
        $records = $state[$collection] ?? [];
        if (!is_array($records) || count($records) > GROWLENS_MAX_RECORDS_PER_COLLECTION) {
            growlens_send_json([
                'ok' => false,
                'error' => 'Invalid or oversized collection: ' . $collection
            ], 400);
        }
        foreach ($records as $record) {
            if (!is_array($record)) {
                growlens_send_json([
                    'ok' => false,
                    'error' => 'Invalid record in collection: ' . $collection
                ], 400);
            }
        }
        $normalized[$collection] = array_values($records);
    }

    $encoded = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) > GROWLENS_MAX_STATE_BYTES) {
        growlens_send_json(['ok' => false, 'error' => 'Grow state is too large.'], 413);
    }

    return $normalized;
}

function growlens_v2_load_user_data(string $userId): array
{
    $data = growlens_read_json_file(growlens_data_path($userId));
    if (!is_array($data)) {
        return [
            'revision' => 0,
            'updatedAt' => growlens_now(),
            'state' => growlens_v2_default_state()
        ];
    }

    return [
        'revision' => max(0, (int)($data['revision'] ?? 0)),
        'updatedAt' => (string)($data['updatedAt'] ?? growlens_now()),
        'state' => growlens_v2_validate_state($data['state'] ?? [])
    ];
}

function growlens_v2_save_user_data(string $userId, array $state, int $expectedRevision): array
{
    $path = growlens_data_path($userId);
    $lock = fopen($path . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            fclose($lock);
        }
        growlens_send_json(['ok' => false, 'error' => 'Could not lock grow data.'], 500);
    }

    $current = growlens_read_json_file($path) ?? [
        'revision' => 0,
        'updatedAt' => growlens_now(),
        'state' => growlens_v2_default_state()
    ];
    $currentRevision = max(0, (int)($current['revision'] ?? 0));
    if ($expectedRevision !== $currentRevision) {
        flock($lock, LOCK_UN);
        fclose($lock);
        growlens_send_json([
            'ok' => false,
            'error' => 'Sync conflict.',
            'conflict' => true,
            'revision' => $currentRevision,
            'updatedAt' => (string)($current['updatedAt'] ?? '')
        ], 409);
    }

    $next = [
        'revision' => $currentRevision + 1,
        'updatedAt' => growlens_now(),
        'state' => growlens_v2_validate_state($state)
    ];
    $encoded = json_encode($next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false || file_put_contents($path, $encoded, LOCK_EX) === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        growlens_send_json(['ok' => false, 'error' => 'Could not save grow data.'], 500);
    }
    @chmod($path, 0600);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $next;
}
