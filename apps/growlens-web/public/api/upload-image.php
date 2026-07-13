<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';
require_once __DIR__ . '/_operations.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_begin_storage_access();
$context = growlens_current_session(true);
growlens_require_csrf($context);
$userId = (string)$context['user']['id'];
growlens_rate_limit('image-upload-' . $userId, 120, 3600);

$photoId = growlens_validate_photo_id($_POST['photoId'] ?? '');
$plantIdValue = growlens_clean_text($_POST['plantId'] ?? '', 140);
$plantId = $plantIdValue !== '' ? $plantIdValue : null;
$observationId = growlens_clean_text($_POST['observationId'] ?? '', 140);
if ($observationId === '') {
    growlens_send_json(['ok' => false, 'error' => 'Observation identifier is required.'], 400);
}
$capturedAt = growlens_clean_text($_POST['capturedAt'] ?? growlens_now(), 64);
$upload = $_FILES['image'] ?? null;
if (!is_array($upload)) {
    growlens_send_json(['ok' => false, 'error' => 'Image file is required.'], 400);
}

$metadata = growlens_store_uploaded_image(
    $userId,
    $photoId,
    $upload,
    $plantId,
    $observationId,
    $capturedAt
);

growlens_send_json([
    'ok' => true,
    'image' => $metadata
], 201);
