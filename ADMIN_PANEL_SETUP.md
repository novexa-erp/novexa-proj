# Admin Panel Setup Guide

## Step 1 — Get Your Admin UID

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open project `novexa-epr`
3. Go to **Authentication → Users**
4. Find your own account (the one you use to login)
5. Copy the **UID** column value
6. Open `.env.local` and replace `PASTE_YOUR_FIREBASE_UID_HERE` with your UID

---

## Step 2 — Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open project `novexa-epr`
3. Click the ⚙️ gear icon → **Project Settings**
4. Click the **Service Accounts** tab
5. Click **"Generate new private key"** button → Download the JSON file
6. Open the downloaded JSON file and copy these values into `.env.local`:
   - `client_email` → paste as `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → paste as `FIREBASE_ADMIN_PRIVATE_KEY` (keep the quotes around it)
   - `project_id` is already set

### Example `.env.local` entries:
```
NEXT_PUBLIC_ADMIN_UID=abc123xyz789
FIREBASE_ADMIN_PROJECT_ID=novexa-epr
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@novexa-epr.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkq...\n-----END PRIVATE KEY-----\n"
```

---

## Step 3 — Update Firestore Rules

1. Go to Firebase Console → **Firestore Database → Rules**
2. Copy and paste the contents of `firestore.rules` from this project
3. Click **Publish**

---

## Step 4 — Restart Dev Server

After updating `.env.local`, restart:
```
npm run dev
```

---

## Admin Panel URL

Once setup is complete, access the admin panel at:
```
http://localhost:3000/admin
```

Only your account (the UID you set in `NEXT_PUBLIC_ADMIN_UID`) can access it.
Everyone else gets redirected to login.

---

## How It Works

| Feature | Details |
|---------|---------|
| Register user | Admin fills form → Firebase Auth account created → Firestore profile saved |
| Subscription | Set `activeFrom` and `activeTo` dates — user access is auto-controlled |
| Auto-freeze | On login, server checks subscription dates → expired = auto-frozen |
| Manual freeze | Admin clicks 🔒 → user is immediately blocked from dashboard |
| Unfreeze | Admin clicks 🔓 → user can login again |
| Remove user | Auth disabled, data kept safe in Firestore |
| Security | All admin API routes verify your ID token server-side — cannot be spoofed |
