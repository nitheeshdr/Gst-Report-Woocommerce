import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, TrendingUp, DollarSign, Search, RefreshCw, Download, FileText, Plus, Filter, Trash2 } from 'lucide-react';

const WooCommerceGSTDashboard = () => {
  const [activeTab, setActiveTab] = useState('gst-report');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    siteUrl: '',
    consumerKey: '',
    consumerSecret: ''
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', sku: '', stock_quantity: '', gst_rate: '18', hsn_code: ''
  });
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // IndexedDB functions
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WooCommerceDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
        }
      };
    });
  };

  const saveConfigToDB = async (configData) => {
    const db = await initDB();
    const transaction = db.transaction(['config'], 'readwrite');
    const store = transaction.objectStore('config');
    await store.put({ id: 'main', ...configData });
  };

  const loadConfigFromDB = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const request = store.get('main');
      
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
      console.error('Error loading config:', err);
      return null;
    }
  };

  const clearConfigFromDB = async () => {
    const db = await initDB();
    const transaction = db.transaction(['config'], 'readwrite');
    const store = transaction.objectStore('config');
    await store.delete('main');
  };

  // Load config on mount
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
      }
    };
    loadSavedConfig();
  }, []);

  // Fetch ALL products (paginated)
  const fetchProducts = async () => {
    if (!isConfigured) return;
    
    setLoading(true);
    setError('');
    
    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      let allProducts = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await fetch(
          `${config.siteUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`
            }
          }
        );
        
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const data = await response.json();
        allProducts = [...allProducts, ...data];
        
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
        hasMore = page < totalPages;
        page++;
      }
      
      setProducts(allProducts);
    } catch (err) {
      setError('Error fetching products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ALL orders (parallel fetching for speed)
  const fetchOrders = async () => {
    if (!isConfigured) return;
    
    setLoading(true);
    setError('');
    
    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      
      // Get first page to determine total pages
      const firstResponse = await fetch(
        `${config.siteUrl}/wp-json/wc/v3/orders?per_page=100&page=1`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      );
      
      if (!firstResponse.ok) throw new Error('Failed to fetch orders');
      
      const firstData = await firstResponse.json();
      const totalPages = parseInt(firstResponse.headers.get('X-WP-TotalPages') || '1');
      
      setFetchProgress({ current: 1, total: totalPages });
      
      // If only one page, we're done
      if (totalPages === 1) {
        setOrders(firstData);
        setFetchProgress({ current: 0, total: 0 });
        setLoading(false);
        return;
      }
      
      // Fetch remaining pages in parallel (batches of 5 for safety)
      const batchSize = 5;
      let allOrders = [...firstData];
      
      for (let i = 2; i <= totalPages; i += batchSize) {
        const batch = [];
        const endPage = Math.min(i + batchSize - 1, totalPages);
        
        // Create batch of promises
        for (let page = i; page <= endPage; page++) {
          batch.push(
            fetch(
              `${config.siteUrl}/wp-json/wc/v3/orders?per_page=100&page=${page}`,
              {
                headers: {
                  'Authorization': `Basic ${auth}`
                }
              }
            )
          );
        }
        
        // Fetch batch in parallel
        const responses = await Promise.all(batch);
        
        // Process responses
        for (let j = 0; j < responses.length; j++) {
          const response = responses[j];
          if (!response.ok) throw new Error('Failed to fetch orders');
          const data = await response.json();
          allOrders = [...allOrders, ...data];
          setFetchProgress({ current: i + j, total: totalPages });
        }
      }
      
      setOrders(allOrders);
      setFetchProgress({ current: 0, total: 0 });
    } catch (err) {
      setError('Error fetching orders: ' + err.message);
      setFetchProgress({ current: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Add new product
  const addProduct = async () => {
    if (!isConfigured) return;
    
    setLoading(true);
    setError('');
    
    try {
      const auth = btoa(`${config.consumerKey}:${config.consumerSecret}`);
      const response = await fetch(
        `${config.siteUrl}/wp-json/wc/v3/products`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newProduct.name,
            type: 'simple',
            regular_price: newProduct.price,
            sku: newProduct.sku,
            stock_quantity: parseInt(newProduct.stock_quantity),
            manage_stock: true,
            meta_data: [
              { key: '_gst_rate', value: newProduct.gst_rate },
              { key: 'hsn', value: newProduct.hsn_code },
              { key: '_hsn_code', value: newProduct.hsn_code }
            ]
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to add product');
      
      await fetchProducts();
      setShowAddProduct(false);
      setNewProduct({ name: '', price: '', sku: '', stock_quantity: '', gst_rate: '18', hsn_code: '' });
    } catch (err) {
      setError('Error adding product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data when configured
  useEffect(() => {
    if (isConfigured) {
      fetchProducts();
      fetchOrders();
    }
  }, [isConfigured]);

  // Handle configuration submit
  const handleConfigSubmit = async () => {
    if (config.siteUrl && config.consumerKey && config.consumerSecret) {
      await saveConfigToDB(config);
      setIsConfigured(true);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    await clearConfigFromDB();
    setConfig({ siteUrl: '', consumerKey: '', consumerSecret: '' });
    setIsConfigured(false);
    setProducts([]);
    setOrders([]);
  };

  // Calculate GST breakdown - matching your PHP template logic
  const calculateGST = (order) => {
    const subtotal = parseFloat(order.subtotal || 0);
    const discountTotal = parseFloat(order.discount_total || 0);
    const shippingTotal = parseFloat(order.shipping_total || 0);
    const orderTotal = parseFloat(order.total || 0);
    
    // Check if Tamil Nadu (TN) for CGST/SGST vs IGST
    const billingState = order.billing?.state || '';
    const isTamilNadu = billingState.toUpperCase() === 'TN' || billingState.toUpperCase() === 'TAMIL NADU';
    
    let gst5Amount = 0;
    let gst18Amount = 0;
    let shippingGSTAmount = 0;
    
    // Calculate item-wise GST based on tax class
    if (order.line_items) {
      order.line_items.forEach(item => {
        const taxClass = item.tax_class || '';
        let itemTaxAmount = 0;
        
        // Sum up tax from item
        if (item.taxes && item.taxes.length > 0) {
          item.taxes.forEach(tax => {
            itemTaxAmount += parseFloat(tax.total || 0);
          });
        }
        
        // Categorize by tax class
        if (taxClass.includes('5') || taxClass.includes('5-percent') || taxClass.includes('5_percent')) {
          gst5Amount += itemTaxAmount;
        } else {
          // Default to 18% if no specific class or contains 18
          gst18Amount += itemTaxAmount;
        }
      });
    }
    
    // Calculate shipping GST (18%)
    if (order.shipping_lines) {
      order.shipping_lines.forEach(shipping => {
        if (shipping.taxes && shipping.taxes.length > 0) {
          shipping.taxes.forEach(tax => {
            shippingGSTAmount += parseFloat(tax.total || 0);
          });
        }
      });
    }
    
    // Build result object
    let result = {
      subtotal,
      discountTotal,
      shippingTotal,
      shippingGSTAmount,
      orderTotal,
      isTamilNadu,
      supply18: 0,
      cgst9: 0,
      sgst9: 0,
      igst18: 0,
      supply5: 0,
      cgst2_5: 0,
      sgst2_5: 0,
      igst5: 0,
      supply0: 0,
      shippingCGST: 0,
      shippingSGST: 0,
      shippingIGST: 0
    };
    
    // Calculate supplies (base amounts before tax)
    if (gst18Amount > 0) {
      result.supply18 = subtotal - discountTotal - (gst5Amount > 0 ? (gst5Amount / 0.05) : 0);
    }
    
    if (gst5Amount > 0) {
      result.supply5 = gst5Amount / 0.05;
    }
    
    // Split GST based on state
    if (gst5Amount > 0) {
      if (isTamilNadu) {
        result.cgst2_5 = gst5Amount / 2;
        result.sgst2_5 = gst5Amount / 2;
      } else {
        result.igst5 = gst5Amount;
      }
    }
    
    if (gst18Amount > 0) {
      if (isTamilNadu) {
        result.cgst9 = gst18Amount / 2;
        result.sgst9 = gst18Amount / 2;
      } else {
        result.igst18 = gst18Amount;
      }
    }
    
    // Shipping GST (18%)
    if (shippingGSTAmount > 0) {
      if (isTamilNadu) {
        result.shippingCGST = shippingGSTAmount / 2;
        result.shippingSGST = shippingGSTAmount / 2;
      } else {
        result.shippingIGST = shippingGSTAmount;
      }
    }
    
    return result;
  };

  // Get unique customers
  const uniqueCustomers = [...new Set(orders.map(o => 
    `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`
  ))].filter(c => c.trim());

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id?.toString().includes(searchTerm) ||
      order.billing?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.billing?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const orderDate = new Date(order.date_created);
    const matchesDateStart = !dateFilter.start || orderDate >= new Date(dateFilter.start);
    const matchesDateEnd = !dateFilter.end || orderDate <= new Date(dateFilter.end);
    
    const customerName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`;
    const matchesCustomer = selectedCustomer === 'all' || customerName === selectedCustomer;
    
    return matchesSearch && matchesDateStart && matchesDateEnd && matchesCustomer;
  });

  // Export to CSV
  const exportToExcel = () => {
    const headers = [
      'Date', 'Inv. No', 'Invoice Date', 'DC. No', 'Customer', 'GSTIN No', 'State', 
      'HSN Code', 'Qty', 'Subtotal', 'Discount', 'Supply @ 18%', '9% CGST', '9% SGST', '18% IGST',
      'Supply @ 5%', '2.5% CGST', '2.5% SGST', '5% IGST', '0% Tax', 'Shipping', 
      'Shipping CGST', 'Shipping SGST', 'Shipping IGST', 'TOTAL', 'CHECK'
    ];
    
    const rows = filteredOrders.map(order => {
      const gst = calculateGST(order);
      const gstin = order.meta_data?.find(m => m.key === '_billing_gstin' || m.key === 'gstin')?.value || 'N/A';
      const hsn = order.line_items?.[0]?.meta_data?.find(m => m.key === '_hsn_code' || m.key === 'hsn')?.value || 
                  order.line_items?.[0]?.product_id ? 'Check Product' : 'N/A';
      
      return [
        new Date(order.date_created).toLocaleDateString('en-IN'),
        order.id,
        new Date(order.date_created).toLocaleDateString('en-IN'),
        order.meta_data?.find(m => m.key === '_dc_number')?.value || '-',
        `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`,
        gstin,
        order.billing?.state || '',
        hsn,
        order.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        gst.subtotal.toFixed(2),
        gst.discountTotal.toFixed(2),
        gst.supply18.toFixed(2),
        gst.cgst9.toFixed(2),
        gst.sgst9.toFixed(2),
        gst.igst18.toFixed(2),
        gst.supply5.toFixed(2),
        gst.cgst2_5.toFixed(2),
        gst.sgst2_5.toFixed(2),
        gst.igst5.toFixed(2),
        gst.supply0.toFixed(2),
        gst.shippingTotal.toFixed(2),
        gst.shippingCGST.toFixed(2),
        gst.shippingSGST.toFixed(2),
        gst.shippingIGST.toFixed(2),
        gst.orderTotal.toFixed(2),
        Math.abs(gst.orderTotal - parseFloat(order.total)) < 0.01 ? '✓' : '✗'
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download invoice - matching your PHP template
  const downloadInvoice = (order) => {
    const gst = calculateGST(order);
    const gstin = order.meta_data?.find(m => m.key === '_billing_gstin' || m.key === 'gstin')?.value || 'N/A';
    
    const invoiceHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
    .head.container { width: 100%; margin-bottom: 20px; }
    .head.container td { vertical-align: top; padding: 10px; }
    .shop-info { text-align: right; }
    .shop-name h3 { margin: 0; font-size: 20px; }
    .shop-address, .shop-gstin { margin: 5px 0; }
    .order-data-addresses { width: 100%; margin: 20px 0; }
    .order-data-addresses td { vertical-align: top; padding: 10px; width: 33%; }
    .order-data table { width: 100%; }
    .order-data th { text-align: left; padding: 5px; }
    .order-data td { text-align: right; padding: 5px; }
    .order-details { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .order-details th, .order-details td { border: 1px solid #000; padding: 8px; text-align: left; }
    .order-details th { background-color: #f0f0f0; font-weight: bold; }
    .notes-totals { width: 100%; margin: 20px 0; }
    .notes-totals td { vertical-align: top; padding: 10px; }
    .totals table { width: 100%; }
    .totals th { text-align: left; padding: 5px; }
    .totals td { text-align: right; padding: 5px; }
    .terms-conditions { margin: 30px 0; padding: 15px; background: #f9f9f9; }
    .terms-conditions h3 { margin-top: 0; }
    .terms-conditions ul { margin: 10px 0; padding-left: 20px; }
    .terms-conditions li { margin: 5px 0; }
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
          <strong>5, Thilagar Street, AGS Colony, Alwarthirunagar,<br>
          Valasarawakkam, Chennai-600087, Tamil Nadu, India</strong>
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
        <h3>Billing Address:</h3>
        <p>
          ${order.billing?.first_name || ''} ${order.billing?.last_name || ''}<br>
          ${order.billing?.address_1 || ''}<br>
          ${order.billing?.address_2 ? order.billing.address_2 + '<br>' : ''}
          ${order.billing?.city || ''}, ${order.billing?.state || ''} - ${order.billing?.postcode || ''}<br>
          Email: ${order.billing?.email || ''}<br>
          Phone: ${order.billing?.phone || ''}
        </p>
      </td>
      <td class="address shipping-address">
        <h3>Shipping Address:</h3>
        <p>
          ${order.shipping?.first_name || ''} ${order.shipping?.last_name || ''}<br>
          ${order.shipping?.address_1 || ''}<br>
          ${order.shipping?.address_2 ? order.shipping.address_2 + '<br>' : ''}
          ${order.shipping?.city || ''}, ${order.shipping?.state || ''} - ${order.shipping?.postcode || ''}
        </p>
      </td>
      <td class="order-data">
        <table>
          <tr>
            <th>Order Number:</th>
            <td>${order.number || order.id}</td>
          </tr>
          <tr>
            <th>Order Date:</th>
            <td>${new Date(order.date_created).toLocaleDateString('en-IN')}</td>
          </tr>
          <tr>
            <th>Payment Method:</th>
            <td>${order.payment_method_title || 'N/A'}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="order-details">
    <thead>
      <tr>
        <th>Product</th>
        <th>HSN</th>
        <th>Quantity</th>
        <th>Price</th>
      </tr>
    </thead>
    <tbody>
      ${order.line_items?.map(item => {
        const hsn = item.meta_data?.find(m => m.key === '_hsn_code' || m.key === 'hsn')?.value || '-';
        return `
          <tr>
            <td>${item.name}</td>
            <td>${hsn}</td>
            <td>${item.quantity}</td>
            <td>₹${parseFloat(item.total).toFixed(2)}</td>
          </tr>
        `;
      }).join('') || ''}
    </tbody>
  </table>

  <table class="notes-totals">
    <tr>
      <td style="width: 50%;">
        <!-- Notes section can go here -->
      </td>
      <td style="width: 50%;">
        <table class="totals">
          <tr>
            <th>Items Subtotal:</th>
            <td>₹${gst.subtotal.toFixed(2)}</td>
          </tr>
          ${gst.discountTotal > 0 ? `
          <tr>
            <th>Coupon Discount:</th>
            <td>-₹${gst.discountTotal.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.cgst2_5 > 0 ? `
          <tr>
            <th>CGST (2.5%):</th>
            <td>₹${gst.cgst2_5.toFixed(2)}</td>
          </tr>
          <tr>
            <th>SGST (2.5%):</th>
            <td>₹${gst.sgst2_5.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.igst5 > 0 ? `
          <tr>
            <th>IGST (5%):</th>
            <td>₹${gst.igst5.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.cgst9 > 0 ? `
          <tr>
            <th>CGST (9%):</th>
            <td>₹${gst.cgst9.toFixed(2)}</td>
          </tr>
          <tr>
            <th>SGST (9%):</th>
            <td>₹${gst.sgst9.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.igst18 > 0 ? `
          <tr>
            <th>IGST (18%):</th>
            <td>₹${gst.igst18.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.shippingTotal > 0 ? `
          <tr>
            <th>Shipping (Excl Tax):</th>
            <td>₹${gst.shippingTotal.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.shippingCGST > 0 ? `
          <tr>
            <th>Shipping CGST (9%):</th>
            <td>₹${gst.shippingCGST.toFixed(2)}</td>
          </tr>
          <tr>
            <th>Shipping SGST (9%):</th>
            <td>₹${gst.shippingSGST.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${gst.shippingIGST > 0 ? `
          <tr>
            <th>Shipping IGST (18%):</th>
            <td>₹${gst.shippingIGST.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr>
            <th><strong>Order Total:</strong></th>
            <td><strong>₹${gst.orderTotal.toFixed(2)}</strong></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

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
</body>
</html>`;
    
    const blob = new Blob([invoiceHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${order.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate report statistics
  const calculateStats = () => {
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      return sum + parseFloat(order.total || 0);
    }, 0);

    const totalTax = filteredOrders.reduce((sum, order) => {
      return sum + parseFloat(order.total_tax || 0);
    }, 0);

    return {
      totalProducts: products.length,
      totalOrders: filteredOrders.length,
      allOrders: orders.length,
      totalRevenue: totalRevenue.toFixed(2),
      totalTax: totalTax.toFixed(2),
      avgOrderValue: filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : '0.00'
    };
  };

  const stats = calculateStats();

  // Configuration screen
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store URL
              </label>
              <input
                type="url"
                placeholder="https://yourstore.com"
                value={config.siteUrl}
                onChange={(e) => setConfig({...config, siteUrl: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consumer Key
              </label>
              <input
                type="text"
                placeholder="ck_..."
                value={config.consumerKey}
                onChange={(e) => setConfig({...config, consumerKey: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consumer Secret
              </label>
              <input
                type="password"
                placeholder="cs_..."
                value={config.consumerSecret}
                onChange={(e) => setConfig({...config, consumerSecret: e.target.value})}
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
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
              ></div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
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
                  <option key={idx} value={customer}>{customer}</option>
                ))}
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

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('gst-report')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'gst-report'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                GST Report
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'products'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Products ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'orders'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Orders ({filteredOrders.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                {error}
              </div>
            )}

            {loading && fetchProgress.total === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading data...</p>
              </div>
            ) : (
              <>
                {activeTab === 'gst-report' && (
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
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supply @ 18%</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">9% CGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">9% SGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">18% IGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supply @ 5%</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">2.5% CGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">2.5% SGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">5% IGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shipping</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ship CGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ship SGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ship IGST</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">TOTAL</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">CHECK</th>
                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOrders.map((order) => {
                          const gst = calculateGST(order);
                          const gstin = order.meta_data?.find(m => m.key === '_billing_gstin' || m.key === 'gstin')?.value || 'N/A';
                          const hsn = order.line_items?.[0]?.meta_data?.find(m => m.key === '_hsn_code' || m.key === 'hsn')?.value || 'N/A';
                          const qty = order.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                          const dcNo = order.meta_data?.find(m => m.key === '_dc_number')?.value || '-';
                          
                          return (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{new Date(order.date_created).toLocaleDateString('en-IN')}</td>
                              <td className="px-2 py-2 whitespace-nowrap font-medium text-xs">{order.id}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{dcNo}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{order.billing?.first_name} {order.billing?.last_name}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{gstin}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{order.billing?.state}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{hsn}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">{qty}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.subtotal.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.discountTotal.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.supply18.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.cgst9.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.sgst9.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.igst18.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.supply5.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.cgst2_5.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.sgst2_5.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.igst5.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.shippingTotal.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.shippingCGST.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.shippingSGST.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">₹{gst.shippingIGST.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap font-bold text-xs">₹{gst.orderTotal.toFixed(2)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-xs">
                                <span className={Math.abs(gst.orderTotal - parseFloat(order.total)) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                                  {Math.abs(gst.orderTotal - parseFloat(order.total)) < 0.01 ? '✓' : '✗'}
                                </span>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <button
                                  onClick={() => downloadInvoice(order)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Download Invoice"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'products' && (
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
                            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="number"
                            placeholder="Price"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="SKU"
                            value={newProduct.sku}
                            onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="number"
                            placeholder="Stock Quantity"
                            value={newProduct.stock_quantity}
                            onChange={(e) => setNewProduct({...newProduct, stock_quantity: e.target.value})}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="HSN Code"
                            value={newProduct.hsn_code}
                            onChange={(e) => setNewProduct({...newProduct, hsn_code: e.target.value})}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                          <select
                            value={newProduct.gst_rate}
                            onChange={(e) => setNewProduct({...newProduct, gst_rate: e.target.value})}
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
                          <button
                            onClick={addProduct}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                          >
                            Add Product
                          </button>
                          <button
                            onClick={() => setShowAddProduct(false)}
                            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                          >
                            Cancel
                          </button>
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
                            const gstRate = product.meta_data?.find(m => m.key === '_gst_rate')?.value || 'N/A';
                            const hsnCode = product.meta_data?.find(m => m.key === '_hsn_code' || m.key === 'hsn')?.value || 'N/A';
                            
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
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{product.sku || 'N/A'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{hsnCode}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{product.price}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {product.stock_quantity !== null ? product.stock_quantity : 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{gstRate}%</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    product.stock_status === 'instock' 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {product.stock_status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
                      const gst = calculateGST(order);
                      return (
                        <div key={order.id} className="border rounded-lg p-6 hover:shadow-md transition">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {new Date(order.date_created).toLocaleDateString('en-IN')} at{' '}
                                {new Date(order.date_created).toLocaleTimeString('en-IN')}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                State: {order.billing?.state} {gst.isTamilNadu ? '(Tamil Nadu - CGST/SGST)' : '(Other State - IGST)'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status}
                              </span>
                              <button
                                onClick={() => downloadInvoice(order)}
                                className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                              >
                                <Download className="w-4 h-4" />
                                <span>Invoice</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Customer</h4>
                              <p className="text-sm text-gray-900">
                                {order.billing?.first_name} {order.billing?.last_name}
                              </p>
                              <p className="text-sm text-gray-500">{order.billing?.email}</p>
                              <p className="text-sm text-gray-500">GSTIN: {order.meta_data?.find(m => m.key === '_billing_gstin' || m.key === 'gstin')?.value || 'N/A'}</p>
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
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-gray-600">Subtotal</p>
                                <p className="font-semibold">₹{gst.subtotal.toFixed(2)}</p>
                              </div>
                              {gst.discountTotal > 0 && (
                                <div className="bg-red-50 p-3 rounded">
                                  <p className="text-gray-600">Discount</p>
                                  <p className="font-semibold text-red-600">-₹{gst.discountTotal.toFixed(2)}</p>
                                </div>
                              )}
                              {gst.cgst9 > 0 && (
                                <>
                                  <div className="bg-blue-50 p-3 rounded">
                                    <p className="text-gray-600">CGST (9%)</p>
                                    <p className="font-semibold">₹{gst.cgst9.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-blue-50 p-3 rounded">
                                    <p className="text-gray-600">SGST (9%)</p>
                                    <p className="font-semibold">₹{gst.sgst9.toFixed(2)}</p>
                                  </div>
                                </>
                              )}
                              {gst.igst18 > 0 && (
                                <div className="bg-purple-50 p-3 rounded">
                                  <p className="text-gray-600">IGST (18%)</p>
                                  <p className="font-semibold">₹{gst.igst18.toFixed(2)}</p>
                                </div>
                              )}
                              {gst.cgst2_5 > 0 && (
                                <>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-gray-600">CGST (2.5%)</p>
                                    <p className="font-semibold">₹{gst.cgst2_5.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-green-50 p-3 rounded">
                                    <p className="text-gray-600">SGST (2.5%)</p>
                                    <p className="font-semibold">₹{gst.sgst2_5.toFixed(2)}</p>
                                  </div>
                                </>
                              )}
                              {gst.igst5 > 0 && (
                                <div className="bg-yellow-50 p-3 rounded">
                                  <p className="text-gray-600">IGST (5%)</p>
                                  <p className="font-semibold">₹{gst.igst5.toFixed(2)}</p>
                                </div>
                              )}
                              {gst.shippingTotal > 0 && (
                                <div className="bg-orange-50 p-3 rounded">
                                  <p className="text-gray-600">Shipping</p>
                                  <p className="font-semibold">₹{gst.shippingTotal.toFixed(2)}</p>
                                </div>
                              )}
                              {gst.shippingCGST > 0 && (
                                <>
                                  <div className="bg-orange-50 p-3 rounded">
                                    <p className="text-gray-600">Ship CGST (9%)</p>
                                    <p className="font-semibold">₹{gst.shippingCGST.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-orange-50 p-3 rounded">
                                    <p className="text-gray-600">Ship SGST (9%)</p>
                                    <p className="font-semibold">₹{gst.shippingSGST.toFixed(2)}</p>
                                  </div>
                                </>
                              )}
                              {gst.shippingIGST > 0 && (
                                <div className="bg-orange-50 p-3 rounded">
                                  <p className="text-gray-600">Ship IGST (18%)</p>
                                  <p className="font-semibold">₹{gst.shippingIGST.toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Items</h4>
                            <div className="space-y-2">
                              {order.line_items?.map((item, idx) => {
                                const hsn = item.meta_data?.find(m => m.key === '_hsn_code' || m.key === 'hsn')?.value || 'N/A';
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