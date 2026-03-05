import React from 'react';
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
    socials: { platform: string; url: string }[];
}

interface MembersTableProps {
    members: MemberRow[];
    searchQuery?: string;
}

export default function MembersTable({ members, searchQuery }: MembersTableProps) {
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

    const getSocial = (socials: { platform: string; url: string }[], platform: string) =>
        socials.find(s => s.platform === platform)?.url;

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
            <table className="members-table">
                <thead>
                    <tr>
                        <th>name</th>
                        <th>major</th>
                        <th>site</th>
                        <th>links</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((member, index) => (
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
                            <td>
                                {member.website && member.website.trim() ? (
                                    <a
                                        href={member.website.startsWith('http') ? member.website : `https://${member.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="site-link"
                                    >
                                        {member.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')}
                                    </a>
                                ) : (
                                    <span className="table-placeholder">{'\u2014'}</span>
                                )}
                            </td>
                            <td>
                                <div className="social-icons">
                                    {getSocial(member.socials, 'x') && (
                                        <a
                                            href={getSocial(member.socials, 'x')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="social-icon-link"
                                            title="X / Twitter"
                                        >
                                            <FaXTwitter size={16} />
                                        </a>
                                    )}
                                    {getSocial(member.socials, 'linkedin') && (
                                        <a
                                            href={getSocial(member.socials, 'linkedin')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="social-icon-link"
                                            title="LinkedIn"
                                        >
                                            <FaLinkedin size={16} />
                                        </a>
                                    )}
                                    {getSocial(member.socials, 'github') && (
                                        <a
                                            href={getSocial(member.socials, 'github')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="social-icon-link"
                                            title="GitHub"
                                        >
                                            <FaGithub size={16} />
                                        </a>
                                    )}
                                    {getSocial(member.socials, 'email') && (
                                        <a
                                            href={`mailto:${getSocial(member.socials, 'email')}`}
                                            className="social-icon-link"
                                            title="Email"
                                        >
                                            <Mail size={16} />
                                        </a>
                                    )}
                                    {member.socials.length === 0 && (
                                        <span className="table-placeholder">{'\u2014'}</span>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
