<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GST_Calculator {

    public static function is_cancelled( WC_Order $order ): bool {
        return in_array( $order->get_status(), [ 'cancelled', 'refunded', 'failed' ], true );
    }

    public static function calc_subtotal( WC_Order $order ): float {
        $total = 0.0;
        foreach ( $order->get_items() as $item ) {
            $total += (float) $item->get_subtotal();
        }
        return $total;
    }

    public static function get_invoice_number( WC_Order $order ): string {
        // Formatted invoice number stored by WPO WCPDF plugin
        $formatted = trim( (string) $order->get_meta( '_wcpdf_invoice_number_formatted' ) );
        if ( $formatted !== '' ) {
            return $formatted;
        }
        // Raw integer invoice number — return as-is
        $raw = trim( (string) $order->get_meta( '_wcpdf_invoice_number' ) );
        if ( $raw !== '' ) {
            return $raw;
        }
        // Fall back to the sequential order number (e.g. #NJ/2026-2027/W2063)
        return self::get_order_number( $order );
    }

    public static function get_order_number( WC_Order $order ): string {
        // get_order_number() is filtered by sequential-order-number plugins
        $num = $order->get_order_number();
        if ( (string) $order->get_id() !== (string) $num ) {
            return (string) $num;
        }
        // Fallback: check common meta keys used by sequential-number plugins
        foreach ( [ '_order_number_formatted', '_order_number', '_alg_wc_custom_order_number', '_wcson_order_number' ] as $key ) {
            $val = trim( (string) $order->get_meta( $key ) );
            if ( $val !== '' ) {
                return $val;
            }
        }
        return (string) $num;
    }

    public static function get_hsn( WC_Order_Item_Product $item, array $product_map ): string {
        // Check variation first (more specific), then parent product
        $variation_id = $item->get_variation_id();
        $product_id   = $item->get_product_id();
        $ids          = array_filter( [ $variation_id, $product_id ] );

        foreach ( $ids as $pid ) {
            // Fall back to wc_get_product() for variation objects not in the map
            $product = $product_map[ $pid ] ?? wc_get_product( $pid );
            if ( ! $product ) continue;

            // 1. meta key 'hsn'
            $hsn = $product->get_meta( 'hsn' );
            if ( $hsn ) return (string) $hsn;

            // 2. meta key '_hsn_code'
            $hsn = $product->get_meta( '_hsn_code' );
            if ( $hsn ) return (string) $hsn;

            // 3. any product attribute whose name contains 'hsn' (case-insensitive)
            //    covers "HSN", "HSN Code", "HSN/SAC", "HSN No." etc.
            foreach ( $product->get_attributes() as $attr ) {
                if ( stripos( $attr->get_name(), 'hsn' ) !== false ) {
                    $options = $attr->get_options();
                    if ( ! empty( $options ) ) {
                        if ( $attr->is_taxonomy() ) {
                            $term = get_term( $options[0] );
                            if ( $term && ! is_wp_error( $term ) ) return $term->name;
                        } else {
                            return (string) $options[0];
                        }
                    }
                }
            }
        }

        // 4. Scan order-item meta for any key containing 'hsn' (catches attribute
        //    values copied to the line item when order was placed, e.g. "HSN Code" => "12345")
        foreach ( $item->get_meta_data() as $meta ) {
            if ( stripos( $meta->key, 'hsn' ) !== false && ! empty( $meta->value ) ) {
                return (string) $meta->value;
            }
        }

        return 'N/A';
    }

    public static function item_tax_total( WC_Order_Item $item ): float {
        $total = 0.0;
        foreach ( $item->get_taxes()['total'] as $amount ) {
            $total += (float) $amount;
        }
        return $total;
    }

    public static function shipping_tax_total( WC_Order $order ): float {
        $total = 0.0;
        foreach ( $order->get_items( 'shipping' ) as $ship ) {
            foreach ( $ship->get_taxes()['total'] as $amount ) {
                $total += (float) $amount;
            }
        }
        return $total;
    }

    private static function is_tn( WC_Order $order ): bool {
        $state = strtoupper( $order->get_billing_state() );
        return $state === 'TN' || $state === 'TAMIL NADU';
    }

    public static function line_item_gst( WC_Order_Item_Product $item, WC_Order $order ): array {
        $is_tn        = self::is_tn( $order );
        $multiplier   = self::is_cancelled( $order ) ? -1 : 1;
        $subtotal     = (float) $item->get_subtotal();
        $tax          = self::item_tax_total( $item );
        $tax_class    = $item->get_tax_class();
        $is_5pct      = (bool) preg_match( '/5|5[-_]percent|gst[-_]5/i', $tax_class );

        $r = array_fill_keys(
            [ 'supply18','cgst9','sgst9','igst18','supply5','cgst2_5','sgst2_5','igst5','supply0' ],
            0.0
        );

        if ( $is_5pct ) {
            $r['supply5'] = $subtotal * $multiplier;
            if ( $is_tn ) { $r['cgst2_5'] = $r['sgst2_5'] = ( $tax / 2 ) * $multiplier; }
            else          { $r['igst5']   = $tax * $multiplier; }
        } elseif ( $tax > 0 ) {
            $r['supply18'] = $subtotal * $multiplier;
            if ( $is_tn ) { $r['cgst9'] = $r['sgst9'] = ( $tax / 2 ) * $multiplier; }
            else          { $r['igst18'] = $tax * $multiplier; }
        } else {
            $r['supply0'] = $subtotal * $multiplier;
        }

        return $r;
    }

    public static function shipping_gst( WC_Order $order ): array {
        $is_tn      = self::is_tn( $order );
        $multiplier = self::is_cancelled( $order ) ? -1 : 1;
        $shipping   = (float) $order->get_shipping_total();
        $tax        = self::shipping_tax_total( $order );

        $r = array_fill_keys(
            [ 'supply18','cgst9','sgst9','igst18','supply5','cgst2_5','sgst2_5','igst5','supply0' ],
            0.0
        );

        if ( $tax > 0 ) {
            $r['supply18'] = $shipping * $multiplier;
            if ( $is_tn ) { $r['cgst9'] = $r['sgst9'] = ( $tax / 2 ) * $multiplier; }
            else          { $r['igst18'] = $tax * $multiplier; }
        } elseif ( $shipping > 0 ) {
            $r['supply0'] = $shipping * $multiplier;
        }

        return $r;
    }

    // Order-level GST breakdown (used by invoice)
    public static function order_gst( WC_Order $order ): array {
        $subtotal    = self::calc_subtotal( $order );
        $discount    = (float) $order->get_discount_total();
        $is_tn       = self::is_tn( $order );
        $multiplier  = self::is_cancelled( $order ) ? -1 : 1;
        $gst5 = $gst18 = 0.0;

        foreach ( $order->get_items() as $item ) {
            $tax       = self::item_tax_total( $item );
            $tax_class = $item->get_tax_class();
            if ( preg_match( '/5|5[-_]percent|gst[-_]5/i', $tax_class ) ) {
                $gst5  += $tax;
            } else {
                $gst18 += $tax;
            }
        }

        $r = [
            'subtotal'      => $subtotal * $multiplier,
            'discount'      => $discount * $multiplier,
            'order_total'   => (float) $order->get_total() * $multiplier,
            'is_tn'         => $is_tn,
            'supply18' => 0.0, 'cgst9'   => 0.0, 'sgst9'   => 0.0, 'igst18'  => 0.0,
            'supply5'  => 0.0, 'cgst2_5' => 0.0, 'sgst2_5' => 0.0, 'igst5'   => 0.0,
        ];

        if ( $gst18 > 0 ) {
            $r['supply18'] = ( $subtotal - $discount ) * $multiplier;
            if ( $is_tn ) { $r['cgst9'] = $r['sgst9'] = ( $gst18 / 2 ) * $multiplier; }
            else          { $r['igst18'] = $gst18 * $multiplier; }
        }
        if ( $gst5 > 0 ) {
            $r['supply5'] = ( $gst5 / 0.05 ) * $multiplier;
            if ( $is_tn ) { $r['cgst2_5'] = $r['sgst2_5'] = ( $gst5 / 2 ) * $multiplier; }
            else          { $r['igst5'] = $gst5 * $multiplier; }
        }

        return $r;
    }
}
