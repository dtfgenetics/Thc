<?php

declare(strict_types=1);

require_once __DIR__ . '/growlens-private-data-common.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This command is CLI-only.\n");
    exit(2);
}

$options = getopt('', [
    'source:',
    'destination:',
    'commit::',
    'max-bytes::',
    'lock-wait-seconds::',
    'allow-public-paths::'
]);

$sourceInput = trim((string)($options['source'] ?? ''));
$destinationInput = rtrim(trim((string)($options['destination'] ?? '')), DIRECTORY_SEPARATOR);
$commit = trim((string)($options['commit'] ?? 'unknown'));
$maxBytes = (int)($options['max-bytes'] ?? (5 * 1024 * 1024 * 1024));
$lockWaitSeconds = (int)($options['lock-wait-seconds'] ?? 60);
$allowPublicPaths = growlens_cli_parse_boolean_option($options['allow-public-paths'] ?? false);

$destinationCreated = false;
$destination = null;
$lock = null;

try {
    if ($sourceInput === '' || $destinationInput === '') {
        throw new RuntimeException('--source and --destination are required.');
    }
    if (!growlens_cli_is_absolute_path($destinationInput)) {
        throw new RuntimeException('Snapshot destination must be an absolute path.');
    }
    if ($maxBytes < 1048576 || $maxBytes > (50 * 1024 * 1024 * 1024)) {
        throw new RuntimeException('--max-bytes must be between 1 MB and 50 GB.');
    }
    if ($lockWaitSeconds < 1 || $lockWaitSeconds > 600) {
        throw new RuntimeException('--lock-wait-seconds must be between 1 and 600.');
    }
    if ($commit !== 'unknown' && preg_match('/^[a-f0-9]{7,64}$/i', $commit) !== 1) {
        throw new RuntimeException('--commit must be a Git commit identifier.');
    }

    $source = growlens_cli_normalize_existing_directory($sourceInput, 'Snapshot source');
    $destinationParentInput = dirname($destinationInput);
    $destinationParent = growlens_cli_normalize_existing_directory($destinationParentInput, 'Snapshot destination parent');
    $destination = $destinationParent . DIRECTORY_SEPARATOR . basename($destinationInput);

    if (file_exists($destination) || is_link($destination)) {
        throw new RuntimeException('Snapshot destination must not already exist.');
    }
    if (growlens_cli_path_is_within($destination, $source) || growlens_cli_path_is_within($source, $destination)) {
        throw new RuntimeException('Snapshot source and destination must not contain one another.');
    }
    if (!$allowPublicPaths) {
        $sourceNormalized = str_replace('\\', '/', $source) . '/';
        $destinationNormalized = str_replace('\\', '/', $destination) . '/';
        if (str_contains($sourceNormalized, '/public_html/') || str_contains($destinationNormalized, '/public_html/')) {
            throw new RuntimeException('Private snapshots must remain outside public_html.');
        }
    }

    foreach (['users', 'email-index', 'sessions', 'data'] as $requiredDirectory) {
        if (!is_dir($source . DIRECTORY_SEPARATOR . $requiredDirectory)) {
            throw new RuntimeException('Private data is missing required directory: ' . $requiredDirectory);
        }
    }

    $lockPath = $source . DIRECTORY_SEPARATOR . 'operations.lock';
    $lock = fopen($lockPath, 'c');
    if ($lock === false) {
        throw new RuntimeException('Could not open the GrowLens storage coordination lock.');
    }
    @chmod($lockPath, 0600);
    $deadline = microtime(true) + $lockWaitSeconds;
    $acquired = false;
    do {
        if (flock($lock, LOCK_EX | LOCK_NB)) {
            $acquired = true;
            break;
        }
        usleep(100000);
    } while (microtime(true) < $deadline);
    if (!$acquired) {
        throw new RuntimeException('Timed out waiting for active GrowLens requests to finish.');
    }

    if (!mkdir($destination, 0700, false)) {
        throw new RuntimeException('Could not create snapshot destination.');
    }
    $destinationCreated = true;
    @chmod($destination, 0700);

    $totalBytes = 0;
    $copiedFiles = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $sourcePath = $item->getPathname();
        $relative = growlens_cli_relative_path($source, $sourcePath);
        if (growlens_cli_snapshot_excludes($relative, $item->isDir())) {
            continue;
        }
        if ($item->isLink()) {
            throw new RuntimeException('Symbolic links are not allowed in private data: ' . $relative);
        }

        $destinationPath = $destination . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
        if ($item->isDir()) {
            if (!is_dir($destinationPath) && !mkdir($destinationPath, 0700, true)) {
                throw new RuntimeException('Could not create snapshot directory: ' . $relative);
            }
            @chmod($destinationPath, 0700);
            continue;
        }
        if (!$item->isFile()) {
            throw new RuntimeException('Unsupported private-data entry: ' . $relative);
        }

        $size = $item->getSize();
        $totalBytes += $size;
        if ($totalBytes > $maxBytes) {
            throw new RuntimeException('Private data exceeds the configured snapshot byte limit.');
        }
        $parent = dirname($destinationPath);
        if (!is_dir($parent) && !mkdir($parent, 0700, true)) {
            throw new RuntimeException('Could not create snapshot file parent: ' . $relative);
        }
        if (!copy($sourcePath, $destinationPath)) {
            throw new RuntimeException('Could not copy private-data file: ' . $relative);
        }
        @chmod($destinationPath, 0600);
        $copiedFiles++;
    }

    $entries = growlens_cli_sorted_manifest_entries($destination);
    $manifestBytes = array_sum(array_map(static fn(array $entry): int => (int)$entry['bytes'], $entries));
    if ($manifestBytes !== $totalBytes || count($entries) !== $copiedFiles) {
        throw new RuntimeException('Snapshot file accounting did not reconcile.');
    }

    $manifest = [
        'format' => GROWLENS_SNAPSHOT_FORMAT,
        'version' => GROWLENS_SNAPSHOT_VERSION,
        'app' => 'THC GrowLens',
        'createdAt' => gmdate('c'),
        'commit' => $commit,
        'sourceLabel' => basename($source),
        'excluded' => [
            'rate/',
            'operations.lock',
            'registration.lock',
            '*.lock',
            '*.tmp-*',
            '.health-probe'
        ],
        'fileCount' => count($entries),
        'totalBytes' => $totalBytes,
        'entriesDigest' => growlens_cli_manifest_digest($entries),
        'files' => $entries
    ];
    $manifestPath = $destination . DIRECTORY_SEPARATOR . GROWLENS_SNAPSHOT_MANIFEST;
    growlens_cli_write_json($manifestPath, $manifest);
    $manifestSha256 = hash_file('sha256', $manifestPath);
    if ($manifestSha256 === false) {
        throw new RuntimeException('Could not hash the snapshot manifest.');
    }

    flock($lock, LOCK_UN);
    fclose($lock);
    $lock = null;

    fwrite(STDOUT, growlens_cli_json([
        'ok' => true,
        'format' => GROWLENS_SNAPSHOT_FORMAT,
        'version' => GROWLENS_SNAPSHOT_VERSION,
        'createdAt' => $manifest['createdAt'],
        'commit' => $commit,
        'fileCount' => count($entries),
        'totalBytes' => $totalBytes,
        'entriesDigest' => $manifest['entriesDigest'],
        'manifestSha256' => $manifestSha256
    ]));
    exit(0);
} catch (Throwable $error) {
    if (is_resource($lock)) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
    if ($destinationCreated && is_string($destination)) {
        try {
            growlens_cli_remove_tree($destination);
        } catch (Throwable) {
            // The original error remains more useful than cleanup details.
        }
    }
    fwrite(STDERR, growlens_cli_json([
        'ok' => false,
        'error' => $error->getMessage()
    ]));
    exit(1);
}
