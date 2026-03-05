"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const profiles = useQuery(api.search.listProfiles, { q: query || undefined });

  return (
    <section className="space-y-4">
      <div className="brutal-card space-y-3 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Search</p>
        <h2 className="text-3xl font-black">Find “fire” people first</h2>
        <p className="text-sm text-[var(--muted)]">Sorted by unique voucher count descending, then name.</p>
        <input
          className="brutal-input"
          placeholder="Search by name, major, or headline"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {!profiles ? <p className="text-sm text-[var(--muted)]">Loading search results...</p> : null}
        {profiles?.map((profile) => (
          <article key={profile.id} className="brutal-card flex items-center gap-3 p-4">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.fullName} className="pixel-avatar h-14 w-14 object-cover" />
            ) : (
              <div className="pixel-avatar flex h-14 w-14 items-center justify-center bg-[var(--accent-soft)] mono text-xs">NYU</div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-black">{profile.fullName}</h3>
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{profile.major}</p>
              {profile.headline ? <p className="truncate text-sm text-[var(--muted)]">{profile.headline}</p> : null}
              {profile.website ? <p className="truncate text-xs text-[var(--muted)]">{profile.website}</p> : null}
            </div>
            <div className="mono border-2 border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold uppercase">
              fire {profile.fireScore}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
