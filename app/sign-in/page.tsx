"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace("/profile");
    }
  }, [session, isPending, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/profile",
      });

      if (response.error) {
        setError("invalid");
      }
    } catch {
      setError("invalid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .si-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background);
          padding: 2rem;
        }

        .si-wrap {
          width: 100%;
          max-width: 360px;
          animation: si-fade 0.35s ease both;
        }

        @keyframes si-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);  }
        }

        .si-heading {
          margin-bottom: 0.35rem;
          font-size: 1.6rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--foreground);
        }

        .si-subhead {
          font-size: 1rem;
          font-weight: 400;
          color: var(--secondary);
          line-height: 1.5;
          margin-bottom: 2.5rem;
        }

        .si-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .si-label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--foreground);
        }

        .si-input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.6rem 0.8rem;
          background: var(--input-bg);
          color: var(--foreground);
          font-size: 0.9rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.15s;
          caret-color: var(--accent);
        }

        .si-input:focus {
          border-color: var(--accent);
        }

        .si-input::placeholder {
          color: var(--tertiary);
        }

        .si-btn {
          margin-top: 0.25rem;
          padding: 0.7rem 1.5rem;
          background: var(--foreground);
          color: var(--background);
          border: none;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
          width: fit-content;
        }

        .si-btn:hover:not(:disabled) {
          opacity: 0.85;
        }

        .si-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .si-error {
          margin-top: 1.25rem;
          font-size: 0.85rem;
          color: var(--secondary);
          line-height: 1.6;
        }

        .si-error a {
          color: var(--foreground);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .si-error a:hover {
          color: var(--hover-color);
        }

        .si-footer {
          margin-top: 3rem;
          border-top: 1px solid var(--border);
          padding-top: 1.25rem;
        }

        .si-back {
          font-size: 0.85rem;
          color: var(--tertiary);
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }

        .si-back:hover {
          color: var(--foreground);
        }
      `}</style>

      <div className="si-page">
        <div className="si-wrap">
          <h1 className="si-heading">nyu.network</h1>
          <p className="si-subhead">member sign in</p>

          <form onSubmit={onSubmit} className="si-form">
            <label className="si-label">
              email
              <input
                className="si-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@nyu.edu"
                required
                autoFocus
              />
            </label>

            <label className="si-label">
              password
              <input
                className="si-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <button type="submit" className="si-btn" disabled={loading}>
              {loading ? "signing in..." : "sign in"}
            </button>
          </form>

          {error && (
            <p className="si-error">
              those credentials weren't recognized. if you haven't applied yet or
              are still awaiting approval, you won't have access until your
              application is accepted.{" "}
              <Link href="/post-api">apply for membership</Link>
            </p>
          )}

          <div className="si-footer">
            <Link href="/" className="si-back">← back to network</Link>
          </div>
        </div>
      </div>
    </>
  );
}
