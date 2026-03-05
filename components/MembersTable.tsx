import React, { useMemo } from 'react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { Mail } from 'lucide-react';

export interface MemberRow {
    id: string;
    fullName: string;
    major: string;
    website?: string;
    headline?: string;
    avatarUrl?: string;
    fireScore: number;
    socials?: { platform: string; url: string }[];
}

interface MembersTableProps {
    members: MemberRow[];
    searchQuery?: string;
}

export default function MembersTable({ members, searchQuery }: MembersTableProps) {
    const websiteHref = (website: string) => (website.startsWith('http://') || website.startsWith('https://') ? website : `https://${website}`);
    const websiteLabel = (website: string) => {
        try {
            return new URL(websiteHref(website)).hostname.replace(/^www\./, '');
        } catch {
            return website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        }
    };
    const maxSocialCount = useMemo(() => members.reduce((max, member) => Math.max(max, member.socials?.length ?? 0), 0), [members]);
    const linksColumnWidth = useMemo(() => {
        const iconSlot = 22;
        const gap = 8;
        const basePadding = 18;
        const estimatedWidth = basePadding + maxSocialCount * iconSlot + Math.max(0, maxSocialCount - 1) * gap;
        return Math.min(190, Math.max(88, estimatedWidth));
    }, [maxSocialCount]);
    const tableStyle = { ['--links-col-width' as '--links-col-width']: `${linksColumnWidth}px` } as React.CSSProperties;

    const highlightText = (text: string | null | undefined) => {
        if (!text || !searchQuery) return text || '';

        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase()
                ? <mark key={i} style={{ background: '#ffd54f', padding: '0 2px' }}>{part}</mark>
                : part
        );
    };

    const getSocial = (
        socials: { platform: string; url: string }[] | null | undefined,
        platform: string
    ) => socials?.find((s) => s.platform === platform)?.url;

    return (
        <div className="members-table-container">
            <div className="search-results-info">
                {searchQuery ? (
                    members.length === 0
                        ? `No results found for "${searchQuery}"`
                        : `Found ${members.length} member${members.length !== 1 ? 's' : ''}`
                ) : (
                    <span className="search-results-placeholder">&nbsp;</span>
                )}
            </div>
            <table className="members-table" style={tableStyle}>
                <thead>
                    <tr>
                        <th>name</th>
                        <th>major</th>
                        <th>site</th>
                        <th>links</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((member, index) => {
                        const socials = member.socials ?? [];
                        const xUrl = getSocial(socials, 'x');
                        const linkedinUrl = getSocial(socials, 'linkedin');
                        const githubUrl = getSocial(socials, 'github');
                        const emailUrl = getSocial(socials, 'email');

                        return (
                            <tr key={member.id}>
                                <td className="user-cell">
                                    {member.avatarUrl ? (
                                        <img
                                            src={member.avatarUrl}
                                            alt={member.fullName}
                                            className={`avatar ${searchQuery && index === 0 ? 'avatar-highlighted' : ''}`}
                                        />
                                    ) : (
                                        <div
                                            className={`avatar ${searchQuery && index === 0 ? 'avatar-highlighted' : ''}`}
                                            style={{ backgroundColor: '#e0e0e0' }}
                                        />
                                    )}
                                    {member.website && member.website.trim() ? (
                                        <a
                                            href={member.website.startsWith('http') ? member.website : `https://${member.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="name-link"
                                        >
                                            {highlightText(member.fullName) || 'No name'}
                                        </a>
                                    ) : (
                                        <span>{highlightText(member.fullName) || 'No name'}</span>
                                    )}
                                </td>
                                <td>{highlightText(member.major) || '\u2014'}</td>
                                <td className="site-cell">
                                    {member.website && member.website.trim() ? (
                                        <a
                                            href={websiteHref(member.website)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="site-link"
                                            title={websiteLabel(member.website)}
                                        >
                                            {websiteLabel(member.website)}
                                        </a>
                                    ) : (
                                        <span className="table-placeholder">{'\u2014'}</span>
                                    )}
                                </td>
                                <td>
                                    <div className="social-icons">
                                        {xUrl && (
                                            <a
                                                href={xUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="social-icon-link"
                                                title="X / Twitter"
                                            >
                                                <FaXTwitter size={16} />
                                            </a>
                                        )}
                                        {linkedinUrl && (
                                            <a
                                                href={linkedinUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="social-icon-link"
                                                title="LinkedIn"
                                            >
                                                <FaLinkedin size={16} />
                                            </a>
                                        )}
                                        {githubUrl && (
                                            <a
                                                href={githubUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="social-icon-link"
                                                title="GitHub"
                                            >
                                                <FaGithub size={16} />
                                            </a>
                                        )}
                                        {emailUrl && (
                                            <a
                                                href={emailUrl.startsWith('mailto:') ? emailUrl : `mailto:${emailUrl}`}
                                                className="social-icon-link"
                                                title="Email"
                                            >
                                                <Mail size={16} />
                                            </a>
                                        )}
                                        {socials.length === 0 && (
                                            <span className="table-placeholder">{'\u2014'}</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
