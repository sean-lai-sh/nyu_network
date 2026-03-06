import { NextRequest, NextResponse } from "next/server";
import { nia } from "@/lib/nia";
import { convexHttp } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.SITE_URL ?? "https://nyu.network").replace(/\/$/, "");
const PROFILE_CONTEXT_PATH = "/api/profiles/";
const CONTEXT_SUFFIX = "/context";

function extractSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (path.startsWith(PROFILE_CONTEXT_PATH) && path.endsWith(CONTEXT_SUFFIX)) {
      return path.slice(PROFILE_CONTEXT_PATH.length, -CONTEXT_SUFFIX.length);
    }
  } catch {
    // ignore invalid URLs
  }
  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ profiles: [] });
  }

  let rawResults: any;
  try {
    rawResults = await nia.search.query({
      messages: [{ role: "user", content: q }],
      skip_llm: true,
      include_sources: true,
      fast_mode: true
    });
  } catch (err) {
    console.error("Nia search error:", err);
    return NextResponse.json({ profiles: [] });
  }

  // Extract slugs from profile context URLs in the results
  const sources: any[] = rawResults?.sources ?? rawResults?.results ?? [];
  const slugs: string[] = [];
  const seen = new Set<string>();

  for (const src of sources) {
    const url: string = src?.url ?? src?.identifier ?? src?.source_url ?? "";
    const slug = extractSlugFromUrl(url);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }

  if (slugs.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  // Fetch profiles from Convex in parallel
  const profileResults = await Promise.allSettled(
    slugs.map((slug) => convexHttp.query(api.search.getProfileBySlug, { slug }))
  );

  const profiles = profileResults
    .filter((r): r is PromiseFulfilledResult<NonNullable<any>> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  return NextResponse.json({ profiles });
}
