"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export const RevisionReviewActions = ({ revisionId }: { revisionId: string }) => {
  const router = useRouter();
  const review = useMutation(api.admin.reviewRevision);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setPending(decision);
    setError(null);
    try {
      await review({ revisionId: revisionId as any, decision });
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-2 shrink-0">
      <div className="flex gap-2">
        <button
          type="button"
          className="tm-btn tm-btn-approve"
          disabled={pending !== null}
          onClick={() => decide("approve")}
        >
          {pending === "approve" ? "approving..." : "Approve"}
        </button>
        <button
          type="button"
          className="tm-btn tm-btn-reject"
          disabled={pending !== null}
          onClick={() => decide("reject")}
        >
          {pending === "reject" ? "rejecting..." : "Reject"}
        </button>
      </div>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
    </div>
  );
};
