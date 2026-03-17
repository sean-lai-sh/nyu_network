import Link from "next/link";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

export default async function AdminLandingPage() {
  await requireAdminPageAccess();

  return (
    <div className="tm-page">
      <div className="p-8 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-3">System / Moderation</p>
        <h1 className="text-2xl font-black tracking-tight mb-1">Overview</h1>
        <p className="text-xs text-[var(--muted)]">
          Review membership applications and profile revision requests.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-[var(--border)] border-b border-[var(--border)]">
        <Link href="/admin/applications" className="admin-overview-card group">
          <div className="p-6">
            <p className="text-[9px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">Queue 01</p>
            <h2 className="text-lg font-black tracking-tight mb-2">Applications</h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-5">
              Review and decide on pending membership applications from prospective members.
            </p>
            <span className="text-[10px] text-[var(--accent)] uppercase tracking-[0.1em] group-hover:underline">
              View queue →
            </span>
          </div>
        </Link>

        <Link href="/admin/revisions" className="admin-overview-card group">
          <div className="p-6">
            <p className="text-[9px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">Queue 02</p>
            <h2 className="text-lg font-black tracking-tight mb-2">Revisions</h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-5">
              Approve or reject pending profile changes submitted by current members.
            </p>
            <span className="text-[10px] text-[var(--accent)] uppercase tracking-[0.1em] group-hover:underline">
              View queue →
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
