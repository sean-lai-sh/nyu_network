import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const status = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));
const avatarKind = v.union(v.literal("upload"), v.literal("url"));
const socialPlatform = v.union(
  v.literal("x"),
  v.literal("linkedin"),
  v.literal("email"),
  v.literal("github")
);

export default defineSchema({
  applications: defineTable({
    email: v.string(),
    fullName: v.string(),
    major: v.string(),
    website: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarKind,
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    status,
    reviewedAt: v.optional(v.number()),
    reviewedByAuthUserId: v.optional(v.string()),
    approvedProfileId: v.optional(v.id("profiles")),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  application_social_links: defineTable({
    applicationId: v.id("applications"),
    platform: socialPlatform,
    url: v.string(),
    createdAt: v.number()
  }).index("by_application", ["applicationId"]),

  application_connection_intents: defineTable({
    applicationId: v.id("applications"),
    targetProfileId: v.id("profiles"),
    createdAt: v.number()
  })
    .index("by_application", ["applicationId"])
    .index("by_target", ["targetProfileId"]),

  profiles: defineTable({
    email: v.string(),
    fullName: v.string(),
    major: v.string(),
    website: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    school: v.string(),
    avatarKind,
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    status: v.literal("approved"),
    approvedAt: v.number(),
    approvedByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_email", ["email"])
    .index("by_name", ["fullName"]),

  profile_social_links: defineTable({
    profileId: v.id("profiles"),
    platform: socialPlatform,
    url: v.string(),
    createdAt: v.number()
  }).index("by_profile", ["profileId"]),

  profile_revisions: defineTable({
    profileId: v.id("profiles"),
    submittedByAuthUserId: v.string(),
    payload: v.object({
      fullName: v.optional(v.string()),
      major: v.optional(v.string()),
      website: v.optional(v.string()),
      headline: v.optional(v.string()),
      bio: v.optional(v.string()),
      avatarKind: v.optional(avatarKind),
      avatarUrl: v.optional(v.string()),
      avatarStorageId: v.optional(v.id("_storage")),
      socials: v.optional(
        v.array(
          v.object({
            platform: socialPlatform,
            url: v.string()
          })
        )
      )
    }),
    status,
    reviewedAt: v.optional(v.number()),
    reviewedByAuthUserId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_profile", ["profileId"])
    .index("by_status", ["status"]),

  connections: defineTable({
    sourceProfileId: v.id("profiles"),
    targetProfileId: v.id("profiles"),
    createdByAuthUserId: v.string(),
    createdAt: v.number()
  })
    .index("by_source", ["sourceProfileId"])
    .index("by_target", ["targetProfileId"]),

  vouches: defineTable({
    voucherProfileId: v.id("profiles"),
    targetProfileId: v.id("profiles"),
    createdAt: v.number()
  })
    .index("by_voucher", ["voucherProfileId"])
    .index("by_target", ["targetProfileId"]),

  member_accounts: defineTable({
    authUserId: v.string(),
    profileId: v.id("profiles"),
    createdAt: v.number()
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_profile", ["profileId"]),

  admin_allowlist: defineTable({
    email: v.string(),
    createdAt: v.number()
  }).index("by_email", ["email"]),

  graph_snapshots: defineTable({
    version: v.number(),
    isCurrent: v.boolean(),
    snapshot: v.object({
      version: v.number(),
      generatedAt: v.string(),
      nodes: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
          fireScore: v.number()
        })
      ),
      edges: v.array(
        v.object({
          source: v.string(),
          target: v.string(),
          kind: v.union(v.literal("connection"), v.literal("vouch"))
        })
      )
    }),
    generatedAt: v.number()
  }).index("by_is_current", ["isCurrent"]),

  graph_meta: defineTable({
    key: v.string(),
    dirtySince: v.optional(v.number()),
    lastBuiltAt: v.optional(v.number())
  }).index("by_key", ["key"]),

  audit_log: defineTable({
    actorAuthUserId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number()
  }).index("by_created_at", ["createdAt"])
});
