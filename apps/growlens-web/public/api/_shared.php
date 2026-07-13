<?php
/**
 * Shared helpers for the THC GrowLens Hostinger persistence API.
 *
 * The API is dependency-free and designed for shared PHP hosting. Private user
 * data is stored outside the public document root. Browser code never receives
 * filesystem paths, password hashes, or raw session records.
 */

declare(strict_types=1);

const GROWLENS_API_VERSION = '1.0.0';
const GROWLENS_SESSION_COOKIE = 'growlens_session';
const GROWLENS_SESSION_TTL_SECONDS = 2592000;
const GROWLENS_MAX_BODY_BYTES = 5242880;
const GROWLENS_MAX_STATE_BYTES = 4194304;
const GROWLENS_MAX_RECORDS_PER_COLLECTION = 10000;

function growlens_send_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function growlens_require_method(string $method): void
{
    $actual = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($actual !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        growlens_send_json([
            'ok' => false,
            'error' => 'Method not allowed.'
        ], 405);
    }
}

function growlens_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$key] ?? ''));
}

function growlens_require_same_origin(): void
{
    $origin = growlens_header('Origin');
    if ($origin === '') {
        return;
    }

    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    $requestHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $requestHost = preg_replace('/:\d+$/', '', $requestHost) ?? $requestHost;

    if ($originHost === '' || !hash_equals($requestHost, $originHost)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Origin rejected.'
        ], 403);
    }
}

function growlens_read_json_body(int $maxBytes = GROWLENS_MAX_BODY_BYTES): array
{
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > $maxBytes) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Request body is too large.'
        ], 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    if (strlen($raw) > $maxBytes) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Request body is too large.'
        ], 413);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Invalid JSON body.'
        ], 400);
    }

    return $decoded;
}

function growlens_now(): string
{
    return gmdate('c');
}

function growlens_random_token(int $bytes = 32): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function growlens_clean_text($value, int $maxLength = 200): string
{
    $text = is_string($value) ? trim($value) : '';
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }
    return substr($text, 0, $maxLength);
}

function growlens_clean_email($value): string
{
    $email = strtolower(growlens_clean_text($value, 254));
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
}

function growlens_require_password($value): string
{
    $password = is_string($value) ? $value : '';
    $length = function_exists('mb_strlen') ? mb_strlen($password) : strlen($password);
    if ($length < 12 || $length > 200) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Password must be between 12 and 200 characters.'
        ], 400);
    }
    return $password;
}

function growlens_ensure_dir(string $path): string
{
    if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Private storage is unavailable.'
        ], 500);
    }
    @chmod($path, 0700);
    return $path;
}

function growlens_private_root(): string
{
    static $root = null;
    if (is_string($root)) {
        return $root;
    }

    $configured = trim((string)(getenv('GROWLENS_DATA_DIR') ?: ''));
    if ($configured !== '') {
        $candidate = rtrim($configured, DIRECTORY_SEPARATOR);
    } else {
        $documentRoot = (string)($_SERVER['DOCUMENT_ROOT'] ?? '');
        if ($documentRoot !== '') {
            $candidate = dirname($documentRoot) . DIRECTORY_SEPARATOR . 'growlens-private';
        } else {
            $candidate = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'growlens-private';
        }
    }

    growlens_ensure_dir($candidate);
    $resolved = realpath($candidate);
    if ($resolved === false) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Private storage path could not be resolved.'
        ], 500);
    }

    $documentRoot = (string)($_SERVER['DOCUMENT_ROOT'] ?? '');
    $resolvedDocumentRoot = $documentRoot !== '' ? realpath($documentRoot) : false;
    if (is_string($resolvedDocumentRoot)) {
        $prefix = rtrim($resolvedDocumentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (str_starts_with($resolved . DIRECTORY_SEPARATOR, $prefix)) {
            growlens_send_json([
                'ok' => false,
                'error' => 'Private storage must be outside the public document root.'
            ], 500);
        }
    }

    foreach (['users', 'email-index', 'sessions', 'data', 'rate'] as $directory) {
        growlens_ensure_dir($resolved . DIRECTORY_SEPARATOR . $directory);
    }

    $root = $resolved;
    return $root;
}

