<?php

declare(strict_types=1);

const GROWLENS_SNAPSHOT_FORMAT = 'thc-growlens-private-data-snapshot';
const GROWLENS_SNAPSHOT_VERSION = 1;
const GROWLENS_SNAPSHOT_MANIFEST = 'manifest.json';

function growlens_cli_json(array $payload): string
{
    $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        throw new RuntimeException('Could not encode JSON output.');
    }
    return $encoded . PHP_EOL;
}

function growlens_cli_write_json(string $path, array $payload, int $mode = 0600): void
{
    $encoded = growlens_cli_json($payload);
    if (file_put_contents($path, $encoded, LOCK_EX) === false) {
        throw new RuntimeException('Could not write JSON file: ' . basename($path));
    }
    @chmod($path, $mode);
}

function growlens_cli_read_json(string $path, int $maxBytes): array
{
    if (!is_file($path) || is_link($path)) {
        throw new RuntimeException('Expected a regular JSON file: ' . basename($path));
    }
    $size = filesize($path);
    if ($size === false || $size < 2 || $size > $maxBytes) {
        throw new RuntimeException('JSON file has an invalid size: ' . basename($path));
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('Could not read JSON file: ' . basename($path));
    }
    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('Malformed JSON file: ' . basename($path), 0, $error);
    }
    if (!is_array($decoded)) {
        throw new RuntimeException('JSON root must be an object or array: ' . basename($path));
    }
    return $decoded;
}

function growlens_cli_is_absolute_path(string $path): bool
{
    if ($path === '') {
        return false;
    }
    if (DIRECTORY_SEPARATOR === '\\') {
        return preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1 || str_starts_with($path, '\\\\');
    }
    return str_starts_with($path, '/');
}

function growlens_cli_normalize_existing_directory(string $path, string $label): string
{
    if (!growlens_cli_is_absolute_path($path)) {
        throw new RuntimeException($label . ' must be an absolute path.');
    }
    if (is_link($path)) {
        throw new RuntimeException($label . ' must not be a symbolic link.');
    }
    $resolved = realpath($path);
    if ($resolved === false || !is_dir($resolved)) {
        throw new RuntimeException($label . ' does not exist or is not a directory.');
    }
    return rtrim($resolved, DIRECTORY_SEPARATOR);
}

function growlens_cli_path_is_within(string $candidate, string $parent): bool
{
    $candidate = rtrim($candidate, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    $parent = rtrim($parent, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    return str_starts_with($candidate, $parent);
}

function growlens_cli_relative_path(string $root, string $path): string
{
    $prefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (!str_starts_with($path, $prefix)) {
        throw new RuntimeException('Path escaped the expected root.');
    }
    return str_replace(DIRECTORY_SEPARATOR, '/', substr($path, strlen($prefix)));
}

function growlens_cli_snapshot_excludes(string $relativePath, bool $directory): bool
{
    $normalized = trim(str_replace('\\', '/', $relativePath), '/');
    if ($normalized === '') {
        return false;
    }
    $segments = explode('/', $normalized);
    $basename = end($segments);
    if ($segments[0] === 'rate') {
        return true;
    }
    if ($basename === 'operations.lock' || $basename === 'registration.lock' || $basename === '.health-probe') {
        return true;
    }
    if (str_ends_with($basename, '.lock') || str_contains($basename, '.tmp-')) {
        return true;
    }
    if ($basename === GROWLENS_SNAPSHOT_MANIFEST) {
        return true;
    }
    return false;
}

function growlens_cli_remove_tree(string $path): void
{
    if (!file_exists($path) && !is_link($path)) {
        return;
    }
    if (is_link($path) || is_file($path)) {
        if (!@unlink($path)) {
            throw new RuntimeException('Could not remove temporary file.');
        }
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        growlens_cli_remove_tree($path . DIRECTORY_SEPARATOR . $entry);
    }
    if (!@rmdir($path)) {
        throw new RuntimeException('Could not remove temporary directory.');
    }
}

function growlens_cli_file_mode(string $path): int
{
    $permissions = fileperms($path);
    return $permissions === false ? 0 : ($permissions & 0777);
}

function growlens_cli_is_valid_datetime($value): bool
{
    if (!is_string($value) || trim($value) === '') {
        return false;
    }
    try {
        new DateTimeImmutable($value);
        return true;
    } catch (Throwable) {
        return false;
    }
}

function growlens_cli_sorted_manifest_entries(string $root): array
{
    $entries = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $item) {
        $path = $item->getPathname();
        $relative = growlens_cli_relative_path($root, $path);
        if (growlens_cli_snapshot_excludes($relative, $item->isDir())) {
            continue;
        }
        if ($item->isLink()) {
            throw new RuntimeException('Symbolic links are not allowed in private data: ' . $relative);
        }
        if (!$item->isFile()) {
            continue;
        }
        $size = $item->getSize();
        $hash = hash_file('sha256', $path);
        if ($hash === false) {
            throw new RuntimeException('Could not hash private file: ' . $relative);
        }
        $entries[] = [
            'path' => $relative,
            'bytes' => $size,
            'sha256' => $hash
        ];
    }
    usort($entries, static fn(array $first, array $second): int => strcmp($first['path'], $second['path']));
    return $entries;
}

function growlens_cli_manifest_digest(array $entries): string
{
    $lines = array_map(
        static fn(array $entry): string => $entry['path'] . "\t" . $entry['bytes'] . "\t" . $entry['sha256'],
        $entries
    );
    return hash('sha256', implode("\n", $lines));
}

function growlens_cli_parse_boolean_option($value, bool $default = false): bool
{
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return in_array(strtolower((string)$value), ['1', 'true', 'yes', 'on'], true);
}
