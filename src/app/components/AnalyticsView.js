"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line,
} from "recharts";

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
  // { id: "sales", label: "📈 Sales", icon: "📈" },
  { id: "inventory", label: "📦 Inventory", icon: "📦" },
  { id: "customer", label: "👥 Customers", icon: "👥" },
  { id: "payment", label: "💳 Payments", icon: "💳" },
  { id: "invoice", label: "🧾 Invoices", icon: "🧾" },
  { id: "profit", label: "💵 Profit", icon: "💵" },
];

export default function AnalyticsView({ uid }) {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("month");
  const [activeSection, setActiveSection] = useState(() => {
    // Restore last tab from sessionStorage (not localStorage — resets when user navigates away)
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("analyticsTab") || "overview";
    }
    return "overview";
  });
  const [invMoveDays, setInvMoveDays] = useState(30);
  const [invReportTab, setInvReportTab] = useState("valuation");
  const [profitDateFilter, setProfitDateFilter] = useState("all");

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

    // Real-time listener for products — filter deleted ones immediately
    const unsubProducts = onSnapshot(
      collection(db, `users/${uid}/products`),
      (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted));
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
        // Only keep active (non-deleted) suppliers in state
        const activeSuppliersData = suppliersData.filter(s => !s.deleted);
        setSuppliers(activeSuppliersData);

        // Remove listeners for suppliers no longer active (deleted or permanently removed)
        const activeSupplierIdSet = new Set(activeSuppliersData.map(s => s.id));
        for (const [supplierId, unsub] of orderListenersMap.entries()) {
          if (!activeSupplierIdSet.has(supplierId)) {
            unsub();
            orderListenersMap.delete(supplierId);
            // Remove this supplier's orders from allOrders state
            setAllOrders(prevOrders => prevOrders.filter(o => o.supplierId !== supplierId));
          }
        }

        // Add listeners for each active supplier's orders
        // First, clean allOrders to remove any orders from now-inactive suppliers
        setAllOrders(prevOrders => prevOrders.filter(o => activeSupplierIdSet.has(o.supplierId)));

        activeSuppliersData.forEach((supplier) => {
          if (!orderListenersMap.has(supplier.id)) {
            const unsubOrders = onSnapshot(
              collection(db, `users/${uid}/suppliers/${supplier.id}/orders`),
              (ordersSnap) => {
                const newOrders = ordersSnap.docs
                  .map(d => ({ id: d.id, supplierId: supplier.id, supplierName: supplier.name, ...d.data() }))
                  .filter(o => !o.deleted); // exclude soft-deleted orders

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
    return filterByCustomDate(items, dateField, dateFilter);
  }

  function filterByCustomDate(items, dateField = 'createdAt', filter = 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return items.filter(item => {
      if (!item[dateField]) return false;
      const itemDate = item[dateField].toDate ? item[dateField].toDate() : new Date(item[dateField]);

      switch (filter) {
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

  // Calculate filtered data  — exclude soft-deleted invoices everywhere
  const activeInvoices = invoices.filter(i => {
    if (i.deleted) return false;                      // soft-deleted invoice → skip
    if (i.customerId) {
      // Customer invoice → only count if the customer is still active (not deleted)
      const custExists = customers.some(c => c.id === i.customerId);
      if (!custExists) return false;
    }
    return true;
  });
  const filteredInvoices = filterByDate(activeInvoices);
  const filteredOrders = filterByDate(allOrders);
  const filteredPayments = filterByDate(payments);

  // Lookup sets — used to filter payments to active entities only
  const activeInvoiceIds  = new Set(activeInvoices.map(i => i.id));
  const activeCustomerIds = new Set(customers.map(c => c.id)); // customers listener already filters deleted

  // ========== REVENUE ANALYTICS ==========
  // Total Revenue = sum of actualAmount (real sold items only, no prev-balance carry-forwards)
  // Fall back to amount if actualAmount not set (older invoices from InvoicesView tab)
  const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");

  // Build a quick lookup: invoiceId → total returned amount (from payments collection, type="return")
  const returnsByInvoiceId = {};
  payments.forEach(p => {
    if (p.type === "return" && p.invoiceId && Number(p.returnAmount) > 0) {
      returnsByInvoiceId[p.invoiceId] = (returnsByInvoiceId[p.invoiceId] || 0) + Number(p.returnAmount);
    }
  });

  function getInvActualAmount(inv) {
    // For direct invoices (no customerId) — amount field is always correct (no prev-balance items)
    // Still deduct any returns recorded in payments
    if (!inv.customerId) {
      const returned = returnsByInvoiceId[inv.id] || 0;
      return Math.max(0, (Number(inv.amount) || 0) - returned);
    }

    // For customer invoices:
    // Both `amount` and `actualAmount` are updated on returns.
    // `amount` = full invoice total after discount & returns (may include prev-balance carry-forward)
    // `actualAmount` = only real sold items, no prev-balance, updated on returns
    // Problem: `actualAmount` sometimes fails to update in global invoices collection (silent catch)
    // Safe approach: compute from items stripping prev-balance lines, then deduct returns from payments
    const returned = returnsByInvoiceId[inv.id] || 0;
    const realItems = (inv.items || []).filter(it => !isPrevBalItem(it));
    if (realItems.length > 0) {
      const realSubtotal = realItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
      const fullSubtotal = (inv.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
      // Apply discount proportionally to real items
      let realAfterDiscount = realSubtotal;
      if (fullSubtotal > 0 && Number(inv.discount) > 0) {
        const ratio = realSubtotal / fullSubtotal;
        realAfterDiscount = Math.max(realSubtotal - (Number(inv.discount) || 0) * ratio, 0);
      }
      // Cap with actualAmount if available (it accounts for returns applied after creation)
      let base;
      if (inv.actualAmount != null) {
        base = Math.min(realAfterDiscount, Number(inv.actualAmount));
      } else {
        // No actualAmount — cap with inv.amount to avoid over-counting
        base = Math.min(realAfterDiscount, Number(inv.amount) || realAfterDiscount);
      }
      // Deduct any additional returns from payments collection
      return Math.max(0, base - returned);
    }
    // Fallback: actualAmount or amount, minus returns
    const base = inv.actualAmount != null ? Number(inv.actualAmount) : (Number(inv.amount) || 0);
    return Math.max(0, base - returned);
  }

  const totalRevenue = activeInvoices.reduce((sum, i) => sum + getInvActualAmount(i), 0);
  const paidAmount = filteredInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + getInvActualAmount(i), 0);
  const partialPaid = filteredInvoices.filter(i => i.status === "Partial").reduce((s, i) => s + Math.max(0, getInvActualAmount(i) - (Number(i.balance) || 0)), 0);
  const actualRevenue = paidAmount + partialPaid;

  // Calculate previous period for growth (active invoices only)
  const prevFilteredInvoices = getPreviousPeriodData(activeInvoices, dateFilter);
  const prevRevenue = prevFilteredInvoices.reduce((sum, i) => sum + getInvActualAmount(i), 0);
  const revenueGrowth = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : 0;

  // Revenue by customer (actual amount — no prev-balance inflation)
  const revenueByCustomer = {};
  filteredInvoices.forEach(inv => {
    const custName = inv.customer || "Direct Sales";
    revenueByCustomer[custName] = (revenueByCustomer[custName] || 0) + getInvActualAmount(inv);
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
    (inv.items || []).forEach(item => {
      const category = item.category || "General";
      const qty = Number(item.qty) || Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || Number(item.price) || 0;
      salesByCategory[category] = (salesByCategory[category] || 0) + (qty * price);
    });
  });

  // Sales trend
  const salesByMonth = {};
  filteredInvoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + (Number(inv.amount) || 0);
  });

  // ========== INVENTORY ANALYTICS ==========
  // helper — total stock of a product (variants or simple)
  function getProductStock(p) {
    if (p.variantType !== "none" && p.variants?.length > 0)
      return p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
    return parseInt(p.stock) || 0;
  }
  // helper — selling price of a product
  function getProductPrice(p) {
    return Number(p.sellingPrice || p.price) || 0;
  }

  // products state is already filtered (!deleted) by the listener
  const activeProducts = products; // alias for clarity

  const totalStockValue = activeProducts.reduce((sum, p) => {
    return sum + getProductStock(p) * getProductPrice(p);
  }, 0);

  const lowStockItems = activeProducts.filter(p => {
    const stock = getProductStock(p);
    const threshold = parseInt(p.lowStockThreshold) || 10;
    return stock > 0 && stock <= threshold;
  });

  const outOfStockProducts = activeProducts.filter(p => getProductStock(p) === 0);

  // Fast & Slow moving — ONLY inventory-linked items (productId must exist)
  const productSalesByDesc = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!item.productId) return; // skip non-inventory items
      if ((item.description || "").startsWith("Previous Balance")) return;
      // Use inventory product name if available, else fall back to description
      const prod = activeProducts.find(p => p.id === item.productId);
      if (!prod) return; // product deleted from inventory → skip
      const name = prod.name || item.description || "Unknown";
      const qty = Number(item.qty) || Number(item.quantity) || 0;
      productSalesByDesc[name] = (productSalesByDesc[name] || 0) + qty;
    });
  });
  const topSellingProducts = Object.entries(productSalesByDesc).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const leastSellingProducts = Object.entries(productSalesByDesc).sort((a, b) => a[1] - b[1]).slice(0, 5);
  const fastMovingProducts = topSellingProducts;
  const slowMovingProducts = leastSellingProducts;
  const totalProductsSold = Object.values(productSalesByDesc).reduce((a, b) => a + b, 0);

  // Inventory turnover
  const avgInventory = activeProducts.length > 0
    ? activeProducts.reduce((sum, p) => sum + getProductStock(p), 0) / activeProducts.length
    : 0;
  const inventoryTurnover = avgInventory > 0 ? (totalProductsSold / avgInventory).toFixed(2) : 0;

  // ========== EXTENDED INVENTORY ANALYTICS ==========
  // Cost price helper — variant-aware weighted average
  function getProductCostPrice(p) {
    if (p.variantType !== "none" && p.variants?.length > 0) {
      let totalStock = 0, totalCost = 0;
      p.variants.forEach(v => {
        const s = parseInt(v.stock) || 0;
        totalStock += s;
        totalCost += s * (Number(v.costPrice) || 0);
      });
      return totalStock > 0 ? totalCost / totalStock : (Number(p.costPrice) || 0);
    }
    return Number(p.costPrice) || 0;
  }

  // Total products & stock units
  const totalProducts = activeProducts.length;
  const totalStockUnits = activeProducts.reduce((sum, p) => sum + getProductStock(p), 0);

  // Inventory value at cost — variant-aware (each variant × its own costPrice)
  const totalInventoryCostValue = activeProducts.reduce((sum, p) => {
    if (p.variantType !== "none" && p.variants?.length > 0) {
      return sum + p.variants.reduce((s, v) =>
        s + (parseInt(v.stock) || 0) * (Number(v.costPrice) || 0), 0);
    }
    return sum + getProductStock(p) * (Number(p.costPrice) || 0);
  }, 0);

  // Potential sales value — variant-aware (each variant × its own sellingPrice)
  const totalPotentialSalesValue = activeProducts.reduce((sum, p) => {
    if (p.variantType !== "none" && p.variants?.length > 0) {
      return sum + p.variants.reduce((s, v) =>
        s + (parseInt(v.stock) || 0) * (Number(v.sellingPrice || v.price) || 0), 0);
    }
    return sum + getProductStock(p) * getProductPrice(p);
  }, 0);

  // Potential profit = if all current stock is sold at selling price
  const totalPotentialProfit = totalPotentialSalesValue - totalInventoryCostValue;

  // Recently added products (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentlyAddedProducts = activeProducts.filter(p => {
    if (!p.createdAt) return false;
    const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    return d >= thirtyDaysAgo;
  });

  // Stock by category (pie chart)
  const stockByCategory = {};
  activeProducts.forEach(p => {
    const cat = p.category || "Uncategorized";
    stockByCategory[cat] = (stockByCategory[cat] || 0) + getProductStock(p);
  });
  const stockByCategoryData = Object.entries(stockByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Inventory value by category (bar chart)
  const invValueByCategory = {};
  activeProducts.forEach(p => {
    const cat = p.category || "Uncategorized";
    invValueByCategory[cat] = (invValueByCategory[cat] || 0) + getProductStock(p) * getProductCostPrice(p);
  });
  const invValueByCategoryData = Object.entries(invValueByCategory)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Stock movement trend: last 7/30/90 days
  // Added = from purchase orders; Sold = from invoices
  function getStockMovement(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = days <= 7
        ? d.toLocaleDateString("en-US", { weekday: "short" })
        : days <= 30
          ? `${d.getDate()}/${d.getMonth() + 1}`
          : `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
      buckets[key] = { date: new Date(d), sold: 0, added: 0, returned: 0 };
    }
    // Count sold from invoices
    invoices.forEach(inv => {
      if (!inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      if (d < cutoff) return;
      const key = days <= 7
        ? d.toLocaleDateString("en-US", { weekday: "short" })
        : days <= 30
          ? `${d.getDate()}/${d.getMonth() + 1}`
          : `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
      if (buckets[key] !== undefined) {
        (inv.items || []).forEach(item => {
          const qty = Number(item.qty) || Number(item.quantity) || 0;
          buckets[key].sold += qty;
        });
      }
    });
    // Count added from purchase orders
    allOrders.forEach(order => {
      if (!order.createdAt) return;
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      if (d < cutoff) return;
      const key = days <= 7
        ? d.toLocaleDateString("en-US", { weekday: "short" })
        : days <= 30
          ? `${d.getDate()}/${d.getMonth() + 1}`
          : `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
      if (buckets[key] !== undefined) {
        const qty = Number(order.totalQty) || Number(order.quantity) || 0;
        buckets[key].added += qty;
      }
    });
    // Return as sorted array, deduplicating by key label
    const seen = new Set();
    return Object.entries(buckets)
      .sort((a, b) => a[1].date - b[1].date)
      .filter(([key]) => { if (seen.has(key)) return false; seen.add(key); return true; })
      .map(([name, v]) => ({ name, sold: v.sold, added: v.added, returned: v.returned }));
  }

  // Top selling products (for inventory table)
  const topSellingInvProducts = Object.entries(productSalesByDesc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, sold]) => ({ name, sold }));

  // Slow-moving products — sold less than 20% of original/current stock in N days
  // OR not sold at all in N days (whichever applies)
  function getSlowMoving(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Build per-product sold qty within the window
    const soldQtyInWindow = {};
    invoices.forEach(inv => {
      if (!inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      if (d < cutoff) return;
      (inv.items || []).forEach(item => {
        if (!item.productId) return;
        const qty = Number(item.qty) || Number(item.quantity) || 0;
        soldQtyInWindow[item.productId] = (soldQtyInWindow[item.productId] || 0) + qty;
      });
    });

    return activeProducts
      .filter(p => {
        const currentStock = getProductStock(p);
        if (currentStock <= 0) return false; // out of stock — not dead, just empty
        const soldQty = soldQtyInWindow[p.id] || 0;
        // Dead/slow if: sold nothing OR sold less than 20% of current stock
        const totalUnits = currentStock + soldQty; // approximate original stock
        const soldRatio = totalUnits > 0 ? soldQty / totalUnits : 0;
        return soldRatio < 0.2; // less than 20% sold → slow/dead
      })
      .map(p => ({
        ...p,
        soldInWindow: soldQtyInWindow[p.id] || 0,
        currentStock: getProductStock(p),
      }));
  }

  // Highest inventory value products
  const highestInvValueProducts = activeProducts
    .map(p => ({ name: p.name, value: getProductStock(p) * getProductCostPrice(p) }))
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Stock aging
  const now_inv = new Date();
  const invAgingBuckets = { "0–30 Days": 0, "31–90 Days": 0, "90+ Days": 0 };
  const invAgingProducts = { "0–30 Days": [], "31–90 Days": [], "90+ Days": [] };
  activeProducts.forEach(p => {
    if (!p.createdAt) return;
    const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    const ageDays = Math.floor((now_inv - d) / (1000 * 60 * 60 * 24));
    const stock = getProductStock(p);
    if (stock <= 0) return;
    const bucket = ageDays <= 30 ? "0–30 Days" : ageDays <= 90 ? "31–90 Days" : "90+ Days";
    invAgingBuckets[bucket] += stock;
    invAgingProducts[bucket].push({ name: p.name, stock, ageDays });
  });
  const invAgingData = Object.entries(invAgingBuckets).map(([name, value]) => ({ name, value }));

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
  // p.paid = actual amount received, p.amount = previous balance before payment (billing context)
  const totalReceived = filteredPayments
    .filter(p => p.type === "received")
    .reduce((s, p) => s + (Number(p.paid ?? p.amount) || 0), 0);
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
  filteredPayments.filter(p => p.type === "received").forEach(p => {
    const method = p.method || "Cash";
    paymentMethods[method] = (paymentMethods[method] || 0) + (Number(p.paid ?? p.amount) || 0);
  });

  // Monthly collection
  const monthlyCollection = {};
  filteredPayments.filter(p => p.type === "received").forEach(p => {
    const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyCollection[monthKey] = (monthlyCollection[monthKey] || 0) + (Number(p.paid ?? p.amount) || 0);
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

  // ========== PROFIT ANALYTICS (inventory-linked items only) ==========
  // Profit has its own independent date filter (defaults to "all") so it 
  // doesn't go blank when the main analytics date filter is changed.
  const profitFilteredInvoices = filterByCustomDate(
    invoices.filter(i => !i.deleted), 'createdAt', profitDateFilter
  );

  // Build a quick lookup map: productId → product (non-deleted only)
  const productMap = {};
  // Also build name-based lookup for items created before productId was linked
  const productNameMap = {};
  products.filter(p => !p.deleted).forEach(p => {
    productMap[p.id] = p;
    if (p.name) productNameMap[p.name.trim().toLowerCase()] = p;
  });

  // Helper: get cost price for an invoice item
  // item.productId must exist AND product must exist in inventory
  function getItemCost(item) {
    // Try productId first, then fall back to name matching
    let prod = item.productId ? productMap[item.productId] : null;

    // Fallback: match by description/name (for items without productId)
    if (!prod && item.description) {
      prod = productNameMap[(item.description || "").trim().toLowerCase()] || null;
    }

    if (!prod) return null; // no matching product found → skip

    const qty = Number(item.qty) || 1;
    const effQty = (() => {
      if (item.variantLabel) {
        const num = parseFloat(item.variantLabel);
        return (!isNaN(num) && num > 0) ? num * qty : qty;
      }
      return qty;
    })();

    let costPricePerUnit = 0;

    if (typeof item.costPriceAtTime === "number" && item.costPriceAtTime >= 0) {
      costPricePerUnit = item.costPriceAtTime;
    } else if (prod.variants?.length > 0) {
      let variant = null;
      if (item.variantId) {
        variant = prod.variants.find(v => v.id === item.variantId);
        if (!variant) {
          const idx = Number(item.variantId);
          if (!isNaN(idx) && prod.variants[idx]) variant = prod.variants[idx];
        }
      }
      if (!variant && item.variantLabel) {
        variant = prod.variants.find(
          v => (v.label || "").toLowerCase() === (item.variantLabel || "").toLowerCase()
        );
        if (!variant) {
          const labelNum = parseFloat(item.variantLabel);
          if (!isNaN(labelNum)) {
            variant = prod.variants.find(v => parseFloat(v.label) === labelNum);
          }
        }
      }
      if (!variant && prod.variants.length === 1) variant = prod.variants[0];
      costPricePerUnit = variant ? (Number(variant.costPrice) || 0) : (Number(prod.costPrice) || 0);
    } else {
      costPricePerUnit = Number(prod.costPrice) || 0;
    }

    const sellingPricePerUnit = Number(item.unitPrice) || 0;
    const resolvedProductId = prod.id; // use resolved product id (handles name-matched items too)
    return {
      revenue: sellingPricePerUnit * effQty,
      cost: costPricePerUnit * effQty,
      profit: (sellingPricePerUnit - costPricePerUnit) * effQty,
      qty: effQty,
      name: item.description || prod.name || "—",
      productId: resolvedProductId,
    };
  }

  // Aggregate profit from profitFilteredInvoices (non-deleted)
  let totalInventoryRevenue = 0;
  let totalInventoryCost = 0;
  let totalInventoryProfit = 0;
  let inventoryItemCount = 0;
  let skippedItemCount = 0;

  const profitByProduct = {};

  profitFilteredInvoices
    .forEach(inv => {
      (inv.items || []).forEach(item => {
        if ((item.description || "").startsWith("Previous Balance · INV-")) return;
        const result = getItemCost(item);
        if (!result) { skippedItemCount++; return; }
        totalInventoryRevenue += result.revenue;
        totalInventoryCost += result.cost;
        totalInventoryProfit += result.profit;
        inventoryItemCount++;
        if (!profitByProduct[result.productId]) {
          profitByProduct[result.productId] = { name: result.name, revenue: 0, cost: 0, profit: 0, qty: 0 };
        }
        profitByProduct[result.productId].revenue += result.revenue;
        profitByProduct[result.productId].cost += result.cost;
        profitByProduct[result.productId].profit += result.profit;
        profitByProduct[result.productId].qty += result.qty;
      });
    });

  const grossProfit = totalInventoryProfit;
  const netProfit = grossProfit; // simplified
  const profitMargin = totalInventoryRevenue > 0
    ? ((grossProfit / totalInventoryRevenue) * 100).toFixed(1)
    : "0.0";

  // Top profitable & least profitable products
  const topProfitableProducts = Object.values(profitByProduct)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
  const leastProfitableProducts = Object.values(profitByProduct)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  // Most profitable products for inventory section (top 10)
  const mostProfitableInvProducts = Object.values(profitByProduct)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  // Backward-compat: keep totalPurchases for any existing JSX that uses it
  const totalPurchases = totalInventoryCost;

  // Monthly profit trend
  const monthlyProfit = {};

  profitFilteredInvoices
    .forEach(inv => {
      const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      (inv.items || []).forEach(item => {
        if ((item.description || "").startsWith("Previous Balance · INV-")) return;
        const result = getItemCost(item);
        if (!result) return;
        monthlyProfit[monthKey] = (monthlyProfit[monthKey] || 0) + result.profit;
      });
    });

  // Helper function to get previous period data
  function getPreviousPeriodData(data, filter) {
    const now = new Date();
    return data.filter(item => {
      if (!item.createdAt) return false;
      const itemDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);

      switch (filter) {
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
            <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${parseFloat(trend) >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
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

  // CSS Bar Chart Component (custom, no external lib)
  const CssBarChart = ({ data, title, color = "from-blue-500 to-purple-600" }) => {
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

  // CSS Doughnut/Pie legend Component (custom, no external lib)
  const CssDoughnutChart = ({ data, title, colors }) => {
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
        <StatCard label="Total Products" value={activeProducts.length.toLocaleString()} icon="📦" color="from-indigo-500 to-purple-600" subtitle={`${lowStockItems.length} low stock`} />
        <StatCard label="Avg Order Value" value={`Rs. ${Math.round(averageOrderValue).toLocaleString()}`} icon="💳" color="from-pink-500 to-rose-600" subtitle="per invoice" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CssBarChart data={salesByMonth} title="📈 Sales Trend (Monthly)" color="from-blue-500 to-purple-600" />
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">💰 Profit & Loss</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="text-green-400 text-sm font-semibold">Inventory Revenue</span>
              <span className="text-white font-bold">Rs. {totalInventoryRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-red-400 text-sm font-semibold">Total Cost</span>
              <span className="text-white font-bold">Rs. {totalInventoryCost.toLocaleString()}</span>
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
            {skippedItemCount > 0 && (
              <p className="text-gray-600 text-[10px] text-center">
                ⚠️ {skippedItemCount} item{skippedItemCount > 1 ? "s" : ""} skipped (not linked to inventory)
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderRevenue = () => {
    // ── Revenue-specific computed values ──────────────────────────────────────
    const now_r = new Date();
    const todayStart = new Date(now_r.getFullYear(), now_r.getMonth(), now_r.getDate());
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const thisWeekStart = new Date(todayStart); thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(todayStart); lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const thisMonthStart = new Date(now_r.getFullYear(), now_r.getMonth(), 1);
    const lastMonthStart = new Date(now_r.getFullYear(), now_r.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now_r.getFullYear(), now_r.getMonth(), 0, 23, 59, 59);
    const thisYearStart = new Date(now_r.getFullYear(), 0, 1);
    const lastYearStart = new Date(now_r.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now_r.getFullYear() - 1, 11, 31, 23, 59, 59);

    function revSum(filter) {
      return activeInvoices.reduce((s, i) => {
        if (!i.createdAt) return s;
        const d = i.createdAt.toDate ? i.createdAt.toDate() : new Date(i.createdAt);
        if (!filter(d)) return s;
        return s + getInvActualAmount(i);
      }, 0);
    }

    const revToday = revSum(d => d >= todayStart);
    const revYesterday = revSum(d => d >= yesterdayStart && d < todayStart);
    const revThisMonth = revSum(d => d >= thisMonthStart);
    const revLastMonth = revSum(d => d >= lastMonthStart && d <= lastMonthEnd);
    const revThisWeek = revSum(d => d >= thisWeekStart);
    const revLastWeek = revSum(d => d >= lastWeekStart && d < thisWeekStart);
    const revThisYear = revSum(d => d >= thisYearStart);
    const revLastYear = revSum(d => d >= lastYearStart && d <= lastYearEnd);

    const totalInvCount = activeInvoices.length;
    const avgInvoiceVal = totalInvCount > 0 ? totalRevenue / totalInvCount : 0;

    // Daily revenue for "highest revenue day" (actual amounts)
    const revByDay = {};
    activeInvoices.forEach(inv => {
      if (!inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const key = d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
      revByDay[key] = (revByDay[key] || 0) + getInvActualAmount(inv);
    });
    const highestRevDayEntry = Object.entries(revByDay).sort((a, b) => b[1] - a[1])[0];
    const lowestRevDayEntry = Object.entries(revByDay).sort((a, b) => a[1] - b[1])[0];
    const highestRevDay = highestRevDayEntry ? highestRevDayEntry[0] : "—";
    const highestRevAmt = highestRevDayEntry ? highestRevDayEntry[1] : 0;
    const lowestRevDay = lowestRevDayEntry ? lowestRevDayEntry[0] : "—";
    const lowestRevAmt = lowestRevDayEntry ? lowestRevDayEntry[1] : 0;

    // Average daily revenue (total / days active)
    const daysActive = Object.keys(revByDay).length || 1;
    const avgDailyRev = totalRevenue / daysActive;

    // Monthly revenue trend chart data (last 12 months — actual amounts)
    const monthlyRevMap = {};
    activeInvoices.forEach(inv => {
      if (!inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevMap[key] = (monthlyRevMap[key] || 0) + getInvActualAmount(inv);
    });
    const monthlyRevChartData = Object.entries(monthlyRevMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => ({
        name: new Date(key + "-01").toLocaleString("en-US", { month: "short" }),
        Revenue: Math.round(value),
      }));

    // Previous month data for comparison (actual amounts)
    const prevMonthRevMap = {};
    activeInvoices.forEach(inv => {
      if (!inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!prevMonthRevMap[key]) prevMonthRevMap[key] = 0;
      prevMonthRevMap[key] += getInvActualAmount(inv);
    });
    // Build current+prev month comparison chart
    const allMonthKeys = [...new Set([
      ...Object.keys(prevMonthRevMap),
    ])].sort().slice(-6);
    const compChartData = allMonthKeys.map((key, i, arr) => {
      const prevKey = arr[i - 1];
      return {
        name: new Date(key + "-01").toLocaleString("en-US", { month: "short" }),
        "This Month": Math.round(prevMonthRevMap[key] || 0),
        "Prev Month": Math.round(prevMonthRevMap[prevKey] || 0),
      };
    });

    // Revenue by category (from invoice items — active invoices only)
    // Only count items that are linked to an inventory product with a category
    const revByCat = {};
    let catDebug = []; // temporary debug array
    activeInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (isPrevBalItem(item)) return; // skip prev-balance carry-forwards

        const qty = Number(item.qty) || Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || Number(item.price) || 0;
        if (qty <= 0 || price <= 0) return;

        // Try to get category from linked product first, then by name match, then from item itself
        let cat = null;
        let debugInfo = { itemDesc: item.description, productId: item.productId, hasProduct: false, category: null };

        const prodById = item.productId ? productMap[item.productId] : null;
        const prodByName = !prodById && item.description
          ? productNameMap[(item.description || "").trim().toLowerCase()] || null
          : null;
        const prod = prodById || prodByName;

        if (prod) {
          debugInfo.hasProduct = true;
          debugInfo.category = prod.category;
          cat = prod.category || item.category || null;
        } else {
          cat = item.category || null;
          debugInfo.category = cat;
        }

        catDebug.push(debugInfo);

        // Items with no category → "No Category"
        const catKey = (cat && cat.trim()) ? cat.trim() : "No Category";
        revByCat[catKey] = (revByCat[catKey] || 0) + (qty * price);
      });
    });

    // Log debug info to console
    if (catDebug.length > 0) {
      console.log("📊 Revenue by Category Debug:", JSON.parse(JSON.stringify(catDebug)));
      console.log("📦 ProductMap keys:", Object.keys(productMap));
      // Extra: show full first few items from invoices
      const sampleItems = activeInvoices.flatMap(inv => (inv.items || []).slice(0, 2)).slice(0, 5);
      console.log("🧾 Sample invoice items:", JSON.parse(JSON.stringify(sampleItems)));
      console.log("📦 Sample products:", JSON.parse(JSON.stringify(products.slice(0, 3).map(p => ({ id: p.id, name: p.name, category: p.category })))));
    }

    const revByCatData = Object.entries(revByCat)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    // Top revenue products with qty sold (active invoices only)
    const revProdMap = {};
    activeInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const name = item.description || item.productName || "Unknown";
        if (name.startsWith("Previous Balance")) return;
        const qty = Number(item.qty) || Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || Number(item.price) || 0;
        if (!revProdMap[name]) revProdMap[name] = { revenue: 0, qty: 0 };
        revProdMap[name].revenue += qty * price;
        revProdMap[name].qty += qty;
      });
    });
    const topRevProducts = Object.entries(revProdMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, v]) => ({ name, revenue: Math.round(v.revenue), qty: v.qty }));

    // Top revenue customers (actual amount per invoice — no prev-balance inflation)
    const revCustMap = {};
    activeInvoices.forEach(inv => {
      const name = inv.customer || inv.customerName || "Direct Sales";
      revCustMap[name] = (revCustMap[name] || 0) + getInvActualAmount(inv);
    });
    const topRevCustomers = Object.entries(revCustMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value: Math.round(value) }));

    // Revenue by payment method — only active invoices' payments
    const allReceivedPayments = payments.filter(p => {
      if (p.type !== "received") return false;
      if (p.invoiceId) return activeInvoiceIds.has(p.invoiceId);
      if (p.customerId) return activeCustomerIds.has(p.customerId);
      return true;
    });
    // For invoices that were paid at creation (no payment record exists), 
    // we need to include them via invoice amountPaid fallback
    // Build a set of invoiceIds that already have payment records
    const invoiceIdsWithPaymentRecord = new Set(allReceivedPayments.map(p => p.invoiceId).filter(Boolean));

    // Invoice-based fallback: invoices paid at creation but no payment record
    const invoiceFallbackPayments = activeInvoices
      .filter(i => Number(i.amountPaid) > 0 && !invoiceIdsWithPaymentRecord.has(i.id))
      .map(i => ({
        type: "received",
        paid: Number(i.amountPaid),
        method: i.paymentMethod || "cash",  // default cash for old invoices
        invoiceId: i.id,
      }));

    const allPaymentsForMethod = [...allReceivedPayments, ...invoiceFallbackPayments];

    const cashRev = allPaymentsForMethod
      .filter(p => (p.method || "cash").toLowerCase() === "cash")
      .reduce((s, p) => s + (Number(p.paid) || 0), 0);

    const onlineRev = allPaymentsForMethod
      .filter(p => (p.method || "").toLowerCase().includes("online"))
      .reduce((s, p) => s + (Number(p.paid) || 0), 0);

    const bankRev = allPaymentsForMethod
      .filter(p => (
        (p.method || "").toLowerCase().includes("bank") ||
        (p.method || "").toLowerCase().includes("transfer") ||
        (p.method || "").toLowerCase().includes("cheque")
      ))
      .reduce((s, p) => s + (Number(p.paid) || 0), 0);

    // Credit Sales = invoices that are still Unpaid or Partial (outstanding balance)
    const creditRev = activeInvoices
      .filter(i => i.status === "Partial" || i.status === "Unpaid")
      .reduce((s, i) => s + getInvActualAmount(i), 0);

    const paidRev = activeInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + getInvActualAmount(i), 0);

    // Total Collected = sum of amountPaid across all active invoices (most accurate)
    const totalCollected = activeInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);

    // Fastest growing product (active invoices only)
    const prevMonthInvoices = activeInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });
    const thisMonthInvoices = activeInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      return d >= thisMonthStart;
    });
    const prevProdRev = {}; const thisProdRev = {};
    prevMonthInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const n = item.description || "Unknown";
        if (n.startsWith("Previous Balance")) return;
        prevProdRev[n] = (prevProdRev[n] || 0) + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
      });
    });
    thisMonthInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const n = item.description || "Unknown";
        if (n.startsWith("Previous Balance")) return;
        thisProdRev[n] = (thisProdRev[n] || 0) + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
      });
    });
    const fastestGrowing = Object.entries(thisProdRev)
      .map(([name, curr]) => ({ name, growth: curr - (prevProdRev[name] || 0) }))
      .sort((a, b) => b.growth - a.growth)[0];

    // Best selling category — skip "No Category"
    const bestCat = revByCatData.find(d => d.name !== "No Category")?.name || revByCatData[0]?.name || "—";
    // Top revenue customer
    const topRevCust = topRevCustomers[0]?.name || "—";

    // Comparison helpers
    function growthPct(curr, prev) {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev * 100).toFixed(1);
    }

    const CHART_COLORS_R = ["#f59e0b", "#6366f1", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];
    const ttStyle_r = { background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontSize: "12px" };
    const ttCursor  = { fill: "rgba(255,255,255,0.04)" }; // shared cursor for all bar/area charts

    const GrowthBadge = ({ curr, prev }) => {
      const pct = Number(growthPct(curr, prev));
      return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${pct >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          {pct >= 0 ? "↑" : "↓"} {Math.abs(pct)}%
        </span>
      );
    };

    return (
      <>
        {/* ══ DEBUG BREAKDOWN (temporary) ══ */}
        {(() => {
          const directTotal = activeInvoices.filter(i => !i.customerId).reduce((s, i) => s + getInvActualAmount(i), 0);
          const customerTotal = activeInvoices.filter(i => i.customerId).reduce((s, i) => s + getInvActualAmount(i), 0);
          const withActual = activeInvoices.filter(i => i.customerId && i.actualAmount != null).length;
          const withoutActual = activeInvoices.filter(i => i.customerId && i.actualAmount == null).length;
          const prevBalSum = activeInvoices.filter(i => i.customerId && i.actualAmount == null).reduce((s, i) => {
            const prevBal = (i.items || []).filter(it => isPrevBalItem(it)).reduce((x, it) => x + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
            return s + prevBal;
          }, 0);
          // return (
          //   <div className="rounded-xl p-4 text-xs font-mono space-y-1" style={{background:"rgba(255,255,0,0.05)",border:"1px solid rgba(255,255,0,0.2)"}}>
          //     <p className="text-yellow-400 font-bold mb-2">� DEBUG — Revenue Breakdown</p>
          //     <p className="text-white">Total Revenue (computed): <b>Rs. {Math.round(totalRevenue).toLocaleString()}</b></p>
          //     <p className="text-cyan-400">Direct Invoices total: Rs. {Math.round(directTotal).toLocaleString()} ({activeInvoices.filter(i=>!i.customerId).length} invoices)</p>
          //     <p className="text-green-400">Customer Invoices total: Rs. {Math.round(customerTotal).toLocaleString()} ({activeInvoices.filter(i=>i.customerId).length} invoices)</p>
          //     <p className="text-gray-400">  ↳ with actualAmount field: {withActual}</p>
          //     <p className="text-orange-400">  ↳ WITHOUT actualAmount: {withoutActual} (prev-bal stripped from items)</p>
          //     <p className="text-red-400">  ↳ prev-balance amount in those invoices: Rs. {Math.round(prevBalSum).toLocaleString()}</p>
          //     <p className="text-purple-400 mt-2">Invoice count: {activeInvoices.length} active, {invoices.filter(i=>i.deleted).length} soft-deleted</p>
          //     <p className="text-yellow-300 font-bold mt-3 pt-2 border-t border-gray-700">📋 Customer Invoices Detail:</p>
          //     {activeInvoices.filter(i => i.customerId).map(inv => {
          //       const custName = inv.customer || inv.customerName || inv.customerId;
          //       const computed = getInvActualAmount(inv);
          //       const returned = returnsByInvoiceId[inv.id] || 0;
          //       return (
          //         <p key={inv.id} className="text-gray-300 text-[10px] pl-2">
          //           {custName} | stored: Rs.{Math.round(Number(inv.amount)||0).toLocaleString()} | 
          //           actual: {inv.actualAmount != null ? `Rs.${Math.round(inv.actualAmount).toLocaleString()}` : "null"} | 
          //           returned: Rs.{Math.round(returned).toLocaleString()} |
          //           <span className="text-yellow-400">computed: Rs.{Math.round(computed).toLocaleString()}</span>
          //         </p>
          //       );
          //     })}
          //   </div>
          // );
        })()}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={`Rs. ${Math.round(totalRevenue).toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" trend={revenueGrowth} subtitle="All time" />
          <StatCard label="Today's Revenue" value={`Rs. ${Math.round(revToday).toLocaleString()}`} icon="🌅" color="from-pink-500 to-rose-600" subtitle={<GrowthBadge curr={revToday} prev={revYesterday} />} />
          <StatCard label="This Month Revenue" value={`Rs. ${Math.round(revThisMonth).toLocaleString()}`} icon="📅" color="from-blue-500 to-cyan-600" subtitle={<GrowthBadge curr={revThisMonth} prev={revLastMonth} />} />
          <StatCard label="This Year Revenue" value={`Rs. ${Math.round(revThisYear).toLocaleString()}`} icon="📆" color="from-purple-500 to-violet-600" subtitle={<GrowthBadge curr={revThisYear} prev={revLastYear} />} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Avg Daily Revenue" value={`Rs. ${Math.round(avgDailyRev).toLocaleString()}`} icon="📊" color="from-teal-500 to-cyan-600" subtitle={`${daysActive} active days`} />
          <StatCard label="Avg Invoice Value" value={`Rs. ${Math.round(avgInvoiceVal).toLocaleString()}`} icon="🧾" color="from-indigo-500 to-blue-600" subtitle={`${totalInvCount} invoices`} />
          <StatCard label="Revenue Growth %" value={`${revenueGrowth}%`} icon="📈" color={parseFloat(revenueGrowth) >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"} subtitle="vs prev period" />
          <StatCard label="Highest Revenue Day" value={`Rs. ${Math.round(highestRevAmt).toLocaleString()}`} icon="🏆" color="from-yellow-500 to-amber-600" subtitle={highestRevDay} />
        </div>

        {/* ══════════════════ 📈 REVENUE TREND MAIN CHART ══════════════════ */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-1">📈 Revenue Trend</h3>
          <p className="text-gray-500 text-xs mb-4">Monthly revenue overview</p>
          {monthlyRevChartData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-12">No revenue data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyRevChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_r} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#fff", fontWeight: "600" }}
                  formatter={v => [`Rs. ${Number(v).toLocaleString()}`, "Revenue"]} />
                <Legend wrapperStyle={{ color: "#9ca3af", fontSize: "12px" }} />
                <Line type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ══════════════════ 📊 REVENUE BY CATEGORY ══════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">📊 Revenue by Category</h3>
            <p className="text-gray-500 text-xs mb-4">Total sales value per product category</p>
            {revByCatData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No category data. Add categories to products.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={revByCatData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label={false}>
                      {revByCatData.map((_, i) => <Cell key={i} fill={CHART_COLORS_R[i % CHART_COLORS_R.length]} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_r} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#fff", fontWeight: "600" }}
                      formatter={v => [`Rs. ${Number(v).toLocaleString()}`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {revByCatData.slice(0, 6).map((entry, i) => {
                    const total = revByCatData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS_R[i % CHART_COLORS_R.length] }} />
                        <span className="text-gray-300 text-xs flex-1 truncate">{entry.name}</span>
                        <span className="text-white text-xs font-semibold">Rs. {entry.value >= 1000 ? (entry.value / 1000).toFixed(0) + "k" : entry.value}</span>
                        <span className="text-gray-500 text-[10px] w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════ 🏆 TOP REVENUE PRODUCTS ══════════════════ */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-4 border-b border-white/[0.07]">
              <h3 className="text-white font-bold text-base">🏆 Top Revenue Products</h3>
            </div>
            {topRevProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No product sales data</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-5 py-2 text-right">Revenue</th>
                    <th className="px-5 py-2 text-right">Qty Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {topRevProducts.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-5 py-3 text-white font-semibold truncate max-w-[180px]">{p.name}</td>
                      <td className="px-5 py-3 text-amber-400 font-bold text-right">Rs. {p.revenue.toLocaleString()}</td>
                      <td className="px-5 py-3 text-gray-300 text-right">{p.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ══════════════════ 👥 TOP REVENUE CUSTOMERS ══════════════════ */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-base">👥 Top Revenue Customers</h3>
          </div>
          {topRevCustomers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">No customer data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                  <th className="px-5 py-2 text-left">#</th>
                  <th className="px-5 py-2 text-left">Customer</th>
                  <th className="px-5 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topRevCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-5 py-3 text-white font-semibold">{c.name}</td>
                    <td className="px-5 py-3 text-amber-400 font-bold text-right">Rs. {c.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ══════════════════ 🧾 REVENUE BY INVOICE TYPE ══════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Cash Sales", value: cashRev, icon: "💵", color: "from-green-500 to-emerald-600" },
            { label: "Credit Sales", value: creditRev, icon: "📋", color: "from-orange-500 to-amber-600" },
            { label: "Online Payments", value: onlineRev, icon: "💳", color: "from-blue-500 to-cyan-600" },
            { label: "Bank Transfer", value: bankRev, icon: "🏦", color: "from-purple-500 to-violet-600" },
          ].map((c, i) => (
            <div key={i} className="group relative rounded-xl p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02]" style={cardStyle}>
              <div className={`absolute inset-0 bg-gradient-to-br ${c.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className="relative z-10">
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-white font-bold text-lg">Rs. {Math.round(c.value).toLocaleString()}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.color} opacity-50`} />
            </div>
          ))}
        </div>

        {/* ══════════════════ 📅 REVENUE COMPARISON ══════════════════ */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">📅 Revenue Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Today vs Yesterday", curr: revToday, prev: revYesterday },
              { label: "This Week vs Last Week", curr: revThisWeek, prev: revLastWeek },
              { label: "This Month vs Last Month", curr: revThisMonth, prev: revLastMonth },
              { label: "This Year vs Last Year", curr: revThisYear, prev: revLastYear },
            ].map((row, i) => {
              const pct = Number(growthPct(row.curr, row.prev));
              const isPos = pct >= 0;
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p className="text-gray-400 text-xs font-semibold mb-1">{row.label}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm">Rs. {Math.round(row.curr).toLocaleString()}</span>
                      <span className="text-gray-600 text-xs">vs Rs. {Math.round(row.prev).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex-shrink-0 ${isPos ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {isPos ? "↑" : "↓"} {Math.abs(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════ 🚨 REVENUE INSIGHTS ══════════════════ */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">🚨 Revenue Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: "🏆", label: "Highest Revenue Day", value: `${highestRevDay} — Rs. ${Math.round(highestRevAmt).toLocaleString()}`, color: "#f59e0b" },
              { icon: "📉", label: "Lowest Revenue Day", value: `${lowestRevDay} — Rs. ${Math.round(lowestRevAmt).toLocaleString()}`, color: "#ef4444" },
              { icon: "🏷️", label: "Best Selling Category", value: bestCat, color: "#8b5cf6" },
              { icon: "🚀", label: "Fastest Growing Product", value: fastestGrowing ? `${fastestGrowing.name} (+Rs. ${Math.round(fastestGrowing.growth).toLocaleString()})` : "—", color: "#10b981" },
              { icon: "👑", label: "Top Revenue Customer", value: topRevCust, color: "#06b6d4" },
              { icon: "💰", label: "Total Collected", value: `Rs. ${Math.round(totalCollected).toLocaleString()}`, color: "#34d399" },
            ].map((ins, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ins.color}22`, border: `1px solid ${ins.color}44` }}>
                  {ins.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">{ins.label}</p>
                  <p className="text-white text-sm font-semibold truncate">{ins.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  // const renderSales = () => (
  //   <>
  //     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  //       <StatCard label="Total Sales" value={`Rs. ${totalSales.toLocaleString()}`} icon="💰" color="from-blue-500 to-indigo-600" />
  //       <StatCard label="Sales Count" value={totalSalesCount.toLocaleString()} icon="🧾" color="from-purple-500 to-pink-600" subtitle="invoices" />
  //       <StatCard label="Avg Order Value" value={`Rs. ${Math.round(averageOrderValue).toLocaleString()}`} icon="💳" color="from-pink-500 to-rose-600" />
  //       <StatCard label="Total Items Sold" value={totalProductsSold.toLocaleString()} icon="📦" color="from-green-500 to-emerald-600" subtitle="units" />
  //     </div>
  //     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  //       <CssBarChart data={salesByMonth} title="📈 Sales Trend (Monthly)" color="from-blue-500 to-purple-600" />
  //       <CssDoughnutChart data={salesByCategory} title="🥧 Sales by Category"
  //         colors={["from-blue-500 to-cyan-600","from-purple-500 to-pink-600","from-amber-500 to-orange-600","from-green-500 to-emerald-600"]} />
  //     </div>
  //     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  //       <TopList items={topSellingProducts} title="Top Selling Products" icon="🏆" valuePrefix="" />
  //       <TopList items={leastSellingProducts} title="Least Selling Products" icon="📉" valuePrefix="" />
  //     </div>
  //   </>
  // );

  const renderInventory = () => {
    const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];
    const movementData = getStockMovement(invMoveDays);
    const slowMoving30 = getSlowMoving(30);
    const slowMoving60 = getSlowMoving(60);
    const slowMoving90 = getSlowMoving(90);

    const tooltipStyle = {
      background: "rgba(15,15,25,0.97)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#fff",
      fontSize: "12px",
    };

    return (
      <>
        {/* ===== KPI CARDS ROW 1 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Products" value={totalProducts.toLocaleString()} icon="📦" color="from-indigo-500 to-blue-600" subtitle="active items" />
          <StatCard label="Total Stock Units" value={totalStockUnits.toLocaleString()} icon="📦" color="from-blue-500 to-cyan-600" subtitle="units in stock" />
          <StatCard label="Inventory Value (Cost)" value={`Rs. ${Math.round(totalInventoryCostValue).toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" subtitle="at cost price" />
          <StatCard label="Potential Sales Value" value={`Rs. ${Math.round(totalPotentialSalesValue).toLocaleString()}`} icon="💵" color="from-green-500 to-emerald-600" subtitle="at selling price" />
        </div>

        {/* ===== KPI CARDS ROW 2 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Potential Profit" value={`Rs. ${Math.round(totalPotentialProfit).toLocaleString()}`} icon="📈" color={totalPotentialProfit >= 0 ? "from-green-500 to-teal-600" : "from-red-500 to-rose-600"} subtitle="if all stock sold" />
          <StatCard label="Low Stock Products" value={lowStockItems.length.toLocaleString()} icon="⚠️" color="from-yellow-500 to-amber-600" subtitle={`threshold ≤ 10`} />
          <StatCard label="Out of Stock" value={outOfStockProducts.length.toLocaleString()} icon="❌" color="from-red-500 to-rose-600" subtitle="need restocking" />
          <StatCard label="Recently Added" value={recentlyAddedProducts.length.toLocaleString()} icon="🆕" color="from-purple-500 to-pink-600" subtitle="last 30 days" />
        </div>

        {/* ===== CHARTS ROW 1: Pie + Bar ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Stock by Category — Donut with clean legend */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">🥧 Stock by Category</h3>
            <p className="text-gray-500 text-xs mb-3">Units in stock per category</p>
            {stockByCategoryData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No category data</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stockByCategoryData}
                      cx="50%" cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      color="white !important"
                      dataKey="value"
                      nameKey="name"
                      label={false}
                    >
                      {stockByCategoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "#e5e7eb" }}
                      labelStyle={{ color: "#fff", fontWeight: "600" }}
                      formatter={(v, name) => [`${v} units`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom legend rows */}
                <div className="space-y-2">
                  {stockByCategoryData.map((entry, i) => {
                    const total = stockByCategoryData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-gray-300 text-xs flex-1 truncate">{entry.name}</span>
                        <span className="text-white text-xs font-semibold">{entry.value}</span>
                        <span className="text-gray-500 text-[10px] w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Inventory Value by Category — Horizontal bar chart */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">💰 Inventory Value by Category</h3>
            <p className="text-gray-500 text-xs mb-3">Capital invested per category (cost price)</p>
            {invValueByCategoryData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No data — set cost prices on products</p>
            ) : (
              <ResponsiveContainer width="100%" height={invValueByCategoryData.length * 44 + 20}>
                <BarChart
                  data={invValueByCategoryData}
                  layout="vertical"
                  margin={{ top: 0, right: 45, left: 0, bottom: 0 }}
                  barCategoryGap="20%"
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fill: "#9ca3af", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#e5e7eb" }}
                    labelStyle={{ color: "#fff", fontWeight: "600" }}
                    formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, "Value"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {invValueByCategoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => `Rs. ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                      style={{ fill: "#9ca3af", fontSize: 9 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ===== STOCK MOVEMENT TREND LINE CHART ===== */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-white font-bold text-base">📈 Stock Movement Trend</h3>
            <div className="flex gap-2">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setInvMoveDays(d)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: invMoveDays === d ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${invMoveDays === d ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                    color: invMoveDays === d ? "#fff" : "#9ca3af",
                  }}>
                  {d} Days
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={movementData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} interval={invMoveDays <= 7 ? 0 : Math.floor(movementData.length / 6)} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={tooltipStyle} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#fff", fontWeight: "600" }} />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: "12px" }} />
              <Line type="monotone" dataKey="added" stroke="#10b981" strokeWidth={2} dot={false} name="Stock Added" />
              <Line type="monotone" dataKey="sold" stroke="#f59e0b" strokeWidth={2} dot={false} name="Stock Sold" />
              <Line type="monotone" dataKey="returned" stroke="#6366f1" strokeWidth={2} dot={false} name="Returned" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ===== TOP SELLING + SLOW MOVING ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Selling */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-white/[0.07]">
              <h3 className="text-white font-bold text-base">🏆 Top Selling Products</h3>
            </div>
            {topSellingInvProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No sales data</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-5 py-2 text-right">Units Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingInvProducts.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                      <td className="px-5 py-2.5 text-gray-500 text-sm">{i + 1}</td>
                      <td className="px-5 py-2.5 text-white text-sm font-semibold truncate max-w-[180px]">{p.name}</td>
                      <td className="px-5 py-2.5 text-amber-400 text-sm font-bold text-right">{p.sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Slow Moving */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-white/[0.07]">
              <h3 className="text-white font-bold text-base">🐢 Slow Moving Products</h3>
            </div>
            <div className="flex border-b border-white/[0.07]">
              {[30, 60, 90].map(d => (
                <button key={d}
                  onClick={() => { }}
                  className="flex-1 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors">
                  Not sold in {d}d
                </button>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
              {[...new Map([...slowMoving30, ...slowMoving60, ...slowMoving90].map(p => [p.id, p])).values()].slice(0, 10).map(p => {
                const d30 = slowMoving30.some(x => x.id === p.id);
                const d60 = slowMoving60.some(x => x.id === p.id);
                const d90 = slowMoving90.some(x => x.id === p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-white/[0.025]">
                    <span className="text-white text-sm truncate max-w-[160px]">{p.name}</span>
                    <div className="flex gap-1">
                      {d30 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400">30d</span>}
                      {d60 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">60d</span>}
                      {d90 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">90d</span>}
                    </div>
                  </div>
                );
              })}
              {slowMoving30.length === 0 && slowMoving60.length === 0 && slowMoving90.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">All products sold recently ✅</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== LOW STOCK + OUT OF STOCK REPORTS ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Low Stock */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-yellow-500/20 flex items-center gap-2">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <h3 className="text-white font-bold text-base">Low Stock Report</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">{lowStockItems.length}</span>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">All items well stocked ✅</p>
            ) : (
              <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                <div className="grid px-5 py-2 text-[10px] uppercase tracking-widest text-gray-600" style={{ gridTemplateColumns: "1fr auto auto" }}>
                  <span>Product</span><span className="text-right mr-4">Stock</span><span className="text-right">Threshold</span>
                </div>
                {lowStockItems.map(p => {
                  const stock = getProductStock(p);
                  const threshold = parseInt(p.lowStockThreshold) || 10;
                  return (
                    <div key={p.id} className="grid px-5 py-2.5 hover:bg-yellow-500/5 items-center" style={{ gridTemplateColumns: "1fr auto auto" }}>
                      <span className="text-white text-sm truncate max-w-[160px]">{p.name}</span>
                      <span className="text-yellow-400 font-bold text-sm mr-4 text-right">{stock}</span>
                      <span className="text-gray-500 text-xs text-right">/{threshold}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Out of Stock */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-red-500/20 flex items-center gap-2">
              <span className="text-red-400 text-lg">❌</span>
              <h3 className="text-white font-bold text-base">Out of Stock Report</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">{outOfStockProducts.length}</span>
            </div>
            {outOfStockProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No stock issues ✅</p>
            ) : (
              <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                {outOfStockProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-red-500/5">
                    <span className="text-red-400">•</span>
                    <span className="text-white text-sm flex-1 truncate">{p.name}</span>
                    <span className="text-red-400 font-bold text-xs">0 units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== MOST PROFITABLE + HIGHEST VALUE ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Most Profitable */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-white/[0.07]">
              <h3 className="text-white font-bold text-base">💎 Most Profitable Products</h3>
              <p className="text-gray-500 text-xs mt-0.5">Based on sales in selected period</p>
            </div>
            {mostProfitableInvProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No profit data yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-5 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {mostProfitableInvProducts.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                      <td className="px-5 py-2.5 text-gray-500 text-sm">{i + 1}</td>
                      <td className="px-5 py-2.5 text-white text-sm font-semibold truncate max-w-[150px]">{p.name}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className={`text-sm font-bold ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                          Rs. {Math.round(p.profit).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Highest Inventory Value */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-white/[0.07]">
              <h3 className="text-white font-bold text-base">💼 Highest Inventory Value</h3>
              <p className="text-gray-500 text-xs mt-0.5">Products with most capital invested</p>
            </div>
            {highestInvValueProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">Set cost prices to see this</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-5 py-2 text-left">Product</th>
                    <th className="px-5 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {highestInvValueProducts.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                      <td className="px-5 py-2.5 text-gray-500 text-sm">{i + 1}</td>
                      <td className="px-5 py-2.5 text-white text-sm font-semibold truncate max-w-[150px]">{p.name}</td>
                      <td className="px-5 py-2.5 text-amber-400 text-sm font-bold text-right">Rs. {Math.round(p.value).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ===== STOCK AGING ===== */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-base">⏳ Stock Aging</h3>
            <p className="text-gray-500 text-xs mt-0.5">Based on product creation date in inventory</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Aging bar chart */}
            <div className="p-5 border-r border-white/[0.05]">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={invAgingData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={tooltipStyle} itemStyle={{ color: "#e5e7eb" }} labelStyle={{ color: "#fff", fontWeight: "600" }} formatter={(v) => [`${v} units`, "Stock"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Aging breakdown */}
            <div className="p-5 space-y-3">
              {[
                { label: "0–30 Days", key: "0–30 Days", color: "text-green-400", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", emoji: "🟢" },
                { label: "31–90 Days", key: "31–90 Days", color: "text-yellow-400", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", emoji: "🟡" },
                { label: "90+ Days (Old)", key: "90+ Days", color: "text-red-400", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", emoji: "🔴" },
              ].map(b => (
                <div key={b.key} className="rounded-lg p-3" style={{ background: b.bg, border: `1px solid ${b.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-semibold">{b.emoji} {b.label}</span>
                    <span className={`${b.color} font-bold text-sm`}>{invAgingBuckets[b.key]} units</span>
                  </div>
                  <p className="text-gray-600 text-xs">{invAgingProducts[b.key].length} product{invAgingProducts[b.key].length !== 1 ? "s" : ""}</p>
                  {b.key === "90+ Days" && invAgingProducts[b.key].length > 0 && (
                    <p className="text-red-400 text-xs mt-1">⚠️ Consider discounting or clearing old stock</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== REPORTS SECTION ===== */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-lg">📋 Inventory Reports</h3>
            <p className="text-gray-500 text-xs mt-0.5">Detailed reports for analysis and decision-making</p>
          </div>
          {/* Report tabs */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-white/[0.07]">
            {[
              { id: "valuation", label: "📊 Valuation" },
              { id: "profitability", label: "💹 Profitability" },
              { id: "lowstock", label: "⚠️ Low Stock" },
              { id: "outofstock", label: "❌ Out of Stock" },
              { id: "deadstock", label: "💀 Dead Stock" },
              { id: "category", label: "🗂️ Category" },
            ].map(t => (
              <button key={t.id} onClick={() => setInvReportTab(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: invReportTab === t.id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${invReportTab === t.id ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                  color: invReportTab === t.id ? "#fff" : "#9ca3af",
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {/* Inventory Valuation Report */}
            {invReportTab === "valuation" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">Complete inventory valuation at cost and selling price.</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <p className="text-indigo-400 text-xs mb-1">Total Products</p>
                    <p className="text-white font-bold">{totalProducts}</p>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-amber-400 text-xs mb-1">Cost Value</p>
                    <p className="text-white font-bold text-sm">Rs. {Math.round(totalInventoryCostValue).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p className="text-green-400 text-xs mb-1">Sales Value</p>
                    <p className="text-white font-bold text-sm">Rs. {Math.round(totalPotentialSalesValue).toLocaleString()}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                        <th className="py-2 text-left">Product</th>
                        <th className="py-2 text-right">Stock</th>
                        <th className="py-2 text-right">Cost/Unit</th>
                        <th className="py-2 text-right">Sell/Unit</th>
                        <th className="py-2 text-right">Total Cost</th>
                        <th className="py-2 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeProducts.slice(0, 20).map(p => {
                        const stock = getProductStock(p);
                        const cost = getProductCostPrice(p);
                        const sell = getProductPrice(p);
                        return (
                          <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                            <td className="py-2.5 text-white font-semibold truncate max-w-[140px]">{p.name}</td>
                            <td className="py-2.5 text-gray-400 text-right">{stock}</td>
                            <td className="py-2.5 text-gray-400 text-right">Rs. {cost.toLocaleString()}</td>
                            <td className="py-2.5 text-gray-400 text-right">Rs. {sell.toLocaleString()}</td>
                            <td className="py-2.5 text-amber-400 text-right">Rs. {(stock * cost).toLocaleString()}</td>
                            <td className="py-2.5 text-green-400 text-right">Rs. {(stock * sell).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {activeProducts.length > 20 && <p className="text-gray-600 text-xs text-center mt-3">Showing 20 of {activeProducts.length} products</p>}
                </div>
              </div>
            )}

            {/* Product Profitability Report */}
            {invReportTab === "profitability" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">Profit breakdown per product from sales in the selected period.</p>
                {Object.values(profitByProduct).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No inventory-linked sales data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                          <th className="py-2 text-left">Product</th>
                          <th className="py-2 text-right">Qty Sold</th>
                          <th className="py-2 text-right">Revenue</th>
                          <th className="py-2 text-right">Cost</th>
                          <th className="py-2 text-right">Profit</th>
                          <th className="py-2 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(profitByProduct).sort((a, b) => b.profit - a.profit).map((p, i) => {
                          const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                              <td className="py-2.5 text-white font-semibold truncate max-w-[130px]">{p.name}</td>
                              <td className="py-2.5 text-gray-400 text-right">{p.qty.toFixed(p.qty % 1 !== 0 ? 1 : 0)}</td>
                              <td className="py-2.5 text-amber-400 text-right">Rs. {Math.round(p.revenue).toLocaleString()}</td>
                              <td className="py-2.5 text-red-400 text-right">Rs. {Math.round(p.cost).toLocaleString()}</td>
                              <td className={`py-2.5 text-right font-bold ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.profit >= 0 ? "+" : ""}Rs. {Math.round(p.profit).toLocaleString()}
                              </td>
                              <td className={`py-2.5 text-right text-xs font-semibold ${parseFloat(margin) >= 20 ? "text-green-400" : parseFloat(margin) >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                                {margin}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Low Stock Report */}
            {invReportTab === "lowstock" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">{lowStockItems.length} product(s) below reorder threshold.</p>
                {lowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">All products well stocked ✅</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                        <th className="py-2 text-left">Product</th>
                        <th className="py-2 text-right">Current Stock</th>
                        <th className="py-2 text-right">Threshold</th>
                        <th className="py-2 text-right">Deficit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map(p => {
                        const stock = getProductStock(p);
                        const threshold = parseInt(p.lowStockThreshold) || 10;
                        return (
                          <tr key={p.id} className="border-b border-white/[0.04] hover:bg-yellow-500/5">
                            <td className="py-2.5 text-white font-semibold">{p.name}</td>
                            <td className="py-2.5 text-yellow-400 font-bold text-right">{stock}</td>
                            <td className="py-2.5 text-gray-400 text-right">{threshold}</td>
                            <td className="py-2.5 text-red-400 text-right">-{threshold - stock}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Out of Stock Report */}
            {invReportTab === "outofstock" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">{outOfStockProducts.length} product(s) have zero stock.</p>
                {outOfStockProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No stock issues ✅</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                        <th className="py-2 text-left">Product</th>
                        <th className="py-2 text-right">Category</th>
                        <th className="py-2 text-right">Last Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outOfStockProducts.map(p => (
                        <tr key={p.id} className="border-b border-white/[0.04] hover:bg-red-500/5">
                          <td className="py-2.5 text-white font-semibold">{p.name}</td>
                          <td className="py-2.5 text-gray-400 text-right">{p.category || "—"}</td>
                          <td className="py-2.5 text-amber-400 text-right">Rs. {getProductPrice(p).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Dead Stock Report */}
            {invReportTab === "deadstock" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">
                  Products where less than 20% of stock sold in 90 days — high remaining stock, low turnover.
                </p>
                {slowMoving90.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No dead stock found ✅</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                        <th className="py-2 text-left">Product</th>
                        <th className="py-2 text-right">Remaining</th>
                        <th className="py-2 text-right">Sold (90d)</th>
                        <th className="py-2 text-right">Sold %</th>
                        <th className="py-2 text-right">Value Locked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowMoving90.slice(0, 20).map(p => {
                        const stock = p.currentStock;
                        const sold = p.soldInWindow;
                        const total = stock + sold;
                        const pct = total > 0 ? ((sold / total) * 100).toFixed(0) : 0;
                        const value = stock * getProductCostPrice(p);
                        return (
                          <tr key={p.id} className="border-b border-white/[0.04] hover:bg-red-500/5">
                            <td className="py-2.5 text-white font-semibold truncate max-w-[140px]">{p.name}</td>
                            <td className="py-2.5 text-gray-300 text-right font-semibold">{stock}</td>
                            <td className="py-2.5 text-amber-400 text-right">{sold}</td>
                            <td className="py-2.5 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${Number(pct) === 0
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-orange-500/20 text-orange-400"
                                }`}>{pct}% sold</span>
                            </td>
                            <td className="py-2.5 text-red-400 text-right">Rs. {Math.round(value).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Category Performance Report */}
            {invReportTab === "category" && (
              <div>
                <p className="text-gray-400 text-xs mb-3">Performance breakdown by product category.</p>
                {Object.keys(stockByCategory).length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No category data. Add categories to products.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.07]">
                        <th className="py-2 text-left">Category</th>
                        <th className="py-2 text-right">Products</th>
                        <th className="py-2 text-right">Total Stock</th>
                        <th className="py-2 text-right">Cost Value</th>
                        <th className="py-2 text-right">Sales Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stockByCategory).sort((a, b) => b[1] - a[1]).map(([cat, stock]) => {
                        const prods = activeProducts.filter(p => (p.category || "Uncategorized") === cat);
                        const costVal = prods.reduce((s, p) => s + getProductStock(p) * getProductCostPrice(p), 0);
                        const sellVal = prods.reduce((s, p) => s + getProductStock(p) * getProductPrice(p), 0);
                        return (
                          <tr key={cat} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                            <td className="py-2.5 text-white font-semibold">{cat}</td>
                            <td className="py-2.5 text-gray-400 text-right">{prods.length}</td>
                            <td className="py-2.5 text-blue-400 text-right">{stock}</td>
                            <td className="py-2.5 text-amber-400 text-right">Rs. {Math.round(costVal).toLocaleString()}</td>
                            <td className="py-2.5 text-green-400 text-right">Rs. {Math.round(sellVal).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

      </>
    );
  };

  const renderCustomer = () => {
    // ── Customer-only data (no invoice-less data) ──────────────────────────
    const CHART_COLORS_C = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];
    const ttStyle = {
      background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px", color: "#fff", fontSize: "12px",
    };
    const ttItem = { color: "#e5e7eb" };
    const ttLabel = { color: "#fff", fontWeight: "600" };

    const now = new Date();

    // Per-customer invoice aggregation — only active customers, only active invoices
    const custMap = {}; // customerId → { name, revenue, orders, balance, lastDate, invoices[] }
    customers.forEach(c => {
      // customers state already has only active (non-deleted) customers
      custMap[c.id] = { id: c.id, name: c.name, city: c.city || "", revenue: 0, orders: 0, balance: 0, lastDate: null, invoices: [] };
    });

    // Build returns lookup per invoice for accurate balance
    const returnsPerInv = {};
    payments.forEach(p => {
      if (p.type === "return" && p.invoiceId && Number(p.returnAmount) > 0) {
        returnsPerInv[p.invoiceId] = (returnsPerInv[p.invoiceId] || 0) + Number(p.returnAmount);
      }
    });

    invoices.forEach(inv => {
      if (inv.deleted) return;                         // skip soft-deleted invoices
      if (!inv.customerId) return;                     // skip direct invoices
      if (!custMap[inv.customerId]) return;            // skip deleted customers

      const c = custMap[inv.customerId];

      // Revenue: actual sold amount minus returns
      const returned = returnsPerInv[inv.id] || 0;
      const actualAmt = getInvActualAmount(inv);       // already returns-aware
      c.revenue += actualAmt;

      // Balance: actual unpaid balance (no prev-balance inflation)
      const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
      const actualInvAmt = inv.actualAmount != null
        ? Number(inv.actualAmount)
        : (inv.items || []).filter(it => !isPrevBalItem(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
      const invReturns = returnsPerInv[inv.id] || 0;
      const actualBalance = Math.max(0, actualInvAmt - (Number(inv.amountPaid) || 0) - invReturns);
      c.balance += actualBalance;

      c.orders += 1;
      const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      if (!c.lastDate || d > c.lastDate) c.lastDate = d;
      c.invoices.push(inv);
    });
    const custList = Object.values(custMap);

    // ── KPI helpers ────────────────────────────────────────────────────────
    const totalCust = customers.length;

    // New customers this month
    const newCustThisMonth = customers.filter(c => {
      if (!c.createdAt) return false;
      const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Active = purchased in last 30 days
    const active30 = custList.filter(c => c.lastDate && (now - c.lastDate) <= 30 * 86400000).length;
    const inactive = totalCust - active30;

    // Total revenue from customers (invoices that have a customerId)
    const totalCustRevenue = custList.reduce((s, c) => s + c.revenue, 0);

    // Outstanding receivables
    const totalOutstanding = custList.reduce((s, c) => s + c.balance, 0);

    // Average order value
    const totalCustOrders = custList.reduce((s, c) => s + c.orders, 0);
    const avgOrderVal = totalCustOrders > 0 ? totalCustRevenue / totalCustOrders : 0;

    // Repeat customer rate (customers with >1 order)
    const repeatCust = custList.filter(c => c.orders > 1).length;
    const repeatRate = totalCust > 0 ? ((repeatCust / totalCust) * 100).toFixed(0) : 0;

    // ── Chart 1: Customer Growth ───────────────────────────────────────────
    const growthBucketsM = {};
    customers.forEach(c => {
      if (!c.createdAt) return;
      const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      growthBucketsM[key] = (growthBucketsM[key] || 0) + 1;
    });
    const growthData = Object.entries(growthBucketsM)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));

    // ── Chart 2: Revenue by Customer (top 10) ─────────────────────────────
    const revByCust = custList
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(c => ({ name: c.name.split(" ")[0], fullName: c.name, value: Math.round(c.revenue) }));

    // ── Chart 3: Customer Segmentation ────────────────────────────────────
    // VIP: top 20% by revenue, Regular: 21-60%, New: 0 orders or <30days, Inactive: no order 90+days
    const sorted90 = [...custList].sort((a, b) => b.revenue - a.revenue);
    const vipCount = Math.max(1, Math.round(totalCust * 0.2));
    const vipIds = new Set(sorted90.slice(0, vipCount).map(c => c.id));
    const newIds = new Set(customers.filter(c => {
      if (!c.createdAt) return false;
      const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return (now - d) <= 30 * 86400000;
    }).map(c => c.id));
    const inactiveIds = new Set(custList.filter(c => !c.lastDate || (now - c.lastDate) > 90 * 86400000).map(c => c.id));

    let vipN = 0, regularN = 0, newN = 0, inactiveN = 0;
    custList.forEach(c => {
      if (inactiveIds.has(c.id)) inactiveN++;
      else if (newIds.has(c.id)) newN++;
      else if (vipIds.has(c.id)) vipN++;
      else regularN++;
    });
    const segData = [
      { name: "VIP", value: vipN, color: "#f59e0b" },
      { name: "Regular", value: regularN, color: "#6366f1" },
      { name: "New", value: newN, color: "#10b981" },
      { name: "Inactive", value: inactiveN, color: "#ef4444" },
    ].filter(s => s.value > 0);

    // ── Chart 4: Monthly Revenue Trend from customers ─────────────────────
    const monthRevData = {};
    invoices.forEach(inv => {
      if (!inv.customerId || !inv.createdAt) return;
      const d = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthRevData[key] = (monthRevData[key] || 0) + (Number(inv.amount) || 0);
    });
    const monthRevChart = Object.entries(monthRevData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([name, value]) => ({ name: name.slice(5), value: Math.round(value) }));

    // ── Chart 5: Payment Status Pie ────────────────────────────────────────
    const custInvoices = invoices.filter(inv => inv.customerId);
    const paidN = custInvoices.filter(i => i.status === "Paid").length;
    const partialN = custInvoices.filter(i => i.status === "Partial").length;
    const unpaidN = custInvoices.filter(i => i.status === "Unpaid").length;
    const overdueN = custInvoices.filter(i => {
      if ((i.status === "Unpaid" || i.status === "Partial") && i.dueDate) return new Date(i.dueDate) < now;
      return false;
    }).length;
    const payStatusData = [
      { name: "Paid", value: paidN, color: "#10b981" },
      { name: "Partially Paid", value: partialN, color: "#f59e0b" },
      { name: "Unpaid", value: unpaidN, color: "#ef4444" },
      { name: "Overdue", value: overdueN, color: "#8b5cf6" },
    ].filter(s => s.value > 0);

    // ── Chart 6: Customer by City ──────────────────────────────────────────
    const cityMap = {};
    customers.forEach(c => {
      const city = (c.city || "").trim() || "Unknown";
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const cityData = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
    const hasCityData = cityData.some(c => c.name !== "Unknown");

    // ── Chart 8: Most Purchased Products (from customer invoices) ─────────
    const prodSales = {};
    custInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const name = item.productName || item.description || "Unknown";
        if (name.startsWith("Previous Balance")) return;
        const qty = Number(item.qty) || Number(item.quantity) || 0;
        prodSales[name] = (prodSales[name] || 0) + qty;
      });
    });
    const topProducts = Object.entries(prodSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, value }));

    // ── Customer Activity buckets ──────────────────────────────────────────
    const actWeek = custList.filter(c => c.lastDate && (now - c.lastDate) <= 7 * 86400000).length;
    const actMonth = custList.filter(c => c.lastDate && (now - c.lastDate) <= 30 * 86400000).length;
    const no30 = custList.filter(c => !c.lastDate || (now - c.lastDate) > 30 * 86400000).length;
    const no90 = custList.filter(c => !c.lastDate || (now - c.lastDate) > 90 * 86400000).length;

    // ── Outstanding balance report ─────────────────────────────────────────
    const outstandingList = custList
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    // ── Quick Insights ─────────────────────────────────────────────────────
    const highestSpender = [...custList].sort((a, b) => b.revenue - a.revenue)[0];
    const mostActive = [...custList].sort((a, b) => b.orders - a.orders)[0];
    const highestBalance = [...custList].sort((a, b) => b.balance - a.balance)[0];
    const inactive90List = custList.filter(c => !c.lastDate || (now - c.lastDate) > 90 * 86400000);

    return (
      <>
        {/* ===== KPI CARDS ROW 1 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Customers" value={totalCust.toLocaleString()} icon="👥" color="from-cyan-500 to-blue-600" />
          <StatCard label="New This Month" value={newCustThisMonth.toLocaleString()} icon="🆕" color="from-green-500 to-emerald-600" subtitle="added this month" />
          <StatCard label="Active Customers" value={active30.toLocaleString()} icon="🟢" color="from-teal-500 to-cyan-600" subtitle="purchased in 30d" />
          <StatCard label="Inactive Customers" value={inactive.toLocaleString()} icon="🔴" color="from-red-500 to-rose-600" subtitle="no purchase 30d+" />
        </div>

        {/* ===== KPI CARDS ROW 2 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Customer Revenue" value={`Rs. ${Math.round(totalCustRevenue).toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" />
          <StatCard label="Outstanding Receivables" value={`Rs. ${Math.round(totalOutstanding).toLocaleString()}`} icon="💳" color="from-red-500 to-pink-600" subtitle="unpaid balance" />
          {/* <StatCard label="Avg Order Value"         value={`Rs. ${Math.round(avgOrderVal).toLocaleString()}`}    icon="📄" color="from-purple-500 to-indigo-600" subtitle="per invoice" /> */}
          <StatCard label="Repeat Customer Rate" value={`${repeatRate}%`} icon="⭐" color="from-yellow-500 to-amber-600" subtitle={`${repeatCust} repeat buyers`} />
          <StatCard
            label="Total Collected"
            value={`Rs. ${Math.round(totalCustRevenue - totalOutstanding).toLocaleString()}`}
            icon="✅"
            color="from-green-500 to-emerald-600"
            subtitle="received so far"
          />
        </div>

        {/* ===== KPI CARDS ROW 3 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* <StatCard
            label="Total Receivables"
            value={`Rs. ${Math.round(totalOutstanding).toLocaleString()}`}
            icon="🧾"
            color="from-rose-500 to-red-600"
            subtitle={`${outstandingList.length} customer${outstandingList.length !== 1 ? "s" : ""} have balance`}
          /> */}

          <StatCard
            label="Collection Rate"
            value={`${totalCustRevenue > 0 ? (((totalCustRevenue - totalOutstanding) / totalCustRevenue) * 100).toFixed(1) : 0}%`}
            icon="📊"
            color="from-blue-500 to-cyan-600"
            subtitle="of total revenue collected"
          />
          <StatCard
            label="Highest Balance"
            value={highestBalance?.balance > 0 ? `Rs. ${Math.round(highestBalance.balance).toLocaleString()}` : "None"}
            icon="⚠️"
            color="from-orange-500 to-amber-600"
            subtitle={highestBalance?.balance > 0 ? highestBalance.name : "All cleared"}
          />
        </div>

        {/* ===== CHART ROW 1: Growth + Revenue by Customer ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Customer Growth Line Chart */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-1">📈 Customer Growth</h3>
            <p className="text-gray-500 text-xs mb-4">New customers added over time</p>
            {growthData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle} itemStyle={ttItem} labelStyle={ttLabel} formatter={(v) => [v, "New Customers"]} />
                  <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 4 }} activeDot={{ r: 6 }} name="New Customers" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue by Customer Horizontal Bar */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">💰 Revenue by Customer</h3>
            <p className="text-gray-500 text-xs mb-4">Top 10 customers by total purchases</p>
            {revByCust.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No customer invoices yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={revByCust.length * 36 + 20}>
                <BarChart data={revByCust} layout="vertical" margin={{ top: 0, right: 45, left: 0, bottom: 0 }} barCategoryGap="15%">
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={60}
                    tick={{ fill: "#9ca3af", fontSize: 9 }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    cursor={{ fill: "rgba(255,255,255,0.04)" }} 
                    contentStyle={ttStyle} 
                    itemStyle={ttItem} 
                    labelStyle={ttLabel}
                    formatter={(v, _, props) => [`Rs. ${Number(v).toLocaleString()}`, props.payload.fullName]} 
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {revByCust.map((_, i) => <Cell key={i} fill={CHART_COLORS_C[i % CHART_COLORS_C.length]} />)}
                    <LabelList 
                      dataKey="value" 
                      position="right"
                      formatter={(v) => `${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                      style={{ fill: "#9ca3af", fontSize: 9 }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ===== CHART ROW 2: Segmentation Pie + Monthly Revenue Trend ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Customer Segmentation Donut */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">🎯 Customer Segmentation</h3>
            <p className="text-gray-500 text-xs mb-3">Based on activity and spending</p>
            {segData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No customers yet</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={segData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label={false}>
                      {segData.map((s, i) => <Cell key={i} fill={s.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle} itemStyle={ttItem} labelStyle={ttLabel} formatter={(v, name) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {segData.map(s => {
                    const pct = totalCust > 0 ? ((s.value / totalCust) * 100).toFixed(0) : 0;
                    return (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-gray-300 text-xs flex-1">{s.name}</span>
                        <span className="text-white text-xs font-semibold">{s.value}</span>
                        <span className="text-gray-500 text-[10px] w-9 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Revenue Trend Line */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">📅 Monthly Revenue Trend</h3>
            <p className="text-gray-500 text-xs mb-4">Revenue from customers month by month</p>
            {monthRevChart.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No revenue data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthRevChart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 8 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 8 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle} itemStyle={ttItem} labelStyle={ttLabel} formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, "Revenue"]} />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ===== CHART ROW 3: Payment Status + City Distribution ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Payment Status Pie */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">💳 Payment Status</h3>
            <p className="text-gray-500 text-xs mb-3">Invoice payment breakdown for customers</p>
            {payStatusData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No customer invoices</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={payStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label={false}>
                      {payStatusData.map((s, i) => <Cell key={i} fill={s.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle} itemStyle={ttItem} labelStyle={ttLabel} formatter={(v, name) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {payStatusData.map(s => {
                    const total = payStatusData.reduce((a, b) => a + b.value, 0);
                    const pct = total > 0 ? ((s.value / total) * 100).toFixed(0) : 0;
                    return (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-gray-300 text-xs flex-1">{s.name}</span>
                        <span className="text-white text-xs font-semibold">{s.value}</span>
                        <span className="text-gray-500 text-[10px] w-9 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Customer by City */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-1">🌍 Customer Location</h3>
            <p className="text-gray-500 text-xs mb-4">Customers by city</p>
            {!hasCityData ? (
              <p className="text-gray-500 text-sm text-center py-10">No city data — add city when creating customers</p>
            ) : (
              <div className="space-y-2.5">
                {cityData.filter(c => c.name !== "Unknown").slice(0, 8).map((c, i) => {
                  const pct = totalCust > 0 ? ((c.value / totalCust) * 100).toFixed(0) : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{c.name}</span>
                        <span className="text-white font-semibold">{c.value} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: CHART_COLORS_C[i % CHART_COLORS_C.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== TOP 10 CUSTOMERS TABLE ===== */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-base">🏆 Top 10 Customers</h3>
            <p className="text-gray-500 text-xs mt-0.5">Ranked by total revenue</p>
          </div>
          {custList.filter(c => c.orders > 0).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">No customer purchases yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/[0.05]">
                  <th className="px-5 py-2 text-left">#</th>
                  <th className="px-5 py-2 text-left">Customer</th>
                  <th className="px-5 py-2 text-right">Revenue</th>
                  <th className="px-5 py-2 text-right">Orders</th>
                  <th className="px-5 py-2 text-right">Outstanding</th>
                  <th className="px-5 py-2 text-right">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {[...custList].filter(c => c.orders > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((c, i) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                    <td className="px-5 py-3 text-gray-500 text-sm">{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="text-white font-semibold text-sm truncate max-w-[140px]">{c.name}</p>
                    </td>
                    <td className="px-5 py-3 text-amber-400 font-bold text-right">Rs. {Math.round(c.revenue).toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-300 text-right">{c.orders}</td>
                    <td className="px-5 py-3 text-right">
                      {c.balance > 0
                        ? <span className="text-red-400 font-semibold">Rs. {Math.round(c.balance).toLocaleString()}</span>
                        : <span className="text-green-400 text-xs">✓ Clear</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-right text-xs">
                      {c.lastDate ? c.lastDate.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== MOST PURCHASED PRODUCTS ===== */}
        <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-sm sm:text-base mb-1">🛍️ Most Purchased Products</h3>
          <p className="text-gray-500 text-xs mb-4">Products most frequently bought by customers</p>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No product data</p>
          ) : (
            <ResponsiveContainer width="100%" height={topProducts.length * 38 + 20}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap="15%">
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={80}
                  tick={{ fill: "#9ca3af", fontSize: 9 }} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{ fill: "rgba(255,255,255,0.04)" }} 
                  contentStyle={ttStyle} 
                  itemStyle={ttItem} 
                  labelStyle={ttLabel} 
                  formatter={(v) => [`${v} units`, "Sold"]} 
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS_C[i % CHART_COLORS_C.length]} />)}
                  <LabelList dataKey="value" position="right" style={{ fill: "#9ca3af", fontSize: 9 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ===== CUSTOMER ACTIVITY + OUTSTANDING BALANCE ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Activity Buckets */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">⚡ Customer Activity</h3>
            <div className="space-y-3">
              {[
                { label: "Active This Week", value: actWeek, color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)" },
                { label: "Active This Month", value: actMonth, color: "#06b6d4", bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.25)" },
                { label: "No Purchase in 30 Days", value: no30, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
                { label: "No Purchase in 90 Days", value: no90, color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={{ background: row.bg, border: `1px solid ${row.border}` }}>
                  <span className="text-white text-sm font-medium">{row.label}</span>
                  <span className="text-xl font-black" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outstanding Balance Report */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b border-white/[0.07] flex items-center gap-2">
              <span className="text-red-400">💳</span>
              <h3 className="text-white font-bold text-base">Outstanding Balance Report</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                {outstandingList.length}
              </span>
            </div>
            {outstandingList.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No outstanding balances ✅</p>
            ) : (
              <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
                <div className="grid px-5 py-2 text-[10px] uppercase tracking-widest text-gray-600"
                  style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>Customer</span><span className="text-right">Outstanding</span>
                </div>
                {outstandingList.map(c => (
                  <div key={c.id} className="grid px-5 py-2.5 hover:bg-red-500/5 items-center"
                    style={{ gridTemplateColumns: "1fr auto" }}>
                    <div>
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-gray-600 text-xs">{c.orders} orders</p>
                    </div>
                    <span className="text-red-400 font-bold text-sm">Rs. {Math.round(c.balance).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== QUICK INSIGHTS ===== */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">💡 Quick Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Highest Spending Customer", icon: "👑",
                value: highestSpender?.name || "—",
                sub: highestSpender ? `Rs. ${Math.round(highestSpender.revenue).toLocaleString()}` : "",
                color: "#f59e0b"
              },
              {
                label: "Most Active Customer", icon: "🔥",
                value: mostActive?.name || "—",
                sub: mostActive ? `${mostActive.orders} orders` : "",
                color: "#10b981"
              },
              {
                label: "Highest Outstanding", icon: "⚠️",
                value: highestBalance?.balance > 0 ? highestBalance.name : "None",
                sub: highestBalance?.balance > 0 ? `Rs. ${Math.round(highestBalance.balance).toLocaleString()}` : "All clear ✅",
                color: "#ef4444"
              },
              {
                label: "Inactive 90+ Days", icon: "😴",
                value: `${inactive90List.length} customers`,
                sub: inactive90List.length > 0 ? "Need re-engagement" : "All active ✅",
                color: "#8b5cf6"
              },
            ].map(ins => (
              <div key={ins.label} className="rounded-lg p-4"
                style={{ background: `rgba(255,255,255,0.03)`, border: `1px solid rgba(255,255,255,0.08)` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{ins.icon}</span>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">{ins.label}</p>
                </div>
                <p className="text-white font-bold text-sm truncate" style={{ color: ins.color }}>{ins.value}</p>
                {ins.sub && <p className="text-gray-600 text-xs mt-0.5">{ins.sub}</p>}
              </div>
            ))}
          </div>
        </div>

      </>
    );
  };

  const renderPayment = () => {
    const now_p = new Date();
    const todayStart_p     = new Date(now_p.getFullYear(), now_p.getMonth(), now_p.getDate());
    const yesterdayStart_p = new Date(todayStart_p); yesterdayStart_p.setDate(yesterdayStart_p.getDate()-1);
    const thisMonthStart_p = new Date(now_p.getFullYear(), now_p.getMonth(), 1);
    const lastMonthStart_p = new Date(now_p.getFullYear(), now_p.getMonth()-1, 1);
    const lastMonthEnd_p   = new Date(now_p.getFullYear(), now_p.getMonth(), 0, 23, 59, 59);
    const thisYearStart_p  = new Date(now_p.getFullYear(), 0, 1);
    const lastYearStart_p  = new Date(now_p.getFullYear()-1, 0, 1);
    const lastYearEnd_p    = new Date(now_p.getFullYear()-1, 11, 31, 23, 59, 59);

    // All received payments — only for active invoices (deleted customers/invoices excluded)
    const recvPayments = payments.filter(p => {
      if (p.type !== "received") return false;
      if (p.invoiceId) return activeInvoiceIds.has(p.invoiceId);
      if (p.customerId) return activeCustomerIds.has(p.customerId);
      return true;
    });
    const pSum  = (arr) => arr.reduce((s,p) => s + (Number(p.paid) || Number(p.amount) || 0), 0);
    const pDate = (p) => p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    const iDate = (i) => i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt || 0);

    // ── Total received: most accurate = sum of amountPaid from all active invoices ──
    const totalRecv = activeInvoices.reduce((s,i) => s + (Number(i.amountPaid) || 0), 0);

    // ── Outstanding: actual balance remaining on active invoices ──
    const returnsPerInv_p = {};
    payments.forEach(p => {
      if (p.type === "return" && p.invoiceId && Number(p.returnAmount) > 0)
        returnsPerInv_p[p.invoiceId] = (returnsPerInv_p[p.invoiceId] || 0) + Number(p.returnAmount);
    });
    const isPrevBalItem_p = it => (it.description || "").startsWith("Previous Balance · INV-");
    const totalOutstandingP = activeInvoices.reduce((s,i) => {
      if (i.status === "Paid") return s;
      const actualAmt = i.actualAmount != null
        ? Number(i.actualAmount)
        : (i.items || []).filter(it => !isPrevBalItem_p(it))
            .reduce((x,it) => x + (Number(it.qty)||0)*(Number(it.unitPrice)||0), 0);
      const returned = returnsPerInv_p[i.id] || 0;
      const bal = Math.max(0, actualAmt - (Number(i.amountPaid)||0) - returned);
      return s + bal;
    }, 0);

    // ── Date-based: use payments collection for today/month (has timestamps) ──
    // Also include invoice's own amountPaid for invoices with no payment record
    const invoiceIdsWithRecord = new Set(recvPayments.map(p => p.invoiceId).filter(Boolean));
    // For date filters on invoices without records, use invoice createdAt as proxy
    const fallbackInvPayments = activeInvoices
      .filter(i => Number(i.amountPaid) > 0 && !invoiceIdsWithRecord.has(i.id))
      .map(i => ({ paid: Number(i.amountPaid), createdAt: i.createdAt, method: i.paymentMethod || "cash" }));
    const allTimedPayments = [...recvPayments, ...fallbackInvPayments];

    // ── Date-based collections: use invoice createdAt for accuracy ──
    // "This Month Collection" = invoices created this month, sum of their amountPaid
    // This is most accurate because payment records may have wrong timestamps
    const invInMonth = (start, end) => activeInvoices
      .filter(i => { const d = iDate(i); return d >= start && (!end || d <= end); })
      .reduce((s,i) => s + (Number(i.amountPaid)||0), 0);

    const todayRecv     = pSum(allTimedPayments.filter(p => pDate(p) >= todayStart_p));
    const yesterdayRecv = pSum(allTimedPayments.filter(p => pDate(p) >= yesterdayStart_p && pDate(p) < todayStart_p));
    const thisMonthRecv = invInMonth(thisMonthStart_p);
    const lastMonthRecv = invInMonth(lastMonthStart_p, lastMonthEnd_p);
    const thisYearRecv  = invInMonth(thisYearStart_p);
    const lastYearRecv  = invInMonth(lastYearStart_p, lastYearEnd_p);

    // Overdue = unpaid/partial invoices past due date
    const totalOverdueP = activeInvoices.reduce((s,i) => {
      if (i.status === "Paid") return s;
      if (!i.dueDate) return s;
      if (new Date(i.dueDate) >= now_p) return s;
      const actualAmt = i.actualAmount != null
        ? Number(i.actualAmount)
        : (i.items||[]).filter(it=>!isPrevBalItem_p(it))
            .reduce((x,it)=>x+(Number(it.qty)||0)*(Number(it.unitPrice)||0),0);
      const returned = returnsPerInv_p[i.id] || 0;
      return s + Math.max(0, actualAmt - (Number(i.amountPaid)||0) - returned);
    }, 0);

    // Partially paid invoices count
    const partialCount = activeInvoices.filter(i => i.status === "Partial").length;

    // Average payment
    const avgPayment = recvPayments.length > 0 ? totalRecv / recvPayments.length : 0;

    // Collection rate = totalRecv / (totalRecv + totalOutstanding)
    const collectionBase = totalRecv + totalOutstandingP;
    const collectionRate = collectionBase > 0 ? ((totalRecv / collectionBase) * 100).toFixed(1) : 0;

    // Growth helpers
    function growthBadge(curr, prev) {
      if (!prev || prev === 0) return curr > 0 ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">+100%</span> : null;
      const pct = ((curr - prev) / prev * 100).toFixed(1);
      return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(pct)>=0?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>
          {Number(pct)>=0?"↑":"↓"} {Math.abs(pct)}%
        </span>
      );
    }

    // Payment method breakdown from payments collection
    const methodMap = {};
    recvPayments.forEach(p => {
      const m = (p.method || "cash");
      const label = m.charAt(0).toUpperCase() + m.slice(1);
      methodMap[label] = (methodMap[label] || 0) + (Number(p.paid) || Number(p.amount) || 0);
    });

    // Payment status donut
    const paidCount    = activeInvoices.filter(i=>i.status==="Paid").length;
    const unpaidCount  = activeInvoices.filter(i=>i.status==="Unpaid").length;
    const overdueCount = activeInvoices.filter(i=>{
      if(i.status==="Paid") return false;
      if(!i.dueDate) return false;
      return new Date(i.dueDate) < now_p;
    }).length;
    const statusData = [
      { name:"Paid",         value: paidCount,    color:"#10b981" },
      { name:"Partial",      value: partialCount, color:"#f59e0b" },
      { name:"Unpaid",       value: unpaidCount,  color:"#ef4444" },
      { name:"Overdue",      value: overdueCount, color:"#7c3aed" },
    ].filter(d=>d.value>0);

    // Monthly collection trend (last 6 months)
    const monthLabels = [];
    const monthRecvArr = [];
    const monthPrevArr = [];
    for (let i=5; i>=0; i--) {
      const mStart = new Date(now_p.getFullYear(), now_p.getMonth()-i, 1);
      const mEnd   = new Date(now_p.getFullYear(), now_p.getMonth()-i+1, 0, 23,59,59);
      const label  = mStart.toLocaleString("en-US", {month:"short"});
      monthLabels.push(label);
      monthRecvArr.push(pSum(recvPayments.filter(p => { const d=pDate(p); return d>=mStart && d<=mEnd; })));
    }

    // Top paying customers
    const custPayMap = {};
    recvPayments.forEach(p => {
      const name = p.customer || p.customerName || "Direct";
      if (!custPayMap[name]) custPayMap[name] = { paid:0, customerId: p.customerId };
      custPayMap[name].paid += Number(p.paid) || Number(p.amount) || 0;
    });
    // Add invoice amountPaid for invoices without payment records
    activeInvoices.forEach(i => {
      if (Number(i.amountPaid) <= 0) return;
      const hasRecord = recvPayments.some(p => p.invoiceId === i.id);
      if (hasRecord) return;
      const name = i.customerName || i.customer || "Direct";
      if (!custPayMap[name]) custPayMap[name] = { paid:0 };
      custPayMap[name].paid += Number(i.amountPaid);
    });
    const topPayers = Object.entries(custPayMap)
      .sort((a,b)=>b[1].paid - a[1].paid).slice(0,5);

    // Outstanding invoices list
    const outstandingInvList = activeInvoices
      .filter(i => i.status !== "Paid" && Number(i.balance) > 0)
      .sort((a,b) => (Number(b.balance)||0) - (Number(a.balance)||0))
      .slice(0,8);

    // Highest payment day
    const dayMap = {};
    recvPayments.forEach(p => {
      const d = pDate(p);
      const key = d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"});
      dayMap[key] = (dayMap[key]||0) + (Number(p.paid)||Number(p.amount)||0);
    });
    const highestPayDay = Object.entries(dayMap).sort((a,b)=>b[1]-a[1])[0];

    // Largest single payment
    const largestPay = recvPayments.reduce((max,p)=>{ const v=Number(p.paid)||0; return v>max.val?{val:v,p}:max; }, {val:0,p:null});

    // Most overdue customer
    const overdueByCustomer = {};
    activeInvoices.forEach(i=>{
      if(i.status==="Paid"||!i.dueDate) return;
      if(new Date(i.dueDate)>=now_p) return;
      const name=i.customerName||i.customer||"Direct";
      overdueByCustomer[name]=(overdueByCustomer[name]||0)+(Number(i.balance)||0);
    });
    const mostOverdueCust=Object.entries(overdueByCustomer).sort((a,b)=>b[1]-a[1])[0];

    const COLORS_P = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#f97316","#84cc16"];
    const ttStyle_p = { background:"rgba(15,15,25,0.97)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", color:"#fff", fontSize:"12px" };

    return (
      <>
        {/* ══ ROW 1: 8 Summary Cards ══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Payments Received" value={`Rs. ${Math.round(totalRecv).toLocaleString()}`}           icon="💰" color="from-green-500 to-emerald-600" />
          <StatCard label="Today's Collection"       value={`Rs. ${Math.round(todayRecv).toLocaleString()}`}          icon="🌅" color="from-pink-500 to-rose-600"    subtitle={<>{growthBadge(todayRecv,yesterdayRecv)} vs yesterday</>} />
          <StatCard label="This Month Collection"    value={`Rs. ${Math.round(thisMonthRecv).toLocaleString()}`}      icon="📅" color="from-blue-500 to-cyan-600"    subtitle={<>{growthBadge(thisMonthRecv,lastMonthRecv)} vs last month</>} />
          <StatCard label="Outstanding Amount"       value={`Rs. ${Math.round(totalOutstandingP).toLocaleString()}`}  icon="⏳" color="from-orange-500 to-amber-600" subtitle="unpaid balance" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Overdue Amount"           value={`Rs. ${Math.round(totalOverdueP).toLocaleString()}`}      icon="🚨" color="from-red-500 to-rose-600"     subtitle="past due date" />
          <StatCard label="Partially Paid Invoices"  value={partialCount.toLocaleString()}                            icon="📋" color="from-yellow-500 to-amber-600" subtitle="invoices" />
          <StatCard label="Average Payment"          value={`Rs. ${Math.round(avgPayment).toLocaleString()}`}         icon="📊" color="from-purple-500 to-violet-600" subtitle="per transaction" />
          <StatCard label="Collection Rate"          value={`${collectionRate}%`}                                     icon="✅" color="from-teal-500 to-cyan-600"    subtitle="of total billed" />
        </div>

        {/* ══ ROW 2: Trend + Method ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Collection Trend */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-1">📈 Payment Collection Trend</h3>
            <p className="text-gray-500 text-xs mb-4">Monthly payments received (last 6 months)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthLabels.map((m,i)=>({ name:m, received: Math.round(monthRecvArr[i]) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{fill:"#6b7280",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_p} formatter={v=>[`Rs. ${Number(v).toLocaleString()}`,"Received"]}/>
                <Line type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2.5} dot={{fill:"#10b981",r:4}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods Pie */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">💰 Payment Methods</h3>
            <p className="text-gray-500 text-xs mb-4">Which method brings most payments</p>
            {Object.keys(methodMap).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No payment method data yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={Object.entries(methodMap).map(([name,value])=>({name,value}))}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" label={false}>
                      {Object.keys(methodMap).map((_,i)=><Cell key={i} fill={COLORS_P[i%COLORS_P.length]} strokeWidth={0}/>)}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_p} formatter={v=>[`Rs. ${Number(v).toLocaleString()}`]}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {Object.entries(methodMap).sort((a,b)=>b[1]-a[1]).map(([name,val],i)=>{
                    const total=Object.values(methodMap).reduce((s,v)=>s+v,0);
                    const pct=total>0?((val/total)*100).toFixed(1):0;
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:COLORS_P[i%COLORS_P.length]}}/>
                        <span className="text-gray-300 text-xs flex-1">{name}</span>
                        <span className="text-white text-xs font-semibold">Rs. {Math.round(val).toLocaleString()}</span>
                        <span className="text-gray-500 text-xs w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ ROW 3: Top Payers + Outstanding Invoices ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Paying Customers */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">👑 Top Paying Customers</h3>
            {topPayers.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No payment data</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                    <th className="text-left pb-2">Customer</th>
                    <th className="text-right pb-2">Paid Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {topPayers.map(([name,data],i)=>(
                    <tr key={name} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 text-gray-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                          style={{background:COLORS_P[i%COLORS_P.length]+"33",color:COLORS_P[i%COLORS_P.length]}}>
                          {i+1}
                        </span>
                        {name}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-green-400">Rs. {Math.round(data.paid).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Outstanding Invoices */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">📄 Outstanding Invoices</h3>
            {outstandingInvList.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No outstanding invoices ✅</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                    <th className="text-left pb-2">Invoice</th>
                    <th className="text-left pb-2">Customer</th>
                    <th className="text-right pb-2">Pending</th>
                    <th className="text-right pb-2">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {outstandingInvList.map(inv=>{
                    const isOverdue = inv.dueDate && new Date(inv.dueDate) < now_p;
                    return (
                      <tr key={inv.id} className="hover:bg-white/[0.02]">
                        <td className="py-2 text-blue-400 font-mono text-[10px]">INV-{(inv.id||"").slice(-4).toUpperCase()}</td>
                        <td className="py-2 text-gray-300 truncate max-w-[100px]">{inv.customerName||inv.customer||"Direct"}</td>
                        <td className="py-2 text-right font-semibold text-amber-400">Rs. {Math.round(Number(inv.balance)||0).toLocaleString()}</td>
                        <td className={`py-2 text-right text-[10px] ${isOverdue?"text-red-400 font-bold":"text-gray-500"}`}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-PK",{day:"2-digit",month:"short"}) : "—"}
                          {isOverdue && " ⚠️"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ══ ROW 4: Status Donut + Collection Comparison ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Payment Status Donut */}
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">📊 Payment Status</h3>
            <p className="text-gray-500 text-xs mb-4">Invoice status at a glance</p>
            {statusData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No invoice data</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <ResponsiveContainer width="100%" height={160} className="sm:w-40">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" label={false}>
                      {statusData.map((d,i)=><Cell key={i} fill={d.color} strokeWidth={0}/>)}
                    </Pie>
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_p} formatter={(v,n)=>[`${v} invoices`,n]}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 w-full space-y-2">
                  {statusData.map(d=>(
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}}/>
                      <span className="text-gray-300 text-xs flex-1">{d.name}</span>
                      <span className="text-white text-xs font-bold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collection Comparison */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">📅 Collection Comparison</h3>
            <div className="space-y-4">
              {[
                { label:"Today vs Yesterday",     curr:todayRecv,     prev:yesterdayRecv,   currLabel:"Today",      prevLabel:"Yesterday" },
                { label:"This Month vs Last Month",curr:thisMonthRecv, prev:lastMonthRecv,   currLabel:"This Month", prevLabel:"Last Month" },
                { label:"This Year vs Last Year",  curr:thisYearRecv,  prev:lastYearRecv,    currLabel:"This Year",  prevLabel:"Last Year"  },
              ].map(row=>{
                const pct = row.prev>0 ? ((row.curr-row.prev)/row.prev*100).toFixed(1) : (row.curr>0?100:0);
                const isUp = Number(pct) >= 0;
                return (
                  <div key={row.label} className="p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs font-semibold">{row.label}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUp?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>
                        {isUp?"↑":"↓"} {Math.abs(Number(pct))}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500">{row.currLabel}</p>
                        <p className="text-white font-bold text-sm">Rs. {Math.round(row.curr).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">{row.prevLabel}</p>
                        <p className="text-gray-400 font-semibold text-sm">Rs. {Math.round(row.prev).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ ROW 5: Payment Insights ══ */}
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">🚨 Payment Insights</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon:"🏆", label:"Highest Payment Day",    value: highestPayDay ? `${highestPayDay[0]} — Rs. ${Math.round(highestPayDay[1]).toLocaleString()}` : "—" },
              { icon:"👑", label:"Top Paying Customer",    value: topPayers[0]?.[0] || "—" },
              { icon:"💵", label:"Largest Single Payment", value: largestPay.val>0 ? `Rs. ${Math.round(largestPay.val).toLocaleString()}` : "—" },
              { icon:"⚠️", label:"Most Overdue Customer",  value: mostOverdueCust ? `${mostOverdueCust[0]} (Rs. ${Math.round(mostOverdueCust[1]).toLocaleString()})` : "None" },
              { icon:"📊", label:"Total Transactions",     value: recvPayments.length.toLocaleString() },
            ].map((ins,i)=>(
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <span className="text-xl mt-0.5">{ins.icon}</span>
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide leading-tight mb-1">{ins.label}</p>
                  <p className="text-white text-xs font-bold leading-snug break-words">{ins.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ROW 6: Supplier Payables ══ */}
        {(() => {
          // Only active suppliers' orders
          const activeSupplierIds = new Set(suppliers.filter(s => !s.deleted).map(s => s.id));
          const activeOrders = allOrders.filter(o => activeSupplierIds.has(o.supplierId));

          const totalOrdered_s  = activeOrders.reduce((s,o) => s + (Number(o.totalAmount) || 0), 0);
          const totalPaid_s     = activeOrders.reduce((s,o) => s + (Number(o.paidAmount)  || 0), 0);
          const totalBalance_s  = activeOrders.reduce((s,o) => s + (Number(o.balance)     || 0), 0);
          // Net purchased = paid + balance (both are returns-aware — balance reduces when return happens)
          const netPurchased_s  = totalPaid_s + totalBalance_s;
          const overdueOrders   = activeOrders.filter(o => {
            if ((Number(o.balance)||0) <= 0) return false;
            if (!o.dueDate) return false;
            return new Date(o.dueDate) < now_p;
          });
          const overdueAmt_s  = overdueOrders.reduce((s,o) => s + (Number(o.balance)||0), 0);
          const payableRate   = netPurchased_s > 0 ? ((totalPaid_s / netPurchased_s)*100).toFixed(1) : 0;
          const supplierBalMap = {};
          activeOrders.forEach(o => {
            const name = o.supplierName || o.supplierId || "Unknown";
            if (!supplierBalMap[name]) supplierBalMap[name] = { paid:0, balance:0, net:0 };
            supplierBalMap[name].paid    += Number(o.paidAmount) || 0;
            supplierBalMap[name].balance += Number(o.balance)    || 0;
            // net = paid + balance (returns-aware)
            supplierBalMap[name].net     += (Number(o.paidAmount)||0) + (Number(o.balance)||0);
          });
          const supplierList  = Object.entries(supplierBalMap).sort((a,b)=>b[1].balance-a[1].balance);
          const pendingOrders = activeOrders.filter(o=>(Number(o.balance)||0)>0)
            .sort((a,b)=>(Number(b.balance)||0)-(Number(a.balance)||0)).slice(0,8);
          return (
            <>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-white/10"/>
                <h2 className="text-white font-black text-sm tracking-wide uppercase">🏭 Supplier Payables</h2>
                <div className="h-px flex-1 bg-white/10"/>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Purchased" value={`Rs. ${Math.round(netPurchased_s).toLocaleString()}`} icon="🛒" color="from-blue-500 to-indigo-600"   subtitle="after goods returns" />
                <StatCard label="Total Paid"       value={`Rs. ${Math.round(totalPaid_s).toLocaleString()}`}   icon="✅" color="from-green-500 to-emerald-600" subtitle="paid to suppliers" />
                <StatCard label="Total Payable"    value={`Rs. ${Math.round(totalBalance_s).toLocaleString()}`}icon="⏳" color="from-orange-500 to-amber-600"  subtitle="still owe" />
                <StatCard label="Overdue Payable"  value={`Rs. ${Math.round(overdueAmt_s).toLocaleString()}`}  icon="🚨" color="from-red-500 to-rose-600"      subtitle="past due date" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Payment Rate"   value={`${payableRate}%`}                                                         icon="📊" color="from-purple-500 to-violet-600" subtitle="of total paid" />
                <StatCard label="Pending Orders" value={activeOrders.filter(o=>(Number(o.balance)||0)>0).length.toLocaleString()}    icon="📋" color="from-yellow-500 to-amber-600"  subtitle="have balance" />
                <StatCard label="Total Orders"   value={activeOrders.length.toLocaleString()}                                          icon="📦" color="from-cyan-500 to-blue-600"     subtitle="all time" />
                <StatCard label="Overdue Orders" value={overdueOrders.length.toLocaleString()}                                         icon="⚠️" color="from-rose-500 to-red-600"      subtitle="past due date" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h3 className="text-white font-bold text-base mb-4">🏭 Supplier Balance</h3>
                  {supplierList.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No supplier orders</p> : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                        <th className="text-left pb-2">Supplier</th><th className="text-right pb-2">Total</th>
                        <th className="text-right pb-2">Paid</th><th className="text-right pb-2">Balance</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {supplierList.map(([name,d])=>(
                          <tr key={name} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 text-gray-300">{name}</td>
                            <td className="py-2.5 text-right text-gray-400">Rs. {Math.round(d.net).toLocaleString()}</td>
                            <td className="py-2.5 text-right text-green-400 font-semibold">Rs. {Math.round(d.paid).toLocaleString()}</td>
                            <td className={`py-2.5 text-right font-bold ${d.balance>0?"text-red-400":"text-green-400"}`}>
                              {d.balance>0?`Rs. ${Math.round(d.balance).toLocaleString()}`:"Cleared ✓"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h3 className="text-white font-bold text-base mb-4">📄 Pending Orders</h3>
                  {pendingOrders.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">All orders cleared ✅</p> : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                        <th className="text-left pb-2">Order</th><th className="text-left pb-2">Supplier</th>
                        <th className="text-right pb-2">Balance</th><th className="text-right pb-2">Due</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {pendingOrders.map(o=>{
                          const isOD=o.dueDate&&new Date(o.dueDate)<now_p;
                          return (
                            <tr key={o.id} className="hover:bg-white/[0.02]">
                              <td className="py-2 text-purple-400 font-mono text-[10px]">PO-{(o.id||"").slice(-4).toUpperCase()}</td>
                              <td className="py-2 text-gray-300 truncate max-w-[90px]">{o.supplierName||"—"}</td>
                              <td className="py-2 text-right font-semibold text-amber-400">Rs. {Math.round(Number(o.balance)||0).toLocaleString()}</td>
                              <td className={`py-2 text-right text-[10px] ${isOD?"text-red-400 font-bold":"text-gray-500"}`}>
                                {o.dueDate?new Date(o.dueDate).toLocaleDateString("en-PK",{day:"2-digit",month:"short"}):"—"}{isOD&&" ⚠️"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </>
    );
  };

  const renderInvoice = () => {
    const now_i = new Date();
    const todayStart_i     = new Date(now_i.getFullYear(), now_i.getMonth(), now_i.getDate());
    const yesterdayStart_i = new Date(todayStart_i); yesterdayStart_i.setDate(yesterdayStart_i.getDate()-1);
    const thisMonthStart_i = new Date(now_i.getFullYear(), now_i.getMonth(), 1);
    const lastMonthStart_i = new Date(now_i.getFullYear(), now_i.getMonth()-1, 1);
    const lastMonthEnd_i   = new Date(now_i.getFullYear(), now_i.getMonth(), 0, 23,59,59);
    const thisYearStart_i  = new Date(now_i.getFullYear(), 0, 1);
    const lastYearStart_i  = new Date(now_i.getFullYear()-1, 0, 1);
    const lastYearEnd_i    = new Date(now_i.getFullYear()-1, 11, 31, 23,59,59);
    const iDate_i = (i) => i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt || 0);
    const iCount  = (filter) => activeInvoices.filter(i => filter(iDate_i(i))).length;
    const totalInv      = activeInvoices.length;
    const todayInv      = iCount(d => d >= todayStart_i);
    const yesterdayInv  = iCount(d => d >= yesterdayStart_i && d < todayStart_i);
    const thisMonthInv  = iCount(d => d >= thisMonthStart_i);
    const lastMonthInv  = iCount(d => d >= lastMonthStart_i && d <= lastMonthEnd_i);
    const thisYearInv   = iCount(d => d >= thisYearStart_i);
    const lastYearInv   = iCount(d => d >= lastYearStart_i && d <= lastYearEnd_i);
    const paidInv       = activeInvoices.filter(i => i.status === "Paid").length;
    const unpaidInv     = activeInvoices.filter(i => i.status === "Unpaid").length;
    const partialInv    = activeInvoices.filter(i => i.status === "Partial").length;
    const overdueInv    = activeInvoices.filter(i => { if(i.status==="Paid") return false; return i.dueDate && new Date(i.dueDate)<now_i; }).length;
    const avgInvVal     = totalInv > 0 ? activeInvoices.reduce((s,i)=>s+getInvActualAmount(i),0)/totalInv : 0;
    function gb(curr,prev) {
      const pct = prev>0?((curr-prev)/prev*100).toFixed(1):(curr>0?100:0);
      return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(pct)>=0?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>{Number(pct)>=0?"↑":"↓"} {Math.abs(pct)}%</span>;
    }
    const trendLabels=[]; const trendCounts=[];
    for(let i=5;i>=0;i--){const mS=new Date(now_i.getFullYear(),now_i.getMonth()-i,1);const mE=new Date(now_i.getFullYear(),now_i.getMonth()-i+1,0,23,59,59);trendLabels.push(mS.toLocaleString("en-US",{month:"short"}));trendCounts.push(iCount(d=>d>=mS&&d<=mE));}
    const statusData_i=[{name:"Paid",value:paidInv,color:"#10b981"},{name:"Unpaid",value:unpaidInv,color:"#ef4444"},{name:"Partial",value:partialInv,color:"#f59e0b"},{name:"Overdue",value:overdueInv,color:"#7c3aed"}].filter(d=>d.value>0);
    const custInvCountMap={};
    activeInvoices.forEach(i=>{const name=i.customerName||i.customer||"Direct";if(!custInvCountMap[name])custInvCountMap[name]={count:0,amount:0};custInvCountMap[name].count++;custInvCountMap[name].amount+=getInvActualAmount(i);});
    const topCustByCount=Object.entries(custInvCountMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
    const largestInvoices=[...activeInvoices].sort((a,b)=>getInvActualAmount(b)-getInvActualAmount(a)).slice(0,6);
    const agingBuckets={"0–30 Days":0,"31–60 Days":0,"61–90 Days":0,"90+ Days":0};
    activeInvoices.forEach(i=>{if(i.status==="Paid"||!i.dueDate)return;const due=new Date(i.dueDate);if(due>=now_i)return;const a=Math.floor((now_i-due)/(864e5));if(a<=30)agingBuckets["0–30 Days"]++;else if(a<=60)agingBuckets["31–60 Days"]++;else if(a<=90)agingBuckets["61–90 Days"]++;else agingBuckets["90+ Days"]++;});
    const agingData=Object.entries(agingBuckets).map(([name,value])=>({name,value}));
    const highestInv=activeInvoices.length>0?[...activeInvoices].sort((a,b)=>getInvActualAmount(b)-getInvActualAmount(a))[0]:null;
    const lowestInv=activeInvoices.length>0?[...activeInvoices].sort((a,b)=>getInvActualAmount(a)-getInvActualAmount(b))[0]:null;
    const mostActiveCustomer=topCustByCount[0]?.[0]||"—";
    const invByDay={};activeInvoices.forEach(i=>{const d=iDate_i(i);const key=d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"});invByDay[key]=(invByDay[key]||0)+1;});
    const mostInvDay=Object.entries(invByDay).sort((a,b)=>b[1]-a[1])[0];
    const overdueByCustomer_i={};activeInvoices.forEach(i=>{if(i.status==="Paid"||!i.dueDate)return;if(new Date(i.dueDate)>=now_i)return;const name=i.customerName||i.customer||"Direct";overdueByCustomer_i[name]=(overdueByCustomer_i[name]||0)+(Number(i.balance)||0);});
    const mostOverdueCust_i=Object.entries(overdueByCustomer_i).sort((a,b)=>b[1]-a[1])[0];

    // Average Payment Days = avg days between invoice creation and full payment
    const paidInvWithDates = activeInvoices.filter(i => i.status==="Paid" && i.createdAt && i.lastPaymentAt);
    const avgPaymentDays = paidInvWithDates.length > 0
      ? Math.round(paidInvWithDates.reduce((s,i) => {
          const created = iDate_i(i);
          const paid    = i.lastPaymentAt?.toDate ? i.lastPaymentAt.toDate() : new Date(i.lastPaymentAt);
          return s + Math.max(0, (paid - created) / (1000*60*60*24));
        }, 0) / paidInvWithDates.length)
      : null;

    // Invoice Success Rate = active invoices / (active + soft-deleted)
    const deletedCount  = invoices.filter(i => i.deleted).length;
    const totalCreated  = activeInvoices.length + deletedCount;
    const successRate   = totalCreated > 0 ? ((activeInvoices.length / totalCreated)*100).toFixed(1) : 100;
    const ttStyle_i={background:"rgba(15,15,25,0.97)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",color:"#fff",fontSize:"12px",padding:"8px 12px"};
    const ttItem_i={color:"#e5e7eb"};
    const ttLabel_i={color:"#fff",fontWeight:"600"};
    const COLORS_I=["#10b981","#ef4444","#f59e0b","#7c3aed","#3b82f6","#06b6d4","#f97316","#84cc16"];
    const SC={Paid:"text-green-400",Unpaid:"text-red-400",Partial:"text-yellow-400"};
    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Invoices"        value={totalInv.toLocaleString()}              icon="🧾" color="from-blue-500 to-indigo-600" />
          <StatCard label="Today's Invoices"      value={todayInv.toLocaleString()}              icon="🌅" color="from-pink-500 to-rose-600"    subtitle={<>{gb(todayInv,yesterdayInv)} vs yesterday</>} />
          <StatCard label="This Month Invoices"   value={thisMonthInv.toLocaleString()}          icon="📅" color="from-cyan-500 to-blue-600"    subtitle={<>{gb(thisMonthInv,lastMonthInv)} vs last month</>} />
          <StatCard label="Average Invoice Value" value={`Rs. ${Math.round(avgInvVal).toLocaleString()}`} icon="💰" color="from-amber-500 to-orange-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Paid Invoices"    value={paidInv.toLocaleString()}    icon="✅" color="from-green-500 to-emerald-600" subtitle={`${totalInv>0?((paidInv/totalInv)*100).toFixed(0):0}% of total`} />
          <StatCard label="Unpaid Invoices"  value={unpaidInv.toLocaleString()}  icon="❌" color="from-red-500 to-rose-600" />
          <StatCard label="Partially Paid"   value={partialInv.toLocaleString()} icon="📋" color="from-yellow-500 to-amber-600" />
          <StatCard label="Overdue Invoices" value={overdueInv.toLocaleString()} icon="🚨" color="from-purple-500 to-violet-600" subtitle="past due date" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-1">📈 Invoice Creation Trend</h3>
            <p className="text-gray-500 text-xs mb-4">Invoices per month (last 6 months)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendLabels.map((m,idx)=>({name:m,invoices:trendCounts[idx]}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                <XAxis dataKey="name" tick={{fill:"#6b7280",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_i} itemStyle={ttItem_i} labelStyle={ttLabel_i} formatter={v=>[`${v} invoices`,"Count"]}/>
                <Line type="monotone" dataKey="invoices" stroke="#3b82f6" strokeWidth={2.5} dot={{fill:"#3b82f6",r:4}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl p-3 sm:p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-sm sm:text-base mb-1">📊 Invoice Status</h3>
            <p className="text-gray-500 text-xs mb-4">Distribution at a glance</p>
            {statusData_i.length===0?<p className="text-gray-500 text-sm text-center py-10">No data</p>:(
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <ResponsiveContainer width="100%" height={160} className="sm:w-40">
                  <PieChart><Pie data={statusData_i} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" label={false}>
                    {statusData_i.map((d,i)=><Cell key={i} fill={d.color} strokeWidth={0}/>)}
                  </Pie><Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_i} itemStyle={ttItem_i} labelStyle={ttLabel_i} formatter={(v,n)=>[`${v} invoices`,n]}/></PieChart>
                </ResponsiveContainer>
                <div className="flex-1 w-full space-y-2">{statusData_i.map(d=>(
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}}/>
                    <span className="text-gray-300 text-xs flex-1">{d.name}</span>
                    <span className="text-white text-xs font-bold">{d.value}</span>
                    <span className="text-gray-500 text-[10px]">{totalInv>0?((d.value/totalInv)*100).toFixed(1):0}%</span>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">🧾 Top Customers by Invoice Count</h3>
            {topCustByCount.length===0?<p className="text-gray-500 text-sm text-center py-8">No data</p>:(
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                  <th className="text-left pb-2">Customer</th><th className="text-right pb-2">Invoices</th><th className="text-right pb-2">Total Amount</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.04]">{topCustByCount.map(([name,d],i)=>(
                  <tr key={name} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 text-gray-300 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0" style={{background:COLORS_I[i%COLORS_I.length]+"33",color:COLORS_I[i%COLORS_I.length]}}>{i+1}</span>{name}
                    </td>
                    <td className="py-2.5 text-right text-blue-400 font-bold">{d.count}</td>
                    <td className="py-2.5 text-right text-white font-semibold">Rs. {Math.round(d.amount).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">📋 Largest Invoices</h3>
            {largestInvoices.length===0?<p className="text-gray-500 text-sm text-center py-8">No invoices</p>:(
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 uppercase text-[10px] tracking-wide border-b border-white/10">
                  <th className="text-left pb-2">Invoice</th><th className="text-left pb-2">Customer</th><th className="text-right pb-2">Amount</th><th className="text-right pb-2">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.04]">{largestInvoices.map(inv=>(
                  <tr key={inv.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 text-blue-400 font-mono text-[10px]">INV-{(inv.id||"").slice(-4).toUpperCase()}</td>
                    <td className="py-2 text-gray-300 truncate max-w-[90px]">{inv.customerName||inv.customer||"Direct"}</td>
                    <td className="py-2 text-right font-bold text-white">Rs. {Math.round(getInvActualAmount(inv)).toLocaleString()}</td>
                    <td className={`py-2 text-right text-[10px] font-bold ${SC[inv.status]||"text-gray-400"}`}>{inv.status||"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-1">⏰ Invoice Aging</h3>
            <p className="text-gray-500 text-xs mb-4">Overdue invoices by age</p>
            {agingData.every(d=>d.value===0)?<p className="text-gray-500 text-sm text-center py-10">No overdue invoices ✅</p>:(
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={agingData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={ttStyle_i} itemStyle={ttItem_i} labelStyle={ttLabel_i} formatter={v=>[`${v} invoices`,"Count"]}/>
                  <Bar dataKey="value" radius={[6,6,0,0]}>{agingData.map((_,i)=><Cell key={i} fill={["#10b981","#f59e0b","#ef4444","#7c3aed"][i]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-4">📅 Invoice Comparison</h3>
            <div className="space-y-3">{[
              {label:"Today vs Yesterday",curr:todayInv,prev:yesterdayInv,cL:"Today",pL:"Yesterday"},
              {label:"This Month vs Last Month",curr:thisMonthInv,prev:lastMonthInv,cL:"This Month",pL:"Last Month"},
              {label:"This Year vs Last Year",curr:thisYearInv,prev:lastYearInv,cL:"This Year",pL:"Last Year"},
            ].map(row=>{
              const pct=row.prev>0?((row.curr-row.prev)/row.prev*100).toFixed(1):(row.curr>0?100:0);
              const isUp=Number(pct)>=0;
              return(
                <div key={row.label} className="p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-semibold">{row.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUp?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>{isUp?"↑":"↓"} {Math.abs(Number(pct))}%</span>
                  </div>
                  <div className="flex justify-between">
                    <div><p className="text-[10px] text-gray-500">{row.cL}</p><p className="text-white font-bold text-sm">{row.curr} invoices</p></div>
                    <div className="text-right"><p className="text-[10px] text-gray-500">{row.pL}</p><p className="text-gray-400 font-semibold text-sm">{row.prev} invoices</p></div>
                  </div>
                </div>
              );
            })}</div>
          </div>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">🚨 Invoice Insights</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              {icon:"💰",label:"Highest Invoice",value:highestInv?`Rs. ${Math.round(getInvActualAmount(highestInv)).toLocaleString()}`:"—"},
              {icon:"📉",label:"Lowest Invoice",value:lowestInv?`Rs. ${Math.round(getInvActualAmount(lowestInv)).toLocaleString()}`:"—"},
              {icon:"👑",label:"Most Active Customer",value:mostActiveCustomer},
              {icon:"📅",label:"Most Invoice Day",value:mostInvDay?`${mostInvDay[0]} (${mostInvDay[1]})`:"—"},
              {icon:"📊",label:"Avg Invoice Value",value:`Rs. ${Math.round(avgInvVal).toLocaleString()}`},
              {icon:"⚠️",label:"Most Overdue Customer",value:mostOverdueCust_i?mostOverdueCust_i[0]:"None"},
              {icon:"⏱️",label:"Avg Collection Time",value:avgPaymentDays!=null?`${avgPaymentDays} Days`:"—",extra:`Based on ${paidInvWithDates.length} paid invoices`},
              {icon:"✅",label:"Invoice Success Rate",value:`${successRate}%`,extra:`${activeInvoices.length} active · ${deletedCount} cancelled`},
            ].map((ins,i)=>(
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <span className="text-lg mt-0.5 flex-shrink-0">{ins.icon}</span>
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide leading-tight mb-1">{ins.label}</p>
                  <p className="text-white text-xs font-bold leading-snug break-words">{ins.value}</p>
                  {ins.extra && <p className="text-gray-600 text-[10px] mt-0.5">{ins.extra}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderProfit = () => {
    const zeroCostProducts = Object.values(profitByProduct).filter(p => p.cost === 0 && p.revenue > 0);
    const hasMissingCost = zeroCostProducts.length > 0;
    const PROFIT_FILTERS = [
      { id: "all", label: "All Time" },
      { id: "month", label: "This Month" },
      { id: "lastMonth", label: "Last Month" },
      { id: "year", label: "This Year" },
      { id: "week", label: "This Week" },
    ];

    return (
      <>
        {/* ── Profit Date Filter ── */}
        <div className="flex flex-wrap gap-2 pb-1">
          {PROFIT_FILTERS.map(f => (
            <button key={f.id} onClick={() => setProfitDateFilter(f.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{
                background: profitDateFilter === f.id ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${profitDateFilter === f.id ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                color: profitDateFilter === f.id ? "#fff" : "#9ca3af",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Main Summary Card ── */}
        <div className="rounded-xl p-6" style={{ ...cardStyle, border: `1px solid ${netProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Title */}
            <div className="flex-shrink-0">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">💵 Profit Summary</p>
              <p className="text-gray-500 text-xs">Inventory-linked invoice items only</p>
            </div>

            {/* Numbers */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Sales */}
              <div className="rounded-xl px-5 py-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Total Sales</p>
                <p className="text-white font-black text-2xl">Rs. {totalInventoryRevenue.toLocaleString()}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{inventoryItemCount} item{inventoryItemCount !== 1 ? "s" : ""} sold</p>
              </div>

              {/* Total Cost */}
              <div className="rounded-xl px-5 py-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Total Cost</p>
                <p className="text-white font-black text-2xl">Rs. {totalInventoryCost.toLocaleString()}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">Sum of cost prices</p>
              </div>

              {/* Profit */}
              <div className="rounded-xl px-5 py-4" style={{
                background: netProfit >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${netProfit >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
              }}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {netProfit >= 0 ? "✅ Profit" : "❌ Loss"}
                </p>
                <p className={`font-black text-2xl ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Rs. {Math.abs(netProfit).toLocaleString()}
                </p>
                <p className="text-gray-500 text-[10px] mt-0.5">Margin: {profitMargin}%</p>
              </div>
            </div>
          </div>

          {/* Warning: missing cost prices */}
          {hasMissingCost && (
            <div className="mt-4 px-4 py-3 rounded-lg flex items-start gap-2"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <span className="text-amber-400 text-sm flex-shrink-0">⚠️</span>
              <p className="text-amber-400 text-xs">
                <strong>{zeroCostProducts.length}</strong> product{zeroCostProducts.length > 1 ? "s have" : " has"} cost price set to 0 —
                profit may be overstated. Go to <strong>Inventory</strong> and set the correct cost prices.
              </p>
            </div>
          )}

          {skippedItemCount > 0 && (
            <p className="mt-3 text-gray-600 text-[10px] text-center">
              ℹ️ {skippedItemCount} invoice item{skippedItemCount > 1 ? "s" : ""} not counted — not linked to inventory
            </p>
          )}
        </div>

        {/* ── Trend + Per-product table ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly trend */}
          <CssBarChart
            data={monthlyProfit}
            title="📈 Monthly Profit Trend"
            color={netProfit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"}
          />

          {/* Revenue vs Cost bar */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <h3 className="text-white font-bold text-base mb-5">📊 Sales vs Cost Breakdown</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-amber-400 text-sm font-semibold">Total Sales</span>
                  <span className="text-white font-bold">Rs. {totalInventoryRevenue.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-red-400 text-sm font-semibold">Total Cost</span>
                  <span className="text-white font-bold">Rs. {totalInventoryCost.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600"
                    style={{ width: totalInventoryRevenue > 0 ? `${Math.min((totalInventoryCost / totalInventoryRevenue) * 100, 100)}%` : "0%" }} />
                </div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between mb-1.5">
                  <span className={`text-sm font-semibold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {netProfit >= 0 ? "Profit" : "Loss"}
                  </span>
                  <span className={`font-bold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    Rs. {Math.abs(netProfit).toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${netProfit >= 0 ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-gradient-to-r from-red-500 to-rose-600"}`}
                    style={{ width: totalInventoryRevenue > 0 ? `${Math.min((Math.abs(netProfit) / totalInventoryRevenue) * 100, 100)}%` : "0%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-product profit table ── */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h3 className="text-white font-bold text-base">📦 Product-wise Sales & Profit</h3>
            <p className="text-gray-500 text-xs mt-0.5">Only inventory-linked products shown</p>
          </div>

          {Object.values(profitByProduct).length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm">No inventory-linked sales in this period</p>
              <p className="text-gray-600 text-xs mt-1">Invoices need products from your inventory to calculate profit</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid px-3 sm:px-5 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-widest min-w-[600px]"
                style={{ color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.05)", gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr 1.2fr" }}>
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Sales</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Profit</span>
              </div>

              {Object.values(profitByProduct)
                .sort((a, b) => b.profit - a.profit)
                .map((p, i) => (
                  <div key={i}
                    className="grid px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-white/[0.025] transition-colors items-center min-w-[600px]"
                    style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr 1.2fr", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black flex-shrink-0"
                        style={{
                          background: p.profit > 0 ? "rgba(16,185,129,0.15)" : p.profit < 0 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
                          color: p.profit > 0 ? "#34d399" : p.profit < 0 ? "#f87171" : "#9ca3af"
                        }}>
                        {i + 1}
                      </div>
                      <p className="text-white text-xs sm:text-sm font-semibold truncate">{p.name}</p>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm text-right tabular-nums">{p.qty.toFixed(p.qty % 1 !== 0 ? 2 : 0)}</p>
                    <p className="text-amber-400 text-xs sm:text-sm font-semibold text-right tabular-nums whitespace-nowrap">Rs. {Math.round(p.revenue).toLocaleString()}</p>
                    <p className="text-red-400 text-xs sm:text-sm text-right tabular-nums whitespace-nowrap">Rs. {Math.round(p.cost).toLocaleString()}</p>
                    <p className={`text-xs sm:text-sm font-black text-right tabular-nums whitespace-nowrap ${p.profit > 0 ? "text-green-400" : p.profit < 0 ? "text-red-400" : "text-gray-500"}`}>
                      {p.profit > 0 ? "+" : ""}Rs. {Math.round(p.profit).toLocaleString()}
                    </p>
                  </div>
                ))}

              {/* Footer total row */}
              <div className="grid px-3 sm:px-5 py-3 sm:py-3.5 items-center font-black min-w-[600px]"
                style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr 1.2fr", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide sm:tracking-widest">Total</span>
                <span />
                <span className="text-amber-400 text-xs sm:text-sm text-right tabular-nums whitespace-nowrap">Rs. {Math.round(totalInventoryRevenue).toLocaleString()}</span>
                <span className="text-red-400 text-xs sm:text-sm text-right tabular-nums whitespace-nowrap">Rs. {Math.round(totalInventoryCost).toLocaleString()}</span>
                <span className={`text-xs sm:text-sm text-right tabular-nums whitespace-nowrap ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {netProfit >= 0 ? "+" : ""}Rs. {Math.round(netProfit).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  // Main render
  return (
    <div className="flex flex-col gap-5 w-full">

      {/* Header with Filters */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
                style={{background:"linear-gradient(135deg,#3b82f6,#8b5cf6)"}}>
                📊
              </div>
              <h2 className="text-base sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Business Analytics
              </h2>
            </div>
            <p className="text-gray-400 text-xs ml-10 sm:ml-13 hidden sm:block">Comprehensive insights and performance metrics for your business</p>
          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${dateFilter === filter.id ? "scale-105 shadow-lg" : "hover:scale-105"
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
                onClick={() => { setActiveSection(section.id); sessionStorage.setItem("analyticsTab", section.id); }}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-1 sm:gap-2 ${activeSection === section.id ? "scale-105" : "hover:scale-105"
                  }`}
                style={{
                  background: activeSection === section.id
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activeSection === section.id ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
                  color: activeSection === section.id ? "#000" : "#9ca3af",
                  fontWeight: activeSection === section.id ? "bold" : "semibold",
                }}>
                <span className="text-sm sm:text-base">{section.icon}</span>
                <span className="text-[10px] sm:text-xs md:text-sm">{section.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on active section */}
      {activeSection === "overview" && renderOverview()}
      {activeSection === "revenue" && renderRevenue()}
      {/* {activeSection === "sales" && renderSales()} */}
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
