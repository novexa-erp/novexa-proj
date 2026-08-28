# Staff Location Access - Visual Guide 📊

## 🎨 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   ADMIN (Full Access)                    │
│  ✅ Can see ALL locations                               │
│  ✅ Can see ALL products                                │
│  ✅ Can assign locations to staff                       │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   DEFAULT   │ │ WAREHOUSE A │ │ WAREHOUSE B │
    │  (Main Shop)│ │             │ │             │
    └─────────────┘ └─────────────┘ └─────────────┘
            │               │               │
            ▼               ▼               ▼
    [Staff assigned]  [Staff assigned] [Staff assigned]
```

---

## 🔄 Permission Flow

### Scenario 1: Default Shop - Own Only
```
┌──────────────────────────────────────────────────┐
│ Staff 1                                          │
│ ├─ Location: Default (Main Shop)                │
│ ├─ View: Own Only                                │
│ └─ Can See: ✅ Own products in main shop        │
└──────────────────────────────────────────────────┘

Products in Default Shop:
├─ Product A (created by Staff 1) ✅ VISIBLE
├─ Product B (created by Admin)   ❌ HIDDEN
└─ Product C (created by Staff 2) ❌ HIDDEN
```

---

### Scenario 2: Default Shop - All Products
```
┌──────────────────────────────────────────────────┐
│ Staff 2                                          │
│ ├─ Location: Default (Main Shop)                │
│ ├─ View: All Products                            │
│ └─ Can See: ✅ ALL products in main shop        │
└──────────────────────────────────────────────────┘

Products in Default Shop:
├─ Product A (created by Staff 1) ✅ VISIBLE
├─ Product B (created by Admin)   ✅ VISIBLE
└─ Product C (created by Staff 2) ✅ VISIBLE

Products in Warehouse A:
├─ Product D ❌ HIDDEN (different location)
```

---

### Scenario 3: Warehouse A - Own Only
```
┌──────────────────────────────────────────────────┐
│ Staff 3                                          │
│ ├─ Location: Warehouse A                         │
│ ├─ View: Own Only                                │
│ └─ Can See: ✅ Own products in Warehouse A      │
└──────────────────────────────────────────────────┘

Products in Warehouse A:
├─ Product X (created by Staff 3) ✅ VISIBLE
├─ Product Y (created by Admin)   ❌ HIDDEN
└─ Product Z (created by Staff 4) ❌ HIDDEN

Products in Default Shop:
├─ Product A ❌ HIDDEN (different location)
```

---

### Scenario 4: Warehouse A - All Products
```
┌──────────────────────────────────────────────────┐
│ Staff 4                                          │
│ ├─ Location: Warehouse A                         │
│ ├─ View: All Products                            │
│ └─ Can See: ✅ ALL products in Warehouse A      │
└──────────────────────────────────────────────────┘

Products in Warehouse A:
├─ Product X (created by Staff 3) ✅ VISIBLE
├─ Product Y (created by Admin)   ✅ VISIBLE
└─ Product Z (created by Staff 4) ✅ VISIBLE

Products in Default Shop:
├─ Product A ❌ HIDDEN (different location)

Products in Warehouse B:
├─ Product M ❌ HIDDEN (different location)
```

---

## 📱 UI Examples

### Staff Management Form
```
┌────────────────────────────────────────────────┐
│  Create Staff                                  │
├────────────────────────────────────────────────┤
│  Name: [Ahmed Khan____________]                │
│  Email: [ahmed@example.com____]                │
│  Password: [••••••••••••••]                    │
│                                                │
│  📦 Modules                                    │
│  ☑ Inventory  ☐ Invoices  ☐ Customers        │
│                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  INVENTORY PERMISSIONS                         │
│                                                │
│  View Access:                                  │
│  ┌──────────────┐  ┌──────────────┐          │
│  │ All Products │  │ ✓ Own Only   │          │
│  └──────────────┘  └──────────────┘          │
│                                                │
│  📍 Assigned Location:                        │
│  [Warehouse A                        ▼]       │
│   ℹ️ Staff will only see products from       │
│      Warehouse A                              │
│                                                │
│  ☑ Create  ☑ Edit  ☐ Delete                  │
│                                                │
│  [Cancel]                    [Create Staff ✓] │
└────────────────────────────────────────────────┘
```

---

### Staff Card Display
```
┌─────────────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ ← Blue accent
│                                         │
│  👤  Ahmed Khan                    🟢   │
│      ahmed@example.com                  │
│      [Staff] [📍 Location]             │
│                                         │
│  MODULES (3)                            │
│  [📦 Inventory] [📊 Analytics] [⚙️ Settings] │
│                                         │
│  Added 2 days ago                       │
│                                         │
├─────────────────────────────────────────┤
│  [✏️ Edit] [📋 Activity] [🗑️ Remove]   │
└─────────────────────────────────────────┘
```

---

### Inventory View (Staff Side)
```
┌────────────────────────────────────────────────┐
│  📦 Inventory - Warehouse A                    │
├────────────────────────────────────────────────┤
│  🔍 [Search products...]           [+ Add]     │
│                                                │
│  Showing: 5 products                           │
│  (Your assigned location: Warehouse A)         │
│                                                │
│  ┌──────────────────────────────────────┐    │
│  │ 📦 Product 1                         │    │
│  │ Created by: You                      │    │
│  │ Location: 🏭 Warehouse A            │    │
│  │ Stock: 50 | Price: Rs. 500          │    │
│  │ [✏️ Edit] [🗑️ Delete]                │    │
│  └──────────────────────────────────────┘    │
│                                                │
│  ┌──────────────────────────────────────┐    │
│  │ 📦 Product 2                         │    │
│  │ Created by: You                      │    │
│  │ Location: 🏭 Warehouse A            │    │
│  │ Stock: 100 | Price: Rs. 300         │    │
│  │ [✏️ Edit] [🗑️ Delete]                │    │
│  └──────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

