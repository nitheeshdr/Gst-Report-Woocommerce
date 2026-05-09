=== GST Report for WooCommerce ===
Contributors: nitheeshdr
Tags: woocommerce, gst, india, tax, invoice
Requires at least: 5.9
Tested up to: 6.9
Stable tag: 2.0.4
Requires PHP: 7.4
WC requires at least: 5.0
WC tested up to: 9.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A native PHP GST dashboard for WooCommerce — CGST/SGST/IGST breakdown, Excel export, and PDF tax invoices. No JavaScript frameworks, no REST API.

== Description ==

**GST Report for WooCommerce** is a lightweight, fast admin dashboard built entirely with native PHP and direct database queries. It generates GST-compliant reports for Indian WooCommerce stores, handles both intra-state (CGST + SGST) and inter-state (IGST) tax calculations across 18% and 5% GST rates, and lets you export to Excel or open a PDF tax invoice in one click — all without leaving WordPress admin.

Designed for Indian store owners who need to file GSTR-1, GSTR-3B, or provide tax invoices to B2B buyers, without the overhead of a full accounting plugin.

= Key Features =

* **Setup Wizard** — On first activation, a guided wizard checks your HSN codes, GST tax rates, and PDF Invoices plugin configuration so your dashboard is accurate from day one.
* **GST Report tab** — Line-item breakdown per order with CGST/SGST (intra-state) and IGST (inter-state) at 18%, 5%, and 0% rates, with separate columns for each. Cancelled and refunded orders appear as negative entries.
* **Orders tab** — Card-based order view showing customer name, GSTIN, billing state, order status, and a full per-order GST breakdown (CGST, SGST, IGST).
* **Products tab** — All published products with thumbnail, SKU, HSN code, price, stock quantity, GST rate, and stock status.
* **Excel export** — Download the filtered report as a properly formatted `.xlsx` file using a zero-dependency PHP XLSX writer. Includes date, invoice number, DC number, customer, GSTIN, state, HSN, quantity, subtotal, and all GST columns.
* **PDF invoice** — Opens the WooCommerce PDF Invoices & Packing Slips invoice for any order in a new tab with one click. Access key is read automatically from the order — no manual configuration needed.
* **Flexible HSN lookup** — Reads HSN from product meta (`hsn`, `_hsn_code`), product attributes (any attribute whose name contains "HSN"), or order-item meta — whichever is present. Checks variation first, then parent product.
* **HPOS compatible** — Works with both the classic `wp_posts` order table and WooCommerce High-Performance Order Storage (HPOS/COT). Detects automatically.
* **Filtering & search** — Filter by start/end date, sort newest or oldest, search by order ID or billing email. Paginated at 50 orders per page.
* **Summary stat cards** — Total orders, total products, revenue, total GST collected, and average order value — calculated via a single SQL aggregation query (no N+1 queries).

= Who Is This For? =

* Indian WooCommerce store owners filing GSTR-1 or GSTR-3B returns
* Stores selling to GST-registered buyers (B2B) who need tax invoices with GSTIN
* Accountants or store managers who need a quick Excel export of GST data for a given period
* Stores in Tamil Nadu (TN) needing CGST + SGST split, or any other state needing IGST

= How GST Calculation Works =

The plugin uses WooCommerce's own tax totals stored against each order line item:

* **Intra-state (TN):** If billing state is Tamil Nadu, tax is split 50/50 as CGST + SGST.
* **Inter-state:** All other billing states are treated as IGST.
* **5% GST:** Products assigned to a tax class whose name contains `5` (e.g. "GST 5%") are reported under the 5% columns.
* **18% GST:** All other taxed products are reported under the 18% columns.
* **0% / Exempt:** Products with no tax are reported under the zero-rated supply column.

= Technical Notes =

