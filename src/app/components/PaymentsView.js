"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const cardStyle = { 
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

export default function PaymentsView({ uid }) {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid]);

  async function loadData() {
    try {
      const [paymentsSnap, invoicesSnap, purchasesSnap] = await Promise.all([
        getDocs(collection(db, `users/${uid}/payments`)),
        getDocs(collection(db, `users/${uid}/invoices`)),
        getDocs(collection(db, `users/${uid}/purchases`)),
      ]);
      
      setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setInvoices(invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPurchases(purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }

  async function handleAddPayment(paymentData) {
    try {
      await addDoc(collection(db, `users/${uid}/payments`), {
        ...paymentData,
        createdAt: serverTimestamp(),
      });
      await loadData();
      setShowAddModal(false);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this payment record?")) return;
    try {
      await deleteDoc(doc(db, `users/${uid}/payments`, id));
      loadData();
    } catch (err) {
      alert("Delete error: " + err.message);
    }
  }

  // Calculate stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Total Received = Sum of all amountPaid from all invoices (customers se mila)
  const totalReceived = invoices
    .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);

  // Total Sent = Sum of all paidAmount from purchases (suppliers ko diya)
  const totalSent = purchases
    .reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);

  // Pending = Customer invoices ka remaining balance (customers se lena baaki)
  const pendingPayments = invoices
    .filter(i => i.status === "Unpaid")
    .reduce((sum, i) => sum + (Number(i.balance || i.amount) || 0), 0);

  // Partial = Partial paid invoices (remaining balance only)
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

  // Supplier pending = Purchases ka remaining balance (suppliers ko dena baaki)
  const supplierPending = purchases
    .reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

  // This month collection = amountPaid from invoices this month
  const thisMonthCollection = invoices
    .filter(i => {
      if (!i.amountPaid || i.amountPaid === 0) return false;
      if (!i.createdAt && !i.paidAt) return false;
      const date = i.paidAt?.toDate ? i.paidAt.toDate() : (i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt));
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);

  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const successRate = totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;

  // Count paid invoices
  const paidInvoicesCount = invoices.filter(i => i.amountPaid && i.amountPaid > 0).length;

  const stats = [
    { label: "Total Received", value: totalReceived, icon: "💵", color: "from-green-500 to-emerald-600", trend: `From ${invoices.length} invoices` },
    { label: "Total Sent", value: totalSent, icon: "💸", color: "from-red-500 to-rose-600", trend: `To ${purchases.length} suppliers` },
    { label: "Pending from Customers", value: pendingPayments + partialPayments, icon: "⏳", color: "from-yellow-500 to-amber-600", trend: `${invoices.filter(i => i.status === "Unpaid" || i.status === "Partial").length} pending invoices` },
    { label: "Pending to Suppliers", value: supplierPending, icon: "🔴", color: "from-orange-500 to-red-600", trend: `${purchases.filter(p => p.balance > 0).length} pending purchases` },
    { label: "Overdue Payments", value: overduePayments, icon: "⚠️", color: "from-red-600 to-rose-700", trend: "Action needed" },
    { label: "Payment Success Rate", value: `${successRate}%`, icon: "✅", color: "from-purple-500 to-pink-600", trend: `${paidInvoicesCount} of ${invoices.length} invoices` },
  ];

  // Pie chart data - showing payment flow
  const pieData = [
    { label: "Received (Customers)", value: totalReceived, color: "#10b981" },
    { label: "Sent (Suppliers)", value: totalSent, color: "#ef4444" },
    { label: "Pending from Customers", value: pendingPayments + partialPayments, color: "#f59e0b" },
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
          
          <button onClick={() => setShowAddModal(true)}
            className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 flex items-center gap-2 text-white">
              <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
              Add Payment
            </span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
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
                {typeof stat.value === "number" ? `Rs. ${stat.value.toLocaleString()}` : stat.value}
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

        {/* Recent Payments List */}
        <div className="lg:col-span-2 rounded-xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-base">Recent Transactions</h3>
            <div className="flex gap-2">
              {[
                { id: "all", label: "All", icon: "📋" },
                { id: "received", label: "Received", icon: "💰" },
                { id: "sent", label: "Sent", icon: "💸" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    filterType === f.id ? "scale-105 shadow-lg" : "hover:scale-105"
                  }`}
                  style={{
                    background: filterType === f.id 
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${filterType === f.id ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                    color: filterType === f.id ? "#fff" : "#9ca3af",
                  }}>
                  <span className="text-sm font-bold">{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 relative group">
            <input
              type="text"
              placeholder="🔍 Search transactions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="relative w-full px-4 py-2 pl-10 rounded-lg text-sm text-white outline-none transition-all duration-300"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
          </div>

          {/* Payments List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">💳</div>
                <p className="text-gray-500 text-sm">No transactions found</p>
              </div>
            ) : (
              filteredPayments.slice(0, 10).map((payment) => {
                const date = payment.createdAt?.toDate ? payment.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
                const isReceived = payment.type === "received";
                return (
                  <div key={payment.id} 
                    className="flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:scale-[1.01]"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0`}
                        style={{ 
                          background: isReceived ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          border: `1px solid ${isReceived ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                          color: isReceived ? "#10b981" : "#ef4444"
                        }}>
                        {isReceived ? "💰" : "💸"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-semibold truncate">
                          {payment.customer || payment.description || "Payment"}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {payment.invoiceNumber || "Direct"} • {date} • {payment.method || "Cash"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isReceived ? "text-green-400" : "text-red-400"}`}>
                          {isReceived ? "+" : "-"} Rs. {Number(payment.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-gray-600 text-[10px]">{payment.status || "Completed"}</p>
                      </div>
                      <button onClick={() => handleDelete(payment.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all text-sm">
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
