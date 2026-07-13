<?php

declare(strict_types=1);

function private_tools_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function private_tools_remove_tree(string $path): void
{
    if (!file_exists($path) && !is_link($path)) {
        return;
    }
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        private_tools_remove_tree($path . DIRECTORY_SEPARATOR . $entry);
    }
    @rmdir($path);
}

function private_tools_run(array $command, ?array $environment = null): array
{
    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];
    $process = proc_open($command, $descriptorSpec, $pipes, null, $environment);
    if (!is_resource($process)) {
        throw new RuntimeException('Could not start private-data command.');
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
    return [
        'exitCode' => $exitCode,
        'stdout' => is_string($stdout) ? $stdout : '',
        'stderr' => is_string($stderr) ? $stderr : ''
    ];
}

function private_tools_decode_json(string $value, string $label): array
{
    try {
        $decoded = json_decode(trim($value), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException($label . ' did not return valid JSON: ' . $value, 0, $error);
    }
    if (!is_array($decoded)) {
        throw new RuntimeException($label . ' returned a non-object JSON value.');
    }
    return $decoded;
}

$testRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'growlens-private-tools-' . bin2hex(random_bytes(6));
$privateRoot = $testRoot . DIRECTORY_SEPARATOR . 'private-data';
$snapshotRoot = $testRoot . DIRECTORY_SEPARATOR . 'snapshot';
$restoreRoot = $testRoot . DIRECTORY_SEPARATOR . 'restored';
$archivePath = $testRoot . DIRECTORY_SEPARATOR . 'snapshot.tar.gz';
$childScript = $testRoot . DIRECTORY_SEPARATOR . 'hold-shared-lock.php';
$readyPath = $testRoot . DIRECTORY_SEPARATOR . 'shared-lock-ready';
$apiRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'api';
$scriptRoot = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'scripts';

mkdir($testRoot, 0700, true);
mkdir($privateRoot, 0700, true);
putenv('GROWLENS_DATA_DIR=' . $privateRoot);
$_SERVER['DOCUMENT_ROOT'] = $testRoot . DIRECTORY_SEPARATOR . 'document-root';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
mkdir($_SERVER['DOCUMENT_ROOT'], 0700, true);

require_once $apiRoot . DIRECTORY_SEPARATOR . '_images.php';

$userId = 'user-' . str_repeat('a', 32);
$email = 'restore-smoke@example.com';
$photoId = 'photo-restore-smoke-12345678';
$now = growlens_now();

try {
    $user = [
        'id' => $userId,
        'email' => $email,
        'passwordHash' => password_hash('Restore-Smoke-Test-Password-123!', PASSWORD_DEFAULT),
        'createdAt' => $now,
        'updatedAt' => $now
    ];
    growlens_atomic_write_json(growlens_user_path($userId), $user);
    growlens_atomic_write_json(growlens_email_index_path($email), ['userId' => $userId]);

    $state = growlens_empty_state();
    $state['spaces'][] = [
        'id' => 'space-restore-smoke',
        'name' => 'Restore smoke space',
        'environment' => 'indoor',
        'lightHours' => 18,
        'createdAt' => $now
    ];
    $state['plants'][] = [
        'id' => 'plant-restore-smoke',
        'name' => 'Restore smoke plant',
        'strain' => 'Test cultivar',
        'stage' => 'vegetative',
        'status' => 'active',
        'spaceId' => 'space-restore-smoke',
        'cycleId' => '',
        'startDate' => substr($now, 0, 10),
        'notes' => '',
        'createdAt' => $now
    ];
    $state['observations'][] = [
        'id' => 'observation-restore-smoke',
        'plantId' => 'plant-restore-smoke',
        'symptoms' => ['test'],
        'notes' => 'Restore smoke image.',
        'possibleCauses' => ['Test only'],
        'photoIds' => [$photoId],
        'createdAt' => $now
    ];
    growlens_atomic_write_json(growlens_data_path($userId), [
        'revision' => 3,
        'updatedAt' => $now,
        'state' => $state
    ]);

    $sessionToken = str_repeat('b', 64);
    growlens_atomic_write_json(growlens_session_path($sessionToken), [
        'userId' => $userId,
        'csrfToken' => str_repeat('c', 43),
        'createdAt' => $now,
        'lastSeenAt' => $now,
        'expiresAt' => time() + 3600
    ]);

    $imageDirectory = growlens_user_image_dir($userId);
    $imageBytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    private_tools_assert(is_string($imageBytes), 'PNG fixture should decode.');
    $imagePath = $imageDirectory . DIRECTORY_SEPARATOR . $photoId . '.png';
    file_put_contents($imagePath, $imageBytes, LOCK_EX);
    @chmod($imagePath, 0600);
    growlens_atomic_write_json(growlens_image_metadata_path($userId, $photoId), [
        'id' => $photoId,
        'plantId' => 'plant-restore-smoke',
        'observationId' => 'observation-restore-smoke',
        'capturedAt' => $now,
        'mimeType' => 'image/png',
        'extension' => 'png',
        'width' => 1,
        'height' => 1,
        'bytes' => strlen($imageBytes),
        'createdAt' => $now
    ]);

    $rateDirectory = growlens_path('rate');
    file_put_contents($rateDirectory . DIRECTORY_SEPARATOR . 'excluded-rate.json', '{}');
    @chmod($rateDirectory . DIRECTORY_SEPARATOR . 'excluded-rate.json', 0600);
    file_put_contents(growlens_path('data', $userId . '.account.lock'), 'excluded');
    @chmod(growlens_path('data', $userId . '.account.lock'), 0600);

    $childSource = <<<'PHP'
<?php
$privateRoot = $argv[1];
$readyPath = $argv[2];
putenv('GROWLENS_DATA_DIR=' . $privateRoot);
$_SERVER['DOCUMENT_ROOT'] = dirname($privateRoot) . DIRECTORY_SEPARATOR . 'document-root';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once $argv[3];
growlens_begin_storage_access();
file_put_contents($readyPath, 'ready', LOCK_EX);
usleep(1400000);
PHP;
    file_put_contents($childScript, $childSource, LOCK_EX);
    @chmod($childScript, 0600);

    $descriptorSpec = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];
    $holder = proc_open([
        PHP_BINARY,
        $childScript,
        $privateRoot,
        $readyPath,
        $apiRoot . DIRECTORY_SEPARATOR . '_operations.php'
    ], $descriptorSpec, $holderPipes);
    private_tools_assert(is_resource($holder), 'Shared-lock holder should start.');
    fclose($holderPipes[0]);

    $deadline = microtime(true) + 5;
    while (!is_file($readyPath) && microtime(true) < $deadline) {
        usleep(25000);
    }
    private_tools_assert(is_file($readyPath), 'Shared-lock holder should signal readiness.');

    $snapshotStarted = microtime(true);
    $snapshot = private_tools_run([
        PHP_BINARY,
        $scriptRoot . DIRECTORY_SEPARATOR . 'growlens-private-data-snapshot.php',
        '--source=' . $privateRoot,
        '--destination=' . $snapshotRoot,
        '--commit=' . str_repeat('d', 40),
        '--max-bytes=10485760',
        '--lock-wait-seconds=10'
    ]);
    $snapshotElapsed = microtime(true) - $snapshotStarted;
    $holderStdout = stream_get_contents($holderPipes[1]);
    $holderStderr = stream_get_contents($holderPipes[2]);
    fclose($holderPipes[1]);
    fclose($holderPipes[2]);
    $holderExit = proc_close($holder);

    private_tools_assert($holderExit === 0, 'Shared-lock holder should exit cleanly: ' . $holderStdout . $holderStderr);
    private_tools_assert($snapshot['exitCode'] === 0, 'Snapshot should pass: ' . $snapshot['stderr']);
    private_tools_assert($snapshotElapsed >= 1.0, 'Snapshot should wait for the active shared request lock.');
    $snapshotSummary = private_tools_decode_json($snapshot['stdout'], 'Snapshot command');
    private_tools_assert(($snapshotSummary['ok'] ?? false) === true, 'Snapshot summary should report success.');
    private_tools_assert(is_file($snapshotRoot . DIRECTORY_SEPARATOR . 'manifest.json'), 'Snapshot manifest should exist.');
    private_tools_assert(!is_dir($snapshotRoot . DIRECTORY_SEPARATOR . 'rate'), 'Rate-limit data must be excluded from snapshots.');
    private_tools_assert(!is_file($snapshotRoot . DIRECTORY_SEPARATOR . 'operations.lock'), 'Operations lock must be excluded from snapshots.');
    private_tools_assert(!is_file($snapshotRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $userId . '.account.lock'), 'Account locks must be excluded from snapshots.');

    $auditOutput = $testRoot . DIRECTORY_SEPARATOR . 'snapshot-audit.json';
    $audit = private_tools_run([
        PHP_BINARY,
        $scriptRoot . DIRECTORY_SEPARATOR . 'growlens-private-data-audit.php',
        '--root=' . $snapshotRoot,
        '--strict-permissions=true',
        '--output=' . $auditOutput
    ]);
    private_tools_assert($audit['exitCode'] === 0, 'Snapshot audit should pass: ' . $audit['stderr']);
    $auditSummary = private_tools_decode_json($audit['stdout'], 'Snapshot audit');
    private_tools_assert(($auditSummary['ok'] ?? false) === true, 'Snapshot audit summary should report success.');
    private_tools_assert(($auditSummary['counts']['users'] ?? 0) === 1, 'Audit should count one user.');
    private_tools_assert(($auditSummary['counts']['images'] ?? 0) === 1, 'Audit should count one private image.');
    private_tools_assert(($auditSummary['counts']['activeSessions'] ?? 0) === 1, 'Audit should count one active session.');
    private_tools_assert(is_file($auditOutput), 'Audit should write a non-sensitive report file.');

    $archive = private_tools_run([
        'tar',
        '-C',
        $snapshotRoot,
        '-czf',
        $archivePath,
        '.'
    ]);
    private_tools_assert($archive['exitCode'] === 0 && is_file($archivePath), 'Snapshot archive should be created: ' . $archive['stderr']);
    mkdir($restoreRoot, 0700, true);
    $extract = private_tools_run([
        'tar',
        '-C',
        $restoreRoot,
        '-xzf',
        $archivePath,
        '--no-same-owner'
    ]);
    private_tools_assert($extract['exitCode'] === 0, 'Snapshot archive should extract: ' . $extract['stderr']);
    @chmod($restoreRoot, 0700);

    $restoreAudit = private_tools_run([
        PHP_BINARY,
        $scriptRoot . DIRECTORY_SEPARATOR . 'growlens-private-data-audit.php',
        '--root=' . $restoreRoot,
        '--strict-permissions=true'
    ]);
    private_tools_assert($restoreAudit['exitCode'] === 0, 'Extracted restored-copy audit should pass: ' . $restoreAudit['stderr']);
    $restoreSummary = private_tools_decode_json($restoreAudit['stdout'], 'Restored-copy audit');
    private_tools_assert(($restoreSummary['entriesDigest'] ?? '') === ($auditSummary['entriesDigest'] ?? ''), 'Restored copy should keep the same manifest digest.');

    $restoredDataPath = $restoreRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $userId . '.json';
    file_put_contents($restoredDataPath, "\ncorrupt", FILE_APPEND | LOCK_EX);
    $corruptAudit = private_tools_run([
        PHP_BINARY,
        $scriptRoot . DIRECTORY_SEPARATOR . 'growlens-private-data-audit.php',
        '--root=' . $restoreRoot,
        '--strict-permissions=true'
    ]);
    private_tools_assert($corruptAudit['exitCode'] !== 0, 'Corrupted restored copy must fail its audit.');
    $corruptSummary = private_tools_decode_json($corruptAudit['stderr'], 'Corrupted restored-copy audit');
    private_tools_assert(($corruptSummary['ok'] ?? true) === false, 'Corrupted audit should report failure.');
    $codes = array_column($corruptSummary['errors'] ?? [], 'code');
    private_tools_assert(in_array('files.size', $codes, true) || in_array('files.checksum', $codes, true), 'Corrupted audit should report manifest drift.');

    fwrite(STDOUT, "GrowLens private-data snapshot and restored-copy smoke test passed.\n");
} finally {
    private_tools_remove_tree($testRoot);
}
