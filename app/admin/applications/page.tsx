import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { ApplicationReviewActions } from "@/components/admin/application-review-actions";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";
import { FaLinkedin, FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Mail } from "lucide-react";

function SocialIcon({ platform }: { platform: string }) {
  const size = 12;
  switch (platform) {
    case "x":        return <FaXTwitter size={size} />;
    case "linkedin": return <FaLinkedin size={size} />;
    case "email":    return <Mail size={size} />;
    case "github":   return <FaGithub size={size} />;
    default:         return <span className="text-[10px] uppercase">{platform}</span>;
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
      <div className="tm-page p-8">
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="tm-page">
      {/* Page header */}
      <div className="p-6 border-b border-[var(--border)]">
        <h1 className="text-xl font-black tracking-tight">Pending Applications</h1>
        <p className="text-[11px] text-[var(--muted)] mt-1">
          {rows?.length === 0
            ? "No pending applications."
            : `${rows?.length} application${rows?.length !== 1 ? "s" : ""} awaiting review`}
        </p>
      </div>

      {rows?.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Queue clear</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {rows?.map((row) => (
            <article key={row.application._id}>
              {/* Card header: name + actions */}
              <div className="px-6 py-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-black tracking-tight leading-tight">
                    {row.application.fullName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[11px] text-[var(--muted)]">{row.application.email}</span>
                    <span className="text-[11px] text-[var(--accent)]">{row.application.major}</span>
                    {row.application.website ? (
                      <a
                        href={row.application.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors truncate max-w-[200px]"
                      >
                        {row.application.website}
                      </a>
                    ) : null}
                  </div>
                  {row.application.headline ? (
                    <p className="text-xs text-[var(--muted)] mt-1.5 italic">&ldquo;{row.application.headline}&rdquo;</p>
                  ) : null}
                </div>
                <ApplicationReviewActions applicationId={row.application._id} />
              </div>

              {/* Bio + Socials + Connections in a compact grid */}
              <div className="grid md:grid-cols-3 gap-px bg-[var(--border)] border-t border-[var(--border)]">
                {/* Bio */}
                <div className="p-4 bg-[var(--card-bg)] md:col-span-1">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Bio</p>
                  {row.application.bio ? (
                    <p className="text-[11px] leading-relaxed text-[var(--foreground)] line-clamp-6">
                      {row.application.bio}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--muted)]">—</p>
                  )}
                </div>

                {/* Socials */}
                <div className="p-4 bg-[var(--card-bg)]">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Socials</p>
                  {row.socials.length > 0 ? (
                    <ul className="space-y-1.5">
                      {row.socials.map((social: any) => (
                        <li key={social._id}>
                          <a
                            href={socialHref(social.platform, social.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          >
                            <span className="shrink-0 opacity-70">
                              <SocialIcon platform={social.platform} />
                            </span>
                            <span className="text-[11px] truncate">{social.url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[var(--muted)]">—</p>
                  )}
                </div>

                {/* Connection Intents */}
                <div className="p-4 bg-[var(--card-bg)]">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Connection Intents</p>
                  {row.connectionTargets.length > 0 ? (
                    <ul className="space-y-1">
                      {row.connectionTargets.map((target: any) => (
                        <li key={target.id} className="text-[11px] text-[var(--foreground)]">
                          {target.fullName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[var(--muted)]">None selected.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
