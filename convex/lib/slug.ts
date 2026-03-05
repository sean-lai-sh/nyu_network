import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

export function validateSlugFormat(slug: string): string | null {
  if (!slug) return "Slug is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Slug must be lowercase alphanumeric with hyphens (e.g. john-doe).";
  }
  if (slug.length > 64) return "Slug must be 64 characters or fewer.";
  return null;
}

export async function findNextAvailableSlug(
  db: GenericDatabaseReader<DataModel>,
  baseSlug: string
): Promise<string> {
  // Strip existing numeric suffix to get the base (e.g. "john-doe-3" -> "john-doe")
  const base = baseSlug.replace(/-\d+$/, "");
  let suffix = 1;
  while (true) {
    suffix++;
    const candidate = `${base}-${suffix}`;
    const existing = await db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing) return candidate;
  }
}
