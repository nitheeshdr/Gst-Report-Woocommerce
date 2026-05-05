import React from 'react';
import { FileText } from 'lucide-react';
import { calcSubtotal, isOrderCancelled, calculateLineItemGST, getHSN, calculateShippingGST } from '../../utils/gstCalculator';

const GSTReportTab = ({ paginatedOrders, productMap, renderPagination, downloadInvoice, totalOrderPages }) => {
  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto border rounded-t-lg">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inv. No</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">DC. No</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">GSTIN</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">HSN</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supply @ 18%</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">9% CGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">9% SGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">18% IGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supply @ 5%</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">2.5% CGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">2.5% SGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">5% IGST</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">0% Tax</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">TOTAL</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedOrders.flatMap((order) => {
              const dcNo = order.meta_data?.find((m) => m.key === "_dc_number")?.value || "-";
              const gstin = order.meta_data?.find((m) => m.key === "_billing_gstin" || m.key === "gstin")?.value || "N/A";
              const orderSubtotal = calcSubtotal(order);
              const orderDiscount = parseFloat(order.discount_total || 0);
              const discountRatio = orderSubtotal > 0 ? orderDiscount / orderSubtotal : 0;
              const isCancelled = isOrderCancelled(order);
              const orderDate = new Date(order.date_created).toLocaleDateString("en-IN");
              const customerName = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`;
              const state = order.billing?.state || "";

              const rows = [];

              // Add product line items
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
                const multiplier = isCancelled ? -1 : 1;
                const lineTotal = (adjustedSubtotal + itemTaxAmount) * multiplier;

                rows.push(
                  <tr key={`${order.id}-${item.id}`} className={`hover:bg-gray-50 ${isCancelled ? "bg-red-50" : ""}`}>
                    <td className="px-2 py-2">{orderDate}</td>
                    <td className="px-2 py-2">{order.id}</td>
                    <td className="px-2 py-2">{dcNo}</td>
                    <td className="px-2 py-2">{customerName}</td>
                    <td className="px-2 py-2">{gstin}</td>
                    <td className="px-2 py-2">{state}</td>
                    <td className="px-2 py-2">{hsn}</td>
                    <td className="px-2 py-2">{item.quantity || 0}</td>
                    <td className="px-2 py-2">₹{adjustedSubtotal.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.supply18.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.cgst9.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.sgst9.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.igst18.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.supply5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.cgst2_5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.sgst2_5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.igst5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{lineGST.supply0.toFixed(2)}</td>
                    <td className={`px-2 py-2 font-bold ${isCancelled ? "text-red-600" : ""}`}>
                      ₹{lineTotal.toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => downloadInvoice(order, productMap)}>
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </button>
                    </td>
                  </tr>
                );
              });

              // Add shipping as a separate line item if shipping exists
              const shippingTotal = parseFloat(order.shipping_total || 0);
              if (shippingTotal > 0) {
                const shippingGST = calculateShippingGST(order);
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

                rows.push(
                  <tr key={`${order.id}-shipping`} className={`hover:bg-gray-50 ${isCancelled ? "bg-red-50" : "bg-blue-50"}`}>
                    <td className="px-2 py-2">{orderDate}</td>
                    <td className="px-2 py-2">{order.id}</td>
                    <td className="px-2 py-2">{dcNo}</td>
                    <td className="px-2 py-2">{customerName}</td>
                    <td className="px-2 py-2">{gstin}</td>
                    <td className="px-2 py-2">{state}</td>
                    <td className="px-2 py-2">996812</td>
                    <td className="px-2 py-2">1</td>
                    <td className="px-2 py-2">₹{shippingTotal.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.supply18.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.cgst9.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.sgst9.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.igst18.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.supply5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.cgst2_5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.sgst2_5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.igst5.toFixed(2)}</td>
                    <td className="px-2 py-2">₹{shippingGST.supply0.toFixed(2)}</td>
                    <td className={`px-2 py-2 font-bold ${isCancelled ? "text-red-600" : ""}`}>
                      ₹{shippingLineTotal.toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => downloadInvoice(order, productMap)}>
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </button>
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
      {renderPagination(totalOrderPages, "(orders calculated in this table)")}
    </div>
  );
};

export default GSTReportTab;
