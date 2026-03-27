import React from 'react';
import { Download } from 'lucide-react';
import { calculateGST, getHSN } from '../../utils/gstCalculator';

const OrdersTab = ({ paginatedOrders, renderPagination, totalOrderPages, downloadInvoice, productMap }) => {
  return (
    <div className="flex flex-col space-y-4">
      <div className="space-y-4">
        {paginatedOrders.map((order) => {
          const gst = calculateGST(order);
          return (
            <div key={order.id} className="border rounded-lg p-6 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                  <p className="text-sm text-gray-500 mt-1">{new Date(order.date_created).toLocaleDateString("en-IN")} at {new Date(order.date_created).toLocaleTimeString("en-IN")}</p>
                  <p className="text-sm text-gray-600 mt-1">State: {order.billing?.state} {gst.isTamilNadu ? "(Tamil Nadu - CGST/SGST)" : "(Other State - IGST)"}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.status === "completed" ? "bg-green-100 text-green-800" : order.status === "processing" ? "bg-blue-100 text-blue-800" : order.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>{order.status}</span>
                  <button onClick={() => downloadInvoice(order, productMap)} className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm">
                    <Download className="w-4 h-4" />
                    <span>Invoice</span>
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Customer</h4>
                  <p className="text-sm text-gray-900">{order.billing?.first_name} {order.billing?.last_name}</p>
                  <p className="text-sm text-gray-500">{order.billing?.email}</p>
                  <p className="text-sm text-gray-500">GSTIN: {order.meta_data?.find(m => m.key === "_billing_gstin" || m.key === "gstin")?.value || "N/A"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Total</h4>
                  <p className="text-2xl font-bold text-gray-900">₹{order.total}</p>
                  <p className="text-sm text-gray-500">Tax: ₹{order.total_tax}</p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">GST Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded"><p className="text-gray-600">Subtotal</p><p className="font-semibold">₹{gst.subtotal.toFixed(2)}</p></div>
                  {gst.discountTotal > 0 && <div className="bg-red-50 p-3 rounded"><p className="text-gray-600">Discount</p><p className="font-semibold text-red-600">-₹{gst.discountTotal.toFixed(2)}</p></div>}
                  {gst.cgst9 > 0 && <>
                    <div className="bg-blue-50 p-3 rounded"><p className="text-gray-600">CGST (9%)</p><p className="font-semibold">₹{gst.cgst9.toFixed(2)}</p></div>
                    <div className="bg-blue-50 p-3 rounded"><p className="text-gray-600">SGST (9%)</p><p className="font-semibold">₹{gst.sgst9.toFixed(2)}</p></div>
                  </>}
                  {gst.igst18 > 0 && <div className="bg-purple-50 p-3 rounded"><p className="text-gray-600">IGST (18%)</p><p className="font-semibold">₹{gst.igst18.toFixed(2)}</p></div>}
                  {gst.cgst2_5 > 0 && <>
                    <div className="bg-green-50 p-3 rounded"><p className="text-gray-600">CGST (2.5%)</p><p className="font-semibold">₹{gst.cgst2_5.toFixed(2)}</p></div>
                    <div className="bg-green-50 p-3 rounded"><p className="text-gray-600">SGST (2.5%)</p><p className="font-semibold">₹{gst.sgst2_5.toFixed(2)}</p></div>
                  </>}
                  {gst.igst5 > 0 && <div className="bg-yellow-50 p-3 rounded"><p className="text-gray-600">IGST (5%)</p><p className="font-semibold">₹{gst.igst5.toFixed(2)}</p></div>}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Items</h4>
                <div className="space-y-2">
                  {order.line_items?.map((item, idx) => {
                    const hsn = getHSN(item, productMap);
                    return (
                      <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                        <span className="text-gray-900">
                          {item.name} x {item.quantity}
                          <span className="text-gray-500 text-xs ml-2">(HSN: {hsn})</span>
                        </span>
                        <span className="text-gray-600">₹{item.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {renderPagination(totalOrderPages, "orders")}
    </div>
  );
};

export default OrdersTab;
