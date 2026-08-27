# Staff Granular Permissions - Current Status

## ✅ **COMPLETED** (Ready to Test)

### 1. Backend API ✅
- `/api/staff/manage` POST - saves permissions
- `/api/staff/manage` PATCH - updates permissions
- Default permissions structure
- Database schema ready

### 2. Staff Management UI ✅
- Granular permissions form in `StaffManagementView.js`
- 5 modules with detailed permissions:
  - 🧾 Invoices (View: All/Own, Create, Edit, Delete)
  - 👥 Customers (View, Create, Edit, Delete)
  - 📦 Inventory (View, Create, Edit, Delete)
  - 💳 Payments (View, Create, Edit, Delete)
  - 🛒 Purchases (View, Create, Edit, Delete)
- Color-coded UI with icons
- Real-time toggles

### 3. InvoicesView.js ✅
**File**: `src/app/components/InvoicesView.js`

**Changes Made:**
- ✅ Permission helpers (lines ~72-88)
- ✅ `createdBy` field on invoice creation (line ~545)
- ✅ View permission filtering - "own" vs "all" (line ~195)
- ✅ Create button conditional (line ~845)
- ✅ Edit button permission-based (desktop dropdown)
- ✅ Delete button permission-based (desktop dropdown)
- ✅ Edit button permission-based (mobile inline)
- ✅ Delete button permission-based (mobile inline)

**How it Works:**
```javascript
// Staff with view: "own"
Only sees invoices where invoice.createdBy === userDoc.uid

// Staff with view: "all"
Sees all invoices

// No create permission
"Create Invoice" button hidden, shows 🔒 message

// No edit permission
Edit button shows 🔒 icon with tooltip

// No delete permission
Delete button shows 🔒 icon with tooltip
```

### 4. CustomersView.js ✅
**File**: `src/app/components/CustomersView.js`

**Changes Made:**
- ✅ Permission helpers added to main component (line ~2147)
- ✅ Add Customer button conditional (line ~2545)
- ✅ Edit button permission-based in CustomerDetail (line ~1231)
- ✅ Delete button permission-based in CustomerDetail (line ~1241)

**How it Works:**
```javascript
// No create permission
"Add Customer" button hidden, shows 🔒 message

// No edit permission
Edit button in customer detail shows 🔒 icon

// No delete permission
Delete button in customer detail shows 🔒 icon
```

**Note**: Currently customers mein "view: all" fixed hai (no "own" filtering needed for customers)

---

## 🔄 **REMAINING WORK**

### 5. InventoryView.js - To Do
**Priority**: High

**What to Add:**
```javascript
// At component start
const isStaff = userDoc?.role === "staff";
const invPerms = isStaff ? (userDoc?.permissions?.inventory || {}) : null;
const canCreate = !isStaff || (invPerms?.create === true);
const canEdit   = !isStaff || (invPerms?.edit === true);
const canDelete = !isStaff || (invPerms?.delete === true);

// Add createdBy on product creation
{
  ...productData,
  createdBy: userDoc?.uid,
  createdByName: userDoc?.name,
  createdByRole: userDoc?.role
}

// Conditional buttons
{canCreate && <button>Add Product</button>}
{canEdit ? <button>Edit</button> : <button disabled>🔒</button>}
{canDelete ? <button>Delete</button> : <button disabled>🔒</button>}
```

### 6. PurchasesView.js - To Do
**Priority**: Medium

**What to Add:**
```javascript
const isStaff = userDoc?.role === "staff";
const purPerms = isStaff ? (userDoc?.permissions?.purchases || {}) : null;
const canCreate = !isStaff || (purPerms?.create === true);
// ... similar pattern
```

### 7. Digital Register & Bill Book - To Do
**Priority**: Medium

**What to Add:**
```javascript
// Filter invoices based on createdBy if staff with "own" permission
const filtered = allInvoices.filter(inv => {
  if (isStaff && staffPerms?.view === "own") {
    return inv.createdBy === userDoc.uid;
  }
  return true;
});
```

### 8. PaymentsView - To Do (If Separate Component Exists)
**Priority**: Low

---

## 🧪 **TESTING GUIDE**

### Test Scenario 1: Invoice "Own" Permission
**Setup:**
```javascript
permissions: {
  invoices: { view: "own", create: true, edit: false, delete: false }
}
```

