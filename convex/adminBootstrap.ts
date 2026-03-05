import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { createAuth } from "./auth";
import { rebuildGraphSnapshotNow } from "./graph";
import { resolveProfileAvatarUrl } from "./lib/avatar";
import { markGraphDirty } from "./lib/graphState";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";

type SeedAuthUser = {
  _id: string;
  userId?: string | null;
};

type SeedPerson = {
  fullName: string;
  email: string;
  slug: string;
  major: string;
  password: string;
  website?: string;
  socials: Array<{ platform: "x" | "linkedin" | "email" | "github"; url: string }>;
  avatarKind?: "url" | "upload";
  avatarUrl?: string;
  avatarStorageId?: Id<"_storage">;
};

const getMemberAuthUserId = (user: SeedAuthUser) => (user.userId?.trim() ? user.userId : user._id);

const assertBootstrapSecret = (secret: string) => {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid bootstrap secret.");
  }
};

const upsertCredentialAuthUser = async ({
  ctx,
  now,
  email,
  fullName,
  password,
  authContext
}: {
  ctx: any;
  now: number;
  email: string;
  fullName: string;
  password: string;
  authContext: any;
}) => {
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
          name: fullName,
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
          name: fullName,
          email,
          updatedAt: now
        }
      }
    });
  }

  if (!authUserDocId || !authUserId) {
    throw new ConvexError(`Failed to resolve auth user id for ${email}`);
  }

  const credentialPasswordHash = await authContext.password.hash(password);
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

  return {
    authAction,
    credentialAction,
    authUserId
  };
};

const resolveSeedAvatar = async (ctx: any, person: SeedPerson) => {
  const trimmedAvatarUrl = person.avatarUrl?.trim() || undefined;
  const hasAvatarUrl = Boolean(trimmedAvatarUrl);
  const hasAvatarStorageId = Boolean(person.avatarStorageId);

  if (!hasAvatarUrl && !hasAvatarStorageId) {
    throw new ConvexError(`Seed person ${person.email} must provide avatarUrl or avatarStorageId.`);
  }

  if (hasAvatarUrl && hasAvatarStorageId) {
    throw new ConvexError(`Seed person ${person.email} must provide only one avatar source: avatarUrl or avatarStorageId.`);
  }

  const inferredKind: "url" | "upload" = hasAvatarStorageId ? "upload" : "url";
  const resolvedAvatarKind = person.avatarKind ?? inferredKind;

  if (resolvedAvatarKind !== inferredKind) {
    throw new ConvexError(
      `Seed person ${person.email} avatarKind (${resolvedAvatarKind}) does not match provided avatar source (${inferredKind}).`
    );
  }

  const avatarUrl = await resolveProfileAvatarUrl(ctx, {
    avatarKind: resolvedAvatarKind,
    avatarUrl: trimmedAvatarUrl,
    avatarStorageId: person.avatarStorageId
  });

  if (!avatarUrl) {
    throw new ConvexError(`Seed person ${person.email} avatar could not be resolved to a usable URL.`);
  }

  return {
    avatarKind: resolvedAvatarKind,
    avatarUrl,
    avatarStorageId: resolvedAvatarKind === "upload" ? person.avatarStorageId : undefined
  };
};

const SEED_PEOPLE: SeedPerson[] = [
  {
    fullName: "Christopher Li",
    email: "christopherli@nyu.edu",
    slug: "christopher-li",
    major: "CS",
    password: "nyu-chris-2026",
    avatarUrl: "https://media.licdn.com/dms/image/v2/D4E03AQGCh5EFeegW2Q/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1730333774605?e=1774483200&v=beta&t=OLXwe3I9rCzzQkc7zZdZim72ZMPwG9Za9O4qVDbY_6o",
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
    slug: "sean-lai",
    major: "CS + Phil + Math",
    password: "nyu-sean-2026",
    avatarUrl: "https://media.licdn.com/dms/image/v2/D4E03AQGCtkm7C-HRYw/profile-displayphoto-shrink_400_400/B4EZVjhGqvHcAk-/0/1741131377701?e=1774483200&v=beta&t=BMVJM8170yLa7ofgbrt9z69aGn9sOdWxW4HMZ4X0CVw",
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
    assertBootstrapSecret(args.secret);

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
    assertBootstrapSecret(args.secret);

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
      const seededAvatar = await resolveSeedAvatar(ctx, person);
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
          slug: person.slug,
          fullName: person.fullName,
          major: person.major,
          website: person.website,
          headline: undefined,
          bio: undefined,
          school: "NYU",
          avatarKind: seededAvatar.avatarKind,
          avatarUrl: seededAvatar.avatarUrl,
          avatarStorageId: seededAvatar.avatarStorageId,
          status: "approved",
          approvedAt: now,
          approvedByAuthUserId: "seed-script",
          createdAt: now,
          updatedAt: now
        });
        profileAction = "created";
      } else {
        await ctx.db.patch(existing._id, {
          slug: person.slug,
          fullName: person.fullName,
          major: person.major,
          website: person.website,
          avatarKind: seededAvatar.avatarKind,
          avatarUrl: seededAvatar.avatarUrl,
          avatarStorageId: seededAvatar.avatarStorageId,
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

      const { authAction, credentialAction, authUserId } = await upsertCredentialAuthUser({
        ctx,
        now,
        email,
        fullName: person.fullName,
        password: person.password,
        authContext
      });

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
          avatarKind: seededAvatar.avatarKind,
          avatarUrl: seededAvatar.avatarUrl,
          avatarStorageId: seededAvatar.avatarStorageId,
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
    await rebuildGraphSnapshotNow(ctx, Date.now());

    return {
      success: true,
      count: seeded.length,
      graphSnapshotRebuilt: true,
      seeded
    };
  }
});

export const seedAdminAccount = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    password: v.string()
  },
  handler: async (ctx, args) => {
    assertBootstrapSecret(args.secret);

    const email = args.email.trim().toLowerCase();
    const password = args.password.trim();
    const fullName = args.name?.trim() || "NYU Network Admin";
    const now = Date.now();

    if (!email) {
      throw new ConvexError("Email is required.");
    }

    if (password.length < 8) {
      throw new ConvexError("Password must be at least 8 characters.");
    }

    const auth = createAuth(ctx);
    const authContext = await auth.$context;

    const { authAction, credentialAction, authUserId } = await upsertCredentialAuthUser({
      ctx,
      now,
      email,
      fullName,
      password,
      authContext
    });

    const existingAllowlist = await ctx.db
      .query("admin_allowlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    let allowlistAction: "created" | "already_exists" = "already_exists";
    if (!existingAllowlist) {
      await ctx.db.insert("admin_allowlist", {
        email,
        createdAt: now
      });
      allowlistAction = "created";
    }

    await ctx.db.insert("audit_log", {
      actorAuthUserId: "seed-script",
      action: "admin.seed.account",
      entityType: "admin_account",
      entityId: email,
      metadata: {
        email,
        authUserId,
        authAction,
        credentialAction,
        allowlistAction
      },
      createdAt: now
    });

    return {
      success: true,
      email,
      authUserId,
      authAction,
      credentialAction,
      allowlistAction
    };
  }
});
