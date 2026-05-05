import { 
  calcSubtotal, 
  calculateLineItemGST, 
  calculateShippingGST, 
  isOrderCancelled, 
  getHSN, 
  calculateGST 
} from './gstCalculator';

// Export CSV (per line item GST)
export const exportToExcel = (filteredOrders, productMap) => {
  const headers = [
    "Date",
    "Inv. No",
    "Invoice Date",
    "DC. No",
    "Customer",
    "GSTIN No",
    "State",
    "HSN Code",
    "Qty",
    "Subtotal",
    "Supply @ 18%",
    "9% CGST",
    "9% SGST",
    "18% IGST",
    "Supply @ 5%",
    "2.5% CGST",
    "2.5% SGST",
    "5% IGST",
    "0% Tax",
    "TOTAL"
  ];

  const rows = [];
  filteredOrders.forEach((order) => {
    const gstin = order.meta_data?.find((m) => m.key === "_billing_gstin" || m.key === "gstin")?.value || "N/A";
    const dcNo = order.meta_data?.find((m) => m.key === "_dc_number")?.value || "-";
    const orderDate = new Date(order.date_created).toLocaleDateString("en-IN");
    const customerName = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`;
    const state = order.billing?.state || "";

    // Calculate discount per item (proportional)
    const orderSubtotal = calcSubtotal(order);
    const orderDiscount = parseFloat(order.discount_total || 0);
    const discountRatio = orderSubtotal > 0 ? orderDiscount / orderSubtotal : 0;

    order.line_items?.forEach((item) => {
      const lineGST = calculateLineItemGST(item, order);
      const hsn = getHSN(item, productMap);
      const itemSubtotal = parseFloat(item.subtotal || 0);
      const itemDiscount = itemSubtotal * discountRatio;
      const adjustedSubtotal = itemSubtotal - itemDiscount;
      // Calculate item tax amount for total
      let itemTaxAmount = 0;
      if (item.taxes && item.taxes.length > 0) {
        item.taxes.forEach((tax) => {
          itemTaxAmount += parseFloat(tax.total || 0);
        });
      }
      const isCancelled = isOrderCancelled(order);
      const multiplier = isCancelled ? -1 : 1;
      const lineTotal = (adjustedSubtotal + itemTaxAmount) * multiplier;

      rows.push([
        orderDate,
        order.id,
        orderDate,
        dcNo,
        customerName,
        gstin,
        state,
        hsn,
        item.quantity || 0,
        adjustedSubtotal.toFixed(2),
        lineGST.supply18.toFixed(2),
        lineGST.cgst9.toFixed(2),
        lineGST.sgst9.toFixed(2),
        lineGST.igst18.toFixed(2),
        lineGST.supply5.toFixed(2),
        lineGST.cgst2_5.toFixed(2),
        lineGST.sgst2_5.toFixed(2),
        lineGST.igst5.toFixed(2),
        lineGST.supply0.toFixed(2),
        lineTotal.toFixed(2)
      ]);
    });

    // Add shipping as a separate line item if shipping exists
    const shippingTotal = parseFloat(order.shipping_total || 0);
    if (shippingTotal > 0) {
      const shippingGST = calculateShippingGST(order);
      const isCancelled = isOrderCancelled(order);
      const multiplier = isCancelled ? -1 : 1;
      let shippingTaxAmount = 0;
      if (order.shipping_lines) {
        order.shipping_lines.forEach((shipping) => {
          if (shipping.taxes && shipping.taxes.length > 0) {
            shipping.taxes.forEach((tax) => {
              shippingTaxAmount += parseFloat(tax.total || 0);
            });
          }
        });
      }
      const shippingLineTotal = (shippingTotal + shippingTaxAmount) * multiplier;

      rows.push([
        orderDate,
        order.id,
        orderDate,
        dcNo,
        customerName,
        gstin,
        state,
        "996812",
        1,
        shippingTotal.toFixed(2),
        shippingGST.supply18.toFixed(2),
        shippingGST.cgst9.toFixed(2),
        shippingGST.sgst9.toFixed(2),
        shippingGST.igst18.toFixed(2),
        shippingGST.supply5.toFixed(2),
        shippingGST.cgst2_5.toFixed(2),
        shippingGST.sgst2_5.toFixed(2),
        shippingGST.igst5.toFixed(2),
        shippingGST.supply0.toFixed(2),
        shippingLineTotal.toFixed(2)
      ]);
    }
  });

  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `GST_Report_${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Download invoice (fixed & uses getHSN + calcSubtotal)
export const downloadInvoice = (order, productMap) => {
  const gst = calculateGST(order);
  const subtotal = calcSubtotal(order);
  const gstin = order.meta_data?.find((m) => m.key === "_billing_gstin" || m.key === "gstin")?.value || "N/A";

  const invoiceHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; font-size: 14px; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { text-align: left; vertical-align: top; }
  
  /* Head container */
  .head { margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
  .header h1, .header h3 { margin: 0; }
  .shop-info { text-align: right; }
  .shop-name h3 { margin: 0 0 5px 0; font-size: 1.2em; }
  
  /* Order Data & Addresses */
  .order-data-addresses table { width: auto; margin: 0; }
  .order-data-addresses th { padding-right: 15px; font-weight: bold; }
  .order-data-addresses td { padding-bottom: 5px; }
  .billing-address { width: 35%; padding-right: 20px; }
  .shipping-address { width: 35%; padding-right: 20px; }
  .order-data { width: 30%; }
  
  /* Order Details Table */
  .order-details th { background: #010101ff; padding: 10px; border: 1px solid #ddd; }
  .order-details td { padding: 10px; border: 1px solid #ddd; }
  .order-details th.quantity, .order-details th.price, .order-details td.quantity, .order-details td.price { text-align: right; }
  
  /* Notes & Totals */
  .notes-totals { margin-top: 20px; }
  .notes-totals .no-borders td { border: none; padding: 0; }
  .notes-cell { width: 60%; padding-right: 40px !important; }
  .totals-cell { width: 40%; }
  .totals th, .totals td { padding: 6px; border: none; }
  .totals th { text-align: right; }
  .totals td { text-align: right; }
  
  /* Terms */
  .terms-conditions { margin-top: 20px; font-size: 12px; }
  .terms-conditions ul { padding-left: 20px; margin-top: 5px; }
</style>
</head>
<body>

<table class="head container">
	<tr>
		<td class="header">
      <h1>TAX INVOICE</h1>
		</td>
		<td class="shop-info">
			<div class="shop-name"><h3>Your Shop Name</h3></div>
			<div class="shop-address">
				<strong>5, Thilagar Street, AGS Colony, Alwarthirunagar, Valasarawakkam, Chennai-600087, Tamil Nadu, India</strong>
			</div>
			<div class="shop-gstin">
				<strong>GSTIN:</strong> 33AAJCN0778NIZZ
			</div>
		</td>
	</tr>
</table>

<table class="order-data-addresses">
	<tr>
		<td class="address billing-address">
      <h3>Billing Address</h3>
			<p>
        ${order.billing?.first_name || ""} ${order.billing?.last_name || ""}<br/>
        ${order.billing?.address_1 || ""}<br/>
        ${order.billing?.city || ""}, ${order.billing?.state || ""} - ${order.billing?.postcode || ""}<br/>
        Phone: ${order.billing?.phone || ""}<br/>
        GSTIN: ${gstin}
      </p>
		</td>
		<td class="address shipping-address">
      <h3>Shipping Address</h3>
			<p>
        ${order.shipping?.first_name || ""} ${order.shipping?.last_name || ""}<br/>
        ${order.shipping?.address_1 || ""}<br/>
        ${order.shipping?.city || ""}, ${order.shipping?.state || ""} - ${order.shipping?.postcode || ""}
      </p>
		</td>
		<td class="order-data">
			<table>
				<tr class="order-number">
					<th>Invoice Number / Order #:</th>
					<td>${order.id}</td>
				</tr>
				<tr class="order-date">
					<th>Date:</th>
					<td>${new Date(order.date_created).toLocaleDateString("en-IN")}</td>
				</tr>
				<tr class="payment-method">
					<th>Payment Method:</th>
					<td>${order.payment_method_title || "N/A"}</td>
				</tr>
			</table>
		</td>
	</tr>
</table>

<table class="order-details">
	<thead>
		<tr>
			<th class="product">Product</th>
			<th class="hsn">HSN</th>
			<th class="quantity">Quantity</th>
			<th class="price">Price</th>
		</tr>
	</thead>
	<tbody>
		${order.line_items.map((item) => {
      const hsn = getHSN(item, productMap);
      return `<tr>
        <td class="product">${item.name}</td>
        <td class="hsn">${hsn}</td>
        <td class="quantity">${item.quantity}</td>
        <td class="price">₹${parseFloat(item.subtotal || item.total || 0).toFixed(2)}</td>
      </tr>`;
    }).join("")}
	</tbody>
</table>

<table class="notes-totals">
	<tbody>
		<tr class="no-borders">
			<td class="no-borders notes-cell">
        <div class="terms-conditions">
          <h3>Terms and Conditions:</h3>
          <ul>
            <li>Subject to our home Jurisdiction.</li>
            <li>Our Responsibility Ceases as soon as goods leaves our Premises.</li>
            <li>Goods once sold will not taken back.</li>
            <li>Delivery Ex-Premises.</li>
            <li>To address any concerns about missing products, we kindly request a video recording of the package being opened.</li>
          </ul>
        </div>
			</td>
			<td class="no-borders totals-cell">
				<table class="totals">
					<tbody>
            <tr>
              <th>Items Subtotal:</th>
              <td>₹${subtotal.toFixed(2)}</td>
            </tr>
            ${gst.discountTotal > 0 ? `<tr><th>Coupon Discount:</th><td>-₹${gst.discountTotal.toFixed(2)}</td></tr>` : ""}
            
            ${gst.cgst2_5 > 0 ? `<tr><th>CGST (2.5%):</th><td>₹${gst.cgst2_5.toFixed(2)}</td></tr>` : ""}
            ${gst.sgst2_5 > 0 ? `<tr><th>SGST (2.5%):</th><td>₹${gst.sgst2_5.toFixed(2)}</td></tr>` : ""}
            ${gst.cgst9 > 0 ? `<tr><th>CGST (9%):</th><td>₹${gst.cgst9.toFixed(2)}</td></tr>` : ""}
            ${gst.sgst9 > 0 ? `<tr><th>SGST (9%):</th><td>₹${gst.sgst9.toFixed(2)}</td></tr>` : ""}
            ${gst.igst5 > 0 ? `<tr><th>IGST (5%):</th><td>₹${gst.igst5.toFixed(2)}</td></tr>` : ""}
            ${gst.igst18 > 0 ? `<tr><th>IGST (18%):</th><td>₹${gst.igst18.toFixed(2)}</td></tr>` : ""}

            <tr style="border-top: 1px solid #ddd;">
              <th><strong>Order Total:</strong></th>
              <td><strong>₹${order.total}</strong></td>
            </tr>
					</tbody>
				</table>
			</td>
		</tr>
	</tbody>
</table>

</body>
</html>`;

  const blob = new Blob([invoiceHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${order.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
};
