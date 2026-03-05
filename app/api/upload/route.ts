import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { api } from "@/convex/_generated/api";
import { convexHttp } from "@/lib/convex-client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const OUTPUT_SIZE = 256; // 256x256px

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Content-Type must be an image (e.g. image/png, image/jpeg)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await req.arrayBuffer());

  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File must be under 10MB." },
      { status: 400 }
    );
  }

  const resized = await sharp(buffer)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Get a Convex upload URL and upload the resized image
  const uploadUrl = await convexHttp.mutation(api.uploads.generatePublicUploadUrl, {});

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(resized),
  });

  if (!uploadRes.ok) {
    return NextResponse.json(
      { error: "Failed to upload to storage." },
      { status: 502 }
    );
  }

  const { storageId } = (await uploadRes.json()) as { storageId: string };
  const url = await convexHttp.mutation(api.uploads.getStorageUrl, {
    storageId: storageId as any,
  });

  if (!url) {
    return NextResponse.json(
      { error: "Failed to resolve storage URL." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url });
}