function growlens_path(string $directory, string $filename): string
{
    $safeDirectory = preg_replace('/[^a-z0-9-]/', '', strtolower($directory)) ?? '';
    $safeFilename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename) ?? '';
    if ($safeDirectory === '' || $safeFilename === '') {
        growlens_send_json([
            'ok' => false,
            'error' => 'Invalid storage key.'
        ], 500);
    }
    return growlens_private_root() . DIRECTORY_SEPARATOR . $safeDirectory . DIRECTORY_SEPARATOR . $safeFilename;
}

function growlens_read_json_file(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function growlens_atomic_write_json(string $path, array $payload): void
{
    $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not encode private data.'
        ], 500);
    }

    $lockPath = $path . '.lock';
    $lock = fopen($lockPath, 'c');
    if ($lock === false) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not open storage lock.'
        ], 500);
    }

    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not acquire storage lock.'
        ], 500);
    }

    $temporary = $path . '.tmp-' . bin2hex(random_bytes(6));
    $written = file_put_contents($temporary, $encoded, LOCK_EX);
    if ($written === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        @unlink($temporary);
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not write private data.'
        ], 500);
    }

    @chmod($temporary, 0600);
    $renamed = rename($temporary, $path);
    flock($lock, LOCK_UN);
    fclose($lock);

    if (!$renamed) {
        @unlink($temporary);
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not finalize private data.'
        ], 500);
    }
    @chmod($path, 0600);
}

function growlens_request_ip(): string
{
    return growlens_clean_text($_SERVER['REMOTE_ADDR'] ?? 'unknown', 64);
}

function growlens_rate_limit(string $action, int $limit, int $windowSeconds): void
{
    $bucket = hash('sha256', $action . '|' . growlens_request_ip());
    $path = growlens_path('rate', $bucket . '.json');
    $lock = fopen($path . '.lock', 'c');
    if ($lock === false) {
        growlens_send_json(['ok' => false, 'error' => 'Rate limiter unavailable.'], 500);
    }

    flock($lock, LOCK_EX);
    $current = growlens_read_json_file($path) ?? ['windowStartedAt' => time(), 'count' => 0];
    $windowStartedAt = (int)($current['windowStartedAt'] ?? 0);
    if ($windowStartedAt <= 0 || time() - $windowStartedAt >= $windowSeconds) {
        $current = ['windowStartedAt' => time(), 'count' => 0];
    }

    $current['count'] = (int)($current['count'] ?? 0) + 1;
    file_put_contents($path, json_encode($current), LOCK_EX);
    @chmod($path, 0600);
    flock($lock, LOCK_UN);
    fclose($lock);

    if ((int)$current['count'] > $limit) {
        $retryAfter = max(1, $windowSeconds - (time() - (int)$current['windowStartedAt']));
        header('Retry-After: ' . $retryAfter);
        growlens_send_json([
            'ok' => false,
            'error' => 'Too many requests. Try again later.'
        ], 429);
    }
}

function growlens_user_path(string $userId): string
{
    if (!preg_match('/^user-[a-f0-9]{32}$/', $userId)) {
        growlens_send_json(['ok' => false, 'error' => 'Invalid user identifier.'], 500);
    }
    return growlens_path('users', $userId . '.json');
}

function growlens_email_index_path(string $email): string
{
    return growlens_path('email-index', hash('sha256', $email) . '.json');
}

