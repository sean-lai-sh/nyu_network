"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { AtSign, Flame, Github, Linkedin, Mail } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

type GraphSnapshot = {
  version: number;
  generatedAt: string;
  nodes: Array<{ id: string; name: string; avatarUrl?: string; fireScore: number }>;
  edges: Array<{ source: string; target: string; kind: "connection" | "vouch" }>;
};
type MemberSocialPlatform = "x" | "linkedin" | "email" | "github";
type MemberRecord = {
  id: string;
  fullName: string;
  major: string;
  website?: string;
  avatarUrl?: string;
  fireScore: number;
  socials?: Array<{ platform: MemberSocialPlatform; url: string }>;
};

const CANVAS_WIDTH = 1020;
const CANVAS_HEIGHT = 640;
const NODE_SIZE = 52;
const CANVAS_PADDING = 64;

const positionNodes = (nodes: GraphSnapshot["nodes"]) => {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const maxRadius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - CANVAS_PADDING;
  const rings = Math.max(1, Math.ceil(nodes.length / 14));
  const ringStep = rings > 1 ? maxRadius / rings : maxRadius * 0.55;

  return nodes.map((node, index) => {
    const ring = Math.floor(index / 14) + 1;
    const positionInRing = index % 14;
    const pointsOnRing = Math.min(14, nodes.length - (ring - 1) * 14);
    const angle = (positionInRing / Math.max(pointsOnRing, 1)) * Math.PI * 2;
    const radius = rings > 1 ? ring * ringStep : ringStep;

    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });
};

