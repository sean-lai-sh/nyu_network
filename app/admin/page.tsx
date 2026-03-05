import Link from "next/link";
import { requireAdminPageAccess } from "@/lib/admin-page-auth";

export default async function AdminLandingPage() {
  await requireAdminPageAccess();

  return (
    <section className="brutal-card space-y-4 p-6">
      <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
      <h2 className="text-3xl font-black">Moderation Console</h2>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/applications" className="brutal-btn">
          Pending Applications
        </Link>
        <Link href="/admin/revisions" className="brutal-btn bg-[var(--paper)]">
          Pending Revisions
        </Link>
      </div>
    </section>
  );
}
