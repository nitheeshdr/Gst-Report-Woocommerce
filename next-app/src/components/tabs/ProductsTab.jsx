import React from 'react';
import { Plus, Package } from 'lucide-react';

const ProductsTab = ({ 
  paginatedProducts, 
  totalProductPages, 
  renderPagination, 
  showAddProduct, 
  setShowAddProduct, 
  newProduct, 
  setNewProduct, 
  addProduct 
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Products</h2>
        <button
          onClick={() => setShowAddProduct(!showAddProduct)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {showAddProduct && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg border-2 border-indigo-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Product</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Product Name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Price"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="SKU"
              value={newProduct.sku}
              onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Stock Quantity"
              value={newProduct.stock_quantity}
              onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="HSN Code"
              value={newProduct.hsn_code}
              onChange={(e) => setNewProduct({ ...newProduct, hsn_code: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={newProduct.gst_rate}
              onChange={(e) => setNewProduct({ ...newProduct, gst_rate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="0">0% GST</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST</option>
              <option value="28">28% GST</option>
            </select>
          </div>
          <div className="flex space-x-3 mt-4">
            <button onClick={addProduct} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Add Product</button>
            <button onClick={() => setShowAddProduct(false)} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Image</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">HSN Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">GST Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.map((product) => {
              const gstRate = product.meta_data?.find((m) => m.key === "_gst_rate")?.value || "N/A";
              const hsnCode = product.meta_data?.find((m) => m.key === "_hsn_code" || m.key === "hsn")?.value || "N/A";

              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {product.images?.[0]?.src ? (
                      <img src={product.images[0].src} alt={product.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4"><div className="text-sm font-medium text-black">{product.name}</div></td>
                  <td className="px-6 py-4 text-sm text-black">{product.sku || "N/A"}</td>
                  <td className="px-6 py-4 text-sm text-black">{hsnCode}</td>
                  <td className="px-6 py-4 text-sm font-medium text-black">₹{product.price}</td>
                  <td className="px-6 py-4 text-sm text-black">{product.stock_quantity !== null ? product.stock_quantity : "N/A"}</td>
                  <td className="px-6 py-4 text-sm text-black">{gstRate}%</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${product.stock_status === "instock" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{product.stock_status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {renderPagination(totalProductPages, "products")}
    </div>
  );
};

export default ProductsTab;
