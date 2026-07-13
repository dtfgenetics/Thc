<?php

declare(strict_types=1);

function v2_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function v2_remove_tree(string $path): void
{
    if (!is_dir($path)) {
        @unlink($path);
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $child = $path . DIRECTORY_SEPARATOR . $entry;
        is_dir($child) ? v2_remove_tree($child) : @unlink($child);
    }
    @rmdir($path);
}

$testRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'growlens-state-v2-test-' . bin2hex(random_bytes(6));
$documentRoot = $testRoot . DIRECTORY_SEPARATOR . 'public_html';
$privateRoot = $testRoot . DIRECTORY_SEPARATOR . 'private-data';
mkdir($documentRoot, 0700, true);

putenv('GROWLENS_DATA_DIR=' . $privateRoot);
putenv('GROWLENS_COOKIE_PATH=/growlens/');
$_SERVER['DOCUMENT_ROOT'] = $documentRoot;
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once dirname(__DIR__) . '/public/api/_state-v2.php';

try {
    $state = growlens_v2_default_state();
    v2_assert($state['schemaVersion'] === 2, 'Schema-v2 default state should report version 2.');
    foreach (growlens_v2_collections() as $collection) {
        v2_assert(array_key_exists($collection, $state), 'Default state should include ' . $collection . '.');
        v2_assert($state[$collection] === [], $collection . ' should start empty.');
    }

    $user = growlens_create_user('schema-v2@example.com', 'a-secure-schema-v2-password');
    $userId = (string)$user['id'];

    $legacy = [
        'revision' => 0,
        'updatedAt' => growlens_now(),
        'state' => [
            'schemaVersion' => 1,
            'plants' => [['id' => 'plant-legacy', 'name' => 'Legacy plant']],
            'diary' => [['id' => 'entry-legacy', 'title' => 'Legacy note']]
        ]
    ];
    growlens_atomic_write_json(growlens_data_path($userId), $legacy);

    $migrated = growlens_v2_load_user_data($userId);
    v2_assert($migrated['state']['schemaVersion'] === 2, 'Legacy account state should migrate on read.');
    v2_assert(count($migrated['state']['plants']) === 1, 'Legacy plants should survive migration.');
    v2_assert(count($migrated['state']['diary']) === 1, 'Legacy diary should survive migration.');
    v2_assert($migrated['state']['irrigationRecords'] === [], 'New collections should be initialized during migration.');

    $state = $migrated['state'];
    $state['irrigationRecords'][] = [
        'id' => 'irrigation-test-12345678',
        'plantId' => 'plant-legacy',
        'volumeAppliedMl' => 1500,
        'runoffVolumeMl' => 225,
        'inputPh' => 6.2,
        'inputEcMsCm' => 1.8,
        'createdAt' => growlens_now(),
        'updatedAt' => growlens_now()
    ];
    $state['feedingRecords'][] = [
        'id' => 'feeding-test-12345678',
        'plantId' => 'plant-legacy',
        'waterVolumeMl' => 4000,
        'finalPh' => 6.1,
        'finalEcMsCm' => 1.9,
        'createdAt' => growlens_now(),
        'updatedAt' => growlens_now()
    ];
    $state['harvestRecords'][] = [
        'id' => 'harvest-test-12345678',
        'plantId' => 'plant-legacy',
        'harvestDate' => gmdate('Y-m-d'),
        'trimmedWeightG' => 120,
        'createdAt' => growlens_now(),
        'updatedAt' => growlens_now()
    ];

    $saved = growlens_v2_save_user_data($userId, $state, 0);
    v2_assert($saved['revision'] === 1, 'Schema-v2 save should increment the revision.');
    v2_assert(count($saved['state']['irrigationRecords']) === 1, 'Irrigation records should persist.');
    v2_assert(count($saved['state']['feedingRecords']) === 1, 'Feeding records should persist.');
    v2_assert(count($saved['state']['harvestRecords']) === 1, 'Harvest records should persist.');

    $loaded = growlens_v2_load_user_data($userId);
    v2_assert(($loaded['state']['irrigationRecords'][0]['volumeAppliedMl'] ?? 0) === 1500, 'Structured records should round-trip from private storage.');
    v2_assert(count($loaded['state']['plants']) === 1, 'Existing records must remain after a schema-v2 save.');

    fwrite(STDOUT, "GrowLens schema-v2 PHP smoke test passed.\n");
} finally {
    v2_remove_tree($testRoot);
}