---

### Add Product Modal (Staff)
```
┌────────────────────────────────────────────────┐
│  Add Product                            [✕]    │
├────────────────────────────────────────────────┤
│  Name: [Laptop HP 250_________________]        │
│  Description: [___________________________]    │
│  Category: [Electronics_______________]        │
│                                                │
│  📍 Location (Auto-assigned)                  │
│  [🏭 Warehouse A                      ▼] 🔒   │
│   ℹ️ Auto-assigned to your location           │
│                                                │
│  💰 Pricing                                   │
│  Selling Price: [50000___]                     │
│  Cost Price:    [45000___]                     │
│  Stock:         [10_______]                    │
│                                                │
│  [Cancel]                    [Save Product ✓]  │
└────────────────────────────────────────────────┘
                    ▲
              Location field is
              DISABLED for staff
```

---

## 🔀 Comparison Table

| Feature | Admin | Staff (All Products) | Staff (Own Only) |
|---------|-------|---------------------|------------------|
| **See all locations** | ✅ Yes | ❌ No | ❌ No |
| **See own location products** | ✅ All | ✅ All | ✅ Own only |
| **Change product location** | ✅ Yes | ❌ No | ❌ No |
| **Create in any location** | ✅ Yes | ❌ No | ❌ No |
| **Location field** | 🔓 Enabled | 🔒 Disabled | 🔒 Disabled |

---

## 🎯 Real World Examples

### Example 1: Retail Chain
```
📍 Main Shop (Karachi)
   ├─ Staff A (All Products) → Manager
   ├─ Staff B (Own Only) → Salesperson
   └─ Staff C (Own Only) → Salesperson

📍 Warehouse Lahore
   ├─ Staff D (All Products) → Warehouse Manager
   ├─ Staff E (Own Only) → Worker 1
   └─ Staff F (Own Only) → Worker 2

📍 Warehouse Islamabad
   └─ Staff G (All Products) → Single Manager

Result:
- Each location is independent
- Staff can't see other locations
- Managers see all products in their location
- Workers see only own products
```

---

### Example 2: Small Business
```
📍 Main Shop
   ├─ Owner (Admin) → Full access
   ├─ Staff 1 (Own Only) → Part-time
   └─ Staff 2 (All Products) → Full-time supervisor

Result:
- Owner sees everything
- Staff 1 tracks own sales
- Staff 2 supervises all shop inventory
```

---

## 🔄 Data Flow

### Product Creation Flow
```
Staff clicks "Add Product"
         ↓
Form opens with location PRE-FILLED
         ↓
Staff fills product details
         ↓
Clicks "Save"
         ↓
System auto-assigns:
  ├─ locationId = staff.assignedLocationId
  ├─ createdBy = staff.uid
  └─ createdByName = staff.name
         ↓
Product saved to database
         ↓
Product visible based on view permission
```

---

### Product Visibility Flow
```
Staff opens Inventory
         ↓
System checks staff.assignedLocationId
         ↓
Filters products:
  ├─ Match locationId with assignedLocationId
  └─ If no match → HIDE
         ↓
Check view permission:
  ├─ "all" → Show all matched products
  └─ "own" → Show only if createdBy = staff.uid
         ↓
Display filtered products
```

---

## ✅ Testing Scenarios

### Test 1: Location Restriction
```
Setup:
- Staff X → Warehouse A
- Create Product in Warehouse A
- Create Product in Default Shop (by admin)

Test:
✓ Staff X sees Warehouse A product
✗ Staff X does NOT see Default Shop product
```

---

### Test 2: View Permission
```
Setup:
- Staff Y → Default Shop, Own Only
- Staff Z → Default Shop, All Products
- Create product by Staff Y
- Create product by Admin

Test:
✓ Staff Y sees only own product
✓ Staff Z sees both products
```

---

### Test 3: Product Creation
```
Setup:
- Staff A → Warehouse B

Test:
✓ Location field shows "Warehouse B"
✓ Location field is disabled
✓ Product saves with locationId = "warehouse-b"
✓ Product immediately visible to Staff A
```

---

## 🎨 Color Coding

```
🟢 Green  = Visible / Allowed
🔴 Red    = Hidden / Blocked
🟡 Yellow = Conditional / Warning
🔵 Blue   = Info / Selected
```

---

## 📚 Summary

```
┌────────────────────────────────────────────────┐
│  SIMPLIFIED LOCATION ACCESS SYSTEM             │
│                                                │
│  Two Controls:                                 │
│  1️⃣ Location → Where staff works              │
│  2️⃣ View Mode → What staff sees               │
│                                                │
│  Results:                                      │
│  ✅ Clear separation by location              │
│  ✅ Flexible visibility control                │
│  ✅ Automatic location assignment              │
│  ✅ Simple to understand & manage              │
└────────────────────────────────────────────────┘
```
