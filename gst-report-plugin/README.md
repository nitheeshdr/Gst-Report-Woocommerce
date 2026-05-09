# GST Report for WooCommerce

A native PHP GST dashboard for Indian WooCommerce stores — CGST/SGST/IGST breakdown, Excel export, and per-order tax invoices. No JavaScript frameworks, no REST API.

## Features

- **GST Report tab** — Line-item breakdown with CGST/SGST (intra-state) and IGST (inter-state) at 18%, 5%, and 0% rates.
- **Orders tab** — Card view showing customer details, GSTIN, order status, and GST breakdown.
- **Products tab** — All products with SKU, HSN code, price, stock, and GST rate.
- **Excel export** — Download filtered data as `.xlsx` using a zero-dependency PHP writer.
- **Tax invoice** — Download an HTML tax invoice for any order.
- **Flexible HSN lookup** — Reads from product meta (`hsn`, `_hsn_code`), product attributes, or order-item meta.
- **HPOS compatible** — Works with both classic post-based orders and WooCommerce High-Performance Order Storage.
- **Filtering & pagination** — Filter by date range, search by order ID or email, sort newest/oldest, 50 per page.

## Requirements

| Requirement | Version |
|---|---|
| WordPress | 5.9+ |
| WooCommerce | 5.0+ |
| PHP | 7.4+ |
| [PDF Invoices & Packing Slips for WooCommerce](https://wordpress.org/plugins/woocommerce-pdf-invoices-packing-slips/) | Any | Required for Invoice download |

## Installation

1. Download the zip and upload via **Plugins > Add New > Upload Plugin**, or extract to `wp-content/plugins/gst-report-plugin/`.
2. Activate the plugin.
3. Navigate to **GST Report** in the admin sidebar.

## Configuration

### HSN Codes

Add an HSN code to each product via a custom field with key `hsn` or `_hsn_code`, or use a product attribute named anything containing "HSN".

### 5% GST Products

Assign a WooCommerce tax class whose name contains `5` (e.g. "GST 5%") to products taxed at 5%. Everything else is treated as 18%.

### Intra-state vs Inter-state

The plugin uses **Tamil Nadu (TN)** as the home state. Orders with billing state `TN` get CGST + SGST; all others get IGST. To change the home state, edit the `is_tn()` method in `includes/class-gst-calculator.php`.

### Invoice Shop Details

The invoice template in `includes/class-admin-page.php` (`download_invoice` method) contains hardcoded shop name, address, and GSTIN. Update these to match your business before going live.

## File Structure

```
gst-report-plugin/
├── gst-report.php              # Plugin entry point, hooks
├── readme.txt                  # WordPress.org readme
├── assets/
│   └── admin.css               # Dashboard styles
└── includes/
    ├── class-admin-page.php    # Dashboard UI, export, invoice
    ├── class-gst-calculator.php # GST calculation logic
    └── class-xlsx-writer.php   # Zero-dependency XLSX writer
```

## Author

**Setups Works** — [https://setups.works/](https://setups.works/)

## License

GPLv2 or later — see [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html)
