import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { buildGraphSnapshot } from "./lib/graph";
import { clearGraphDirty, getGraphMeta, markGraphDirty } from "./lib/graphState";

const getApprovedProfiles = async (ctx: { db: any }) => {
  return (await ctx.db.query("profiles").collect()) as Doc<"profiles">[];
};

const buildFireScores = ({
  vouches,
  approvedSet
}: {
  vouches: Doc<"vouches">[];
  approvedSet: Set<Id<"profiles">>;
}) => {
  const scoreMap = new Map<Id<"profiles">, Set<Id<"profiles">>>();

  for (const vouch of vouches) {
    if (!approvedSet.has(vouch.voucherProfileId) || !approvedSet.has(vouch.targetProfileId)) continue;
    if (vouch.voucherProfileId === vouch.targetProfileId) continue;

    if (!scoreMap.has(vouch.targetProfileId)) {
      scoreMap.set(vouch.targetProfileId, new Set());
    }

    scoreMap.get(vouch.targetProfileId)!.add(vouch.voucherProfileId);
  }

  const flattened = new Map<Id<"profiles">, number>();
  for (const [targetId, voucherSet] of scoreMap.entries()) {
    flattened.set(targetId, voucherSet.size);
  }

  return flattened;
};

const rebuildSnapshot = async (ctx: any, now: number) => {
  const profiles = await getApprovedProfiles(ctx);
  const approvedSet = new Set(profiles.map((profile) => profile._id));

  const allConnections = (await ctx.db.query("connections").collect()) as Doc<"connections">[];
  const filteredConnections = allConnections.filter(
    (connection) =>
      approvedSet.has(connection.sourceProfileId) &&
      approvedSet.has(connection.targetProfileId) &&
      connection.sourceProfileId !== connection.targetProfileId
  );

  const allVouches = (await ctx.db.query("vouches").collect()) as Doc<"vouches">[];
  const filteredVouches = allVouches.filter(
    (vouch) =>
      approvedSet.has(vouch.voucherProfileId) && approvedSet.has(vouch.targetProfileId) && vouch.voucherProfileId !== vouch.targetProfileId
  );

  const fireByProfile = buildFireScores({ vouches: filteredVouches, approvedSet });

  const currentRows = (await ctx.db
    .query("graph_snapshots")
    .withIndex("by_is_current", (q: any) => q.eq("isCurrent", true))
    .collect()) as Doc<"graph_snapshots">[];

  for (const row of currentRows) {
    await ctx.db.patch(row._id, { isCurrent: false });
  }

  const latestVersion = currentRows.reduce((max, row) => Math.max(max, row.version), 0);
  const version = latestVersion + 1;

  const snapshot = buildGraphSnapshot({
    profiles,
    connections: filteredConnections,
    vouches: filteredVouches,
    version,
    fireByProfile
  });

  await ctx.db.insert("graph_snapshots", {
    version,
    isCurrent: true,
    snapshot,
    generatedAt: now
  });

  await clearGraphDirty(ctx, now);
};

export const getCurrentSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    if (!row) {
      return {
        version: 0,
        generatedAt: new Date(0).toISOString(),
        nodes: [],
        edges: []
      };
    }

    const profiles = await ctx.db.query("profiles").collect();
    const profileById = new Map(profiles.map((profile) => [profile._id, profile]));

    const nodes = await Promise.all(
      row.snapshot.nodes.map(async (node) => {
        const profile = profileById.get(node.id as Id<"profiles">);
        if (!profile) return node;

        if (profile.avatarKind === "upload" && profile.avatarStorageId) {
          const freshAvatarUrl = await ctx.storage.getUrl(profile.avatarStorageId);
          return {
            ...node,
            avatarUrl: freshAvatarUrl ?? undefined
          };
        }

        return {
          ...node,
          avatarUrl: profile.avatarUrl
        };
      })
    );

    return {
      ...row.snapshot,
      nodes
    };
  }
});

export const markDirty = internalMutation({
  args: {
    reason: v.string(),
    actorAuthUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: args.actorAuthUserId,
      action: "graph.mark_dirty",
      entityType: "graph_snapshot",
      entityId: "primary",
      metadata: { reason: args.reason },
      createdAt: Date.now()
    });
  }
});

export const rebuildIfDirty = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const meta = await getGraphMeta(ctx);

    if (!meta.dirtySince) {
      return { rebuilt: false, reason: "clean" as const };
    }

    if (meta.lastBuiltAt && now - meta.lastBuiltAt < 60_000) {
      return { rebuilt: false, reason: "throttled" as const };
    }

    await rebuildSnapshot(ctx, now);
    return { rebuilt: true, reason: "dirty" as const };
  }
});

export const forceRebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    await rebuildSnapshot(ctx, Date.now());
    return { rebuilt: true };
  }
});

export const ensureGraphInitialized = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    if (!current) {
      await rebuildSnapshot(ctx, Date.now());
      return { initialized: true };
    }

    return { initialized: false };
  }
});

export const assertNoSelfEdge = ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
  if (sourceId === targetId) {
    throw new ConvexError("Self-references are not allowed.");
  }
};