* Pure PHP — no JavaScript frameworks, no React, no REST API.
* All data fetched via `WC_Order_Query` and direct SQL with `$wpdb->prepare()`.
* All `$_GET` input is sanitised with `sanitize_key()`, `sanitize_text_field()`, `absint()`, and `wp_unslash()`.
* All output escaped with `esc_html()`, `esc_url()`, `esc_attr()`, `wp_kses_post()`.
* Stats query result cached with `wp_cache_get/set`.
* Nonce-protected on all export actions.

== Installation ==

= Automatic Installation =

1. Go to **WordPress Admin → Plugins → Add New**.
2. Search for **GST Report for WooCommerce**.
3. Click **Install Now**, then **Activate**.
4. The Setup Wizard will launch automatically — follow the 3 steps to verify your store configuration.

= Manual Installation =

1. Download the plugin zip file.
2. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**.
3. Choose the zip file and click **Install Now**.
4. Activate the plugin. The Setup Wizard will launch automatically.

= After Activation =

* The Setup Wizard checks HSN codes on your products, your GST tax rates, and whether PDF Invoices & Packing Slips is correctly configured.
* You can re-run the wizard anytime from **WordPress Admin → GST Report Setup**.
* The dashboard is available at **WordPress Admin → GST Report**.

= Requirements =

