import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAuthEmail, getAuthUserId, requireAdmin } from "./lib/authz";
import { markGraphDirty } from "./lib/graphState";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";

export const getAdminViewer = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await requireAdmin(ctx);
      return {
        isAdmin: true as const,
        email: getAuthEmail(user)
      };
    } catch {
      return {
        isAdmin: false as const
      };
    }
  }
});

export const listPendingApplications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const rows = [];
    for (const application of applications.sort((a, b) => b.createdAt - a.createdAt)) {
      const socials = await ctx.db
        .query("application_social_links")
        .withIndex("by_application", (q) => q.eq("applicationId", application._id))
        .collect();

      const intents = await ctx.db
        .query("application_connection_intents")
        .withIndex("by_application", (q) => q.eq("applicationId", application._id))
        .collect();

      const targets = [];
      for (const intent of intents) {
        const target = await ctx.db.get(intent.targetProfileId);
        if (target) {
          targets.push({ id: target._id, fullName: target.fullName });
        }
      }

      rows.push({
        application,
        socials,
        connectionTargets: targets
      });
    }

    return rows;
  }
});

export const reviewApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const adminUserId = getAuthUserId(adminUser);
    const now = Date.now();

    const application = await ctx.db.get(args.applicationId);
    if (!application) {
      throw new ConvexError("Application not found.");
    }

    if (application.status !== "pending") {
      throw new ConvexError("Application has already been reviewed.");
    }

    if (args.decision === "reject") {
      await ctx.db.patch(application._id, {
        status: "rejected",
        reviewedAt: now,
        reviewedByAuthUserId: adminUserId,
        rejectionReason: args.reason?.trim() || undefined,
        updatedAt: now
      });

      await ctx.db.insert("audit_log", {
        actorAuthUserId: adminUserId,
        action: "application.reject",
        entityType: "application",
        entityId: application._id,
        metadata: {
          reason: args.reason
        },
        createdAt: now
      });

      return { decision: "rejected" as const };
    }

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", application.email))
      .first();

    if (existingProfile) {
      throw new ConvexError("A profile with this email already exists.");
    }

    const profileId = await ctx.db.insert("profiles", {
      email: application.email,
      fullName: application.fullName,
      major: application.major,
      website: application.website,
      headline: application.headline,
      bio: application.bio,
      school: "NYU",
      avatarKind: application.avatarKind,
      avatarUrl: application.avatarUrl,
      avatarStorageId: application.avatarStorageId,
      status: "approved",
      approvedAt: now,
      approvedByAuthUserId: adminUserId,
      createdAt: now,
      updatedAt: now
    });

    const socials = await ctx.db
      .query("application_social_links")
      .withIndex("by_application", (q) => q.eq("applicationId", application._id))
      .collect();

    const normalizedSocials = normalizeSocials(socials.map((social) => ({ platform: social.platform, url: social.url })));
    assertSocialRequirements(normalizedSocials);

    for (const social of normalizedSocials) {
      await ctx.db.insert("profile_social_links", {
        profileId,
        platform: social.platform,
        url: social.url,
        createdAt: now
      });
    }

    const intents = await ctx.db
      .query("application_connection_intents")
      .withIndex("by_application", (q) => q.eq("applicationId", application._id))
      .collect();

    const existingConnections = await ctx.db
      .query("connections")
      .withIndex("by_source", (q) => q.eq("sourceProfileId", profileId))
      .collect();
    const existingTargetSet = new Set(existingConnections.map((c) => c.targetProfileId));

    for (const intent of intents) {
      if (intent.targetProfileId === profileId) continue;
      const target = await ctx.db.get(intent.targetProfileId as Id<"profiles">);
      if (!target) continue;
      if (existingTargetSet.has(intent.targetProfileId)) continue;

      await ctx.db.insert("connections", {
        sourceProfileId: profileId,
        targetProfileId: intent.targetProfileId,
        createdByAuthUserId: adminUserId,
        createdAt: now
      });
    }

    await ctx.db.patch(application._id, {
      status: "approved",
      reviewedAt: now,
      reviewedByAuthUserId: adminUserId,
      approvedProfileId: profileId,
      updatedAt: now
    });

    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: adminUserId,
      action: "application.approve",
      entityType: "application",
      entityId: application._id,
      metadata: {
        approvedProfileId: profileId
      },
      createdAt: now
    });

    return { decision: "approved" as const, profileId };
  }
});

export const listPendingRevisions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const revisions = await ctx.db
      .query("profile_revisions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const rows = [];
    for (const revision of revisions.sort((a, b) => b.createdAt - a.createdAt)) {
      const profile = await ctx.db.get(revision.profileId);
      if (!profile) continue;

      rows.push({
        revision,
        profile
      });
    }

    return rows;
  }
});

export const reviewRevision = mutation({
  args: {
    revisionId: v.id("profile_revisions"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const adminUserId = getAuthUserId(adminUser);
    const now = Date.now();

    const revision = await ctx.db.get(args.revisionId);
    if (!revision) {
      throw new ConvexError("Revision not found.");
    }

    if (revision.status !== "pending") {
      throw new ConvexError("Revision already reviewed.");
    }

    const profile = await ctx.db.get(revision.profileId);
    if (!profile) {
      throw new ConvexError("Profile not found for revision.");
    }

    if (args.decision === "reject") {
      await ctx.db.patch(revision._id, {
        status: "rejected",
        reviewedByAuthUserId: adminUserId,
        reviewedAt: now,
        rejectionReason: args.reason?.trim() || undefined
      });

      await ctx.db.insert("audit_log", {
        actorAuthUserId: adminUserId,
        action: "profile.revision.reject",
        entityType: "profile_revision",
        entityId: revision._id,
        metadata: {
          profileId: revision.profileId,
          reason: args.reason
        },
        createdAt: now
      });

      return { decision: "rejected" as const };
    }

    let avatarUrl = revision.payload.avatarUrl;
    if (revision.payload.avatarKind === "upload" && revision.payload.avatarStorageId) {
      avatarUrl = (await ctx.storage.getUrl(revision.payload.avatarStorageId)) ?? undefined;
    }

    await ctx.db.patch(profile._id, {
      fullName: revision.payload.fullName ?? profile.fullName,
      major: revision.payload.major ?? profile.major,
      website: revision.payload.website ?? profile.website,
      headline: revision.payload.headline ?? profile.headline,
      bio: revision.payload.bio ?? profile.bio,
      avatarKind: revision.payload.avatarKind ?? profile.avatarKind,
      avatarUrl: avatarUrl ?? profile.avatarUrl,
      avatarStorageId: revision.payload.avatarStorageId ?? profile.avatarStorageId,
      updatedAt: now
    });

    if (revision.payload.socials) {
      const normalizedSocials = normalizeSocials(revision.payload.socials);
      assertSocialRequirements(normalizedSocials);

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
    }

    await ctx.db.patch(revision._id, {
      status: "approved",
      reviewedByAuthUserId: adminUserId,
      reviewedAt: now
    });

    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: adminUserId,
      action: "profile.revision.approve",
      entityType: "profile_revision",
      entityId: revision._id,
      metadata: {
        profileId: revision.profileId
      },
      createdAt: now
    });

    return { decision: "approved" as const };
  }
});
