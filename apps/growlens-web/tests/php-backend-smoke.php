<?php

declare(strict_types=1);

function smoke_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function remove_tree(string $path): void
{
    if (!is_dir($path)) {
        @unlink($path);
        return;
    }

    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $child = $path . DIRECTORY_SEPARATOR . $entry;
        is_dir($child) ? remove_tree($child) : @unlink($child);
    }
    @rmdir($path);
}

$testRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'growlens-api-test-' . bin2hex(random_bytes(6));
$documentRoot = $testRoot . DIRECTORY_SEPARATOR . 'public_html';
$privateRoot = $testRoot . DIRECTORY_SEPARATOR . 'private-data';
mkdir($documentRoot, 0700, true);

putenv('GROWLENS_DATA_DIR=' . $privateRoot);
putenv('GROWLENS_COOKIE_PATH=/growlens/');
$_SERVER['DOCUMENT_ROOT'] = $documentRoot;
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once dirname(__DIR__) . '/public/api/_shared.php';

try {
    $resolvedPrivateRoot = growlens_private_root();
    smoke_assert(is_dir($resolvedPrivateRoot), 'Private storage directory should be created.');
    smoke_assert(!str_starts_with($resolvedPrivateRoot, realpath($documentRoot) . DIRECTORY_SEPARATOR), 'Private storage must not be inside public_html.');

    $state = growlens_default_state();
    smoke_assert($state['schemaVersion'] === 1, 'Default state schema version should be 1.');
    smoke_assert(count($state['plants']) === 0, 'Default plant collection should be empty.');

    $user = growlens_create_user('grower@example.com', 'a-secure-test-password');
    smoke_assert(str_starts_with((string)$user['id'], 'user-'), 'Created user should have a stable private identifier.');
    smoke_assert(password_verify('a-secure-test-password', (string)$user['passwordHash']), 'Stored password must be hashed and verifiable.');

    $found = growlens_find_user_by_email('grower@example.com');
    smoke_assert(is_array($found), 'Email index should resolve the created user.');
    smoke_assert(hash_equals((string)$user['id'], (string)$found['id']), 'Email index should point to the correct user.');

    $state['spaces'][] = [
        'id' => 'space-test',
        'name' => 'Test Tent',
        'environment' => 'indoor',
        'lightHours' => 18,
        'createdAt' => growlens_now()
    ];
    $saved = growlens_save_user_data((string)$user['id'], $state, 0);
    smoke_assert($saved['revision'] === 1, 'First synchronized save should increment revision to 1.');

    $loaded = growlens_load_user_data((string)$user['id']);
    smoke_assert($loaded['revision'] === 1, 'Saved revision should persist.');
    smoke_assert(($loaded['state']['spaces'][0]['name'] ?? '') === 'Test Tent', 'Saved GrowLens state should round-trip.');

    fwrite(STDOUT, "GrowLens PHP backend smoke test passed.\n");
} finally {
    remove_tree($testRoot);
}
