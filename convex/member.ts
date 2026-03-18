import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAuthEmail, getAuthUserId, requireApprovedMember, requireAuthUser } from "./lib/authz";
import { assertBioWordLimit } from "./lib/profile";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";
import { markGraphDirty } from "./lib/graphState";

const socialInput = v.object({
  platform: v.union(v.literal("x"), v.literal("linkedin"), v.literal("email"), v.literal("github")),
  url: v.string()
});

export const ensureMemberAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await requireAuthUser(ctx);
    const authUserId = getAuthUserId(authUser);

    const existingByAuth = await ctx.db
      .query("member_accounts")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
      .first();

    if (existingByAuth) {
      return { status: "linked", profileId: existingByAuth.profileId } as const;
    }

    const email = getAuthEmail(authUser);
    if (!email) {
      return { status: "not_approved" } as const;
    }

    const approvedProfile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!approvedProfile) {
      return { status: "not_approved" } as const;
    }

    const linkedByProfile = await ctx.db
      .query("member_accounts")
      .withIndex("by_profile", (q) => q.eq("profileId", approvedProfile._id))
      .first();

    if (linkedByProfile) {
      throw new ConvexError("This profile is already linked to another auth account.");
    }

    await ctx.db.insert("member_accounts", {
      authUserId,
      profileId: approvedProfile._id,
      createdAt: Date.now()
    });

    return { status: "linked", profileId: approvedProfile._id } as const;
  }
});

export const checkApprovedEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!profile || profile.status !== "approved") {
      return { approved: false, alreadyClaimed: false };
    }

    const linked = await ctx.db
      .query("member_accounts")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .first();

    return { approved: true, alreadyClaimed: Boolean(linked) };
  }
});

export const getSelf = query({
  args: {},
  handler: async (ctx) => {
    const { profile, authUser } = await requireApprovedMember(ctx);
    const authUserId = getAuthUserId(authUser);

    const socials = await ctx.db
      .query("profile_social_links")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_source", (q) => q.eq("sourceProfileId", profile._id))
      .collect();

    const vouches = await ctx.db
      .query("vouches")
      .withIndex("by_voucher", (q) => q.eq("voucherProfileId", profile._id))
      .collect();

    return {
      authUserId,
      profile,
      socials,
      connectionTargetIds: connections.map((connection) => connection.targetProfileId),
      vouchTargetIds: vouches.map((vouch) => vouch.targetProfileId),
      pendingRevision: null
    };
  }
});

export const submitRevision = mutation({
  args: {
    fullName: v.optional(v.string()),
    major: v.optional(v.string()),
    website: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarKind: v.optional(v.union(v.literal("upload"), v.literal("url"))),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    socials: v.optional(v.array(socialInput))
  },
  handler: async (ctx, args) => {
    const { profile, authUser } = await requireApprovedMember(ctx);
    const authUserId = getAuthUserId(authUser);
    const now = Date.now();

    const normalizedSocials = args.socials ? normalizeSocials(args.socials) : undefined;
    if (normalizedSocials) {
      assertSocialRequirements(normalizedSocials);
    }

    const hasAnyField =
      args.fullName !== undefined ||
      args.major !== undefined ||
      args.website !== undefined ||
      args.headline !== undefined ||
      args.bio !== undefined ||
      args.avatarKind !== undefined ||
      args.avatarUrl !== undefined ||
      args.avatarStorageId !== undefined ||
      normalizedSocials !== undefined;

    if (!hasAnyField) {
      throw new ConvexError("No profile changes were provided.");
    }

    if (args.avatarKind === "upload" && !args.avatarStorageId) {
      throw new ConvexError("Upload avatar selected but no uploaded file was provided.");
    }

    const bio = args.bio?.trim();
    assertBioWordLimit(bio);

    let resolvedAvatarUrl = args.avatarUrl?.trim() || undefined;
    if (args.avatarKind === "upload" && args.avatarStorageId) {
      resolvedAvatarUrl = (await ctx.storage.getUrl(args.avatarStorageId)) ?? undefined;
    }

    const nextProfile = {
      fullName: args.fullName?.trim() || profile.fullName,
      major: args.major?.trim() || profile.major,
      website: args.website?.trim() || profile.website,
      headline: args.headline?.trim() || profile.headline,
      bio: bio || profile.bio,
      avatarKind: args.avatarKind ?? profile.avatarKind,
      avatarUrl: resolvedAvatarUrl ?? profile.avatarUrl,
      avatarStorageId: args.avatarStorageId ?? profile.avatarStorageId
    };

    const changedFields = [
      nextProfile.fullName !== profile.fullName ? "fullName" : null,
      nextProfile.major !== profile.major ? "major" : null,
      nextProfile.website !== profile.website ? "website" : null,
      nextProfile.headline !== profile.headline ? "headline" : null,
      nextProfile.bio !== profile.bio ? "bio" : null,
      nextProfile.avatarKind !== profile.avatarKind ? "avatarKind" : null,
      nextProfile.avatarUrl !== profile.avatarUrl ? "avatarUrl" : null,
      nextProfile.avatarStorageId !== profile.avatarStorageId ? "avatarStorageId" : null
    ].filter((field): field is string => Boolean(field));

    await ctx.db.patch(profile._id, {
      ...nextProfile,
      updatedAt: now
    });

    if (normalizedSocials) {
      const existingSocials = await ctx.db
        .query("profile_social_links")
        .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
        .collect();

      for (const social of existingSocials) {
        await ctx.db.delete(social._id);
      }

      for (const social of normalizedSocials) {
        await ctx.db.insert("profile_social_links", {
          profileId: profile._id,
          platform: social.platform,
          url: social.url,
          createdAt: now
        });
      }
      changedFields.push("socials");
    }

    const shouldQueueGraphRefresh =
      nextProfile.fullName !== profile.fullName ||
      nextProfile.avatarKind !== profile.avatarKind ||
      nextProfile.avatarUrl !== profile.avatarUrl ||
      nextProfile.avatarStorageId !== profile.avatarStorageId;

    if (shouldQueueGraphRefresh) {
      await markGraphDirty(ctx);
    }

    await ctx.db.insert("audit_log", {
      actorAuthUserId: authUserId,
      action: "profile.update",
      entityType: "profile",
      entityId: profile._id,
      metadata: {
        changedFields,
        graphRefreshQueued: shouldQueueGraphRefresh
      },
      createdAt: now
    });

    return { success: true };
  }
});

