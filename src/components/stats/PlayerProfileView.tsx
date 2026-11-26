"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ArrowLeft, Medal } from "lucide-react";
import { CORPORATION_LOGOS } from "@/lib/corporation-logos";
import { CORPORATION_PLACEHOLDER } from "@/lib/corporations";
import { BOARD_COLORS, type OverviewEntry } from "./OverviewStats";

// Circuit-wide per-player aggregate — the same shape `perPlayer` already
// computes in OverviewStats, reused here for the average-comparison bars,
// radar chart, and similar-players ranking.
export interface CircuitPlayerAgg {
    id: string;
    name: string;
    games: number;
    winPct: number;
    avgPlace: number;
    avgScore: number;
    record: number;
}

interface Props {
    entries: OverviewEntry[]; // this player's full history, unfiltered by board
    circuit: CircuitPlayerAgg[]; // every player, scoped the same way as the rest of the page
    playerId: string;
    onBack: () => void;
}

const DONUT_COLORS = ["#e8743b", "#3b82f6", "#22c55e", "#e8b400", "#a855f7", "#64748b", "#ec4899", "#14b8a6"];

const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const rankBadgeColor = (rank: number) =>
    rank === 1 ? "#e8b400" : rank === 2 ? "#cfd6de" : rank === 3 ? "#e06a00" : "#e8743b";

function average(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

// Gradient track (red -> yellow -> green) with a solid marker for the player
// and a dotted ghost marker for the circuit average.
function CompareBar({
    label,
    value,
    average: avg,
    min,
    max,
    format,
    lowerIsBetter,
}: {
    label: string;
    value: number;
    average: number;
    min: number;
    max: number;
    format: (v: number) => string;
    lowerIsBetter?: boolean;
}) {
    const clamp = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
    const valuePct = clamp(value);
    const avgPct = clamp(avg);
    const gradient = lowerIsBetter
        ? "linear-gradient(to right, #22c55e, #eab308, #ef4444)"
        : "linear-gradient(to right, #ef4444, #eab308, #22c55e)";
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-prototype text-muted-foreground">{label}</span>
                <span className="text-sm font-prototype">{format(value)}</span>
            </div>
            <div className="relative h-2 rounded-full" style={{ background: gradient }}>
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-4 border-l border-dashed border-white/70"
                    style={{ left: `${avgPct}%` }}
                    title={`Moyenne circuit : ${format(avg)}`}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-black shadow"
                    style={{ left: `${valuePct}%` }}
                />
            </div>
        </div>
    );
}

// Minimal hand-rolled radar chart (no charting lib in this project) — N axes
// evenly spaced around a circle, two overlaid polygons (player vs average).
function RadarChart({ axes, player, avg }: { axes: string[]; player: number[]; avg: number[] }) {
    const size = 220;
    const center = size / 2;
    const radius = size / 2 - 28;
    const angleFor = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const pointFor = (i: number, ratio: number) => {
        const r = radius * Math.max(0, Math.min(1, ratio));
        return [center + r * Math.cos(angleFor(i)), center + r * Math.sin(angleFor(i))] as const;
    };
    const polygon = (values: number[]) =>
        values.map((v, i) => pointFor(i, v / 100).join(",")).join(" ");
    const rings = [0.25, 0.5, 0.75, 1];

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px] mx-auto">
            {rings.map((r) => (
                <polygon
                    key={r}
                    points={axes.map((_, i) => pointFor(i, r).join(",")).join(" ")}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                />
            ))}
            {axes.map((_, i) => {
                const [x, y] = pointFor(i, 1);
                return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
            })}
            <polygon points={polygon(avg)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeDasharray="4 3" />
            <polygon points={polygon(player)} fill="rgba(232,116,59,0.25)" stroke="#e8743b" strokeWidth={2} />
            {axes.map((label, i) => {
                const [x, y] = pointFor(i, 1.22);
                return (
                    <text
                        key={label}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-muted-foreground"
                        style={{ fontSize: 9, fontFamily: "var(--font-prototype, inherit)" }}
                    >
                        {label}
                    </text>
                );
            })}
        </svg>
    );
}

// Pie wheel with each wedge filled by the corporation's own logo image
// (clipped to the slice, like a champion/hero-pick wheel) instead of a flat
// color — label text only lives in the legend next to it.
function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