function growlens_public_user(array $user): array
{
    return [
        'id' => (string)($user['id'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
        'createdAt' => (string)($user['createdAt'] ?? '')
    ];
}

function growlens_find_user_by_email(string $email): ?array
{
    $index = growlens_read_json_file(growlens_email_index_path($email));
    $userId = is_array($index) ? (string)($index['userId'] ?? '') : '';
    if ($userId === '') {
        return null;
    }
    return growlens_read_json_file(growlens_user_path($userId));
}

function growlens_find_user_by_id(string $userId): ?array
{
    return growlens_read_json_file(growlens_user_path($userId));
}

function growlens_default_state(): array
{
    return [
        'schemaVersion' => 1,
        'spaces' => [],
        'cycles' => [],
        'plants' => [],
        'diary' => [],
        'tasks' => [],
        'readings' => [],
        'calibrationProfiles' => [],
        'observations' => []
    ];
}

function growlens_data_path(string $userId): string
{
    return growlens_path('data', $userId . '.json');
}

function growlens_create_user(string $email, string $password): array
{
    $root = growlens_private_root();
    $registrationLock = fopen($root . DIRECTORY_SEPARATOR . 'registration.lock', 'c');
    if ($registrationLock === false || !flock($registrationLock, LOCK_EX)) {
        growlens_send_json(['ok' => false, 'error' => 'Registration is temporarily unavailable.'], 500);
    }

    if (growlens_find_user_by_email($email) !== null) {
        flock($registrationLock, LOCK_UN);
        fclose($registrationLock);
        growlens_send_json([
            'ok' => false,
            'error' => 'An account with that email already exists.'
        ], 409);
    }

    $userId = 'user-' . bin2hex(random_bytes(16));
    $now = growlens_now();
    $user = [
        'id' => $userId,
        'email' => $email,
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => $now,
        'updatedAt' => $now
    ];

    growlens_atomic_write_json(growlens_user_path($userId), $user);
    growlens_atomic_write_json(growlens_email_index_path($email), ['userId' => $userId]);
    growlens_atomic_write_json(growlens_data_path($userId), [
        'revision' => 0,
        'updatedAt' => $now,
        'state' => growlens_default_state()
    ]);

    flock($registrationLock, LOCK_UN);
    fclose($registrationLock);
    return $user;
}

function growlens_session_path_from_token(string $token): string
{
    return growlens_path('sessions', hash('sha256', $token) . '.json');
}

function growlens_cookie_path(): string
{
    $configured = trim((string)(getenv('GROWLENS_COOKIE_PATH') ?: ''));
    return $configured !== '' ? $configured : '/growlens/';
}

function growlens_set_session_cookie(string $token, int $expiresAt): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ((string)($_SERVER['SERVER_PORT'] ?? '') === '443');

    setcookie(GROWLENS_SESSION_COOKIE, $token, [
        'expires' => $expiresAt,
        'path' => growlens_cookie_path(),
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

function growlens_clear_session_cookie(): void
{
    setcookie(GROWLENS_SESSION_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => growlens_cookie_path(),
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
}

function growlens_create_session(array $user): array
{
    $token = growlens_random_token();
    $expiresAt = time() + GROWLENS_SESSION_TTL_SECONDS;
    $session = [
        'userId' => (string)$user['id'],
        'csrfToken' => growlens_random_token(24),
        'createdAt' => growlens_now(),
        'lastSeenAt' => growlens_now(),
        'expiresAt' => $expiresAt
    ];
    growlens_atomic_write_json(growlens_session_path_from_token($token), $session);
    growlens_set_session_cookie($token, $expiresAt);
    return [
        'session' => $session,
        'token' => $token
    ];
}

function growlens_current_session(bool $required = true): ?array
{
    $token = growlens_clean_text($_COOKIE[GROWLENS_SESSION_COOKIE] ?? '', 160);
    if ($token === '' || !preg_match('/^[A-Za-z0-9_-]{40,160}$/', $token)) {
        if ($required) {
            growlens_send_json(['ok' => false, 'error' => 'Authentication required.'], 401);
        }
        return null;
    }

    $path = growlens_session_path_from_token($token);
    $session = growlens_read_json_file($path);
    if (!is_array($session) || (int)($session['expiresAt'] ?? 0) < time()) {
        @unlink($path);
        growlens_clear_session_cookie();
        if ($required) {
            growlens_send_json(['ok' => false, 'error' => 'Session expired.'], 401);
        }
        return null;
    }

    $user = growlens_find_user_by_id((string)($session['userId'] ?? ''));
    if (!is_array($user)) {
        @unlink($path);
        growlens_clear_session_cookie();
        if ($required) {
            growlens_send_json(['ok' => false, 'error' => 'Account not found.'], 401);
        }
        return null;
    }

    return [
        'token' => $token,
        'path' => $path,
        'session' => $session,
        'user' => $user
    ];
}

function growlens_require_csrf(array $sessionContext): void
{
    $provided = growlens_header('X-CSRF-Token');
    $expected = (string)($sessionContext['session']['csrfToken'] ?? '');
    if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'CSRF token rejected.'
        ], 403);
    }
}

function growlens_delete_session(array $sessionContext): void
{
    @unlink((string)$sessionContext['path']);
    growlens_clear_session_cookie();
}

function growlens_validate_state($state): array
{
    if (!is_array($state)) {
        growlens_send_json(['ok' => false, 'error' => 'Grow state must be an object.'], 400);
    }

    $collections = [
        'spaces', 'cycles', 'plants', 'diary', 'tasks', 'readings',
        'calibrationProfiles', 'observations'
    ];
    $normalized = ['schemaVersion' => 1];

    foreach ($collections as $collection) {
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

    $encoded = json_encode($normalized);
    if ($encoded === false || strlen($encoded) > GROWLENS_MAX_STATE_BYTES) {
        growlens_send_json(['ok' => false, 'error' => 'Grow state is too large.'], 413);
    }

    return $normalized;
}

function growlens_load_user_data(string $userId): array
{
    $data = growlens_read_json_file(growlens_data_path($userId));
    if (!is_array($data)) {
        return [
            'revision' => 0,
            'updatedAt' => growlens_now(),
            'state' => growlens_default_state()
        ];
    }
    return [
        'revision' => max(0, (int)($data['revision'] ?? 0)),
        'updatedAt' => (string)($data['updatedAt'] ?? growlens_now()),
        'state' => growlens_validate_state($data['state'] ?? [])
    ];
}

function growlens_save_user_data(string $userId, array $state, int $expectedRevision): array
{
    $path = growlens_data_path($userId);
    $lock = fopen($path . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        growlens_send_json(['ok' => false, 'error' => 'Could not lock grow data.'], 500);
    }

    $current = growlens_read_json_file($path) ?? [
        'revision' => 0,
        'updatedAt' => growlens_now(),
        'state' => growlens_default_state()
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
        'state' => growlens_validate_state($state)
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

function growlens_delete_account_data(array $user): void
{
    $userId = (string)$user['id'];
    $email = (string)$user['email'];

    @unlink(growlens_user_path($userId));
    @unlink(growlens_user_path($userId) . '.lock');
    @unlink(growlens_email_index_path($email));
    @unlink(growlens_email_index_path($email) . '.lock');
    @unlink(growlens_data_path($userId));
    @unlink(growlens_data_path($userId) . '.lock');

    $sessionDirectory = growlens_private_root() . DIRECTORY_SEPARATOR . 'sessions';
    foreach (glob($sessionDirectory . DIRECTORY_SEPARATOR . '*.json') ?: [] as $sessionPath) {
        $session = growlens_read_json_file($sessionPath);
        if (is_array($session) && hash_equals($userId, (string)($session['userId'] ?? ''))) {
            @unlink($sessionPath);
            @unlink($sessionPath . '.lock');
        }
    }
    growlens_clear_session_cookie();
}
