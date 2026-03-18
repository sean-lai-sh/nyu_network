import Link from "next/link";
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
    error = fetchError instanceof Error ? fetchError.message : "Unable to load applications.";
  }

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-left">
          <Link href="/admin" className="adm-back-link">← admin</Link>
          <span className="adm-header-sep">/</span>
          <span className="adm-header-title">
            applications
            {rows ? <span className="adm-badge">{rows.length}</span> : null}
          </span>
        </div>
      </header>

      <div className="adm-body">
        {error ? (
          <p className="adm-error">{error}</p>
        ) : rows?.length === 0 ? (
          <p className="adm-empty">No pending applications.</p>
        ) : (
          rows?.map((row) => (
            <article key={row.application._id} className="adm-card">
              <div className="adm-card-header">
                <div>
                  <p className="adm-card-name">{row.application.fullName}</p>
                  <div className="adm-card-meta">
                    <span>{row.application.email}</span>
                    <span className="adm-card-meta-accent">{row.application.major}</span>
                    {row.application.website ? <span>{row.application.website}</span> : null}
                  </div>
                  {row.application.headline ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--secondary)", marginTop: "0.35rem" }}>
                      {row.application.headline}
                    </p>
                  ) : null}
                </div>
                <ApplicationReviewActions applicationId={row.application._id} />
              </div>

              {(row.application.bio || row.socials?.length > 0 || row.connectionTargets?.length >= 0) ? (
                <>
                  <hr className="adm-divider" />
                  <div className="adm-card-body">
                    {row.application.bio ? (
                      <div>
                        <p className="adm-section-label">bio</p>
                        <p className="adm-bio">{row.application.bio}</p>
                      </div>
                    ) : null}

                    <div className="adm-card-grid">
                      <div>
                        <p className="adm-section-label">socials</p>
                        {row.socials?.length > 0 ? (
                          <ul className="adm-list">
                            {row.socials.map((social: any) => (
                              <li key={social._id} className="adm-list-item">
                                <span className="adm-list-key">{social.platform}</span>
                                <span>{social.url}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="adm-list-empty">No socials provided.</p>
                        )}
                      </div>

                      <div>
                        <p className="adm-section-label">connection intents</p>
                        {row.connectionTargets?.length > 0 ? (
                          <ul className="adm-list">
                            {row.connectionTargets.map((target: any) => (
                              <li key={target.id} className="adm-list-item">
                                <span>{target.fullName}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="adm-list-empty">No connections selected.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
