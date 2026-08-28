# Staff Location Access - آسان گائیڈ (اردو)

## فیچر کی تفصیل

یہ فیچر آپ کو اپنے Staff members کو مخصوص locations (دکان یا گودام) assign کرنے کی سہولت دیتا ہے۔

---

## 🎯 سادہ سمجھیں

### دو چیزیں سیٹ کرنی ہیں:

#### 1️⃣ **Location** (کہاں کام کرے گا)
```
- Default (خالی چھوڑیں) = Main Shop
- Warehouse A = گودام A
- Warehouse B = گودام B
```

#### 2️⃣ **View Mode** (کیا دیکھ سکتا ہے)
```
- Own Only = صرف اپنی بنائی ہوئی products
- All Products = اس location کی ساری products
```

---

## 📋 مختلف Combinations

### Option 1: Main Shop - صرف اپنی Products
```
Location: — Default (خالی) —
View: 👤 Own Only
```
**نتیجہ**: Staff کو **صرف اپنی** default shop کی products دکھیں گی

---

### Option 2: Main Shop - ساری Products
```
Location: — Default (خالی) —
View: 👁️ All Products
```
**نتیجہ**: Staff کو **تمام** default shop کی products دکھیں گی

---

### Option 3: Warehouse A - صرف اپنی Products
```
Location: Warehouse A
View: 👤 Own Only
```
**نتیجہ**: Staff کو **صرف اپنی** Warehouse A کی products دکھیں گی

---

### Option 4: Warehouse A - ساری Products
```
Location: Warehouse A
View: 👁️ All Products
```
**نتیجہ**: Staff کو **تمام** Warehouse A کی products دکھیں گی (کسی نے بھی بنائی ہوں)

---

## 🚀 Setup کیسے کریں

### Step 1: Staff Management میں جائیں
**Dashboard → Staff Management**

### Step 2: Staff Create/Edit کریں
**Add Staff** یا **Edit** button دبائیں

### Step 3: Inventory Module Enable کریں
**Modules** section میں **"📦 Inventory"** check کریں

### Step 4: View Permission Select کریں
```
👤 Own Only      → صرف اپنی products
👁️ All Products  → ساری products
```

### Step 5: Location Assign کریں
```
📍 Assigned Location dropdown:
  ├─ — Default Location (Main Shop) — (main دکان)
  ├─ Warehouse A
  └─ Warehouse B
```

### Step 6: Save کریں ✅

---

## 💡 مثالیں

### مثال 1: دکان کا سیلز مین
**ضرورت**: دکان کی ساری products دیکھے، invoice بنائے

**Setup**:
```
Location: — Default —
View: All Products
Create: ✅
Edit: ❌
Delete: ❌
```

---

### مثال 2: گودام کا منیجر
**ضرورت**: اپنے گودام کی ساری inventory manage کرے

**Setup**:
```
Location: Warehouse A
View: All Products
Create: ✅
Edit: ✅
Delete: ✅
```

---

### مثال 3: گودام کا ورکر
**ضرورت**: صرف اپنی receive کی ہوئی products دیکھے

**Setup**:
```
Location: Warehouse A
View: Own Only
Create: ✅
Edit: ✅
Delete: ❌
```

---

### مثال 4: دکان میں کئی Staff
**ضرورت**: ہر staff صرف اپنی products manage کرے

**Setup (دونوں staff کے لیے)**:
```
Location: — Default —
View: Own Only
Create: ✅
Edit: ✅
Delete: ❌
```

---

## 🔐 کیا ہوتا ہے؟

### Product Create کرتے وقت:
```
✅ Location automatically staff کی assigned location پر set ہو جاتی ہے
❌ Staff location field change نہیں کر سکتا
✅ Product save ہوتے ہی staff کو دکھے گی (view permission کے مطابق)
```

### Product Dekhtay Waqت:
```
Own Only Mode:
  ✅ اپنی بنائی products دکھیں گی
  ❌ دوسروں کی products hide ہوں گی

All Products Mode:
  ✅ سب کی بنائی products دکھیں گی
  ✅ اسی location کی hongi
```

---

## 📊 Quick Decision Table

| کیا چاہیے؟ | Location | View Mode |
|-----------|----------|-----------|
| Main shop - سب products | Default | All Products |
| Main shop - صرف اپنی | Default | Own Only |
| Warehouse A - سب products | Warehouse A | All Products |
| Warehouse A - صرف اپنی | Warehouse A | Own Only |

---

## ⚠️ اہم نوٹس

### 1. Location ہمیشہ ضروری ہے
- Staff کو کوئی نہ کوئی location assign کریں
- خالی چھوڑیں تو automatically Default shop assign ہو گی

### 2. Staff Product Location Change نہیں کر سکتا
- Product ہمیشہ staff کی assigned location میں بنتی ہے
- Staff دوسری location میں product create نہیں کر سکتا

### 3. Admin کو کوئی پابندی نہیں
- Admin ساری locations کی products دیکھ سکتا ہے
- Admin کسی بھی location میں product بنا سکتا ہے

---

## 🐛 مسائل اور حل

### مسئلہ: Staff کو کوئی product نہیں دکھ رہی

**چیک کریں**:
- ✓ کیا Inventory module enabled ہے?
- ✓ کیا location assign کی ہے?
- ✓ کیا اس location میں products ہیں?
- ✓ View mode "Own Only" ہے تو کیا staff نے products بنائی ہیں?

---

### مسئلہ: Staff غلط products دیکھ رہا ہے

**چیک کریں**:
- ✓ Assigned location صحیح ہے?
- ✓ View mode صحیح select کیا ہے (Own vs All)?
- ✓ Products کی locationId صحیح ہے?

---

### مسئلہ: Staff product create نہیں کر سکتا

**چیک کریں**:
- ✓ Create permission enabled ہے?
- ✓ Inventory module allowed modules میں ہے?
- ✓ Location properly assigned ہے?

---

## 📚 ویڈیو Walkthrough (Coming Soon)

1. Staff کو location assign کرنا
2. View permission set کرنا
3. Product create/view testing
4. Common issues troubleshooting

---

## ✅ Testing Checklist

### Admin Side:
- [ ] Staff create کیا location کے ساتھ
- [ ] View mode toggle کیا (Own/All)
- [ ] Staff card پر location badge check کیا
- [ ] Permissions properly saved ہیں

### Staff Side (Own Only):
- [ ] Staff login کیا
- [ ] صرف اپنی products دکھ رہی ہیں
- [ ] Product create کیا - auto location assign ہوئی
- [ ] Dوسروں کی products hide ہیں

### Staff Side (All Products):
- [ ] Staff login کیا
- [ ] سب کی products دکھ رہی ہیں (assigned location کی)
- [ ] Product create کیا - auto location assign ہوئی
- [ ] دوسری locations کی products hide ہیں

---

## 💬 مدد چاہیے؟

Documentation files دیکھیں:
- `STAFF_LOCATION_ACCESS_FEATURE.md` - مکمل تفصیل
- `QUICK_REFERENCE_LOCATION_ACCESS.md` - فوری reference
