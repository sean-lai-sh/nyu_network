import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { ApplicationReviewActions } from "@/components/admin/application-review-actions";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

export default async function AdminApplicationsPage() {
  await requireAdminPageAccess();

  let rows: any[] | null = null;
  let error: string | null = null;

  try {
    rows = await fetchAuthQuery(api.admin.listPendingApplications, {});
  } catch (fetchError) {
    error = fetchError instanceof Error ? fetchError.message : "Unable to load admin applications.";
  }

  if (error) {
    return (
      <section className="brutal-card p-6">
        <h2 className="text-3xl font-black">Admin Applications</h2>
        <p className="mt-3 text-sm text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="brutal-card p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
        <h2 className="text-3xl font-black">Pending Applications</h2>
      </div>

      {rows?.length === 0 ? <p className="text-sm text-[var(--muted)]">No pending applications.</p> : null}

      {rows?.map((row) => (
        <article key={row.application._id} className="brutal-card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">{row.application.fullName}</h3>
              <p className="mono text-xs text-[var(--muted)]">{row.application.email}</p>
              <p className="mono text-xs text-[var(--accent)]">{row.application.major}</p>
              {row.application.website ? <p className="mono text-xs text-[var(--muted)]">{row.application.website}</p> : null}
              {row.application.headline ? <p className="text-sm text-[var(--muted)]">{row.application.headline}</p> : null}
            </div>
            <ApplicationReviewActions applicationId={row.application._id} />
          </div>

          {row.application.bio ? <p className="text-sm">{row.application.bio}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mono mb-2 text-xs uppercase">Socials</p>
              <ul className="space-y-1 text-sm">
                {row.socials.map((social: any) => (
                  <li key={social._id}>
                    <strong>{social.platform}</strong>: {social.url}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mono mb-2 text-xs uppercase">Apply Connection Intents</p>
              <ul className="space-y-1 text-sm">
                {row.connectionTargets.map((target: any) => (
                  <li key={target.id}>{target.fullName}</li>
                ))}
                {row.connectionTargets.length === 0 ? <li className="text-[var(--muted)]">No selected connections.</li> : null}
              </ul>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
