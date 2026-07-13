<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

const GROWLENS_MAX_IMAGE_BYTES = 6291456;
const GROWLENS_MAX_IMAGE_EDGE = 4000;

function growlens_validate_photo_id($value): string
{
    $photoId = growlens_clean_text($value, 140);
    if (!preg_match('/^photo-[A-Za-z0-9-]{8,130}$/', $photoId)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Invalid photo identifier.'
        ], 400);
    }
    return $photoId;
}

function growlens_image_root(): string
{
    return growlens_ensure_dir(growlens_private_root() . DIRECTORY_SEPARATOR . 'images');
}

function growlens_user_image_dir(string $userId): string
{
    if (!preg_match('/^user-[a-f0-9]{32}$/', $userId)) {
        growlens_send_json(['ok' => false, 'error' => 'Invalid user identifier.'], 500);
    }
    return growlens_ensure_dir(growlens_image_root() . DIRECTORY_SEPARATOR . $userId);
}

function growlens_image_metadata_path(string $userId, string $photoId): string
{
    return growlens_user_image_dir($userId) . DIRECTORY_SEPARATOR . $photoId . '.json';
}

function growlens_allowed_image_types(): array
{
    return [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp'
    ];
}

function growlens_store_uploaded_image(
    string $userId,
    string $photoId,
    array $upload,
    ?string $plantId,
    string $observationId,
    string $capturedAt
): array {
    $error = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Image upload failed.'
        ], 400);
    }

    $temporaryPath = (string)($upload['tmp_name'] ?? '');
    $size = (int)($upload['size'] ?? 0);
    if ($temporaryPath === '' || !is_file($temporaryPath) || $size <= 0 || $size > GROWLENS_MAX_IMAGE_BYTES) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Image must be between 1 byte and 6 MB.'
        ], 413);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = (string)$finfo->file($temporaryPath);
    $allowedTypes = growlens_allowed_image_types();
    if (!isset($allowedTypes[$mimeType])) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Uploaded file is not an accepted image.'
        ], 415);
    }

    $imageInfo = @getimagesize($temporaryPath);
    $width = is_array($imageInfo) ? (int)($imageInfo[0] ?? 0) : 0;
    $height = is_array($imageInfo) ? (int)($imageInfo[1] ?? 0) : 0;
    if ($width <= 0 || $height <= 0 || max($width, $height) > GROWLENS_MAX_IMAGE_EDGE) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Image dimensions are invalid or exceed 4000 pixels.'
        ], 400);
    }

    $extension = $allowedTypes[$mimeType];
    $directory = growlens_user_image_dir($userId);
    foreach (['jpg', 'png', 'webp'] as $candidateExtension) {
        $candidate = $directory . DIRECTORY_SEPARATOR . $photoId . '.' . $candidateExtension;
        if ($candidateExtension !== $extension) {
            @unlink($candidate);
        }
    }

    $destination = $directory . DIRECTORY_SEPARATOR . $photoId . '.' . $extension;
    if (!move_uploaded_file($temporaryPath, $destination)) {
        growlens_send_json([
            'ok' => false,
            'error' => 'Could not store the uploaded image.'
        ], 500);
    }
    @chmod($destination, 0600);

    $metadata = [
        'id' => $photoId,
        'plantId' => $plantId,
        'observationId' => $observationId,
        'capturedAt' => $capturedAt,
        'mimeType' => $mimeType,
        'extension' => $extension,
        'width' => $width,
        'height' => $height,
        'bytes' => filesize($destination) ?: $size,
        'createdAt' => growlens_now()
    ];
    growlens_atomic_write_json(growlens_image_metadata_path($userId, $photoId), $metadata);
    return $metadata;
}

function growlens_get_image_metadata(string $userId, string $photoId): ?array
{
    return growlens_read_json_file(growlens_image_metadata_path($userId, $photoId));
}

function growlens_image_file_path(string $userId, array $metadata): string
{
    $photoId = growlens_validate_photo_id($metadata['id'] ?? '');
    $extension = (string)($metadata['extension'] ?? '');
    if (!in_array($extension, ['jpg', 'png', 'webp'], true)) {
        growlens_send_json(['ok' => false, 'error' => 'Stored image metadata is invalid.'], 500);
    }
    return growlens_user_image_dir($userId) . DIRECTORY_SEPARATOR . $photoId . '.' . $extension;
}

function growlens_list_image_metadata(string $userId): array
{
    $directory = growlens_user_image_dir($userId);
    $images = [];
    foreach (glob($directory . DIRECTORY_SEPARATOR . 'photo-*.json') ?: [] as $metadataPath) {
        $metadata = growlens_read_json_file($metadataPath);
        if (is_array($metadata)) {
            $images[] = $metadata;
        }
    }
    usort($images, static fn(array $first, array $second): int => strcmp(
        (string)($second['capturedAt'] ?? ''),
        (string)($first['capturedAt'] ?? '')
    ));
    return $images;
}

function growlens_delete_image(string $userId, string $photoId): bool
{
    $metadataPath = growlens_image_metadata_path($userId, $photoId);
    $metadata = growlens_read_json_file($metadataPath);
    if (!is_array($metadata)) {
        return false;
    }

    $filePath = growlens_image_file_path($userId, $metadata);
    $deletedFile = !is_file($filePath) || @unlink($filePath);
    $deletedMetadata = !is_file($metadataPath) || @unlink($metadataPath);
    @unlink($metadataPath . '.lock');
    return $deletedFile && $deletedMetadata;
}

function growlens_remove_directory_tree(string $path): void
{
    if (!is_dir($path)) {
        @unlink($path);
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $child = $path . DIRECTORY_SEPARATOR . $entry;
        is_dir($child) ? growlens_remove_directory_tree($child) : @unlink($child);
    }
    @rmdir($path);
}

function growlens_delete_user_images(string $userId): void
{
    $directory = growlens_image_root() . DIRECTORY_SEPARATOR . $userId;
    growlens_remove_directory_tree($directory);
}
