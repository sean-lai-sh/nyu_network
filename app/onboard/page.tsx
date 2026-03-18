"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

export default function OnboardPage() {
  const router = useRouter();

  // Step 1 state
  const [emailInput, setEmailInput] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [password, setPassword] = useState("");
  const [awaitingSession, setAwaitingSession] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step2Loading, setStep2Loading] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);

  const checkResult = useQuery(
    api.member.checkApprovedEmail,
    submittedEmail ? { email: submittedEmail } : "skip"
  );

  const ensureMemberAccount = useMutation(api.member.ensureMemberAccount);
  const { data: session, isPending: sessionPending } = authClient.useSession();

  useEffect(() => {
    if (!awaitingSession || sessionPending || !session?.user) return;
    ensureMemberAccount()
      .then(() => router.replace("/profile"))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "something went wrong";
        setStep2Error(message);
        setStep2Loading(false);
        setAwaitingSession(false);
      });
  }, [awaitingSession, sessionPending, session, ensureMemberAccount, router]);

  const onStep1Submit = async (e: FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    setStep1Loading(true);

    const email = emailInput.trim().toLowerCase();
    setSubmittedEmail(email);

    // Wait for query result via useEffect-like pattern — handled below
    setStep1Loading(false);
  };

  // Once checkResult arrives, act on it
  const handleCheckResult = () => {
    if (!checkResult || !submittedEmail) return;
    if (!checkResult.approved) {
      setStep1Error("not_approved");
      setSubmittedEmail(null);
      return;
    }
    if (checkResult.alreadyClaimed) {
      setStep1Error("already_claimed");
      setSubmittedEmail(null);
      return;
    }
    setStep1Error(null);
    setStep(2);
  };

  // Trigger step transition when query resolves
  if (submittedEmail && checkResult !== undefined && step === 1 && !step1Loading) {
    handleCheckResult();
  }

  const onStep2Submit = async (e: FormEvent) => {
    e.preventDefault();
    setStep2Error(null);
    setStep2Loading(true);

    try {
      const email = submittedEmail!;
      const response = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0],
      });

      if (response.error) {
        setStep2Error(response.error.message ?? "sign-up failed, please try again");
        setStep2Loading(false);
        return;
      }

      // Session propagates asynchronously — useEffect picks it up and calls ensureMemberAccount
      setAwaitingSession(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "something went wrong";
      setStep2Error(message);
      setStep2Loading(false);
    }
  };

  return (
    <>
      <style>{`
        .ob-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d0a12;
          background-image: radial-gradient(circle at top, #1a1228 0%, #0d0a12 45%, #09090c 100%);
          padding: 2rem;
        }

        .ob-wrap {
          width: 100%;
          max-width: 420px;
          background: #151320;
          border-radius: 14px;
          padding: 1.75rem;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
          animation: ob-fade 0.35s ease both;
        }

        @keyframes ob-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);  }
        }

        .ob-step-indicator {
          font-size: 0.75rem;
          font-weight: 500;
          color: #7a5fb0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 0.6rem;
        }

        .ob-heading {
          margin-bottom: 0.35rem;
          font-size: 1.875rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #f8f6fc;
        }

        .ob-subhead {
          font-size: 1rem;
          font-weight: 400;
          color: #c6b9de;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .ob-form {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .ob-label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: #d8cce8;
        }

        .ob-input {
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
          box-sizing: border-box;
        }

        .ob-input:focus {
          border-color: #7a2dbb;
          box-shadow: 0 0 0 3px rgba(122, 45, 187, 0.28);
        }

        .ob-input::placeholder {
          color: #a99ac3;
        }

        .ob-btn {
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

        .ob-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .ob-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ob-error {
          margin-top: 1rem;
          font-size: 0.85rem;
          color: #c8bee1;
          line-height: 1.6;
        }

        .ob-error a {
          color: #be98ee;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .ob-error a:hover {
          color: #d6b6ff;
        }

        .ob-footer {
          margin-top: 1.35rem;
          border-top: 1px solid #2a2a35;
          padding-top: 1rem;
        }

        .ob-back {
          font-size: 0.85rem;
          color: #b389e6;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.15s;
        }

        .ob-back:hover {
          color: #d6b6ff;
        }

        @media (max-width: 480px) {
          .ob-page {
            padding: 1rem;
          }

          .ob-wrap {
            padding: 1.25rem;
            border-radius: 12px;
          }

          .ob-heading {
            font-size: 1.75rem;
          }
        }
      `}</style>

      <div className="ob-page">
        <div className="ob-wrap">
          {step === 1 ? (
            <>
              <p className="ob-step-indicator">step 1 of 2</p>
              <h1 className="ob-heading">create account</h1>
              <p className="ob-subhead">enter your approved email to get started</p>

              <form onSubmit={onStep1Submit} className="ob-form">
                <label className="ob-label">
                  email
                  <input
                    className="ob-input"
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setStep1Error(null);
                    }}
                    placeholder="you@nyu.edu"
                    required
                    autoFocus
                  />
                </label>

                <button
                  type="submit"
                  className="ob-btn"
                  disabled={step1Loading || (submittedEmail !== null && checkResult === undefined)}
                >
                  {step1Loading || (submittedEmail !== null && checkResult === undefined)
                    ? "checking..."
                    : "continue"}
                </button>
              </form>

              {step1Error === "not_approved" && (
                <p className="ob-error">
                  this email isn&apos;t on our approved list. if you applied and believe this is an
                  error, reach out to us.
                </p>
              )}

              {step1Error === "already_claimed" && (
                <p className="ob-error">
                  an account already exists for this email.{" "}
                  <Link href="/sign-in">sign in instead</Link>
                </p>
              )}
            </>
          ) : (
            <>
              <p className="ob-step-indicator">step 2 of 2</p>
              <h1 className="ob-heading">set a password</h1>
              <p className="ob-subhead">
                creating account for <strong style={{ color: "#d8cce8" }}>{submittedEmail}</strong>
              </p>

              <form onSubmit={onStep2Submit} className="ob-form">
                <label className="ob-label">
                  password
                  <input
                    className="ob-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    placeholder="at least 8 characters"
                    required
                    autoFocus
                  />
                </label>

                <button type="submit" className="ob-btn" disabled={step2Loading}>
                  {step2Loading ? "creating account..." : "create account"}
                </button>
              </form>

              {step2Error && (
                <p className="ob-error">{step2Error}</p>
              )}
            </>
          )}

          <div className="ob-footer">
            {step === 2 ? (
              <button
                className="ob-back"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => {
                  setStep(1);
                  setStep2Error(null);
                  setPassword("");
                  setSubmittedEmail(null);
                }}
              >
                ← back
              </button>
            ) : (
              <Link href="/sign-in" className="ob-back">already have an account? sign in</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
