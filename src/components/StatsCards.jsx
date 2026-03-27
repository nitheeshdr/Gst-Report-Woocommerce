import React from 'react';
import { Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';

const StatsCards = ({ stats }) => {
  return (
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
  );
};

export default StatsCards;
