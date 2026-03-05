import { api } from "@/convex/_generated/api";
import { RevisionReviewActions } from "@/components/admin/revision-review-actions";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

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
      <section className="brutal-card p-6">
        <h2 className="text-3xl font-black">Admin Revisions</h2>
        <p className="mt-3 text-sm text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="brutal-card p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
        <h2 className="text-3xl font-black">Pending Profile Revisions</h2>
      </div>

      {rows?.length === 0 ? <p className="text-sm text-[var(--muted)]">No pending revisions.</p> : null}

      {rows?.map((row) => (
        <article key={row.revision._id} className="brutal-card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">{row.profile.fullName}</h3>
              <p className="mono text-xs text-[var(--muted)]">{row.profile.email}</p>
            </div>
            <RevisionReviewActions revisionId={row.revision._id} />
          </div>

          <pre className="overflow-x-auto border-2 border-[var(--border)] bg-[#fff] p-3 text-xs">
            {JSON.stringify(row.revision.payload, null, 2)}
          </pre>
        </article>
      ))}
    </section>
  );
}