export const setConnections = mutation({
  args: {
    targetProfileIds: v.array(v.id("profiles"))
  },
  handler: async (ctx, args) => {
    const { profile, authUser } = await requireApprovedMember(ctx);
    const authUserId = getAuthUserId(authUser);
    const uniqueTargets = Array.from(new Set(args.targetProfileIds));

    for (const targetProfileId of uniqueTargets) {
      if (targetProfileId === profile._id) {
        throw new ConvexError("You cannot connect to yourself.");
      }

      const targetProfile = await ctx.db.get(targetProfileId as Id<"profiles">);
      if (!targetProfile) {
        throw new ConvexError("One of the selected connections no longer exists.");
      }
    }

    const existing = await ctx.db
      .query("connections")
      .withIndex("by_source", (q) => q.eq("sourceProfileId", profile._id))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const targetProfileId of uniqueTargets) {
      await ctx.db.insert("connections", {
        sourceProfileId: profile._id,
        targetProfileId,
        createdByAuthUserId: authUserId,
        createdAt: now
      });
    }

    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: authUserId,
      action: "connection.set",
      entityType: "profile",
      entityId: profile._id,
      metadata: {
        count: uniqueTargets.length
      },
      createdAt: now
    });

    return { success: true };
  }
});

export const setTopVouches = mutation({
  args: {
    targetProfileIds: v.array(v.id("profiles"))
  },
  handler: async (ctx, args) => {
    const { profile, authUser } = await requireApprovedMember(ctx);
    const authUserId = getAuthUserId(authUser);
    const uniqueTargets = Array.from(new Set(args.targetProfileIds));

    if (uniqueTargets.length > 5) {
      throw new ConvexError("You can vouch for up to 5 people.");
    }

    for (const targetProfileId of uniqueTargets) {
      if (targetProfileId === profile._id) {
        throw new ConvexError("You cannot vouch for yourself.");
      }

      const targetProfile = await ctx.db.get(targetProfileId as Id<"profiles">);
      if (!targetProfile) {
        throw new ConvexError("One of the selected vouch targets no longer exists.");
      }
    }

    const existing = await ctx.db
      .query("vouches")
      .withIndex("by_voucher", (q) => q.eq("voucherProfileId", profile._id))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const targetProfileId of uniqueTargets) {
      await ctx.db.insert("vouches", {
        voucherProfileId: profile._id,
        targetProfileId,
        createdAt: now
      });
    }

    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: authUserId,
      action: "vouch.set",
      entityType: "profile",
      entityId: profile._id,
      metadata: {
        count: uniqueTargets.length
      },
      createdAt: now
    });

    return { success: true };
  }
});
