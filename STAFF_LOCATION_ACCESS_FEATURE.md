# Staff Location-Based Inventory Access Feature

## Overview
Yeh feature staff members ko specific locations (shop ya warehouse) assign karne ki ability deta hai aur unki inventory access ko control karta hai.

## Key Features

### 1. Location Assignment
- Admin staff ko specific location assign kar sakta hai (default shop ya custom warehouse)
- Agar koi location assign nahi hai to staff ko default shop assign hota hai automatically
- Staff hamesha sirf apni assigned location ki inventory dekh sakta hai

### 2. Inventory View Permissions (Simplified)

Staff ke inventory view permission do options hain:

#### View Mode: "Own Only"
- Staff sirf **apne create ki hui products** dekh sakta hai
- Products sirf assigned location ki dikhegi
- Example: Warehouse A + Own Only = Sirf apni Warehouse A ki products

#### View Mode: "All Products"
- Staff **sab ke products** dekh sakta hai
- Products sirf assigned location ki dikhegi
- Example: Warehouse A + All Products = Warehouse A ki saari products (kisi ne bhi create ki hon)

### 3. Product Creation
- Jab staff product create karta hai, wo automatically uski assigned location mein save hota hai
- Staff doosri locations mein products create nahi kar sakta
- Location field staff ke liye disabled hota hai (auto-assigned)

## UI Elements

### Staff Management Form
1. **View Access Toggle**: 
   - "👁️ All Products" = Location ki saari products dikhaayein
   - "👤 Own Only" = Sirf apni create ki hui products dikhaayein

2. **Assigned Location Dropdown**: 
   - Always visible when Inventory module is enabled
   - Admin staff ko shop ya warehouse assign kar sakta hai
   - Empty = default shop location

### Staff Card
- Agar staff ko location assign hai to "📍 Location" badge dikhta hai

## Technical Implementation

### Database Fields
```javascript
// Staff Document
{
  assignedLocationId: "warehouse-a-id",  // Location ID (empty = default)
  permissions: {
    inventory: {
      view: "own" | "all",               // "own" = only own products, "all" = all products in location
      create: true,
      edit: true,
      delete: false,
      canManageLocations: false
    }
  }
}
```

### Filtering Logic (InventoryView.js)
```javascript
const canViewProduct = (product) => {
  if (!isStaff) return true; // Admin can view all
  
  // Get staff's assigned location
  const assignedLocationId = staffContext?.staffDoc?.assignedLocationId || "";
  
  // Check if product is in staff's assigned location
  const isInAssignedLocation = (product.locationId || "") === assignedLocationId;
  
  // If not in location, hide it
  if (!isInAssignedLocation) return false;
  
  // Check view permission
  if (staffPerms?.view === "all") {
    return true; // Show all products in location
  } else if (staffPerms?.view === "own") {
    return product.createdBy === staffUid; // Show only own products
  }
};
```

## Use Cases

### Use Case 1: Multi-Warehouse Management
**Scenario**: Company has Main Shop aur 2 warehouses (A aur B)

**Setup**:
- Staff 1 → Warehouse A assigned, view = "all"
- Staff 2 → Warehouse B assigned, view = "all"

**Result**:
- Staff 1 sirf Warehouse A ki **saari products** dekh sakta hai
- Staff 2 sirf Warehouse B ki **saari products** dekh sakta hai
- Dono apne warehouse mein products add/edit kar sakte hain

### Use Case 2: Restricted Access Per Staff
**Scenario**: Ek hi warehouse mein multiple staff hain, har staff sirf apni products manage kare

**Setup**:
- Staff 1 → Warehouse A assigned, view = "own"
- Staff 2 → Warehouse A assigned, view = "own"

**Result**:
- Dono Warehouse A mein products create kar sakte hain
- Lekin har staff sirf apni create ki hui products dekh/edit kar sakta hai
- Doosre staff ki products hidden hongi

### Use Case 3: Default Shop Access
**Scenario**: Staff ko sirf main shop ki inventory dikhani hai

**Setup**:
- Staff 1 → assignedLocationId = "" (empty), view = "all"

**Result**:
- Staff ko sirf default shop location ki saari products dikhegi
- Custom warehouses access nahi hongi

### Use Case 4: Default Shop - Own Products Only
**Scenario**: Shop mein multiple staff hain, har ek sirf apni products manage kare

**Setup**:
- Staff 1 → assignedLocationId = "" (empty), view = "own"

**Result**:
- Staff ko sirf apni create ki hui default shop ki products dikhegi

## Benefits
1. ✅ **Security**: Staff sirf allowed inventory access kar sakta hai
2. ✅ **Simplicity**: Simple view toggle (Own vs All Products)
3. ✅ **Organization**: Multi-location inventory ko separate manage kiya ja sakta hai
4. ✅ **Flexibility**: Admin control kar sakta hai ke staff kitna access chahiye
5. ✅ **Scalability**: Multiple warehouses aur branches ko easily manage kiya ja sakta hai

## Permission Matrix

| Assigned Location | View Mode | Result |
|------------------|-----------|---------|
| Default (Empty) | Own Only | ✅ Only own products in default shop |
| Default (Empty) | All Products | ✅ All products in default shop |
| Warehouse A | Own Only | ✅ Only own products in Warehouse A |
| Warehouse A | All Products | ✅ All products in Warehouse A |

## Future Enhancements
- [ ] Location-wise reporting aur analytics
- [ ] Transfer products between locations
- [ ] Location-wise stock alerts
- [ ] Bulk location assignment for existing staff
