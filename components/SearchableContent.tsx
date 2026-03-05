'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import MembersTable, { type MemberRow } from './MembersTable';
import NetworkGraph from './NetworkGraph';
import AsciiBackground from './AsciiBackground';
import { Search } from 'lucide-react';
import AsciiFlame from './AsciiFlame';

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

interface GraphSnapshot {
    version: number;
    generatedAt: string;
    nodes: Array<{ id: string; name: string; avatarUrl?: string; fireScore: number }>;
    edges: Array<{ source: string; target: string; kind: 'connection' | 'vouch' }>;
}

export default function SearchableContent() {
    const [searchQuery, setSearchQuery] = useState('');
    const [graphData, setGraphData] = useState<GraphSnapshot | null>(null);
    const [shuffledOnce, setShuffledOnce] = useState(false);
    const [shuffleOrder, setShuffleOrder] = useState<string[]>([]);

    const allProfiles = useQuery(api.search.listProfiles, {});
    const profileSocialRows = useQuery(api.search.listProfileSocials, {});

    const socialsByProfileId = useMemo(() => {
        const map = new Map<string, { platform: string; url: string }[]>();
        if (!profileSocialRows) return map;
        for (const row of profileSocialRows) {
            const key = row.profileId;
            const current = map.get(key) ?? [];
            current.push({ platform: row.platform, url: row.url });
            map.set(key, current);
        }
        return map;
    }, [profileSocialRows]);

    // Fetch graph snapshot
    useEffect(() => {
        fetch('/api/graph', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setGraphData(data as GraphSnapshot))
            .catch(err => console.error('Failed to fetch graph:', err));
    }, []);

    // Shuffle order once when profiles first load
    useEffect(() => {
        if (allProfiles && allProfiles.length > 0 && !shuffledOnce) {
            setShuffleOrder(shuffleArray(allProfiles.map(p => p.id)));
            setShuffledOnce(true);
        }
    }, [allProfiles, shuffledOnce]);

    const filteredMembers: MemberRow[] = useMemo(() => {
        if (!allProfiles) return [];

        let result = allProfiles.map((p): MemberRow => ({
            id: p.id,
            fullName: p.fullName,
            major: p.major,
            website: p.website ?? undefined,
            headline: p.headline ?? undefined,
            avatarUrl: p.avatarUrl ?? undefined,
            fireScore: p.fireScore,
            socials: (p.socials && p.socials.length > 0) ? p.socials : (socialsByProfileId.get(p.id) ?? []),
        }));

        // Apply shuffle order when not searching
        if (!searchQuery && shuffleOrder.length > 0) {
            const orderMap = new Map(shuffleOrder.map((id, i) => [id, i]));
            result.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(member =>
                member.fullName.toLowerCase().includes(q) ||
                member.major.toLowerCase().includes(q) ||
                member.website?.toLowerCase().includes(q) ||
                member.headline?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [allProfiles, searchQuery, shuffleOrder, socialsByProfileId]);

    const filteredMemberIds = new Set<string>(filteredMembers.map(m => m.id));

    // Build graph props from snapshot, add website from profiles
    const graphNodes = useMemo(() => {
        if (!graphData) return [];
        const profileMap = new Map<string, NonNullable<typeof allProfiles>[number]>(allProfiles?.map(p => [p.id as string, p]) ?? []);
        return graphData.nodes.map(node => ({
            ...node,
            website: profileMap.get(node.id)?.website ?? undefined,
        }));
    }, [graphData, allProfiles]);

    const graphEdges = useMemo(() => {
        if (!graphData) return [];
        if (!searchQuery) return graphData.edges;
        return graphData.edges.filter(
            edge => filteredMemberIds.has(edge.source) && filteredMemberIds.has(edge.target)
        );
    }, [graphData, searchQuery, filteredMemberIds]);

    return (
        <main className="main-container">
            <AsciiFlame />
            <nav className="top-nav">
                <a href="/admin">admin</a>
                <a href="/me">profile</a>
                <a href="/sign-in">sign in</a>
            </nav>
            <div className="content-wrapper">
                <div className="header-section">
                    <div className="title-row">
                        <h1 className="title">nyu.network</h1>
                    </div>
                    <div className="description">
                        <p>welcome to the network for nyu students.</p>
                        <p>
                            our school is home to some of the most talented engineers, builders, makers,
                            artists, designers, writers, and everything in between. this is a place to
                            find other cool people who also go to nyu, a directory of the people
                            who actually make this place special.
                        </p>
                        <p>
                            want to join? <a
                                href="/apply"
                                className="join-link"
                            >
                                apply here
                            </a>
                        </p>
                    </div>
                </div>

                <div className="table-section">
                    <MembersTable members={filteredMembers} searchQuery={searchQuery} />
                </div>
            </div>

            <div className="graph-section">
                <div className="search-wrapper">
                    <div className="search-bar-container">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="search-clear-btn"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <NetworkGraph
                    nodes={graphNodes}
                    edges={graphEdges}
                    highlightedNodeIds={filteredMembers.map(m => m.id)}
                    searchQuery={searchQuery}
                />
            </div>
        </main>
    );
}
