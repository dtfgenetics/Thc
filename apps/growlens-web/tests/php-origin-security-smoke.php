<?php
declare(strict_types=1);

/**
 * Regression coverage for the PHP API's Origin boundary.
 * Each case runs in its own process because growlens_send_json() exits.
 */
$shared = realpath(dirname(__DIR__) . '/public/api/_shared.php');
if ($shared === false) {
    fwrite(STDERR, "Missing shared PHP helper.\n");
    exit(1);
}

$cases = [
    ['https://dtfseeds.com', 'dtfseeds.com', 'on', '443', true],
    ['https://dtfseeds.com:443', 'dtfseeds.com', 'on', '443', true],
    ['https://dtfseeds.com:8443', 'dtfseeds.com', 'on', '443', false],
    ['http://dtfseeds.com', 'dtfseeds.com', 'on', '443', false],
    ['https://evil.example', 'dtfseeds.com', 'on', '443', false],
    ['https://dtfseeds.com.evil.example', 'dtfseeds.com', 'on', '443', false],
    ['https://user@dtfseeds.com', 'dtfseeds.com', 'on', '443', false],
    ['null', 'dtfseeds.com', 'on', '443', false],
    ['http://localhost:8080', 'localhost:8080', 'off', '8080', true],
    ['http://localhost:8081', 'localhost:8080', 'off', '8080', false],
];

foreach ($cases as [$origin, $host, $https, $port, $allowed]) {
    $script = sprintf(
        '$_SERVER["HTTP_ORIGIN"]=%s;$_SERVER["HTTP_HOST"]=%s;$_SERVER["HTTPS"]=%s;$_SERVER["SERVER_PORT"]=%s;require %s;growlens_require_same_origin();echo "ACCEPTED";',
        var_export($origin, true),
        var_export($host, true),
        var_export($https, true),
        var_export($port, true),
        var_export($shared, true)
    );
    $command = escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($script);
    $output = [];
    $status = 0;
    exec($command, $output, $status);
    $response = implode("\n", $output);
    $accepted = str_contains($response, 'ACCEPTED');
    if ($status !== 0 || $accepted !== $allowed || (!$allowed && !str_contains($response, 'Origin rejected.'))) {
        fwrite(STDERR, sprintf("Origin regression failed for %s: %s\n", $origin, $response));
        exit(1);
    }
}

fwrite(STDOUT, "GrowLens Origin security regression passed.\n");
