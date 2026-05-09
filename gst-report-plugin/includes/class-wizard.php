<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GST_Wizard {

    // ── Activation redirect ───────────────────────────────────────────────────

    public static function maybe_redirect(): void {
        if ( ! get_transient( 'gst_report_activation_redirect' ) ) return;
        delete_transient( 'gst_report_activation_redirect' );
        if ( ! current_user_can( 'manage_woocommerce' ) ) return;
        if ( wp_doing_ajax() ) return;
        wp_safe_redirect( admin_url( 'admin.php?page=gst-report-setup&step=1' ) );
        exit;
    }

    // ── Register hidden wizard page ───────────────────────────────────────────

    public static function register_page(): void {
        add_submenu_page(
            null,
            'GST Report Setup',
            'GST Report Setup',
            'manage_woocommerce',
            'gst-report-setup',
            [ self::class, 'render' ]
        );
    }

    // ── Handle form POST (admin_init, before output) ──────────────────────────

    public static function handle_save(): void {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ( ( sanitize_key( wp_unslash( $_GET['page'] ?? '' ) ) ) !== 'gst-report-setup' ) return;
        if ( empty( $_POST['gst_wizard_nonce'] ) ) return;
        if ( ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['gst_wizard_nonce'] ) ), 'gst_wizard_save' ) ) return;
        if ( ! current_user_can( 'manage_woocommerce' ) ) return;

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $step = max( 1, absint( $_GET['step'] ?? 1 ) );

        if ( $step === 4 && isset( $_POST['access_key'] ) ) {
            update_option( 'gst_report_wcpdf_access_key', sanitize_text_field( wp_unslash( $_POST['access_key'] ) ) );
        }

        wp_safe_redirect( admin_url( 'admin.php?page=gst-report-setup&step=' . ( $step + 1 ) ) );
        exit;
    }

    // ── Main render ───────────────────────────────────────────────────────────

    public static function render(): void {
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( esc_html__( 'Insufficient permissions.', 'gst-report-for-woocommerce' ) );
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $step = max( 1, min( 5, absint( $_GET['step'] ?? 1 ) ) );

        wp_enqueue_style( 'gst-wizard', GST_REPORT_URL . 'assets/wizard.css', [], '2.0.1' );

        $step_labels = [ 1 => 'Welcome', 2 => 'HSN Codes', 3 => 'GST Rates', 4 => 'PDF Invoices', 5 => 'Done' ];
        ?>
        <div class="gst-wizard-wrap">

            <div class="gst-wizard-header">
                <div class="gst-wizard-brand">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                    <span>Setups Works</span>
                </div>
                <div class="gst-wizard-title">GST Report for WooCommerce &mdash; Setup Wizard</div>
            </div>

            <div class="gst-wizard-steps">
                <?php foreach ( $step_labels as $n => $label ) : ?>
                    <div class="gst-wstep <?php echo $n < $step ? 'done' : ( $n === $step ? 'active' : '' ); ?>">
                        <div class="gst-wstep-num"><?php echo $n < $step ? '✓' : esc_html( $n ); ?></div>
                        <div class="gst-wstep-label"><?php echo esc_html( $label ); ?></div>
                    </div>
                    <?php if ( $n < 5 ) : ?>
                        <div class="gst-wstep-line <?php echo $n < $step ? 'done' : ''; ?>"></div>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>

            <div class="gst-wizard-body">
                <?php
                switch ( $step ) {
                    case 1: self::step_welcome(); break;
                    case 2: self::step_hsn(); break;
                    case 3: self::step_gst_rates(); break;
                    case 4: self::step_pdf_invoices(); break;
                    default: self::step_done(); break;
                }
                ?>
            </div>

            <div class="gst-wizard-footer">
                Powered by <strong>Setups Works</strong> &mdash; <a href="https://setups.works/" target="_blank">setups.works</a>
            </div>

        </div>
        <?php
    }

    // ── Step 1: Welcome ───────────────────────────────────────────────────────

    private static function step_welcome(): void {
        ?>
        <div class="gst-wcard">
            <div class="gst-wcard-icon">🇮🇳</div>
            <h2>Welcome to GST Report for WooCommerce</h2>
            <p>This wizard will check your store in 3 quick steps so your GST dashboard reports accurately from day one.</p>
            <ul class="gst-checklist">
                <li><span class="gst-dot blue"></span> Verify HSN codes are set on your products</li>
                <li><span class="gst-dot blue"></span> Confirm 18% and 5% GST tax rates are configured</li>
                <li><span class="gst-dot blue"></span> Connect PDF Invoices &amp; Packing Slips for one-click invoices</li>
            </ul>
            <div class="gst-wactions">
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=2' ) ); ?>" class="gst-btn gst-btn-primary">Let&rsquo;s go &rarr;</a>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report' ) ); ?>" class="gst-btn gst-btn-ghost">Skip setup</a>
            </div>
        </div>
        <?php
    }

    // ── Step 2: HSN Check ─────────────────────────────────────────────────────

    private static function step_hsn(): void {
        $products = wc_get_products( [ 'limit' => -1, 'return' => 'objects', 'status' => 'publish' ] );
        $missing  = [];
        $found    = 0;

        foreach ( $products as $product ) {
            $hsn = $product->get_meta( 'hsn' ) ?: $product->get_meta( '_hsn_code' );
            if ( ! $hsn ) {
                foreach ( $product->get_attributes() as $attr ) {
                    if ( stripos( $attr->get_name(), 'hsn' ) !== false ) {
                        $opts = $attr->get_options();
                        if ( ! empty( $opts ) ) { $hsn = true; break; }
                    }
                }
            }
            $hsn ? $found++ : ( $missing[] = $product );
        }

        $total  = count( $products );
        $status = empty( $missing ) ? 'ok' : ( $found > 0 ? 'warn' : 'error' );
        ?>
        <div class="gst-wcard">
            <h2>HSN Code Check</h2>
            <p>HSN codes are required on every product for accurate GST line-item reporting and Excel exports.</p>

            <div class="gst-alert gst-alert-<?php echo esc_attr( $status ); ?>">
                <?php if ( $status === 'ok' ) : ?>
                    ✅ <strong>All <?php echo esc_html( $total ); ?> products have HSN codes.</strong> You&rsquo;re good to go.
                <?php elseif ( $status === 'warn' ) : ?>
                    ⚠️ <strong><?php echo esc_html( $found ); ?> of <?php echo esc_html( $total ); ?> products have HSN codes.</strong>
                    <?php echo esc_html( count( $missing ) ); ?> products are missing an HSN code.
                <?php else : ?>
                    ❌ <strong>No products have HSN codes set.</strong> All <?php echo esc_html( $total ); ?> products need an HSN code before GST reporting will be accurate.
                <?php endif; ?>
            </div>

            <?php if ( ! empty( $missing ) ) : ?>
                <p class="gst-label">Products missing HSN code <span class="gst-badge"><?php echo esc_html( count( $missing ) ); ?></span></p>
                <div class="gst-table-scroll">
                    <table class="gst-wtable">
                        <thead><tr><th>Product</th><th>SKU</th><th>Action</th></tr></thead>
                        <tbody>
                        <?php foreach ( array_slice( $missing, 0, 25 ) as $p ) : ?>
                            <tr>
                                <td><?php echo esc_html( $p->get_name() ); ?></td>
                                <td><?php echo esc_html( $p->get_sku() ?: '—' ); ?></td>
                                <td><a href="<?php echo esc_url( get_edit_post_link( $p->get_id() ) ); ?>" target="_blank" class="gst-btn gst-btn-sm">Edit &rarr;</a></td>
                            </tr>
                        <?php endforeach; ?>
                        <?php if ( count( $missing ) > 25 ) : ?>
                            <tr><td colspan="3" style="color:#888;font-style:italic">… and <?php echo esc_html( count( $missing ) - 25 ); ?> more products</td></tr>
                        <?php endif; ?>
                        </tbody>
                    </table>
                </div>
                <p class="gst-hint">Add HSN code as a custom field with key <code>hsn</code> on each product, or as a product attribute whose name contains "HSN".</p>
            <?php endif; ?>

            <div class="gst-wactions">
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=3' ) ); ?>" class="gst-btn gst-btn-primary">Next &rarr;</a>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=1' ) ); ?>" class="gst-btn gst-btn-ghost">&larr; Back</a>
            </div>
        </div>
        <?php
    }

    // ── Step 3: GST Tax Rates ─────────────────────────────────────────────────

    private static function step_gst_rates(): void {
        $tax_enabled = get_option( 'woocommerce_calc_taxes' ) === 'yes';
        $all_rates   = [];

        if ( $tax_enabled ) {
            foreach ( WC_Tax::get_rates( '' ) as $rate ) {
                $all_rates[] = [ 'class' => 'Standard', 'name' => $rate['label'], 'rate' => (float) $rate['rate'] ];
            }
            foreach ( WC_Tax::get_tax_classes() as $class ) {
                foreach ( WC_Tax::get_rates( sanitize_title( $class ) ) as $rate ) {
                    $all_rates[] = [ 'class' => $class, 'name' => $rate['label'], 'rate' => (float) $rate['rate'] ];
                }
            }
        }

        $has18 = false;
        $has5  = false;
        foreach ( $all_rates as $r ) {
            if ( abs( $r['rate'] - 18 ) < 0.1 ) $has18 = true;
            if ( abs( $r['rate'] -  5 ) < 0.1 ) $has5  = true;
        }
        ?>
        <div class="gst-wcard">
            <h2>GST Tax Rate Check</h2>
            <p>The plugin expects an <strong>18% GST</strong> rate on the Standard tax class, and optionally a <strong>5% GST</strong> tax class for reduced-rate items.</p>

            <?php if ( ! $tax_enabled ) : ?>
                <div class="gst-alert gst-alert-error">
                    ❌ <strong>WooCommerce taxes are disabled.</strong>
                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=wc-settings&tab=general' ) ); ?>" target="_blank">Enable taxes &rarr;</a>
                </div>
            <?php else : ?>
                <div class="gst-rate-grid">
                    <div class="gst-rate-card <?php echo $has18 ? 'ok' : 'missing'; ?>">
                        <div class="gst-rate-icon"><?php echo $has18 ? '✅' : '❌'; ?></div>
                        <div class="gst-rate-pct">18%</div>
                        <div class="gst-rate-name">GST (Standard)</div>
                        <div class="gst-rate-status"><?php echo $has18 ? 'Configured' : 'Not found'; ?></div>
                    </div>
                    <div class="gst-rate-card <?php echo $has5 ? 'ok' : 'missing'; ?>">
                        <div class="gst-rate-icon"><?php echo $has5 ? '✅' : '⚠️'; ?></div>
                        <div class="gst-rate-pct">5%</div>
                        <div class="gst-rate-name">GST (Reduced)</div>
                        <div class="gst-rate-status"><?php echo $has5 ? 'Configured' : 'Optional — not found'; ?></div>
                    </div>
                </div>

                <?php if ( ! empty( $all_rates ) ) : ?>
                    <p class="gst-label" style="margin-top:24px">Your configured tax rates</p>
                    <table class="gst-wtable">
                        <thead><tr><th>Tax Class</th><th>Label</th><th>Rate</th></tr></thead>
                        <tbody>
                        <?php foreach ( $all_rates as $r ) : ?>
                            <tr>
                                <td><?php echo esc_html( $r['class'] ); ?></td>
                                <td><?php echo esc_html( $r['name'] ); ?></td>
                                <td><strong><?php echo esc_html( number_format( $r['rate'], 2 ) ); ?>%</strong></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>

                <?php if ( ! $has18 ) : ?>
                    <p class="gst-hint" style="color:#c0392b">
                        No 18% rate found. <a href="<?php echo esc_url( admin_url( 'admin.php?page=wc-settings&tab=tax&section=standard' ) ); ?>" target="_blank">Configure tax rates &rarr;</a>
                    </p>
                <?php endif; ?>
            <?php endif; ?>

            <div class="gst-wactions">
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=4' ) ); ?>" class="gst-btn gst-btn-primary">Next &rarr;</a>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=2' ) ); ?>" class="gst-btn gst-btn-ghost">&larr; Back</a>
            </div>
        </div>
        <?php
    }

    // ── Step 4: PDF Invoices ──────────────────────────────────────────────────

    private static function step_pdf_invoices(): void {
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $is_active   = is_plugin_active( 'woocommerce-pdf-invoices-packing-slips/woocommerce-pdf-invoices-packing-slips.php' );
        $general     = get_option( 'wpo_wcpdf_settings_general', [] );
        $access_type = ( is_array( $general ) && ! empty( $general['document_link_access_type'] ) )
                       ? $general['document_link_access_type']
                       : 'logged_in';
        $is_full     = $access_type === 'full';
        $all_ok      = $is_active && $is_full;
        ?>
        <div class="gst-wcard">
            <h2>PDF Invoices &amp; Packing Slips</h2>
            <p>The <strong>Invoice</strong> button in the GST dashboard generates PDF invoices via the <em>PDF Invoices &amp; Packing Slips for WooCommerce</em> plugin. The access key is read automatically from each order — no manual entry needed.</p>

            <!-- Plugin check -->
            <div class="gst-alert gst-alert-<?php echo $is_active ? 'ok' : 'error'; ?>">
                <?php if ( $is_active ) : ?>
                    ✅ <strong>PDF Invoices &amp; Packing Slips is installed and active.</strong>
                <?php else : ?>
                    ❌ <strong>Plugin not found.</strong>
                    <a href="<?php echo esc_url( admin_url( 'plugin-install.php?s=PDF+Invoices+Packing+Slips+WooCommerce&tab=search&type=term' ) ); ?>" target="_blank">Install it &rarr;</a>
                <?php endif; ?>
            </div>

            <!-- Access type check -->
            <?php if ( $is_active ) : ?>
            <div class="gst-alert gst-alert-<?php echo $is_full ? 'ok' : 'warn'; ?>" style="margin-top:10px">
                <?php if ( $is_full ) : ?>
                    🔓 <strong>Document link access type: Full</strong> — invoice links will open correctly from the GST dashboard. ✅
                <?php else : ?>
                    🔒 <strong>Document link access type is set to "Logged in".</strong><br>
                    Invoice buttons will only work if the browser is logged in to WordPress.<br><br>
                    To fix: go to
                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=wpo_wcpdf_options_page&tab=debug' ) ); ?>" target="_blank">
                        WooCommerce &rarr; PDF Invoices &rarr; Debug &rarr; File System &amp; Access
                    </a>
                    and set <strong>Document link access type</strong> to <strong>Full</strong>, then save.
                <?php endif; ?>
            </div>

            <?php if ( $all_ok ) : ?>
            <div class="gst-alert gst-alert-ok" style="margin-top:10px">
                🔑 <strong>Access keys are read automatically from each order</strong> — no configuration needed.
            </div>
            <?php endif; ?>
            <?php endif; ?>

            <div class="gst-wactions">
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=5' ) ); ?>" class="gst-btn gst-btn-primary">Finish &rarr;</a>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report-setup&step=3' ) ); ?>" class="gst-btn gst-btn-ghost">&larr; Back</a>
            </div>
        </div>
        <?php
    }

    // ── Step 5: Done ──────────────────────────────────────────────────────────

    private static function step_done(): void {
        $key = get_option( 'gst_report_wcpdf_access_key', '' );
        ?>
        <div class="gst-wcard gst-wcard-done">
            <div class="gst-wcard-icon">🎉</div>
            <h2>You&rsquo;re all set!</h2>
            <p>GST Report for WooCommerce is configured and ready to use.</p>

            <div class="gst-done-checks">
                <?php if ( $key ) : ?>
                    <div class="gst-done-item ok">✅ Invoice access key saved — PDF invoices will work from the dashboard.</div>
                <?php else : ?>
                    <div class="gst-done-item warn">⚠️ No invoice access key saved. Run the wizard again after installing PDF Invoices &amp; Packing Slips.</div>
                <?php endif; ?>
            </div>

            <div class="gst-done-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                Built by <strong>Setups Works</strong>
            </div>

            <div class="gst-wactions" style="justify-content:center">
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report' ) ); ?>" class="gst-btn gst-btn-primary">Go to GST Dashboard &rarr;</a>
            </div>
        </div>
        <?php
    }

    // ── Helper: auto-detect WPO WCPDF access key ──────────────────────────────

    public static function detect_wcpdf_access_key(): string {
        try {
            // Method 1: General settings — document_access_key (stored when access type = Full)
            $general = get_option( 'wpo_wcpdf_settings_general', [] );
            if ( is_array( $general ) && ! empty( $general['document_access_key'] ) ) {
                return (string) $general['document_access_key'];
            }

            // Method 2: Debug settings option (some v3.x versions store it here)
            $debug = get_option( 'wpo_wcpdf_settings_debug', [] );
            if ( is_array( $debug ) && ! empty( $debug['document_access_key'] ) ) {
                return (string) $debug['document_access_key'];
            }

            // Method 3: Via WPO_WCPDF PHP object — guarded against null/missing properties
            if ( function_exists( 'WPO_WCPDF' ) ) {
                $obj = WPO_WCPDF();
                if ( $obj && isset( $obj->settings ) && is_object( $obj->settings ) ) {
                    $gen_s = isset( $obj->settings->general ) ? $obj->settings->general : [];
                    if ( is_array( $gen_s ) && ! empty( $gen_s['document_access_key'] ) ) {
                        return (string) $gen_s['document_access_key'];
                    }
                    $dbg_s = isset( $obj->settings->debug ) ? $obj->settings->debug : [];
                    if ( is_array( $dbg_s ) && ! empty( $dbg_s['document_access_key'] ) ) {
                        return (string) $dbg_s['document_access_key'];
                    }
                }
            }

            // Method 4: Older format fallback
            if ( is_array( $general ) && ! empty( $general['access_key'] ) ) {
                return (string) $general['access_key'];
            }
        } catch ( \Throwable $e ) {
            // Silently fail — user will enter the key manually
        }

        return '';
    }
}
