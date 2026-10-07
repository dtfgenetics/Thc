<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';

const GROWLENS_AI_MAX_RESPONSE_BYTES = 1048576;

function growlens_ai_gateway_url(string $role): string
{
    $env = $role === 'visual-observation' ? 'GROWLENS_AI_VISION_URL' : '';
    $url = $env !== '' ? trim((string)(getenv($env) ?: '')) : '';
    if ($url === '') {
        growlens_send_json(['ok' => false, 'error' => 'AI provider is not configured.'], 503);
    }

    $parts = parse_url($url);
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = strtolower((string)($parts['host'] ?? ''));
    $local = in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    if ($host === '' || ($scheme !== 'https' && !($local && $scheme === 'http'))) {
        growlens_send_json(['ok' => false, 'error' => 'AI provider URL must use HTTPS (localhost HTTP is allowed for development).'], 500);
    }
    return $url;
}

function growlens_ai_gateway_token(): string
{
    return trim((string)(getenv('GROWLENS_AI_GATEWAY_TOKEN') ?: ''));
}

function growlens_ai_post_json(string $url, array $payload): array
{
    if (!function_exists('curl_init')) {
        growlens_send_json(['ok' => false, 'error' => 'Server AI transport is unavailable.'], 503);
    }
    $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        growlens_send_json(['ok' => false, 'error' => 'Could not encode AI request.'], 500);
    }

    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $token = growlens_ai_gateway_token();
    if ($token !== '') $headers[] = 'Authorization: Bearer ' . $token;

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $encoded,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 0,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ]);
    $response = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if (!is_string($response) || $response === '' || strlen($response) > GROWLENS_AI_MAX_RESPONSE_BYTES) {
        growlens_send_json(['ok' => false, 'error' => $error !== '' ? 'AI provider request failed.' : 'AI provider returned an invalid response.'], 502);
    }
    $decoded = json_decode($response, true);
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        growlens_send_json(['ok' => false, 'error' => 'AI provider request was rejected.'], 502);
    }
    return $decoded;
}

function growlens_ai_clean_list($value, int $maxItems, int $maxLength): array
{
    if (!is_array($value)) return [];
    $clean = [];
    foreach ($value as $entry) {
        $text = growlens_clean_text($entry, $maxLength);
        if ($text !== '' && !in_array($text, $clean, true)) $clean[] = $text;
        if (count($clean) >= $maxItems) break;
    }
    return $clean;
}
