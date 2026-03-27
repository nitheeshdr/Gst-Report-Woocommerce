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
  body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; color: #111; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { padding: 8px; border: 1px solid #000; text-align: left; }
  th { background: #f4f4f4; }
  .shop-info { text-align: right; }
  .totals-table td { border: none; padding: 6px; }
</style>
</head>
<body>
<div class="header"><h1>TAX INVOICE</h1></div>

<table>
  <tr>
    <td>
      <strong>Your Shop Name</strong><br/>
      5, Thilagar Street, AGS Colony, Alwarthirunagar,<br/>
      Chennai - 600087<br/>
      GSTIN: 33AAJCN0778NIZZ
    </td>
    <td class="shop-info">
      <strong>Invoice #:</strong> ${order.id}<br/>
      <strong>Date:</strong> ${new Date(order.date_created).toLocaleDateString("en-IN")}<br/>
      <strong>Payment:</strong> ${order.payment_method_title || "N/A"}
    </td>
  </tr>
</table>

<h4>Billing Address</h4>
<p>
  ${order.billing?.first_name || ""} ${order.billing?.last_name || ""}<br/>
  ${order.billing?.address_1 || ""}<br/>
  ${order.billing?.city || ""}, ${order.billing?.state || ""} - ${order.billing?.postcode || ""}<br/>
  Phone: ${order.billing?.phone || ""}<br/>
  GSTIN: ${gstin}
</p>

<h4>Items</h4>
<table>
  <thead>
    <tr>
      <th>Product</th>
      <th>HSN</th>
      <th>Qty</th>
      <th>Rate</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    ${order.line_items
      .map((item) => {
        const hsn = getHSN(item, productMap);
        const qty = item.quantity || 1;
        const rate = qty ? (parseFloat(item.subtotal || 0) / qty) : 0;
        return `<tr>
          <td>${item.name}</td>
          <td>${hsn}</td>
          <td>${qty}</td>
          <td>₹${rate.toFixed(2)}</td>
          <td>₹${parseFloat(item.subtotal || item.total || 0).toFixed(2)}</td>
        </tr>`;
      })
      .join("")}
  </tbody>
</table>

<table class="totals-table" style="width: 100%; margin-top: 8px;">
  <tr>
    <td style="width:70%"></td>
    <td style="width:30%">
      <table style="width:100%;">
        <tr><td>Subtotal:</td><td style="text-align:right;">₹${subtotal.toFixed(2)}</td></tr>
        ${gst.discountTotal > 0 ? `<tr><td>Discount:</td><td style="text-align:right;">-₹${gst.discountTotal.toFixed(2)}</td></tr>` : ""}
        ${gst.cgst2_5 > 0 ? `<tr><td>CGST (2.5%):</td><td style="text-align:right;">₹${gst.cgst2_5.toFixed(2)}</td></tr>` : ""}
        ${gst.sgst2_5 > 0 ? `<tr><td>SGST (2.5%):</td><td style="text-align:right;">₹${gst.sgst2_5.toFixed(2)}</td></tr>` : ""}
        ${gst.cgst9 > 0 ? `<tr><td>CGST (9%):</td><td style="text-align:right;">₹${gst.cgst9.toFixed(2)}</td></tr>` : ""}
        ${gst.sgst9 > 0 ? `<tr><td>SGST (9%):</td><td style="text-align:right;">₹${gst.sgst9.toFixed(2)}</td></tr>` : ""}
        ${gst.igst5 > 0 ? `<tr><td>IGST (5%):</td><td style="text-align:right;">₹${gst.igst5.toFixed(2)}</td></tr>` : ""}
        ${gst.igst18 > 0 ? `<tr><td>IGST (18%):</td><td style="text-align:right;">₹${gst.igst18.toFixed(2)}</td></tr>` : ""}
        <tr><td><strong>Order Total:</strong></td><td style="text-align:right;"><strong>₹${order.total}</strong></td></tr>
      </table>
    </td>
  </tr>
</table>

<div style="margin-top:18px;">
  <strong>Terms & Conditions</strong>
  <ul>
    <li>Subject to our home Jurisdiction.</li>
    <li>Our Responsibility Ceases as soon as goods leaves our Premises.</li>
    <li>Goods once sold will not taken back.</li>
    <li>Delivery Ex-Premises.</li>
  </ul>
</div>
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
