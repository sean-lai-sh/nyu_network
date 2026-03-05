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
  const token = await getToken();

  return (
    <html lang="en">
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
