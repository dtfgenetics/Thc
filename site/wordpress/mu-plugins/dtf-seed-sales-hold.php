<?php
/**
 * Plugin Name: DTF Seed Sales Hold
 * Description: Temporarily disables WooCommerce purchasing while genetics remain visible as references.
 * Version: 1.0.0
 *
 * Deployment note: placing this file in Git does not activate it on WordPress.
 * Install as wp-content/mu-plugins/dtf-seed-sales-hold.php and verify live.
 */
if (!defined('ABSPATH')) { exit; }

function dtf_seed_sales_hold_active(): bool {
    // Deliberately fail closed until the site owner explicitly retires this plugin.
    return true;
}

add_filter('woocommerce_is_purchasable', static function ($purchasable, $product) {
    return dtf_seed_sales_hold_active() ? false : $purchasable;
}, PHP_INT_MAX, 2);
add_filter('woocommerce_variation_is_purchasable', static function ($purchasable, $product) {
    return dtf_seed_sales_hold_active() ? false : $purchasable;
}, PHP_INT_MAX, 2);

add_filter('woocommerce_add_to_cart_validation', static function ($valid) {
    if (dtf_seed_sales_hold_active()) {
        if (function_exists('wc_add_notice')) {
            wc_add_notice(__('Seed sales are temporarily on hold. Purchasing is unavailable.', 'dtf'), 'error');
        }
        return false;
    }
    return $valid;
}, PHP_INT_MAX, 1);

add_action('woocommerce_check_cart_items', static function (): void {
    if (dtf_seed_sales_hold_active() && function_exists('wc_add_notice')) {
        wc_add_notice(__('Seed sales are temporarily on hold. Checkout is unavailable.', 'dtf'), 'error');
    }
}, PHP_INT_MAX);

// Enforce the suspension even if stale carts and checkout pages are still reachable.
add_action('woocommerce_checkout_process', static function (): void {
    if (dtf_seed_sales_hold_active() && function_exists('wc_add_notice')) {
        wc_add_notice(__('Seed sales are temporarily on hold. Checkout is unavailable.', 'dtf'), 'error');
    }
}, PHP_INT_MAX);

// The Store API uses a different validation path from classic checkout.
add_action('woocommerce_store_api_checkout_update_order_from_request', static function () {
    if (dtf_seed_sales_hold_active()) {
        if (class_exists('Automattic\\WooCommerce\\StoreApi\\Exceptions\\RouteException')) {\n            throw new \\Automattic\\WooCommerce\\StoreApi\\Exceptions\\RouteException('dtf_sales_hold', 'Seed sales are temporarily on hold. Checkout is unavailable.', 403);\n        }\n        throw new \\Exception('Seed sales are temporarily on hold. Checkout is unavailable.');
    }
}, PHP_INT_MAX, 1);

add_filter('woocommerce_loop_add_to_cart_link', static function ($html) {
    return dtf_seed_sales_hold_active() ? '<span class="dtf-sales-hold">Sales temporarily on hold</span>' : $html;
}, PHP_INT_MAX, 1);
