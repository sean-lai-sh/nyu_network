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

    const pendingRevision = await ctx.db
      .query("profile_revisions")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();

    const latestPending = pendingRevision
      .filter((revision) => revision.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    return {
      authUserId,
      profile,
      socials,
      connectionTargetIds: connections.map((connection) => connection.targetProfileId),
      vouchTargetIds: vouches.map((vouch) => vouch.targetProfileId),
      pendingRevision: latestPending ?? null
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

    let normalizedSocials = args.socials ? normalizeSocials(args.socials) : undefined;
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

    const payload = {
      fullName: args.fullName?.trim() || undefined,
      major: args.major?.trim() || undefined,
      website: args.website?.trim() || undefined,
      headline: args.headline?.trim() || undefined,
      bio: bio || undefined,
      avatarKind: args.avatarKind,
      avatarUrl: args.avatarUrl?.trim() || undefined,
      avatarStorageId: args.avatarStorageId,
      socials: normalizedSocials
    };

    const revisionId = await ctx.db.insert("profile_revisions", {
      profileId: profile._id,
      submittedByAuthUserId: authUserId,
      payload,
      status: "pending",
      createdAt: Date.now()
    });

    await ctx.db.insert("audit_log", {
      actorAuthUserId: authUserId,
      action: "profile.revision.submit",
      entityType: "profile_revision",
      entityId: revisionId,
      metadata: {
        profileId: profile._id
      },
      createdAt: Date.now()
    });

    return { revisionId };
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
