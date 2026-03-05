import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { createAuth } from "./auth";
import { markGraphDirty } from "./lib/graphState";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";

type SeedAuthUser = {
  _id: string;
  userId?: string | null;
};

const getMemberAuthUserId = (user: SeedAuthUser) => (user.userId?.trim() ? user.userId : user._id);

const SEED_PEOPLE = [
  {
    fullName: "Christopher Li",
    email: "christopherli@nyu.edu",
    major: "CS",
    password: "nyu-chris-2026",
    website: "https://christopherli.dev",
    socials: [
      { platform: "x" as const, url: "https://x.com/christopherrli" },
      { platform: "linkedin" as const, url: "https://www.linkedin.com/in/christopherrli/" },
      { platform: "email" as const, url: "mailto:christopherli@nyu.edu" },
      { platform: "github" as const, url: "https://github.com/christopherlii" }
    ]
  },
  {
    fullName: "Sean Lai",
    email: "seanlai@nyu.edu",
    major: "CS + Phil + Math",
    password: "nyu-sean-2026",
    website: "https://seanlai.co",
    socials: [
      { platform: "github" as const, url: "https://github.com/sean-lai-sh" },
      { platform: "email" as const, url: "mailto:seanlai@nyu.edu" },
      { platform: "x" as const, url: "https://x.com/sean-secure-shell" }
    ]
  }
];

export const seedAllowlist = mutation({
  args: {
    email: v.string(),
    secret: v.string()
  },
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("admin_allowlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!existing) {
      await ctx.db.insert("admin_allowlist", {
        email,
        createdAt: Date.now()
      });
    }

    return { success: true };
  }
});

export const seedPeople = mutation({
  args: {
    secret: v.string()
  },
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const now = Date.now();
    const seeded: Array<{
      email: string;
      profileId: string;
      authUserId: string;
      profileAction: "created" | "updated";
      authAction: "created" | "updated";
      credentialAction: "created" | "updated";
      examplePassword: string;
    }> = [];

    const auth = createAuth(ctx);
    const authContext = await auth.$context;

    for (const person of SEED_PEOPLE) {
      const email = person.email.trim().toLowerCase();
      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      const normalizedSocials = normalizeSocials(person.socials);
      assertSocialRequirements(normalizedSocials);

      let profileId = existing?._id;
      let profileAction: "created" | "updated" = "updated";

      if (!existing) {
        profileId = await ctx.db.insert("profiles", {
          email,
          fullName: person.fullName,
          major: person.major,
          website: person.website,
          headline: undefined,
          bio: undefined,
          school: "NYU",
          avatarKind: "url",
          avatarUrl: undefined,
          avatarStorageId: undefined,
          status: "approved",
          approvedAt: now,
          approvedByAuthUserId: "seed-script",
          createdAt: now,
          updatedAt: now
        });
        profileAction = "created";
      } else {
        await ctx.db.patch(existing._id, {
          fullName: person.fullName,
          major: person.major,
          website: person.website,
          updatedAt: now
        });
      }

      if (!profileId) {
        throw new ConvexError(`Failed to resolve seeded profile id for ${email}`);
      }

      const existingSocials = await ctx.db
        .query("profile_social_links")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect();

      for (const social of existingSocials) {
        await ctx.db.delete(social._id);
      }

      for (const social of normalizedSocials) {
        await ctx.db.insert("profile_social_links", {
          profileId,
          platform: social.platform,
          url: social.url,
          createdAt: now
        });
      }

      const existingAuthUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", operator: "eq", value: email }]
      })) as SeedAuthUser | null;

      let authAction: "created" | "updated" = "updated";
      let authUserDocId = existingAuthUser?._id;
      let authUserId = existingAuthUser ? getMemberAuthUserId(existingAuthUser) : undefined;

      if (!existingAuthUser) {
        const createdAuthUser = (await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "user",
            data: {
              name: person.fullName,
              email,
              emailVerified: true,
              createdAt: now,
              updatedAt: now
            }
          }
        })) as SeedAuthUser;

        authUserDocId = createdAuthUser._id;
        authUserId = getMemberAuthUserId(createdAuthUser);
        authAction = "created";
      } else {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "user",
            where: [{ field: "_id", operator: "eq", value: existingAuthUser._id }],
            update: {
              name: person.fullName,
              email,
              updatedAt: now
            }
          }
        });
      }

      if (!authUserDocId || !authUserId) {
        throw new ConvexError(`Failed to resolve auth user id for ${email}`);
      }

      const credentialPasswordHash = await authContext.password.hash(person.password);
      const existingCredentialAccount = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "account",
        where: [
          { field: "providerId", operator: "eq", value: "credential" },
          { field: "userId", operator: "eq", value: authUserDocId }
        ]
      })) as { _id: string } | null;

      let credentialAction: "created" | "updated" = "updated";
      if (!existingCredentialAccount) {
        await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "account",
            data: {
              accountId: authUserDocId,
              providerId: "credential",
              userId: authUserDocId,
              password: credentialPasswordHash,
              createdAt: now,
              updatedAt: now
            }
          }
        });
        credentialAction = "created";
      } else {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "account",
            where: [{ field: "_id", operator: "eq", value: existingCredentialAccount._id }],
            update: {
              password: credentialPasswordHash,
              updatedAt: now
            }
          }
        });
      }

      const memberByProfile = await ctx.db
        .query("member_accounts")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .first();
      const memberByAuth = await ctx.db
        .query("member_accounts")
        .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
        .first();

      if (memberByProfile && memberByAuth && memberByProfile._id !== memberByAuth._id) {
        await ctx.db.delete(memberByAuth._id);
      }

      const linkedRow = memberByProfile ?? memberByAuth;

      if (!linkedRow) {
        await ctx.db.insert("member_accounts", {
          authUserId,
          profileId,
          createdAt: now
        });
      } else {
        await ctx.db.patch(linkedRow._id, {
          authUserId,
          profileId
        });
      }

      await ctx.db.insert("audit_log", {
        actorAuthUserId: "seed-script",
        action: profileAction === "created" ? "profile.seed.create" : "profile.seed.update",
        entityType: "profile",
        entityId: profileId,
        metadata: {
          email,
          major: person.major,
          website: person.website,
          authUserId,
          authAction,
          credentialAction
        },
        createdAt: now
      });

      seeded.push({
        email,
        profileId,
        authUserId,
        profileAction,
        authAction,
        credentialAction,
        examplePassword: person.password
      });
    }

    await markGraphDirty(ctx);

    return {
      success: true,
      count: seeded.length,
      seeded
    };
  }
});
