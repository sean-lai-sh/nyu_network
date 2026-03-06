import Link from "next/link";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

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

export default async function AdminLandingPage() {
  await requireAdminPageAccess();

  return (
    <div className="tm-page space-y-px">
      <div className="tm-card p-8 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">System / Moderation</p>
          <h1 className="text-3xl font-black tracking-tight mb-2">Admin Console</h1>
          <p className="text-sm text-[var(--muted)]">
            Review membership applications and profile revision requests.
          </p>
        </div>
        <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-[var(--border)]">
        <Link href="/admin/applications" className="tm-card p-6 block group hover:bg-[var(--hover-bg)] transition-colors">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">Review Queue</p>
          <h2 className="text-xl font-black tracking-tight mb-2">Applications</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
            Review and decide on pending membership applications from prospective members.
          </p>
          <span className="text-xs text-[var(--accent)] group-hover:underline">View queue →</span>
        </Link>

        <Link href="/admin/revisions" className="tm-card p-6 block group hover:bg-[var(--hover-bg)] transition-colors">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">Review Queue</p>
          <h2 className="text-xl font-black tracking-tight mb-2">Revisions</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
            Approve or reject pending profile changes submitted by current members.
          </p>
          <span className="text-xs text-[var(--accent)] group-hover:underline">View queue →</span>
        </Link>
      </div>
    </div>
  );
}
