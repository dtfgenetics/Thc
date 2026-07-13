<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';
require_once __DIR__ . '/_operations.php';

growlens_require_method('GET');
growlens_begin_storage_access();
$context = growlens_current_session(true);
$userId = (string)$context['user']['id'];
$photoId = growlens_validate_photo_id($_GET['id'] ?? '');
$metadata = growlens_get_image_metadata($userId, $photoId);

if (!is_array($metadata)) {
    growlens_send_json([
        'ok' => false,
        'error' => 'Image not found.'
    ], 404);
}

$filePath = growlens_image_file_path($userId, $metadata);
if (!is_file($filePath)) {
    growlens_send_json([
        'ok' => false,
        'error' => 'Image file is unavailable.'
    ], 404);
}

$mimeType = (string)($metadata['mimeType'] ?? 'application/octet-stream');
$fileSize = filesize($filePath);
http_response_code(200);
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . (string)($fileSize ?: 0));
header('Content-Disposition: inline; filename="' . $photoId . '"');
header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
readfile($filePath);
