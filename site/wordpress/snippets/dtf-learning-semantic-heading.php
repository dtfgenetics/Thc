<?php
/**
 * DTF Learning semantic heading owner.
 *
 * WordPress keeps each page title for admin, SEO and document-title use. On the
 * Teaching Healthy Cultivation routes the source-controlled page body already
 * owns the visitor-facing H1, so the block-theme post-title must not render a
 * second H1 above it.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('dtf_learning_page_owns_designed_h1')) {
    function dtf_learning_page_owns_designed_h1(): bool
    {
        if (is_admin() || !is_page()) {
            return false;
        }

        $post = get_queried_object();
        if (!($post instanceof WP_Post)) {
            return false;
        }

        $page_uri = trim((string) get_page_uri($post), '/');
        if ($page_uri === '' && !is_front_page()) {
            return false;
        }

        $content = (string) $post->post_content;
        if (!preg_match('/<h1\b/i', $content)) {
            return false;
        }

        return true;
    }
}

if (!function_exists('dtf_learning_remove_duplicate_theme_title')) {
    function dtf_learning_remove_duplicate_theme_title(string $block_content, array $block = []): string
    {
        if (!dtf_learning_page_owns_designed_h1()) {
            return $block_content;
        }

        return '';
    }
}

add_filter('render_block_core/post-title', 'dtf_learning_remove_duplicate_theme_title', 100, 2);

if (!function_exists('dtf_woocommerce_archive_owns_designed_h1')) {
    function dtf_woocommerce_archive_owns_designed_h1(): bool
    {
        if (is_admin()) {
            return false;
        }
        $is_shop = function_exists('is_shop') && is_shop();
        $is_product_category = function_exists('is_product_category') && is_product_category();
        $is_product_tag = function_exists('is_product_tag') && is_product_tag();
        return $is_shop || $is_product_category || $is_product_tag;
    }
}

if (!function_exists('dtf_remove_duplicate_woocommerce_query_title')) {
    function dtf_remove_duplicate_woocommerce_query_title(string $block_content, array $block = []): string
    {
        return dtf_woocommerce_archive_owns_designed_h1() ? '' : $block_content;
    }
}

add_filter('render_block_core/query-title', 'dtf_remove_duplicate_woocommerce_query_title', 100, 2);
