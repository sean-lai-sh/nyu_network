import Link from "next/link";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

export default async function AdminLandingPage() {
  await requireAdminPageAccess();

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-left">
          <Link href="/" className="adm-back-link">← nyu.network</Link>
          <span className="adm-header-sep">/</span>
          <span className="adm-header-title">admin</span>
        </div>
      </header>

      <div className="adm-body">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>
            Moderation Console
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--secondary)" }}>
            Review pending applications and profile revisions.
          </p>
        </div>

        <div className="adm-nav-grid" style={{ marginTop: "0.5rem" }}>
          <Link href="/admin/applications" className="adm-nav-card">
            <p className="adm-nav-card-label">queue</p>
            <p className="adm-nav-card-title">Applications</p>
            <p className="adm-nav-card-hint">Review and approve new member applications.</p>
          </Link>
          <Link href="/admin/revisions" className="adm-nav-card">
            <p className="adm-nav-card-label">queue</p>
            <p className="adm-nav-card-title">Revisions</p>
            <p className="adm-nav-card-hint">Approve or reject pending profile edits.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
