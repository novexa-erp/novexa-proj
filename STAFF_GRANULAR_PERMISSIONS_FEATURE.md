# Staff Granular Permissions Feature 🔐

## Overview
Staff management mein ab **granular permissions** add kar diye hain. Ab jab dashboard se staff member banaate waqt aap detailed access control set kar sakte hain.

## Features Added

### 1. Module-wise Permissions
Har module ke liye alag-alag permissions:

#### **Invoices (🧾)**
- **View Access**: 
  - `All` - Saari invoices dekh sakta hai
  - `Own` - Sirf apni banai hui invoices dekh sakta hai
- **Create**: Naye invoices bana sakta hai
- **Edit**: Invoices edit kar sakta hai  
- **Delete**: Invoices delete kar sakta hai

#### **Customers (👥)**
- **View**: Customer list dekh sakta hai
- **Create**: Naye customers add kar sakta hai
- **Edit**: Customer details edit kar sakta hai
- **Delete**: Customers delete kar sakta hai

#### **Inventory (📦)**
- **View**: Inventory items dekh sakta hai
- **Create**: Naye products add kar sakta hai
- **Edit**: Product details edit kar sakta hai
- **Delete**: Products delete kar sakta hai

#### **Payments (💳)**
- **View**: Payments record dekh sakta hai
- **Create**: Naye payments add kar sakta hai
- **Edit**: Payment details edit kar sakta hai
- **Delete**: Payments delete kar sakta hai

#### **Purchases (🛒)**
- **View**: Purchase orders dekh sakta hai
- **Create**: Naye orders bana sakta hai
- **Edit**: Orders edit kar sakta hai
- **Delete**: Orders delete kar sakta hai

## UI Implementation

### Staff Creation/Edit Modal
1. **Account Status Section** - Active/Inactive toggle
2. **Granular Permissions Section** (NEW ✨)
   - Purple-themed card with 🔐 icon
   - Each module has its own permissions card
   - Color-coded buttons:
     - 🔵 Blue - View permissions
     - 🟠 Orange - "Own Only" option (invoices)
     - 🟢 Green - Create permission
     - 🔵 Blue - Edit permission
     - 🔴 Red - Delete permission
   - Toggle buttons show ✅ when enabled
3. **Module Assignment Section** - Which tabs/pages staff can access

### Visual Design
- Rounded cards with subtle borders
- Color-coded permissions for easy understanding
- Icon-based navigation (emoji icons)
- Responsive grid layout
- Hover effects on buttons

## Database Structure

### Staff Document Schema (Firestore)
```javascript
{
  uid: "staffUid123",
  adminUid: "adminUid456",
  name: "Ali Ahmed",
  email: "ali@example.com",
  role: "Cashier",
  allowedModules: ["overview", "invoices", "customers", "settings"],
  permissions: {
    invoices: {
      view: "own",      // "all" | "own" | "none"
      create: true,
      edit: false,
      delete: false
    },
    customers: {
      view: "all",
      create: true,
      edit: true,
      delete: false
    },
    inventory: {
      view: "all",
      create: false,
      edit: false,
      delete: false
    },
    payments: {
      view: "all",
      create: true,
      edit: false,
      delete: false
    },
    purchases: {
      view: "all",
      create: false,
      edit: false,
      delete: false
    }
  },
  isActive: true,
  createdAt: "2024-01-15T10:30:00.000Z",
  updatedAt: "2024-01-15T10:30:00.000Z"
}
```

## API Changes

### POST `/api/staff/manage` (Create Staff)
**Request Body:**
```json
{
  "name": "Ali Ahmed",
  "email": "ali@example.com",
  "password": "securepass123",
  "role": "Cashier",
  "allowedModules": ["overview", "invoices", "customers"],
  "permissions": {
    "invoices": { "view": "own", "create": true, "edit": false, "delete": false },
    "customers": { "view": "all", "create": true, "edit": false, "delete": false },
    "inventory": { "view": "all", "create": false, "edit": false, "delete": false },
    "payments": { "view": "all", "create": true, "edit": false, "delete": false },
    "purchases": { "view": "all", "create": false, "edit": false, "delete": false }
  },
  "isActive": true
}
```

### PATCH `/api/staff/manage` (Update Staff)
**Request Body:**
```json
{
  "staffUid": "staffUid123",
  "name": "Ali Ahmed",
  "role": "Senior Cashier",
  "allowedModules": ["overview", "invoices", "customers", "payments"],
  "permissions": {
    "invoices": { "view": "all", "create": true, "edit": true, "delete": false },
    "customers": { "view": "all", "create": true, "edit": true, "delete": false },
    "payments": { "view": "all", "create": true, "edit": true, "delete": false }
  },
  "isActive": true
}
```

## Default Permissions
Agar permissions specify nahi kiye gaye to yeh default set hote hain:

```javascript
{
  invoices:  { view: "own", create: false, edit: false, delete: false },
  customers: { view: "all", create: false, edit: false, delete: false },
  inventory: { view: "all", create: false, edit: false, delete: false },
  payments:  { view: "all", create: false, edit: false, delete: false },
  purchases: { view: "all", create: false, edit: false, delete: false }
}
```

## Use Cases

