<?php

declare(strict_types=1);

function image_smoke_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function image_smoke_remove_tree(string $path): void
{
    if (!is_dir($path)) {
        @unlink($path);
        return;
    }
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $child = $path . DIRECTORY_SEPARATOR . $entry;
        is_dir($child) ? image_smoke_remove_tree($child) : @unlink($child);
    }
    @rmdir($path);
}

$testRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'growlens-image-test-' . bin2hex(random_bytes(6));
$documentRoot = $testRoot . DIRECTORY_SEPARATOR . 'public_html';
$privateRoot = $testRoot . DIRECTORY_SEPARATOR . 'private-data';
mkdir($documentRoot, 0700, true);

putenv('GROWLENS_DATA_DIR=' . $privateRoot);
$_SERVER['DOCUMENT_ROOT'] = $documentRoot;
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once dirname(__DIR__) . '/public/api/_images.php';

$userId = 'user-' . str_repeat('a', 32);
$photoId = 'photo-smoke-test-12345678';

try {
    $directory = growlens_user_image_dir($userId);
    image_smoke_assert(is_dir($directory), 'User image directory should be created.');
    image_smoke_assert(!str_starts_with($directory, realpath($documentRoot) . DIRECTORY_SEPARATOR), 'Image storage must remain outside public_html.');

    $imagePath = $directory . DIRECTORY_SEPARATOR . $photoId . '.jpg';
    file_put_contents($imagePath, 'private-image-test');
    @chmod($imagePath, 0600);

    $metadata = [
        'id' => $photoId,
        'plantId' => null,
        'observationId' => 'observation-smoke-test',
        'capturedAt' => growlens_now(),
        'mimeType' => 'image/jpeg',
        'extension' => 'jpg',
        'width' => 1600,
        'height' => 1200,
        'bytes' => filesize($imagePath),
        'createdAt' => growlens_now()
    ];
    growlens_atomic_write_json(growlens_image_metadata_path($userId, $photoId), $metadata);

    $listed = growlens_list_image_metadata($userId);
    image_smoke_assert(count($listed) === 1, 'Private image metadata should be listed for its owner.');
    image_smoke_assert(($listed[0]['id'] ?? '') === $photoId, 'Listed metadata should identify the stored photo.');
    image_smoke_assert(growlens_image_file_path($userId, $listed[0]) === $imagePath, 'Stored image path should resolve inside the user directory.');

    // A malformed upload must not disturb an existing private image.
    // Validation is performed before any replacement or cleanup.
    $invalidUploadScript = sprintf(
        'putenv(%s);$_SERVER["DOCUMENT_ROOT"]=%s;require %s;growlens_store_uploaded_image(%s,%s,%s,null,%s,%s);',
        var_export('GROWLENS_DATA_DIR=' . $privateRoot, true),
        var_export($documentRoot, true),
        var_export(realpath(dirname(__DIR__) . '/public/api/_images.php'), true),
        var_export($userId, true),
        var_export($photoId, true),
        var_export(['error' => UPLOAD_ERR_INI_SIZE, 'tmp_name' => '', 'size' => 0], true),
        var_export('observation-smoke-test', true),
        var_export(growlens_now(), true)
    );
    $output = [];
    $exitStatus = 0;
    exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($invalidUploadScript), $output, $exitStatus);
    image_smoke_assert($exitStatus === 0 && str_contains(implode("\\n", $output), 'Image upload failed.'), 'Invalid upload must be rejected.');
    image_smoke_assert(file_get_contents($imagePath) === 'private-image-test', 'Rejected replacement must retain original bytes.');
    image_smoke_assert(is_array(growlens_get_image_metadata($userId, $photoId)), 'Rejected replacement must retain metadata.');

    image_smoke_assert(growlens_delete_image($userId, $photoId), 'Private image deletion should succeed.');
    image_smoke_assert(!is_file($imagePath), 'Private image bytes should be removed.');
    image_smoke_assert(!is_file(growlens_image_metadata_path($userId, $photoId)), 'Private image metadata should be removed.');

    growlens_delete_user_images($userId);
    image_smoke_assert(!is_dir($directory), 'Account image directory should be removable.');

    fwrite(STDOUT, "GrowLens private image storage smoke test passed.\n");
} finally {
    image_smoke_remove_tree($testRoot);
}
