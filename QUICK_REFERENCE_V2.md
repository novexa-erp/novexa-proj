# Quick Reference - Staff Location Access (Simplified)

## 🎯 Two Simple Settings

### 1. Assigned Location (کہاں)
```
Default (Empty) → Main Shop
Warehouse A     → Warehouse A  
Warehouse B     → Warehouse B
```

### 2. View Mode (کیا دیکھے)
```
Own Only      → Only own products
All Products  → All products in that location
```

---

## 📊 Permission Matrix

| Location | View Mode | Staff Can See |
|----------|-----------|---------------|
| **Default** | Own Only | ✅ Only OWN products in main shop |
| **Default** | All Products | ✅ ALL products in main shop |
| **Warehouse A** | Own Only | ✅ Only OWN products in Warehouse A |
| **Warehouse A** | All Products | ✅ ALL products in Warehouse A (anyone's) |

---

## 🔧 Common Setups

### Setup 1: Shop Salesperson (Full Access)
```javascript
{
  assignedLocationId: "",      // Default shop
  permissions: {
    inventory: {
      view: "all",              // See all products
      create: true,
      edit: false,
      delete: false
    }
  }
}
```
**Use Case**: Can see all shop inventory, create invoices, cannot edit products

---

### Setup 2: Warehouse Manager (Full Control)
```javascript
{
  assignedLocationId: "warehouse-a",
  permissions: {
    inventory: {
      view: "all",              // See all products in warehouse
      create: true,
      edit: true,
      delete: true
    }
  }
}
```
**Use Case**: Manages entire warehouse, can do everything

---

### Setup 3: Warehouse Worker (Limited)
```javascript
{
  assignedLocationId: "warehouse-a",
  permissions: {
    inventory: {
      view: "own",              // Only own products
      create: true,
      edit: true,
      delete: false
    }
  }
}
```
**Use Case**: Receives/creates products in warehouse, only sees own work

---

### Setup 4: Multi-Staff Shop (Personal Products)
```javascript
// Staff 1
{
  assignedLocationId: "",      // Default
  permissions: { inventory: { view: "own", create: true } }
}

// Staff 2  
{
  assignedLocationId: "",      // Default
  permissions: { inventory: { view: "own", create: true } }
}
```
**Use Case**: Each staff manages own products in same shop

---

## 🚀 Quick Setup Steps

1. **Go to**: Staff Management
2. **Click**: Add Staff / Edit Staff
3. **Enable**: 📦 Inventory module
4. **Set View**:
   - 👤 Own Only = Only own products
   - 👁️ All Products = All products
5. **Assign Location**:
   - Empty = Main Shop
   - Select Warehouse = That warehouse only
6. **Save** ✅

---

## 💡 Key Rules

### Rule 1: Location Restriction
```
Staff ALWAYS sees only their assigned location
Cannot see products from other locations
```

### Rule 2: View Mode Within Location
```
"Own Only"      → Only products they created
"All Products"  → All products in that location
```

### Rule 3: Product Creation
```
Location field is AUTO-ASSIGNED and DISABLED for staff
Staff cannot change product location
```

### Rule 4: Admin Override
```
Admin can:
- See all locations
- See all products
- Change any product's location
```

---

## 🔍 Quick Troubleshooting

### Staff cannot see any products
```
Check:
✓ Inventory module enabled?
✓ Location assigned correctly?
✓ Products exist in that location?
✓ If "Own Only", has staff created products?
```

### Staff sees wrong products
```
Check:
✓ View mode correct (Own vs All)?
✓ Assigned location correct?
✓ Products have correct locationId?
```

### Staff cannot create products
```
Check:
✓ Create permission enabled?
✓ Inventory module enabled?
✓ Location assigned?
```

---

## 📝 Database Fields

### Staff Document
```javascript
{
  assignedLocationId: "warehouse-a" | "",  // Location ID or empty for default
  permissions: {
    inventory: {
      view: "own" | "all",                  // View permission
      create: boolean,
      edit: boolean,
      delete: boolean,
      canManageLocations: boolean
    }
  }
}
```

### Product Document
```javascript
{
  locationId: "warehouse-a" | "",          // Product location
  createdBy: "staff-uid",                  // Creator's UID
  createdByName: "Staff Name",
  createdByRole: "Staff" | "admin"
}
```

---

## 🎨 UI Indicators

### Staff Card
```
┌─────────────────────────────┐
│ 👤 Staff Name               │
│ staff@example.com           │
│ [Staff] [📍 Location] ← Badge shows if location assigned
└─────────────────────────────┘
```

### Product Form (Staff View)
```
📍 Location: [Warehouse A ▼] (DISABLED)
              ↑
    Auto-assigned, cannot change
```

---

## ⚡ Quick Examples

### Example 1: Main shop with 3 staff
```
Staff 1: Default + Own Only
Staff 2: Default + Own Only  
Staff 3: Default + All Products (supervisor)

Result:
- Staff 1 & 2: See only own products
- Staff 3: Sees all shop products
- All work in same location (main shop)
```

### Example 2: Two warehouses
```
Staff A: Warehouse A + All Products
Staff B: Warehouse B + All Products

Result:
- Staff A: Sees all Warehouse A products
- Staff B: Sees all Warehouse B products
- No cross-warehouse visibility
```

### Example 3: Mixed access
```
Staff X: Default + All Products
Staff Y: Warehouse A + Own Only

Result:
- Staff X: Sees all main shop products
- Staff Y: Sees only own Warehouse A products
- Complete separation
```

---

## 📚 Related Documentation

- `STAFF_LOCATION_ACCESS_FEATURE.md` - Full technical docs
- `STAFF_LOCATION_SETUP_URDU_V2.md` - Urdu guide
- `StaffManagementView.js` - Form UI
- `InventoryView.js` - Filtering logic

---

## 🔐 Security Notes

✅ Staff cannot access other locations
✅ Staff cannot change product locations  
✅ Location field disabled for staff
✅ Admin retains full access
✅ Safe defaults (restrictive permissions)

---

## 🎯 Decision Tree

```
Need to assign staff?
│
├─ Which location?
│  ├─ Main shop → assignedLocationId = ""
│  └─ Warehouse → assignedLocationId = "warehouse-id"
│
└─ What can they see?
   ├─ Only own products → view = "own"
   └─ All products → view = "all"
```

Done! ✅
