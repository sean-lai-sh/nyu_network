import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { ApplicationReviewActions } from "@/components/admin/application-review-actions";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";
import { FaLinkedin, FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Mail } from "lucide-react";

const ARCH = `  _____   _________________   _____
 |     | |  _______________  | |     |
 |     | | |               | | |     |
 |     | | |_______________| | |     |
 |     |  \\               /  |     |
 |     |   )             (   |     |
 |     |   |             |   |     |
 |     |   |             |   |     |
 |_____|___|             |___|_____|
           |             |
           |_____________|`;

function SocialIcon({ platform }: { platform: string }) {
  const size = 13;
  switch (platform) {
    case "x":
      return <FaXTwitter size={size} />;
    case "linkedin":
      return <FaLinkedin size={size} />;
    case "email":
      return <Mail size={size} />;
    case "github":
      return <FaGithub size={size} />;
    default:
      return <span className="text-[10px] uppercase">{platform}</span>;
  }
}

function socialHref(platform: string, url: string) {
  if (platform === "email") return url.startsWith("mailto:") ? url : `mailto:${url}`;
  return url.startsWith("http") ? url : `https://${url}`;
}

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
      <div className="tm-page tm-card p-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">System / Applications</p>
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="tm-page space-y-px">
      <div className="tm-card p-8 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-3">System / Moderation</p>
          <h1 className="text-3xl font-black tracking-tight">Pending Applications</h1>
          {rows?.length === 0 ? (
            <p className="text-sm text-[var(--muted)] mt-3">No pending applications.</p>
          ) : (
            <p className="text-xs text-[var(--muted)] mt-2">
              {rows?.length} application{rows?.length !== 1 ? "s" : ""} awaiting review
            </p>
          )}
        </div>
        <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
      </div>

      <div className="space-y-px bg-[var(--border)]">
        {rows?.map((row) => (
          <article key={row.application._id} className="tm-card">
            <div className="p-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">{row.application.fullName}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs text-[var(--muted)]">{row.application.email}</span>
                  <span className="text-xs text-[var(--accent)]">{row.application.major}</span>
                  {row.application.website ? (
                    <a
                      href={row.application.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {row.application.website}
                    </a>
                  ) : null}
                </div>
                {row.application.headline ? (
                  <p className="text-sm text-[var(--muted)] mt-2">{row.application.headline}</p>
                ) : null}
              </div>
              <ApplicationReviewActions applicationId={row.application._id} />
            </div>

            {row.application.bio ? (
              <>
                <hr className="tm-divider" />
                <div className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Bio</p>
                  <p className="text-sm leading-relaxed">{row.application.bio}</p>
                </div>
              </>
            ) : null}

            <hr className="tm-divider" />

            <div className="grid md:grid-cols-2 gap-px bg-[var(--border)]">
              <div className="p-6 bg-[var(--card-bg)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">Socials</p>
                {row.socials.length > 0 ? (
                  <ul className="space-y-2">
                    {row.socials.map((social: any) => (
                      <li key={social._id}>
                        <a
                          href={socialHref(social.platform, social.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <span className="shrink-0"><SocialIcon platform={social.platform} /></span>
                          <span className="text-xs break-all">{social.url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--muted)]">—</p>
                )}
              </div>
              <div className="p-6 bg-[var(--card-bg)]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">Connection Intents</p>
                {row.connectionTargets.length > 0 ? (
                  <ul className="space-y-1">
                    {row.connectionTargets.map((target: any) => (
                      <li key={target.id} className="text-xs text-[var(--foreground)]">{target.fullName}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No selected connections.</p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
