# Firebase Rules & Configuration Setup Guide

## 📋 Step-by-Step Firebase Console Configuration

### 1️⃣ **Firebase Console Access**

1. Go to: https://console.firebase.google.com
2. Login with your Google account
3. Select your project: **novexa-epr**

---

## 🔐 **Authentication Setup (REQUIRED)**

### Step 1: Enable Email/Password Authentication

1. Firebase Console mein apni project select karein
2. Left sidebar mein **"Build"** section mein **"Authentication"** par click karein
3. **"Get Started"** button click karein (agar pehli baar hai)
4. **"Sign-in method"** tab par click karein
5. **"Email/Password"** option par click karein
6. **Enable** toggle ON karein (first option)
7. **"Email link (passwordless sign-in)"** ko OFF hi rakhe (second option)
8. **"Save"** button click karein

✅ **Ab Email/Password authentication enabled hai!**

---

## 🗄️ **Firestore Database Rules (Optional but Recommended)**

Agar aap future mein user data store karna chahte hain (business info, invoices, etc.):

### Step 1: Create Firestore Database

1. Left sidebar mein **"Build" → "Firestore Database"** par click karein
2. **"Create database"** button click karein
3. **Production mode** select karein
4. Location select karein (preferably **asia-south1** for Pakistan/India)
5. **"Enable"** click karein

### Step 2: Set Firestore Security Rules

1. **"Rules"** tab par click karein
2. Ye rules paste karein:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Helper function to check if user is accessing their own data
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection - each user can only read/write their own document
    match /users/{userId} {
      allow read, write: if isSignedIn() && isOwner(userId);
    }
    
    // Business info collection
    match /businesses/{businessId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && 
                      (resource == null || resource.data.ownerId == request.auth.uid);
    }
    
    // Customers collection - users can only access their own customers
    match /customers/{customerId} {
      allow read, write: if isSignedIn() && 
                            (resource == null || resource.data.userId == request.auth.uid);
    }
    
    // Invoices collection - users can only access their own invoices
    match /invoices/{invoiceId} {
      allow read, write: if isSignedIn() && 
                            (resource == null || resource.data.userId == request.auth.uid);
    }
    
    // Products collection - users can only access their own products
    match /products/{productId} {
      allow read, write: if isSignedIn() && 
                            (resource == null || resource.data.userId == request.auth.uid);
    }
    
    // Payments collection - users can only access their own payments
    match /payments/{paymentId} {
      allow read, write: if isSignedIn() && 
                            (resource == null || resource.data.userId == request.auth.uid);
    }
    
    // Block all other access by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. **"Publish"** button click karein

✅ **Security rules set ho gaye!**

---

## 💾 **Firebase Storage Rules (Optional)**

Agar aap files upload karna chahte hain (logos, invoices PDFs, etc.):

### Step 1: Enable Storage

1. Left sidebar mein **"Build" → "Storage"** par click karein
2. **"Get started"** button click karein
3. **Production mode** select karein
4. Location select karein (same as Firestore)
5. **"Done"** click karein

### Step 2: Set Storage Security Rules

1. **"Rules"** tab par click karein
2. Ye rules paste karein:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }
    
    // User profile images
    match /users/{userId}/profile/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Business logos
    match /businesses/{businessId}/logo/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn()
                   && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Invoice PDFs
    match /invoices/{userId}/{invoiceId}/{fileName} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow write: if isSignedIn() && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024  // Max 10MB
                   && request.resource.contentType == 'application/pdf';
    }
    
    // Block all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

3. **"Publish"** button click karein

✅ **Storage rules set ho gaye!**

---

## ⚙️ **Additional Settings**

### 1. Authorized Domains (for Production)

1. **Authentication** → **Settings** tab
2. **Authorized domains** section mein scroll karein
3. Click **"Add domain"**
4. Apna production domain add karein (e.g., `novexa.com`)

### 2. Email Templates Customize (Optional)

1. **Authentication** → **Templates** tab
2. Email verification, Password reset templates customize kar sakte hain
3. Apna company logo aur branding add karein

### 3. Usage Quotas Check

1. Top-right corner mein **"Usage"** tab
2. Free tier limits dekhein:
   - 10,000 document reads/day (Firestore)
   - 20,000 document writes/day
   - 50 authentication users (first 50 free, then paid)

---

## 🔍 **Testing & Verification**

### Check Authentication is Working:

1. **Authentication** → **Users** tab
2. Test registration karein apni app mein
3. User list mein naya user dikhai dena chahiye

### Check Firestore Rules:

1. **Firestore Database** → **Rules** tab
2. Test simulator use karein:
   - Authenticated user ki tarah test karein
   - Check read/write permissions

---

## 📊 **Security Best Practices**

✅ **Production-Ready Rules:**

```javascript
// GOOD - Secure rules with authentication check
allow read, write: if request.auth != null && request.auth.uid == userId;

// BAD - Never use in production!
allow read, write: if true;  // ❌ Anyone can access!
```

✅ **Data Validation Example:**

```javascript
match /users/{userId} {
  allow write: if isSignedIn() 
               && isOwner(userId)
               && request.resource.data.email is string
               && request.resource.data.email.matches('.*@.*[.].*')
               && request.resource.data.name.size() > 0
               && request.resource.data.name.size() <= 100;
}
```

---

## 🚨 **Important Security Warnings**

### ❌ NEVER use these rules in production:

```javascript
// Development ONLY - Testing ke liye
allow read, write: if true;  

// Open access - DANGEROUS!
allow read, write: if request.time != null;
```

### ✅ ALWAYS use authenticated rules:

```javascript
// Secure - Production-ready
allow read, write: if request.auth != null && isOwner(userId);
```

---

## 📱 **Firebase Console Mobile App**

Firebase ka mobile app bhi hai monitoring ke liye:
- **iOS:** App Store se "Firebase Console" download karein
- **Android:** Play Store se download karein
- Real-time user monitoring aur analytics dekhein

---

## 🔗 **Quick Links**

- **Firebase Console:** https://console.firebase.google.com
- **Firebase Documentation:** https://firebase.google.com/docs
- **Security Rules Guide:** https://firebase.google.com/docs/rules
- **Authentication Docs:** https://firebase.google.com/docs/auth

---

## ✅ **Quick Setup Checklist**

- [ ] Firebase Console mein login karein
- [ ] Project select karein (novexa-epr)
- [ ] **Authentication** enable karein (Email/Password)
- [ ] **Firestore Database** create karein (optional)
- [ ] **Firestore Rules** set karein (copy-paste from above)
- [ ] **Storage** enable karein (optional)
- [ ] **Storage Rules** set karein (copy-paste from above)
- [ ] Test registration karein apni app se
- [ ] **Users** tab mein verify karein user create hua

---

## 🎯 **Minimum Required Steps (For Current App)**

Abhi ke liye sirf ye zaroori hai:

1. ✅ Firebase Console → **Authentication** → Enable **Email/Password**
2. ✅ Test karein registration aur login

Baaki Firestore aur Storage future mein add kar sakte hain jab data store karna ho!

---

**Status:** Ready to configure! 🚀
