// Check if order is cancelled/refunded
export const isOrderCancelled = (order) => {
  return order.status === "cancelled" || order.status === "refunded" || order.status === "failed";
};

// calculate subtotal from order line_items (item.subtotal expected in Woo REST)
export const calcSubtotal = (order) => {
  return (
    order.line_items?.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) || 0
  );
};

// EXACT WooCommerce PHP HSN logic:
export const getHSN = (item, productMap) => {
  if (!item) return "N/A";
  const product = productMap ? productMap[item.product_id] : null;
  
  if (!product) {
    // fallback: if item.meta_data contains hsn then use it
    const fallback = item.meta_data?.find(
      (m) => m.key === "_hsn_code" || m.key === "hsn"
    )?.value;
    return fallback || "N/A";
  }

  // 1. 'hsn' meta
  const hsn1 = product.meta_data?.find((m) => m.key === "hsn")?.value;
  if (hsn1) return hsn1;

  // 2. '_hsn_code' meta
  const hsn2 = product.meta_data?.find((m) => m.key === "_hsn_code")?.value;
  if (hsn2) return hsn2;

  // 3. attribute called 'hsn'
  const attr = product.attributes?.find(
    (a) => (a.name || "").toLowerCase() === "hsn"
  );
  if (attr?.options?.length) {
    // attributes in REST usually store options array
    return attr.options[0];
  }

  return "N/A";
};

// Calculate GST for a single line item
export const calculateLineItemGST = (item, order) => {
  const billingState = order.billing?.state || "";
  const isTamilNadu =
    billingState.toUpperCase() === "TN" || billingState.toUpperCase() === "TAMIL NADU";
  const isCancelled = isOrderCancelled(order);
  const multiplier = isCancelled ? -1 : 1;

  const itemSubtotal = parseFloat(item.subtotal || 0);
  const taxClass = item.tax_class || "";
  let itemTaxAmount = 0;

  // Get tax amount from item.taxes
  if (item.taxes && item.taxes.length > 0) {
    item.taxes.forEach((tax) => {
      itemTaxAmount += parseFloat(tax.total || 0);
    });
  }

  // Determine GST rate based on tax class
  const is5Percent =
    taxClass.includes("5") ||
    taxClass.includes("5-percent") ||
    taxClass.includes("5_percent") ||
    taxClass.includes("gst-5");

  let result = {
    subtotal: itemSubtotal * multiplier,
    supply18: 0,
    cgst9: 0,
    sgst9: 0,
    igst18: 0,
    supply5: 0,
    cgst2_5: 0,
    sgst2_5: 0,
    igst5: 0,
    supply0: 0,
    total: (itemSubtotal + itemTaxAmount) * multiplier
  };

  if (is5Percent) {
    result.supply5 = itemSubtotal * multiplier;
    if (isTamilNadu) {
      result.cgst2_5 = (itemTaxAmount / 2) * multiplier;
      result.sgst2_5 = (itemTaxAmount / 2) * multiplier;
    } else {
      result.igst5 = itemTaxAmount * multiplier;
    }
  } else if (itemTaxAmount > 0) {
    // Default to 18% GST
    result.supply18 = itemSubtotal * multiplier;
    if (isTamilNadu) {
      result.cgst9 = (itemTaxAmount / 2) * multiplier;
      result.sgst9 = (itemTaxAmount / 2) * multiplier;
    } else {
      result.igst18 = itemTaxAmount * multiplier;
    }
  } else {
    result.supply0 = itemSubtotal * multiplier;
  }

  return result;
};

// Calculate GST for shipping
export const calculateShippingGST = (order) => {
  const billingState = order.billing?.state || "";
  const isTamilNadu =
    billingState.toUpperCase() === "TN" || billingState.toUpperCase() === "TAMIL NADU";
  const isCancelled = isOrderCancelled(order);
  const multiplier = isCancelled ? -1 : 1;

  const shippingTotal = parseFloat(order.shipping_total || 0);
  let shippingTaxAmount = 0;

  // Get shipping tax amount
  if (order.shipping_lines) {
    order.shipping_lines.forEach((shipping) => {
      if (shipping.taxes && shipping.taxes.length > 0) {
        shipping.taxes.forEach((tax) => {
          shippingTaxAmount += parseFloat(tax.total || 0);
        });
      }
    });
  }

  let result = {
    subtotal: shippingTotal * multiplier,
    supply18: 0,
    cgst9: 0,
    sgst9: 0,
    igst18: 0,
    supply5: 0,
    cgst2_5: 0,
    sgst2_5: 0,
    igst5: 0,
    supply0: 0,
    total: (shippingTotal + shippingTaxAmount) * multiplier
  };

  if (shippingTaxAmount > 0) {
    // Shipping usually has 18% GST
    result.supply18 = shippingTotal * multiplier;
    if (isTamilNadu) {
      result.cgst9 = (shippingTaxAmount / 2) * multiplier;
      result.sgst9 = (shippingTaxAmount / 2) * multiplier;
    } else {
      result.igst18 = shippingTaxAmount * multiplier;
    }
  } else if (shippingTotal > 0) {
    result.supply0 = shippingTotal * multiplier;
  }

  return result;
};

// Calculate order-level GST (for backward compatibility)
export const calculateGST = (order) => {
  const subtotal = calcSubtotal(order);
  const discountTotal = parseFloat(order.discount_total || 0);
  const orderTotal = parseFloat(order.total || 0);
  const isCancelled = isOrderCancelled(order);
  const multiplier = isCancelled ? -1 : 1;

  const billingState = order.billing?.state || "";
  const isTamilNadu =
    billingState.toUpperCase() === "TN" || billingState.toUpperCase() === "TAMIL NADU";

  let gst5Amount = 0;
  let gst18Amount = 0;

  // item taxes
  if (order.line_items) {
    order.line_items.forEach((item) => {
      const taxClass = item.tax_class || "";
      let itemTaxAmount = 0;

      if (item.taxes && item.taxes.length > 0) {
        item.taxes.forEach((tax) => {
          itemTaxAmount += parseFloat(tax.total || 0);
        });
      }

      if (
        taxClass.includes("5") ||
        taxClass.includes("5-percent") ||
        taxClass.includes("5_percent") ||
        taxClass.includes("gst-5")
      ) {
        gst5Amount += itemTaxAmount;
      } else {
        gst18Amount += itemTaxAmount;
      }
    });
  }

  // result object
  let result = {
    subtotal: subtotal * multiplier,
    discountTotal: discountTotal * multiplier,
    orderTotal: orderTotal * multiplier,
    isTamilNadu,
    supply18: 0,
    cgst9: 0,
    sgst9: 0,
    igst18: 0,
    supply5: 0,
    cgst2_5: 0,
    sgst2_5: 0,
    igst5: 0,
    supply0: 0
  };

  if (gst18Amount > 0) {
    result.supply18 = (subtotal - discountTotal - (gst5Amount > 0 ? gst5Amount / 0.05 : 0)) * multiplier;
    if (isTamilNadu) {
      result.cgst9 = (gst18Amount / 2) * multiplier;
      result.sgst9 = (gst18Amount / 2) * multiplier;
    } else {
      result.igst18 = gst18Amount * multiplier;
    }
  }

  if (gst5Amount > 0) {
    result.supply5 = (gst5Amount / 0.05) * multiplier;
    if (isTamilNadu) {
      result.cgst2_5 = (gst5Amount / 2) * multiplier;
      result.sgst2_5 = (gst5Amount / 2) * multiplier;
    } else {
      result.igst5 = gst5Amount * multiplier;
    }
  }

  return result;
};