**Expected:**
1. Staff creates invoice → `createdBy` field saved
2. Invoice list shows only their invoices
3. Admin's invoices NOT visible
4. Other staff's invoices NOT visible
5. Create button visible
6. Edit button shows 🔒
7. Delete button shows 🔒

### Test Scenario 2: Customer Create Disabled
**Setup:**
```javascript
permissions: {
  customers: { view: "all", create: false, edit: true, delete: false }
}
```

**Expected:**
1. "Add Customer" button hidden
2. Shows 🔒 message
3. Can open existing customer details
4. Edit button works
5. Delete button shows 🔒

### Test Scenario 3: Full Manager Access
**Setup:**
```javascript
permissions: {
  invoices: { view: "all", create: true, edit: true, delete: true },
  customers: { view: "all", create: true, edit: true, delete: true }
}
```

**Expected:**
1. All buttons visible and working
2. Sees all invoices (not just own)
3. Can edit/delete everything
4. Same experience as admin (almost)

---

## 📊 **PROGRESS TRACKER**

| Component | Status | Lines Changed | Test Status |
|-----------|--------|---------------|-------------|
| Backend API | ✅ 100% | ~50 lines | Ready |
| Staff UI | ✅ 100% | ~400 lines | Ready |
| InvoicesView | ✅ 100% | ~80 lines | Ready |
| CustomersView | ✅ 100% | ~60 lines | Ready |
| InventoryView | ⏳ 0% | 0 lines | Pending |
| PurchasesView | ⏳ 0% | 0 lines | Pending |
| BillBookView | ⏳ 0% | 0 lines | Pending |
| DigitalRegisterView | ⏳ 0% | 0 lines | Pending |
| PaymentsView | ⏳ 0% | 0 lines | Pending |

**Overall Progress**: ~45% Complete (4 of 9 components)

---

## 🎯 **WHAT YOU CAN TEST RIGHT NOW**

### Invoices Module ✅
1. Create staff with permissions:
   ```javascript
   invoices: { view: "own", create: true, edit: false, delete: false }
   ```
2. Login as that staff
3. Create some invoices
4. Verify only YOUR invoices show up
5. Verify Edit/Delete buttons are locked 🔒
6. Login as admin
7. Verify admin sees ALL invoices (including staff's)

### Customers Module ✅
1. Create staff with permissions:
   ```javascript
   customers: { view: "all", create: false, edit: false, delete: false }
   ```
2. Login as that staff
3. Open Customers tab
4. Verify "Add Customer" button is hidden
5. Open a customer detail
6. Verify Edit and Delete buttons show 🔒

---

## 🚀 **NEXT IMMEDIATE STEPS**

1. **Test Current Implementation**
   - Create test staff account
   - Test invoice permissions
   - Test customer permissions
   - Report any bugs

2. **InventoryView Implementation** (Next Priority)
   - Add permission helpers
   - Conditional buttons
   - Add `createdBy` tracking

3. **Complete Remaining Views**
   - PurchasesView
   - BillBookView
   - DigitalRegisterView

4. **Firestore Security Rules** (Production)
   - Enforce permissions at database level
   - Prevent unauthorized access via API

---

## 📝 **KNOWN LIMITATIONS**

1. ⚠️ **UI-level only**: Permissions enforced in UI, not yet in Firestore rules
2. ⚠️ **No API validation**: Need to add permission checks in API routes
3. ⚠️ **Customer "view" permission**: Currently hardcoded to "all" (no "own" filtering)

---

## 🔐 **SECURITY TODO**

```javascript
// Firestore Rules Example (To Implement)
match /users/{userId}/invoices/{invoiceId} {
  allow read: if isOwner(userId) || 
    (isStaffOf(userId) && canViewInvoice(request.auth.uid, resource));
  
  allow create: if isOwner(userId) || 
    (isStaffOf(userId) && hasPermission(request.auth.uid, "invoices", "create"));
  
  allow update: if isOwner(userId) || 
    (isStaffOf(userId) && hasPermission(request.auth.uid, "invoices", "edit"));
  
  allow delete: if isOwner(userId) || 
    (isStaffOf(userId) && hasPermission(request.auth.uid, "invoices", "delete"));
}
```

---

**Last Updated**: Current Session  
**Ready for Testing**: ✅ Yes  
**Production Ready**: ⚠️ Not Yet (needs security rules)
