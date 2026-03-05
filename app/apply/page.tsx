"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ALL_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";

type AvatarKind = "url" | "upload";

const BIO_WORD_LIMIT = 200;

const countWords = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const createEmptySocials = (): Record<SocialPlatform, string> => {
  return ALL_SOCIALS.reduce((result, platform) => {
    result[platform] = "";
    return result;
  }, {} as Record<SocialPlatform, string>);
};

const socialLabel = (platform: SocialPlatform) => {
  switch (platform) {
    case "x":
      return "X";
    case "linkedin":
      return "LinkedIn";
    case "email":
      return "Email";
    case "github":
      return "GitHub";
    default:
      return platform;
  }
};

export default function ApplyPage() {
  const submitApplication = useMutation(api.applications.submit);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [website, setWebsite] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("url");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState<Record<SocialPlatform, string>>(() => createEmptySocials());
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  const connectionOptions = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined
  });

  const bioWordCount = useMemo(() => countWords(bio), [bio]);

  const normalizedSocials = useMemo<SocialInput[]>(
    () =>
      ALL_SOCIALS.map((platform) => ({
        platform,
        url: socials[platform].trim()
      })),
    [socials]
  );

  const initials = useMemo(() => {
    const chunks = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "");
    return chunks.join("") || "NY";
  }, [fullName]);

  useEffect(() => {
    if (avatarKind !== "upload" || !avatarFile) {
      setUploadPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setUploadPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarKind, avatarFile]);

  const avatarPreviewSrc = useMemo(() => {
    if (avatarKind === "upload") {
      return uploadPreviewUrl ?? "";
    }
    return avatarUrl.trim();
  }, [avatarKind, avatarUrl, uploadPreviewUrl]);

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const updateSocial = (platform: SocialPlatform, url: string) => {
    setSocials((current) => ({
      ...current,
      [platform]: url
    }));
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (bioWordCount > BIO_WORD_LIMIT) {
      setError(`Bio must be ${BIO_WORD_LIMIT} words or fewer.`);
      return;
    }

    const missingPlatforms = normalizedSocials.filter((social) => !social.url).map((social) => social.platform);
    if (missingPlatforms.length > 0) {
      setError("Please provide all four socials: X, LinkedIn, Email, and GitHub.");
      return;
    }

    setLoading(true);
    try {
      let uploadedStorageId: string | undefined;
      if (avatarKind === "upload" && avatarFile) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": avatarFile.type
          },
          body: avatarFile
        });

        if (!uploadResponse.ok) {
          throw new Error("Avatar upload failed.");
        }

        const uploadBody = (await uploadResponse.json()) as { storageId: string };
        uploadedStorageId = uploadBody.storageId;
      }

      await submitApplication({
        email,
        fullName,
        major,
        website: website || undefined,
        headline: headline || undefined,
        bio: bio || undefined,
        avatarKind,
        avatarUrl: avatarKind === "url" ? avatarUrl || undefined : undefined,
        avatarStorageId: avatarKind === "upload" ? ((uploadedStorageId as any) ?? undefined) : undefined,
        socials: normalizedSocials,
        connectionTargetIds: selectedConnections as any
      });

      setSuccess("Application submitted. You remain pending until admin approval.");
      setEmail("");
      setFullName("");
      setMajor("");
      setWebsite("");
      setHeadline("");
      setBio("");
      setAvatarUrl("");
      setAvatarFile(null);
      setSocials(createEmptySocials());
      setSelectedConnections([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <div className="brutal-card space-y-4 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Apply (Pending Queue)</p>
        <h2 className="text-3xl font-black">Request to Join NYU Network</h2>
        <p className="text-sm text-[var(--muted)]">
          Submitting this form does not add you to the graph yet. Admins must approve before your profile appears publicly.
        </p>

        <div className="grid gap-3">
          <label className="text-sm font-semibold">
            Email
            <input className="brutal-input mt-1" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label className="text-sm font-semibold">
            Full Name
            <input className="brutal-input mt-1" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            Major
            <input className="brutal-input mt-1" value={major} onChange={(event) => setMajor(event.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            Website (optional)
            <input className="brutal-input mt-1" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." />
          </label>
          <label className="text-sm font-semibold">
            Headline
            <input className="brutal-input mt-1" value={headline} onChange={(event) => setHeadline(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Bio
            <textarea className="brutal-input mt-1 min-h-28" value={bio} onChange={(event) => setBio(event.target.value)} />
            <p className={`mono mt-1 text-xs ${bioWordCount > BIO_WORD_LIMIT ? "text-red-600" : "text-[var(--muted)]"}`}>
              {bioWordCount}/{BIO_WORD_LIMIT} words
            </p>
          </label>
        </div>

        <div className="space-y-3 border border-[var(--border)] p-4">
          <p className="mono text-xs uppercase tracking-[0.2em]">Profile Photo</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--paper)]">
              {avatarPreviewSrc ? (
                <img src={avatarPreviewSrc} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <span className="mono text-xs uppercase text-[var(--muted)]">{initials}</span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`brutal-btn ${avatarKind === "url" ? "" : "bg-[var(--paper)]"}`}
                  onClick={() => setAvatarKind("url")}
                >
                  URL
                </button>
                <button
                  type="button"
                  className={`brutal-btn ${avatarKind === "upload" ? "" : "bg-[var(--paper)]"}`}
                  onClick={() => setAvatarKind("upload")}
                >
                  Upload
                </button>
              </div>

              {avatarKind === "url" ? (
                <input
                  className="brutal-input"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                />
              ) : (
                <input className="brutal-input" type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 border border-[var(--border)] p-4">
          <p className="mono text-xs uppercase tracking-[0.2em]">Social Links</p>

          <div className="grid gap-3 md:grid-cols-2">
            {ALL_SOCIALS.map((platform) => (
              <label key={platform} className="text-sm font-semibold">
                {socialLabel(platform)}
                <input
                  className="brutal-input mt-1"
                  value={socials[platform]}
                  onChange={(event) => updateSocial(platform, event.target.value)}
                  placeholder={platform === "email" ? "you@nyu.edu" : "https://..."}
                />
              </label>
            ))}
          </div>
          <p className="mono text-xs text-[var(--muted)]">Only X, LinkedIn, Email, and GitHub are accepted.</p>
        </div>

        <button type="button" className="brutal-btn" onClick={submit} disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-[var(--success)]">{success}</p> : null}
      </div>

      <aside className="brutal-card space-y-3 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Apply Connections</p>
        <h3 className="text-xl font-black">Pick initial connections</h3>
        <p className="text-sm text-[var(--muted)]">
          These are stored as pending connection intents and materialized only if approved.
        </p>

        <input
          className="brutal-input"
          placeholder="Search approved members..."
          value={connectionSearch}
          onChange={(event) => setConnectionSearch(event.target.value)}
        />

        <div className="max-h-80 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-3">
          {(connectionOptions ?? []).map((option) => {
            const checked = selectedConnections.includes(option.id);
            return (
              <label key={option.id} className="flex cursor-pointer items-start gap-2 border-b border-dashed border-[var(--border)] pb-2 text-sm">
                <input type="checkbox" checked={checked} onChange={() => toggleConnection(option.id)} />
                <span>
                  <strong>{option.fullName}</strong>
                  <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                  {option.website ? <span className="block text-xs text-[var(--muted)]">{option.website}</span> : null}
                  {option.headline ? <span className="block text-xs text-[var(--muted)]">{option.headline}</span> : null}
                </span>
              </label>
            );
          })}
          {connectionOptions && connectionOptions.length === 0 ? <p className="text-sm text-[var(--muted)]">No approved members found.</p> : null}
        </div>
      </aside>
    </section>
  );
}
