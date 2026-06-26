"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const cardStyle = { 
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

const DATE_FILTERS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "year", label: "This Year" },
  { id: "all", label: "All Time" },
];

export default function AnalyticsView({ uid }) {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("month");
  
  // Data states
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (uid) loadAllData();
  }, [uid]);

  async function loadAllData() {
    try {
      const [invoicesSnap, purchasesSnap, productsSnap, customersSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, `users/${uid}/invoices`)),
        getDocs(collection(db, `users/${uid}/purchases`)),
        getDocs(collection(db, `users/${uid}/products`)),
        getDocs(collection(db, `users/${uid}/customers`)),
        getDocs(collection(db, `users/${uid}/payments`)),
      ]);
      
      setInvoices(invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPurchases(purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomers(customersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }

  // Filter data by date
  function filterByDate(items, dateField = 'createdAt') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return items.filter(item => {
      if (!item[dateField]) return false;
      const itemDate = item[dateField].toDate ? item[dateField].toDate() : new Date(item[dateField]);
      
      switch(dateFilter) {
        case 'today':
          return itemDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        case 'month':
          return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        case 'lastMonth':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          return itemDate >= lastMonth && itemDate <= lastMonthEnd;
        case 'year':
          return itemDate.getFullYear() === now.getFullYear();
        case 'all':
        default:
          return true;
      }
    });
  }

  // Calculate KPIs
  const filteredInvoices = filterByDate(invoices);
  const filteredPurchases = filterByDate(purchases);
  
  const totalSales = filteredInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const totalRevenue = filteredInvoices.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
  const totalProfit = totalRevenue - totalPurchases;
  
  const pendingPayments = invoices
    .filter(i => i.status === "Unpaid" || i.status === "Partial")
    .reduce((sum, i) => sum + (Number(i.balance || i.amount) || 0), 0);
  
  const outstandingReceivables = pendingPayments;
  const outstandingPayables = purchases.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
  
  const totalCustomers = customers.length;
  const totalProductsCount = products.length;

  const kpis = [
    { label: "Total Sales", value: totalSales, icon: "💰", color: "from-blue-500 to-indigo-600", format: "currency" },
    { label: "Total Purchases", value: totalPurchases, icon: "🛒", color: "from-purple-500 to-pink-600", format: "currency" },
    { label: "Total Revenue", value: totalRevenue, icon: "💵", color: "from-green-500 to-emerald-600", format: "currency" },
    { label: "Total Profit", value: totalProfit, icon: "📈", color: totalProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600", format: "currency" },
    { label: "Pending Payments", value: pendingPayments, icon: "⏳", color: "from-yellow-500 to-amber-600", format: "currency" },
    { label: "Outstanding Receivables", value: outstandingReceivables, icon: "📥", color: "from-orange-500 to-red-600", format: "currency" },
    { label: "Outstanding Payables", value: outstandingPayables, icon: "📤", color: "from-red-500 to-rose-600", format: "currency" },
    { label: "Total Customers", value: totalCustomers, icon: "👥", color: "from-cyan-500 to-blue-600", format: "number" },
    { label: "Total Products", value: totalProductsCount, icon: "📦", color: "from-indigo-500 to-purple-600", format: "number" },
  ];

  // Sales by month for chart
  const salesByMonth = {};
  filteredInvoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + (Number(inv.amount) || 0);
  });

  // Top customers
  const customerSales = {};
  filteredInvoices.forEach(inv => {
    if (inv.customer) {
      customerSales[inv.customer] = (customerSales[inv.customer] || 0) + (Number(inv.amount) || 0);
    }
  });
  const topCustomers = Object.entries(customerSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top products
  const productSales = {};
  filteredInvoices.forEach(inv => {
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        const productName = item.productName || item.name;
        if (productName) {
          productSales[productName] = (productSales[productName] || 0) + (Number(item.quantity) || 0);
        }
      });
    }
  });
  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Low stock products
  const lowStockProducts = products.filter(p => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    return stock < 10;
  }).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-green-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">📊</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* Header with Filters */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Business Analytics
            </h2>
            <p className="text-gray-400 text-xs">Comprehensive insights and performance metrics</p>
          </div>
          
          {/* Date Filters */}
          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                  dateFilter === filter.id ? "scale-105 shadow-lg" : "hover:scale-105"
                }`}
                style={{
                  background: dateFilter === filter.id 
                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${dateFilter === filter.id ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                  color: dateFilter === filter.id ? "#fff" : "#9ca3af",
                }}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} 
            className="group relative rounded-lg p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
            style={cardStyle}>
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl font-bold group-hover:scale-110 transition-all duration-300">
                  {kpi.icon}
                </div>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${kpi.color} text-white`}>
                  Live
                </div>
              </div>
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className="text-white font-bold text-xl">
                {kpi.format === "currency" 
                  ? `Rs. ${Number(kpi.value).toLocaleString()}` 
                  : kpi.value.toLocaleString()}
              </p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Sales Trend */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            📈 Sales Trend
          </h3>
          <div className="space-y-2">
            {Object.entries(salesByMonth).slice(-6).map(([month, amount]) => {
              const maxSale = Math.max(...Object.values(salesByMonth));
              const percentage = maxSale > 0 ? (amount / maxSale) * 100 : 0;
              return (
                <div key={month}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{month}</span>
                    <span className="text-white font-semibold">Rs. {amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-700"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profit & Loss */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            💰 Profit & Loss
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="text-green-400 text-sm font-semibold">Revenue</span>
              <span className="text-white font-bold">Rs. {totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-red-400 text-sm font-semibold">Purchases</span>
              <span className="text-white font-bold">Rs. {totalPurchases.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg ${totalProfit >= 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`} style={{ border: "1px solid" }}>
              <span className={`text-sm font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "✅ Profit" : "❌ Loss"}
              </span>
              <span className={`font-black text-lg ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                Rs. {Math.abs(totalProfit).toLocaleString()}
              </span>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              Profit Margin: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            👥 Top Customers
          </h3>
          {topCustomers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No customer data</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map(([customer, amount], index) => (
                <div key={customer} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-all">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff" }}>
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{customer}</p>
                    <p className="text-gray-500 text-xs">Rs. {amount.toLocaleString()}</p>
                  </div>
                  <div className="text-blue-400 text-xs font-semibold">
                    {((amount / totalSales) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            🏆 Top Selling Products
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No product data</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map(([product, qty], index) => (
                <div key={product} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-all">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000" }}>
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{product}</p>
                    <p className="text-gray-500 text-xs">{qty} units sold</p>
                  </div>
                  <div className="text-amber-400 text-xs font-semibold">
                    🔥
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Status */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            📦 Inventory Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="text-blue-400 text-sm font-semibold">Total Products</span>
              <span className="text-white font-bold">{products.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-red-400 text-sm font-semibold">Low Stock</span>
              <span className="text-white font-bold">{lowStockProducts.length}</span>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-2 font-semibold">Low Stock Items:</p>
              {lowStockProducts.length === 0 ? (
                <p className="text-gray-600 text-xs">All items well stocked ✅</p>
              ) : (
                <div className="space-y-1">
                  {lowStockProducts.map(product => {
                    const stock = product.variantType !== "none" && product.variants?.length > 0
                      ? product.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
                      : parseInt(product.stock) || 0;
                    return (
                      <div key={product.id} className="flex justify-between text-xs">
                        <span className="text-gray-400 truncate max-w-[150px]">{product.name}</span>
                        <span className="text-red-400 font-semibold">{stock} left</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Analysis */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            💳 Payment Analysis
          </h3>
          <div className="space-y-3">
            {[
              { label: "Paid Invoices", count: invoices.filter(i => i.status === "Paid").length, color: "green" },
              { label: "Unpaid Invoices", count: invoices.filter(i => i.status === "Unpaid").length, color: "red" },
              { label: "Partial Payments", count: invoices.filter(i => i.status === "Partial").length, color: "yellow" },
            ].map(stat => (
              <div key={stat.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-all">
                <span className="text-gray-400 text-sm">{stat.label}</span>
                <span className={`text-sm font-bold ${
                  stat.color === "green" ? "text-green-400" :
                  stat.color === "red" ? "text-red-400" :
                  "text-yellow-400"
                }`}>
                  {stat.count}
                </span>
              </div>
            ))}
            <div className="pt-3 border-t border-white/10">
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Collection Rate</p>
                <p className="text-white font-bold text-2xl">
                  {invoices.length > 0 ? ((invoices.filter(i => i.status === "Paid").length / invoices.length) * 100).toFixed(0) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 5s ease infinite;
        }
      `}</style>
    </div>
  );
}
