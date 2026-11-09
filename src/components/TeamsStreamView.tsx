"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { StaticImageData } from "next/image";
import { TEAM_TAGS } from "@/lib/team-tags";
import { Eye, EyeOff, Lock, Pin, X } from "lucide-react";

export interface TeamStreamPlayer {
    id: string;
    name: string;
    points: number | null; // null = no score yet ("—")
    dnf?: boolean;
}

export interface TeamStreamEntry {
    id: string;
    name: string;
    tag?: string; // key into TEAM_TAGS — undefined/missing renders an initials placeholder
    points: number | null; // null = no score yet ("—")
    rank: number; // standard competition ranking (ties share a rank)
    players: TeamStreamPlayer[]; // pre-sorted, highest points first
}

interface Props {
    teams: TeamStreamEntry[]; // already sorted by rank ascending
    blurred: boolean; // Finale suspense: identities anonymized upstream + roster flip disabled
    roundLabel: string; // e.g. "Mis à jour après la ronde 2"
    initialRostersOpen?: boolean; // ?rosters=1
    streamMode?: boolean; // ?stream=1 — caps the grid to top 9, optional auto-rotation
    rotateSeconds?: number; // ?rotate=12 — only used when streamMode and there's more than 9 teams
    pinnedIds?: string[]; // up to 3 pinned team ids — highlighted on the card front
    onTogglePin?: (teamId: string) => void;
}

function getInitials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
    return initials || "?";
}

function rankBadgeClass(rank: number): string {
    if (rank === 1) return "bg-[#e8b400] text-black";
    if (rank === 2) return "bg-[#cfd6de] text-black";
    if (rank === 3) return "bg-[#e06a00] text-black";
    return "bg-[#2a2a30] text-muted-foreground";
}

