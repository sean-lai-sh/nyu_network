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
  }, [isPending, session, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/sign-in",
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
          background: #0d0a12;
          background-image: radial-gradient(circle at top, #1a1228 0%, #0d0a12 45%, #09090c 100%);
          padding: 2rem;
        }

        .si-wrap {
          width: 100%;
          max-width: 420px;
          background: #151320;
          border: none;
          border-radius: 14px;
          padding: 1.75rem;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
          animation: si-fade 0.35s ease both;
        }

        @keyframes si-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);  }
        }

        .si-heading {
          margin-bottom: 0.35rem;
          font-size: 1.875rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #f8f6fc;
        }

        .si-subhead {
          font-size: 1.05rem;
          font-weight: 400;
          color: #c6b9de;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .si-form {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .si-label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: #d8cce8;
        }

        .si-input {
          width: 100%;
          border: 1px solid #4a3a69;
          border-radius: 8px;
          padding: 0.68rem 0.8rem;
          background: #100e18;
          color: #f8f6fc;
          font-size: 0.9rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          caret-color: #be98ee;
        }

        .si-input:focus {
          border-color: #7a2dbb;
          box-shadow: 0 0 0 3px rgba(122, 45, 187, 0.28);
        }

        .si-input::placeholder {
          color: #a99ac3;
        }

        .si-btn {
          margin-top: 0.25rem;
          padding: 0.7rem 1rem;
          background: #57068c;
          color: #ffffff;
          border: 1px solid #7a2dbb;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: filter 0.15s;
          width: 100%;
        }

        .si-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .si-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .si-error {
          margin-top: 1rem;
          font-size: 0.85rem;
          color: #c8bee1;
          line-height: 1.6;
        }

        .si-error a {
          color: #be98ee;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .si-error a:hover {
          color: #d6b6ff;
        }

        .si-footer {
          margin-top: 1.35rem;
          border-top: 1px solid #2a2a35;
          padding-top: 1rem;
        }

        .si-back {
          font-size: 0.85rem;
          color: #b389e6;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }

        .si-back:hover {
          color: #d6b6ff;
        }

        @media (max-width: 480px) {
          .si-page {
            padding: 1rem;
          }

          .si-wrap {
            padding: 1.25rem;
            border-radius: 12px;
          }

          .si-heading {
            font-size: 1.75rem;
          }
        }
      `}</style>

      <div className="si-page">
        <div className="si-wrap">
          <h1 className="si-heading">nyuniversity.network</h1>
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
