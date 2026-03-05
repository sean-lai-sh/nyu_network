import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { getToken } from "@/lib/auth-server";
import "./globals.css";
import { Providers } from "./providers";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "NYU Network",
  description: "NYU relationship graph with approvals, connections, and top-5 vouches."
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/apply", label: "Apply" },
  { href: "/graph", label: "Graph" },
  { href: "/search", label: "Search" },
  { href: "/me", label: "Me" },
  { href: "/admin/applications", label: "Admin" }
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let token: string | null = null;
  try {
    token = (await getToken()) ?? null;
  } catch {
    token = null;
  }

  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`} style={{ fontFamily: "var(--font-sans), sans-serif" }}>
        <Providers initialToken={token ?? null}>
          <div className="pixel-grid min-h-screen">
            <header className="mx-auto mb-8 max-w-6xl px-4 pt-6">
              <nav className="brutal-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="mono text-xs uppercase tracking-widest text-[var(--muted)]">NYU Network</p>
                  <h1 className="text-xl font-black">Pixel Brutalist Directory</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="brutal-btn bg-[var(--paper)]">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            </header>
            <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
