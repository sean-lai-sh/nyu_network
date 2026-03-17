import { api } from "@/convex/_generated/api";
import { RevisionReviewActions } from "@/components/admin/revision-review-actions";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  return JSON.stringify(value);
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  major: "Major",
  website: "Website",
  headline: "Headline",
  bio: "Bio",
  avatarKind: "Avatar Kind",
  avatarUrl: "Avatar URL",
  avatarStorageId: "Avatar (Upload)",
  socials: "Socials",
};

export default async function AdminRevisionsPage() {
  await requireAdminPageAccess();

  let rows: any[] | null = null;
  let error: string | null = null;

  try {
    rows = await fetchAuthQuery(api.admin.listPendingRevisions, {});
  } catch (fetchError) {
    error = fetchError instanceof Error ? fetchError.message : "Unable to load revisions.";
  }

  if (error) {
    return (
      <div className="tm-page p-8">
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="tm-page">
      {/* Page header */}
      <div className="p-6 border-b border-[var(--border)]">
        <h1 className="text-xl font-black tracking-tight">Pending Revisions</h1>
        <p className="text-[11px] text-[var(--muted)] mt-1">
          {rows?.length === 0
            ? "No pending revisions."
            : `${rows?.length} revision${rows?.length !== 1 ? "s" : ""} awaiting review`}
        </p>
      </div>

      {rows?.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Queue clear</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {rows?.map((row) => {
            const payload = row.revision.payload as Record<string, unknown> | null;
            const payloadEntries = payload ? Object.entries(payload) : [];

            return (
              <article key={row.revision._id}>
                {/* Card header */}
                <div className="px-6 py-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-black tracking-tight leading-tight">
                      {row.profile.fullName}
                    </h2>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">{row.profile.email}</p>
                    <p className="text-[9px] text-[var(--muted)] mt-1 uppercase tracking-[0.15em]">
                      {payloadEntries.length} field{payloadEntries.length !== 1 ? "s" : ""} changed
                    </p>
                  </div>
                  <RevisionReviewActions revisionId={row.revision._id} />
                </div>

                {/* Proposed changes table */}
                <div className="border-t border-[var(--border)]">
                  <div className="px-6 py-3">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">
                      Proposed Changes
                    </p>
                    {payloadEntries.length > 0 ? (
                      <div className="space-y-0 divide-y divide-[var(--border-light)]">
                        {payloadEntries.map(([key, value]) => (
                          <div key={key} className="flex gap-4 py-2">
                            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] w-32 shrink-0 pt-0.5 font-medium">
                              {FIELD_LABELS[key] ?? key}
                            </span>
                            <span className="text-[11px] text-[var(--foreground)] break-all leading-relaxed flex-1">
                              {formatPayloadValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="text-[10px] text-[var(--muted)] overflow-x-auto">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
