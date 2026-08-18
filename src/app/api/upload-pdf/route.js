import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    // imageBase64 = JPEG base64 string (from html2canvas)
    const { imageBase64, fileName } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    // Upload JPEG image to Cloudinary (free plan supports images)
    const dataUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: "image",
      folder:        "novexa-invoices",
      public_id:     fileName || `invoice-${Date.now()}`,
      overwrite:     true,
      // Optimize for viewing on mobile (WhatsApp preview)
      transformation: [{ quality: "auto:good", fetch_format: "auto" }],
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("[upload-pdf]", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
