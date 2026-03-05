import { v } from "convex/values";
import { query } from "./_generated/server";

export const listProfiles = query({
  args: {
    q: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const term = args.q?.trim().toLowerCase() ?? "";

    const snapshotRow = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    const fireById = new Map<string, number>();
    if (snapshotRow) {
      for (const node of snapshotRow.snapshot.nodes) {
        fireById.set(node.id, node.fireScore);
      }
    }

    const profiles = await ctx.db.query("profiles").collect();
    const profilesWithSocials = await Promise.all(
      profiles.map(async (profile) => {
        const socials = await ctx.db
          .query("profile_social_links")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .collect();

    const filtered = profiles
      .map((profile) => ({
        id: profile._id,
        fullName: profile.fullName,
        major: profile.major,
        website: profile.website,
        headline: profile.headline,
        avatarUrl: profile.avatarUrl,
        fireScore: fireById.get(profile._id) ?? 0
      }))
      .filter(
        (profile) =>
          !term ||
          profile.fullName.toLowerCase().includes(term) ||
          profile.headline?.toLowerCase().includes(term) ||
          profile.major.toLowerCase().includes(term) ||
          profile.website?.toLowerCase().includes(term) ||
          profile.socials.some((social) => social.url.toLowerCase().includes(term))
      )
      .sort((a, b) => b.fireScore - a.fireScore || a.fullName.localeCompare(b.fullName));

    const results = [];
    for (const profile of filtered) {
      const socialRows = await ctx.db
        .query("profile_social_links")
        .withIndex("by_profile", (q) => q.eq("profileId", profile.id))
        .collect();

      results.push({
        ...profile,
        socials: socialRows.map((s) => ({ platform: s.platform, url: s.url }))
      });
    }

    return results;
  }
});
