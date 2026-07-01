import { NextResponse } from "next/server";

export async function GET(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  
  const envCheck = {
    NEXT_PUBLIC_ADMIN_UID:        process.env.NEXT_PUBLIC_ADMIN_UID ? "SET (" + process.env.NEXT_PUBLIC_ADMIN_UID.slice(0, 6) + "...)" : "MISSING",
    FIREBASE_ADMIN_PROJECT_ID:    process.env.FIREBASE_ADMIN_PROJECT_ID ? "SET" : "MISSING",
    FIREBASE_ADMIN_CLIENT_EMAIL:  process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? "SET" : "MISSING",
    FIREBASE_ADMIN_PRIVATE_KEY:   process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? `SET (len=${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length}, starts="${process.env.FIREBASE_ADMIN_PRIVATE_KEY.slice(0,27)}", ends="${process.env.FIREBASE_ADMIN_PRIVATE_KEY.slice(-20)}")`
      : "MISSING",
    tokenReceived: token ? "YES (len=" + token.length + ")" : "NO TOKEN",
  };

  // Try initializing firebase admin
  let adminInitResult = "not tested";
  let tokenDecodeResult = "not tested";
  let decodedUid = null;

  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    adminInitResult = "SUCCESS";

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        decodedUid = decoded.uid;
        tokenDecodeResult = "SUCCESS uid=" + decoded.uid;
        const isAdmin = decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID;
        tokenDecodeResult += " | isAdmin=" + isAdmin;
      } catch (e) {
        tokenDecodeResult = "FAILED: " + e.message;
      }
    }
  } catch (e) {
    adminInitResult = "FAILED: " + e.message;
  }

  return NextResponse.json({
    envCheck,
    adminInitResult,
    tokenDecodeResult,
    decodedUid,
  });
}
