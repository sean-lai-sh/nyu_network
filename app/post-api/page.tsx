"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function buildTemplate(origin: string) {
  return `curl -X POST ${origin}/api/apply \\
  -H "Content-Type: application/json" \\
  -d '{
  // your unique slug (default: firstname-lastname)
  // if taken, append a number: firstname-lastname-2
  "slug": "firstname-lastname",

  // required
  "email": "you@nyu.edu",
  "fullName": "Your Name",
  "major": "Computer Science",

  // optional — what are you building?
  "bio": "tell us what you're working on...",

  // optional
  "website": "https://yoursite.com",

  // at least one required
  "socials": {
    "x": "https://x.com/you",
    "linkedin": "https://linkedin.com/in/you",
    "github": "https://github.com/you"
  },

  // required — use the upload box below (auto-injected on submit)
  // or paste any hosted image URL (resized to 256x256)
  "avatarUrl": "",

  // optional — slugs of members you know
  // search members on the right to find slugs
  "connections": []
}'`;
}

function extractJsonFromCurl(input: string): string {
  const match = input.match(/-d\s+'([\s\S]*)'\s*$/);
  if (match) return match[1];
  return input;
}

export default function PostApiPage() {
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [responseOk, setResponseOk] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [origin, setOrigin] = useState("");

  // Set origin and template after mount to avoid hydration mismatch
  useEffect(() => {
    setOrigin("https://nyu-network.vercel.app");
    setBody(buildTemplate("https://nyu-network.vercel.app"));
  }, []);

  // Image upload state (client-side only until submit)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const allProfiles = useQuery(api.search.listProfiles, {});

  // Clean up object URL on unmount or file change
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  useEffect(() => {
    if (!submitNotice) return;
    const timeout = setTimeout(() => setSubmitNotice(null), 2500);
    return () => clearTimeout(timeout);
  }, [submitNotice]);

  const filteredMembers = useMemo(() => {
    if (!allProfiles) return [];
    if (!memberSearch.trim()) return allProfiles;
    const q = memberSearch.toLowerCase();
    return allProfiles.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.major.toLowerCase().includes(q)
    );
  }, [allProfiles, memberSearch]);

  const handleFileSelect = (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setPendingFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("File must be an image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File must be under 10MB.");
      return;
    }
    setPendingFile(file);
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!pendingFile) return null;

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": pendingFile.type },
      body: pendingFile,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Image upload failed.");
    }

    const { url } = (await res.json()) as { url: string };
    return url;
  };

  const submit = async () => {
    setResponse(null);
    setSubmitNotice(null);
    setSending(true);
    try {
      // Extract JSON body from curl command, strip comments, parse
      const jsonStr = extractJsonFromCurl(body);
      // Strip // comments only outside of quoted strings
      const stripped = jsonStr.replace(/"(?:[^"\\]|\\.)*"|\/\/.*$/gm, (m) =>
        m.startsWith('"') ? m : ""
      );
      let parsed: any;
      try {
        parsed = JSON.parse(stripped);
      } catch {
        setResponse("// ERROR: Invalid JSON in request body. Check your syntax.");
        setResponseOk(false);
        setSubmitNotice({ kind: "error", text: "Invalid JSON body." });
        return;
      }

      // If there's a pending file and no avatarUrl, upload and inject
      if (pendingFile && !parsed.avatarUrl) {
        const url = await uploadFile();
        if (url) parsed.avatarUrl = url;
      }

      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (res.ok) {
        setResponse(`// SUCCESS\n${JSON.stringify(data, null, 2)}`);
        setResponseOk(true);
        setSubmitNotice({ kind: "success", text: `${res.status} success: request went through.` });
        setBody(buildTemplate(origin));
        setPendingFile(null);
      } else {
        setResponse(`// ERROR ${res.status}\n${JSON.stringify(data, null, 2)}`);
        setResponseOk(false);
        setSubmitNotice({ kind: "error", text: `${res.status} error: request failed.` });
      }
    } catch {
      setResponse("// ERROR: Network request failed.");
      setResponseOk(false);
      setSubmitNotice({ kind: "error", text: "Network request failed." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="postapi-page">
      <a href="/" className="postapi-back">&larr; back</a>
      <div className="postapi-layout">
        <div className="postapi-main">
          <div className="postapi-header">
            <span className="postapi-prompt">POST</span>{" "}
            <span className="postapi-url">/api/apply</span>
          </div>

          <textarea
            className="postapi-editor"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
          />

          <div className="postapi-upload">
            <div className="postapi-upload-label">
              profile photo <span className="postapi-upload-hint">— under 10MB, resized to 256x256 on submit</span>
            </div>
            <div className="postapi-upload-row">
              <div className="postapi-avatar-circle">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" />
                ) : null}
              </div>
              <label className="postapi-upload-btn">
                upload
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>
              {pendingFile && (
                <button
                  className="postapi-upload-clear"
                  onClick={() => setPendingFile(null)}
                >
                  clear
                </button>
              )}
            </div>
            {uploadError && (
              <div className="postapi-upload-error">{uploadError}</div>
            )}
          </div>

          <button
            className="postapi-send"
            onClick={submit}
            disabled={sending}
          >
            {sending ? "sending..." : "send request"}
          </button>
          {submitNotice && (
            <div
              className={`mt-3 inline-block border-2 border-[var(--ink)] px-3 py-1 text-xs font-black ${
                submitNotice.kind === "success"
                  ? "bg-[#dfffe9] text-[#0c5a2a]"
                  : "bg-[#ffe2e2] text-[#7a1717]"
              }`}
            >
              {submitNotice.text}
            </div>
          )}

          {response && (
            <pre className={`postapi-response ${responseOk ? "postapi-response-ok" : "postapi-response-err"}`}>
              {response}
            </pre>
          )}
        </div>

        <div className="postapi-sidebar">
          <div className="postapi-sidebar-title">member slugs</div>
          <input
            className="postapi-search"
            placeholder="search members..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
          <div className="postapi-members">
            {filteredMembers.map((m) => (
              <div key={m.id} className="postapi-member">
                <span className="postapi-member-slug">{m.slug}</span>
                <span className="postapi-member-name">{m.fullName}</span>
                <span className="postapi-member-major">{m.major}</span>
              </div>
            ))}
            {allProfiles && filteredMembers.length === 0 && (
              <div className="postapi-member-empty">no members found</div>
            )}
            {!allProfiles && (
              <div className="postapi-member-empty">loading...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
