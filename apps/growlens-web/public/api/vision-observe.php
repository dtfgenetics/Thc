<?php
declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_rate_limit('vision-observe', 30, 3600);

$context = growlens_current_session(true);
growlens_require_csrf($context);

$apiKey = trim((string)(getenv('MOONDREAM_API_KEY') ?: ''));
if ($apiKey === '') {
    growlens_send_json(['ok' => false, 'error' => 'AI visual observation is not configured on this server.'], 503);
}
if (!function_exists('curl_init')) {
    growlens_send_json(['ok' => false, 'error' => 'AI visual observation is unavailable on this server.'], 503);
}
if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    growlens_send_json(['ok' => false, 'error' => 'Observation image is required.'], 400);
}

$image = $_FILES['image'];
if ((int)($image['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    growlens_send_json(['ok' => false, 'error' => 'Observation image upload failed.'], 400);
}
$size = (int)($image['size'] ?? 0);
if ($size <= 0 || $size > 5 * 1024 * 1024) {
    growlens_send_json(['ok' => false, 'error' => 'Observation image must be 5 MB or smaller.'], 413);
}
$tempPath = (string)($image['tmp_name'] ?? '');
if ($tempPath === '' || !is_uploaded_file($tempPath)) {
    growlens_send_json(['ok' => false, 'error' => 'Invalid observation image upload.'], 400);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = strtolower((string)$finfo->file($tempPath));
if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    growlens_send_json(['ok' => false, 'error' => 'Unsupported observation image type.'], 415);
}
$bytes = file_get_contents($tempPath);
if ($bytes === false || $bytes === '') {
    growlens_send_json(['ok' => false, 'error' => 'Could not read observation image.'], 400);
}

$prompt = 'Act only as a visual observation instrument for a plant image. Report directly visible evidence and image-quality limits. Do not diagnose nutrient deficiencies, toxicities, diseases, pests, pathogens, or environmental causes. Do not recommend treatment. Return strict JSON with these string keys: overall_view, visible_color_changes, visible_spots_or_lesions, leaf_shape_and_posture, visible_pests_or_residue, tissue_and_distribution, image_quality_limits. Use "not visible" when a feature cannot be directly observed.';

$payload = json_encode([
    'image_url' => 'data:' . $mimeType . ';base64,' . base64_encode($bytes),
    'question' => $prompt,
], JSON_UNESCAPED_SLASHES);
if ($payload === false) {
    growlens_send_json(['ok' => false, 'error' => 'Could not encode vision request.'], 500);
}

$baseUrl = rtrim(trim((string)(getenv('MOONDREAM_API_BASE') ?: 'https://api.moondream.ai/v1')), '/');
if (!str_starts_with($baseUrl, 'https://')) {
    growlens_send_json(['ok' => false, 'error' => 'Invalid vision service configuration.'], 500);
}

$curl = curl_init($baseUrl . '/query');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'Content-Type: application/json',
        'X-Moondream-Auth: ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $payload,
]);
$responseBody = curl_exec($curl);
$status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);

if (!is_string($responseBody) || $responseBody === '' || $status < 200 || $status >= 300) {
    growlens_send_json(['ok' => false, 'error' => 'Vision service is temporarily unavailable.'], 502);
}

$response = json_decode($responseBody, true);
$answer = is_array($response) ? trim((string)($response['answer'] ?? '')) : '';
if ($answer === '') {
    growlens_send_json(['ok' => false, 'error' => 'Vision service returned no observation.'], 502);
}

$decoded = json_decode(trim($answer), true);
$fields = [];
if (is_array($decoded)) {
    foreach ([
        'overall_view',
        'visible_color_changes',
        'visible_spots_or_lesions',
        'leaf_shape_and_posture',
        'visible_pests_or_residue',
        'tissue_and_distribution',
        'image_quality_limits',
    ] as $key) {
        $value = growlens_clean_text($decoded[$key] ?? '', 500);
        if ($value !== '') $fields[$key] = $value;
    }
}

$summaryParts = [];
foreach ($fields as $key => $value) {
    if (strtolower($value) === 'not visible') continue;
    $summaryParts[] = str_replace('_', ' ', $key) . ': ' . $value;
}
$summary = $summaryParts !== [] ? implode('; ', $summaryParts) : growlens_clean_text($answer, 4000);

growlens_send_json([
    'ok' => true,
    'observation' => [
        'provider' => 'moondream',
        'mode' => 'visual-observation',
        'summary' => growlens_clean_text($summary, 4000),
        'fields' => $fields,
        'requestId' => growlens_clean_text(is_array($response) ? ($response['request_id'] ?? '') : '', 200),
        'analyzedAt' => growlens_now(),
    ]
]);
