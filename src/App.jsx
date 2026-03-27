import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  Search,
  RefreshCw,
  Download,
  FileText,
  Plus,
  Filter,
  Trash2
} from "lucide-react";


const WooCommerceGSTDashboard = () => {
  const [activeTab, setActiveTab] = useState("gst-report");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Pre-populate from environment variables (set in .env)
  const ENV_CONFIG = {
    siteUrl: import.meta.env.VITE_WC_SITE_URL || "",
    consumerKey: import.meta.env.VITE_WC_CONSUMER_KEY || "",
    consumerSecret: import.meta.env.VITE_WC_CONSUMER_SECRET || ""
  };

  const [config, setConfig] = useState({
    siteUrl: ENV_CONFIG.siteUrl,
    consumerKey: ENV_CONFIG.consumerKey,
    consumerSecret: ENV_CONFIG.consumerSecret
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [selectedCustomer, setSelectedCustomer] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" or "oldest"
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    sku: "",
    stock_quantity: "",
    gst_rate: "18",
    hsn_code: ""
  });
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // IndexedDB functions (same as original)
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("WooCommerceDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config", { keyPath: "id" });
        }
      };
    });
  };

  const saveConfigToDB = async (configData) => {
    const db = await initDB();
    const transaction = db.transaction(["config"], "readwrite");
    const store = transaction.objectStore("config");
    await store.put({ id: "main", ...configData });
  };

  const loadConfigFromDB = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(["config"], "readonly");
      const store = transaction.objectStore("config");
      const request = store.get("main");

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("Error loading config:", err);
      return null;
    }
  };

  const clearConfigFromDB = async () => {
    const db = await initDB();
    const transaction = db.transaction(["config"], "readwrite");
    const store = transaction.objectStore("config");
    await store.delete("main");
  };

  // Route naturesjoystore.com requests through our proxy (/wc-api) to avoid CORS.
  // This works in dev (via vite.config.js) and prod (via vercel.json rewrites).
  const getApiBase = (cfg) => {
    const url = (cfg || config).siteUrl.replace(/\/$/, "");
    if (url.includes("naturesjoystore.com")) {
      return "/wc-api";
    }
    return url;
  };

  // Load saved config; fall back to env-var credentials if nothing is stored
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
        // Auto-connect using credentials from .env
        setIsConfigured(true);
      }
    };
    loadSavedConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== PRODUCT MAP & HELPERS ==========
  // productMap for fast lookup by product_id
  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // EXACT WooCommerce PHP HSN logic:
  // 1) product.meta_data 'hsn'
  // 2) product.meta_data '_hsn_code'
  // 3) product.attributes -> attribute named 'hsn'
  const getHSN = (item) => {
    if (!item) return "N/A";
    const product = productMap[item.product_id];
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

  // calculate subtotal from order line_items (item.subtotal expected in Woo REST)
  const calcSubtotal = (order) => {
    return (
      order.line_items?.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) || 0
    );
  };

  // ========== FETCH PRODUCTS & ORDERS ==========
  const fetchProducts = async () => {
    if (!isConfigured) return;

    setLoading(true);
    setError("");

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase();
      let allProducts = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `${apiBase}/wp-json/wc/v3/products?per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `Basic ${auth}`
            }
          }
        );

        if (!response.ok) throw new Error(`Failed to fetch products (page ${page})`);

        const data = await response.json();
        allProducts = [...allProducts, ...data];

        const totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1");
        hasMore = page < totalPages;
        page++;
      }

      setProducts(allProducts);
    } catch (err) {
      setError("Error fetching products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!isConfigured) return;

    setLoading(true);
    setError("");
    setFetchProgress({ current: 0, total: 0 });

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase();
      const headers = { Authorization: `Basic ${auth}` };
      const baseUrl = `${apiBase}/wp-json/wc/v3/orders?per_page=100`;

      // Step 1: fetch page 1 to discover total page count
      const firstResponse = await fetch(`${baseUrl}&page=1`, { headers });
      if (!firstResponse.ok) throw new Error("Failed to fetch orders (page 1)");

      const firstData = await firstResponse.json();
      const totalPages = parseInt(firstResponse.headers.get("X-WP-TotalPages") || "1");

      if (totalPages === 1) {
        setOrders(firstData);
        return;
      }

      // Step 2: fire ALL remaining pages simultaneously — zero intermediate state updates
      const remainingPromises = [];
      for (let page = 2; page <= totalPages; page++) {
        remainingPromises.push(
          fetch(`${baseUrl}&page=${page}`, { headers }).then((res) => {
            if (!res.ok) throw new Error(`Failed to fetch orders (page ${page})`);
            return res.json().then((data) => ({ page, data }));
          })
        );
      }

      // Step 3: wait for ALL pages — then set orders ONCE
      const remainingResults = await Promise.all(remainingPromises);
      const allResults = [{ page: 1, data: firstData }, ...remainingResults];
      allResults.sort((a, b) => a.page - b.page);
      const allOrders = allResults.flatMap((r) => r.data);

      setOrders(allOrders);
    } catch (err) {
      setError("Error fetching orders: " + err.message);
    } finally {
      setFetchProgress({ current: 0, total: 0 });
      setLoading(false);
    }
  };



  // ========== ADD PRODUCT ==========
  const addProduct = async () => {
    if (!isConfigured) return;

    setLoading(true);
    setError("");

    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const apiBase = getApiBase();
      const response = await fetch(
        `${apiBase}/wp-json/wc/v3/products`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json"
          },
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
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error("Failed to add product: " + errText);
      }

      await fetchProducts();
      setShowAddProduct(false);
      setNewProduct({
        name: "",
        price: "",
        sku: "",
        stock_quantity: "",
        gst_rate: "18",
        hsn_code: ""
      });
    } catch (err) {
      setError("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // load data when configured
  useEffect(() => {
    if (isConfigured) {
      fetchProducts();
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  // configuration submit
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

  // ========== GST CALCULATION ==========
  // Check if order is cancelled/refunded
  const isOrderCancelled = (order) => {
    return order.status === "cancelled" || order.status === "refunded" || order.status === "failed";
  };

  // Calculate GST for a single line item
  const calculateLineItemGST = (item, order) => {
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
  const calculateShippingGST = (order) => {
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
  const calculateGST = (order) => {
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

  // unique customers
  const uniqueCustomers = useMemo(() => {
    return [...new Set(orders.map((o) => `${o.billing?.first_name || ""} ${o.billing?.last_name || ""}`))].filter(
      (c) => c.trim()
    );
  }, [orders]);

  // filtered and sorted orders
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const matchesSearch =
        order.id?.toString().includes(searchTerm) ||
        (order.billing?.first_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.billing?.last_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const orderDate = new Date(order.date_created);
      const matchesDateStart = !dateFilter.start || orderDate >= new Date(dateFilter.start);
      const matchesDateEnd = !dateFilter.end || orderDate <= new Date(dateFilter.end);

      const customerName = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`;
      const matchesCustomer = selectedCustomer === "all" || customerName === selectedCustomer;

      return matchesSearch && matchesDateStart && matchesDateEnd && matchesCustomer;
    });

    // Sort orders by date
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.date_created).getTime();
      const dateB = new Date(b.date_created).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [orders, searchTerm, dateFilter, selectedCustomer, sortOrder]);

  // Export CSV (per line item GST)
  const exportToExcel = () => {
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
        const hsn = getHSN(item);
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
  const downloadInvoice = (order) => {
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
          const hsn = getHSN(item);
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

  // ========== STATS ==========
  const calculateStats = () => {
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      const multiplier = isOrderCancelled(order) ? -1 : 1;
      return sum + parseFloat(order.total || 0) * multiplier;
    }, 0);
    const totalTax = filteredOrders.reduce((sum, order) => {
      const multiplier = isOrderCancelled(order) ? -1 : 1;
      return sum + parseFloat(order.total_tax || 0) * multiplier;
    }, 0);

    return {
      totalProducts: products.length,
      totalOrders: filteredOrders.length,
      allOrders: orders.length,
      totalRevenue: totalRevenue.toFixed(2),
      totalTax: totalTax.toFixed(2),
      avgOrderValue: filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : "0.00"
    };
  };

  const stats = calculateStats();

  // ========== RENDER ==========
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <ShoppingCart className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">WooCommerce GST Dashboard</h1>
            <p className="text-gray-600 mt-2">Connect to your Indian store</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store URL</label>
              <input
                type="url"
                placeholder="https://yourstore.com"
                value={config.siteUrl}
                onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Key</label>
              <input
                type="text"
                placeholder="ck_..."
                value={config.consumerKey}
                onChange={(e) => setConfig({ ...config, consumerKey: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Secret</label>
              <input
                type="password"
                placeholder="cs_..."
                value={config.consumerSecret}
                onChange={(e) => setConfig({ ...config, consumerSecret: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleConfigSubmit}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Connect Store
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Get your API keys from WooCommerce → Settings → Advanced → REST API. Enable Read/Write permissions. Your credentials will be securely stored in your browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
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
                onClick={exportToExcel}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => {
                  fetchProducts();
                  fetchOrders();
                }}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
              </div>
              <Package className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filtered Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
              </div>
              <ShoppingCart className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.totalRevenue}</p>
              </div>
              <DollarSign className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total GST</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.totalTax}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.avgOrderValue}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Customers ({orders.length})</option>
                {uniqueCustomers.map((customer, idx) => (
                  <option key={idx} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Order ID or Customer"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main content tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("gst-report")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "gst-report"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                GST Report
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "products"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Products ({products.length})
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "orders"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Orders ({filteredOrders.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
            )}

            {loading && fetchProgress.total === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading data...</p>
              </div>
            ) : (
              <>
                {activeTab === "gst-report" && (
                  <div className="overflow-x-auto">
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
                        {filteredOrders.flatMap((order) => {
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
    const hsn = getHSN(item);
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
                                  <button onClick={() => downloadInvoice(order)}>
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
          <button onClick={() => downloadInvoice(order)}>
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
                )}

                {activeTab === "products" && (
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HSN Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST Rate</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {products.map((product) => {
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
                                <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{product.name}</div></td>
                                <td className="px-6 py-4 text-sm text-gray-500">{product.sku || "N/A"}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{hsnCode}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{product.price}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{product.stock_quantity !== null ? product.stock_quantity : "N/A"}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{gstRate}%</td>
                                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${product.stock_status === "instock" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{product.stock_status}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === "orders" && (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
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
                              <button onClick={() => downloadInvoice(order)} className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm">
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
                                const hsn = getHSN(item);
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
