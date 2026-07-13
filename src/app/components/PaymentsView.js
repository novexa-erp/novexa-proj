"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const cardStyle = { 
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

export default function PaymentsView({ uid, onNavigate }) {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierPaymentsAll, setSupplierPaymentsAll] = useState([]);
  const [supplierOrdersAll, setSupplierOrdersAll] = useState([]); // all supplier orders for pending calc
  const [customerInvoicesAll, setCustomerInvoicesAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Real-time: direct invoices listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "invoices"),
      (snap) => {
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => !i.deleted));
      }
    );
    return () => unsub();
  }, [uid]);

  // Real-time: payments listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "payments"),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted));
      }
    );
    return () => unsub();
  }, [uid]);

  // Real-time: purchases listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "purchases"),
      (snap) => {
        setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  // Real-time: sab suppliers ke ALL payments + orders (expenses + pending to suppliers)
  useEffect(() => {
    if (!uid) return;

    let payUnsubs = [];
    let ordUnsubs = [];

    const suppUnsub = onSnapshot(
      collection(db, "users", uid, "suppliers"),
      (suppSnap) => {
        // Cleanup previous listeners
        payUnsubs.forEach(u => u());
        ordUnsubs.forEach(u => u());
        payUnsubs = [];
        ordUnsubs = [];

        const activeSups = suppSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.deleted);

        setSuppliers(activeSups);

        // Payments listener (for expense calculations)
        activeSups.forEach(sup => {
          const unsubPay = onSnapshot(
            collection(db, "users", uid, "suppliers", sup.id, "payments"),
            (paySnap) => {
              const pays = paySnap.docs.map(d => ({
                id: d.id, supplierId: sup.id, supplierName: sup.name, ...d.data()
              })).filter(p => p.amount && p.amount > 0);
              setSupplierPaymentsAll(prev => {
                const filtered = prev.filter(p => p.supplierId !== sup.id);
                return [...filtered, ...pays];
              });
            }
          );
          payUnsubs.push(unsubPay);

          // Orders listener (for pending to suppliers)
          const unsubOrd = onSnapshot(
            collection(db, "users", uid, "suppliers", sup.id, "orders"),
            (ordSnap) => {
              const orders = ordSnap.docs
                .map(d => ({ id: d.id, supplierId: sup.id, ...d.data() }))
                .filter(o => !o.deleted && (Number(o.balance) || 0) > 0);
              setSupplierOrdersAll(prev => {
                const filtered = prev.filter(o => o.supplierId !== sup.id);
                return [...filtered, ...orders];
              });
            }
          );
          ordUnsubs.push(unsubOrd);
        });
      }
    );

    return () => {
      suppUnsub();
      payUnsubs.forEach(u => u());
      ordUnsubs.forEach(u => u());
    };
  }, [uid]);

  // Real-time: sab customers ke invoices (Total Pending from Customers)
  useEffect(() => {
    if (!uid) return;

    let invUnsubs = [];

    const custUnsub = onSnapshot(
      collection(db, "users", uid, "customers"),
      (custSnap) => {
        // Cleanup previous invoice listeners
        invUnsubs.forEach(u => u());
        invUnsubs = [];

        const activeCusts = custSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => !c.deleted);

        activeCusts.forEach(cust => {
          const unsub = onSnapshot(
            collection(db, "users", uid, "customers", cust.id, "invoices"),
            (invSnap) => {
              const invs = invSnap.docs
                .map(d => ({ id: d.id, customerId: cust.id, ...d.data() }))
                .filter(i => !i.deleted);

              setCustomerInvoicesAll(prev => {
                const filtered = prev.filter(i => i.customerId !== cust.id);
                return [...filtered, ...invs];
              });
            }
          );
          invUnsubs.push(unsub);
        });
      }
    );

    return () => {
      custUnsub();
      invUnsubs.forEach(u => u());
    };
  }, [uid]);

  async function handleAddPayment(paymentData) {
    try {
      await addDoc(collection(db, `users/${uid}/payments`), {
        ...paymentData,
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this payment record?")) return;
    try {
      await updateDoc(doc(db, `users/${uid}/payments`, id), {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
    } catch (err) {
      alert("Delete error: " + err.message);
    }
  }

  // Calculate stats
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const todayStr = today.toDateString();

  // Total Received = REAL-TIME: sab invoices ka amountPaid (customers se milا ab tak)
  const totalReceived = invoices
    .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);

  // Total Sent = REAL-TIME: sab supplier payments ka sum (ab tak sab suppliers ko diya)
  const totalSent = supplierPaymentsAll
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    +
    payments
      .filter(p => p.type === "sent")
      .reduce((sum, p) => sum + (Number(p.paid ?? p.amount ?? 0) || 0), 0);

  // Total Pending from Customers & Other Invoices = REAL-TIME
  // Customer invoices (users/uid/customers/cid/invoices) + Direct invoices (users/uid/invoices)
  // Delete hone par wo automatically state se nikal jaati hai (onSnapshot + deleted filter)

  const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");

  // Helper: actual balance = actualAmount - amountPaid - goods returns
  // Matches exactly CustomersView's getActualBalance logic
  const getActualBalance = (inv) => {
    const actualAmt = inv.actualAmount != null
      ? Number(inv.actualAmount)
      : (inv.items || [])
          .filter(it => !isPrevBalItem(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)
        || Number(inv.amount) || 0;

    // Subtract goods returns for this invoice (type="return" in payments collection)
    const invReturnsTotal = payments
      .filter(p => p.type === "return" && p.invoiceId === inv.id)
      .reduce((s, p) => s + (Number(p.returnAmount) || 0), 0);

    return Math.max(0, actualAmt - (Number(inv.amountPaid) || 0) - invReturnsTotal);
  };

  // All pending invoices combined — NO double counting:
  // customerInvoicesAll = users/{uid}/customers/{cid}/invoices
  // invoices (direct only, no customerId) = users/{uid}/invoices
  const allPendingInvoices = [
    ...customerInvoicesAll.filter(i => i.status !== "Paid"),
    ...invoices.filter(i => !i.customerId && i.status !== "Paid"), // sirf direct invoices
  ];

  const totalPendingFromAll = allPendingInvoices
    .reduce((sum, i) => sum + getActualBalance(i), 0);

  const pendingInvoicesCount = allPendingInvoices.filter(i => getActualBalance(i) > 0).length;

  // Keep old vars for backward compat (overdue, pie chart)
  const pendingPayments = invoices
    .filter(i => i.status === "Unpaid")
    .reduce((sum, i) => sum + (Number(i.balance || i.amount) || 0), 0);

  const partialPayments = invoices
    .filter(i => i.status === "Partial")
    .reduce((sum, i) => sum + (Number(i.balance) || 0), 0);

  // Overdue from customers
  const overduePayments = invoices
    .filter(i => {
      if (i.status === "Paid") return false;
      if (!i.dueDate) return false;
      const dueDate = i.dueDate.toDate ? i.dueDate.toDate() : new Date(i.dueDate);
      return dueDate < new Date();
    })
    .reduce((sum, i) => sum + (Number(i.balance || i.amount) || 0), 0);

  // Supplier pending = REAL-TIME: sab active suppliers ke orders ka balance
  // Supplier delete hone par automatically state se nikal jaata hai (onSnapshot + !deleted filter)
  const supplierPending = supplierOrdersAll
    .reduce((sum, o) => sum + (Number(o.balance) || 0), 0);

  const pendingSupplierOrdersCount = supplierOrdersAll.length;

  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const successRate = totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;

  // Count paid invoices
  const paidInvoicesCount = invoices.filter(i => i.amountPaid && i.amountPaid > 0).length;

  // Today's Collections - invoices ka amountPaid + direct received payments aaj ka
  const getDate = (item) => {
    if (item.paidAt?.toDate) return item.paidAt.toDate();
    if (item.createdAt?.toDate) return item.createdAt.toDate();
    if (item.createdAt) return new Date(item.createdAt);
    return null;
  };

  const todayPaymentsCount = invoices.filter(i => {
    if (!i.amountPaid || i.amountPaid === 0) return false;
    const d = getDate(i);
    return d && d.toDateString() === todayStr;
  }).length + payments.filter(p => {
    if (p.type !== "received") return false;
    const d = getDate(p);
    return d && d.toDateString() === todayStr;
  }).length;

  const todayCollections =
    invoices
      .filter(i => {
        if (!i.amountPaid || i.amountPaid === 0) return false;
        const d = getDate(i);
        return d && d.toDateString() === todayStr;
      })
      .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0)
    +
    payments
      .filter(p => {
        if (p.type !== "received") return false;
        const d = getDate(p);
        return d && d.toDateString() === todayStr;
      })
      .reduce((sum, p) => sum + (Number(p.paid ?? p.amount ?? 0) || 0), 0);

  // Today's Expense - REAL-TIME: supplierPaymentsAll se today filter
  const supplierPaymentsToday = supplierPaymentsAll.filter(p => {
    const d = getDate(p);
    return d && d.toDateString() === todayStr;
  });

  const todaySuppliersCount = supplierPaymentsToday.length +
    payments.filter(p => {
      if (p.type !== "sent") return false;
      const d = getDate(p);
      return d && d.toDateString() === todayStr;
    }).length;

  const todayExpense =
    supplierPaymentsToday.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    +
    payments
      .filter(p => {
        if (p.type !== "sent") return false;
        const d = getDate(p);
        return d && d.toDateString() === todayStr;
      })
      .reduce((sum, p) => sum + (Number(p.paid ?? p.amount ?? 0) || 0), 0);

  // This Month Received - REAL-TIME: invoices ka amountPaid this month
  const thisMonthReceived = invoices
    .filter(i => {
      if (!i.amountPaid || i.amountPaid === 0) return false;
      const d = getDate(i);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);

  // This Month Expenses - REAL-TIME: supplierPaymentsAll se this month filter
  const thisMonthExpenses = supplierPaymentsAll
    .filter(p => {
      const d = getDate(p);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    +
    payments
      .filter(p => {
        if (p.type !== "sent") return false;
        const d = getDate(p);
        return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + (Number(p.paid ?? p.amount ?? 0) || 0), 0);

  // Net Cash Flow = Total Received - Total Sent
  const netCashFlow = totalReceived - totalSent;

  const stats = [
    { label: "Today's Collections", value: todayCollections, icon: "📅", color: "from-cyan-500 to-blue-600", trend: `${todayPaymentsCount} payment${todayPaymentsCount !== 1 ? "s" : ""} received today` },
    { label: "Today's Expense", value: todayExpense, icon: "🧾", color: "from-rose-500 to-pink-600", trend: `${todaySuppliersCount} supplier payment${todaySuppliersCount !== 1 ? "s" : ""} today` },
    { label: "This Month Received", value: thisMonthReceived, icon: "📈", color: "from-green-500 to-emerald-600", trend: "Current Month" },
    { label: "This Month Expenses", value: thisMonthExpenses, icon: "📉", color: "from-orange-500 to-red-500", trend: "Paid to Suppliers" },
    { label: "Net Cash Flow", value: netCashFlow, icon: "⭐", color: netCashFlow >= 0 ? "from-green-400 to-teal-500" : "from-red-500 to-rose-600", trend: "Received - Sent", isNetFlow: true },
    { label: "Total Received", value: totalReceived, icon: "💵", color: "from-green-500 to-emerald-600", trend: `From ${invoices.length} invoices` },
    { label: "Total Sent", value: totalSent, icon: "💸", color: "from-red-500 to-rose-600", trend: `To ${suppliers.length} suppliers` },
    { label: "Total Pending from Customers & Invoices", value: totalPendingFromAll, icon: "⏳", color: "from-yellow-500 to-amber-600", trend: `${pendingInvoicesCount} pending invoices` },
    { label: "Pending to Suppliers", value: supplierPending, icon: "🔴", color: "from-orange-500 to-red-600", trend: `${pendingSupplierOrdersCount} pending orders` },
    { label: "Overdue Payments", value: overduePayments, icon: "⚠️", color: "from-red-600 to-rose-700", trend: "Action needed" },
    { label: "Payment Success Rate", value: `${successRate}%`, icon: "✅", color: "from-purple-500 to-pink-600", trend: `${paidInvoicesCount} of ${invoices.length} invoices` },
  ];

  // Pie chart data - showing payment flow
  const pieData = [
    { label: "Received (Customers)", value: totalReceived, color: "#10b981" },
    { label: "Sent (Suppliers)", value: totalSent, color: "#ef4444" },
    { label: "Pending from Customers", value: totalPendingFromAll, color: "#f59e0b" },
    { label: "Pending to Suppliers", value: supplierPending, color: "#fb923c" },
  ].filter(item => item.value > 0); // Only show segments with value

  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      (p.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.customer?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = 
      filterType === "all" || 
      p.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-green-500 border-r-blue-500 border-b-purple-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">₨</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-blue-500/5 to-purple-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Payment Management
            </h2>
            <p className="text-gray-400 text-xs">Track all your transactions and financial flows</p>
          </div>
          

        </div>
      </div>

      {/* New 5 Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.slice(0, 5).map((stat, i) => (
          <div key={i}
            className="group relative rounded-lg p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
            style={cardStyle}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl font-bold group-hover:scale-110 transition-all duration-300">
                  {stat.icon}
                </div>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${stat.color} text-white`}>
                  Live
                </div>
              </div>
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={`font-bold text-2xl mb-1 ${stat.isNetFlow ? (stat.value >= 0 ? "text-green-400" : "text-red-400") : "text-white"}`}>
                {typeof stat.value === "number"
                  ? stat.isNetFlow
                    ? `${stat.value >= 0 ? "+" : "-"} Rs. ${Math.abs(stat.value).toLocaleString()}`
                    : `Rs. ${stat.value.toLocaleString()}`
                  : stat.value}
              </p>
              <p className="text-gray-600 text-[10px]">{stat.trend}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.slice(5).map((stat, i) => (
          <div key={i} 
            className="group relative rounded-lg p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
            style={cardStyle}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`text-2xl font-bold group-hover:scale-110 transition-all duration-300`}>
                  {stat.icon}
                </div>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${stat.color} text-white`}>
                  Live
                </div>
              </div>
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
              <p className="text-white font-bold text-2xl mb-1">
                {typeof stat.value === "number" 
                  ? stat.isNetFlow 
                    ? `${stat.value >= 0 ? "+" : ""} Rs. ${Math.abs(stat.value).toLocaleString()}`
                    : `Rs. ${stat.value.toLocaleString()}` 
                  : stat.value}
              </p>
              <p className="text-gray-600 text-[10px]">{stat.trend}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Pie Chart & Payment List Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Pie Chart */}
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-white font-bold text-base mb-4">Payment Distribution</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {pieData.map((segment, i) => {
                  const total = pieData.reduce((sum, d) => sum + d.value, 0);
                  const percentage = total > 0 ? (segment.value / total) * 100 : 0;
                  const angle = (percentage / 100) * 360;
                  
                  // Calculate start angle
                  let startAngle = 0;
                  for (let j = 0; j < i; j++) {
                    const prevPercentage = total > 0 ? (pieData[j].value / total) * 100 : 0;
                    startAngle += (prevPercentage / 100) * 360;
                  }
                  
                  // Create path for pie slice
                  const radius = 90;
                  const centerX = 100;
                  const centerY = 100;
                  
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = ((startAngle + angle) * Math.PI) / 180;
                  
                  const x1 = centerX + radius * Math.cos(startRad);
                  const y1 = centerY + radius * Math.sin(startRad);
                  const x2 = centerX + radius * Math.cos(endRad);
                  const y2 = centerY + radius * Math.sin(endRad);
                  
                  const largeArc = angle > 180 ? 1 : 0;
                  
                  const pathData = [
                    `M ${centerX} ${centerY}`,
                    `L ${x1} ${y1}`,
                    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                    'Z'
                  ].join(' ');
                  
                  return (
                    <path
                      key={i}
                      d={pathData}
                      fill={segment.color}
                      className="transition-all duration-300 hover:opacity-80"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                    />
                  );
                })}
                {/* Center circle */}
                <circle cx="100" cy="100" r="50" fill="#0d1117" />
                <text x="100" y="95" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                  Total
                </text>
                <text x="100" y="110" textAnchor="middle" fill="#9ca3af" fontSize="10">
                  Rs. {pieTotal.toLocaleString()}
                </text>
              </svg>
            </div>
            
            {/* Legend */}
            <div className="w-full space-y-2">
              {pieData.map((segment, i) => {
                const percentage = pieTotal > 0 ? ((segment.value / pieTotal) * 100).toFixed(1) : 0;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: segment.color }} />
                      <span className="text-gray-400 text-xs">{segment.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-semibold">Rs. {segment.value.toLocaleString()}</span>
                      <span className="text-gray-600 text-[10px]">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Required Panel */}
        <div className="lg:col-span-2 rounded-xl p-6 flex flex-col gap-5" style={cardStyle}>
          
          {/* Panel Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-base">🚨 Action Required</h3>
              <p className="text-gray-500 text-[11px] mt-0.5">Invoices needing your attention</p>
            </div>
            <div className="px-2 py-1 rounded-lg text-[10px] font-bold text-green-400 border border-green-500/30"
              style={{ background: "rgba(16,185,129,0.1)" }}>
              ● Live
            </div>
          </div>

          {/* Quick Metrics Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Collection Rate",
                value: totalInvoiced > 0 ? `${Math.round((totalReceived / totalInvoiced) * 100)}%` : "0%",
                sub: "of total invoiced",
                color: "#10b981",
                bg: "rgba(16,185,129,0.08)",
                border: "rgba(16,185,129,0.2)",
                nav: null,
              },
              {
                label: "Overdue",
                value: `Rs. ${overduePayments.toLocaleString()}`,
                sub: "action needed",
                color: overduePayments > 0 ? "#f87171" : "#10b981",
                bg: overduePayments > 0 ? "rgba(248,113,113,0.08)" : "rgba(16,185,129,0.08)",
                border: overduePayments > 0 ? "rgba(248,113,113,0.2)" : "rgba(16,185,129,0.2)",
                nav: "invoices",
              },
              {
                label: "Avg Invoice",
                value: invoices.length > 0 ? `Rs. ${Math.round(totalInvoiced / invoices.length).toLocaleString()}` : "—",
                sub: `${invoices.length} invoices`,
                color: "#60a5fa",
                bg: "rgba(96,165,250,0.08)",
                border: "rgba(96,165,250,0.2)",
                nav: "invoices",
              },
            ].map((m, i) => (
              <div key={i}
                onClick={() => m.nav && onNavigate?.(m.nav)}
                className={`rounded-lg p-3 text-center ${m.nav ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
                style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{m.label}</p>
                <p className="font-bold text-sm mb-0.5" style={{ color: m.color }}>{m.value}</p>
                <p className="text-gray-600 text-[10px]">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Overdue Invoices */}
          {(() => {
            const now = new Date();
            const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

            const allInvs = [
              ...customerInvoicesAll,
              ...invoices.filter(i => !i.customerId),
            ];

            // Overdue
            const overdue = allInvs.filter(inv => {
              if (inv.status === "Paid") return false;
              if (!inv.dueDate) return false;
              const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
              if (isNaN(due)) return false;
              const bal = Math.max(0, (Number(inv.actualAmount ?? inv.amount) || 0) - (Number(inv.amountPaid) || 0));
              return due < now && bal > 0;
            }).map(inv => {
              const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
              const daysOver = Math.floor((now - due) / (1000 * 60 * 60 * 24));
              const bal = Math.max(0, (Number(inv.actualAmount ?? inv.amount) || 0) - (Number(inv.amountPaid) || 0));
              return { ...inv, due, daysOver, bal, _type: "overdue" };
            }).sort((a, b) => a.due - b.due);

            // Due soon (within 3 days, not overdue)
            const dueSoon = allInvs.filter(inv => {
              if (inv.status === "Paid") return false;
              if (!inv.dueDate) return false;
              const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
              if (isNaN(due)) return false;
              const bal = Math.max(0, (Number(inv.actualAmount ?? inv.amount) || 0) - (Number(inv.amountPaid) || 0));
              return due >= now && due <= in3Days && bal > 0;
            }).map(inv => {
              const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
              const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
              const bal = Math.max(0, (Number(inv.actualAmount ?? inv.amount) || 0) - (Number(inv.amountPaid) || 0));
              return { ...inv, due, daysLeft, bal, _type: "soon" };
            }).sort((a, b) => a.due - b.due);

            const allAlerts = [...overdue, ...dueSoon];

            if (allAlerts.length === 0) return (
              <div className="flex-1 flex flex-col items-center justify-center py-8 rounded-lg"
                style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-green-400 font-semibold text-sm">All clear!</p>
                <p className="text-gray-500 text-xs mt-1">No overdue or upcoming invoices</p>
              </div>
            );

            return (
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-64 pr-1">

                {/* Section label */}
                {overdue.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">
                    🔴 Overdue ({overdue.length})
                  </p>
                )}

                {overdue.map((inv, i) => {
                  const name = inv.customerName || inv.customer || inv.description || "Invoice";
                  const invRef = inv.invoiceNumber || `INV-${(inv.id || "").slice(-4).toUpperCase()}`;
                  // Always go to invoices tab when highlighting — invoice exists in global collection
                  return (
                    <div key={`ov-${inv.id || i}`}
                      onClick={() => onNavigate?.("invoices", inv.id)}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:scale-[1.01] transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                          🔴
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{name}</p>
                          <p className="text-gray-500 text-[10px]">{invRef} · Due {inv.due.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-bold text-red-400">Rs. {inv.bal.toLocaleString()}</p>
                        <p className="text-[10px] font-semibold text-red-500">{inv.daysOver}d overdue</p>
                      </div>
                    </div>
                  );
                })}

                {dueSoon.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 mt-1 mb-1">
                    ⏰ Due Soon ({dueSoon.length})
                  </p>
                )}

                {dueSoon.map((inv, i) => {
                  const urgColor = inv.daysLeft === 0 ? "#ef4444" : inv.daysLeft === 1 ? "#f97316" : "#eab308";
                  const daysLabel = inv.daysLeft === 0 ? "Today!" : inv.daysLeft === 1 ? "Tomorrow" : `${inv.daysLeft} days`;
                  const name = inv.customerName || inv.customer || inv.description || "Invoice";
                  const invRef = inv.invoiceNumber || `INV-${(inv.id || "").slice(-4).toUpperCase()}`;
                  return (
                    <div key={`ds-${inv.id || i}`}
                      onClick={() => onNavigate?.("invoices", inv.id)}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:scale-[1.01] transition-all"
                      style={{ background: urgColor + "12", border: `1px solid ${urgColor}35` }}>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ background: urgColor + "20", border: `1px solid ${urgColor}40` }}>
                          {inv.daysLeft === 0 ? "🔥" : inv.daysLeft === 1 ? "⚡" : "⏰"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{name}</p>
                          <p className="text-gray-500 text-[10px]">{invRef} · {inv.due.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-bold" style={{ color: urgColor }}>Rs. {inv.bal.toLocaleString()}</p>
                        <p className="text-[10px] font-semibold" style={{ color: urgColor }}>{daysLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddModal && (
        <AddPaymentModal 
          onSave={handleAddPayment} 
          onClose={() => setShowAddModal(false)}
          invoices={invoices}
        />
      )}

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

// Add Payment Modal
function AddPaymentModal({ onSave, onClose, invoices }) {
  const [formData, setFormData] = useState({
    type: "received",
    amount: "",
    customer: "",
    invoiceNumber: "",
    description: "",
    method: "cash",
    status: "completed",
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scaleIn" 
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-bold text-xl mb-0.5">💳 Add Payment</h3>
            <p className="text-gray-500 text-xs">Record a new transaction</p>
          </div>
          <button onClick={onClose} 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all text-2xl font-bold">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Type */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-2 block">
              💱 Transaction Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "received", label: "Received", icon: "💰", color: "#10b981" },
                { id: "sent", label: "Sent", icon: "💸", color: "#ef4444" },
              ].map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: type.id }))}
                  className={`p-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    formData.type === type.id ? "scale-105 shadow-lg" : "hover:scale-105"
                  }`}
                  style={{
                    background: formData.type === type.id ? type.color + "30" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${formData.type === type.id ? type.color : "rgba(255,255,255,0.1)"}`,
                    color: formData.type === type.id ? type.color : "#9ca3af",
                  }}>
                  <div className="text-xl mb-1">{type.icon}</div>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              💵 Amount (Rs.) *
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={formData.amount}
              onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              required
            />
          </div>

          {/* Customer */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              👤 Customer / Vendor
            </label>
            <input
              type="text"
              placeholder="Name"
              value={formData.customer}
              onChange={e => setFormData(f => ({ ...f, customer: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Invoice Number */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              🧾 Invoice / Reference Number
            </label>
            <input
              type="text"
              placeholder="INV-001"
              value={formData.invoiceNumber}
              onChange={e => setFormData(f => ({ ...f, invoiceNumber: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              💳 Payment Method
            </label>
            <select
              value={formData.method}
              onChange={e => setFormData(f => ({ ...f, method: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              📝 Description
            </label>
            <textarea
              placeholder="Payment notes..."
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af" }}>
              ❌ Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 shadow-lg"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff" }}>
              ✅ Save Payment
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
