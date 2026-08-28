# Quick Reference - Staff Location Access

## 🎯 Quick Decision Tree

### میں کیا چاہتا ہوں؟

#### 1. Staff کو ساری inventory دکھانی ہے
```
View: All Products ✓
Hide Custom Locations: ☐ (Unchecked)
```

#### 2. Staff کو صرف main shop دکھانی ہے
```
View: All Products ✓
Hide Custom Locations: ✓ (Checked)
```

#### 3. Staff کو specific warehouse کی ساری products دکھانی ہیں
```
View: Own Only ✓
Assigned Location: Warehouse A ✓
View All in Location: ✓ (Checked)
```

#### 4. Staff کو صرف اپنی products دکھانی ہیں (specific location میں)
```
View: Own Only ✓
Assigned Location: Warehouse A ✓
View All in Location: ☐ (Unchecked)
```

---

## 📊 Permission Matrix

| View Mode | Assigned Location | View All in Location | Result |
|-----------|------------------|---------------------|---------|
| **All Products** | N/A | N/A | ✅ All inventory visible |
| **All Products** | N/A | N/A (Hide Custom ON) | ✅ Only default shop visible |
| **Own Only** | Default / Empty | ✓ ON | ✅ All products in default shop |
| **Own Only** | Default / Empty | ☐ OFF | ✅ Only own products in default shop |
| **Own Only** | Warehouse A | ✓ ON | ✅ All products in Warehouse A |
| **Own Only** | Warehouse A | ☐ OFF | ✅ Only own products in Warehouse A |

---

## 🔧 Common Configurations

### Configuration 1: Full Admin Access (Staff Manager)
```javascript
{
  view: "all",
  create: true,
  edit: true,
  delete: true,
  canManageLocations: true,
  showOnlyDefaultLocation: false
}
```
**Use Case**: Senior staff member who needs full control

---

### Configuration 2: Warehouse Manager
```javascript
{
  view: "own",
  viewAllInLocation: true,
  create: true,
  edit: true,
  delete: false,
  canManageLocations: false,
  assignedLocationId: "warehouse-a"
}
```
**Use Case**: Manages specific warehouse, sees all products there

---

### Configuration 3: Warehouse Staff
```javascript
{
  view: "own",
  viewAllInLocation: false,
  create: true,
  edit: true,
  delete: false,
  canManageLocations: false,
  assignedLocationId: "warehouse-a"
}
```
**Use Case**: Works in warehouse, only manages own products

---

### Configuration 4: Shop Salesperson
```javascript
{
  view: "own",
  viewAllInLocation: true,
  create: true,
  edit: false,
  delete: false,
  canManageLocations: false,
  assignedLocationId: "" // default shop
}
```
**Use Case**: Can create invoices, view all shop products, can't edit

---

## 🚀 Quick Setup Steps

### For Admin:
1. **Create Locations** (if not exists)
   - Go to: Settings → Locations
   - Add: Warehouse A, Warehouse B, etc.

2. **Create/Edit Staff**
   - Go to: Staff Management
   - Click: Add Staff / Edit existing

3. **Set Inventory Permissions**
   - Select "📦 Inventory" module
   - Choose view mode: "All Products" or "Own Only"
   - If "Own Only":
     - Select assigned location
     - Toggle "View All in Location" as needed

4. **Save & Test**
   - Save staff
   - Login as that staff (in incognito/private window)
   - Verify inventory visibility

---

## 🐛 Troubleshooting

### Issue: Staff cannot see any products
**Check**:
- ✓ Is "Inventory" module enabled?
- ✓ Is view permission set to "All" or "Own"?
- ✓ If "Own Only", is location assigned?
- ✓ Are there products in that location?

### Issue: Staff sees wrong products
**Check**:
- ✓ Is "viewAllInLocation" correctly set?
- ✓ Is assigned location correct?
- ✓ Are products' locationId fields correct?

### Issue: Staff can access other locations
**Check**:
- ✓ Is view set to "All Products"? (Should be "Own Only")
- ✓ Is "Hide Custom Locations" enabled if needed?

### Issue: Staff cannot create products
**Check**:
- ✓ Is "Create" permission enabled?
- ✓ Is "Inventory" module in allowed modules?

---

## 📝 Field Reference

### `assignedLocationId`
- **Type**: String (Location ID)
- **Default**: `""` (empty = default shop)
- **Visible**: Only when `view = "own"`
- **Purpose**: Restricts staff to specific location

### `viewAllInLocation`
- **Type**: Boolean
- **Default**: `false`
- **Visible**: Only when `view = "own"`
- **Purpose**: 
  - `true` = Staff sees all products in location
  - `false` = Staff sees only own products in location

### `showOnlyDefaultLocation`
- **Type**: Boolean
- **Default**: `true`
- **Visible**: Only when `view = "all"`
- **Purpose**: Hides custom locations, shows only default

### `canManageLocations`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Allow staff to create/edit locations

---

## 💡 Pro Tips

1. **Start Restrictive**: Begin with limited permissions, expand as needed
2. **Test First**: Create test staff account before production use
3. **Document Roles**: Keep a list of what each role should access
4. **Regular Audits**: Periodically review staff permissions
5. **Use Location Badge**: Quick visual to see who has location assignments

---

## 📚 Related Files

- `STAFF_LOCATION_ACCESS_FEATURE.md` - Full feature documentation
- `IMPLEMENTATION_SUMMARY_LOCATION_ACCESS.md` - Technical implementation
- `STAFF_LOCATION_SETUP_URDU.md` - Urdu setup guide
- `StaffManagementView.js` - UI implementation
- `InventoryView.js` - Filtering logic
