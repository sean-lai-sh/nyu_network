"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { ALL_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";

const BIO_WORD_LIMIT = 200;
type Tab = "profile" | "connections" | "vouches" | "security";
type GraphStatus = {
  currentVersion: number;
  generatedAt?: string;
  dirty: boolean;
  dirtySince?: number;
  lastBuiltAt?: number;
};

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
      return "X (Twitter)";
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

const getInitials = (name: string): string => {
  const chunks = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return chunks.join("") || "NY";
};

const TABS: { key: Tab; label: string }[] = [
  { key: "profile",     label: "Profile"     },
  { key: "connections", label: "Connections" },
  { key: "vouches",     label: "Vouches"     },
  { key: "security",    label: "Security"    },
];

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, initials, onRemove }: { label: string; initials: string; onRemove?: () => void }) {
  return (
    <span className="pro-chip">
      <span className="pro-chip-avatar">{initials}</span>
      <span className="pro-chip-label">{label}</span>
      {onRemove && (
        <button type="button" className="pro-chip-remove" onClick={onRemove} aria-label={`Remove ${label}`}>
          ×
        </button>
      )}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, isPending: authPending } = authClient.useSession();

  const ensureMemberAccount = useMutation(api.member.ensureMemberAccount);
  const submitRevision = useMutation(api.member.submitRevision);
  const setConnectionsMutation = useMutation(api.member.setConnections);
  const setTopVouchesMutation = useMutation(api.member.setTopVouches);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("profile");
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
  const [incomingConnectionIds, setIncomingConnectionIds] = useState<string[]>([]);
  const [selectedVouches, setSelectedVouches] = useState<string[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [vouchSaving, setVouchSaving] = useState(false);
  const [vouchSaved, setVouchSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Auth redirect ──
  useEffect(() => {
    if (!authPending && !session?.user) {
      router.replace("/sign-in");
    }
  }, [authPending, session, router]);

  // ── Ensure member account ──
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
  const incomingRaw = useQuery(api.member.getIncomingConnections, linkStatus === "linked" ? {} : "skip");
  const graphStatus = useQuery(api.graph.getCurrentStatus, {}) as GraphStatus | undefined;
  const options = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined,
  });
  const [pendingGraphVersion, setPendingGraphVersion] = useState<number | null>(null);
  const [sawDirtySincePending, setSawDirtySincePending] = useState(false);

  // ── Load self ──
  useEffect(() => {
    if (!self) return;
    setFullName(self.profile.fullName);
    setMajor(self.profile.major ?? "");
    setWebsite(self.profile.website ?? "");
    setHeadline(self.profile.headline ?? "");
    setBio(self.profile.bio ?? "");
    setAvatarKind(self.profile.avatarKind);
    setAvatarUrl(self.profile.avatarUrl ?? "");
    setSocials(socialsToMap(self.socials.map((s) => ({ platform: s.platform, url: s.url }))));
    setSelectedConnections(self.connectionTargetIds);
    setSelectedVouches(self.vouchTargetIds);
  }, [self]);

  useEffect(() => {
    if (incomingRaw) setIncomingConnectionIds(incomingRaw as string[]);
  }, [incomingRaw]);

  // ── Avatar preview ──
  useEffect(() => {
    if (avatarKind !== "upload" || !avatarFile) {
      setUploadPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setUploadPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarKind, avatarFile]);

  const bioWordCount = useMemo(() => countWords(bio), [bio]);

  const normalizedSocials = useMemo<SocialInput[]>(
    () => ALL_SOCIALS.map((platform) => ({ platform, url: socials[platform].trim() })),
    [socials]
  );

  const initials = useMemo(() => getInitials(fullName), [fullName]);

  const avatarPreviewSrc = useMemo(() => {
    if (avatarKind === "upload") return uploadPreviewUrl || avatarUrl.trim();
    return avatarUrl.trim();
  }, [avatarKind, avatarUrl, uploadPreviewUrl]);

  // Must be before any early returns — Rules of Hooks
  const optionsList = options ?? [];
  const optionsMap = useMemo(() => {
    const m = new Map<string, { id: string; fullName: string; major: string }>();
    for (const o of optionsList) m.set(o.id, o);
    return m;
  }, [optionsList]);

  useEffect(() => {
    if (pendingGraphVersion === null || !graphStatus) {
      return;
    }

    if (graphStatus.dirty && !sawDirtySincePending) {
      setSawDirtySincePending(true);
      return;
    }

    if (sawDirtySincePending && !graphStatus.dirty && graphStatus.currentVersion > pendingGraphVersion) {
      toast.success("Graph refreshed. Your updates are now live.", {
        id: "graph-refresh-status",
        dismissible: true,
        closeButton: true,
      });
      setPendingGraphVersion(null);
      setSawDirtySincePending(false);
    }
  }, [graphStatus, pendingGraphVersion, sawDirtySincePending]);

  // ─── Auth redirect / bare loading ────────────────────────────────────────
  if (authPending) return null;
  if (!session?.user) return null; // redirect effect handles this

  // ─── Skeleton: real chrome, shimmer content ───────────────────────────────
  if (linkStatus === "idle" || linkStatus === "linking" || (linkStatus === "linked" && !self)) {
    return (
      <>
        <style>{proStyles}</style>
        <div className="pro-page">
          {/* Real header — back link always usable */}
          <header className="pro-header">
            <div className="pro-header-left">
              <Link href="/" className="pro-back-link">← nyuniversity.network</Link>
            </div>
            <div className="pro-header-center">
              <div className="pro-skeleton-block pro-skel-avatar" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="pro-skeleton-block" style={{ width: 160, height: 18, borderRadius: 6 }} />
                <div className="pro-skeleton-block" style={{ width: 120, height: 12, borderRadius: 4 }} />
              </div>
            </div>
            <div className="pro-header-right">
              <ProSignOut />
            </div>
          </header>

          {/* Real tabs — fully clickable so user can navigate while loading */}
          <nav className="pro-tabs-bar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`pro-tab ${activeTab === tab.key ? "pro-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Skeleton content only */}
          <div className="pro-tab-content">
            <div className="pro-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: "1 1 60%" }}>
                {[100, 80, 80, 80, 120].map((w, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div className="pro-skeleton-block" style={{ width: w, height: 11, borderRadius: 3 }} />
                    <div className="pro-skeleton-block" style={{ width: "100%", height: 38, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
              <div style={{ flex: "1 1 40%", display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="pro-skeleton-block" style={{ width: "100%", height: 160, borderRadius: 8 }} />
                <div className="pro-skeleton-block" style={{ width: "100%", height: 6, borderRadius: 99 }} />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Not approved ─────────────────────────────────────────────────────────
  if (linkStatus === "not_approved") {
    return (
      <>
        <style>{proStyles}</style>
        <div className="pro-page" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ textAlign: "center", maxWidth: 400, padding: "2rem" }}>
            <p style={{ fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "1rem" }}>
              Access Pending
            </p>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 500, marginBottom: "0.75rem", color: "var(--accent)" }}>
              Your application is pending approval.
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              This email is not yet linked to an approved profile. Once an admin approves your application, you can access your member dashboard.
            </p>
            <Link href="/post-api" className="pro-btn-mint">
              Send a POST Request
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (linkStatus === "error") {
    return (
      <>
        <style>{proStyles}</style>
        <div className="pro-page" style={{ padding: "4rem 2rem" }}>
          <p style={{ color: "#ef4444", fontSize: "0.9rem" }}>{linkError ?? "Failed to initialize member account."}</p>
        </div>
      </>
    );
  }

  // Narrow `self` for TypeScript — by this point linkStatus==="linked" and self is loaded
  if (!self) return null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const updateSocial = (platform: SocialPlatform, url: string) => {
    setSocials((current) => ({ ...current, [platform]: url }));
  };

  const notifyGraphRefreshPending = () => {
    setPendingGraphVersion(graphStatus?.currentVersion ?? 0);
    setSawDirtySincePending(false);
    toast.loading("Saved. Graph refresh in progress (usually 30–90s).", {
      id: "graph-refresh-status",
      dismissible: true,
      closeButton: true,
    });
  };

  const toggleConnection = async (id: string) => {
    const next = selectedConnections.includes(id)
      ? selectedConnections.filter((v) => v !== id)
      : [...selectedConnections, id];
    setSelectedConnections(next);
    setConnectionSaving(true);
    try {
      await setConnectionsMutation({ targetProfileIds: next as any });
      notifyGraphRefreshPending();
      setConnectionSaved(true);
      setTimeout(() => setConnectionSaved(false), 2000);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Failed to update connections.", {
        dismissible: true,
        closeButton: true,
      });
    } finally {
      setConnectionSaving(false);
    }
  };

  const toggleVouch = async (id: string) => {
    const next = selectedVouches.includes(id)
      ? selectedVouches.filter((v) => v !== id)
      : selectedVouches.length >= 5
      ? selectedVouches
      : [...selectedVouches, id];

    setSelectedVouches(next);
    setVouchSaving(true);
    try {
      await setTopVouchesMutation({ targetProfileIds: next as any });
      notifyGraphRefreshPending();
      setVouchSaved(true);
      setTimeout(() => setVouchSaved(false), 2000);
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Failed to update vouches.", {
        dismissible: true,
        closeButton: true,
      });
    } finally {
      setVouchSaving(false);
    }
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
          body: avatarFile,
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
        socials: normalizedSocials,
      });

      setMessage("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
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
        revokeOtherSessions: true,
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

  // ─── Derived data for connections/vouches display ─────────────────────────

  // All connected IDs: outgoing (you added them) + incoming (they added you), deduplicated
  const allConnectedIds = useMemo(
    () => Array.from(new Set([...selectedConnections, ...incomingConnectionIds])),
    [selectedConnections, incomingConnectionIds]
  );

  // For chips: outgoing connections (removable)
  const connectionChips = selectedConnections.map((id) => {
    const opt = optionsMap.get(id);
    return { id, label: opt?.fullName ?? id, initials: getInitials(opt?.fullName ?? id) };
  });

  // Incoming-only chips: they added you, you haven't added them back
  const incomingOnlyChips = incomingConnectionIds
    .filter((id) => !selectedConnections.includes(id))
    .map((id) => {
      const opt = optionsMap.get(id);
      return { id, label: opt?.fullName ?? id, initials: getInitials(opt?.fullName ?? id) };
    });

  const vouchChips = selectedVouches.map((id) => {
    const opt = optionsMap.get(id);
    return { id, label: opt?.fullName ?? id, initials: getInitials(opt?.fullName ?? id) };
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{proStyles}</style>

      <div className="pro-page">
        {/* Header */}
        <header className="pro-header">
          <div className="pro-header-left">
            <Link href="/" className="pro-back-link">
              ← nyuniversity.network
            </Link>
          </div>

          <div className="pro-header-center">
            <div className="pro-avatar-lg">
              {avatarPreviewSrc ? (
                <img src={avatarPreviewSrc} alt={fullName} className="pro-avatar-img" />
              ) : (
                <span className="pro-avatar-initials">{initials}</span>
              )}
            </div>
            <div>
              <p className="pro-header-name">{self.profile.fullName || "—"}</p>
              <p className="pro-header-email">{session.user.email}</p>
            </div>
          </div>

          <div className="pro-header-right">
            <ProSignOut />
          </div>
        </header>

        {/* Tabs */}
        <nav className="pro-tabs-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`pro-tab ${activeTab === tab.key ? "pro-tab-active" : ""}`}
              onClick={() => {
                setActiveTab(tab.key);
                setMessage(null);
                setError(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="pro-tab-content">
          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (
            <div className="pro-body">
              {/* Left column */}
              <div className="pro-col-main">
                <section className="pro-section">
                  <h2 className="pro-section-title">Identity</h2>

                  <div className="pro-field">
                    <label className="pro-label" htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName"
                      className="pro-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="pro-field">
                    <label className="pro-label" htmlFor="major">Major</label>
                    <input
                      id="major"
                      className="pro-input"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                    />
                  </div>

                  <div className="pro-field">
                    <label className="pro-label" htmlFor="website">
                      Website <span className="pro-optional">(optional)</span>
                    </label>
                    <input
                      id="website"
                      className="pro-input"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="pro-field">
                    <label className="pro-label" htmlFor="headline">Headline</label>
                    <input
                      id="headline"
                      className="pro-input"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. CS + Math @ NYU"
                    />
                  </div>
                </section>

                <section className="pro-section">
                  <h2 className="pro-section-title">Profile Photo</h2>
                  <div className="pro-avatar-row">
                    <div className="pro-avatar-preview">
                      {avatarPreviewSrc ? (
                        <img src={avatarPreviewSrc} alt="Preview" className="pro-avatar-img" />
                      ) : (
                        <span className="pro-avatar-initials">{initials}</span>
                      )}
                    </div>
                    <div className="pro-avatar-controls">
                      <div className="pro-avatar-toggle">
                        <button
                          type="button"
                          className={`pro-toggle-btn ${avatarKind === "url" ? "pro-toggle-active" : ""}`}
                          onClick={() => setAvatarKind("url")}
                        >
                          URL
                        </button>
                        <button
                          type="button"
                          className={`pro-toggle-btn ${avatarKind === "upload" ? "pro-toggle-active" : ""}`}
                          onClick={() => setAvatarKind("upload")}
                        >
                          Upload
                        </button>
                      </div>
                      {avatarKind === "url" ? (
                        <input
                          className="pro-input"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      ) : (
                        <input
                          className="pro-input"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                        />
                      )}
                    </div>
                  </div>
                </section>

                <section className="pro-section">
                  <h2 className="pro-section-title">Social Links</h2>
                  <div className="pro-socials-grid">
                    {ALL_SOCIALS.map((platform) => (
                      <div key={platform} className="pro-field">
                        <label className="pro-label">{socialLabel(platform)}</label>
                        <input
                          className="pro-input"
                          value={socials[platform]}
                          onChange={(e) => updateSocial(platform, e.target.value)}
                          placeholder={platform === "email" ? "you@nyu.edu" : "https://..."}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="pro-hint">All four socials are required: X, LinkedIn, Email, and GitHub.</p>
                </section>
              </div>

              {/* Right column */}
              <div className="pro-col-side">
                <section className="pro-section">
                  <h2 className="pro-section-title">Bio</h2>
                  <textarea
                    className="pro-input pro-textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the network about yourself..."
                  />
                  <div className="pro-bio-meta">
                    <span className={bioWordCount > BIO_WORD_LIMIT ? "pro-over-limit" : "pro-word-count"}>
                      {bioWordCount} / {BIO_WORD_LIMIT} words
                    </span>
                  </div>
                  <div className="pro-bio-bar-track">
                    <div
                      className="pro-bio-bar-fill"
                      style={{
                        width: `${Math.min(100, (bioWordCount / BIO_WORD_LIMIT) * 100)}%`,
                        background: bioWordCount > BIO_WORD_LIMIT ? "#ef4444" : "var(--accent)",
                      }}
                    />
                  </div>

                </section>

                <div className="pro-submit-area">
                  <button
                    type="button"
                    className="pro-btn-submit"
                    onClick={saveRevision}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>

                  {message ? <p className="pro-status-ok">{message}</p> : null}
                  {error ? <p className="pro-status-err">{error}</p> : null}
                </div>
              </div>
            </div>
          )}

          {/* ── Connections Tab ── */}
          {activeTab === "connections" && (
            <div className="pro-tab-single">
              <div className="pro-tab-header-row">
                <div>
                  <h2 className="pro-section-title" style={{ marginBottom: 2 }}>Connections</h2>
                  <p className="pro-hint">{allConnectedIds.length} connection{allConnectedIds.length !== 1 ? "s" : ""}</p>
                </div>
                {connectionSaving ? (
                  <span className="pro-save-indicator">Saving…</span>
                ) : connectionSaved ? (
                  <span className="pro-save-indicator pro-save-ok">Saved</span>
                ) : null}
              </div>

              {/* Selected chips */}
              {allConnectedIds.length === 0 ? (
                <p className="pro-empty-state">No connections yet — search below to add</p>
              ) : (
                <div className="pro-chips-area">
                  {connectionChips.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.label}
                      initials={c.initials}
                      onRemove={() => toggleConnection(c.id)}
                    />
                  ))}
                  {incomingOnlyChips.map((c) => (
                    <Chip
                      key={c.id}
                      label={`${c.label} ← added you`}
                      initials={c.initials}
                    />
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="pro-field" style={{ marginTop: 16 }}>
                <label className="pro-label">Search members</label>
                <input
                  className="pro-input"
                  placeholder="Search members by name or major..."
                  value={connectionSearch}
                  onChange={(e) => setConnectionSearch(e.target.value)}
                />
              </div>

              {/* Results */}
              {optionsList.length > 0 ? (
                <div className="pro-search-results">
                  {optionsList.map((opt) => {
                    const isSelf = opt.id === self.profile._id;
                    const isOutgoing = selectedConnections.includes(opt.id);
                    const isIncomingOnly = !isOutgoing && incomingConnectionIds.includes(opt.id);
                    const isConnected = isOutgoing || isIncomingOnly;
                    return (
                      <div key={opt.id} className="pro-result-row">
                        <div className="pro-result-info">
                          <span className="pro-result-circle">{getInitials(opt.fullName)}</span>
                          <div>
                            <span className="pro-result-name">{opt.fullName}</span>
                            <span className="pro-result-major">{opt.major}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pro-result-btn ${isConnected ? "pro-result-btn-selected" : ""}`}
                          onClick={() => !isSelf && !isIncomingOnly && toggleConnection(opt.id)}
                          disabled={isSelf || isIncomingOnly}
                          title={isSelf ? "This is you" : isIncomingOnly ? "They connected to you" : undefined}
                        >
                          {isOutgoing ? "✓ Added" : isIncomingOnly ? "✓ Connected" : "+ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : connectionSearch ? (
                <p className="pro-empty-state" style={{ marginTop: 12 }}>No members found.</p>
              ) : null}
            </div>
          )}

          {/* ── Vouches Tab ── */}
          {activeTab === "vouches" && (
            <div className="pro-tab-single">
              <div className="pro-tab-header-row">
                <div>
                  <h2 className="pro-section-title" style={{ marginBottom: 2 }}>Top-5 Vouches</h2>
                  <p className="pro-hint">Vouch for up to 5 members you genuinely recommend.</p>
                </div>
                {vouchSaving ? (
                  <span className="pro-save-indicator">Saving…</span>
                ) : vouchSaved ? (
                  <span className="pro-save-indicator pro-save-ok">Saved</span>
                ) : null}
              </div>

              {/* Slot indicators */}
              <div className="pro-vouch-slots">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`pro-vouch-dot ${i < selectedVouches.length ? "pro-vouch-dot-filled" : ""}`} />
                ))}
                <span className="pro-hint" style={{ marginLeft: 8 }}>{selectedVouches.length}/5</span>
              </div>

              {/* Selected chips */}
              {selectedVouches.length === 0 ? (
                <p className="pro-empty-state">No vouches yet — search below to add</p>
              ) : (
                <div className="pro-chips-area">
                  {vouchChips.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.label}
                      initials={c.initials}
                      onRemove={() => toggleVouch(c.id)}
                    />
                  ))}
                </div>
              )}

              {/* Search (shares connectionSearch state) */}
              <div className="pro-field" style={{ marginTop: 16 }}>
                <label className="pro-label">Search members</label>
                <input
                  className="pro-input"
                  placeholder="Search members by name or major..."
                  value={connectionSearch}
                  onChange={(e) => setConnectionSearch(e.target.value)}
                />
              </div>

              {/* Results */}
              {optionsList.length > 0 ? (
                <div className="pro-search-results">
                  {optionsList.map((opt) => {
                    const isSelf = opt.id === self.profile._id;
                    const isSelected = selectedVouches.includes(opt.id);
                    const atMax = selectedVouches.length >= 5 && !isSelected;
                    return (
                      <div key={opt.id} className="pro-result-row">
                        <div className="pro-result-info">
                          <span className="pro-result-circle">{getInitials(opt.fullName)}</span>
                          <div>
                            <span className="pro-result-name">{opt.fullName}</span>
                            <span className="pro-result-major">{opt.major}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`pro-result-btn ${isSelected ? "pro-result-btn-selected" : ""}`}
                          onClick={() => !isSelf && !atMax && toggleVouch(opt.id)}
                          disabled={isSelf || atMax}
                          title={atMax ? "Max 5 reached" : isSelf ? "This is you" : undefined}
                        >
                          {isSelected ? "✓ Vouched" : atMax ? "Max reached" : "+ Vouch"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : connectionSearch ? (
                <p className="pro-empty-state" style={{ marginTop: 12 }}>No members found.</p>
              ) : null}
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === "security" && (
            <div className="pro-tab-single" style={{ maxWidth: 480 }}>
              <section className="pro-section">
                <h2 className="pro-section-title">Change Password</h2>
                <p className="pro-hint" style={{ marginBottom: 16 }}>Update your member login credentials.</p>

                <div className="pro-field">
                  <label className="pro-label" htmlFor="currentPwd">Current Password</label>
                  <input
                    id="currentPwd"
                    className="pro-input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    minLength={8}
                    autoComplete="current-password"
                  />
                </div>

                <div className="pro-field">
                  <label className="pro-label" htmlFor="newPwd">New Password</label>
                  <input
                    id="newPwd"
                    className="pro-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div className="pro-field">
                  <label className="pro-label" htmlFor="confirmPwd">Confirm New Password</label>
                  <input
                    id="confirmPwd"
                    className="pro-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="button"
                  className="pro-btn-submit"
                  onClick={savePassword}
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>

                {message ? <p className="pro-status-ok" style={{ marginTop: 12 }}>{message}</p> : null}
                {error ? <p className="pro-status-err" style={{ marginTop: 12 }}>{error}</p> : null}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Inline sign-out button (avoids importing AuthControls) ───────────────────

function ProSignOut() {
  const [loading, setLoading] = useState(false);
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" className="pro-signout-btn" onClick={handleSignOut} disabled={loading}>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

// ─── Scoped styles ────────────────────────────────────────────────────────────

const proStyles = `
  /* ── Variables ── */
  .pro-page {
    --pro-mint: var(--accent);
    --pro-mint-dim: rgba(168, 85, 247, 0.12);
    --pro-mint-border: rgba(168, 85, 247, 0.25);
    --pro-mint-text: var(--accent);
  }

  /* ── Page shell ── */
  .pro-page {
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
    display: flex;
    flex-direction: column;
    font-family: 'Inter', sans-serif;
  }

  /* ── Header ── */
  .pro-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border);
    gap: 1rem;
    flex-wrap: wrap;
  }

  .pro-header-left {}

  .pro-back-link {
    font-size: 0.78rem;
    color: var(--muted);
    text-decoration: none;
    letter-spacing: 0.02em;
    transition: color 0.15s;
  }

  .pro-back-link:hover {
    color: var(--foreground);
  }

  .pro-header-center {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    justify-content: center;
  }

  .pro-header-right {}

  .pro-header-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--foreground);
    line-height: 1.2;
  }

  .pro-header-email {
    font-size: 0.75rem;
    color: var(--muted);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  /* ── Avatar ── */
  .pro-avatar-lg {
    width: 42px;
    height: 42px;
    min-width: 42px;
    border-radius: 50%;
    background: var(--pro-mint-dim);
    border: 2px solid var(--pro-mint-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .pro-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pro-avatar-initials {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--pro-mint-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pro-avatar-preview {
    width: 64px;
    height: 64px;
    min-width: 64px;
    border-radius: 50%;
    background: var(--pro-mint-dim);
    border: 2px solid var(--pro-mint-border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .pro-skel-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
  }

  /* ── Sign out ── */
  .pro-signout-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--secondary);
    font-size: 0.78rem;
    font-family: 'Inter', sans-serif;
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .pro-signout-btn:hover {
    border-color: var(--secondary);
    color: var(--foreground);
  }

  .pro-signout-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Tabs ── */
  .pro-tabs-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    overflow-x: auto;
  }

  .pro-tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    padding: 0.85rem 1.1rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    margin-bottom: -1px;
  }

  .pro-tab:hover {
    color: var(--foreground);
  }

  .pro-tab-active {
    color: var(--pro-mint-text);
    border-bottom-color: var(--pro-mint);
  }

  /* ── Tab content ── */
  .pro-tab-content {
    flex: 1;
    padding: 2rem;
  }

  /* ── Two-column body (Profile tab) ── */
  .pro-body {
    display: flex;
    gap: 2.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .pro-col-main {
    flex: 1 1 55%;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .pro-col-side {
    flex: 1 1 36%;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Single-col tab content ── */
  .pro-tab-single {
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .pro-tab-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  /* ── Section ── */
  .pro-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .pro-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.25rem;
  }

  /* ── Fields ── */
  .pro-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .pro-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--secondary);
  }

  .pro-optional {
    font-weight: 400;
    color: var(--muted);
  }

  .pro-input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    color: var(--foreground);
    font-size: 0.88rem;
    font-family: 'Inter', sans-serif;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .pro-input:focus {
    border-color: var(--pro-mint);
    box-shadow: 0 0 0 3px var(--pro-mint-dim);
  }

  .pro-input::placeholder {
    color: var(--tertiary);
  }

  .pro-textarea {
    min-height: 140px;
    resize: vertical;
    line-height: 1.6;
  }

  /* ── Bio meta ── */
  .pro-bio-meta {
    display: flex;
    justify-content: flex-end;
  }

  .pro-word-count {
    font-size: 0.72rem;
    color: var(--muted);
    font-family: 'SF Mono', monospace;
  }

  .pro-over-limit {
    font-size: 0.72rem;
    color: #ef4444;
    font-family: 'SF Mono', monospace;
  }

  .pro-bio-bar-track {
    height: 4px;
    border-radius: 99px;
    background: var(--border);
    overflow: hidden;
  }

  .pro-bio-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.2s, background 0.2s;
  }

  /* ── Pending badge ── */
  .pro-pending-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--pro-mint-dim);
    border: 1px solid var(--pro-mint-border);
    border-radius: 6px;
    padding: 0.45rem 0.75rem;
    font-size: 0.75rem;
    color: var(--pro-mint-text);
    margin-top: 0.5rem;
  }

  .pro-pending-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--pro-mint);
    flex-shrink: 0;
    animation: pro-pulse 1.6s ease infinite;
  }

  @keyframes pro-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  /* ── Avatar row ── */
  .pro-avatar-row {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .pro-avatar-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 180px;
  }

  .pro-avatar-toggle {
    display: flex;
    gap: 0.4rem;
  }

  .pro-toggle-btn {
    padding: 0.3rem 0.7rem;
    font-size: 0.78rem;
    font-family: 'Inter', sans-serif;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .pro-toggle-btn:hover {
    border-color: var(--pro-mint-border);
    color: var(--foreground);
  }

  .pro-toggle-active {
    background: var(--pro-mint-dim);
    border-color: var(--pro-mint-border);
    color: var(--pro-mint-text);
  }

  /* ── Socials grid ── */
  .pro-socials-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 480px) {
    .pro-socials-grid { grid-template-columns: 1fr; }
  }

  /* ── Hint ── */
  .pro-hint {
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.5;
  }

  /* ── Submit area ── */
  .pro-submit-area {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .pro-btn-submit {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--pro-mint);
    color: #0f1f1e;
    border: none;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: opacity 0.15s, box-shadow 0.15s;
    letter-spacing: 0.02em;
  }

  .pro-btn-submit:hover:not(:disabled) {
    opacity: 0.88;
    box-shadow: 0 0 0 3px var(--pro-mint-dim);
  }

  .pro-btn-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .pro-submit-hint {
    font-size: 0.73rem;
    color: var(--muted);
    text-align: center;
  }

  .pro-status-ok {
    font-size: 0.82rem;
    color: var(--success);
    line-height: 1.5;
  }

  .pro-status-err {
    font-size: 0.82rem;
    color: #ef4444;
    line-height: 1.5;
  }

  /* ── Mint CTA button ── */
  .pro-btn-mint {
    display: inline-block;
    padding: 0.65rem 1.25rem;
    background: var(--pro-mint-dim);
    border: 1px solid var(--pro-mint-border);
    color: var(--pro-mint-text);
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    text-decoration: none;
    transition: background 0.15s;
  }

  .pro-btn-mint:hover {
    background: rgba(168, 85, 247, 0.22);
  }

  /* ── Chips ── */
  .pro-chips-area {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .pro-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--pro-mint-dim);
    border: 1px solid var(--pro-mint-border);
    border-radius: 99px;
    padding: 0.3rem 0.55rem 0.3rem 0.4rem;
    font-size: 0.78rem;
    color: var(--pro-mint-text);
    line-height: 1;
  }

  .pro-chip-avatar {
    width: 20px;
    height: 20px;
    min-width: 20px;
    border-radius: 50%;
    background: rgba(168, 85, 247, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.58rem;
    font-weight: 700;
    color: var(--pro-mint-text);
    text-transform: uppercase;
  }

  .pro-chip-label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .pro-chip-remove {
    background: transparent;
    border: none;
    color: var(--pro-mint-text);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.1rem;
    opacity: 0.7;
    transition: opacity 0.1s;
    display: flex;
    align-items: center;
  }

  .pro-chip-remove:hover {
    opacity: 1;
  }

  /* ── Empty state ── */
  .pro-empty-state {
    font-size: 0.82rem;
    color: var(--muted);
    font-style: italic;
    padding: 0.5rem 0;
  }

  /* ── Search results ── */
  .pro-search-results {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .pro-result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.1s;
  }

  .pro-result-row:last-child {
    border-bottom: none;
  }

  .pro-result-row:hover {
    background: var(--hover-bg);
  }

  .pro-result-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .pro-result-circle {
    width: 30px;
    height: 30px;
    min-width: 30px;
    border-radius: 50%;
    background: var(--card-bg);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--secondary);
    flex-shrink: 0;
  }

  .pro-result-name {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pro-result-major {
    display: block;
    font-size: 0.72rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pro-result-btn {
    flex-shrink: 0;
    padding: 0.3rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    border: 1px solid var(--pro-mint-border);
    border-radius: 6px;
    background: var(--pro-mint-dim);
    color: var(--pro-mint-text);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
  }

  .pro-result-btn:hover:not(:disabled) {
    background: rgba(168, 85, 247, 0.22);
  }

  .pro-result-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pro-result-btn-selected {
    background: var(--pro-mint-dim);
    border-color: var(--pro-mint);
    color: var(--pro-mint-text);
    font-weight: 600;
  }

  /* ── Auto-save indicator ── */
  .pro-save-indicator {
    font-size: 0.72rem;
    color: var(--muted);
    font-family: 'SF Mono', monospace;
    align-self: center;
  }

  .pro-save-ok {
    color: var(--pro-mint-text);
  }

  /* ── Vouch slots ── */
  .pro-vouch-slots {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pro-vouch-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .pro-vouch-dot-filled {
    background: var(--pro-mint);
  }

  /* ── Skeleton shimmer ── */
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .pro-skeleton-block {
    border-radius: 6px;
    background: linear-gradient(90deg, var(--border) 25%, var(--hover-bg) 50%, var(--border) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .pro-header { padding: 0.85rem 1.25rem; }
    .pro-tabs-bar { padding: 0 1.25rem; }
    .pro-tab-content { padding: 1.5rem 1.25rem; }
    .pro-tab { padding: 0.75rem 0.85rem; font-size: 0.8rem; }
    .pro-body { flex-direction: column; gap: 2rem; }
    .pro-col-main, .pro-col-side { flex: 1 1 100%; min-width: unset; }
  }

  @media (max-width: 480px) {
    .pro-header { padding: 0.75rem 1rem; flex-wrap: wrap; }
    .pro-header-center { order: 2; flex: 0 0 100%; justify-content: flex-start; }
    .pro-header-left { order: 1; }
    .pro-header-right { order: 3; }
    .pro-tabs-bar { padding: 0 1rem; }
    .pro-tab-content { padding: 1.25rem 1rem; }
    .pro-socials-grid { grid-template-columns: 1fr; }
  }
`;
