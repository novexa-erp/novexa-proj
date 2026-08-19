"use client";
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";
import LocationsManager, { getLocationIcon, getLocationLabel } from "./LocationsManager";

const cardStyle = { 
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

const VARIANT_TYPES = [
  { id: "none",       label: "No Variants",   icon: "📦", gradient: "from-orange-500 to-amber-600" },
  { id: "weight",     label: "Weight-based",  icon: "⚖️", unit: "kg", presets: ["0.25", "0.5", "0.75", "1", "2", "5"], gradient: "from-pink-500 to-rose-600" },
  { id: "length",     label: "Length-based",  icon: "📏", unit: "m",  presets: ["1", "2", "3", "5", "10"], gradient: "from-purple-500 to-pink-600" },
  { id: "size",       label: "Size",          icon: "👕", presets: ["XS", "S", "M", "L", "XL", "XXL"], gradient: "from-orange-500 to-pink-600" },
  { id: "size_range", label: "Size Range",    icon: "📐", gradient: "from-blue-500 to-cyan-600" },
  { id: "custom",     label: "Custom",        icon: "⚙️", gradient: "from-amber-500 to-orange-600" },
];

const VALID_VARIANT_IDS = new Set(VARIANT_TYPES.map(t => t.id));

const PRODUCT_CATEGORIES = [
  "Clothing & Apparel",
  "Electronics",
  "Food & Grocery",
  "Vegetables & Fruits",
  "Dairy Products",
  "Beverages",
  "Software",
  "Books & Stationery",
  "Furniture",
  "Hardware & Tools",
  "Health & Medicine",
  "Cosmetics & Beauty",
  "Shoes & Footwear",
  "Sports & Fitness",
  "Toys & Games",
  "Automotive",
  "Other",
];

export default function InventoryView({ uid, locations = [] }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });
  const [showLocationsManager, setShowLocationsManager] = useState(false);

  useEffect(() => {
    if (uid) loadProducts();
  }, [uid]);

  async function loadProducts() {
    try {
      const snap = await getDocs(collection(db, `users/${uid}/products`));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted));
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }

  async function handleSave(productData) {
    try {
      if (editProduct) {
        await updateDoc(doc(db, `users/${uid}/products`, editProduct.id), {
          ...productData,
          updatedAt: serverTimestamp(),
        });
        setAlert({ show: true, type: "success", title: "Product Updated! ✓", message: `"${productData.name}" has been updated successfully.` });
      } else {
        await addDoc(collection(db, `users/${uid}/products`), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        setAlert({ show: true, type: "success", title: "Product Added! 📦", message: `"${productData.name}" has been added to inventory.` });
      }
      await loadProducts();
      closeModal();
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Save Failed", message: err.message });
    }
  }

  async function handleDelete(id) {
    // Show SweetAlert confirm dialog
    const prod = products.find(p => p.id === id);
    setDeleteConfirm({ id, name: prod?.name || "this product" });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await updateDoc(doc(db, `users/${uid}/products`, deleteConfirm.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      setAlert({ show: true, type: "success", title: "Product Deleted 🗑️", message: `"${deleteConfirm.name}" has been moved to trash.` });
      loadProducts();
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Delete Failed", message: err.message });
    }
    setDeleteConfirm(null);
  }

  function openAddModal() {
    setEditProduct(null);
    setShowAddModal(true);
  }

  function openEditModal(prod) {
    setEditProduct(prod);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditProduct(null);
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || p.variantType === filterType;
    const matchesLocation = filterLocation === "all" || (filterLocation === "none" ? !p.locationId : p.locationId === filterLocation);
    return matchesSearch && matchesFilter && matchesLocation;
  });

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => {
    if (p.variantType !== "none" && p.variants?.length > 0) {
      return sum + p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
    }
    return sum + (parseInt(p.stock) || 0);
  }, 0);
  const lowStockCount = products.filter(p => {
    const stock = p.variantType !== "none" && p.variants?.length > 0
      ? p.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
      : parseInt(p.stock) || 0;
    return stock < 10;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">📦</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* SweetAlert */}
      <SweetAlert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, show: false })}
      />

      {/* Locations Manager */}
      {showLocationsManager && (
        <LocationsManager
          uid={uid}
          locations={locations}
          onClose={() => setShowLocationsManager(false)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <p className="text-4xl">🗑️</p>
            <h3 className="text-white font-bold text-lg">Delete Product?</h3>
            <p className="text-gray-400 text-sm">
              <span className="text-white font-semibold">&quot;{deleteConfirm.name}&quot;</span> This invoice will be moved to Trash. You can restore it within 15 days from the Trash section. After 15 days, it will be permanently deleted.
            </p>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-pink-500/5 to-purple-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Inventory Management
            </h2>
            <p className="text-gray-400 text-xs">Track and manage your product inventory</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowLocationsManager(true)}
              className="group relative px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
              <span className="relative z-10 flex items-center gap-2 font-bold">
                <span className="text-base">📍</span>
                Manage Locations
                {(locations || []).filter(l => !l.deleted).length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(99,102,241,0.3)", color: "#c7d2fe" }}>
                    {(locations || []).filter(l => !l.deleted).length}
                  </span>
                )}
              </span>
            </button>
            <button onClick={openAddModal}
              className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-2 text-black font-bold">
                <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
                Add Product
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Professional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Products", value: totalProducts, icon: "📦", color: "from-orange-500 to-amber-600" },
          { label: "Total Stock", value: totalStock, icon: "📊", color: "from-pink-500 to-purple-600" },
          { label: "Low Stock", value: lowStockCount, icon: "⚠️", color: "from-rose-500 to-red-600" },
        ].map((stat, i) => (
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
              <p className="text-white font-bold text-2xl">{stat.value}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-300" />
          <input
            type="text"
            placeholder="🔍 Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="relative w-full px-4 py-2.5 pl-10 rounded-lg text-sm text-white outline-none transition-all duration-300"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ id: "all", label: "All", icon: "📋" }, ...VARIANT_TYPES].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                filterType === f.id ? "scale-105 shadow-lg" : "hover:scale-105"
              }`}
              style={{
                background: filterType === f.id 
                  ? "linear-gradient(135deg, #F59E0B, #D97706)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${filterType === f.id ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                color: filterType === f.id ? "#000" : "#9ca3af",
              }}>
              <span className="text-sm font-bold">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location Filter (only show if locations exist) */}
      {(locations || []).filter(l => !l.deleted).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all",  label: "All Locations", icon: "📍" },
            { id: "none", label: "No Location",   icon: "❓" },
            ...(locations || []).filter(l => !l.deleted).map(l => ({
              id: l.id, label: l.name, icon: getLocationIcon(l.type),
            })),
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterLocation(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                filterLocation === f.id ? "scale-105 shadow-lg" : "hover:scale-105"
              }`}
              style={{
                background: filterLocation === f.id
                  ? "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(99,102,241,0.2))"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${filterLocation === f.id ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
                color: filterLocation === f.id ? "#c7d2fe" : "#9ca3af",
              }}>
              <span className="text-sm">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-xl p-16 text-center relative overflow-hidden" style={cardStyle}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5" />
          <div className="relative z-10">
            <div className="text-6xl mb-4 font-bold">{searchQuery ? "⌕" : "□"}</div>
            <h3 className="text-white font-bold text-xl mb-2">
              {searchQuery ? "No matches found" : "Your inventory is empty"}
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No products match "${searchQuery}"`
                : "Start by adding your first product"
              }
            </p>
            {!searchQuery && (
              <button onClick={openAddModal}
                className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
                + Create First Product
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((prod, idx) => (
            <ProductCard 
              key={prod.id} 
              product={prod} 
              locations={locations}
              onEdit={() => openEditModal(prod)} 
              onDelete={() => handleDelete(prod.id)}
              index={idx}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddProductModal product={editProduct} locations={locations} onSave={handleSave} onClose={closeModal} />
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


// ═══════════════════════════════════════════════════════════════════════════
// Product Card - Professional & Animated
// ═══════════════════════════════════════════════════════════════════════════
function ProductCard({ product, locations = [], onEdit, onDelete, index }) {
  const hasVariants = product.variantType !== "none" && product.variants?.length > 0;
  const totalStock = hasVariants
    ? product.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
    : parseInt(product.stock) || 0;

  const variantTypeInfo = VARIANT_TYPES.find(t => t.id === product.variantType) || VARIANT_TYPES[0];

  return (
    <div 
      className="group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
      style={{ 
        ...cardStyle, 
        animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`,
      }}>
      
      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${variantTypeInfo.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      
      {/* Stock Badge */}
      <div className="absolute top-3 right-3 z-20">
        <div className={`px-2 py-1 rounded-md text-[10px] font-semibold backdrop-blur-lg transition-all duration-300 group-hover:scale-110 ${
          totalStock > 10 ? "bg-green-500/20 text-green-300 border border-green-400/40" :
          totalStock > 0 ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/40" :
          "bg-red-500/20 text-red-300 border border-red-400/40"
        }`}>
          {totalStock} units
        </div>
      </div>

      {/* Product Image */}
      <div className="relative h-40 overflow-hidden">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-pink-900/20">
            <span className="text-4xl group-hover:scale-110 transition-all duration-300">
              {variantTypeInfo.icon}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative p-4 space-y-2.5">
        
        {/* Name & Type */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{variantTypeInfo.icon}</span>
            <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-wide">
              {variantTypeInfo.label}
            </span>
          </div>
          <h3 className="text-white font-bold text-base line-clamp-1 group-hover:text-amber-400 transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-gray-500 text-[11px] line-clamp-2 mt-1">{product.description}</p>
          )}
          {product.category && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
              🗂️ {product.category}
            </span>
          )}
          {/* Location badge */}
          {product.locationId && (() => {
            const loc = (locations || []).find(l => l.id === product.locationId && !l.deleted);
            if (!loc) return null;
            return (
              <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
                {getLocationIcon(loc.type)} {loc.name}
              </span>
            );
          })()}
        </div>

        {/* Variants Preview */}
        {hasVariants ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {product.variants.length} variants
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.slice(0, 3).map((v, i) => (
                <div key={i} className="px-2 py-1 rounded text-[10px] font-medium bg-white/5 text-gray-300 border border-white/10">
                  {v.label}: <span className="text-amber-400 font-semibold">Rs. {v.sellingPrice || v.price}</span>
                </div>
              ))}
              {product.variants.length > 3 && (
                <div className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  +{product.variants.length - 3}
                </div>
              )}
            </div>
          </div>
        ) : (
          product.sellingPrice && (
            <div className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Rs. {product.sellingPrice}
            </div>
          )
        )}

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
            ⌫ Delete
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


