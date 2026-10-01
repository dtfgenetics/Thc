<?php
/**
 * Plugin Name: DTF Canonical Sitemap Routes
 * Description: Extends the native WordPress sitemap with canonical DTF routes that are served outside normal WordPress post storage.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function dtf_canonical_sitemap_static_routes(): array {
    return [
        '/',
        '/seeds/',
        '/learn/',
        '/courses/',
        '/tools/',
        '/games/',
        '/community/',
        '/shop/',
        '/growlens/',
        '/thc-grow-doc/',
    ];
}

add_filter('wp_sitemaps_enabled', static function ($enabled): bool {
    return true;
}, PHP_INT_MAX);

if (class_exists('WP_Sitemaps_Provider')) {
    final class DTF_Canonical_Static_Sitemap_Provider extends WP_Sitemaps_Provider {
        public function __construct() {
            $this->name = 'dtf-static';
            $this->object_type = 'dtf-static';
        }

        public function get_url_list($page_num, $object_subtype = ''): array {
            if ((int) $page_num !== 1) {
                return [];
            }

            $urls = [];
            foreach (dtf_canonical_sitemap_static_routes() as $route) {
                $urls[] = ['loc' => home_url($route)];
            }
            return $urls;
        }

        public function get_max_num_pages($object_subtype = ''): int {
            return 1;
        }
    }

    add_action('wp_sitemaps_init', static function ($server): void {
        if (!isset($server->registry) || !method_exists($server->registry, 'add_provider')) {
            return;
        }
        $server->registry->add_provider('dtf-static', new DTF_Canonical_Static_Sitemap_Provider());
    }, PHP_INT_MAX);
}

add_filter('robots_txt', static function ($output, $public): string {
    $output = preg_replace('/^\s*Sitemap:\s*\S+\s*$/mi', '', (string) $output);
    $output = trim((string) $output);
    if ($output !== '') {
        $output .= "\n";
    }
    return $output . 'Sitemap: ' . home_url('/wp-sitemap.xml') . "\n";
}, PHP_INT_MAX, 2);
