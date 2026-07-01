import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function parsePrivateKey(raw) {
  if (!raw) return null;

  // Remove surrounding quotes if present (some env parsers leave them)
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // Replace literal \n with actual newlines
  key = key.replace(/\\n/g, "\n");

  // Ensure proper header/footer with newlines
  key = key
    .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
    .replace("-----END PRIVATE KEY-----",   "\n-----END PRIVATE KEY-----\n");

  // Collapse any double newlines caused by above replacements
  key = key.replace(/\n{2,}/g, "\n");

  return key.trim() + "\n";
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const privateKey = parsePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!process.env.FIREBASE_ADMIN_PROJECT_ID)   throw new Error("Missing FIREBASE_ADMIN_PROJECT_ID");
  if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) throw new Error("Missing FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!privateKey)                               throw new Error("Missing FIREBASE_ADMIN_PRIVATE_KEY");

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const app       = getAdminApp();
const adminAuth = getAuth(app);
const adminDb   = getFirestore(app);

export { adminAuth, adminDb };
