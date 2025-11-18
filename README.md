# 🛍️ GST Report for WooCommerce

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react)
![WooCommerce](https://img.shields.io/badge/WooCommerce-Compatible-96588A.svg?logo=woocommerce)

**A comprehensive Indian GST compliance dashboard for WooCommerce stores**

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [Usage](#-usage) • [API Documentation](#-api-documentation)

---

</div>

## 📋 Overview

GST Report for WooCommerce is a powerful React-based dashboard that seamlessly integrates with your WooCommerce store to provide comprehensive GST (Goods and Services Tax) reporting for Indian businesses. Track sales, manage products, generate compliant invoices, and export GST reports with ease.

### ✨ Key Highlights

- 🇮🇳 **Indian GST Compliant** - Automatic CGST/SGST for Tamil Nadu, IGST for other states
- 📊 **Real-time Analytics** - Live revenue, tax, and order tracking
- 📄 **Invoice Generation** - Download GST-compliant invoices instantly
- 📤 **CSV Export** - Export detailed GST reports for accounting
- 🔒 **Secure** - API credentials stored locally using IndexedDB
- ⚡ **Fast** - Parallel data fetching for optimal performance
- 📱 **Responsive** - Works seamlessly on all devices

---

## 🚀 Features

### 📊 GST Report Dashboard

- **Line-item GST breakdown** - Separate GST calculation for each product
- **Multiple tax rates** - Support for 0%, 5%, 18%, and custom GST rates
- **HSN code tracking** - Automatic HSN code detection and display
- **Shipping GST** - Separate GST calculation for shipping charges
- **Cancelled orders** - Proper handling with negative values
- **State-wise reporting** - Automatic CGST/SGST vs IGST classification

### 🛒 Product Management

- **View all products** - Complete product catalog with images
- **Add new products** - Create products directly from the dashboard
- **HSN code assignment** - Add HSN codes during product creation
- **Stock management** - Track inventory levels
- **GST rate configuration** - Set product-specific GST rates

### 📦 Order Management

- **Comprehensive order view** - All order details at a glance
- **Customer information** - GSTIN, billing details, state
- **Order filtering** - Filter by date, customer, and search
- **Sorting options** - Sort by newest or oldest
- **Status tracking** - Visual order status indicators

### 📈 Analytics & Statistics

- **Total revenue** - Real-time revenue tracking
- **Total GST collected** - Aggregate tax collection
- **Average order value** - Performance metrics
- **Product count** - Inventory overview
- **Order count** - Sales volume tracking

### 🔧 Advanced Features

- **Parallel data fetching** - Fetch all order pages simultaneously for maximum speed
- **Progress indicators** - Real-time fetch progress display
- **Discount handling** - Proportional discount distribution
- **Multiple tax classes** - Support for various product tax classes
- **Meta data support** - Custom field integration (GSTIN, DC Number, etc.)

---

## 🛠️ Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Active WooCommerce store with REST API enabled
- WooCommerce REST API credentials

### Step 1: Clone the Repository

```bash
git clone https://github.com/nitheeshdr/gst-report-woocommerce.git
cd gst-report-woocommerce
```

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 3: Start Development Server

```bash
npm start
# or
yarn start
```

The application will open at `http://localhost:3000`

---

## ⚙️ Configuration

### WooCommerce API Setup

1. **Navigate to WooCommerce Settings**
   - Go to `WooCommerce → Settings → Advanced → REST API`

2. **Create API Key**
   - Click "Add key"
   - Description: `GST Dashboard`
   - User: Select your admin user
   - Permissions: `Read/Write`
   - Click "Generate API key"

3. **Save Credentials**
   - Copy the Consumer Key (starts with `ck_`)
   - Copy the Consumer Secret (starts with `cs_`)
   - **Important:** Save these immediately as the secret won't be shown again

### Dashboard Configuration

1. **Open the Dashboard**
   - Launch the application at `http://localhost:3000`

2. **Enter Credentials**
   - **Store URL**: Your WooCommerce store URL (e.g., `https://yourstore.com`)
   - **Consumer Key**: The `ck_` key from WooCommerce
   - **Consumer Secret**: The `cs_` key from WooCommerce

3. **Connect**
   - Click "Connect Store"
   - Your credentials are securely stored in your browser's IndexedDB

---

## 📖 Usage

### Viewing GST Reports

1. **Navigate to GST Report Tab**
   - Default view shows all orders with line-item GST breakdown

2. **Understanding Columns**
   - **Date**: Order date
   - **Inv. No**: Invoice/Order number
   - **DC. No**: Delivery challan number (from meta data)
   - **Customer**: Customer name
   - **GSTIN**: Customer's GSTIN number
   - **State**: Billing state
   - **HSN Code**: Product HSN code
   - **Qty**: Quantity ordered
   - **Subtotal**: Item subtotal (after proportional discount)
   - **Supply @ 18%**: Taxable value at 18% GST
   - **9% CGST/SGST**: For Tamil Nadu orders
   - **18% IGST**: For non-Tamil Nadu orders
   - **Supply @ 5%**: Taxable value at 5% GST
   - **2.5% CGST/SGST**: For Tamil Nadu orders (5% GST products)
   - **5% IGST**: For non-Tamil Nadu orders (5% GST products)
   - **0% Tax**: Non-taxable items
   - **TOTAL**: Line item total

### Filtering Orders

**Date Range Filter**
```
Start Date: 2024-01-01
End Date: 2024-12-31
```

**Customer Filter**
- Select specific customer from dropdown
- Shows order count per customer

**Search**
- Search by order ID
- Search by customer name

**Sort Order**
- Newest to Oldest (default)
- Oldest to Newest

### Exporting Reports

**CSV Export**
1. Apply filters as needed
2. Click "Export CSV" button
3. File downloads as `GST_Report_DD-MM-YYYY.csv`
4. Import into Excel, Tally, or accounting software

**Export Format**
```csv
Date,Inv. No,Invoice Date,DC. No,Customer,GSTIN No,State,HSN Code,Qty,Subtotal,Supply @ 18%,9% CGST,9% SGST,18% IGST,Supply @ 5%,2.5% CGST,2.5% SGST,5% IGST,0% Tax,TOTAL
```

### Generating Invoices

1. **From GST Report Tab**
   - Click the invoice icon (📄) in the Actions column

2. **From Orders Tab**
   - Click "Invoice" button on any order card

3. **Invoice Contents**
   - Shop details with GSTIN
   - Invoice number and date
   - Customer billing address with GSTIN
   - Itemized product list with HSN codes
   - GST breakdown (CGST/SGST or IGST)
   - Terms and conditions

### Managing Products

**Adding Products**
1. Go to Products tab
2. Click "Add Product"
3. Fill in details:
   - Product Name
   - Price
   - SKU
   - Stock Quantity
   - HSN Code
   - GST Rate (0%, 5%, 12%, 18%, 28%)
4. Click "Add Product"

**Product List View**
- Product image
- Name, SKU, HSN code
- Price and stock quantity
- GST rate
- Stock status

---

## 🔌 API Documentation

### WooCommerce REST API Integration

**Base Endpoint**
```
https://yourstore.com/wp-json/wc/v3/
```

**Authentication**
```javascript
Authorization: Basic base64(consumerKey:consumerSecret)
```

### Endpoints Used

#### Get Products
```http
GET /wp-json/wc/v3/products?per_page=100&page=1
```

**Response:**
```json
[
  {
    "id": 123,
    "name": "Product Name",
    "price": "1000.00",
    "sku": "PROD-001",
    "stock_quantity": 50,
    "meta_data": [
      { "key": "_gst_rate", "value": "18" },
      { "key": "_hsn_code", "value": "12345678" }
    ]
  }
]
```

#### Get Orders
```http
GET /wp-json/wc/v3/orders?per_page=100&page=1
```

**Response:**
```json
[
  {
    "id": 456,
    "status": "completed",
    "total": "1180.00",
    "total_tax": "180.00",
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "state": "TN"
    },
    "line_items": [
      {
        "product_id": 123,
        "quantity": 1,
        "subtotal": "1000.00",
        "tax_class": "",
        "taxes": [
          { "total": "180.00" }
        ]
      }
    ]
  }
]
```

#### Create Product
```http
POST /wp-json/wc/v3/products
Content-Type: application/json

{
  "name": "New Product",
  "type": "simple",
  "regular_price": "1000.00",
  "sku": "PROD-002",
  "stock_quantity": 100,
  "meta_data": [
    { "key": "_gst_rate", "value": "18" },
    { "key": "_hsn_code", "value": "12345678" }
  ]
}
```

---

## 📐 HSN Code Detection Logic

The dashboard follows WooCommerce's HSN code detection hierarchy:

1. **Product Meta Data** - `hsn` key
2. **Product Meta Data** - `_hsn_code` key
3. **Product Attributes** - Attribute named "hsn"
4. **Fallback** - "N/A" if not found

### Setting HSN Codes in WooCommerce

**Method 1: Custom Fields Plugin**
- Install "Advanced Custom Fields" plugin
- Add custom field `_hsn_code` to products

**Method 2: Product Attributes**
- Go to Products → Attributes
- Create attribute named "HSN"
- Assign to products

**Method 3: Dashboard**
- Use the dashboard's "Add Product" feature
- HSN code is automatically saved to meta data

---

## 🧮 GST Calculation Logic

### State Detection
```javascript
const isTamilNadu = 
  billingState.toUpperCase() === "TN" || 
  billingState.toUpperCase() === "TAMIL NADU";
```

### Tax Rate Detection
```javascript
// 5% GST Products
const is5Percent = 
  taxClass.includes("5") ||
  taxClass.includes("5-percent") ||
  taxClass.includes("gst-5");

// 18% GST Products (Default)
const is18Percent = !is5Percent && taxAmount > 0;

// 0% GST Products
const is0Percent = taxAmount === 0;
```

### GST Split Logic

**For Tamil Nadu (CGST + SGST)**
```javascript
if (isTamilNadu) {
  CGST = taxAmount / 2;
  SGST = taxAmount / 2;
}
```

**For Other States (IGST)**
```javascript
else {
  IGST = taxAmount;
}
```

### Discount Distribution
```javascript
const discountRatio = orderSubtotal > 0 
  ? orderDiscount / orderSubtotal 
  : 0;

const itemDiscount = itemSubtotal * discountRatio;
const adjustedSubtotal = itemSubtotal - itemDiscount;
```

### Cancelled Order Handling
```javascript
const isCancelled = 
  order.status === "cancelled" || 
  order.status === "refunded" || 
  order.status === "failed";

const multiplier = isCancelled ? -1 : 1;
```

---

## 🎨 UI Components

### Dashboard Statistics Cards
- Total Products
- Filtered Orders
- Total Revenue
- Total GST
- Average Order Value

### Filters
- Date range picker
- Customer dropdown
- Sort order selector
- Real-time search

### Tables
- Responsive design
- Sortable columns
- Hover effects
- Conditional row styling (cancelled orders in red)

### Progress Indicators
- Loading spinners
- Progress bars for multi-page fetches
- Percentage display

---

## 🔐 Security

### Data Storage
- **IndexedDB**: Credentials stored locally in browser
- **No Server**: No data sent to external servers
- **Direct API**: Communicates directly with your WooCommerce store

### Best Practices
- Never commit API credentials to version control
- Use Read/Write permissions only when necessary
- Regularly rotate API keys
- Enable HTTPS on your WooCommerce store

---

## 🐛 Troubleshooting

### Common Issues

**1. "Failed to fetch products/orders"**
- ✅ Check if WooCommerce REST API is enabled
- ✅ Verify Consumer Key and Secret are correct
- ✅ Ensure API key has Read/Write permissions
- ✅ Check if store URL is correct (with https://)

**2. "CORS Error"**
- ✅ Enable CORS in WordPress
- ✅ Add to wp-config.php:
```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
```

**3. "HSN Code shows N/A"**
- ✅ Add HSN code to product meta data
- ✅ Use key `_hsn_code` or `hsn`
- ✅ Or create HSN attribute

**4. "Wrong GST calculation"**
- ✅ Set correct tax class in WooCommerce
- ✅ For 5% GST, use tax class containing "5"
- ✅ Enable tax calculation in WooCommerce settings

---

## 📦 Dependencies

```json
{
  "react": "^18.2.0",
  "lucide-react": "^0.263.1"
}
```

**External APIs:**
- WooCommerce REST API v3

**Browser APIs:**
- IndexedDB (for credential storage)
- Fetch API (for HTTP requests)
- Blob API (for file downloads)

---

## 🗺️ Roadmap

- [ ] PDF invoice generation
- [ ] Email invoice directly to customers
- [ ] GSTR-1 report format
- [ ] Multi-store support
- [ ] Dark mode
- [ ] Custom tax slab configuration
- [ ] Barcode/QR code on invoices
- [ ] Print invoice directly
- [ ] Order editing capabilities

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Nitheesh D R**
- GitHub: [@nitheeshdr](https://github.com/nitheeshdr)
- Email: nitheeraj1@gmail.com

---

## 🙏 Acknowledgments

- WooCommerce REST API Documentation
- React Documentation
- Lucide Icons
- Indian GST Guidelines

---

## 📞 Support

For support, info@nitheeshdr.in

---

<div align="center">

**Made with ❤️ for Indian WooCommerce Stores**

⭐ Star this repo if you find it helpful!

</div>