function CorpWheel({ segments }: { segments: { label: string; value: number; color: string; logo?: string }[] }) {
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    const size = 112;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    const wedges = segments.reduce<{ acc: number; items: (typeof segments[number] & { path: string })[] }>(
        (state, s) => {
            const startAngle = (state.acc / total) * 360;
            const acc = state.acc + s.value;
            const endAngle = (acc / total) * 360;
            const large = endAngle - startAngle > 180 ? 1 : 0;
            const [x1, y1] = polarPoint(cx, cy, r, startAngle);
            const [x2, y2] = polarPoint(cx, cy, r, endAngle);
            const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
            return { acc, items: [...state.items, { ...s, path }] };
        },
        { acc: 0, items: [] }
    ).items;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
                {wedges.map((w, i) => (
                    <g key={i}>
                        <clipPath id={`corp-wedge-${i}`}>
                            <path d={w.path} />
                        </clipPath>
                        {w.logo ? (
                            <image
                                href={w.logo}
                                x={0}
                                y={0}
                                width={size}
                                height={size}
                                preserveAspectRatio="xMidYMid slice"
                                clipPath={`url(#corp-wedge-${i})`}
                            />
                        ) : (
                            <path d={w.path} fill={w.color} />
                        )}
                        <path d={w.path} fill="none" stroke="#16151a" strokeWidth={2} />
                    </g>
                ))}
            </svg>
            <div className="absolute inset-[22px] rounded-full bg-[#16151a] flex flex-col items-center justify-center">
                <span className="text-xl font-prototype leading-none">{segments.length}</span>
                <span className="text-[9px] font-prototype uppercase tracking-wider text-muted-foreground mt-0.5">corpos</span>
            </div>
        </div>
    );
}

