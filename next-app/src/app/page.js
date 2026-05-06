"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, RefreshCw, Trash2, Download, Search, Filter } from 'lucide-react';

import { getApiBase } from '@/utils/apiConfig';
import { saveConfigToDB, loadConfigFromDB, clearConfigFromDB, saveDataToDB, loadDataFromDB } from '@/utils/db';
import { exportToExcel, downloadInvoice } from '@/utils/exportHelpers';

import ConfigScreen from '@/components/ConfigScreen';
import StatsCards from '@/components/StatsCards';
import Pagination from '@/components/Pagination';
import GSTReportTab from '@/components/tabs/GSTReportTab';
import ProductsTab from '@/components/tabs/ProductsTab';
import OrdersTab from '@/components/tabs/OrdersTab';

const ENV_CONFIG = {
  siteUrl: process.env.NEXT_PUBLIC_WC_SITE_URL || "",
  consumerKey: process.env.NEXT_PUBLIC_WC_CONSUMER_KEY || "",
  consumerSecret: process.env.NEXT_PUBLIC_WC_CONSUMER_SECRET || ""
};

// rateLimitRef is shared across all concurrent workers so one 429 pauses everyone
const fetchWithRetry = async (url, headers, pageStr, rateLimitRef) => {
  let retries = 10;
  let backoff = 2000;
  while (retries > 0) {
    const waitNeeded = rateLimitRef.until - Date.now();
    if (waitNeeded > 0) await new Promise(r => setTimeout(r, waitNeeded));
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        const waitTime = res.headers.get("retry-after")
          ? parseInt(res.headers.get("retry-after")) * 1000
          : backoff;
        rateLimitRef.until = Math.max(rateLimitRef.until, Date.now() + waitTime);
        backoff = Math.min(backoff * 2, 30000);
        retries--;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      retries--;
      if (retries === 0) throw new Error(`Failed ${pageStr} after retries: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Failed ${pageStr}: Exceeded maximum retries for rate limiting.`);
};

const WooCommerceGSTDashboard = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [config, setConfig] = useState(ENV_CONFIG);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("gst-report");

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", price: "", sku: "", stock_quantity: "", gst_rate: "18", hsn_code: ""
  });

  useEffect(() => {
    const loadSavedConfig = async () => {
      const savedConfig = await loadConfigFromDB();
      if (savedConfig) {
        setConfig({
          siteUrl: savedConfig.siteUrl,
          consumerKey: savedConfig.consumerKey,
          consumerSecret: savedConfig.consumerSecret
        });
        setIsConfigured(true);
      } else if (ENV_CONFIG.siteUrl && ENV_CONFIG.consumerKey && ENV_CONFIG.consumerSecret) {
        setIsConfigured(true);
      }
    };
    loadSavedConfig();
  }, []);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const fetchProducts = async () => {
    if (!isConfigured) return;
    
    // Cache-First Load
    const cachedProducts = await loadDataFromDB("products");
    if (cachedProducts && cachedProducts.length > 0) {
      setProducts(cachedProducts);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase(config, ENV_CONFIG);
      const headers = { Authorization: `Basic ${auth}` };
      const baseUrl = `${apiBase}/wp-json/wc/v3/products?per_page=100`;

      const rateLimitRef = { until: 0 };
      const firstResponse = await fetchWithRetry(`${baseUrl}&page=1`, headers, "initial products", rateLimitRef);
      const firstData = await firstResponse.json();
      const totalPages = parseInt(firstResponse.headers.get("X-WP-TotalPages") || "1");

      if (totalPages === 1) {
        setProducts(firstData);
        setLoading(false);
        return;
      }

      const tasks = [];
      for (let page = 2; page <= totalPages; page++) {
        tasks.push(async () => {
          const res = await fetchWithRetry(`${baseUrl}&page=${page}`, headers, `page ${page}`, rateLimitRef);
          const data = await res.json();
          return { page, data };
        });
      }

      const POOL_SIZE = 2;
      const remainingResults = [];
      let i = 0;

      const workers = Array(POOL_SIZE).fill(null).map(async () => {
        while (i < tasks.length) {
          const taskIndex = i++;
          const result = await tasks[taskIndex]();
          remainingResults.push(result);
          await new Promise(r => setTimeout(r, 300)); // brief pause between requests
        }
      });
      await Promise.all(workers);

      const allResults = [{ page: 1, data: firstData }, ...remainingResults];
      allResults.sort((a, b) => a.page - b.page);
      const allProducts = allResults.flatMap((r) => r.data);

      setProducts(allProducts);
      await saveDataToDB("products", allProducts);
    } catch (err) {
      setError("Error fetching products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!isConfigured) return;
    
    // Cache-First Load
    const cachedOrders = await loadDataFromDB("orders");
    if (cachedOrders && cachedOrders.length > 0) {
      setOrders(cachedOrders);
    } else {
      setLoading(true);
    }
    setError("");
    setFetchProgress({ current: 0, total: 0 });

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase(config, ENV_CONFIG);
      const headers = { Authorization: `Basic ${auth}` };
      const baseUrl = `${apiBase}/wp-json/wc/v3/orders?per_page=100`;

      const rateLimitRef = { until: 0 };
      const firstResponse = await fetchWithRetry(`${baseUrl}&page=1`, headers, "initial orders", rateLimitRef);
      const firstData = await firstResponse.json();
      const totalPages = parseInt(firstResponse.headers.get("X-WP-TotalPages") || "1");

      setFetchProgress({ current: 1, total: totalPages });

      if (totalPages === 1) {
        setOrders(firstData);
        setFetchProgress({ current: 0, total: 0 });
        setLoading(false);
        return;
      }

      const tasks = [];
      for (let page = 2; page <= totalPages; page++) {
        tasks.push(async () => {
          const res = await fetchWithRetry(`${baseUrl}&page=${page}`, headers, `page ${page}`, rateLimitRef);
          const data = await res.json();
          setFetchProgress(p => ({ ...p, current: p.current + 1 }));
          return { page, data };
        });
      }

      const POOL_SIZE = 2;
      const remainingResults = [];
      let i = 0;

      const workers = Array(POOL_SIZE).fill(null).map(async () => {
        while (i < tasks.length) {
          const taskIndex = i++;
          const result = await tasks[taskIndex]();
          remainingResults.push(result);
          await new Promise(r => setTimeout(r, 300)); // brief pause between requests
        }
      });
      await Promise.all(workers);

      const allResults = [{ page: 1, data: firstData }, ...remainingResults];
      allResults.sort((a, b) => a.page - b.page);
      const allOrders = allResults.flatMap((r) => r.data);

      setOrders(allOrders);
      await saveDataToDB("orders", allOrders);
    } catch (err) {
      setError("Error fetching orders: " + err.message);
    } finally {
      setFetchProgress({ current: 0, total: 0 });
      setLoading(false);
    }
  };

  const addProduct = async () => {
    if (!isConfigured) return;
    setLoading(true);
    setError("");

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase(config, ENV_CONFIG);
      const response = await fetch(`${apiBase}/wp-json/wc/v3/products`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name,
          type: "simple",
          regular_price: newProduct.price,
          sku: newProduct.sku,
          stock_quantity: parseInt(newProduct.stock_quantity || 0),
          manage_stock: true,
          meta_data: [
            { key: "_gst_rate", value: newProduct.gst_rate },
            { key: "hsn", value: newProduct.hsn_code },
            { key: "_hsn_code", value: newProduct.hsn_code }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error("Failed to add product: " + errText);
      }

      await fetchProducts();
      setShowAddProduct(false);
      setNewProduct({ name: "", price: "", sku: "", stock_quantity: "", gst_rate: "18", hsn_code: "" });
    } catch (err) {
      setError("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConfigured) {
      fetchProducts();
      fetchOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  const handleConfigSubmit = async () => {
    if (config.siteUrl && config.consumerKey && config.consumerSecret) {
      await saveConfigToDB(config);
      setIsConfigured(true);
    }
  };

  const handleDisconnect = async () => {
    await clearConfigFromDB();
    setConfig({ siteUrl: "", consumerKey: "", consumerSecret: "" });
    setIsConfigured(false);
    setProducts([]);
    setOrders([]);
  };

  const uniqueCustomers = useMemo(() => {
    const customers = new Set();
    orders.forEach((order) => {
      if (order.billing?.first_name || order.billing?.last_name) {
        customers.add(`${order.billing.first_name || ""} ${order.billing.last_name || ""}`.trim());
      }
    });
    return Array.from(customers).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const searchStr = `${order.id} ${order.billing?.first_name} ${order.billing?.last_name}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      
      const orderDate = new Date(order.date_created);
      const start = dateFilter.start ? new Date(dateFilter.start) : null;
      const end = dateFilter.end ? new Date(dateFilter.end) : null;
      if (end) end.setHours(23, 59, 59);

      const matchesDateStart = start ? orderDate >= start : true;
      const matchesDateEnd = end ? orderDate <= end : true;

      const customerName = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim();
      const matchesCustomer = selectedCustomer && selectedCustomer !== "all" ? customerName === selectedCustomer : true;

      return matchesSearch && matchesDateStart && matchesDateEnd && matchesCustomer;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.date_created).getTime();
      const dateB = new Date(b.date_created).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [orders, searchTerm, dateFilter, selectedCustomer, sortOrder]);

  const calculateStats = () => {
    let totalRevenue = 0;
    let totalTax = 0;
    filteredOrders.forEach((order) => {
      if (order.status !== "cancelled" && order.status !== "refunded" && order.status !== "failed") {
        totalRevenue += parseFloat(order.total || 0);
        totalTax += parseFloat(order.total_tax || 0);
      }
    });

    return {
      allOrders: orders.length,
      totalOrders: filteredOrders.length,
      totalProducts: products.length,
      totalRevenue: totalRevenue.toFixed(2),
      totalTax: totalTax.toFixed(2),
      avgOrderValue: filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : "0.00"
    };
  };

  const stats = calculateStats();

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);
  const totalOrderPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;

  const paginatedProducts = useMemo(() => {
    return products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [products, currentPage]);
  const totalProductPages = Math.ceil(products.length / ITEMS_PER_PAGE) || 1;

  const renderPagination = (totalPages, label) => {
    return <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} label={label} />;
  };

  if (!isConfigured) {
    return <ConfigScreen config={config} setConfig={setConfig} handleConfigSubmit={handleConfigSubmit} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">WooCommerce GST Dashboard</h1>
                <p className="text-sm text-gray-600">Indian Tax Compliant - {stats.allOrders} Total Orders</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => exportToExcel(filteredOrders, productMap)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => { fetchProducts(); fetchOrders(); }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {fetchProgress.total > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                Fetching orders... Page {fetchProgress.current} of {fetchProgress.total}
              </span>
              <span className="text-sm text-blue-700">
                {Math.round((fetchProgress.current / fetchProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <StatsCards stats={stats} />

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="all">All Customers ({orders.length})</option>
                {uniqueCustomers.map((customer, idx) => (
                  <option key={idx} value={customer}>{customer}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Order ID or Customer" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6 bg-white overflow-x-auto">
              <button 
                onClick={() => { setActiveTab("gst-report"); setCurrentPage(1); }} 
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === "gst-report" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
              >
                GST Report
              </button>
              <button 
                onClick={() => { setActiveTab("products"); setCurrentPage(1); }} 
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === "products" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
              >
                Products ({products.length})
              </button>
              <button 
                onClick={() => { setActiveTab("orders"); setCurrentPage(1); }} 
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === "orders" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
              >
                Orders ({filteredOrders.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>}

            {loading && fetchProgress.total === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading data...</p>
              </div>
            ) : (
              <>
                {activeTab === "gst-report" && (
                  <GSTReportTab 
                    paginatedOrders={paginatedOrders} 
                    productMap={productMap} 
                    renderPagination={renderPagination} 
                    downloadInvoice={downloadInvoice} 
                    totalOrderPages={totalOrderPages} 
                  />
                )}
                {activeTab === "products" && (
                  <ProductsTab 
                    paginatedProducts={paginatedProducts} 
                    showAddProduct={showAddProduct} 
                    setShowAddProduct={setShowAddProduct} 
                    newProduct={newProduct} 
                    setNewProduct={setNewProduct} 
                    addProduct={addProduct} 
                    totalProductPages={totalProductPages} 
                    renderPagination={renderPagination} 
                  />
                )}
                {activeTab === "orders" && (
                  <OrdersTab 
                    paginatedOrders={paginatedOrders} 
                    productMap={productMap} 
                    downloadInvoice={downloadInvoice} 
                    totalOrderPages={totalOrderPages} 
                    renderPagination={renderPagination} 
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WooCommerceGSTDashboard;
