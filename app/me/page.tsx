"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthControls } from "@/components/auth-controls";
import { authClient } from "@/lib/auth-client";
import { ALL_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";

const BIO_WORD_LIMIT = 200;

const ARCH = `   ___________________________________________________
  |___________________________________________________|
  | .:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.  |
  | :+==+=========+===========+=========+==+======:  |
  | .:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.  |
  |___________________________________________________|
  |          |                           |           |
  |          |   _______________________  |           |
  |          |  /                       \\ |           |
  |          | |                         ||           |
  |          | |                         ||           |
  |          | |                         ||           |
  |          | |                         ||           |
  |__________|_|                         |_|___________|
             |                           |
             |___________________________|`;

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
    return (
      <div className="tm-page tm-card p-8">
        <p className="text-xs text-[var(--muted)]">Authenticating...</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="tm-page space-y-px">
        <div className="tm-card p-8 flex items-start justify-between gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">Member / Dashboard</p>
            <h1 className="text-3xl font-black tracking-tight mb-2">Member Dashboard</h1>
            <p className="text-sm text-[var(--muted)] mb-6">
              Sign in first, then your approved profile will be linked automatically by email.
            </p>
            <Link href="/sign-in" className="tm-btn">Sign In</Link>
          </div>
          <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
        </div>
      </div>
    );
  }

  if (linkStatus === "linking") {
    return (
      <div className="tm-page tm-card p-8">
        <p className="text-xs text-[var(--muted)]">Linking account to approved profile...</p>
      </div>
    );
  }

  if (linkStatus === "not_approved") {
    return (
      <div className="tm-page space-y-px">
        <div className="tm-card p-8 flex items-start justify-between gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-4">Member / Dashboard</p>
            <h1 className="text-3xl font-black tracking-tight mb-2">No Approved Profile</h1>
            <p className="text-sm text-[var(--muted)] mb-6">
              This email is not approved yet. Submit an application and wait for admin review.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/post-api" className="tm-btn">Submit Application</Link>
              <AuthControls />
            </div>
          </div>
          <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
        </div>
      </div>
    );
  }

  if (linkStatus === "error") {
    return (
      <div className="tm-page tm-card p-8">
        <p className="text-xs text-red-600">{linkError ?? "Failed to initialize member account."}</p>
      </div>
    );
  }

  const updateSocial = (platform: SocialPlatform, url: string) => {
    setSocials((current) => ({ ...current, [platform]: url }));
  };

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  };

  const toggleVouch = (id: string) => {
    setSelectedVouches((current) => {
      if (current.includes(id)) return current.filter((v) => v !== id);
      if (current.length >= 5) return current;
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

      const missingPlatforms = normalizedSocials.filter((s) => !s.url).map((s) => s.platform);
      if (missingPlatforms.length > 0) {
        throw new Error("Please provide all four socials: X, LinkedIn, Email, and GitHub.");
      }

      let uploadedStorageId: string | undefined;
      if (avatarKind === "upload" && avatarFile) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": avatarFile.type },
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
    <div className="tm-page space-y-px">
      {/* Header */}
      <div className="tm-card p-8 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-3">Member / Dashboard</p>
          <h1 className="text-3xl font-black tracking-tight mb-1">Manage Profile</h1>
          <p className="text-sm text-[var(--muted)]">Edits stay pending until an admin approves them.</p>
          {self?.pendingRevision ? (
            <p className="text-[10px] text-[var(--accent)] mt-2 uppercase tracking-wider">
              Revision pending · {new Date(self.pendingRevision.createdAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex items-start gap-4">
          <AuthControls />
          <pre className="tm-ascii hidden md:block" aria-hidden="true">{ARCH}</pre>
        </div>
      </div>

      {!self ? (
        <div className="tm-card p-8">
          <p className="text-xs text-[var(--muted)]">Loading profile...</p>
        </div>
      ) : null}

      {self ? (
        <>
          <div className="grid gap-px lg:grid-cols-[1.1fr_0.9fr] bg-[var(--border)]">
            {/* Profile Revision */}
            <div className="tm-card space-y-px">
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Profile Revision</p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Full Name</span>
                    <input className="tm-input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Major</span>
                    <input className="tm-input mt-1" value={major} onChange={(e) => setMajor(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Website (optional)</span>
                    <input className="tm-input mt-1" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Headline</span>
                    <input className="tm-input mt-1" value={headline} onChange={(e) => setHeadline(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Bio</span>
                    <textarea className="tm-input mt-1 min-h-24 resize-y" value={bio} onChange={(e) => setBio(e.target.value)} />
                    <p className={`text-[10px] mt-1 ${bioWordCount > BIO_WORD_LIMIT ? "text-red-600" : "text-[var(--muted)]"}`}>
                      {bioWordCount} / {BIO_WORD_LIMIT} words
                    </p>
                  </label>
                </div>
              </div>

              <hr className="tm-divider" />

              {/* Profile Photo */}
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Profile Photo</p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--paper)] shrink-0">
                    {avatarPreviewSrc ? (
                      <img src={avatarPreviewSrc} alt="Avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] uppercase text-[var(--muted)]">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`tm-btn ${avatarKind === "url" ? "bg-[var(--foreground)] text-[var(--background)]" : ""}`}
                        onClick={() => setAvatarKind("url")}
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        className={`tm-btn ${avatarKind === "upload" ? "bg-[var(--foreground)] text-[var(--background)]" : ""}`}
                        onClick={() => setAvatarKind("upload")}
                      >
                        Upload
                      </button>
                    </div>
                    {avatarKind === "url" ? (
                      <input className="tm-input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
                    ) : (
                      <input className="tm-input" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                    )}
                  </div>
                </div>
              </div>

              <hr className="tm-divider" />

              {/* Social Links */}
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Social Links</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {ALL_SOCIALS.map((platform) => (
                    <label key={platform} className="block">
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{socialLabel(platform)}</span>
                      <input
                        className="tm-input mt-1"
                        value={socials[platform]}
                        onChange={(e) => updateSocial(platform, e.target.value)}
                        placeholder={platform === "email" ? "you@nyu.edu" : "https://..."}
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--muted)] mt-3">X, LinkedIn, Email, and GitHub are required.</p>
              </div>

              <hr className="tm-divider" />

              <div className="p-6">
                <button type="button" className="tm-btn" onClick={saveRevision} disabled={loading}>
                  {loading ? "Submitting..." : "Submit Revision"}
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-px bg-[var(--border)]">
              {/* Connections */}
              <div className="tm-card p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Connections</p>
                <input
                  className="tm-input mb-3"
                  placeholder="Search members..."
                  value={connectionSearch}
                  onChange={(e) => setConnectionSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto border border-[var(--border)] mb-3">
                  {(options ?? []).filter((option) => option.id !== self.profile._id).map((option) => (
                    <label key={`conn-${option.id}`} className="flex items-start gap-2 px-3 py-2 border-b border-[var(--border-light)] last:border-none hover:bg-[var(--hover-bg)] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={selectedConnections.includes(option.id)}
                        onChange={() => toggleConnection(option.id)}
                      />
                      <span>
                        <span className="text-xs text-[var(--foreground)] block">{option.fullName}</span>
                        <span className="text-[10px] text-[var(--muted)]">{option.major}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="tm-btn" onClick={saveConnections} disabled={loading}>
                  Save Connections
                </button>
              </div>

              {/* Top-5 Vouches */}
              <div className="tm-card p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1">Top-5 Vouches</p>
                <p className="text-[10px] text-[var(--muted)] mb-4">{selectedVouches.length} / 5 selected</p>
                <div className="max-h-48 overflow-y-auto border border-[var(--border)] mb-3">
                  {(options ?? []).filter((option) => option.id !== self.profile._id).map((option) => (
                    <label key={`vouch-${option.id}`} className="flex items-start gap-2 px-3 py-2 border-b border-[var(--border-light)] last:border-none hover:bg-[var(--hover-bg)] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={selectedVouches.includes(option.id)}
                        onChange={() => toggleVouch(option.id)}
                      />
                      <span>
                        <span className="text-xs text-[var(--foreground)] block">{option.fullName}</span>
                        <span className="text-[10px] text-[var(--muted)]">{option.major}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="tm-btn" onClick={saveVouches} disabled={loading}>
                  Save Vouches
                </button>
              </div>

              {/* Password */}
              <div className="tm-card p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">Change Password</p>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Current Password</span>
                    <input
                      className="tm-input mt-1"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      minLength={8}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">New Password</span>
                    <input
                      className="tm-input mt-1"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">Confirm New Password</span>
                    <input
                      className="tm-input mt-1"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                    />
                  </label>
                </div>
                <button type="button" className="tm-btn mt-4" onClick={savePassword} disabled={loading}>
                  Update Password
                </button>
              </div>
            </div>
          </div>

          {/* Status messages */}
          {message ? (
            <div className="tm-card p-4">
              <p className="text-xs text-[var(--success)]">{message}</p>
            </div>
          ) : null}
          {error ? (
            <div className="tm-card p-4">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
