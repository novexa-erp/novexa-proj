"use client";
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const cardStyle = { 
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

export default function PurchasesView({ uid }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPurchase, setEditPurchase] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (uid) loadPurchases();
  }, [uid]);

  async function loadPurchases() {
    try {
      const snap = await getDocs(collection(db, `users/${uid}/purchases`));
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }

  async function handleSave(purchaseData) {
    try {
      if (editPurchase) {
        await updateDoc(doc(db, `users/${uid}/purchases`, editPurchase.id), {
          ...purchaseData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, `users/${uid}/purchases`), {
          ...purchaseData,
          createdAt: serverTimestamp(),
        });
      }
      await loadPurchases();
      closeModal();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this purchase?")) return;
    try {
      await deleteDoc(doc(db, `users/${uid}/purchases`, id));
      loadPurchases();
    } catch (err) {
      alert("Delete error: " + err.message);
    }
  }

  function openAddModal() {
    setEditPurchase(null);
    setShowAddModal(true);
  }

  function openEditModal(purchase) {
    setEditPurchase(purchase);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditPurchase(null);
  }

  const filteredPurchases = purchases.filter(p => 
    p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brandName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const totalPending = purchases.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);
  const purchaseCount = purchases.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-green-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🛒</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Purchase Management
            </h2>
            <p className="text-gray-400 text-xs">Track all your purchases and supplier payments</p>
          </div>
          
          <button onClick={openAddModal}
            className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 flex items-center gap-2 text-white">
              <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
              Add Purchase
            </span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", value: `Rs. ${totalPurchases.toLocaleString()}`, icon: "🛒", color: "from-blue-500 to-indigo-600" },
          { label: "Total Paid", value: `Rs. ${totalPaid.toLocaleString()}`, icon: "💵", color: "from-green-500 to-emerald-600" },
          { label: "Total Pending", value: `Rs. ${totalPending.toLocaleString()}`, icon: "⏳", color: "from-orange-500 to-red-600" },
          { label: "Purchase Count", value: purchaseCount, icon: "📦", color: "from-purple-500 to-pink-600" },
        ].map((stat, i) => (
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
              <p className="text-white font-bold text-2xl">{stat.value}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative group">
        <input
          type="text"
          placeholder="🔍 Search purchases..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="relative w-full px-4 py-2.5 pl-10 rounded-lg text-sm text-white outline-none transition-all duration-300"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
      </div>

      {/* Purchases List */}
      {filteredPurchases.length === 0 ? (
        <div className="rounded-xl p-16 text-center relative overflow-hidden" style={cardStyle}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5" />
          <div className="relative z-10">
            <div className="text-6xl mb-4 font-bold">🛒</div>
            <h3 className="text-white font-bold text-xl mb-2">
              {searchQuery ? "No matches found" : "No purchases yet"}
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No purchases match "${searchQuery}"`
                : "Start tracking your purchases from suppliers"
              }
            </p>
            {!searchQuery && (
              <button onClick={openAddModal}
                className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff" }}>
                + Add First Purchase
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPurchases.map((purchase, idx) => (
            <PurchaseCard 
              key={purchase.id} 
              purchase={purchase} 
              onEdit={() => openEditModal(purchase)} 
              onDelete={() => handleDelete(purchase.id)}
              index={idx}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddPurchaseModal 
          purchase={editPurchase} 
          onSave={handleSave} 
          onClose={closeModal} 
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

// Purchase Card Component
function PurchaseCard({ purchase, onEdit, onDelete, index }) {
  const balance = Number(purchase.balance) || 0;
  const totalAmount = Number(purchase.totalAmount) || 0;
  const paidAmount = Number(purchase.paidAmount) || 0;
  const paidPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <div 
      className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
      style={{ 
        ...cardStyle, 
        animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`,
      }}>
      
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      
      {/* Status Badge */}
      <div className="absolute top-3 right-3 z-20">
        <div className={`px-2 py-1 rounded-md text-[10px] font-semibold backdrop-blur-lg transition-all duration-300 group-hover:scale-110 ${
          balance === 0 ? "bg-green-500/20 text-green-300 border border-green-400/40" :
          paidAmount > 0 ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/40" :
          "bg-red-500/20 text-red-300 border border-red-400/40"
        }`}>
          {balance === 0 ? "✅ Paid" : paidAmount > 0 ? "⚡ Partial" : "⏳ Pending"}
        </div>
      </div>

      {/* Product Image */}
      <div className="relative h-40 overflow-hidden">
        {purchase.imageUrl ? (
          <img 
            src={purchase.imageUrl} 
            alt={purchase.productName} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/20 to-purple-900/20">
            <span className="text-4xl group-hover:scale-110 transition-all duration-300">📦</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative p-4 space-y-2.5">
        
        {/* Supplier Info */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">👤</span>
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
              Supplier
            </span>
          </div>
          <h3 className="text-white font-bold text-base line-clamp-1">
            {purchase.supplierName}
          </h3>
          <p className="text-gray-500 text-[11px]">
            {purchase.supplierPhone} {purchase.supplierEmail && `• ${purchase.supplierEmail}`}
          </p>
        </div>

        {/* Product Info */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">📦</span>
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
              Product
            </span>
          </div>
          <p className="text-white font-semibold text-sm">{purchase.productName}</p>
          {purchase.brandName && (
            <p className="text-gray-500 text-xs">Brand: {purchase.brandName}</p>
          )}
          <p className="text-gray-400 text-xs">Quantity: {purchase.quantity} {purchase.unit || "units"}</p>
        </div>

        {/* Payment Info */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-xs">Total Amount</span>
            <span className="text-white font-bold text-sm">Rs. {totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-xs">Paid</span>
            <span className="text-green-400 font-semibold text-sm">Rs. {paidAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-xs">Balance</span>
            <span className={`font-bold text-sm ${balance > 0 ? "text-red-400" : "text-green-400"}`}>
              Rs. {balance.toLocaleString()}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
            <div 
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-green-500 to-emerald-600"
              style={{ width: `${paidPercentage}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/5">
          <button onClick={onEdit}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105"
            style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.25))", border: "1px solid rgba(59,130,246,0.4)", color: "#60A5FA" }}>
            ✎ Edit
          </button>
          <button onClick={onDelete}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105"
            style={{ background: "linear-gradient(135deg, rgba(248,113,113,0.1), rgba(239,68,68,0.2))", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
            🗑️ Delete
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}


// Add/Edit Purchase Modal
function AddPurchaseModal({ purchase, onSave, onClose }) {
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    supplierName: purchase?.supplierName || "",
    supplierPhone: purchase?.supplierPhone || "",
    supplierEmail: purchase?.supplierEmail || "",
    brandName: purchase?.brandName || "",
    productName: purchase?.productName || "",
    quantity: purchase?.quantity || "",
    unit: purchase?.unit || "units",
    unitPrice: purchase?.unitPrice || "",
    totalAmount: purchase?.totalAmount || "",
    paidAmount: purchase?.paidAmount || "",
    balance: purchase?.balance || "",
    imageUrl: purchase?.imageUrl || "",
    paymentHistory: purchase?.paymentHistory || [],
  });

  const [newPayment, setNewPayment] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    receiverName: "",
    receiverPhone: "",
    notes: "",
  });

  const [showPaymentSection, setShowPaymentSection] = useState(false);

  // Auto-calculate totals
  useEffect(() => {
    const quantity = Number(formData.quantity) || 0;
    const unitPrice = Number(formData.unitPrice) || 0;
    const total = quantity * unitPrice;
    const paid = Number(formData.paidAmount) || 0;
    const balance = total - paid;
    
    setFormData(prev => ({
      ...prev,
      totalAmount: total,
      balance: balance > 0 ? balance : 0,
    }));
  }, [formData.quantity, formData.unitPrice, formData.paidAmount]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large - max 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setFormData(f => ({ ...f, imageUrl: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function addPayment() {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }
    if (!newPayment.receiverName) {
      alert("Please enter receiver name");
      return;
    }
    
    const paymentAmount = Number(newPayment.amount);
    const currentPaid = Number(formData.paidAmount) || 0;
    const newPaidTotal = currentPaid + paymentAmount;
    
    if (newPaidTotal > formData.totalAmount) {
      alert("Payment amount exceeds total amount");
      return;
    }

    setFormData(f => ({
      ...f,
      paidAmount: newPaidTotal,
      balance: f.totalAmount - newPaidTotal,
      paymentHistory: [...f.paymentHistory, { ...newPayment, timestamp: new Date().toISOString() }],
    }));

    setNewPayment({
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      receiverName: "",
      receiverPhone: "",
      notes: "",
    });
    setShowPaymentSection(false);
  }

  function removePayment(index) {
    const removedPayment = formData.paymentHistory[index];
    const newPaidTotal = (Number(formData.paidAmount) || 0) - (Number(removedPayment.amount) || 0);
    
    setFormData(f => ({
      ...f,
      paidAmount: newPaidTotal,
      balance: f.totalAmount - newPaidTotal,
      paymentHistory: f.paymentHistory.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.supplierName || !formData.productName) {
      alert("Please fill required fields");
      return;
    }
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn" 
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-bold text-xl mb-0.5">
              {purchase ? "✎ Edit Purchase" : "🛒 New Purchase"}
            </h3>
            <p className="text-gray-500 text-xs">Fill in the purchase details</p>
          </div>
          <button onClick={onClose} 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all text-2xl font-bold">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Supplier Information */}
          <div className="p-4 rounded-lg" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              👤 Supplier Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABC Traders"
                  value={formData.supplierName}
                  onChange={e => setFormData(f => ({ ...f, supplierName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  📞 Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+92 300 1234567"
                  value={formData.supplierPhone}
                  onChange={e => setFormData(f => ({ ...f, supplierPhone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  📧 Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="supplier@example.com"
                  value={formData.supplierEmail}
                  onChange={e => setFormData(f => ({ ...f, supplierEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="p-4 rounded-lg" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}>
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              📦 Product Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cotton Fabric"
                  value={formData.productName}
                  onChange={e => setFormData(f => ({ ...f, productName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Brand Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. XYZ Brand"
                  value={formData.brandName}
                  onChange={e => setFormData(f => ({ ...f, brandName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Quantity *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Unit
                </label>
                <select
                  value={formData.unit}
                  onChange={e => setFormData(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <option value="units">Units</option>
                  <option value="kg">Kg</option>
                  <option value="m">Meters</option>
                  <option value="pcs">Pieces</option>
                  <option value="boxes">Boxes</option>
                  <option value="cartons">Cartons</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Unit Price (Rs.) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.unitPrice}
                  onChange={e => setFormData(f => ({ ...f, unitPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Total Amount (Rs.)
                </label>
                <input
                  type="number"
                  value={formData.totalAmount}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", cursor: "not-allowed" }}
                />
              </div>
            </div>
          </div>

          {/* Product Image */}
          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-2 block">
              📸 Product Image (Optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.15)" }}>
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">Change</span>
                    </div>
                  </>
                ) : (
                  <span className="text-3xl font-bold">📦</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.25))", border: "1px solid rgba(59,130,246,0.4)", color: "#60A5FA" }}>
                  {formData.imageUrl ? "📷 Change" : "📤 Upload"}
                </button>
                {formData.imageUrl && (
                  <button type="button" onClick={() => setFormData(f => ({ ...f, imageUrl: "" }))}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    🗑️ Remove
                  </button>
                )}
                <p className="text-gray-600 text-[10px]">Max 2MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-4 rounded-lg" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              💰 Payment Information
            </h4>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Total Amount
                </label>
                <div className="px-4 py-2.5 rounded-lg text-sm text-white font-bold"
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  Rs. {Number(formData.totalAmount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Paid Amount
                </label>
                <div className="px-4 py-2.5 rounded-lg text-sm text-green-400 font-bold"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  Rs. {Number(formData.paidAmount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  Balance
                </label>
                <div className={`px-4 py-2.5 rounded-lg text-sm font-bold ${formData.balance > 0 ? "text-red-400" : "text-green-400"}`}
                  style={{ background: formData.balance > 0 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${formData.balance > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}` }}>
                  Rs. {Number(formData.balance || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Add Payment Button */}
            {formData.balance > 0 && (
              <button
                type="button"
                onClick={() => setShowPaymentSection(!showPaymentSection)}
                className="w-full px-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] mb-3"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.25))", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>
                {showPaymentSection ? "❌ Cancel Payment" : "💳 Add Payment"}
              </button>
            )}

            {/* Add Payment Form */}
            {showPaymentSection && (
              <div className="p-3 rounded-lg mb-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-white text-xs font-semibold mb-2">Record Payment</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <div>
                    <input
                      type="number"
                      placeholder="Payment Amount (Rs.)"
                      value={newPayment.amount}
                      onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={newPayment.date}
                      onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Receiver Name *"
                      value={newPayment.receiverName}
                      onChange={e => setNewPayment(p => ({ ...p, receiverName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Receiver Phone"
                      value={newPayment.receiverPhone}
                      onChange={e => setNewPayment(p => ({ ...p, receiverPhone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="Payment notes (optional)"
                      value={newPayment.notes}
                      onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addPayment}
                  className="w-full px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff" }}>
                  ✅ Record Payment
                </button>
              </div>
            )}

            {/* Payment History */}
            {formData.paymentHistory.length > 0 && (
              <div>
                <p className="text-white text-xs font-semibold mb-2">Payment History</p>
                <div className="space-y-2">
                  {formData.paymentHistory.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex-1">
                        <p className="text-white text-xs font-semibold">Rs. {Number(payment.amount).toLocaleString()}</p>
                        <p className="text-gray-500 text-[10px]">
                          {payment.receiverName} {payment.receiverPhone && `• ${payment.receiverPhone}`}
                        </p>
                        <p className="text-gray-600 text-[10px]">{new Date(payment.date).toLocaleDateString()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePayment(index)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all text-xs">
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff" }}>
              {purchase ? "✅ Update" : "✅ Save"} Purchase
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
