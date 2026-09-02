# Referral System Design Document

## Overview
Complete referral system jo automatically users ko referral codes generate kare, discounts apply kare, aur referrers ko credits de.

## Referral Code Format
```
NOV-REF-SSDMMYY
```
- **SS**: Serial number (01, 02, 03...) - globally unique, never repeats
- **DD**: Day (01-31)
- **MM**: Month (01-12)
- **YY**: Year (last 2 digits, e.g., 26 for 2026)

Example: `NOV-REF-01020926` (Serial 01, 2nd September 2026)

## Firestore Collections

### 1. `users` Collection (Existing - Modified)
```javascript
{
  uid: "user123",
  name: "Muhammad Aqdas",
  email: "user@example.com",
  plan: "starter",
  status: "active",
  activeFrom: "2026-09-01",
  activeTo: "2026-10-01",
  
  // NEW FIELDS FOR REFERRAL SYSTEM
  referralCode: "NOV-REF-01020926",           // User's unique referral code (generated when package active)
  referredBy: "NOV-REF-00010826",             // Referral code used during registration (optional)
  referredByUid: "referrer_uid",              // UID of referrer (for quick lookups)
  referralCredits: 499,                       // Available credits in PKR
  referralCreditsHistory: [                   // Credit transaction history
    {
      type: "earned",                         // "earned" or "redeemed"
      amount: 499,                            // Amount in PKR
      fromUserUid: "new_user_uid",           // UID of referred user (for earned)
      fromUserName: "Ali Khan",              // Name of referred user
      packagePrice: 4990,                    // Package price that generated credit
      description: "10% commission from Ali Khan's Business package",
      createdAt: "2026-09-02T10:30:00Z"
    }
  ]
}
```

### 2. `referralCodes` Collection (NEW)
Global tracker for serial numbers and code ownership.

```javascript
{
  code: "NOV-REF-01020926",                   // Document ID (the full code)
  uid: "user123",                             // Owner's UID
  userName: "Muhammad Aqdas",                 // Owner's name
  userEmail: "user@example.com",              // Owner's email
  serialNumber: 1,                            // Serial number (globally unique)
  generatedAt: "2026-09-02T10:00:00Z",       // When code was generated
  isActive: true,                             // Can be used for referrals
  usageCount: 5,                              // How many users used this code
  totalCreditsEarned: 2495                    // Total credits earned from this code
}
```

### 3. `referralStats` Collection (NEW)
Quick lookup for dashboard stats.

```javascript
{
  uid: "user123",                             // Document ID (referrer's UID)
  totalReferrals: 5,                          // Total users referred
  totalCreditsEarned: 2495,                   // Lifetime credits earned
  totalCreditsRedeemed: 1000,                 // Total credits used
  availableCredits: 1495,                     // Current balance
  referredUsers: [                            // Array of referred users
    {
      uid: "referred_user_1",
      name: "Ali Khan",
      email: "ali@example.com",
      packagePrice: 4990,
      creditEarned: 499,
      referredAt: "2026-09-02T10:30:00Z"
    }
  ],
  lastUpdated: "2026-09-02T10:30:00Z"
}
```

### 4. `referralMetadata` Collection (NEW)
Global counters and configuration.

```javascript
{
  id: "globalCounter",                        // Document ID
  nextSerialNumber: 42,                       // Next serial number to assign
  totalCodesGenerated: 41,                    // Total codes created
  totalReferrals: 150,                        // Total successful referrals
  discountPercentage: 10,                     // Discount for referred user (%)
  commissionPercentage: 10,                   // Commission for referrer (%)
  lastUpdated: "2026-09-02T10:30:00Z"
}
```

## Workflow

### 1. User Package Activation
```
Admin activates user package (status = "active")
→ Check if user already has referralCode
→ If NO:
  → Get next serial number from referralMetadata
  → Generate code: NOV-REF-{serial}{DD}{MM}{YY}
  → Create referralCodes document
  → Update user document with referralCode
  → Increment nextSerialNumber in referralMetadata
```

