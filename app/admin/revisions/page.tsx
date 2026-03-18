"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { RevisionReviewActions } from "@/components/admin/revision-review-actions";

type RevisionPayload = {
  fullName?: string;
  major?: string;
  website?: string;
  headline?: string;
  bio?: string;
  avatarKind?: string;
  avatarUrl?: string;
  avatarStorageId?: string;
  socials?: { platform: string; url: string }[];
};

function RevisionDiff({ payload }: { payload: RevisionPayload }) {
  const textFields: { key: keyof RevisionPayload; label: string }[] = [
    { key: "fullName",   label: "full name"  },
    { key: "major",      label: "major"      },
    { key: "headline",   label: "headline"   },
    { key: "website",    label: "website"    },
    { key: "avatarKind", label: "avatar"     },
    { key: "avatarUrl",  label: "avatar url" },
  ];

  return (
    <div className="adm-diff">
      {textFields.map(({ key, label }) => {
        const val = payload[key] as string | undefined;
        if (val === undefined) return null;
        return (
          <div key={key} className="adm-diff-row">
            <span className="adm-diff-key">{label}</span>
            <span className={val ? "adm-diff-val" : "adm-diff-val adm-diff-val-muted"}>
              {val || "—"}
            </span>
          </div>
        );
      })}

      {payload.bio !== undefined ? (
        <div className="adm-diff-row" style={{ alignItems: "flex-start" }}>
          <span className="adm-diff-key">bio</span>
          <span className="adm-diff-val" style={{ whiteSpace: "pre-wrap" }}>
            {payload.bio || <span className="adm-diff-val-muted">—</span>}
          </span>
        </div>
      ) : null}

      {payload.socials && payload.socials.length > 0 ? (
        <div className="adm-diff-row" style={{ alignItems: "flex-start" }}>
          <span className="adm-diff-key">socials</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {payload.socials.map((s) => (
              <span key={s.platform} className="adm-diff-val">
                <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "var(--muted)", marginRight: "0.5rem" }}>
                  {s.platform}
                </span>
                {s.url || <span className="adm-diff-val-muted">—</span>}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminRevisionsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const adminViewer = useQuery(api.admin.getAdminViewer, session?.user ? {} : "skip");
  const rows = useQuery(api.admin.listPendingRevisions, adminViewer?.isAdmin ? {} : "skip");

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/admin-signin");
      return;
    }
    if (adminViewer === undefined) return;
    if (!adminViewer.isAdmin) {
      router.replace("/admin-signin");
    }
  }, [isPending, session, adminViewer, router]);

  if (isPending || !session?.user || !adminViewer?.isAdmin) return null;

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-left">
          <Link href="/admin" className="adm-back-link">← admin</Link>
          <span className="adm-header-sep">/</span>
          <span className="adm-header-title">
            revisions
            {rows ? <span className="adm-badge">{rows.length}</span> : null}
          </span>
        </div>
      </header>

      <div className="adm-body">
        {rows === undefined ? null : rows.length === 0 ? (
          <p className="adm-empty">No pending revisions.</p>
        ) : (
          rows.map((row) => (
            <article key={row.revision._id} className="adm-card">
              <div className="adm-card-header">
                <div>
                  <p className="adm-card-name">{row.profile.fullName}</p>
                  <div className="adm-card-meta">
                    <span>{row.profile.email}</span>
                    <span style={{ color: "var(--muted)" }}>
                      submitted {new Date(row.revision.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric"
                      })}
                    </span>
                  </div>
                </div>
                <RevisionReviewActions revisionId={row.revision._id} />
              </div>

              <hr className="adm-divider" />
              <div className="adm-card-body">
                <div>
                  <p className="adm-section-label">proposed changes</p>
                  <RevisionDiff payload={row.revision.payload as RevisionPayload} />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
