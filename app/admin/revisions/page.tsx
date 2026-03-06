import { api } from "@/convex/_generated/api";
import { RevisionReviewActions } from "@/components/admin/revision-review-actions";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

const ARCH = `   ___________________________________________________
  |___________________________________________________|
  | .:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.  |
  | :+==+=========+===========+=========+==+======:  |
  | .:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.  |
  |___________________________________________________|
  |          |                           |           |
  |          |   _______________________  |           |
  |          |  /                       \\ |           |
  |          | |                         ||           |
  |          | |                         ||           |
  |          | |                         ||           |
  |          | |                         ||           |
  |__________|_|                         |_|___________|
             |                           |
             |___________________________|`;

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
      <div className="tm-page tm-card p-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">System / Revisions</p>
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="tm-page space-y-px">
      <div className="tm-card p-8 flex items-start justify-between gap-8">
        <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-3">System / Moderation</p>
        <h1 className="text-3xl font-black tracking-tight">Pending Revisions</h1>
        {rows?.length === 0 ? (
          <p className="text-sm text-[var(--muted)] mt-3">No pending revisions.</p>
        ) : (
          <p className="text-xs text-[var(--muted)] mt-2">
            {rows?.length} revision{rows?.length !== 1 ? "s" : ""} awaiting review
          </p>
        )}
        </div>
        <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
      </div>

      <div className="space-y-px bg-[var(--border)]">
        {rows?.map((row) => {
          const payload = row.revision.payload as Record<string, unknown> | null;
          const payloadEntries = payload ? Object.entries(payload) : [];

          return (
            <article key={row.revision._id} className="tm-card">
              <div className="p-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight">{row.profile.fullName}</h2>
                  <p className="text-xs text-[var(--muted)] mt-1">{row.profile.email}</p>
                </div>
                <RevisionReviewActions revisionId={row.revision._id} />
              </div>

              <hr className="tm-divider" />

              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Proposed Changes</p>
                {payloadEntries.length > 0 ? (
                  <div>
                    {payloadEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex gap-4 py-2 border-b border-[var(--border-light)] last:border-none"
                      >
                        <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] w-28 shrink-0 pt-0.5">
                          {key}
                        </span>
                        <span className="text-xs text-[var(--foreground)] break-all leading-relaxed">
                          {formatPayloadValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-xs text-[var(--muted)] overflow-x-auto">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
