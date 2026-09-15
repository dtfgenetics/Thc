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
        if ($page_uri !== 'learn' && strpos($page_uri, 'learn/') !== 0) {
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