function Emblem({ tag, name, size }: { tag?: string; name: string; size: number }) {
    const img = tag ? TEAM_TAGS[tag] : undefined;
    if (img) {
        return (
            <Image
                src={img as StaticImageData}
                alt={name}
                width={size}
                height={size}
                className="object-contain rounded-full shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-prototype text-muted-foreground shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
            {getInitials(name)}
        </div>
    );
}

function TeamCard({
    entry,
    variant,
    rosterForcedOpen,
    blurred,
    pinned,
    onTogglePin,
}: {
    entry: TeamStreamEntry;
    variant: "podium-1" | "podium-2" | "podium-3" | "grid";
    rosterForcedOpen: boolean;
    blurred: boolean;
    pinned?: boolean;
    onTogglePin?: (teamId: string) => void;
}) {
    const [tapped, setTapped] = useState(false);
    const [hovered, setHovered] = useState(false);
    const canFlip = !blurred;
    const showRoster = canFlip && (rosterForcedOpen || tapped || hovered);

    const isFirst = variant === "podium-1";
    const isPodium = variant !== "grid";
    const height = isPodium ? (isFirst ? 236 : 210) : 190;
    const emblemSize = isFirst ? 72 : 56;
    const nameSize = isFirst ? "text-[15px]" : "text-[13px]";
    const ptsSize = isFirst ? "text-[28px]" : "text-[22px]";

    const toggle = () => { if (canFlip) setTapped((v) => !v); };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={showRoster}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={toggle}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
            }}
            className={`group/card relative rounded-xl border overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none ${
                pinned ? "border-[#e8743b] ring-1 ring-[#e8743b]/50" : isFirst ? "border-[#e8b400]" : "border-[#232229]"
            }`}
            style={{
                height,
                backgroundColor: isFirst ? "#1a1710" : "#141318",
            }}
        >
            {/* Pin button — own stopPropagation so it doesn't flip the card */}
            {onTogglePin && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTogglePin(entry.id); }}
                    onKeyDown={(e) => e.stopPropagation()}
                    title={pinned ? "Désépingler" : "Épingler"}
                    className={`absolute top-2 right-2 z-20 p-1 rounded-md transition-colors ${
                        pinned ? "text-[#e8743b]" : "text-muted-foreground/40 hover:text-[#e8743b] opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
                    }`}
                >
                    <Pin className="w-3.5 h-3.5" />
                </button>
            )}
            {/* Front face */}
            <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 transition-opacity duration-[180ms]"
                style={{ opacity: showRoster ? 0 : 1 }}
            >
                <span
                    className="absolute top-2 left-2 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold font-prototype"
                >
                    <span className={`w-full h-full rounded-full flex items-center justify-center ${rankBadgeClass(entry.rank)}`}>
                        {entry.rank}
                    </span>
                </span>
                <Emblem tag={entry.tag} name={entry.name} size={emblemSize} />
                <p className={`font-prototype font-medium text-center truncate max-w-full px-2 ${nameSize}`}>{entry.name}</p>
                <p className={`font-prototype font-medium text-[#e8743b] ${ptsSize}`}>
                    {entry.points ?? "—"}
                    {entry.points !== null && <span className="text-xs text-muted-foreground ml-1">pts</span>}
                </p>
            </div>

            {/* Roster face */}
            <div
                className="absolute inset-0 flex flex-col p-3 transition-opacity duration-[180ms]"
                style={{ opacity: showRoster ? 1 : 0 }}
            >
                {blurred ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground font-prototype">Roster masqué</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 pb-2 border-b border-white/10 shrink-0">
                            <Emblem tag={entry.tag} name={entry.name} size={24} />
                            <p className="font-prototype text-xs truncate flex-1">{entry.name}</p>
                            <span className="font-prototype text-xs text-[#e8743b] shrink-0">{entry.points ?? "—"}</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-center divide-y divide-white/5 overflow-hidden">
                            {entry.players.slice(0, 5).map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2 py-1">
                                    <span
                                        className={`font-prototype text-xs truncate flex-1 ${
                                            i === 0 && p.points !== null ? "text-[#e8b400]" : ""
                                        } ${p.dnf ? "line-through text-muted-foreground" : ""}`}
                                    >
                                        {p.name}
                                    </span>
                                    <span className="font-prototype text-xs text-[#e8743b] shrink-0">{p.points ?? "—"}</span>
                                </div>
                            ))}
                            {entry.players.length === 0 && (
                                <p className="text-[11px] text-muted-foreground font-prototype text-center">Aucun joueur assigné.</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export function TeamsStreamView({ teams, blurred, roundLabel, initialRostersOpen, streamMode, rotateSeconds, pinnedIds, onTogglePin }: Props) {
    const [rostersOpen, setRostersOpen] = useState(!!initialRostersOpen);
    const [page, setPage] = useState(0);

    const podium = teams.slice(0, 3);
    const rest = teams.slice(3);
    const pageSize = 6;
    const pages = useMemo(() => {
        if (!streamMode) return [rest];
        const chunks: TeamStreamEntry[][] = [];
        for (let i = 0; i < rest.length; i += pageSize) chunks.push(rest.slice(i, i + pageSize));
        return chunks.length > 0 ? chunks : [[]];
    }, [rest, streamMode]);

    useEffect(() => {
        if (!streamMode || !rotateSeconds || pages.length <= 1) return;
        const interval = setInterval(() => setPage((p) => (p + 1) % pages.length), rotateSeconds * 1000);
        return () => clearInterval(interval);
    }, [streamMode, rotateSeconds, pages.length]);

    const visibleRest = streamMode ? (pages[page] ?? []) : rest;

    // Podium visual order: 2nd, 1st, 3rd on desktop (reordered via `order-*`);
    // natural DOM order (1st, 2nd, 3rd) is kept for the mobile stack.
    const podiumVariant = (rank: number): "podium-1" | "podium-2" | "podium-3" =>
        rank === 1 ? "podium-1" : rank === 2 ? "podium-2" : "podium-3";
    const podiumOrderClass = (rank: number) =>
        rank === 1 ? "sm:order-2" : rank === 2 ? "sm:order-1" : "sm:order-3";

    return (
        <section>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-lg sm:text-xl font-prototype">Classement Équipes — Jour 1</h2>
                <button
                    type="button"
                    onClick={() => setRostersOpen((v) => !v)}
                    disabled={blurred}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-prototype transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        rostersOpen ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                >
                    {rostersOpen ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    Afficher les rosters
                </button>
            </div>

            {blurred && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground font-prototype mb-3">
                    <Lock className="w-3.5 h-3.5" /> Identités des équipes masquées en attente de publication.
                </p>
            )}

            {pinnedIds && pinnedIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {pinnedIds.map((id) => {
                        const entry = teams.find((t) => t.id === id);
                        if (!entry) return null;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onTogglePin?.(id)}
                                title="Désépingler"
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#e8743b]/15 border border-[#e8743b]/30 text-[#e8743b] text-[11px] font-prototype hover:bg-[#e8743b]/25 transition-colors"
                            >
                                <Pin className="w-3 h-3" />
                                {entry.name}
                                <X className="w-3 h-3 opacity-60" />
                            </button>
                        );
                    })}
                </div>
            )}

            {teams.length === 0 ? (
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-10 text-center">
                    <p className="text-muted-foreground font-prototype">Aucune équipe pour l&apos;instant.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {podium.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                            {podium.map((entry) => (
                                <div key={entry.id} className={`sm:flex-1 ${podiumOrderClass(entry.rank)}`}>
                                    <TeamCard entry={entry} variant={podiumVariant(entry.rank)} rosterForcedOpen={rostersOpen} blurred={blurred} pinned={pinnedIds?.includes(entry.id)} onTogglePin={onTogglePin} />
                                </div>
                            ))}
                        </div>
                    )}
                    {visibleRest.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {visibleRest.map((entry) => (
                                <TeamCard key={entry.id} entry={entry} variant="grid" rosterForcedOpen={rostersOpen} blurred={blurred} pinned={pinnedIds?.includes(entry.id)} onTogglePin={onTogglePin} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <p className="text-xs text-muted-foreground font-prototype mt-4">{roundLabel}</p>
        </section>
    );
}
