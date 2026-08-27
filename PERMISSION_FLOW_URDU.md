# Staff Permission System - کام کا بہاؤ

## 🎯 **مکمل ہو گیا (InvoicesView)** ✅

### Staff Member Login کرے:
```
┌─────────────────────────────────────┐
│  Staff Login                        │
│  Email: ali@example.com            │
│  Permissions Loaded:               │
│    invoices: {                     │
│      view: "own"    ← صرف اپنی     │
│      create: true   ← بنا سکتا     │
│      edit: false    ← نہیں کر سکتا │
│      delete: false  ← نہیں کر سکتا │
│    }                               │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  InvoicesView Opens                │
│                                     │
│  Permission Checks:                │
│  ✓ canCreate = true                │
│  ✗ canEdit = false                 │
│  ✗ canDelete = false               │
│  ✓ canViewInvoice = "own" only    │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  UI Rendered:                       │
│                                     │
│  ✅ "Create Invoice" button visible│
│  🔒 Edit button shows lock icon    │
│  🔒 Delete button shows lock icon  │
│                                     │
│  Invoice List:                     │
│  ├─ INV-011407... (by Ali) ✓      │
│  ├─ INV-021407... (by Ali) ✓      │
│  └─ INV-031407... (by Admin) ✗    │
│      ↑ Filtered Out (not created  │
│        by this staff member)      │
└─────────────────────────────────────┘
```

---

## 📝 **Invoice Create کرتے وقت**

```
Staff: Ali creates invoice
         ↓
┌─────────────────────────────────────┐
│  Invoice Data Saved:                │
│  {                                  │
│    invoiceNumber: "INV-011407...", │
│    customerName: "Ahmed",          │
│    amount: 5000,                   │
│    items: [...],                   │
│                                    │
│    createdBy: "staffUid123",  ◄──  │
│    createdByName: "Ali",      ◄──  │
│    createdByRole: "staff",    ◄──  │
│    createdAt: timestamp            │
│  }                                 │
└─────────────────────────────────────┘
```

**فائدہ**: Ab system ko pata hai kis ne banaya!

---

## 👁️ **View Permission کیسے کام کرتا ہے**

### Option 1: View = "all" (سب دیکھو)
```
Staff: Manager (view: "all")
         ↓
┌─────────────────────────────────────┐
│  Invoice List:                      │
│  ├─ All Staff Invoices    ✓        │
│  ├─ Admin Invoices        ✓        │
│  └─ Other Staff Invoices  ✓        │
│                                     │
│  Total: 50 invoices visible        │
└─────────────────────────────────────┘
```

### Option 2: View = "own" (صرف اپنی)
```
Staff: Cashier (view: "own")
         ↓
┌─────────────────────────────────────┐
│  Invoice List:                      │
│  ├─ My Invoice 1          ✓        │
│  ├─ My Invoice 2          ✓        │
│  ├─ Admin Invoice         ✗ Hidden │
│  └─ Other Staff Invoice   ✗ Hidden │
│                                     │
│  Total: 5 invoices visible         │
│      (صرف apne banaye hue)         │
└─────────────────────────────────────┘
```

**Code:**
```javascript
const canViewInvoice = (invoice) => {
  if (!isStaff) return true; // Admin
  if (staffPerms?.view === "all") return true;
  if (staffPerms?.view === "own") {
    return invoice.createdBy === userDoc.uid;
  }
  return false;
};

// Filter invoices
const filtered = invoices.filter(inv => canViewInvoice(inv));
```

---

## 🔒 **Button States**

### Admin View:
```
┌────────────────────────────────────┐
│ [➕ Create Invoice] ← Visible     │
│                                    │
│ Invoice Row:                       │
│ [👁 View] [✏️ Edit] [🗑️ Delete]  │
│    ↑        ↑          ↑           │
│  Works   Works      Works         │
└────────────────────────────────────┘
```

### Staff with Full Permissions:
```
┌────────────────────────────────────┐
│ [➕ Create Invoice] ← Visible     │
│                                    │
│ Invoice Row:                       │
│ [👁 View] [✏️ Edit] [🗑️ Delete]  │
│    ↑        ↑          ↑           │
│  Works   Works      Works         │
└────────────────────────────────────┘
```

