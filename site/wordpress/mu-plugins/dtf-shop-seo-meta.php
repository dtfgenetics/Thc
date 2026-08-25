<?php
/**
 * Plugin Name: DTF Shop SEO Meta
 * Description: Adds concise search metadata to the DTF Genetics WooCommerce shop archive.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function dtf_shop_seo_is_shop(): bool {
    return function_exists('is_shop') && is_shop();
}

function dtf_shop_seo_description(): string {
    return 'Shop current DTF Genetics seed releases with reviewed strain-card artwork, documented lineage and generation context, and links to each breeding project.';
}

add_filter('document_title_parts', static function (array $parts): array {
    if (!dtf_shop_seo_is_shop()) {
        return $parts;
    }
    $parts['title'] = 'DTF Genetics Seeds & Current Releases';
    return $parts;
}, 30);

// Use native integrations when a common SEO plugin is active so only one description is emitted.
if (defined('WPSEO_VERSION')) {
    add_filter('wpseo_metadesc', static function ($description) {
        return dtf_shop_seo_is_shop() ? dtf_shop_seo_description() : $description;
    }, 30);
} elseif (defined('RANK_MATH_VERSION')) {
    add_filter('rank_math/frontend/description', static function ($description) {
        return dtf_shop_seo_is_shop() ? dtf_shop_seo_description() : $description;
    }, 30);
} else {
    add_action('wp_head', static function (): void {
        if (!dtf_shop_seo_is_shop()) {
            return;
        }
        printf("\n<meta name=\"description\" content=\"%s\" />\n", esc_attr(dtf_shop_seo_description()));
    }, 1);
}
