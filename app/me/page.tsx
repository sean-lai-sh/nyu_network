"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthControls } from "@/components/auth-controls";
import { authClient } from "@/lib/auth-client";
import { ALL_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";

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

const socialsToMap = (socials: SocialInput[]): Record<SocialPlatform, string> => {
  const map = createEmptySocials();
  for (const social of socials) {
    map[social.platform] = social.url;
  }
  return map;
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

export default function MePage() {
  const { data: session, isPending: authPending } = authClient.useSession();

  const ensureMemberAccount = useMutation(api.member.ensureMemberAccount);
  const submitRevision = useMutation(api.member.submitRevision);
  const setConnections = useMutation(api.member.setConnections);
  const setTopVouches = useMutation(api.member.setTopVouches);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const [linkStatus, setLinkStatus] = useState<"idle" | "linking" | "linked" | "not_approved" | "error">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [website, setWebsite] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarKind, setAvatarKind] = useState<"url" | "upload">("url");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState<Record<SocialPlatform, string>>(() => createEmptySocials());

  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [selectedVouches, setSelectedVouches] = useState<string[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!session?.user || linkStatus === "linked" || linkStatus === "not_approved" || linkStatus === "linking") {
      return;
    }

    setLinkStatus("linking");
    ensureMemberAccount({})
      .then((result) => {
        if (result.status === "linked") {
          setLinkStatus("linked");
        } else {
          setLinkStatus("not_approved");
        }
      })
      .catch((linkingError) => {
        setLinkStatus("error");
        setLinkError(linkingError instanceof Error ? linkingError.message : "Failed to link profile.");
      });
  }, [ensureMemberAccount, session?.user, linkStatus]);

  const self = useQuery(api.member.getSelf, linkStatus === "linked" ? {} : "skip");
  const options = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined
  });

  useEffect(() => {
    if (!self) return;

    setFullName(self.profile.fullName);
    setMajor(self.profile.major ?? "");
    setWebsite(self.profile.website ?? "");
    setHeadline(self.profile.headline ?? "");
    setBio(self.profile.bio ?? "");
    setAvatarKind(self.profile.avatarKind);
    setAvatarUrl(self.profile.avatarUrl ?? "");
    setSocials(socialsToMap(self.socials.map((social) => ({ platform: social.platform, url: social.url }))));
    setSelectedConnections(self.connectionTargetIds);
    setSelectedVouches(self.vouchTargetIds);
  }, [self]);

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
      return uploadPreviewUrl || avatarUrl.trim();
    }
    return avatarUrl.trim();
  }, [avatarKind, avatarUrl, uploadPreviewUrl]);

  if (authPending) {
    return <p className="text-sm text-[var(--muted)]">Loading authentication...</p>;
  }

  if (!session?.user) {
    return (
      <section className="brutal-card space-y-4 p-6">
        <h2 className="text-3xl font-black">Member Dashboard</h2>
        <p className="text-sm text-[var(--muted)]">Sign in first, then your approved profile will be linked automatically by email.</p>
        <Link href="/sign-in" className="brutal-btn inline-block">
          Sign In
        </Link>
      </section>
    );
  }

  if (linkStatus === "linking") {
    return <p className="text-sm text-[var(--muted)]">Linking your account to approved profile...</p>;
  }

  if (linkStatus === "not_approved") {
    return (
      <section className="brutal-card space-y-4 p-6">
        <AuthControls />
        <h2 className="text-2xl font-black">No approved profile yet</h2>
        <p className="text-sm text-[var(--muted)]">This email is not approved yet. Submit `/apply` and wait for admin approval.</p>
        <Link href="/apply" className="brutal-btn inline-block">
          Go to Apply
        </Link>
      </section>
    );
  }

  if (linkStatus === "error") {
    return <p className="text-sm text-red-600">{linkError ?? "Failed to initialize member account."}</p>;
  }

  const updateSocial = (platform: SocialPlatform, url: string) => {
    setSocials((current) => ({
      ...current,
      [platform]: url
    }));
  };

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleVouch = (id: string) => {
    setSelectedVouches((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, id];
    });
  };

  const saveRevision = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (bioWordCount > BIO_WORD_LIMIT) {
        throw new Error(`Bio must be ${BIO_WORD_LIMIT} words or fewer.`);
      }

      const missingPlatforms = normalizedSocials.filter((social) => !social.url).map((social) => social.platform);
      if (missingPlatforms.length > 0) {
        throw new Error("Please provide all four socials: X, LinkedIn, Email, and GitHub.");
      }

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

        if (!uploadResponse.ok) throw new Error("Avatar upload failed.");
        const uploadBody = (await uploadResponse.json()) as { storageId: string };
        uploadedStorageId = uploadBody.storageId;
      }

      await submitRevision({
        fullName,
        major,
        website: website || undefined,
        headline,
        bio,
        avatarKind,
        avatarUrl: avatarKind === "url" ? avatarUrl : undefined,
        avatarStorageId: avatarKind === "upload" ? ((uploadedStorageId as any) ?? undefined) : undefined,
        socials: normalizedSocials
      });

      setMessage("Revision submitted and pending admin approval.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to submit revision.");
    } finally {
      setLoading(false);
    }
  };

  const saveConnections = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await setConnections({ targetProfileIds: selectedConnections as any });
      setMessage("Connections updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update connections.");
    } finally {
      setLoading(false);
    }
  };

  const saveVouches = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await setTopVouches({ targetProfileIds: selectedVouches as any });
      setMessage("Top-5 vouches updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vouches.");
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("Fill all password fields.");
      }
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirm password must match.");
      }

      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Failed to change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="brutal-card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Member Dashboard</p>
          <h2 className="text-3xl font-black">Manage Profile and Graph Inputs</h2>
        </div>
        <AuthControls />
      </div>

      {!self ? <p className="text-sm text-[var(--muted)]">Loading profile...</p> : null}

      {self ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="brutal-card space-y-4 p-6">
              <h3 className="text-xl font-black">Profile Revision</h3>
              <p className="text-sm text-[var(--muted)]">Edits stay pending until an admin approves them.</p>
              {self.pendingRevision ? (
                <p className="mono text-xs text-[var(--accent)]">Pending revision submitted {new Date(self.pendingRevision.createdAt).toLocaleString()}</p>
              ) : null}

              <label className="block text-sm font-semibold">
                Full Name
                <input className="brutal-input mt-1" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Major
                <input className="brutal-input mt-1" value={major} onChange={(event) => setMajor(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Website (optional)
                <input className="brutal-input mt-1" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." />
              </label>
              <label className="block text-sm font-semibold">
                Headline
                <input className="brutal-input mt-1" value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Bio
                <textarea className="brutal-input mt-1 min-h-24" value={bio} onChange={(event) => setBio(event.target.value)} />
                <p className={`mono mt-1 text-xs ${bioWordCount > BIO_WORD_LIMIT ? "text-red-600" : "text-[var(--muted)]"}`}>
                  {bioWordCount}/{BIO_WORD_LIMIT} words
                </p>
              </label>

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
                      <input className="brutal-input" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
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

              <button type="button" className="brutal-btn" onClick={saveRevision} disabled={loading}>
                Submit Revision
              </button>
            </article>

            <aside className="space-y-5">
              <article className="brutal-card space-y-3 p-6">
                <h3 className="text-xl font-black">Connections</h3>
                <input
                  className="brutal-input"
                  placeholder="Search members"
                  value={connectionSearch}
                  onChange={(event) => setConnectionSearch(event.target.value)}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-2">
                  {(options ?? []).map((option) => (
                    <label key={`conn-${option.id}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedConnections.includes(option.id)}
                        onChange={() => toggleConnection(option.id)}
                        disabled={option.id === self.profile._id}
                      />
                      <span>
                        {option.fullName}
                        <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                        {option.website ? <span className="block text-xs text-[var(--muted)]">{option.website}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="brutal-btn" onClick={saveConnections} disabled={loading}>
                  Save Connections
                </button>
              </article>

              <article className="brutal-card space-y-3 p-6">
                <h3 className="text-xl font-black">Top-5 Vouches</h3>
                <p className="mono text-xs text-[var(--muted)]">Selected: {selectedVouches.length}/5</p>
                <div className="max-h-48 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-2">
                  {(options ?? []).map((option) => (
                    <label key={`vouch-${option.id}`} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedVouches.includes(option.id)} onChange={() => toggleVouch(option.id)} disabled={option.id === self.profile._id} />
                      <span>
                        {option.fullName}
                        <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                        {option.website ? <span className="block text-xs text-[var(--muted)]">{option.website}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="brutal-btn" onClick={saveVouches} disabled={loading}>
                  Save Top-5
                </button>
              </article>

              <article className="brutal-card space-y-3 p-6">
                <h3 className="text-xl font-black">Password</h3>
                <p className="mono text-xs text-[var(--muted)]">Change your member login password.</p>
                <label className="block text-sm font-semibold">
                  Current password
                  <input
                    className="brutal-input mt-1"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    minLength={8}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  New password
                  <input
                    className="brutal-input mt-1"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Confirm new password
                  <input
                    className="brutal-input mt-1"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                  />
                </label>
                <button type="button" className="brutal-btn" onClick={savePassword} disabled={loading}>
                  Update Password
                </button>
              </article>
            </aside>
          </div>

          {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </>
      ) : null}
    </section>
  );
}
