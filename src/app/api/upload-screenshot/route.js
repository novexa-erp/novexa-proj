import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with server-side env vars
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function verifyUser(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    return await adminAuth.verifyIdToken(token);
  } catch { return null; }
}

export async function POST(request) {
  try {
    // Verify Firebase token
    const decoded = await verifyUser(request);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { dataUrl, uid } = body;

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Valid image dataUrl required" }, { status: 400 });
    }
    if (!uid || decoded.uid !== uid) {
      return NextResponse.json({ error: "UID mismatch" }, { status: 403 });
    }

    // Upload to Cloudinary — store under addon-screenshots/{uid}/
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder:         `novexa/addon-screenshots/${uid}`,
      resource_type:  "image",
      // Auto-compress and convert to webp for smaller storage
      transformation: [{ quality: "auto", fetch_format: "auto" }],
      // Tag for easy identification / bulk cleanup
      tags: ["addon-payment", uid],
    });

    return NextResponse.json({
      success:   true,
      url:       result.secure_url,
      publicId:  result.public_id,
      width:     result.width,
      height:    result.height,
    });

  } catch (err) {
    console.error("[upload-screenshot] Error:", err.message);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
