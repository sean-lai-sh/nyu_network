import type { Metadata } from "next";
import { getToken } from "@/lib/auth-server";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "nyu.network",
  description: "A network for NYU students",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let token: string | null = null;
  try {
    token = (await getToken()) ?? null;
  } catch {
    token = null;
  }

  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <Providers initialToken={token ?? null}>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
