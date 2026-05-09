<?php
/**
 * Plugin Name: GST Report for WooCommerce
 * Plugin URI:  https://wordpress.org/plugins/gst-report-for-woocommerce/
 * Description: Native PHP GST Dashboard — direct DB, no REST API, no JavaScript frameworks.
 * Version:     2.0.7
 * Author:      Setups Works
 * Author URI:  https://setups.works/
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: gst-report-for-woocommerce
 * Requires at least: 5.9
 * Tested up to: 6.9
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 9.4
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'GST_REPORT_PATH', plugin_dir_path( __FILE__ ) );
define( 'GST_REPORT_URL',  plugin_dir_url( __FILE__ ) );

require_once GST_REPORT_PATH . 'includes/class-gst-calculator.php';
require_once GST_REPORT_PATH . 'includes/class-xlsx-writer.php';
require_once GST_REPORT_PATH . 'includes/class-admin-page.php';
require_once GST_REPORT_PATH . 'includes/class-wizard.php';

// On activation: set transient so the wizard redirect fires on next admin load
register_activation_hook( __FILE__, function () {
    set_transient( 'gst_report_activation_redirect', true, 30 );
} );

add_action( 'admin_init', function () {
    // Wizard: redirect after activation
    GST_Wizard::maybe_redirect();

    // Wizard: handle form saves
    GST_Wizard::handle_save();

    // Dashboard: handle CSV export
    if ( sanitize_key( wp_unslash( $_GET['page'] ?? '' ) ) !== 'gst-report' ) return; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    if ( ! current_user_can( 'manage_woocommerce' ) ) return;

    if ( sanitize_key( $_GET['action'] ?? '' ) === 'export_csv' ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        check_admin_referer( 'gst_export' );
        GST_Admin_Page::export_csv();
        exit;
    }
} );

add_action( 'admin_menu', function () {
    add_menu_page(
        'GST Report',
        'GST Report',
        'manage_woocommerce',
        'gst-report',
        [ 'GST_Admin_Page', 'render' ],
        'dashicons-chart-bar',
        56
    );
    GST_Wizard::register_page();
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( 'toplevel_page_gst-report' !== $hook ) return;
    wp_enqueue_style( 'gst-report', GST_REPORT_URL . 'assets/admin.css', [], '2.0.1' );
} );