type DragOffset = { x: number; y: number };
type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const websiteHref = (website: string) => (website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`);
const websiteLabel = (website: string) => {
  try {
    return new URL(websiteHref(website)).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
};
const socialHref = (social: { platform: MemberSocialPlatform; url: string }) => {
  if (social.platform === "email") {
    return social.url.startsWith("mailto:") ? social.url : `mailto:${social.url}`;
  }
  return websiteHref(social.url);
};
const socialIcon = (platform: MemberSocialPlatform) => {
  if (platform === "linkedin") return <Linkedin className="h-3.5 w-3.5" strokeWidth={2.2} />;
  if (platform === "github") return <Github className="h-3.5 w-3.5" strokeWidth={2.2} />;
  if (platform === "email") return <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />;
  return <AtSign className="h-3.5 w-3.5" strokeWidth={2.2} />;
};

export function LandingNetworkSection() {
  const members = useQuery(api.search.listProfiles, {}) as MemberRecord[] | undefined;
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragOffset = useRef<DragOffset>({ x: 0, y: 0 });

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        setError(null);
        const response = await fetch("/api/graph", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load graph snapshot.");
        }

        const graphSnapshot = (await response.json()) as GraphSnapshot;
        setSnapshot(graphSnapshot);
        const seededPositions = Object.fromEntries(positionNodes(graphSnapshot.nodes).map((node) => [node.id, { x: node.x, y: node.y }]));
        setPositions(seededPositions);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load graph.");
      }
    };

    loadSnapshot();
  }, []);

  const readPointerPosition = useCallback((event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }

    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return null;
    }

    const cursorPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: cursorPoint.x, y: cursorPoint.y };
  }, []);

  const positionedNodes = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.nodes.map((node) => ({
      ...node,
      x: positions[node.id]?.x ?? CANVAS_WIDTH / 2,
      y: positions[node.id]?.y ?? CANVAS_HEIGHT / 2
    }));
  }, [snapshot, positions]);

  const filteredGraphNodes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return positionedNodes.filter((node) => !query || node.name.toLowerCase().includes(query));
  }, [positionedNodes, searchTerm]);

  const filteredNodeIds = useMemo(() => new Set(filteredGraphNodes.map((node) => node.id)), [filteredGraphNodes]);
  const filteredEdges = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.edges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target));
  }, [filteredNodeIds, snapshot]);
  const filteredNodesById = useMemo(() => new Map(filteredGraphNodes.map((node) => [node.id, node])), [filteredGraphNodes]);
  const graphViewport = useMemo(() => {
    if (!filteredGraphNodes.length) {
      return { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    }

    const nodeHalf = NODE_SIZE / 2;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of filteredGraphNodes) {
      minX = Math.min(minX, node.x - nodeHalf - 56);
      maxX = Math.max(maxX, node.x + nodeHalf + 56);
      minY = Math.min(minY, node.y - nodeHalf - 46);
      maxY = Math.max(maxY, node.y + nodeHalf + 70);
    }

    const outerPad = 30;
    minX -= outerPad;
    maxX += outerPad;
    minY -= outerPad;
    maxY += outerPad;

    let width = Math.max(420, maxX - minX);
    let height = Math.max(280, maxY - minY);
    const targetRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const currentRatio = width / height;

    if (currentRatio > targetRatio) {
      const desiredHeight = width / targetRatio;
      const extraY = (desiredHeight - height) / 2;
      minY -= extraY;
      maxY += extraY;
      height = desiredHeight;
    } else {
      const desiredWidth = height * targetRatio;
      const extraX = (desiredWidth - width) / 2;
      minX -= extraX;
      maxX += extraX;
      width = desiredWidth;
    }

    return { x: minX, y: minY, width, height };
  }, [filteredGraphNodes]);

  const sortedMembers = useMemo(
    () => (members ? [...members].sort((a, b) => b.fireScore - a.fireScore || a.fullName.localeCompare(b.fullName)) : []),
    [members]
  );
  const maxSocialCount = useMemo(() => sortedMembers.reduce((max, member) => Math.max(max, member.socials?.length ?? 0), 0), [sortedMembers]);
  const socialsColumnWidth = useMemo(() => {
    const iconSlot = 20;
    const gap = 8;
    const basePadding = 18;
    const estimatedWidth = basePadding + maxSocialCount * iconSlot + Math.max(0, maxSocialCount - 1) * gap;
    return Math.min(170, Math.max(84, estimatedWidth));
  }, [maxSocialCount]);

  const stopDragging = useCallback(() => {
    setDraggingId(null);
  }, []);

  const onNodePointerDown = useCallback(
    (event: React.PointerEvent<SVGGElement>, nodeId: string) => {
      const pointer = readPointerPosition(event);
      const nodePosition = positions[nodeId];
      if (!pointer || !nodePosition) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);

      dragOffset.current = {
        x: pointer.x - nodePosition.x,
        y: pointer.y - nodePosition.y
      };
      setDraggingId(nodeId);
    },
    [positions, readPointerPosition]
  );

  const onCanvasPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingId) {
        return;
      }

      const pointer = readPointerPosition(event);
      if (!pointer) {
        return;
      }

      const min = CANVAS_PADDING;
      const maxX = CANVAS_WIDTH - min;
      const maxY = CANVAS_HEIGHT - min;
      const nextPosition = {
        x: clamp(pointer.x - dragOffset.current.x, min, maxX),
        y: clamp(pointer.y - dragOffset.current.y, min, maxY)
      };

      setPositions((current) => ({
        ...current,
        [draggingId]: nextPosition
      }));
    },
    [draggingId, readPointerPosition]
  );

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <article className="brutal-card p-6">
          <p className="mono mb-2 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">NYU Community Graph</p>
          <h2 className="mb-4 text-4xl font-black leading-tight">Map real campus trust, not follower counts.</h2>
          <p className="mb-4 text-base text-[var(--muted)]">
            This network highlights members, their relationships, and top vouches. Drag nodes to inspect clusters and who is earning trust across departments.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/apply" className="brutal-btn">
              Apply to Join
            </Link>
            <Link href="/graph" className="brutal-btn bg-[var(--paper)]">
              Open Full Graph
            </Link>
          </div>
        </article>

        <aside className="brutal-card p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h3 className="mono text-sm uppercase tracking-wider">Members</h3>
            <p className="mono text-xs text-[var(--muted)]">{members ? `${sortedMembers.length}` : "Loading..."}</p>
          </div>
          {!members ? <p className="text-sm text-[var(--muted)]">Fetching member list...</p> : null}
          {members ? (
            <div className="max-h-[430px] overflow-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="mono text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <tr className="border-b-2 border-[var(--border)]">
                    <th className="w-12 py-2 text-left">Profile</th>
                    <th className="w-[24%] py-2 text-left">Name</th>
                    <th className="w-[18%] py-2 text-left">Major</th>
                    <th className="py-2 text-left">Website</th>
                    <th className="py-2 text-left" style={{ width: `${socialsColumnWidth}px` }}>Socials</th>
                    <th className="w-[8%] py-2 text-right">Fire</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => (
                    <tr key={member.id} className="border-b border-[var(--border)]/25 align-middle">
                      <td className="py-2 pr-2">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={`${member.fullName} profile`} className="pixel-avatar h-9 w-9 object-cover" />
                        ) : (
                          <div className="pixel-avatar mono flex h-9 w-9 items-center justify-center bg-[var(--accent-soft)] text-[10px]">NYU</div>
                        )}
                      </td>
                      <td className="truncate py-2 pr-2 font-semibold">{member.fullName}</td>
                      <td className="truncate py-2 pr-2 text-[var(--muted)]">{member.major}</td>
                      <td className="truncate py-2 pr-1">
                        {member.website ? (
                          <a
                            href={websiteHref(member.website)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full min-w-0 text-[var(--ink)] hover:text-[var(--accent)]"
                            title={websiteLabel(member.website)}
                          >
                            <span className="truncate">{websiteLabel(member.website)}</span>
                          </a>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-1">
                        {(member.socials ?? []).length ? (
                          <div className="flex items-center gap-2 whitespace-nowrap text-[var(--ink)]">
                            {(member.socials ?? []).map((social) => (
                              <a
                                key={`${member.id}-${social.platform}-${social.url}`}
                                href={socialHref(social)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--ink)] hover:text-[var(--accent)]"
                                title={social.platform}
                                aria-label={`${member.fullName} ${social.platform}`}
                              >
                                {socialIcon(social.platform)}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span className="mono inline-flex items-center justify-end gap-1 text-xs text-[var(--accent)]">
                          <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {member.fireScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="brutal-card self-start overflow-hidden p-4">
        <div className="pb-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <input
              className="brutal-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search members on graph..."
              aria-label="Search graph members"
            />
            <select
              className="brutal-input"
              defaultValue="todo"
              disabled
              aria-label="Graph filter"
            >
              <option value="todo">Filter (TODO)</option>
            </select>
          </div>
        </div>

        {error ? <p className="p-6 text-sm text-red-600">{error}</p> : null}
        {!snapshot ? <p className="p-6 text-sm text-[var(--muted)]">Loading graph snapshot...</p> : null}
        {snapshot ? (
          <div>
            <svg
              ref={svgRef}
              viewBox={`${graphViewport.x} ${graphViewport.y} ${graphViewport.width} ${graphViewport.height}`}
              className="h-auto w-full border-2 border-[var(--border)] bg-white lg:w-[38svw] lg:min-w-[30svw] lg:max-w-[40svw]"
              style={{ aspectRatio: `${graphViewport.width} / ${graphViewport.height}` }}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onPointerLeave={stopDragging}
            >
              <rect x={graphViewport.x} y={graphViewport.y} width={graphViewport.width} height={graphViewport.height} fill="#fffef8" />

              {filteredEdges.map((edge, index) => {
                const source = filteredNodesById.get(edge.source);
                const target = filteredNodesById.get(edge.target);
                if (!source || !target) {
                  return null;
                }

                return (
                  <line
                    key={`${edge.source}-${edge.target}-${edge.kind}-${index}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.kind === "vouch" ? "#f05a24" : "#8f8f86"}
                    strokeWidth={edge.kind === "vouch" ? 3.2 : 1.2}
                    strokeDasharray={edge.kind === "vouch" ? "0" : "4 4"}
                  />
                );
              })}

              {filteredGraphNodes.map((node) => (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={draggingId === node.id ? "cursor-grabbing" : "cursor-grab"}
                  onPointerDown={(event) => onNodePointerDown(event, node.id)}
                >
                  <rect x={-26} y={-26} width={52} height={52} fill="#ffffff" stroke="#141414" strokeWidth={2} />
                  {node.avatarUrl ? (
                    <image href={node.avatarUrl} x={-24} y={-24} width={48} height={48} preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated" }} />
                  ) : (
                    <text x={0} y={2} textAnchor="middle" fontSize={10} fill="#141414" fontFamily="monospace">
                      NYU
                    </text>
                  )}
                  <text x={0} y={38} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#141414">
                    {node.name}
                  </text>
                  <text x={0} y={50} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#f05a24">
                    fire {node.fireScore}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : null}
        {snapshot && filteredGraphNodes.length === 0 ? <p className="px-3 pb-2 text-sm text-[var(--muted)]">No members match this search/filter.</p> : null}
      </div>
    </section>
  );
}
