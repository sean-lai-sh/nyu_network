import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

export const getProfileForIndexing = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const socials = await ctx.db
      .query("profile_social_links")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .collect();
    return { ...profile, socials };
  }
});

async function niaIndex(apiKey: string, url: string, displayName: string) {
  const res = await fetch(`${NIA_BASE}/sources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "documentation",
      url,
      display_name: displayName,
      add_as_global_source: false
    })
  });
  if (!res.ok) {
    console.error(`Nia index failed for ${url}: ${res.status} ${await res.text()}`);
  }
}

export const indexProfile = internalAction({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const apiKey = process.env.NIA_API_KEY;
    if (!apiKey) {
      console.warn("NIA_API_KEY not set — skipping Nia indexing");
      return;
    }

    const profile = await ctx.runQuery(internal.indexing.getProfileForIndexing, { profileId });
    if (!profile) return;

    const siteUrl = (process.env.SITE_URL ?? "https://nyu.network").replace(/\/$/, "");

    const toIndex: { url: string; name: string }[] = [
      {
        url: `${siteUrl}/api/profiles/${profile.slug}/context`,
        name: `NYU Network: ${profile.slug}`
      },
      ...profile.socials
        .filter((s) => s.platform !== "email")
        .map((s) => ({ url: s.url, name: `${profile.slug} — ${s.platform}` })),
      ...(profile.website
        ? [{ url: profile.website, name: `${profile.slug} — website` }]
        : [])
    ];

    await Promise.allSettled(
      toIndex.map(({ url, name }) => niaIndex(apiKey, url, name))
    );
  }
});