### 2. New User Registration with Referral Code
```
Admin creates new user
→ User provides referral code (optional): "NOV-REF-01020926"
→ Validate code:
  → Check if code exists in referralCodes collection
  → Check if referrer's package is active
→ If VALID:
  → Calculate 10% discount on package price
  → Apply discount to package
  → Store referredBy and referredByUid in new user document
  → After package activated:
    → Calculate 10% commission
    → Add credit to referrer's account
    → Update referralStats for referrer
    → Add entry to referralCreditsHistory
```

### 3. Referral Dashboard View
```
User views Referral section
→ Show their referral code
→ Show total referrals count
→ Show available credits
→ Show list of referred users
→ Show credit history (earned & redeemed)
→ Option to use credits for next billing or add-ons
```

### 4. Credit Redemption
```
User selects to use credits
→ Check available credits
→ Apply to billing/add-on amount
→ Deduct from user's referralCredits
→ Add redemption entry to referralCreditsHistory
→ Update referralStats
```

## Security Rules (Firestore)

```javascript
// Only admin can create referral codes
match /referralCodes/{code} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == 'ADMIN_UID';
}

// Users can only read their own stats
match /referralStats/{uid} {
  allow read: if request.auth.uid == uid || request.auth.uid == 'ADMIN_UID';
  allow write: if request.auth.uid == 'ADMIN_UID';
}

// Only admin can update metadata
match /referralMetadata/{doc} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == 'ADMIN_UID';
}
```

## API Endpoints Needed

1. **POST /api/referral/generate**
   - Generate referral code for user (called during package activation)

2. **POST /api/referral/verify**
   - Verify referral code validity
   - Return referrer info

3. **POST /api/referral/apply-discount**
   - Calculate and apply 10% discount
   - Credit referrer account

4. **GET /api/referral/stats**
   - Get user's referral stats and history

5. **POST /api/referral/redeem**
   - Redeem credits for billing/add-ons

## UI Components Needed

1. **ReferralCodeInput** (in Registration Modal)
   - Input field with "NOV-REF_" prefix
   - Fetch button to verify code
   - Show referrer info when valid

2. **ReferralView** (Sidebar Component)
   - Display referral code (copy to clipboard)
   - Show total referrals count
   - Show available credits
   - List of referred users
   - Credit history table
   - Redeem credits button

3. **ReferralStatsCard** (Dashboard)
   - Quick view of referral performance
   - Link to full Referral View

## Implementation Priority

1. ✅ Design collections structure
2. ⏳ Create utility functions for code generation
3. ⏳ Add referral code generation on package activation
4. ⏳ Create referral verification API
5. ⏳ Build registration modal referral input
6. ⏳ Implement discount calculation logic
7. ⏳ Implement credit system
8. ⏳ Build ReferralView component
9. ⏳ Add to dashboard sidebar
10. ⏳ Test complete flow

## Notes

- Referral codes are generated ONLY when package is active (status = "active")
- Serial numbers NEVER repeat (global counter)
- Credits are valid for lifetime (no expiry)
- Credits can be used for:
  - Next month's billing
  - Package upgrades
  - Add-on purchases
  - Extra limits
- Discount is applied ONLY for the first month of referred user's package
- Commission is calculated on the DISCOUNTED price (after 10% off)

## Example Flow

```
Day 1:
- Ali's package activated → Code generated: NOV-REF-01020926

Day 5:
- Hassan registers, uses Ali's code: NOV-REF-01020926
- Hassan's Starter package: Rs. 2499/month
- 10% discount applied: Rs. 225 OFF → Hassan pays Rs. 2274
- Ali gets 10% credit: Rs. 225 added to Ali's account

Day 10:
- Sara registers, uses Ali's code: NOV-REF-01020926
- Sara's Business package: Rs. 4999/month
- 10% discount: Rs. 500 OFF → Sara pays Rs. 4499
- Ali gets Rs. 500 credit → Total credits: Rs. 725

Day 30:
- Ali's package renewal: Rs. 2499
- Ali uses Rs. 500 credits
- Ali pays: Rs. 1999
- Remaining credits: Rs. 225
```
