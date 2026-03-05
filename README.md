# NYU Network (Next.js + Convex + Better Auth)

Pixel-brutalist light-mode member graph with pending applications, admin moderation, profile revisions, connections, top-5 vouches, and cached graph snapshots.

## Features

- Public `/apply` intake with socials + initial connection picks
- Pending-only intake: nothing becomes live until admin approval
- Better Auth email/password login integrated with Convex
- Member dashboard for:
  - profile revision submissions (admin approval required)
  - directed connections
  - top-5 unranked vouches
- Admin queues:
  - `/admin/applications`
  - `/admin/revisions`
- Public graph and search:
  - `GET /api/graph` serves cached current snapshot
  - search sorted by fire score (unique voucher count desc)
- Graph snapshot cron rebuild every minute when dirty

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy envs:

```bash
cp .env.example .env.local
```

Set these required values:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `CONVEX_DEPLOYMENT`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`

3. Configure Convex:

```bash
bun run dev:convex
```

Make sure Convex env also has these values:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`

4. Run app + Convex together:

```bash
bun run dev
```

## Admin bootstrap

After deploying auth and signing in once, seed an admin allowlist email using:

- Convex mutation: `adminBootstrap.seedAllowlist`
- args: `{ "email": "you@nyu.edu", "secret": "<ADMIN_BOOTSTRAP_SECRET>" }`

Then use `/admin/applications` and `/admin/revisions`.

Seed demo members (Sean + Chris) and credential accounts:

- Convex mutation: `adminBootstrap.seedPeople`
- args: `{ "secret": "<ADMIN_BOOTSTRAP_SECRET>" }`
- Returns example passwords in the mutation result for local MVP/testing.

## Key architecture notes

- `/apply` writes only to pending application tables.
- Approval creates live `profiles` rows and materializes apply connection intents.
- `profiles` table stores approved live profiles only.
- Graph reads do not run expensive joins per request; they use `graph_snapshots`.

## Snapshot freshness

- `graph_meta.dirtySince` is set on approval/revision/connection/vouch changes.
- Cron (`convex/crons.ts`) rebuilds if dirty and last build is older than 60 seconds.
- API route returns cache headers:
  - `s-maxage=300`
  - `stale-while-revalidate=300`
