# Staff Location Access - Setup Guide (اردو)

## فیچر کی تفصیل

یہ فیچر آپ کو اپنے Staff members کو مخصوص locations (دکان یا گودام) assign کرنے کی سہولت دیتا ہے۔

## ستپ بائی ستپ گائیڈ

### 1️⃣ Staff Create یا Edit کریں

**Dashboard → Staff Management → Add Staff / Edit Staff**

### 2️⃣ Inventory Module Select کریں

Modules section میں **"📦 Inventory"** checkbox check کریں

### 3️⃣ View Permission سیٹ کریں

#### Option A: "👁️ All Products" (تمام Products)
- Staff کو **ساری inventory** دکھائی دے گی
- اگر "Hide Custom Locations" enable کریں تو **صرف default shop** دکھائی دے گی

#### Option B: "👤 Own Only" (صرف اپنی Products)
- Staff کو **صرف اپنے بنائے ہوئے products** یا **assigned location** کی products دکھائی دیں گی
- یہ option select کرنے پر نئے options دکھائی دیں گے ⬇️

### 4️⃣ Location Assign کریں (Own Only mode میں)

**"📍 Assigned Location"** dropdown میں سے location select کریں:
- **— Default Location (Shop) —**: Main shop/دکان
- **Custom Locations**: جو warehouses آپ نے create کیے ہیں (مثلاً Warehouse A, Warehouse B)

> 💡 **نوٹ**: اگر کوئی location select نہیں کی تو automatically Default Shop assign ہو گی

### 5️⃣ View Level سیٹ کریں (Own Only mode میں)

**"Can View All Products in Location"** checkbox:

#### ✅ Enabled (Checked)
```
Staff کو اس location کی SAARI products دکھائی دیں گی
چاہے کسی نے بھی وہ product create کیا ہو
```

**مثال**: 
- Staff ko Warehouse A assign کیا
- Checkbox enable کیا
- Staff کو Warehouse A کی **تمام products** دکھائی دیں گی

#### ❌ Disabled (Unchecked)
```
Staff کو صرف APNI create کی ہوئی products دکھائی دیں گی
جو اس location میں ہوں
```

**مثال**:
- Staff ko Warehouse A assign کیا
- Checkbox disable کیا
- Staff کو صرف **اپنی بنائی ہوئی** Warehouse A کی products دکھائی دیں گی

---

## مختلف Scenarios

### 🏪 Scenario 1: Main Shop Access
**کیا چاہیے**: Staff صرف main دکان کی inventory دیکھے

**Setup**:
```
✅ View: Own Only
📍 Assigned Location: — Default Location (Shop) —
✅ View All in Location: Enabled
```

**نتیجہ**: Staff کو default shop کی تمام products دکھیں گی، warehouses hide ہوں گی

---

### 🏭 Scenario 2: Warehouse Full Access
**کیا چاہیے**: Staff کو Warehouse A کی ساری inventory manage کرنی ہے

**Setup**:
```
✅ View: Own Only
📍 Assigned Location: Warehouse A
✅ View All in Location: Enabled
```

**نتیجہ**: Staff کو Warehouse A کی **تمام products** دکھیں گی (کسی نے بھی create کی ہوں)

---

### 🔐 Scenario 3: Personal Products Only
**کیا چاہیے**: Warehouse میں multiple staff ہیں، ہر staff صرف اپنی products دیکھے

**Setup**:
```
✅ View: Own Only
📍 Assigned Location: Warehouse A
❌ View All in Location: Disabled
```

**نتیجہ**: Staff کو صرف **اپنی create کی ہوئی** Warehouse A کی products دکھیں گی

---

### 🌐 Scenario 4: All Locations Access
**کیا چاہیے**: Staff کو سب locations کی inventory دکھنی چاہیے

**Setup**:
```
✅ View: All Products
❌ Hide Custom Locations: Disabled
```

**نتیجہ**: Staff کو **تمام locations** کی **ساری products** دکھیں گی

---

## Product Create کرتے وقت

### Staff Login (Own Only mode):
```
1. Staff inventory میں جائے
2. Add Product click کرے
3. Location field AUTOMATICALLY staff کی assigned location پر set ہو گی
4. Staff دوسری location select نہیں کر سکتا
```

### Admin Login:
```
1. Admin inventory میں جائے
2. Add Product click کرے
3. Location field میں کوئی بھی location select کر سکتا ہے
4. یا default چھوڑ سکتا ہے
```

---

## Staff Card پر Information

جب Staff کو location assign ہو تو Staff Card پر دکھائی دے گا:

```
┌─────────────────────────────┐
│ 👤 Staff Name               │
│ staff@example.com           │
│ [Staff] [📍 Location]       │  ← یہ badge دکھے گا
│                             │
│ Modules (3)                 │
│ [📦 Inventory] [📊 Analytics]│
└─────────────────────────────┘
```

---

## چیک لسٹ (Testing کے لیے)

### Admin Side
- [ ] Staff create کیا location assign کے ساتھ
- [ ] "View All in Location" checkbox toggle کیا
- [ ] Staff card پر location badge دکھ رہا ہے
- [ ] Location dropdown میں تمام locations دکھ رہی ہیں

### Staff Side (View All = ON)
- [ ] Staff login کیا
- [ ] Assigned location کی تمام products دکھ رہی ہیں
- [ ] دوسری locations کی products hide ہیں
- [ ] Product create کیا → automatically location assign ہوئی
- [ ] دوسرے staff کی products بھی دکھ رہی ہیں (same location میں)

### Staff Side (View All = OFF)
- [ ] Staff login کیا
- [ ] صرف اپنی create کی ہوئی products دکھ رہی ہیں
- [ ] دوسرے staff کی products hide ہیں (same location میں بھی)
- [ ] Product create کیا → automatically location assign ہوئی

---

## اہم نوٹس

### ⚠️ Security
- Staff صرف allowed inventory access کر سکتا ہے
- Admin ہمیشہ تمام products دیکھ سکتا ہے
- Staff دوسری location میں product create نہیں کر سکتا

### 💡 Best Practices
1. پہلے Locations create کریں (Settings → Locations)
2. پھر Staff کو assign کریں
3. Testing کے لیے test staff account بنائیں
4. Production میں use کرنے سے پہلے test کریں

### 🔄 پرانے Staff Members
- جو staff پہلے سے موجود ہیں ان کا `viewAllInLocation` default `false` ہے
- یعنی وہ صرف اپنی products دیکھیں گے
- Admin edit کر کے enable کر سکتا ہے

---

## مدد چاہیے؟

اگر کوئی مسئلہ آئے تو:
1. Locations check کریں کہ deleted تو نہیں
2. Staff permissions دوبارہ چیک کریں
3. Browser refresh کریں
4. Staff کو logout/login کروائیں

**Documentation Files**:
- `STAFF_LOCATION_ACCESS_FEATURE.md` - Technical details
- `IMPLEMENTATION_SUMMARY_LOCATION_ACCESS.md` - Implementation guide
