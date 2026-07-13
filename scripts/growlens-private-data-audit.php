<?php

declare(strict_types=1);

require_once __DIR__ . '/growlens-private-data-common.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This command is CLI-only.\n");
    exit(2);
}

$options = getopt('', [
    'root:',
    'manifest::',
    'output::',
    'strict-permissions::',
    'allow-public-paths::'
]);

$rootInput = trim((string)($options['root'] ?? ''));
$manifestInput = trim((string)($options['manifest'] ?? ''));
$outputInput = trim((string)($options['output'] ?? ''));
$strictPermissions = growlens_cli_parse_boolean_option($options['strict-permissions'] ?? false);
$allowPublicPaths = growlens_cli_parse_boolean_option($options['allow-public-paths'] ?? false);

$errors = [];
$warnings = [];
$maxFindings = 250;

$addFinding = static function (array &$target, string $code, string $message) use ($maxFindings): void {
    if (count($target) >= $maxFindings) {
        return;
    }
    $target[] = ['code' => $code, 'message' => $message];
};
$addError = static function (string $code, string $message) use (&$errors, $addFinding): void {
    $addFinding($errors, $code, $message);
};
$addWarning = static function (string $code, string $message) use (&$warnings, $addFinding): void {
    $addFinding($warnings, $code, $message);
};

$expectedCollections = [
    'spaces',
    'cycles',
    'plants',
    'diary',
    'tasks',
    'readings',
    'calibrationProfiles',
    'observations'
];

$validId = static fn($value): bool => is_string($value)
    && strlen($value) >= 3
    && strlen($value) <= 180
    && preg_match('/^[A-Za-z0-9._:-]+$/', $value) === 1;

