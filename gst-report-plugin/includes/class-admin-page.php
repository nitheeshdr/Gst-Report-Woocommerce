<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GST_Admin_Page {

    private const PER_PAGE = 50;

    // ── Entry point ───────────────────────────────────────────────────────────

    public static function render(): void {
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only display filter params; no data is mutated.
        $tab         = sanitize_key( wp_unslash( $_GET['tab']       ?? 'gst-report' ) );
        $paged       = max( 1, absint( $_GET['paged']   ?? 1 ) );
        $sort        = ( sanitize_key( wp_unslash( $_GET['sort'] ?? 'newest' ) ) === 'oldest' ) ? 'ASC' : 'DESC';
        $date_start  = sanitize_text_field( wp_unslash( $_GET['date_start'] ?? '' ) );
        $date_end    = sanitize_text_field( wp_unslash( $_GET['date_end']   ?? '' ) );
        $search      = sanitize_text_field( wp_unslash( $_GET['search']     ?? '' ) );
        // phpcs:enable WordPress.Security.NonceVerification.Recommended

        // Load products into map (used for HSN lookup in all tabs)
        $product_map = self::load_product_map();

        // Build order query args
        $query_args = [
            'type'     => 'shop_order',
            'status'   => array_keys( wc_get_order_statuses() ),
            'orderby'  => 'date',
            'order'    => $sort,
            'return'   => 'objects',
            'paginate' => true,
        ];

        if ( $date_start && $date_end ) {
            $query_args['date_created'] = strtotime( $date_start ) . '...' . strtotime( $date_end . ' 23:59:59' );
        } elseif ( $date_start ) {
            $query_args['date_created'] = '>=' . strtotime( $date_start );
        } elseif ( $date_end ) {
            $query_args['date_created'] = '<=' . strtotime( $date_end . ' 23:59:59' );
        }

        if ( $search !== '' ) {
            if ( is_numeric( $search ) ) {
                $query_args['order_id'] = (int) $search;
            } else {
                $query_args['billing_email'] = $search;
            }
        }

        // Paginated query
        $paged_args         = $query_args + [ 'limit' => self::PER_PAGE, 'page' => $paged ];
        $result             = ( new WC_Order_Query( $paged_args ) )->get_orders();
        $orders             = $result->orders;
        $total_orders       = (int) $result->total;
        $total_pages        = (int) $result->max_num_pages;

        // Stats via single SQL aggregation — no N+1 queries
        [ $total_revenue, $total_tax ] = self::calc_stats_sql( $date_start, $date_end, $search );

        $base_url    = admin_url( 'admin.php?page=gst-report' );
        $filter_qs   = http_build_query( array_filter( compact( 'date_start', 'date_end', 'search', 'sort' ) ) );
        $export_url  = wp_nonce_url( $base_url . '&action=export_csv&' . $filter_qs, 'gst_export' );

        ?>
        <div class="wrap gst-wrap">
            <h1 class="wp-heading-inline">WooCommerce GST Dashboard</h1>
            <a href="<?php echo esc_url( $export_url ); ?>" class="page-title-action">⬇ Export Excel</a>
            <hr class="wp-header-end">

            <!-- Stats -->
            <div class="gst-stats">
                <?php self::stat_card( 'Total Orders',   number_format( $total_orders ) ); ?>
                <?php self::stat_card( 'Total Products', number_format( count( $product_map ) ) ); ?>
                <?php self::stat_card( 'Revenue',        '₹' . number_format( $total_revenue, 2 ) ); ?>
                <?php self::stat_card( 'Total GST',      '₹' . number_format( $total_tax, 2 ) ); ?>
                <?php self::stat_card( 'Avg Order',      $total_orders > 0 ? '₹' . number_format( $total_revenue / $total_orders, 2 ) : '₹0.00' ); ?>
            </div>

            <!-- Filters -->
            <form method="get" class="gst-filters">
                <input type="hidden" name="page" value="gst-report">
                <input type="hidden" name="tab"  value="<?php echo esc_attr( $tab ); ?>">
                <div class="gst-filter-row">
                    <label>Start Date<input type="date" name="date_start" value="<?php echo esc_attr( $date_start ); ?>"></label>
                    <label>End Date<input type="date" name="date_end" value="<?php echo esc_attr( $date_end ); ?>"></label>
                    <label>Sort
                        <select name="sort">
                            <option value="newest" <?php selected( $sort, 'DESC' ); ?>>Newest First</option>
                            <option value="oldest" <?php selected( $sort, 'ASC'  ); ?>>Oldest First</option>
                        </select>
                    </label>
                    <label>Search (ID or Email)
                        <input type="text" name="search" value="<?php echo esc_attr( $search ); ?>" placeholder="Order ID or email">
                    </label>
                    <?php submit_button( 'Filter', 'secondary', '', false ); ?>
                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=gst-report&tab=' . $tab ) ); ?>" class="button">Reset</a>
                </div>
            </form>

            <!-- Tabs -->
            <nav class="nav-tab-wrapper gst-tabs">
                <?php
                foreach ( [ 'gst-report' => 'GST Report', 'orders' => 'Orders', 'products' => 'Products' ] as $slug => $label ) {
                    $url   = add_query_arg( array_filter( [ 'page' => 'gst-report', 'tab' => $slug, 'date_start' => $date_start, 'date_end' => $date_end, 'search' => $search, 'sort' => ( $sort === 'ASC' ? 'oldest' : 'newest' ) ] ), admin_url( 'admin.php' ) );
                    $class = $tab === $slug ? 'nav-tab nav-tab-active' : 'nav-tab';
                    echo '<a href="' . esc_url( $url ) . '" class="' . esc_attr( $class ) . '">' . esc_html( $label ) . '</a>';
                }
                ?>
            </nav>

            <!-- Tab content -->
            <div class="gst-tab-content">
                <?php
                if ( $tab === 'orders' ) {
                    self::render_orders_tab( $orders, $product_map );
                } elseif ( $tab === 'products' ) {
                    self::render_products_tab( $product_map );
                } else {
                    self::render_gst_report_tab( $orders, $product_map );
                }
                ?>
            </div>

            <!-- Pagination -->
            <?php
            echo '<div class="gst-pagination tablenav bottom"><div class="tablenav-pages">';
            echo wp_kses_post( paginate_links( [
                'base'      => add_query_arg( 'paged', '%#%' ),
                'format'    => '',
                'current'   => $paged,
                'total'     => $total_pages,
                'prev_text' => '&laquo;',
                'next_text' => '&raquo;',
            ] ) );
            echo '<span class="displaying-num">' . number_format( $total_orders ) . ' orders</span>';
            echo '</div></div>';
            ?>
        </div>
        <?php
    }

    // ── GST Report Tab ────────────────────────────────────────────────────────

    private static function render_gst_report_tab( array $orders, array $product_map ): void {
        ?>
        <div class="gst-table-wrap">
        <table class="wp-list-table widefat fixed striped gst-report-table">
            <thead>
                <tr>
                    <th>Date</th><th>Inv. No</th><th>DC. No</th><th>Customer</th>
                    <th>GSTIN</th><th>State</th><th>HSN</th><th>Qty</th>
                    <th>Subtotal</th>
                    <th>Supply @18%</th><th>9% CGST</th><th>9% SGST</th><th>18% IGST</th>
                    <th>Supply @5%</th><th>2.5% CGST</th><th>2.5% SGST</th><th>5% IGST</th>
                    <th>0% Tax</th><th>TOTAL</th><th>Invoice</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ( $orders as $order ) :
                $subtotal       = GST_Calculator::calc_subtotal( $order );
                $discount       = (float) $order->get_discount_total();
                $disc_ratio     = $subtotal > 0 ? $discount / $subtotal : 0;
                $is_cancelled   = GST_Calculator::is_cancelled( $order );
                $multiplier     = $is_cancelled ? -1 : 1;
                $dc_no          = $order->get_meta( '_dc_number' ) ?: '-';
                $gstin          = $order->get_meta( '_billing_gstin' ) ?: $order->get_meta( 'gstin' ) ?: 'N/A';
                $order_date     = $order->get_date_created() ? $order->get_date_created()->date( 'd/m/Y' ) : '';
                $customer       = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
                $state          = $order->get_billing_state();
                $row_class      = $is_cancelled ? 'gst-row-cancelled' : '';
                $invoice_url    = add_query_arg( [
                    'action'        => 'generate_wpo_wcpdf',
                    'document_type' => 'invoice',
                    'order_ids'     => $order->get_id(),
                    'access_key'    => $order->get_order_key(),
                ], admin_url( 'admin-ajax.php' ) );

                // Line item rows
                foreach ( $order->get_items() as $item ) :
                    $gst            = GST_Calculator::line_item_gst( $item, $order );
                    $hsn            = GST_Calculator::get_hsn( $item, $product_map );
                    $item_sub       = (float) $item->get_subtotal();
                    $adj_sub        = $item_sub - $item_sub * $disc_ratio;
                    $item_tax       = GST_Calculator::item_tax_total( $item );
                    $line_total     = ( $adj_sub + $item_tax ) * $multiplier;
                    ?>
                    <tr class="<?php echo esc_attr( $row_class ); ?>">
                        <td><?php echo esc_html( $order_date ); ?></td>
                        <td><?php echo esc_html( GST_Calculator::get_invoice_number( $order ) ); ?></td>
                        <td><?php echo esc_html( $dc_no ); ?></td>
                        <td><?php echo esc_html( $customer ); ?></td>
                        <td><?php echo esc_html( $gstin ); ?></td>
                        <td><?php echo esc_html( $state ); ?></td>
                        <td><?php echo esc_html( $hsn ); ?></td>
                        <td><?php echo esc_html( $item->get_quantity() ); ?></td>
                        <td>₹<?php echo number_format( $adj_sub, 2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['supply18'], 2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['cgst9'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['sgst9'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['igst18'],   2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['supply5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['cgst2_5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['sgst2_5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['igst5'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $gst['supply0'],  2 ); ?></td>
                        <td class="gst-total <?php echo $is_cancelled ? 'gst-neg' : ''; ?>">₹<?php echo number_format( $line_total, 2 ); ?></td>
                        <td><a href="<?php echo esc_url( $invoice_url ); ?>" class="button button-small" target="_blank" rel="noopener noreferrer">Invoice</a></td>
                    </tr>
                    <?php
                endforeach;

                // Shipping row
                $ship_total = (float) $order->get_shipping_total();
                if ( $ship_total > 0 ) :
                    $sg         = GST_Calculator::shipping_gst( $order );
                    $ship_tax   = GST_Calculator::shipping_tax_total( $order );
                    $ship_line  = ( $ship_total + $ship_tax ) * $multiplier;
                    ?>
                    <tr class="gst-row-shipping <?php echo esc_attr( $row_class ); ?>">
                        <td><?php echo esc_html( $order_date ); ?></td>
                        <td><?php echo esc_html( GST_Calculator::get_invoice_number( $order ) ); ?></td>
                        <td><?php echo esc_html( $dc_no ); ?></td>
                        <td><?php echo esc_html( $customer ); ?></td>
                        <td><?php echo esc_html( $gstin ); ?></td>
                        <td><?php echo esc_html( $state ); ?></td>
                        <td>996812</td><td>1</td>
                        <td>₹<?php echo number_format( $ship_total, 2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['supply18'], 2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['cgst9'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['sgst9'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['igst18'],   2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['supply5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['cgst2_5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['sgst2_5'],  2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['igst5'],    2 ); ?></td>
                        <td>₹<?php echo number_format( $sg['supply0'],  2 ); ?></td>
                        <td class="gst-total <?php echo $is_cancelled ? 'gst-neg' : ''; ?>">₹<?php echo number_format( $ship_line, 2 ); ?></td>
                        <td><a href="<?php echo esc_url( $invoice_url ); ?>" class="button button-small" target="_blank" rel="noopener noreferrer">Invoice</a></td>
                    </tr>
                    <?php
                endif;
            endforeach; ?>
            </tbody>
        </table>
        </div>
        <?php
    }

    // ── Orders Tab ────────────────────────────────────────────────────────────

    private static function render_orders_tab( array $orders, array $product_map ): void {
        foreach ( $orders as $order ) :
            $gst         = GST_Calculator::order_gst( $order );
            $is_c        = GST_Calculator::is_cancelled( $order );
            $status      = $order->get_status();
            $date        = $order->get_date_created() ? $order->get_date_created()->date( 'd/m/Y H:i' ) : '';
            $gstin       = $order->get_meta( '_billing_gstin' ) ?: $order->get_meta( 'gstin' ) ?: 'N/A';
            $invoice_url = add_query_arg( [
                'action'        => 'generate_wpo_wcpdf',
                'document_type' => 'invoice',
                'order_ids'     => $order->get_id(),
                'access_key'    => get_option( 'gst_report_wcpdf_access_key', '' ),
            ], admin_url( 'admin-ajax.php' ) );
            $status_class = in_array( $status, [ 'completed' ], true ) ? 'gst-status-green'
                          : ( in_array( $status, [ 'processing' ], true ) ? 'gst-status-blue'
                          : ( in_array( $status, [ 'cancelled','refunded' ], true ) ? 'gst-status-red' : 'gst-status-grey' ) );
            ?>
            <div class="gst-order-card <?php echo $is_c ? 'gst-order-cancelled' : ''; ?>">
                <div class="gst-order-header">
                    <div>
                        <strong>Order <?php echo esc_html( GST_Calculator::get_order_number( $order ) ); ?></strong>
                        <span class="gst-date"><?php echo esc_html( $date ); ?></span>
                        <span class="gst-state"><?php echo esc_html( $order->get_billing_state() ); ?> — <?php echo $gst['is_tn'] ? 'CGST/SGST' : 'IGST'; ?></span>
                    </div>
                    <div class="gst-order-actions">
                        <span class="gst-status <?php echo esc_attr( $status_class ); ?>"><?php echo esc_html( $status ); ?></span>
                        <a href="<?php echo esc_url( $invoice_url ); ?>" class="button button-primary button-small" target="_blank" rel="noopener noreferrer">⬇ Invoice</a>
                    </div>
                </div>

                <div class="gst-order-body">
                    <div>
                        <strong>Customer</strong><br>
                        <?php echo esc_html( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ); ?><br>
                        <small><?php echo esc_html( $order->get_billing_email() ); ?></small><br>
                        <small>GSTIN: <?php echo esc_html( $gstin ); ?></small>
                    </div>
                    <div>
                        <strong>Total</strong><br>
                        <span class="gst-big-num">₹<?php echo esc_html( $order->get_total() ); ?></span><br>
                        <small>Tax: ₹<?php echo esc_html( $order->get_total_tax() ); ?></small>
                    </div>
                    <div>
                        <strong>GST Breakdown</strong><br>
                        <?php if ( $gst['cgst9']  > 0 ) echo 'CGST 9%: ₹' . number_format( $gst['cgst9'],  2 ) . '<br>'; ?>
                        <?php if ( $gst['sgst9']  > 0 ) echo 'SGST 9%: ₹' . number_format( $gst['sgst9'],  2 ) . '<br>'; ?>
                        <?php if ( $gst['igst18'] > 0 ) echo 'IGST 18%: ₹' . number_format( $gst['igst18'], 2 ) . '<br>'; ?>
                        <?php if ( $gst['cgst2_5'] > 0 ) echo 'CGST 2.5%: ₹' . number_format( $gst['cgst2_5'], 2 ) . '<br>'; ?>
                        <?php if ( $gst['sgst2_5'] > 0 ) echo 'SGST 2.5%: ₹' . number_format( $gst['sgst2_5'], 2 ) . '<br>'; ?>
                        <?php if ( $gst['igst5']  > 0 ) echo 'IGST 5%: ₹' . number_format( $gst['igst5'],  2 ) . '<br>'; ?>
                    </div>
                </div>

                <div class="gst-order-items">
                    <?php foreach ( $order->get_items() as $item ) :
                        $hsn = GST_Calculator::get_hsn( $item, $product_map ); ?>
                        <div class="gst-item-row">
                            <span><?php echo esc_html( $item->get_name() ); ?> × <?php echo esc_html( $item->get_quantity() ); ?>
                                <small>(HSN: <?php echo esc_html( $hsn ); ?>)</small>
                            </span>
                            <span>₹<?php echo esc_html( $item->get_total() ); ?></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach;
    }

    // ── Products Tab ──────────────────────────────────────────────────────────

    private static function render_products_tab( array $product_map ): void {
        ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th style="width:70px">Image</th>
                    <th>Name</th><th>SKU</th><th>HSN Code</th>
                    <th>Price</th><th>Stock</th><th>GST Rate</th><th>Status</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ( $product_map as $product ) :
                $gst_rate = $product->get_meta( '_gst_rate' ) ?: 'N/A';
                $hsn      = $product->get_meta( 'hsn' ) ?: $product->get_meta( '_hsn_code' ) ?: 'N/A';
                $img_id   = $product->get_image_id();
                $img_src  = $img_id ? wp_get_attachment_image_url( $img_id, 'thumbnail' ) : '';
                ?>
                <tr>
                    <td><?php if ( $img_src ) : ?><img src="<?php echo esc_url( $img_src ); ?>" style="width:50px;height:50px;object-fit:cover;border-radius:4px"><?php endif; ?></td>
                    <td><strong><?php echo esc_html( $product->get_name() ); ?></strong></td>
                    <td><?php echo esc_html( $product->get_sku() ?: 'N/A' ); ?></td>
                    <td><?php echo esc_html( $hsn ); ?></td>
                    <td>₹<?php echo esc_html( $product->get_price() ); ?></td>
                    <td><?php echo $product->get_stock_quantity() !== null ? esc_html( $product->get_stock_quantity() ) : 'N/A'; ?></td>
                    <td><?php echo esc_html( $gst_rate ); ?>%</td>
                    <td><span class="gst-status <?php echo $product->get_stock_status() === 'instock' ? 'gst-status-green' : 'gst-status-red'; ?>"><?php echo esc_html( $product->get_stock_status() ); ?></span></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php
    }

    // ── CSV Export ────────────────────────────────────────────────────────────

    public static function export_csv(): void {
        // Read active filters from GET (passed via export URL)
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- nonce already verified via check_admin_referer('gst_export') in the plugin entry point before this method is invoked.
        $date_start = sanitize_text_field( wp_unslash( $_GET['date_start'] ?? '' ) );
        $date_end   = sanitize_text_field( wp_unslash( $_GET['date_end']   ?? '' ) );
        $search     = sanitize_text_field( wp_unslash( $_GET['search']     ?? '' ) );
        $sort       = ( sanitize_key( wp_unslash( $_GET['sort'] ?? 'newest' ) ) === 'oldest' ) ? 'ASC' : 'DESC';
        // phpcs:enable WordPress.Security.NonceVerification.Recommended

        $query_args = [
            'limit'   => -1,
            'orderby' => 'date',
            'order'   => $sort,
            'status'  => array_keys( wc_get_order_statuses() ),
            'return'  => 'objects',
            'type'    => 'shop_order',
        ];

        if ( $date_start && $date_end ) {
            $query_args['date_created'] = strtotime( $date_start ) . '...' . strtotime( $date_end . ' 23:59:59' );
        } elseif ( $date_start ) {
            $query_args['date_created'] = '>=' . strtotime( $date_start );
        } elseif ( $date_end ) {
            $query_args['date_created'] = '<=' . strtotime( $date_end . ' 23:59:59' );
        }

        if ( $search !== '' ) {
            if ( is_numeric( $search ) ) {
                $query_args['order_id'] = (int) $search;
            } else {
                $query_args['billing_email'] = $search;
            }
        }

        $orders      = wc_get_orders( $query_args );
        $product_map = self::load_product_map();

        $suffix   = $date_start || $date_end
                  ? '_' . ( $date_start ?: 'start' ) . '_to_' . ( $date_end ?: 'end' )
                  : '_' . wp_date( 'd-m-Y' );
        $filename = 'GST_Report' . $suffix . '.xlsx';

        $xlsx = new GST_XLSX_Writer();
        $xlsx->add_row( [
            'Date', 'Inv. No', 'Invoice Date', 'DC. No', 'Customer', 'GSTIN No', 'State',
            'HSN Code', 'Qty', 'Subtotal',
            'Supply @18%', '9% CGST', '9% SGST', '18% IGST',
            'Supply @5%', '2.5% CGST', '2.5% SGST', '5% IGST',
            '0% Tax', 'TOTAL',
        ], true );

        foreach ( $orders as $order ) {
            $sub        = GST_Calculator::calc_subtotal( $order );
            $disc       = (float) $order->get_discount_total();
            $disc_ratio = $sub > 0 ? $disc / $sub : 0;
            $is_c       = GST_Calculator::is_cancelled( $order );
            $mult       = $is_c ? -1 : 1;
            $dc         = $order->get_meta( '_dc_number' ) ?: '-';
            $gstin      = $order->get_meta( '_billing_gstin' ) ?: $order->get_meta( 'gstin' ) ?: 'N/A';
            $date       = $order->get_date_created() ? $order->get_date_created()->date( 'd/m/Y' ) : '';
            $customer   = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
            $state      = $order->get_billing_state();

            foreach ( $order->get_items() as $item ) {
                $gst      = GST_Calculator::line_item_gst( $item, $order );
                $hsn      = GST_Calculator::get_hsn( $item, $product_map );
                $item_sub = (float) $item->get_subtotal();
                $adj      = $item_sub - $item_sub * $disc_ratio;
                $item_tax = GST_Calculator::item_tax_total( $item );
                $total    = ( $adj + $item_tax ) * $mult;

                $xlsx->add_row( [
                    $date, GST_Calculator::get_invoice_number( $order ), $date, $dc, $customer, $gstin, $state, $hsn,
                    $item->get_quantity(), round( $adj, 2 ),
                    round( $gst['supply18'], 2 ), round( $gst['cgst9'],   2 ), round( $gst['sgst9'],   2 ), round( $gst['igst18'],  2 ),
                    round( $gst['supply5'],  2 ), round( $gst['cgst2_5'], 2 ), round( $gst['sgst2_5'], 2 ), round( $gst['igst5'],   2 ),
                    round( $gst['supply0'],  2 ), round( $total, 2 ),
                ] );
            }

            $ship_total = (float) $order->get_shipping_total();
            if ( $ship_total > 0 ) {
                $sg       = GST_Calculator::shipping_gst( $order );
                $ship_tax = GST_Calculator::shipping_tax_total( $order );
                $total    = ( $ship_total + $ship_tax ) * $mult;

                $xlsx->add_row( [
                    $date, GST_Calculator::get_invoice_number( $order ), $date, $dc, $customer, $gstin, $state, '996812',
                    1, round( $ship_total, 2 ),
                    round( $sg['supply18'], 2 ), round( $sg['cgst9'],   2 ), round( $sg['sgst9'],   2 ), round( $sg['igst18'],  2 ),
                    round( $sg['supply5'],  2 ), round( $sg['cgst2_5'], 2 ), round( $sg['sgst2_5'], 2 ), round( $sg['igst5'],   2 ),
                    round( $sg['supply0'],  2 ), round( $total, 2 ),
                ] );
            }
        }

        $xlsx->output( $filename );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static function load_product_map(): array {
        static $cache = null;
        if ( $cache !== null ) return $cache;
        $cache = [];
        foreach ( wc_get_products( [ 'limit' => -1, 'return' => 'objects', 'status' => 'publish' ] ) as $p ) {
            $cache[ $p->get_id() ] = $p;
        }
        return $cache;
    }

    private static function calc_stats_sql( string $date_start, string $date_end, string $search ): array {
        global $wpdb;

        $cache_key = 'gst_stats_' . md5( $date_start . $date_end . $search );
        $cached    = wp_cache_get( $cache_key, 'gst_report' );
        if ( false !== $cached ) {
            return $cached;
        }

        $excl = "'wc-cancelled','wc-refunded','wc-failed'";

        $use_hpos = class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' )
                 && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();

        if ( $use_hpos ) {
            $where = "o.type = 'shop_order' AND o.status NOT IN ($excl)";
            $joins = '';

            if ( $date_start ) {
                $where .= $wpdb->prepare( ' AND o.date_created_gmt >= %s', gmdate( 'Y-m-d 00:00:00', strtotime( $date_start ) ) );
            }
            if ( $date_end ) {
                $where .= $wpdb->prepare( ' AND o.date_created_gmt <= %s', gmdate( 'Y-m-d 23:59:59', strtotime( $date_end ) ) );
            }
            if ( $search !== '' ) {
                if ( is_numeric( $search ) ) {
                    $where .= $wpdb->prepare( ' AND o.id = %d', (int) $search );
                } else {
                    $joins .= " LEFT JOIN {$wpdb->prefix}wc_order_addresses oa ON oa.order_id = o.id AND oa.address_type = 'billing'";
                    $where .= $wpdb->prepare( ' AND oa.email = %s', $search );
                }
            }

            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Caching applied above; all user-supplied values use $wpdb->prepare(); remaining SQL fragments are hardcoded.
            $row = $wpdb->get_row( "SELECT SUM(o.total_amount) AS rev, SUM(o.tax_amount) AS tax FROM {$wpdb->prefix}wc_orders o $joins WHERE $where" );
            // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

        } else {
            $where = "p.post_type = 'shop_order' AND p.post_status NOT IN ($excl)";

            if ( $date_start ) {
                $where .= $wpdb->prepare( ' AND p.post_date >= %s', $date_start . ' 00:00:00' );
            }
            if ( $date_end ) {
                $where .= $wpdb->prepare( ' AND p.post_date <= %s', $date_end . ' 23:59:59' );
            }
            if ( $search !== '' ) {
                if ( is_numeric( $search ) ) {
                    $where .= $wpdb->prepare( ' AND p.ID = %d', (int) $search );
                } else {
                    $where .= $wpdb->prepare(
                        " AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} em WHERE em.post_id = p.ID AND em.meta_key = '_billing_email' AND em.meta_value = %s)",
                        $search
                    );
                }
            }

            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Caching applied above; all user-supplied values use $wpdb->prepare(); remaining SQL fragments are hardcoded.
            $row = $wpdb->get_row( "
                SELECT
                    SUM(CAST(pm_t.meta_value AS DECIMAL(15,2))) AS rev,
                    SUM(CAST(pm_x.meta_value AS DECIMAL(15,2))) AS tax
                FROM {$wpdb->posts} p
                LEFT JOIN {$wpdb->postmeta} pm_t ON pm_t.post_id = p.ID AND pm_t.meta_key = '_order_total'
                LEFT JOIN {$wpdb->postmeta} pm_x ON pm_x.post_id = p.ID AND pm_x.meta_key = '_order_tax'
                WHERE $where
            " );
            // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
        }

        $result = [ (float) ( $row->rev ?? 0 ), (float) ( $row->tax ?? 0 ) ];
        wp_cache_set( $cache_key, $result, 'gst_report', 300 );
        return $result;
    }

    private static function stat_card( string $label, string $value ): void {
        echo '<div class="gst-stat-card"><span class="gst-stat-label">' . esc_html( $label ) . '</span><span class="gst-stat-value">' . esc_html( $value ) . '</span></div>';
    }
}
