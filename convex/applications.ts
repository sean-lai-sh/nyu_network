import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { resolveProfileAvatarUrl } from "./lib/avatar";
import { assertBioWordLimit } from "./lib/profile";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";
import { validateSlugFormat, findNextAvailableSlug } from "./lib/slug";

const socialInput = v.object({
  platform: v.union(v.literal("x"), v.literal("linkedin"), v.literal("email"), v.literal("github")),
  url: v.string()
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const searchApprovedConnections = query({
  args: {
    query: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const term = args.query?.trim().toLowerCase() ?? "";
    const profiles = await ctx.db.query("profiles").collect();

    const filteredProfiles = profiles
      .filter((profile) => !term || profile.fullName.toLowerCase().includes(term) || profile.major.toLowerCase().includes(term))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .slice(0, 25);

    return Promise.all(
      filteredProfiles.map(async (profile) => ({
        id: profile._id,
        fullName: profile.fullName,
        major: profile.major,
        website: profile.website,
        headline: profile.headline,
        avatarUrl: await resolveProfileAvatarUrl(ctx, profile)
      }))
    );
  }
});

export const submit = mutation({
  args: {
    slug: v.string(),
    email: v.string(),
    fullName: v.string(),
    major: v.string(),
    website: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarKind: v.union(v.literal("upload"), v.literal("url")),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    socials: v.array(socialInput),
    connectionTargetIds: v.array(v.id("profiles")),
    connectionSlugs: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = normalizeEmail(args.email);

    if (!email) {
      throw new ConvexError("Email is required.");
    }
    if (!args.major.trim()) {
      throw new ConvexError("Major is required.");
    }

    const slugError = validateSlugFormat(args.slug);
    if (slugError) {
      throw new ConvexError(slugError);
    }

    const existingSlug = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existingSlug) {
      const suggestion = await findNextAvailableSlug(ctx.db, args.slug);
      throw new ConvexError(`Slug '${args.slug}' is already taken. Next available: '${suggestion}'`);
    }

    // Resolve connection slugs to profile IDs
    const slugTargetIds: Id<"profiles">[] = [];
    if (args.connectionSlugs) {
      for (const slug of args.connectionSlugs) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
        if (!profile) {
          throw new ConvexError(`No member found with slug '${slug}'.`);
        }
        slugTargetIds.push(profile._id);
      }
    }

    const bio = args.bio?.trim();
    assertBioWordLimit(bio);

    const normalizedSocials = normalizeSocials(args.socials);
    assertSocialRequirements(normalizedSocials);

    const existingPending = await ctx.db
      .query("applications")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingPending?.status === "pending") {
      throw new ConvexError("An application with this email is already pending.");
    }

    const existingApproved = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingApproved) {
      throw new ConvexError("This email is already in the network.");
    }

    let avatarUrl = args.avatarUrl?.trim();
    if (args.avatarKind === "upload") {
      if (!args.avatarStorageId) {
        throw new ConvexError("Upload avatar selected but no uploaded file was provided.");
      }
      avatarUrl = (await ctx.storage.getUrl(args.avatarStorageId)) ?? undefined;
    }

    const applicationId = await ctx.db.insert("applications", {
      email,
      slug: args.slug,
      fullName: args.fullName.trim(),
      major: args.major.trim(),
      website: args.website?.trim() || undefined,
      headline: args.headline?.trim() || undefined,
      bio: bio || undefined,
      avatarKind: args.avatarKind,
      avatarUrl,
      avatarStorageId: args.avatarStorageId,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });

    for (const social of normalizedSocials) {
      await ctx.db.insert("application_social_links", {
        applicationId,
        platform: social.platform,
        url: social.url,
        createdAt: now
      });
    }

    const allTargetIds = [...args.connectionTargetIds, ...slugTargetIds];
    const dedupedTargets = Array.from(new Set(allTargetIds));
    for (const targetProfileId of dedupedTargets) {
      const target = await ctx.db.get(targetProfileId as Id<"profiles">);
      if (!target) {
        throw new ConvexError("Selected connection target does not exist.");
      }

      await ctx.db.insert("application_connection_intents", {
        applicationId,
        targetProfileId,
        createdAt: now
      });
    }

    await ctx.db.insert("audit_log", {
      action: "application.submit",
      entityType: "application",
      entityId: applicationId,
      metadata: {
        email,
        connectionIntents: dedupedTargets.length
      },
      createdAt: now
    });

    return { applicationId };
  }
});