export function PlayerProfileView({ entries, circuit, playerId, onBack }: Props) {
    const games = useMemo(() => {
        return entries
            .map((e, idx) => ({ e, idx }))
            .filter(({ e }) => e.playerId === playerId)
            .sort((a, b) => {
                const key = (x: typeof a) => x.e.round ?? (x.e.eventDate ? Date.parse(x.e.eventDate) : x.idx);
                return key(a) - key(b);
            })
            .map(({ e }) => e);
    }, [entries, playerId]);

    const stats = useMemo(() => {
        if (games.length === 0) return null;
        let totalScore = 0, best = -Infinity, wins = 0, placementSum = 0, objSum = 0, objCount = 0;
        const corpCounts = new Map<string, number>();
        const corpWins = new Map<string, number>();
        const boardCounts = new Map<string, number>();
        for (const e of games) {
            totalScore += e.totalScore;
            best = Math.max(best, e.totalScore);
            placementSum += e.rank;
            if (e.rank === 1) wins++;
            if (typeof e.objectifs === "number") { objSum += e.objectifs; objCount++; }
            if (e.corporation && e.corporation !== CORPORATION_PLACEHOLDER && e.corporation !== "Pas de corporation") {
                corpCounts.set(e.corporation, (corpCounts.get(e.corporation) || 0) + 1);
                if (e.rank === 1) corpWins.set(e.corporation, (corpWins.get(e.corporation) || 0) + 1);
            }
            if (e.board) boardCounts.set(e.board, (boardCounts.get(e.board) || 0) + 1);
        }
        const n = games.length;
        const avgScore = totalScore / n;
        const variance = average(games.map((e) => (e.totalScore - avgScore) ** 2));
        const stdev = Math.sqrt(variance);
        return {
            name: games[0].playerName,
            games: n,
            record: best,
            avgScore,
            avgPlace: placementSum / n,
            winPct: (wins / n) * 100,
            avgObjectifs: objCount > 0 ? objSum / objCount : null,
            stdev,
            corpEntries: [...corpCounts.entries()].sort((a, b) => b[1] - a[1]),
            corpWins,
            boardEntries: [...boardCounts.entries()].sort((a, b) => b[1] - a[1]),
        };
    }, [games]);

    const circuitAverages = useMemo(() => {
        const withGames = circuit.filter((p) => p.games > 0);
        return {
            avgScore: average(withGames.map((p) => p.avgScore)),
            record: average(withGames.map((p) => p.record)),
            winPct: average(withGames.map((p) => p.winPct)),
            avgPlace: average(withGames.map((p) => p.avgPlace)),
            maxRecord: Math.max(1, ...withGames.map((p) => p.record)),
            maxAvgScore: Math.max(1, ...withGames.map((p) => p.avgScore)),
            maxPlace: Math.max(2, ...withGames.map((p) => p.avgPlace)),
        };
    }, [circuit]);

    const similarPlayers = useMemo(() => {
        if (!stats) return [];
        const pool = circuit.filter((p) => p.id !== playerId && p.games >= 3);
        if (pool.length === 0) return [];
        const ranges = {
            avgScore: Math.max(1, circuitAverages.maxAvgScore),
            winPct: 100,
            avgPlace: Math.max(1, circuitAverages.maxPlace - 1),
            record: Math.max(1, circuitAverages.maxRecord),
        };
        const vec = (p: { avgScore: number; winPct: number; avgPlace: number; record: number }) => [
            p.avgScore / ranges.avgScore,
            p.winPct / ranges.winPct,
            1 - (p.avgPlace - 1) / ranges.avgPlace,
            p.record / ranges.record,
        ];
        const mine = vec(stats);
        return pool
            .map((p) => {
                const theirs = vec(p);
                const dist = Math.sqrt(mine.reduce((sum, v, i) => sum + (v - theirs[i]) ** 2, 0));
                const maxDist = Math.sqrt(mine.length);
                return { ...p, similarity: Math.max(0, 100 - (dist / maxDist) * 100) };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3);
    }, [circuit, circuitAverages, playerId, stats]);

    if (!stats) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-prototype text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Retour aux statistiques
                </button>
                <p className="text-sm text-muted-foreground font-prototype">Aucune donnée pour ce joueur.</p>
            </div>
        );
    }

    const maxGameScore = Math.max(1, ...games.map((e) => e.totalScore));

    const radarAxes = ["Score moy.", "Record", "% victoire", "Place moy.", "Régularité"];
    const regularityScore = stats.avgScore > 0 ? Math.max(0, 100 - (stats.stdev / stats.avgScore) * 100) : 0;
    const placeToScore = (p: number) => Math.max(0, Math.min(100, (1 - (p - 1) / Math.max(1, circuitAverages.maxPlace - 1)) * 100));
    const radarPlayer = [
        Math.min(100, (stats.avgScore / circuitAverages.maxAvgScore) * 100),
        Math.min(100, (stats.record / circuitAverages.maxRecord) * 100),
        stats.winPct,
        placeToScore(stats.avgPlace),
        regularityScore,
    ];
    const radarAvg = [
        Math.min(100, (circuitAverages.avgScore / circuitAverages.maxAvgScore) * 100),
        Math.min(100, (circuitAverages.record / circuitAverages.maxRecord) * 100),
        circuitAverages.winPct,
        placeToScore(circuitAverages.avgPlace),
        50,
    ];

    const donutSegments = stats.corpEntries.map(([corp, count], i) => ({
        label: corp,
        value: count,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
        logo: CORPORATION_LOGOS[corp]?.src,
    }));

    return (
        <div className="space-y-5">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-prototype text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour aux statistiques
            </button>

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#e8743b]/15 border border-[#e8743b]/40 flex items-center justify-center text-xl font-prototype text-[#e8743b] shrink-0">
                    {initials(stats.name)}
                </div>
                <div>
                    <h2 className="text-2xl font-prototype leading-tight">{stats.name}</h2>
                    <p className="text-sm text-muted-foreground font-prototype mt-0.5">
                        {stats.games} partie{stats.games > 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Record</p>
                    <p className="text-2xl font-prototype mt-1">{stats.record}</p>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Moyenne</p>
                    <p className="text-2xl font-prototype mt-1">{Math.round(stats.avgScore)}</p>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Place moy.</p>
                    <p className="text-2xl font-prototype mt-1">{stats.avgPlace.toFixed(2)}</p>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">% Victoire</p>
                    <p className="text-2xl font-prototype mt-1 text-[#e8743b]">{Math.round(stats.winPct)}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Circuit average compare */}
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Comparaison à la moyenne du circuit</p>
                    <CompareBar label="Record" value={stats.record} average={circuitAverages.record} min={0} max={circuitAverages.maxRecord * 1.05} format={(v) => Math.round(v).toString()} />
                    <CompareBar label="Score moyen" value={stats.avgScore} average={circuitAverages.avgScore} min={0} max={circuitAverages.maxAvgScore * 1.05} format={(v) => Math.round(v).toString()} />
                    <CompareBar label="% Victoire" value={stats.winPct} average={circuitAverages.winPct} min={0} max={100} format={(v) => `${Math.round(v)}%`} />
                    <CompareBar label="Place moyenne" value={stats.avgPlace} average={circuitAverages.avgPlace} min={1} max={circuitAverages.maxPlace} format={(v) => v.toFixed(2)} lowerIsBetter />
                    <p className="text-[10px] text-muted-foreground font-prototype">Rond blanc : le joueur · pointillé : moyenne du circuit.</p>
                </div>

                {/* Radar + similar players */}
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Profil vs moyenne du circuit</p>
                    <RadarChart axes={radarAxes} player={radarPlayer} avg={radarAvg} />
                    {similarPlayers.length > 0 && (
                        <div className="pt-2 space-y-2 border-t border-white/5">
                            <p className="text-[10px] font-prototype uppercase tracking-wider text-muted-foreground">Joueurs similaires</p>
                            {similarPlayers.map((p) => (
                                <div key={p.id} className="flex items-center gap-3">
                                    <span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-prototype shrink-0">{initials(p.name)}</span>
                                    <span className="text-xs font-prototype flex-1 truncate">{p.name}</span>
                                    <span className="text-xs font-prototype text-[#e8743b]">{Math.round(p.similarity)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Performance chart */}
            <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Performance — parties dans l&apos;ordre</p>
                <div className="flex items-end gap-1.5 h-32 overflow-x-auto">
                    {games.map((g, i) => (
                        <div key={i} className="flex flex-col items-center justify-end gap-1 h-full shrink-0 w-8" title={`${g.totalScore} pts · ${g.corporation || "?"} · rang ${g.rank}`}>
                            <span className="text-[10px] font-prototype tabular-nums">{g.totalScore}</span>
                            <div
                                className="w-full rounded-t-sm"
                                style={{ height: `${(g.totalScore / maxGameScore) * 100}%`, minHeight: 4, backgroundColor: rankBadgeColor(g.rank) }}
                            />
                            <Medal className="w-3.5 h-3.5" style={{ color: rankBadgeColor(g.rank) }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Corporation donut + board tags */}
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Corporations jouées</p>
                    {stats.corpEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-prototype">Aucune donnée.</p>
                    ) : (
                        <div className="flex items-start gap-4">
                            <CorpWheel segments={donutSegments} />
                            <div className="flex-1 min-w-0 space-y-2">
                                {stats.corpEntries.map(([corp, count]) => {
                                    const wins = stats.corpWins.get(corp) || 0;
                                    const winPct = count > 0 ? Math.round((wins / count) * 100) : 0;
                                    return (
                                        <div key={corp} className="flex items-center gap-2.5">
                                            {CORPORATION_LOGOS[corp] ? (
                                                <Image src={CORPORATION_LOGOS[corp]} alt="" width={22} height={22} className="shrink-0 rounded-full object-cover" />
                                            ) : (
                                                <span className="w-[22px] h-[22px] rounded-full bg-white/10 shrink-0" />
                                            )}
                                            <span className="text-xs font-prototype text-muted-foreground flex-1 truncate">{corp}</span>
                                            <span className={`text-xs font-prototype tabular-nums shrink-0 ${winPct >= 50 ? "text-emerald-400" : "text-muted-foreground"}`}>
                                                {winPct}%
                                            </span>
                                            <span className="text-sm font-prototype tabular-nums shrink-0 w-6 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {stats.boardEntries.length > 0 && (
                        <div className="pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                            {stats.boardEntries.map(([board, count]) => (
                                <span key={board} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-[11px] font-prototype">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BOARD_COLORS[board] || "#e8743b" }} />
                                    {board} · {count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent games */}
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-2.5">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Parties récentes</p>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {[...games].reverse().map((g, i) => (
                            <div key={i} className="flex items-center gap-2.5 py-1.5 border-t border-white/5 first:border-t-0">
                                <span
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-prototype shrink-0 text-black"
                                    style={{ backgroundColor: rankBadgeColor(g.rank) }}
                                >
                                    {g.rank}
                                </span>
                                {CORPORATION_LOGOS[g.corporation] && (
                                    <Image src={CORPORATION_LOGOS[g.corporation]} alt={g.corporation} width={16} height={16} className="shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-prototype truncate">
                                        {g.tournamentName || (g.round ? `Ronde ${g.round}` : "Partie")}
                                        {g.tournamentName && g.round ? ` · Ronde ${g.round}` : ""}
                                    </p>
                                    {g.board && <p className="text-[10px] text-muted-foreground font-prototype truncate">{g.board}</p>}
                                </div>
                                <span className="text-sm font-prototype tabular-nums text-[#e8743b] shrink-0">{g.totalScore}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