### Use Case 1: Junior Cashier
```javascript
permissions: {
  invoices: { view: "own", create: true, edit: false, delete: false },
  customers: { view: "all", create: false, edit: false, delete: false },
  payments: { view: "own", create: true, edit: false, delete: false }
}
```
- Sirf apne banaye invoices dekh sakta hai
- Naye invoices bana sakta hai
- Customers ko sirf view kar sakta hai (edit/delete nahi)
- Payments record kar sakta hai lekin edit/delete nahi

### Use Case 2: Senior Manager
```javascript
permissions: {
  invoices: { view: "all", create: true, edit: true, delete: true },
  customers: { view: "all", create: true, edit: true, delete: true },
  inventory: { view: "all", create: true, edit: true, delete: false },
  payments: { view: "all", create: true, edit: true, delete: false },
  purchases: { view: "all", create: true, edit: true, delete: false }
}
```
- Saari invoices dekh sakta hai aur manage kar sakta hai
- Full customer management access
- Inventory manage kar sakta hai (delete chhod kar)
- Payments aur purchases full access

### Use Case 3: Inventory Manager
```javascript
permissions: {
  invoices: { view: "all", create: false, edit: false, delete: false },
  inventory: { view: "all", create: true, edit: true, delete: false },
  purchases: { view: "all", create: true, edit: true, delete: false }
}
```
- Invoices sirf view kar sakta hai
- Inventory full control (delete chhod kar)
- Purchase orders manage kar sakta hai

## Implementation Files

### Frontend Components
- **`src/app/components/StaffManagementView.js`**
  - Updated `BLANK_FORM` with permissions structure
  - Added permissions UI in `StaffFormModal`
  - Permission toggle functions
  - Visual permission cards for each module

### Backend API
- **`src/app/api/staff/manage/route.js`**
  - POST endpoint - saves permissions on staff creation
  - PATCH endpoint - updates permissions on staff edit
  - DELETE endpoint - unchanged

## Next Steps (For Implementation in Other Components)

### 1. InvoicesView.js
```javascript
// Check if staff can view all or only own invoices
if (userDoc.role === "staff" && userDoc.permissions?.invoices?.view === "own") {
  // Filter: where("createdBy", "==", uid)
}

// Check create permission
if (userDoc.role === "staff" && !userDoc.permissions?.invoices?.create) {
  // Hide "New Invoice" button
}

// Check edit permission
if (userDoc.role === "staff" && !userDoc.permissions?.invoices?.edit) {
  // Disable edit buttons
}

// Check delete permission  
if (userDoc.role === "staff" && !userDoc.permissions?.invoices?.delete) {
  // Hide delete buttons
}
```

### 2. CustomersView.js
```javascript
// Similar checks for customers module
if (userDoc.role === "staff") {
  const perms = userDoc.permissions?.customers || {};
  if (!perms.view) { /* hide customer list */ }
  if (!perms.create) { /* hide add button */ }
  if (!perms.edit) { /* disable edit */ }
  if (!perms.delete) { /* hide delete */ }
}
```

### 3. Add createdBy field to documents
Jab bhi invoice/payment/order create ho, add this:
```javascript
{
  ...data,
  createdBy: uid,           // staff UID
  createdByName: userName,  // staff name for display
  createdAt: timestamp
}
```

## Security Rules (Firestore)
Update Firestore rules to enforce permissions:

```javascript
// Example for invoices
match /users/{userId}/invoices/{invoiceId} {
  allow read: if isOwner(userId) || 
    (isStaffOf(userId) && 
     (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.invoices.view == 'all' ||
      (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.invoices.view == 'own' &&
       resource.data.createdBy == request.auth.uid)));
       
  allow create: if isOwner(userId) || 
    (isStaffOf(userId) && 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.invoices.create == true);
     
  allow update: if isOwner(userId) || 
    (isStaffOf(userId) && 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.invoices.edit == true);
     
  allow delete: if isOwner(userId) || 
    (isStaffOf(userId) && 
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.invoices.delete == true);
}
```

## Benefits

✅ **Granular Control** - Admin ko har permission ka control  
✅ **Reduced Errors** - Junior staff ko limited access  
✅ **Accountability** - Kon kya kar sakta hai, clear hai  
✅ **Security** - Sensitive data protected  
✅ **Flexibility** - Har staff member ke liye custom setup  
✅ **User-Friendly** - Visual UI with color coding  
✅ **Scalable** - Aasani se naye modules add kar sakte hain

## Testing Checklist

- [ ] Staff creation with custom permissions
- [ ] Staff edit - permissions update hote hain
- [ ] Invoice view filtering (all vs own)
- [ ] Create button visibility based on permissions
- [ ] Edit button disabled when no permission
- [ ] Delete button hidden when no permission
- [ ] Firestore rules enforcement
- [ ] Activity log tracking
- [ ] Multiple staff members with different roles

## Future Enhancements

1. **Permission Templates** - Common role presets (Cashier, Manager, etc.)
2. **Time-based Permissions** - Certain actions only during specific hours
3. **Branch-specific Permissions** - Multi-branch support
4. **Audit Trail** - Log all permission changes
5. **Bulk Permission Updates** - Update multiple staff at once
6. **Custom Modules** - Dynamic module-permission mapping
7. **Report Access Control** - Granular report viewing permissions

---

**Created**: 2024-01-15  
**Feature Status**: ✅ Backend Complete | 🔄 Frontend Integration Pending  
**Priority**: High 🔥
