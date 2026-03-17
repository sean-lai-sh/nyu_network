import { NextRequest, NextResponse } from "next/server";
import { convexHttp } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const profile = await convexHttp.query(api.search.getProfileBySlug, { slug });

  if (!profile) {
    return new NextResponse("Not found", { status: 404 });
  }

  const socialLines = profile.socials
    .map((s) => `- ${s.platform}: ${s.url}`)
    .join("\n");

  const doc = [
    `# ${profile.fullName}`,
    `**School:** ${profile.school}`,
    `**Major:** ${profile.major}`,
    profile.headline ? `**Headline:** ${profile.headline}` : null,
    profile.bio ? `\n## About\n${profile.bio}` : null,
    socialLines ? `\n## Socials\n${socialLines}` : null,
    profile.website ? `**Website:** ${profile.website}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return new NextResponse(doc, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