// ═══════════════════════════════════════════════════════════════════════════
// Add/Edit Product Modal
// ═══════════════════════════════════════════════════════════════════════════
function AddProductModal({ product, locations = [], onSave, onClose }) {
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    category: product?.category || "",
    imageUrl: product?.imageUrl || "",
    locationId: product?.locationId || "",
    // normalize variantType — unknown types → "custom", undefined → "none"
    variantType: (() => {
      const vt = product?.variantType || "none";
      if (VALID_VARIANT_IDS.has(vt)) return vt;
      // If has variants but unknown type → custom
      if (product?.variants?.length > 0) return "custom";
      return "none";
    })(),
    // normalize existing variants — add sellingPrice/costPrice fallback
    variants: (product?.variants || []).map(v => ({
      ...v,
      sellingPrice: v.sellingPrice || v.price || "",
      costPrice: v.costPrice || "",
    })),
    price: product?.price || "",
    // fallback: sellingPrice → price (for products created before this field existed)
    costPrice: product?.costPrice || "",
    sellingPrice: product?.sellingPrice || product?.price || "",
    stock: product?.stock || "",
  });

  const [newVariant, setNewVariant] = useState({ label: "", costPrice: "", sellingPrice: "", stock: "" });
  // Base prices per unit (e.g. per 1 kg) — used to auto-calculate variant prices
  const [baseSellingPrice, setBaseSellingPrice] = useState("");
  const [baseCostPrice,    setBaseCostPrice]    = useState("");
  const selectedType = VARIANT_TYPES.find(t => t.id === formData.variantType);
  const hasVariants = formData.variantType !== "none";

  // ── Size Range state ─────────────────────────────────────────────────────────
  const [srFrom,  setSrFrom]  = useState("28");
  const [srTo,    setSrTo]    = useState("46");
  const [srStep,  setSrStep]  = useState("2");
  const [srPrice, setSrPrice] = useState("");
  const [srCost,  setSrCost]  = useState("");

  function generateSizeRange() {
    const from = parseInt(srFrom);
    const to   = parseInt(srTo);
    const step = parseInt(srStep) || 2;
    const sp   = srPrice;
    const cp   = srCost;
    if (isNaN(from) || isNaN(to) || from >= to) {
      alert("Please enter valid From/To sizes"); return;
    }
    const generated = [];
    for (let s = from; s <= to; s += step) {
      // Only add if not already in variants
      const lbl = String(s);
      if (!formData.variants.find(v => v.label === lbl)) {
        generated.push({ label: lbl, costPrice: cp, sellingPrice: sp, price: sp, stock: "0" });
      }
    }
    if (generated.length === 0) { alert("All sizes already added"); return; }
    setFormData(f => ({ ...f, variants: [...f.variants, ...generated] }));
  }

  // Auto-calculate variant prices from base price when label changes
  function handleNewVariantLabelChange(label) {
    const num = parseFloat(label);
    const multiplier = (!isNaN(num) && num > 0) ? num : null;

    setNewVariant(v => {
      const updated = { ...v, label };
      if (multiplier !== null) {
        const sp = parseFloat(baseSellingPrice);
        const cp = parseFloat(baseCostPrice);
        if (!isNaN(sp) && sp > 0) updated.sellingPrice = String(Math.round(sp * multiplier * 100) / 100);
        if (!isNaN(cp) && cp > 0) updated.costPrice    = String(Math.round(cp * multiplier * 100) / 100);
      }
      return updated;
    });
  }

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

  function addVariant() {
    if (!newVariant.label || !newVariant.sellingPrice) {
      alert("Please enter variant label and selling price");
      return;
    }
    setFormData(f => ({
      ...f,
      variants: [...f.variants, { ...newVariant, price: newVariant.sellingPrice }],
    }));
    setNewVariant({ label: "", costPrice: "", sellingPrice: "", stock: "" });
  }

  function removeVariant(index) {
    setFormData(f => ({
      ...f,
      variants: f.variants.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name) {
      alert("Product name is required");
      return;
    }
    if (hasVariants && formData.variants.length === 0) {
      alert("Please add at least one variant");
      return;
    }
    if (!hasVariants && !formData.sellingPrice) {
      alert("Please enter selling price");
      return;
    }
    if (!hasVariants && !formData.costPrice) {
      alert("Please enter cost price");
      return;
    }
    // keep price in sync with sellingPrice for backward compatibility
    onSave({ ...formData, price: formData.sellingPrice });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn" 
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-bold text-xl mb-0.5">
              {product ? "✎ Edit Product" : "⊕ New Product"}
            </h3>
            <p className="text-gray-500 text-xs">Fill in the details below</p>
          </div>
          <button onClick={onClose} 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all text-2xl font-bold">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Image Upload */}
          <div className="relative group">
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-2 block">
              ⬒ Product Image
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center group"
                style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.15)" }}>
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">Change</span>
                    </div>
                  </>
                ) : (
                  <span className="text-3xl font-bold">□</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.25))", border: "1px solid rgba(59,130,246,0.4)", color: "#60A5FA" }}>
                  {formData.imageUrl ? "↻ Change" : "⇑ Upload"}
                </button>
                {formData.imageUrl && (
                  <button type="button" onClick={() => setFormData(f => ({ ...f, imageUrl: "" }))}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    ⌫ Remove
                  </button>
                )}
                <p className="text-gray-600 text-[10px]">Max 2MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              ▣ Product Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Fresh Milk, Cotton Fabric"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all duration-300 focus:scale-[1.01]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              ≡ Description (Optional)
            </label>
            <textarea
              placeholder="Brief description..."
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none resize-none transition-all duration-300"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
              🗂️ Category
            </label>
            <div className="flex gap-2">
              <select
                value={formData.category}
                onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all duration-300 focus:scale-[1.01]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="" style={{ background: "#0d1117", color: "#9ca3af" }}>— Select Category —</option>
                {PRODUCT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} style={{ background: "#0d1117", color: "#fff" }}>{cat}</option>
                ))}
              </select>
              {/* Custom category input — shown when "Other" selected or when product has a non-list category */}
              {(formData.category === "Other" || (formData.category && !PRODUCT_CATEGORIES.includes(formData.category))) && (
                <input
                  type="text"
                  placeholder="Type category name"
                  value={PRODUCT_CATEGORIES.includes(formData.category) ? "" : formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all duration-300"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          </div>

          {/* Location */}
          {(locations || []).filter(l => !l.deleted).length > 0 && (
            <div>
              <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                📍 Location (Shop / Warehouse)
              </label>
              <select
                value={formData.locationId}
                onChange={e => setFormData(f => ({ ...f, locationId: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="" style={{ background: "#0d1117", color: "#9ca3af" }}>— No Specific Location —</option>
                {(locations || []).filter(l => !l.deleted).map(loc => (
                  <option key={loc.id} value={loc.id} style={{ background: "#0d1117", color: "#fff" }}>
                    {getLocationIcon(loc.type)} {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Variant Type */}
          <div>
            <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-2 block">
              ⚙ Product Type *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {VARIANT_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, variantType: type.id, variants: [] }))}
                  className={`group relative p-3 rounded-lg text-xs font-semibold transition-all duration-300 overflow-hidden ${
                    formData.variantType === type.id
                      ? "scale-105 shadow-lg"
                      : "hover:scale-105"
                  }`}
                  style={{
                    background: formData.variantType === type.id
                      ? "linear-gradient(135deg, #F59E0B, #D97706)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${formData.variantType === type.id ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                    color: formData.variantType === type.id ? "#000" : "#9ca3af",
                  }}>
                  <div className="text-xl mb-1 font-bold">
                    {type.icon}
                  </div>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Product Inputs */}
          {!hasVariants && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  💰 Cost Price (Rs.) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={formData.costPrice}
                  onChange={e => setFormData(f => ({ ...f, costPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  ₨ Selling Price (Rs.) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={formData.sellingPrice}
                  onChange={e => setFormData(f => ({ ...f, sellingPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-gray-300 text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">
                  ▦ Stock
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={formData.stock}
                  onChange={e => setFormData(f => ({ ...f, stock: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>
          )}

          {/* Variants */}
          {hasVariants && (
            <div className="space-y-3">
              <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">
                ⊞ Variants {selectedType && `(${selectedType.label})`}
              </label>

              {/* ── Size Range UI ── */}
              {formData.variantType === "size_range" && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.04)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(59,130,246,0.15)", background: "rgba(59,130,246,0.08)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#60A5FA" }}>📐 Size Range Generator</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Sizes automatically generate karein — e.g. 28 to 46 step 2</p>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    {/* From / To / Step */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">From (start)</label>
                        <input type="number" inputMode="numeric" min="1" placeholder="28"
                          value={srFrom} onChange={e => setSrFrom(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none text-center font-bold"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(59,130,246,0.3)" }} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">To (end)</label>
                        <input type="number" inputMode="numeric" min="1" placeholder="46"
                          value={srTo} onChange={e => setSrTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none text-center font-bold"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(59,130,246,0.3)" }} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Step</label>
                        <input type="number" inputMode="numeric" min="1" placeholder="2"
                          value={srStep} onChange={e => setSrStep(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none text-center font-bold"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(59,130,246,0.3)" }} />
                      </div>
                    </div>

                    {/* Preview of sizes */}
                    {srFrom && srTo && srStep && parseInt(srFrom) < parseInt(srTo) && (
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const sizes = [];
                          for (let s = parseInt(srFrom); s <= parseInt(srTo); s += parseInt(srStep) || 2) sizes.push(s);
                          return sizes.map(s => (
                            <span key={s} className="px-2 py-1 rounded-lg text-[11px] font-bold"
                              style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}>
                              {s}
                            </span>
                          ));
                        })()}
                      </div>
                    )}

                    {/* Price inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">💰 Cost Price (Rs.) — all sizes</label>
                        <input type="number" inputMode="decimal" placeholder="e.g. 150"
                          value={srCost} onChange={e => setSrCost(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(59,130,246,0.25)" }} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">₨ Selling Price (Rs.) — all sizes</label>
                        <input type="number" inputMode="decimal" placeholder="e.g. 200"
                          value={srPrice} onChange={e => setSrPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(59,130,246,0.25)" }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-600">Price baad mein har size pe alag bhi set kar sakte ho.</p>

                    <button type="button" onClick={generateSizeRange}
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                      style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "#fff" }}>
                      ⚡ Generate Sizes ({srFrom}–{srTo} step {srStep})
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Presets */}
              {selectedType?.presets && (
                <div>
                  <p className="text-gray-600 text-[10px] mb-1.5 font-medium">⚡ Quick Add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedType.presets.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleNewVariantLabelChange(
                          selectedType.unit ? `${preset} ${selectedType.unit}` : String(preset)
                        )}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                        style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B" }}>
                        {preset} {selectedType.unit || ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Variant Form */}
              <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

                {/* Base price per unit — shown once, used to auto-calculate all variants */}
                <div className="mb-3 p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">
                    📐 Base Price per {selectedType?.unit || "unit"} (for auto-calculation)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">💰 Cost Price / {selectedType?.unit || "unit"}</label>
                      <input
                        type="number" inputMode="decimal"
                        placeholder={`e.g. 200 per ${selectedType?.unit || "unit"}`}
                        value={baseCostPrice}
                        onChange={e => {
                          setBaseCostPrice(e.target.value);
                          // recalc current label if set
                          const num = parseFloat(newVariant.label);
                          if (!isNaN(num) && num > 0) {
                            const cp = parseFloat(e.target.value);
                            if (!isNaN(cp) && cp > 0)
                              setNewVariant(v => ({ ...v, costPrice: String(Math.round(cp * num * 100) / 100) }));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">₨ Selling Price / {selectedType?.unit || "unit"}</label>
                      <input
                        type="number" inputMode="decimal"
                        placeholder={`e.g. 250 per ${selectedType?.unit || "unit"}`}
                        value={baseSellingPrice}
                        onChange={e => {
                          setBaseSellingPrice(e.target.value);
                          const num = parseFloat(newVariant.label);
                          if (!isNaN(num) && num > 0) {
                            const sp = parseFloat(e.target.value);
                            if (!isNaN(sp) && sp > 0)
                              setNewVariant(v => ({ ...v, sellingPrice: String(Math.round(sp * num * 100) / 100) }));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    Enter the price per 1 {selectedType?.unit || "unit"} — variant prices will be calculated automatically.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder={selectedType?.unit ? `e.g. 0.5 ${selectedType.unit}` : "e.g. Medium"}
                      value={newVariant.label}
                      onChange={e => handleNewVariantLabelChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    {/* Show auto-calculated hint */}
                    {newVariant.label && parseFloat(newVariant.label) > 0 && (baseSellingPrice || baseCostPrice) && (
                      <p className="text-[10px] text-amber-400 mt-1 px-1">
                        ⚡ Auto: {parseFloat(newVariant.label)} × base price
                        {baseCostPrice ? ` → Cost: Rs. ${newVariant.costPrice}` : ""}
                        {baseSellingPrice ? ` → Selling: Rs. ${newVariant.sellingPrice}` : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">💰 Cost Price (editable)</label>
                    <input
                      type="number" inputMode="decimal"
                      placeholder="Cost Price (Rs.)"
                      value={newVariant.costPrice}
                      onChange={e => setNewVariant(v => ({ ...v, costPrice: e.target.value }))}
                      className="px-3 py-2 rounded-lg text-xs text-white outline-none w-full"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">₨ Selling Price (editable)</label>
                    <input
                      type="number" inputMode="decimal"
                      placeholder="Selling Price (Rs.)"
                      value={newVariant.sellingPrice}
                      onChange={e => setNewVariant(v => ({ ...v, sellingPrice: e.target.value }))}
                      className="px-3 py-2 rounded-lg text-xs text-white outline-none w-full"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <input
                    type="number" inputMode="numeric"
                    placeholder="Stock"
                    value={newVariant.stock}
                    onChange={e => setNewVariant(v => ({ ...v, stock: e.target.value }))}
                    className="px-3 py-2 rounded-lg text-xs text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addVariant}
                  className="w-full px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.25))", border: "1px solid rgba(59,130,246,0.4)", color: "#60A5FA" }}>
                  + Add Variant
                </button>
              </div>

              {/* Variants List */}
              {formData.variants.length > 0 && (
                <div className="space-y-2">
                  {/* Size Range: compact grid view with inline stock editing */}
                  {formData.variantType === "size_range" ? (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-widest">Har size ka stock alag set karo:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {formData.variants.map((variant, index) => (
                          <div key={index} className="flex flex-col gap-1 p-2.5 rounded-xl"
                            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-white text-sm font-black">Size {variant.label}</span>
                              <button type="button" onClick={() => removeVariant(index)}
                                className="text-red-400 hover:text-red-300 text-xs">✕</button>
                            </div>
                            <input type="number" inputMode="numeric" placeholder="Stock"
                              value={variant.stock}
                              onChange={e => {
                                const updated = [...formData.variants];
                                updated[index] = { ...updated[index], stock: e.target.value };
                                setFormData(f => ({ ...f, variants: updated }));
                              }}
                              className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none text-center"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(59,130,246,0.25)" }} />
                            <div className="grid grid-cols-2 gap-1">
                              <input type="number" inputMode="decimal" placeholder="Cost"
                                value={variant.costPrice}
                                onChange={e => {
                                  const updated = [...formData.variants];
                                  updated[index] = { ...updated[index], costPrice: e.target.value };
                                  setFormData(f => ({ ...f, variants: updated }));
                                }}
                                className="w-full px-2 py-1 rounded-lg text-[10px] text-gray-300 outline-none text-center"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
                              <input type="number" inputMode="decimal" placeholder="Price"
                                value={variant.sellingPrice}
                                onChange={e => {
                                  const updated = [...formData.variants];
                                  updated[index] = { ...updated[index], sellingPrice: e.target.value, price: e.target.value };
                                  setFormData(f => ({ ...f, variants: updated }));
                                }}
                                className="w-full px-2 py-1 rounded-lg text-[10px] text-amber-400 outline-none text-center"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Normal variants list */
                    formData.variants.map((variant, index) => (
                      <div key={index} className="group flex items-center justify-between p-3 rounded-lg transition-all hover:scale-[1.01]"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div className="flex-1">
                          <p className="text-white text-sm font-semibold">{variant.label}</p>
                          <p className="text-gray-500 text-xs">Selling: Rs. {variant.sellingPrice || variant.price || "—"} • Cost: Rs. {variant.costPrice || "—"} • Stock: {variant.stock || 0}</p>
                        </div>
                        <button type="button" onClick={() => removeVariant(index)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-base">
                          ⌫
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 shadow-lg"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
              {product ? "✓ Update" : "⊕ Create"} Product
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
