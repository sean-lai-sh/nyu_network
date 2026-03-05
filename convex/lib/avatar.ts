import type { Doc, Id } from "../_generated/dataModel";

type AvatarContext = {
  storage: {
    getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
  };
};

export const resolveProfileAvatarUrl = async (
  ctx: AvatarContext,
  profile: Pick<Doc<"profiles">, "avatarKind" | "avatarUrl" | "avatarStorageId">
) => {
  if (profile.avatarKind === "upload" && profile.avatarStorageId) {
    const freshAvatarUrl = await ctx.storage.getUrl(profile.avatarStorageId);
    if (freshAvatarUrl) {
      return freshAvatarUrl;
    }
  }

  const trimmedAvatarUrl = profile.avatarUrl?.trim();
  return trimmedAvatarUrl || undefined;
};
