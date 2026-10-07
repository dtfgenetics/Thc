<?php

declare(strict_types=1);

require_once __DIR__ . '/_ai.php';
require_once __DIR__ . '/_operations.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_begin_storage_access();
$context = growlens_current_session(true);
growlens_require_csrf($context);
$userId = (string)$context['user']['id'];
growlens_rate_limit('ai-visual-' . $userId, 60, 3600);

$body = growlens_read_json_body(32768);
$photoId = growlens_validate_photo_id($body['photoId'] ?? '');
$metadata = growlens_get_image_metadata($userId, $photoId);
if (!is_array($metadata)) {
    growlens_send_json(['ok' => false, 'error' => 'Photo not found.'], 404);
}
$filePath = growlens_image_file_path($userId, $metadata);
$imageBytes = is_file($filePath) ? file_get_contents($filePath) : false;
if (!is_string($imageBytes) || $imageBytes === '') {
    growlens_send_json(['ok' => false, 'error' => 'Stored photo is unavailable.'], 404);
}

$provider = growlens_ai_post_json(growlens_ai_gateway_url('visual-observation'), [
    'task' => 'visual-observation',
    'contractVersion' => 1,
    'models' => [
        'detector' => 'ultralytics-yolo',
        'describer' => 'moondream'
    ],
    'image' => [
        'id' => $photoId,
        'mimeType' => (string)($metadata['mimeType'] ?? 'application/octet-stream'),
        'base64' => base64_encode($imageBytes)
    ],
    'constraints' => [
        'visibleEvidenceOnly' => true,
        'diagnosticClaimsAllowed' => false
    ]
]);

$regions = [];
foreach (($provider['regions'] ?? []) as $region) {
    if (!is_array($region)) continue;
    $label = growlens_clean_text($region['label'] ?? '', 120);
    if ($label === '') continue;
    $confidence = isset($region['confidence']) && is_numeric($region['confidence'])
        ? max(0.0, min(1.0, (float)$region['confidence']))
        : null;
    $clean = ['label' => $label, 'confidence' => $confidence];
    if (isset($region['box']) && is_array($region['box'])) {
        $box = $region['box'];
        $values = [];
        foreach (['x', 'y', 'width', 'height'] as $key) {
            if (!isset($box[$key]) || !is_numeric($box[$key])) {
                $values = [];
                break;
            }
            $values[$key] = max(0.0, min(1.0, (float)$box[$key]));
        }
        if ($values !== [] && $values['width'] > 0 && $values['height'] > 0) $clean['box'] = $values;
    }
    $regions[] = $clean;
    if (count($regions) >= 80) break;
}

growlens_send_json([
    'ok' => true,
    'observation' => [
        'providerId' => growlens_clean_text($provider['providerId'] ?? 'configured-vision-gateway', 80),
        'modelId' => growlens_clean_text($provider['modelId'] ?? 'moondream+yolo', 120),
        'mediaRef' => $photoId,
        'observedAt' => growlens_now(),
        'summary' => growlens_clean_text($provider['summary'] ?? '', 2000),
        'visibleFindings' => growlens_ai_clean_list($provider['visibleFindings'] ?? [], 40, 160),
        'regions' => $regions,
        'limitations' => growlens_ai_clean_list($provider['limitations'] ?? [], 20, 240)
    ],
    'diagnosticClaims' => []
]);