### Staff with Limited Permissions (view: own, create only):
```
┌────────────────────────────────────┐
│ [➕ Create Invoice] ← Visible     │
│                                    │
│ My Invoice Row:                    │
│ [👁 View] [🔒] [🔒]               │
│    ↑       ↑    ↑                  │
│  Works  Locked Locked              │
│       (Edit) (Delete)              │
│                                    │
│ Other's Invoice: ✗ Not Shown      │
└────────────────────────────────────┘
```

### Staff with NO Create Permission:
```
┌────────────────────────────────────┐
│ [🔒 No create permission] ← Message│
│                                    │
│ Invoice Row:                       │
│ [👁 View] [🔒] [🔒]               │
└────────────────────────────────────┘
```

---

## 💼 **Real Example: دکان کی ٹیم**

### Admin (مالک):
```javascript
permissions: null  // سب کچھ access
```
- ✅ سب invoices دیکھتا ہے
- ✅ نئے بناتا ہے
- ✅ edit کرتا ہے
- ✅ delete کرتا ہے

### Manager (منیجر):
```javascript
permissions: {
  invoices: { view: "all", create: true, edit: true, delete: false }
}
```
- ✅ سب invoices دیکھتا ہے
- ✅ نئے بناتا ہے
- ✅ edit کرتا ہے
- ❌ delete نہیں کر سکتا (صرف admin)

### Junior Cashier (کیشئر):
```javascript
permissions: {
  invoices: { view: "own", create: true, edit: false, delete: false }
}
```
- ✅ صرف اپنی invoices دیکھتا ہے
- ✅ نئے بناتا ہے
- ❌ کسی کو edit نہیں کر سکتا
- ❌ کسی کو delete نہیں کر سکتا

### Data Entry Clerk (ڈیٹا انٹری):
```javascript
permissions: {
  invoices: { view: "all", create: false, edit: false, delete: false }
}
```
- ✅ سب invoices دیکھتا ہے (reports کے لیے)
- ❌ نئے نہیں بنا سکتا
- ❌ edit نہیں کر سکتا
- ❌ delete نہیں کر سکتا

---

## 🔄 **System Flow Diagram**

```
Staff Login
    ↓
Load userDoc from Firestore
    ├─ role: "staff"
    ├─ permissions: { ... }
    └─ uid: "staffUid123"
    ↓
InvoicesView Component
    ↓
Calculate Permission Flags
    ├─ const isStaff = true
    ├─ const staffPerms = { invoices: {...} }
    ├─ const canCreate = true/false
    ├─ const canEdit = true/false
    ├─ const canDelete = true/false
    └─ const canViewInvoice = (inv) => {...}
    ↓
Filter Data
    ├─ Remove invoices not created by staff (if view: "own")
    └─ Keep all invoices (if view: "all")
    ↓
Render UI
    ├─ Show/Hide Create button
    ├─ Enable/Disable Edit button
    ├─ Enable/Disable Delete button
    └─ Display filtered invoice list
    ↓
User Actions
    ├─ Create Invoice → Add createdBy fields
    ├─ Try to Edit → Blocked if no permission
    └─ Try to Delete → Blocked if no permission
```

---

## ✅ **Kya Complete Ho Gaya**

1. ✅ **Backend** - Permissions save/load
2. ✅ **Staff Form** - UI to set permissions
3. ✅ **InvoicesView** - Complete implementation
   - View filtering (all/own)
   - Create button conditional
   - Edit button conditional
   - Delete button conditional
   - createdBy tracking

## 🔄 **Kya Baaki Hai**

1. 🔄 **CustomersView** - Same pattern
2. 🔄 **InventoryView** - Same pattern
3. 🔄 **PaymentsView** - Same pattern
4. 🔄 **PurchasesView** - Same pattern
5. 🔄 **Digital Register** - Filter by createdBy
6. 🔄 **Bill Book** - Filter by createdBy

---

**تاریخ**: Current Session  
**حالت**: InvoicesView ✅ | باقی 🔄
