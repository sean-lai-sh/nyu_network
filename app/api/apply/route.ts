import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { api } from "@/convex/_generated/api";
import { convexHttp } from "@/lib/convex-client";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10MB
const AVATAR_SIZE = 256; // 256x256px

async function fetchAndResizeAvatar(url: string): Promise<{ storageId: string; storageUrl: string } | null> {
  const res = await fetch(url);
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_AVATAR_BYTES) return null;

  const resized = await sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const uploadUrl = await convexHttp.mutation(api.uploads.generatePublicUploadUrl, {});
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: resized,
  });
  if (!uploadRes.ok) return null;

  const { storageId } = (await uploadRes.json()) as { storageId: string };
  const storageUrl = await convexHttp.mutation(api.uploads.getStorageUrl, {
    storageId: storageId as any,
  });
  if (!storageUrl) return null;

  return { storageId, storageUrl };
}

// 10 requests per day per email
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const emailRequests = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const entry = emailRequests.get(key);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    emailRequests.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

interface ApplyPayload {
  slug: string;
  email: string;
  fullName: string;
  major: string;
  website?: string;
  bio?: string;
  avatarUrl: string;
  socials?: {
    x?: string;
    linkedin?: string;
    github?: string;
  };
  connections?: string[];
}

export async function POST(req: NextRequest) {
  let body: ApplyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 }
    );
  }

  if (!body.slug || !body.email || !body.fullName || !body.major || !body.avatarUrl) {
    return NextResponse.json(
      { error: "Missing required fields: slug, email, fullName, major, avatarUrl." },
      { status: 400 }
    );
  }

  if (!body.email.trim().toLowerCase().endsWith("@nyu.edu")) {
    return NextResponse.json(
      { error: "Email must be an @nyu.edu address." },
      { status: 400 }
    );
  }

  const socials = body.socials ?? {};
  const providedSocials = Object.entries(socials).filter(([, v]) => v && v.trim() !== "");
  if (providedSocials.length === 0) {
    return NextResponse.json(
      { error: "At least one social link is required (x, linkedin, github)." },
      { status: 400 }
    );
  }

  if (!checkRateLimit(body.email)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. 10 requests per day per email." },
      { status: 429 }
    );
  }

  try {
    let avatarKind: "url" | "upload" = "url";
    let avatarUrl: string | undefined = body.avatarUrl;
    let avatarStorageId: string | undefined;

    const uploaded = await fetchAndResizeAvatar(body.avatarUrl);
    if (uploaded) {
      avatarKind = "upload";
      avatarUrl = uploaded.storageUrl;
      avatarStorageId = uploaded.storageId;
    }

    const result = await convexHttp.mutation(api.applications.submit, {
      slug: body.slug,
      email: body.email,
      fullName: body.fullName,
      major: body.major,
      website: body.website || undefined,
      bio: body.bio || undefined,
      avatarKind,
      avatarUrl,
      avatarStorageId: avatarStorageId as any,
      socials: providedSocials.map(([platform, url]) => ({ platform, url: url! })),
      connectionTargetIds: [],
      connectionSlugs: body.connections ?? [],
    });

    return NextResponse.json({
      status: "pending",
      message: "Application submitted. You'll be added to the network once an admin approves.",
      applicationId: result.applicationId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Submission failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
