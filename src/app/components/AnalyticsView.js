"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
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

const ANALYTICS_SECTIONS = [
  { id: "overview", label: "📊 Overview", icon: "📊" },
  { id: "revenue", label: "💰 Revenue", icon: "💰" },
  { id: "sales", label: "📈 Sales", icon: "📈" },
  { id: "inventory", label: "📦 Inventory", icon: "📦" },
  { id: "customer", label: "👥 Customers", icon: "👥" },
  { id: "payment", label: "💳 Payments", icon: "💳" },
  { id: "invoice", label: "🧾 Invoices", icon: "🧾" },
  { id: "profit", label: "💵 Profit", icon: "💵" },
];

export default function AnalyticsView({ uid }) {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("month");
  const [activeSection, setActiveSection] = useState("overview");
  
  // Data states
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const unsubscribers = [];

    // Real-time listener for invoices
    const unsubInvoices = onSnapshot(
      collection(db, `users/${uid}/invoices`),
      (snap) => {
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Invoices listener error:", err)
    );
    unsubscribers.push(unsubInvoices);

    // Real-time listener for products
    const unsubProducts = onSnapshot(
      collection(db, `users/${uid}/products`),
      (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Products listener error:", err)
    );
    unsubscribers.push(unsubProducts);

    // Real-time listener for customers
    const unsubCustomers = onSnapshot(
      collection(db, `users/${uid}/customers`),
      (snap) => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.deleted));
      },
      (err) => console.error("Customers listener error:", err)
    );
    unsubscribers.push(unsubCustomers);

    // Real-time listener for payments
    const unsubPayments = onSnapshot(
      collection(db, `users/${uid}/payments`),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Payments listener error:", err)
    );
    unsubscribers.push(unsubPayments);

    // Real-time listener for suppliers
    const orderListenersMap = new Map();
    
    const unsubSuppliers = onSnapshot(
      collection(db, `users/${uid}/suppliers`),
      (snap) => {
        const suppliersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSuppliers(suppliersData);

        // Remove listeners for deleted suppliers
        const currentSupplierIds = new Set(suppliersData.map(s => s.id));
        for (const [supplierId, unsub] of orderListenersMap.entries()) {
          if (!currentSupplierIds.has(supplierId)) {
            unsub();
            orderListenersMap.delete(supplierId);
          }
        }

        // Add/update listeners for each supplier's orders
        suppliersData.forEach((supplier) => {
          if (!orderListenersMap.has(supplier.id)) {
            const unsubOrders = onSnapshot(
              collection(db, `users/${uid}/suppliers/${supplier.id}/orders`),
              (ordersSnap) => {
                const newOrders = ordersSnap.docs.map(d => ({
                  id: d.id,
                  supplierId: supplier.id,
                  supplierName: supplier.name,
                  ...d.data()
                }));

                // Update allOrders by replacing orders for this supplier
                setAllOrders(prevOrders => {
                  const filteredOrders = prevOrders.filter(o => o.supplierId !== supplier.id);
                  return [...filteredOrders, ...newOrders];
                });
              },
              (err) => console.error(`Orders listener error for supplier ${supplier.id}:`, err)
            );
            orderListenersMap.set(supplier.id, unsubOrders);
          }
        });
      },
      (err) => console.error("Suppliers listener error:", err)
    );
    unsubscribers.push(unsubSuppliers);

    setLoading(false);

    // Cleanup all listeners on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
      orderListenersMap.forEach(unsub => unsub());
    };
  }, [uid]);

  // Helper: Filter data by date
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

  // Calculate filtered data
  const filteredInvoices = filterByDate(invoices);
  const filteredOrders = filterByDate(allOrders);
  const filteredPayments = filterByDate(payments);
  
  // ========== REVENUE ANALYTICS ==========
  const totalRevenue = filteredInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const paidAmount = filteredInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const partialPaid = filteredInvoices.filter(i => i.status === "Partial").reduce((s, i) => s + ((Number(i.amount) || 0) - (Number(i.balance) || 0)), 0);
  const actualRevenue = paidAmount + partialPaid;
  
  // Calculate previous period for growth
  const prevFilteredInvoices = getPreviousPeriodData(invoices, dateFilter);
  const prevRevenue = prevFilteredInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const revenueGrowth = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : 0;
  
  // Revenue by customer
  const revenueByCustomer = {};
  filteredInvoices.forEach(inv => {
    const custName = inv.customer || "Direct Sales";
    revenueByCustomer[custName] = (revenueByCustomer[custName] || 0) + (Number(inv.amount) || 0);
  });
  const topRevenueCustomers = Object.entries(revenueByCustomer).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Revenue by product
  const revenueByProduct = {};
  filteredInvoices.forEach(inv => {
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        const productName = item.productName || item.name || "Unknown";
        const itemRevenue = (Number(item.quantity) || 0) * (Number(item.price) || 0);
        revenueByProduct[productName] = (revenueByProduct[productName] || 0) + itemRevenue;
      });
    }
  });
  const topRevenueProducts = Object.entries(revenueByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Monthly/Weekly/Daily revenue
  const revenueByPeriod = {};
  filteredInvoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
    let periodKey;
    if (dateFilter === "today") {
      periodKey = `${date.getHours()}:00`;
    } else if (dateFilter === "week") {
      periodKey = date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + (Number(inv.amount) || 0);
  });

  // ========== SALES ANALYTICS ==========
  const totalSales = filteredInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalSalesCount = filteredInvoices.length;
  const averageOrderValue = totalSalesCount > 0 ? totalSales / totalSalesCount : 0;

  // Sales by category (approximate from product names)
  const salesByCategory = {};
  filteredInvoices.forEach(inv => {
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        const category = item.category || "General";
        salesByCategory[category] = (salesByCategory[category] || 0) + ((Number(item.quantity) || 0) * (Number(item.price) || 0));
      });
    }
  });
  
  // Top & least selling products
  const productSales = {};
  filteredInvoices.forEach(inv => {
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        const productName = item.productName || item.name || "Unknown";
        productSales[productName] = (productSales[productName] || 0) + (Number(item.quantity) || 0);
      });
    }
  });
  const topSellingProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const leastSellingProducts = Object.entries(productSales).sort((a, b) => a[1] - b[1]).slice(0, 5);

  // Sales trend
  const salesByMonth = {};
  filteredInvoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + (Number(inv.amount) || 0);
  });

  // ========== INVENTORY ANALYTICS ==========
  const totalStockValue = products.reduce((sum, p) => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    const price = Number(p.price) || 0;
    return sum + (stock * price);
  }, 0);

  const lowStockItems = products.filter(p => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    const threshold = parseInt(p.lowStockThreshold) || 10;
    return stock <= threshold && stock > 0;
  });

  const outOfStockProducts = products.filter(p => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    return stock === 0;
  });

  // Fast & Slow moving products
  const fastMovingProducts = topSellingProducts.slice(0, 5);
  const slowMovingProducts = leastSellingProducts.slice(0, 5);
  
  // Inventory turnover (simplified)
  const totalProductsSold = Object.values(productSales).reduce((a, b) => a + b, 0);
  const avgInventory = products.reduce((sum, p) => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    return sum + stock;
  }, 0) / (products.length || 1);
  const inventoryTurnover = avgInventory > 0 ? (totalProductsSold / avgInventory).toFixed(2) : 0;

  // ========== CUSTOMER ANALYTICS ==========
  const totalCustomersCount = customers.length;
  const filteredCustomers = filterByDate(customers);
  const newCustomers = filteredCustomers.length;
  
  // Returning customers (those with >1 invoice)
  const customerInvoiceCount = {};
  invoices.forEach(inv => {
    if (inv.customerId) {
      customerInvoiceCount[inv.customerId] = (customerInvoiceCount[inv.customerId] || 0) + 1;
    }
  });
  const returningCustomers = Object.values(customerInvoiceCount).filter(count => count > 1).length;

  // Top customers by purchase amount
  const customerPurchases = {};
  invoices.forEach(inv => {
    if (inv.customerId) {
      const custName = inv.customer || inv.customerId;
      customerPurchases[custName] = (customerPurchases[custName] || 0) + (Number(inv.amount) || 0);
    }
  });
  const topCustomers = Object.entries(customerPurchases).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Customer purchase frequency
  const customerFrequency = {};
  invoices.forEach(inv => {
    if (inv.customerId) {
      const custName = inv.customer || inv.customerId;
      customerFrequency[custName] = (customerFrequency[custName] || 0) + 1;
    }
  });

  // ========== PAYMENT ANALYTICS ==========
  const totalReceived = filteredPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingPayments = invoices.reduce((s, i) => {
    if (i.status === "Unpaid") return s + (Number(i.amount) || 0);
    if (i.status === "Partial") return s + (Number(i.balance) || 0);
    return s;
  }, 0);
  
  const overduePayments = invoices.reduce((s, i) => {
    if ((i.status === "Unpaid" || i.status === "Partial") && i.dueDate) {
      const dueDate = new Date(i.dueDate);
      if (dueDate < new Date()) {
        return s + (Number(i.balance || i.amount) || 0);
      }
    }
    return s;
  }, 0);

  // Payment method breakdown
  const paymentMethods = {};
  filteredPayments.forEach(p => {
    const method = p.method || "Cash";
    paymentMethods[method] = (paymentMethods[method] || 0) + (Number(p.amount) || 0);
  });

  // Monthly collection
  const monthlyCollection = {};
  filteredPayments.forEach(p => {
    const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyCollection[monthKey] = (monthlyCollection[monthKey] || 0) + (Number(p.amount) || 0);
  });

  const outstandingAmount = pendingPayments + overduePayments;

  // ========== INVOICE ANALYTICS ==========
  const totalInvoicesCount = invoices.length;
  const paidInvoices = invoices.filter(i => i.status === "Paid").length;
  const unpaidInvoices = invoices.filter(i => i.status === "Unpaid").length;
  const overdueInvoices = invoices.filter(i => {
    if ((i.status === "Unpaid" || i.status === "Partial") && i.dueDate) {
      const dueDate = new Date(i.dueDate);
      return dueDate < new Date();
    }
    return false;
  }).length;
  const avgInvoiceAmount = totalInvoicesCount > 0 ? totalSales / totalInvoicesCount : 0;

  // ========== PROFIT ANALYTICS ==========
  const totalPurchases = filteredOrders.reduce((sum, order) => {
    if (order.items && Array.isArray(order.items)) {
      const subtotal = order.items.reduce((s, item) => s + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
      const discount = order.discountType === "percent" 
        ? subtotal * ((Number(order.discountValue) || 0) / 100)
        : (Number(order.discountValue) || 0);
      return sum + Math.max(subtotal - discount, 0);
    }
    return sum;
  }, 0);

  const grossProfit = actualRevenue - totalPurchases;
  const netProfit = grossProfit; // Simplified (no expenses module)
  const profitMargin = actualRevenue > 0 ? ((grossProfit / actualRevenue) * 100).toFixed(1) : 0;
  
  // Monthly profit trend
  const monthlyProfit = {};
  const monthlyRevenueTrend = {};
  const monthlyExpenseTrend = {};
  
  filteredInvoices.forEach(inv => {
    if (inv.status === "Paid" || inv.status === "Partial") {
      const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const rev = inv.status === "Paid" ? (Number(inv.amount) || 0) : ((Number(inv.amount) || 0) - (Number(inv.balance) || 0));
      monthlyRevenueTrend[monthKey] = (monthlyRevenueTrend[monthKey] || 0) + rev;
    }
  });
  
  filteredOrders.forEach(order => {
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (order.items && Array.isArray(order.items)) {
      const subtotal = order.items.reduce((s, item) => s + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
      const discount = order.discountType === "percent" 
        ? subtotal * ((Number(order.discountValue) || 0) / 100)
        : (Number(order.discountValue) || 0);
      monthlyExpenseTrend[monthKey] = (monthlyExpenseTrend[monthKey] || 0) + Math.max(subtotal - discount, 0);
    }
  });
  
  Object.keys(monthlyRevenueTrend).forEach(month => {
    const rev = monthlyRevenueTrend[month] || 0;
    const exp = monthlyExpenseTrend[month] || 0;
    monthlyProfit[month] = rev - exp;
  });

  // Helper function to get previous period data
  function getPreviousPeriodData(data, filter) {
    const now = new Date();
    return data.filter(item => {
      if (!item.createdAt) return false;
      const itemDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
      
      switch(filter) {
        case 'today':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
          const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
          return itemDate >= yesterdayStart && itemDate <= yesterdayEnd;
        case 'week':
          const twoWeeksAgo = new Date(now);
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return itemDate >= twoWeeksAgo && itemDate < oneWeekAgo;
        case 'month':
          const lastMonth = now.getMonth() - 1;
          const lastMonthYear = lastMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
          const adjustedLastMonth = lastMonth < 0 ? 11 : lastMonth;
          return itemDate.getMonth() === adjustedLastMonth && itemDate.getFullYear() === lastMonthYear;
        case 'year':
          return itemDate.getFullYear() === now.getFullYear() - 1;
        default:
          return false;
      }
    });
  }

  // ========== RENDER COMPONENTS ==========
  
  // Stat Card Component
  const StatCard = ({ label, value, icon, color, subtitle, trend }) => (
    <div className="group relative rounded-xl p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
      style={cardStyle}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="text-2xl font-bold group-hover:scale-110 transition-all duration-300">{icon}</div>
          {trend && (
            <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              parseFloat(trend) >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {parseFloat(trend) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(trend))}%
            </div>
          )}
        </div>
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{label}</p>
        <p className="text-white font-bold text-xl mb-0.5">{value}</p>
        {subtitle && <p className="text-gray-600 text-xs">{subtitle}</p>}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${color} opacity-50`} />
    </div>
  );

  // Bar Chart Component
  const BarChart = ({ data, title, color = "from-blue-500 to-purple-600" }) => {
    const maxValue = Math.max(...Object.values(data));
    return (
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3 className="text-white font-bold text-base mb-4">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).slice(-6).map(([key, value]) => {
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400 truncate max-w-[150px]">{key}</span>
                  <span className="text-white font-semibold">Rs. {Number(value).toLocaleString()}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Pie/Doughnut Chart Component
  const DoughnutChart = ({ data, title, colors }) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const segments = Object.entries(data).map(([key, value], idx) => ({
      key,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
      color: colors[idx % colors.length]
    }));

    return (
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3 className="text-white font-bold text-base mb-4">{title}</h3>
        <div className="space-y-2">
          {segments.map(seg => (
            <div key={seg.key} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${seg.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm truncate">{seg.key}</span>
                  <span className="text-white text-sm font-semibold ml-2">{seg.percentage}%</span>
                </div>
                <p className="text-gray-500 text-xs">Rs. {Number(seg.value).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // List Component
  const TopList = ({ items, title, icon, valuePrefix = "" }) => (
    <div className="rounded-xl p-5" style={cardStyle}>
      <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
        {icon} {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No data available</p>
      ) : (
        <div className="space-y-3">
          {items.map(([name, value], index) => (
            <div key={name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-all">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff" }}>
                #{index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{name}</p>
                <p className="text-gray-500 text-xs">{valuePrefix}{typeof value === 'number' ? value.toLocaleString() : value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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

  // ========== SECTION RENDERERS ==========
  
  const renderOverview = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" trend={revenueGrowth} subtitle={`${filteredInvoices.length} invoices`} />
        <StatCard label="Total Purchases" value={`Rs. ${totalPurchases.toLocaleString()}`} icon="🛒" color="from-purple-500 to-pink-600" subtitle={`${filteredOrders.length} orders`} />
        <StatCard label="Net Profit" value={`Rs. ${netProfit.toLocaleString()}`} icon="💵" color={netProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} subtitle={`${profitMargin}% margin`} />
        <StatCard label="Pending Payments" value={`Rs. ${pendingPayments.toLocaleString()}`} icon="⏳" color="from-yellow-500 to-amber-600" subtitle={`${unpaidInvoices} unpaid`} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={totalSalesCount.toLocaleString()} icon="📈" color="from-blue-500 to-indigo-600" subtitle={`Rs. ${totalSales.toLocaleString()}`} />
        <StatCard label="Total Customers" value={totalCustomersCount.toLocaleString()} icon="👥" color="from-cyan-500 to-blue-600" subtitle={`${newCustomers} new`} />
        <StatCard label="Total Products" value={products.length.toLocaleString()} icon="📦" color="from-indigo-500 to-purple-600" subtitle={`${lowStockItems.length} low stock`} />
        <StatCard label="Avg Order Value" value={`Rs. ${Math.round(averageOrderValue).toLocaleString()}`} icon="💳" color="from-pink-500 to-rose-600" subtitle="per invoice" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BarChart data={salesByMonth} title="📈 Sales Trend (Monthly)" color="from-blue-500 to-purple-600" />
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">💰 Profit & Loss</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="text-green-400 text-sm font-semibold">Revenue</span>
              <span className="text-white font-bold">Rs. {actualRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-red-400 text-sm font-semibold">Purchases</span>
              <span className="text-white font-bold">Rs. {totalPurchases.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg`} style={{ 
              background: netProfit >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", 
              border: `1px solid ${netProfit >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` 
            }}>
              <span className={`text-sm font-bold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {netProfit >= 0 ? "✅ Net Profit" : "❌ Net Loss"}
              </span>
              <span className={`font-black text-lg ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                Rs. {Math.abs(netProfit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderRevenue = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" trend={revenueGrowth} />
        <StatCard label="Actual Revenue" value={`Rs. ${actualRevenue.toLocaleString()}`} icon="💵" color="from-green-500 to-emerald-600" subtitle="Received" />
        <StatCard label="Monthly Revenue" value={`Rs. ${(Object.values(revenueByPeriod).reduce((a,b)=>a+b,0)).toLocaleString()}`} icon="📅" color="from-blue-500 to-cyan-600" />
        <StatCard label="Revenue Growth" value={`${revenueGrowth}%`} icon="📈" color={parseFloat(revenueGrowth) >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopList items={topRevenueCustomers} title="Revenue by Customer" icon="👥" valuePrefix="Rs. " />
        <TopList items={topRevenueProducts} title="Revenue by Product" icon="📦" valuePrefix="Rs. " />
      </div>

      <BarChart data={revenueByPeriod} title="📊 Revenue Trend" color="from-amber-500 to-orange-600" />
    </>
  );

  const renderSales = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={`Rs. ${totalSales.toLocaleString()}`} icon="💰" color="from-blue-500 to-indigo-600" />
        <StatCard label="Sales Count" value={totalSalesCount.toLocaleString()} icon="🧾" color="from-purple-500 to-pink-600" subtitle="invoices" />
        <StatCard label="Avg Order Value" value={`Rs. ${Math.round(averageOrderValue).toLocaleString()}`} icon="💳" color="from-pink-500 to-rose-600" />
        <StatCard label="Total Items Sold" value={totalProductsSold.toLocaleString()} icon="📦" color="from-green-500 to-emerald-600" subtitle="units" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BarChart data={salesByMonth} title="📈 Sales Trend (Line Chart Representation)" color="from-blue-500 to-purple-600" />
        <DoughnutChart 
          data={salesByCategory} 
          title="🥧 Sales by Category" 
          colors={["from-blue-500 to-cyan-600", "from-purple-500 to-pink-600", "from-amber-500 to-orange-600", "from-green-500 to-emerald-600"]} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopList items={topSellingProducts} title="Top Selling Products" icon="🏆" valuePrefix="" />
        <TopList items={leastSellingProducts} title="Least Selling Products" icon="📉" valuePrefix="" />
      </div>
    </>
  );

  const renderInventory = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Stock Value" value={`Rs. ${totalStockValue.toLocaleString()}`} icon="📦" color="from-blue-500 to-indigo-600" />
        <StatCard label="Low Stock Items" value={lowStockItems.length.toLocaleString()} icon="⚠️" color="from-yellow-500 to-amber-600" />
        <StatCard label="Out of Stock" value={outOfStockProducts.length.toLocaleString()} icon="❌" color="from-red-500 to-rose-600" />
        <StatCard label="Inventory Turnover" value={inventoryTurnover} icon="🔄" color="from-purple-500 to-pink-600" subtitle="times" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopList items={fastMovingProducts} title="Fast Moving Products" icon="🚀" valuePrefix="" />
        <TopList items={slowMovingProducts} title="Slow Moving Products" icon="🐌" valuePrefix="" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">⚠️ Low Stock Alert</h3>
          {lowStockItems.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">All items well stocked ✅</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map(product => {
                const stock = product.variantType !== "none" && product.variants?.length > 0
                  ? product.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
                  : parseInt(product.stock) || 0;
                return (
                  <div key={product.id} className="flex justify-between items-center p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <span className="text-gray-300 text-sm truncate max-w-[200px]">{product.name}</span>
                    <span className="text-yellow-400 font-semibold text-sm">{stock} left</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">❌ Out of Stock</h3>
          {outOfStockProducts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No stock issues ✅</p>
          ) : (
            <div className="space-y-2">
              {outOfStockProducts.slice(0, 8).map(product => (
                <div key={product.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <span className="text-red-400 text-lg">⚠️</span>
                  <span className="text-gray-300 text-sm truncate flex-1">{product.name}</span>
                  <span className="text-red-400 font-semibold text-xs">0 stock</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderCustomer = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={totalCustomersCount.toLocaleString()} icon="👥" color="from-cyan-500 to-blue-600" />
        <StatCard label="New Customers" value={newCustomers.toLocaleString()} icon="✨" color="from-green-500 to-emerald-600" subtitle="this period" />
        <StatCard label="Returning Customers" value={returningCustomers.toLocaleString()} icon="🔁" color="from-purple-500 to-pink-600" />
        <StatCard label="Avg Purchase Frequency" value={(Object.values(customerFrequency).reduce((a,b)=>a+b,0) / (Object.keys(customerFrequency).length || 1)).toFixed(1)} icon="📊" color="from-amber-500 to-orange-600" subtitle="orders/customer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopList items={topCustomers} title="Top Customers" icon="🏆" valuePrefix="Rs. " />
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">📊 Customer Purchase Frequency</h3>
          {Object.keys(customerFrequency).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No customer data</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(customerFrequency).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([customer, count]) => {
                const maxFreq = Math.max(...Object.values(customerFrequency));
                const percentage = maxFreq > 0 ? (count / maxFreq) * 100 : 0;
                return (
                  <div key={customer}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400 truncate max-w-[150px]">{customer}</span>
                      <span className="text-white font-semibold">{count} orders</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderPayment = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Received" value={`Rs. ${totalReceived.toLocaleString()}`} icon="💰" color="from-green-500 to-emerald-600" />
        <StatCard label="Pending Payments" value={`Rs. ${pendingPayments.toLocaleString()}`} icon="⏳" color="from-yellow-500 to-amber-600" />
        <StatCard label="Overdue Payments" value={`Rs. ${overduePayments.toLocaleString()}`} icon="⚠️" color="from-red-500 to-rose-600" />
        <StatCard label="Outstanding Amount" value={`Rs. ${outstandingAmount.toLocaleString()}`} icon="📤" color="from-orange-500 to-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DoughnutChart 
          data={paymentMethods} 
          title="💳 Payment Method Breakdown" 
          colors={["from-blue-500 to-cyan-600", "from-green-500 to-emerald-600", "from-purple-500 to-pink-600", "from-amber-500 to-orange-600"]} 
        />
        <BarChart data={monthlyCollection} title="📊 Monthly Collection" color="from-green-500 to-emerald-600" />
      </div>
    </>
  );

  const renderInvoice = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Invoices" value={totalInvoicesCount.toLocaleString()} icon="🧾" color="from-blue-500 to-indigo-600" />
        <StatCard label="Paid Invoices" value={paidInvoices.toLocaleString()} icon="✅" color="from-green-500 to-emerald-600" />
        <StatCard label="Unpaid Invoices" value={unpaidInvoices.toLocaleString()} icon="❌" color="from-red-500 to-rose-600" />
        <StatCard label="Overdue Invoices" value={overdueInvoices.toLocaleString()} icon="⚠️" color="from-orange-500 to-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">💳 Invoice Status Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: "Paid", count: paidInvoices, color: "green", percentage: totalInvoicesCount > 0 ? ((paidInvoices / totalInvoicesCount) * 100).toFixed(1) : 0 },
              { label: "Unpaid", count: unpaidInvoices, color: "red", percentage: totalInvoicesCount > 0 ? ((unpaidInvoices / totalInvoicesCount) * 100).toFixed(1) : 0 },
              { label: "Partial", count: invoices.filter(i => i.status === "Partial").length, color: "yellow", percentage: totalInvoicesCount > 0 ? ((invoices.filter(i => i.status === "Partial").length / totalInvoicesCount) * 100).toFixed(1) : 0 },
            ].map(stat => (
              <div key={stat.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400 text-sm">{stat.label}</span>
                  <span className={`text-sm font-bold ${
                    stat.color === "green" ? "text-green-400" :
                    stat.color === "red" ? "text-red-400" :
                    "text-yellow-400"
                  }`}>
                    {stat.count} ({stat.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      stat.color === "green" ? "bg-gradient-to-r from-green-500 to-emerald-600" :
                      stat.color === "red" ? "bg-gradient-to-r from-red-500 to-rose-600" :
                      "bg-gradient-to-r from-yellow-500 to-amber-600"
                    }`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 mt-3 border-t border-white/10 text-center">
            <p className="text-gray-500 text-xs mb-1">Collection Rate</p>
            <p className="text-white font-bold text-2xl">
              {totalInvoicesCount > 0 ? ((paidInvoices / totalInvoicesCount) * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>

        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">💰 Average Invoice Amount</h3>
          <div className="text-center py-8">
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
              Rs. {Math.round(avgInvoiceAmount).toLocaleString()}
            </div>
            <p className="text-gray-500 text-sm">per invoice</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg text-center" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p className="text-blue-400 text-xs font-semibold mb-1">Highest</p>
              <p className="text-white font-bold text-sm">Rs. {Math.max(...invoices.map(i => Number(i.amount) || 0)).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <p className="text-purple-400 text-xs font-semibold mb-1">Lowest</p>
              <p className="text-white font-bold text-sm">Rs. {Math.min(...invoices.map(i => Number(i.amount) || 0), Infinity) === Infinity ? 0 : Math.min(...invoices.map(i => Number(i.amount) || 0)).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderProfit = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Profit" value={`Rs. ${grossProfit.toLocaleString()}`} icon="💰" color={grossProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} />
        <StatCard label="Net Profit" value={`Rs. ${netProfit.toLocaleString()}`} icon="💵" color={netProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} />
        <StatCard label="Profit Margin" value={`${profitMargin}%`} icon="📊" color={parseFloat(profitMargin) >= 0 ? "from-blue-500 to-cyan-600" : "from-red-500 to-rose-600"} />
        <StatCard label="Total Revenue" value={`Rs. ${actualRevenue.toLocaleString()}`} icon="💸" color="from-amber-500 to-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">📊 Profit vs Expense</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-green-400 text-sm font-semibold">Revenue</span>
                <span className="text-white font-bold">Rs. {actualRevenue.toLocaleString()}</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-red-400 text-sm font-semibold">Expenses</span>
                <span className="text-white font-bold">Rs. {totalPurchases.toLocaleString()}</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600" 
                  style={{ width: actualRevenue > 0 ? `${(totalPurchases / actualRevenue) * 100}%` : "0%" }} />
              </div>
            </div>
            <div className="pt-3 border-t border-white/10">
              <div className={`flex justify-between items-center p-4 rounded-lg`} style={{ 
                background: netProfit >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", 
                border: `1px solid ${netProfit >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` 
              }}>
                <span className={`text-base font-black ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {netProfit >= 0 ? "✅ Net Profit" : "❌ Net Loss"}
                </span>
                <span className={`font-black text-2xl ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Rs. {Math.abs(netProfit).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <BarChart data={monthlyProfit} title="📈 Monthly Profit Trend (Area Chart Representation)" color={netProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} />
      </div>
    </>
  );

  // Main render
  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* Header with Filters */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              📊 Business Analytics Dashboard
            </h2>
            <p className="text-gray-400 text-xs">Comprehensive insights and performance metrics for your business</p>
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

          {/* Section Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            {ANALYTICS_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  activeSection === section.id ? "scale-105" : "hover:scale-105"
                }`}
                style={{
                  background: activeSection === section.id 
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activeSection === section.id ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
                  color: activeSection === section.id ? "#000" : "#9ca3af",
                  fontWeight: activeSection === section.id ? "bold" : "semibold",
                }}>
                <span>{section.icon}</span>
                <span className="hidden sm:inline">{section.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on active section */}
      {activeSection === "overview" && renderOverview()}
      {activeSection === "revenue" && renderRevenue()}
      {activeSection === "sales" && renderSales()}
      {activeSection === "inventory" && renderInventory()}
      {activeSection === "customer" && renderCustomer()}
      {activeSection === "payment" && renderPayment()}
      {activeSection === "invoice" && renderInvoice()}
      {activeSection === "profit" && renderProfit()}

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