* WordPress 5.9 or higher
* WooCommerce 5.0 or higher
* PHP 7.4 or higher
* WooCommerce tax rates configured (18% on the Standard class; a tax class containing `5` for 5% GST items)
* **[PDF Invoices & Packing Slips for WooCommerce](https://wordpress.org/plugins/woocommerce-pdf-invoices-packing-slips/)** — required for the Invoice button. Set **Document link access type** to **Full** in WooCommerce → PDF Invoices → Debug for invoice links to open without login.

== Frequently Asked Questions ==

= Does the plugin work right after activation? =

Yes. The Setup Wizard runs automatically on first activation and guides you through three checks: HSN codes, GST tax rates, and PDF Invoices plugin. After completing the wizard, the GST dashboard is ready to use.

= How does the plugin determine CGST/SGST vs IGST? =

The plugin reads the billing state of each order. If the billing state is **TN** (Tamil Nadu), the tax is split equally as CGST + SGST (intra-state). All other billing states are treated as IGST (inter-state). To change the home state, edit the `is_tn()` method in `includes/class-gst-calculator.php`.

= How do I set the HSN code for my products? =

Go to **Products → Edit Product** and add a custom field with the key `hsn` (or `_hsn_code`) and the HSN code as the value. Alternatively, add a product attribute whose name contains "HSN" (e.g. "HSN Code", "HSN/SAC"). The plugin checks variations first, then the parent product.

= How do I mark a product as 5% GST? =

Assign a WooCommerce tax class whose name contains `5` (e.g. "GST 5%", "5 Percent") to the product. The default tax class and all other classes are treated as 18% GST.

= The Invoice button is not working. What should I do? =

1. Make sure **PDF Invoices & Packing Slips for WooCommerce** is installed and active.
2. Go to **WooCommerce → PDF Invoices → Debug → File System & Access**.
3. Set **Document link access type** to **Full** and save.
4. Invoice buttons will now open PDF invoices in a new tab directly from the GST dashboard.

= Does the plugin support WooCommerce HPOS (High-Performance Order Storage)? =

Yes. The plugin automatically detects whether HPOS is enabled and adjusts its SQL stats query between the `wc_orders` table (HPOS) and the classic `wp_posts` / `wp_postmeta` tables accordingly.

= Can I filter the Excel export by date range? =

Yes. Apply the date filters on the GST Report page, then click **Export Excel**. The exported `.xlsx` file will contain only the orders matching the active filter.

= Does the plugin work with variable products? =

Yes. The HSN code lookup checks the specific variation first (more precise), then falls back to the parent product if no HSN is found on the variation.

= Can I search for a specific order in the dashboard? =

Yes. Use the Search field to find orders by **Order ID** (numeric) or **Billing Email**. The search applies to all three tabs and to the Excel export.

= Does the plugin store any customer data? =

No. The plugin only reads WooCommerce order and product data that already exists in your database. It does not create, modify, or transmit any customer data.

= Is the plugin compatible with multisite? =

The plugin is designed for single-site WooCommerce installations. Multisite compatibility has not been tested.

== Screenshots ==

1. Setup Wizard — welcome screen with Setups Works branding.
2. Setup Wizard — HSN code check listing products missing HSN codes.
3. Setup Wizard — GST tax rate check showing 18% and 5% rate status.
4. Setup Wizard — PDF Invoices plugin check with access type status.
5. GST Report tab — line-item breakdown with CGST/SGST/IGST columns.
6. Orders tab — card-based view with per-order GST breakdown.
7. Products tab — product list with HSN code and GST rate.
8. Summary stat cards — total orders, revenue, GST collected, average order.

== Changelog ==

= 2.0.4 =
* Fixed: Invoice access key now read automatically from each order using `$order->get_order_key()` — matches the WPO WCPDF "Full" access type URL format (`wc_order_XXXXX`). No manual key entry needed.
* Fixed: Wizard step 4 now checks "Document link access type" setting and guides user to set it to Full if needed.
* Fixed: Removed crash-prone global access key detection via WPO_WCPDF PHP object.
* Fixed: Wizard simplified — no manual key input field; keys are per-order and automatic.

= 2.0.3 =
* Fixed: Fatal error when accessing wizard step 4 — `$obj->settings->debug` accessed without null check causing crash on PHP 8.
* Fixed: Added `try/catch \Throwable` around all WPO WCPDF detection code.
* Fixed: Removed auto-save side effect from render method.

= 2.0.2 =
* Added: Setup Wizard launches automatically on first plugin activation.
* Added: Wizard Step 1 — Welcome screen with Setups Works branding.
* Added: Wizard Step 2 — HSN code check scans all products and lists missing ones with edit links.
* Added: Wizard Step 3 — GST tax rate check verifies 18% and 5% rates are configured in WooCommerce.
* Added: Wizard Step 4 — PDF Invoices plugin check and access key configuration.
* Added: Invoice buttons open in a new tab (`target="_blank"`).
* Fixed: Orders tab invoice URL was still pointing to the removed internal invoice handler.

= 2.0.1 =
* Fixed: Escaped `$class` in tab navigation with `esc_attr()`.
* Fixed: Wrapped `paginate_links()` output with `wp_kses_post()`.
* Fixed: Replaced `date()` with `wp_date()` for timezone-safe Excel filename.
* Fixed: Replaced `tempnam()` with `wp_tempnam()` and `unlink()` with `wp_delete_file()`.
* Fixed: Added `wp_unslash()` to all `$_GET` reads before sanitization.
* Fixed: Added result caching to stats SQL query via `wp_cache_get()` / `wp_cache_set()`.
* Fixed: Replaced `phpcs:ignore` with `phpcs:disable`/`phpcs:enable` blocks to cover multiline SQL queries.
* Fixed: Reduced plugin tags to the WordPress.org maximum of 5.

= 2.0.0 =
* Complete rewrite — native PHP, direct DB queries, no JavaScript frameworks, no REST API.
* Added HPOS (High-Performance Order Storage) compatibility with automatic detection.
* Added 5% GST rate support alongside 18% — detected via tax class name.
* Added Excel (.xlsx) export using a zero-dependency PHP XLSX writer.
* Added PDF invoice button (via WooCommerce PDF Invoices & Packing Slips plugin).
* Added Products tab with thumbnail, SKU, HSN code, price, stock, and GST rate.
* Added Orders tab with card-based view and per-order GST breakdown.
* Added HSN lookup across product meta, attributes, and order-item meta.
* Added SQL-based stats aggregation (no N+1 queries).
* Added nonce protection on all export and download actions.

== Upgrade Notice ==

= 2.0.4 =
Invoice buttons now work automatically using each order's own key — no access key configuration needed. Deactivate and reactivate the plugin after upgrading to trigger the updated wizard.

= 2.0.0 =
Full rewrite. Deactivate and reactivate the plugin after upgrading.
