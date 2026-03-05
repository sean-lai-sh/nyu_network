"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/me"
      });

      if (response.error) {
        setError(response.error.message ?? "Unable to sign in.");
      } else {
        setMessage("Signed in. Redirecting...");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected auth error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl">
      <div className="brutal-card space-y-4 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Member Access</p>
        <h2 className="text-3xl font-black">Sign in with Email + Password</h2>
        <p className="text-sm text-[var(--muted)]">
          Only approved members can access member features after login. If you are not approved yet, submit an application first.
        </p>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold">
            Email
            <input className="brutal-input mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              className="brutal-input mt-1"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="brutal-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Link href="/apply" className="mono text-xs underline">
          Need approval first? Apply here.
        </Link>
      </div>
    </section>
  );
}