try {
    if ($rootInput === '') {
        throw new RuntimeException('--root is required.');
    }
    $root = growlens_cli_normalize_existing_directory($rootInput, 'Audit root');
    $normalizedRoot = str_replace('\\', '/', $root) . '/';
    if (!$allowPublicPaths && str_contains($normalizedRoot, '/public_html/')) {
        throw new RuntimeException('Private restored copies must remain outside public_html.');
    }

    $manifestPath = $manifestInput !== ''
        ? realpath($manifestInput)
        : $root . DIRECTORY_SEPARATOR . GROWLENS_SNAPSHOT_MANIFEST;
    if (!is_string($manifestPath) || !is_file($manifestPath) || is_link($manifestPath)) {
        throw new RuntimeException('Snapshot manifest is missing or invalid.');
    }
    $expectedManifestPath = $root . DIRECTORY_SEPARATOR . GROWLENS_SNAPSHOT_MANIFEST;
    if (!hash_equals($expectedManifestPath, $manifestPath)) {
        throw new RuntimeException('The manifest must be the root snapshot manifest.');
    }

    $outputPath = null;
    if ($outputInput !== '') {
        if (!growlens_cli_is_absolute_path($outputInput)) {
            throw new RuntimeException('Audit output must be an absolute path.');
        }
        $outputParent = growlens_cli_normalize_existing_directory(dirname($outputInput), 'Audit output parent');
        $outputPath = $outputParent . DIRECTORY_SEPARATOR . basename($outputInput);
        if (growlens_cli_path_is_within($outputPath, $root)) {
            throw new RuntimeException('Audit output must be outside the restored-copy root.');
        }
        if (is_link($outputPath)) {
            throw new RuntimeException('Audit output must not be a symbolic link.');
        }
    }

    $manifest = growlens_cli_read_json($manifestPath, 64 * 1024 * 1024);
    if (($manifest['format'] ?? null) !== GROWLENS_SNAPSHOT_FORMAT) {
        $addError('manifest.format', 'Snapshot format is unsupported.');
    }
    if (($manifest['version'] ?? null) !== GROWLENS_SNAPSHOT_VERSION) {
        $addError('manifest.version', 'Snapshot version is unsupported.');
    }
    if (($manifest['app'] ?? null) !== 'THC GrowLens') {
        $addError('manifest.app', 'Snapshot app marker is invalid.');
    }
    if (!growlens_cli_is_valid_datetime($manifest['createdAt'] ?? null)) {
        $addError('manifest.createdAt', 'Snapshot creation timestamp is invalid.');
    }
    $manifestCommit = (string)($manifest['commit'] ?? '');
    if ($manifestCommit !== 'unknown' && preg_match('/^[a-f0-9]{7,64}$/i', $manifestCommit) !== 1) {
        $addError('manifest.commit', 'Snapshot commit identifier is invalid.');
    }

    $manifestFiles = $manifest['files'] ?? null;
    if (!is_array($manifestFiles) || !array_is_list($manifestFiles)) {
        $addError('manifest.files', 'Snapshot file manifest must be a list.');
        $manifestFiles = [];
    }

    $expectedEntries = [];
    foreach ($manifestFiles as $index => $entry) {
        if (!is_array($entry)) {
            $addError('manifest.entry', 'Snapshot manifest contains a non-object file entry.');
            continue;
        }
        $relative = (string)($entry['path'] ?? '');
        $bytes = $entry['bytes'] ?? null;
        $sha256 = strtolower((string)($entry['sha256'] ?? ''));
        if ($relative === ''
            || str_starts_with($relative, '/')
            || str_contains($relative, '\\')
            || preg_match('#(^|/)\.\.(/|$)#', $relative) === 1
            || preg_match('#(^|/)\.(/|$)#', $relative) === 1
            || preg_match('/[\x00-\x1F\x7F]/', $relative) === 1
            || growlens_cli_snapshot_excludes($relative, false)) {
            $addError('manifest.path', 'Snapshot manifest contains an unsafe or excluded file path at entry ' . $index . '.');
            continue;
        }
        if ((!is_int($bytes) && !(is_string($bytes) && ctype_digit($bytes))) || (int)$bytes < 0) {
            $addError('manifest.bytes', 'Snapshot manifest contains an invalid byte count at entry ' . $index . '.');
            continue;
        }
        if (preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1) {
            $addError('manifest.sha256', 'Snapshot manifest contains an invalid checksum at entry ' . $index . '.');
            continue;
        }
        if (isset($expectedEntries[$relative])) {
            $addError('manifest.duplicate', 'Snapshot manifest contains a duplicate file path.');
            continue;
        }
        $expectedEntries[$relative] = [
            'path' => $relative,
            'bytes' => (int)$bytes,
            'sha256' => $sha256
        ];
    }
    ksort($expectedEntries, SORT_STRING);
    $expectedEntriesList = array_values($expectedEntries);

    if ((int)($manifest['fileCount'] ?? -1) !== count($expectedEntriesList)) {
        $addError('manifest.fileCount', 'Snapshot file count does not match its entries.');
    }
    $expectedTotalBytes = array_sum(array_column($expectedEntriesList, 'bytes'));
    if ((int)($manifest['totalBytes'] ?? -1) !== $expectedTotalBytes) {
        $addError('manifest.totalBytes', 'Snapshot total byte count does not match its entries.');
    }
    $expectedDigest = growlens_cli_manifest_digest($expectedEntriesList);
    if (!hash_equals($expectedDigest, strtolower((string)($manifest['entriesDigest'] ?? '')))) {
        $addError('manifest.digest', 'Snapshot entries digest does not match its file list.');
    }

    $actualEntriesList = growlens_cli_sorted_manifest_entries($root);
    $actualEntries = [];
    foreach ($actualEntriesList as $entry) {
        $actualEntries[$entry['path']] = $entry;
    }

    foreach ($expectedEntries as $relative => $expected) {
        if (!isset($actualEntries[$relative])) {
            $addError('files.missing', 'A manifest file is missing from the restored copy: ' . $relative);
            continue;
        }
        $actual = $actualEntries[$relative];
        if ((int)$actual['bytes'] !== (int)$expected['bytes']) {
            $addError('files.size', 'A restored file byte count differs from the manifest: ' . $relative);
        }
        if (!hash_equals((string)$expected['sha256'], (string)$actual['sha256'])) {
            $addError('files.checksum', 'A restored file checksum differs from the manifest: ' . $relative);
        }
    }
    foreach ($actualEntries as $relative => $_actual) {
        if (!isset($expectedEntries[$relative])) {
            $addError('files.unexpected', 'The restored copy contains an unexpected file: ' . $relative);
        }
    }
    if (!hash_equals($expectedDigest, growlens_cli_manifest_digest($actualEntriesList))) {
        $addError('files.digest', 'The restored-copy digest differs from the snapshot manifest.');
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $item) {
        $relative = growlens_cli_relative_path($root, $item->getPathname());
        if ($item->isLink()) {
            $addError('filesystem.symlink', 'Symbolic links are not allowed: ' . $relative);
            continue;
        }
        if ($relative !== GROWLENS_SNAPSHOT_MANIFEST && growlens_cli_snapshot_excludes($relative, $item->isDir())) {
            $addError('filesystem.excluded', 'The restored copy contains a backup-excluded entry: ' . $relative);
        }
        $expectedMode = $item->isDir() ? 0700 : 0600;
        $mode = growlens_cli_file_mode($item->getPathname());
        if ($mode !== $expectedMode) {
            $message = sprintf('Permissions for %s are %04o; expected %04o.', $relative, $mode, $expectedMode);
            $strictPermissions
                ? $addError('permissions.mode', $message)
                : $addWarning('permissions.mode', $message);
        }
    }
    $rootMode = growlens_cli_file_mode($root);
    if ($rootMode !== 0700) {
        $message = sprintf('Restored-copy root permissions are %04o; expected 0700.', $rootMode);
        $strictPermissions
            ? $addError('permissions.root', $message)
            : $addWarning('permissions.root', $message);
    }

    foreach (['users', 'email-index', 'sessions', 'data'] as $requiredDirectory) {
        $path = $root . DIRECTORY_SEPARATOR . $requiredDirectory;
        if (!is_dir($path) || is_link($path)) {
            $addError('layout.required', 'Required private-data directory is missing: ' . $requiredDirectory);
        }
    }

    $users = [];
    $emailHashes = [];
    $userFiles = glob($root . DIRECTORY_SEPARATOR . 'users' . DIRECTORY_SEPARATOR . '*') ?: [];
    foreach ($userFiles as $path) {
        $basename = basename($path);
        if (is_link($path) || !is_file($path) || preg_match('/^(user-[a-f0-9]{32})\.json$/', $basename, $matches) !== 1) {
            $addError('users.filename', 'Users directory contains an invalid entry: ' . $basename);
            continue;
        }
        $userId = $matches[1];
        try {
            $user = growlens_cli_read_json($path, 1024 * 1024);
        } catch (Throwable $error) {
            $addError('users.json', 'User record is unreadable: ' . $basename);
            continue;
        }
        if (($user['id'] ?? null) !== $userId) {
            $addError('users.id', 'User ID does not match its filename: ' . $basename);
        }
        $email = (string)($user['email'] ?? '');
        if ($email === '' || strtolower($email) !== $email || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $addError('users.email', 'User record contains an invalid normalized email: ' . $basename);
        }
        $emailHash = $email !== '' ? hash('sha256', $email) : '';
        if ($emailHash !== '' && isset($emailHashes[$emailHash])) {
            $addError('users.duplicateEmail', 'Two user records resolve to the same email index hash.');
        }
        if ($emailHash !== '') {
            $emailHashes[$emailHash] = $userId;
        }
        $passwordHash = (string)($user['passwordHash'] ?? '');
        $passwordInfo = $passwordHash !== '' ? password_get_info($passwordHash) : [];
        if ($passwordHash === '' || empty($passwordInfo['algo'])) {
            $addError('users.passwordHash', 'User record contains an invalid password hash: ' . $basename);
        }
        if (!growlens_cli_is_valid_datetime($user['createdAt'] ?? null)
            || !growlens_cli_is_valid_datetime($user['updatedAt'] ?? null)) {
            $addError('users.timestamps', 'User record contains an invalid timestamp: ' . $basename);
        }
        $users[$userId] = [
            'emailHash' => $emailHash,
            'createdAt' => (string)($user['createdAt'] ?? '')
        ];
    }

    $indexes = [];
    $indexFiles = glob($root . DIRECTORY_SEPARATOR . 'email-index' . DIRECTORY_SEPARATOR . '*') ?: [];
    foreach ($indexFiles as $path) {
        $basename = basename($path);
        if (is_link($path) || !is_file($path) || preg_match('/^([a-f0-9]{64})\.json$/', $basename, $matches) !== 1) {
            $addError('indexes.filename', 'Email-index directory contains an invalid entry: ' . $basename);
            continue;
        }
        $emailHash = $matches[1];
        try {
            $index = growlens_cli_read_json($path, 65536);
        } catch (Throwable) {
            $addError('indexes.json', 'Email-index record is unreadable: ' . $basename);
            continue;
        }
        $userId = (string)($index['userId'] ?? '');
        if (!isset($users[$userId])) {
            $addError('indexes.orphan', 'Email index points to a missing user: ' . $basename);
        } elseif (!hash_equals((string)$users[$userId]['emailHash'], $emailHash)) {
            $addError('indexes.mismatch', 'Email-index filename does not match the referenced user: ' . $basename);
        }
        $indexes[$emailHash] = $userId;
    }
    foreach ($users as $userId => $user) {
        $emailHash = (string)$user['emailHash'];
        if ($emailHash === '' || !isset($indexes[$emailHash]) || $indexes[$emailHash] !== $userId) {
            $addError('indexes.missing', 'A user is missing its matching email index.');
        }
    }

    $dataRecords = [];
    $stateIds = [];
    $dataFiles = glob($root . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . '*') ?: [];
    foreach ($dataFiles as $path) {
        $basename = basename($path);
        if (is_link($path) || !is_file($path) || preg_match('/^(user-[a-f0-9]{32})\.json$/', $basename, $matches) !== 1) {
            $addError('data.filename', 'Data directory contains an invalid entry: ' . $basename);
            continue;
        }
        $userId = $matches[1];
        if (!isset($users[$userId])) {
            $addError('data.orphan', 'Grow data exists for a missing user: ' . $basename);
        }
        try {
            $data = growlens_cli_read_json($path, 5 * 1024 * 1024);
        } catch (Throwable) {
            $addError('data.json', 'Grow data is unreadable: ' . $basename);
            continue;
        }
        $revision = $data['revision'] ?? null;
        if (!is_int($revision) || $revision < 0) {
            $addError('data.revision', 'Grow data contains an invalid revision: ' . $basename);
        }
        if (!growlens_cli_is_valid_datetime($data['updatedAt'] ?? null)) {
            $addError('data.updatedAt', 'Grow data contains an invalid updated timestamp: ' . $basename);
        }
        $state = $data['state'] ?? null;
        if (!is_array($state) || ($state['schemaVersion'] ?? null) !== 1) {
            $addError('data.state', 'Grow data contains an invalid state root: ' . $basename);
            continue;
        }
        $stateIds[$userId] = [];
        foreach ($expectedCollections as $collection) {
            $records = $state[$collection] ?? null;
            if (!is_array($records) || !array_is_list($records) || count($records) > 10000) {
                $addError('data.collection', 'Grow state contains an invalid collection ' . $collection . ': ' . $basename);
                continue;
            }
            $ids = [];
            foreach ($records as $recordIndex => $record) {
                if (!is_array($record) || array_is_list($record)) {
                    $addError('data.record', 'Grow state contains a non-object record in ' . $collection . ': ' . $basename);
                    continue;
                }
                $recordId = $record['id'] ?? null;
                if (!$validId($recordId)) {
                    $addError('data.recordId', 'Grow state contains an invalid record ID in ' . $collection . ': ' . $basename);
                    continue;
                }
                if (isset($ids[$recordId])) {
                    $addError('data.duplicateId', 'Grow state contains a duplicate record ID in ' . $collection . ': ' . $basename);
                }
                $ids[$recordId] = true;
            }
            $stateIds[$userId][$collection] = $ids;
        }

        $cycles = $state['cycles'] ?? [];
        $plants = $state['plants'] ?? [];
        $diary = $state['diary'] ?? [];
        $tasks = $state['tasks'] ?? [];
        $readings = $state['readings'] ?? [];
        $observations = $state['observations'] ?? [];
        $spaceIds = $stateIds[$userId]['spaces'] ?? [];
        $cycleIds = $stateIds[$userId]['cycles'] ?? [];
        $plantIds = $stateIds[$userId]['plants'] ?? [];

        foreach ($cycles as $record) {
            if (is_array($record) && isset($record['spaceId']) && !isset($spaceIds[$record['spaceId']])) {
                $addWarning('references.cycleSpace', 'A cycle references a missing space in ' . $basename . '.');
            }
        }
        foreach ($plants as $record) {
            if (!is_array($record)) {
                continue;
            }
            if (isset($record['spaceId']) && !isset($spaceIds[$record['spaceId']])) {
                $addWarning('references.plantSpace', 'A plant references a missing space in ' . $basename . '.');
            }
            if (isset($record['cycleId']) && !isset($cycleIds[$record['cycleId']])) {
                $addWarning('references.plantCycle', 'A plant references a missing cycle in ' . $basename . '.');
            }
        }
        foreach ($diary as $record) {
            if (!is_array($record)) {
                continue;
            }
            if (!empty($record['plantId']) && !isset($plantIds[$record['plantId']])) {
                $addWarning('references.diaryPlant', 'A diary entry references a missing plant in ' . $basename . '.');
            }
            if (!empty($record['cycleId']) && !isset($cycleIds[$record['cycleId']])) {
                $addWarning('references.diaryCycle', 'A diary entry references a missing cycle in ' . $basename . '.');
            }
        }
        foreach ($tasks as $record) {
            if (is_array($record) && !empty($record['plantId']) && !isset($plantIds[$record['plantId']])) {
                $addWarning('references.taskPlant', 'A task references a missing plant in ' . $basename . '.');
            }
        }
        foreach ($readings as $record) {
            if (is_array($record) && !empty($record['spaceId']) && !isset($spaceIds[$record['spaceId']])) {
                $addWarning('references.readingSpace', 'A reading references a missing space in ' . $basename . '.');
            }
        }
        foreach ($observations as $record) {
            if (is_array($record) && !empty($record['plantId']) && !isset($plantIds[$record['plantId']])) {
                $addWarning('references.observationPlant', 'An observation references a missing plant in ' . $basename . '.');
            }
        }
        $dataRecords[$userId] = [
            'revision' => is_int($revision) ? $revision : -1,
            'recordCount' => array_sum(array_map(
                static fn(string $collection): int => is_array($state[$collection] ?? null) ? count($state[$collection]) : 0,
                $expectedCollections
            ))
        ];
    }
    foreach ($users as $userId => $_user) {
        if (!isset($dataRecords[$userId])) {
            $addError('data.missing', 'A user is missing its grow data record.');
        }
    }

    $activeSessions = 0;
    $expiredSessions = 0;
    $sessionFiles = glob($root . DIRECTORY_SEPARATOR . 'sessions' . DIRECTORY_SEPARATOR . '*') ?: [];
    foreach ($sessionFiles as $path) {
        $basename = basename($path);
        if (is_link($path) || !is_file($path) || preg_match('/^[a-f0-9]{64}\.json$/', $basename) !== 1) {
            $addError('sessions.filename', 'Sessions directory contains an invalid entry: ' . $basename);
            continue;
        }
        try {
            $session = growlens_cli_read_json($path, 262144);
        } catch (Throwable) {
            $addError('sessions.json', 'Session record is unreadable: ' . $basename);
            continue;
        }
        $userId = (string)($session['userId'] ?? '');
        if (!isset($users[$userId])) {
            $addError('sessions.orphan', 'Session references a missing user: ' . $basename);
        }
        $csrfToken = (string)($session['csrfToken'] ?? '');
        if (preg_match('/^[A-Za-z0-9_-]{20,200}$/', $csrfToken) !== 1) {
            $addError('sessions.csrf', 'Session contains an invalid CSRF token: ' . $basename);
        }
        if (!growlens_cli_is_valid_datetime($session['createdAt'] ?? null)
            || !growlens_cli_is_valid_datetime($session['lastSeenAt'] ?? null)) {
            $addError('sessions.timestamps', 'Session contains an invalid timestamp: ' . $basename);
        }
        $expiresAt = $session['expiresAt'] ?? null;
        if (!is_int($expiresAt) || $expiresAt <= 0) {
            $addError('sessions.expiresAt', 'Session contains an invalid expiry: ' . $basename);
        } elseif ($expiresAt < time()) {
            $expiredSessions++;
            $addWarning('sessions.expired', 'Snapshot contains an expired session record.');
        } else {
            $activeSessions++;
        }
    }

    $imageCount = 0;
    $imageBytes = 0;
    $imageMetadataCount = 0;
    $imageRoot = $root . DIRECTORY_SEPARATOR . 'images';
    if (is_dir($imageRoot)) {
        $userImageEntries = glob($imageRoot . DIRECTORY_SEPARATOR . '*') ?: [];
        foreach ($userImageEntries as $userDirectory) {
            $userId = basename($userDirectory);
            if (is_link($userDirectory) || !is_dir($userDirectory) || preg_match('/^user-[a-f0-9]{32}$/', $userId) !== 1) {
                $addError('images.userDirectory', 'Images directory contains an invalid user entry.');
                continue;
            }
            if (!isset($users[$userId])) {
                $addError('images.orphanUser', 'Images directory belongs to a missing user.');
            }
            $metadataByPhoto = [];
            $bytesByPhoto = [];
            foreach (glob($userDirectory . DIRECTORY_SEPARATOR . '*') ?: [] as $imagePath) {
                $basename = basename($imagePath);
                if (is_link($imagePath) || !is_file($imagePath)) {
                    $addError('images.entry', 'User image directory contains an invalid entry.');
                    continue;
                }
                if (preg_match('/^(photo-[A-Za-z0-9-]{8,130})\.json$/', $basename, $matches) === 1) {
                    $photoId = $matches[1];
                    try {
                        $metadata = growlens_cli_read_json($imagePath, 262144);
                    } catch (Throwable) {
                        $addError('images.metadataJson', 'Image metadata is unreadable.');
                        continue;
                    }
                    if (($metadata['id'] ?? null) !== $photoId) {
                        $addError('images.metadataId', 'Image metadata ID does not match its filename.');
                    }
                    $extension = (string)($metadata['extension'] ?? '');
                    $mimeType = (string)($metadata['mimeType'] ?? '');
                    $allowed = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
                    if (!isset($allowed[$extension]) || $allowed[$extension] !== $mimeType) {
                        $addError('images.metadataType', 'Image metadata contains an invalid type mapping.');
                    }
                    $width = $metadata['width'] ?? null;
                    $height = $metadata['height'] ?? null;
                    $bytes = $metadata['bytes'] ?? null;
                    if (!is_int($width) || !is_int($height) || $width < 1 || $height < 1 || max($width, $height) > 4000) {
                        $addError('images.metadataDimensions', 'Image metadata contains invalid dimensions.');
                    }
                    if (!is_int($bytes) || $bytes < 1 || $bytes > 6291456) {
                        $addError('images.metadataBytes', 'Image metadata contains an invalid byte count.');
                    }
                    if (!growlens_cli_is_valid_datetime($metadata['capturedAt'] ?? null)
                        || !growlens_cli_is_valid_datetime($metadata['createdAt'] ?? null)) {
                        $addError('images.metadataTimestamps', 'Image metadata contains an invalid timestamp.');
                    }
                    if (!is_string($metadata['observationId'] ?? null) || trim((string)$metadata['observationId']) === '') {
                        $addError('images.observationId', 'Image metadata is missing an observation ID.');
                    }
                    $metadataByPhoto[$photoId] = $metadata;
                    $imageMetadataCount++;
                    continue;
                }
                if (preg_match('/^(photo-[A-Za-z0-9-]{8,130})\.(jpg|png|webp)$/', $basename, $matches) === 1) {
                    $photoId = $matches[1];
                    $bytesByPhoto[$photoId] = ['path' => $imagePath, 'extension' => $matches[2]];
                    continue;
                }
                $addError('images.filename', 'User image directory contains an unsupported filename.');
            }

            foreach ($metadataByPhoto as $photoId => $metadata) {
                if (!isset($bytesByPhoto[$photoId])) {
                    $addError('images.missingBytes', 'Image metadata is missing its image bytes.');
                    continue;
                }
                $image = $bytesByPhoto[$photoId];
                if (($metadata['extension'] ?? null) !== $image['extension']) {
                    $addError('images.extension', 'Image extension differs from metadata.');
                }
                $actualBytes = filesize($image['path']);
                if ($actualBytes === false || $actualBytes !== (int)($metadata['bytes'] ?? -1)) {
                    $addError('images.byteMismatch', 'Image byte count differs from metadata.');
                }
                $imageInfo = @getimagesize($image['path']);
                if (!is_array($imageInfo)) {
                    $addError('images.invalidFile', 'Stored image bytes are not a readable image.');
                    continue;
                }
                if ((int)$imageInfo[0] !== (int)($metadata['width'] ?? -1)
                    || (int)$imageInfo[1] !== (int)($metadata['height'] ?? -1)) {
                    $addError('images.dimensionMismatch', 'Stored image dimensions differ from metadata.');
                }
                if (!class_exists('finfo')) {
                    $addError('images.fileinfo', 'PHP fileinfo is unavailable for image verification.');
                } else {
                    $finfo = new finfo(FILEINFO_MIME_TYPE);
                    $actualMime = (string)$finfo->file($image['path']);
                    if ($actualMime !== (string)($metadata['mimeType'] ?? '')) {
                        $addError('images.mimeMismatch', 'Stored image MIME type differs from metadata.');
                    }
                }
                $imageCount++;
                $imageBytes += max(0, (int)$actualBytes);
            }
            foreach ($bytesByPhoto as $photoId => $_image) {
                if (!isset($metadataByPhoto[$photoId])) {
                    $addError('images.orphanBytes', 'Stored image bytes are missing metadata.');
                }
            }
        }
    } elseif (file_exists($imageRoot)) {
        $addError('images.layout', 'Images path exists but is not a directory.');
    }

    $manifestSha256 = hash_file('sha256', $manifestPath);
    if ($manifestSha256 === false) {
        throw new RuntimeException('Could not hash the snapshot manifest.');
    }
    $report = [
        'ok' => count($errors) === 0,
        'format' => GROWLENS_SNAPSHOT_FORMAT,
        'version' => GROWLENS_SNAPSHOT_VERSION,
        'auditedAt' => gmdate('c'),
        'snapshotCreatedAt' => (string)($manifest['createdAt'] ?? ''),
        'commit' => $manifestCommit,
        'manifestSha256' => $manifestSha256,
        'entriesDigest' => $expectedDigest,
        'strictPermissions' => $strictPermissions,
        'counts' => [
            'files' => count($actualEntriesList),
            'bytes' => array_sum(array_column($actualEntriesList, 'bytes')),
            'users' => count($users),
            'emailIndexes' => count($indexes),
            'dataRecords' => count($dataRecords),
            'stateRecords' => array_sum(array_column($dataRecords, 'recordCount')),
            'activeSessions' => $activeSessions,
            'expiredSessions' => $expiredSessions,
            'imageMetadata' => $imageMetadataCount,
            'images' => $imageCount,
            'imageBytes' => $imageBytes,
            'errors' => count($errors),
            'warnings' => count($warnings)
        ],
        'errors' => $errors,
        'warnings' => $warnings
    ];

    if ($outputPath !== null) {
        growlens_cli_write_json($outputPath, $report);
    }
    fwrite(count($errors) === 0 ? STDOUT : STDERR, growlens_cli_json($report));
    exit(count($errors) === 0 ? 0 : 1);
} catch (Throwable $error) {
    $report = [
        'ok' => false,
        'format' => GROWLENS_SNAPSHOT_FORMAT,
        'version' => GROWLENS_SNAPSHOT_VERSION,
        'auditedAt' => gmdate('c'),
        'counts' => [
            'errors' => 1,
            'warnings' => count($warnings)
        ],
        'errors' => [[
            'code' => 'audit.fatal',
            'message' => $error->getMessage()
        ]],
        'warnings' => $warnings
    ];
    if ($outputInput !== '') {
        try {
            $outputParent = growlens_cli_normalize_existing_directory(dirname($outputInput), 'Audit output parent');
            $outputPath = $outputParent . DIRECTORY_SEPARATOR . basename($outputInput);
            growlens_cli_write_json($outputPath, $report);
        } catch (Throwable) {
            // Keep the original audit failure as the primary diagnostic.
        }
    }
    fwrite(STDERR, growlens_cli_json($report));
    exit(1);
}
