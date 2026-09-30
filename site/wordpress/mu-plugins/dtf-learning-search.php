<?php
/**
 * Plugin Name: DTF Learning Search Runtime
 * Description: Serves and boots the THC Learning Center search runtime outside post-content sanitization.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

const DTF_LEARNING_SEARCH_VERSION = '1.0.0';
const DTF_LEARNING_SEARCH_NAMESPACE = 'dtf-learning/v1';

function dtf_learning_search_option_key(string $kind): string {
    return $kind === 'search'
        ? 'dtf_learning_search_index_v1'
        : 'dtf_learning_encyclopedia_index_v1';
}

function dtf_learning_search_validate_payload(string $kind, $payload): bool {
    if (!is_array($payload)) {
        return false;
    }
    if ($kind === 'search') {
        return isset($payload['documents']) && is_array($payload['documents']) && count($payload['documents']) >= 20;
    }
    return isset($payload['schemaVersion'], $payload['lessons'], $payload['topics'])
        && (int) $payload['schemaVersion'] >= 2
        && is_array($payload['lessons'])
        && count($payload['lessons']) >= 420
        && is_array($payload['topics'])
        && count($payload['topics']) >= 21;
}

function dtf_learning_search_read_index(string $kind) {
    $raw = get_option(dtf_learning_search_option_key($kind), '');
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function dtf_learning_search_write_index(WP_REST_Request $request) {
    $kind = (string) $request['kind'];
    $payload = $request->get_json_params();
    if (!dtf_learning_search_validate_payload($kind, $payload)) {
        return new WP_Error(
            'dtf_learning_search_invalid_payload',
            'Search index payload failed validation.',
            ['status' => 400]
        );
    }

    $json = wp_json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') {
        return new WP_Error('dtf_learning_search_encode_failed', 'Search index JSON encoding failed.', ['status' => 500]);
    }

    update_option(dtf_learning_search_option_key($kind), $json, false);
    update_option(
        'dtf_learning_search_meta_v1',
        wp_json_encode([
            'updatedAt' => gmdate('c'),
            'kind' => $kind,
            'bytes' => strlen($json),
            'sha256' => hash('sha256', $json),
        ]),
        false
    );

    return [
        'ok' => true,
        'kind' => $kind,
        'bytes' => strlen($json),
        'sha256' => hash('sha256', $json),
    ];
}

function dtf_learning_search_get_index(WP_REST_Request $request) {
    $kind = (string) $request['kind'];
    $payload = dtf_learning_search_read_index($kind);
    if (!$payload) {
        return new WP_Error('dtf_learning_search_missing_index', 'Search index is not published yet.', ['status' => 404]);
    }

    $response = new WP_REST_Response($payload, 200);
    $response->header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return $response;
}

add_action('rest_api_init', static function (): void {
    register_rest_route(DTF_LEARNING_SEARCH_NAMESPACE, '/health', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => static function () {
            $search = dtf_learning_search_read_index('search');
            $encyclopedia = dtf_learning_search_read_index('encyclopedia');
            return [
                'ok' => true,
                'version' => DTF_LEARNING_SEARCH_VERSION,
                'searchReady' => is_array($search),
                'encyclopediaReady' => is_array($encyclopedia),
                'searchDocuments' => is_array($search['documents'] ?? null) ? count($search['documents']) : 0,
                'encyclopediaLessons' => is_array($encyclopedia['lessons'] ?? null) ? count($encyclopedia['lessons']) : 0,
            ];
        },
    ]);

    register_rest_route(DTF_LEARNING_SEARCH_NAMESPACE, '/index/(?P<kind>search|encyclopedia)', [
        [
            'methods' => WP_REST_Server::READABLE,
            'permission_callback' => '__return_true',
            'callback' => 'dtf_learning_search_get_index',
        ],
        [
            'methods' => WP_REST_Server::CREATABLE,
            'permission_callback' => static function (): bool {
                return current_user_can('manage_options');
            },
            'callback' => 'dtf_learning_search_write_index',
        ],
    ]);
});

function dtf_learning_search_surface(): string {
    $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $path = '/' . ltrim((string) $path, '/');
    $path = untrailingslashit($path);

    if ($path === '/learn/search') {
        return 'search';
    }
    if ($path === '/learn/encyclopedia') {
        return 'encyclopedia';
    }
    return '';
}

add_action('wp_footer', static function (): void {
    $surface = dtf_learning_search_surface();
    if ($surface === '') {
        return;
    }

    $asset_base = content_url('/mu-plugins/dtf-learning-search/');
    $runtime = $surface === 'search' ? 'search-v1.js' : 'encyclopedia-v1.js';
    $config = [
        'surface' => $surface,
        'version' => DTF_LEARNING_SEARCH_VERSION,
        'searchIndexUrl' => rest_url(DTF_LEARNING_SEARCH_NAMESPACE . '/index/search'),
        'encyclopediaIndexUrl' => rest_url(DTF_LEARNING_SEARCH_NAMESPACE . '/index/encyclopedia'),
        'runtimeUrl' => $asset_base . $runtime . '?v=' . rawurlencode(DTF_LEARNING_SEARCH_VERSION),
    ];
    ?>
    <div data-dtf-learning-search-runtime="mu-v1" data-dtf-learning-search-surface="<?php echo esc_attr($surface); ?>" hidden></div>
    <script type="module" data-dtf-learning-search-bootstrap="mu-v1">
    const config=<?php echo wp_json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
    try {
      if (config.surface === 'search') {
        const response = await fetch(config.searchIndexUrl, {credentials:'same-origin', cache:'no-store'});
        if (!response.ok) throw new Error('Search index request failed: '+response.status);
        window.__THC_SEARCH_INDEX__ = await response.json();
        window.__THC_ENCYCLOPEDIA_INDEX__ = {lessons:[]};
      } else {
        const response = await fetch(config.encyclopediaIndexUrl, {credentials:'same-origin', cache:'no-store'});
        if (!response.ok) throw new Error('Encyclopedia index request failed: '+response.status);
        window.__THC_ENCYCLOPEDIA_INDEX__ = await response.json();
      }
      await import(config.runtimeUrl);
    } catch (error) {
      console.error('[DTF Learning Search]', error);
      document.documentElement.dataset.dtfLearningSearchError = 'true';
    }
    </script>
    <?php
}, 40);
