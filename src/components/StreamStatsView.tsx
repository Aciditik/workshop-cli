"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Participant, TableMatch } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import { matchScoreTotal, rankTablePlayers } from "@/lib/qualifier-rules";
import { canonicalCorporation, CORPORATION_PLACEHOLDER } from "@/lib/corporations";
import { CORPORATION_LOGOS } from "@/lib/corporation-logos";
import { Trophy } from "lucide-react";

interface Props {
    participants: Participant[];
    matches: TableMatch[]; // already suspense-scoped by the caller (hidden final round excluded)
    roundBoards?: Record<number, string>; // round number -> board, one board per round
}

const BOARD_COLORS: Record<string, string> = {
    "🟠 Tharsis": "#f59e0b",
    "🟢 Elysium": "#22c55e",
    "🔵 Hellas": "#3b82f6",
    "⚪ Vastitas Borealis": "#d1d5db",
    "🟤 Utopia Planitia": "#92400e",
    "🟣 Terra Cimmeria": "#a855f7",
};

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
    { label: "<50", min: -Infinity, max: 49 },
    { label: "50s", min: 50, max: 59 },
    { label: "60s", min: 60, max: 69 },
    { label: "70s", min: 70, max: 79 },
    { label: "80s", min: 80, max: 89 },
    { label: "90s", min: 90, max: 99 },
    { label: "100+", min: 100, max: Infinity },
];

type ColKey = "parties" | "winPct" | "avgPlace" | "avgScore" | "record" | "forets" | "villes" | "cartes";

const COLUMN_DEFS: { key: ColKey; label: string; lowerIsBetter?: boolean; format: (v: number) => string }[] = [
    { key: "parties", label: "Parties", format: (v) => String(v) },
    { key: "winPct", label: "% Victoire", format: (v) => `${Math.round(v)}%` },
    { key: "avgPlace", label: "Place moy.", lowerIsBetter: true, format: (v) => v.toFixed(2) },
    { key: "avgScore", label: "Moy.", format: (v) => Math.round(v).toString() },
    { key: "record", label: "Record", format: (v) => String(v) },
    { key: "forets", label: "Forêts", format: (v) => v.toFixed(1) },
    { key: "villes", label: "Villes", format: (v) => v.toFixed(1) },
    { key: "cartes", label: "Cartes", format: (v) => v.toFixed(1) },
];

const DEFAULT_COLUMNS: ColKey[] = ["parties", "winPct", "avgPlace", "avgScore", "record"];

function BarRow({ label, value, max, color, dotColor }: { label: string; value: number; max: number; color: string; dotColor?: string }) {
    return (
        <div className="flex items-center gap-3">
            {dotColor && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />}
            <span className="text-xs font-prototype text-muted-foreground w-36 shrink-0 truncate">{label}</span>
            <div className="flex-1 h-5 rounded-sm bg-white/5 overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
            </div>
            <span className="text-sm font-prototype tabular-nums w-10 text-right shrink-0">{value}</span>
        </div>
    );
}

export function StreamStatsView({ participants, matches, roundBoards }: Props) {
    const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLUMNS));
    const [search, setSearch] = useState("");
    const [minGames, setMinGames] = useState(5);
    const [boardFilter, setBoardFilter] = useState<string>("Tous");

    const toggleCol = (key: ColKey) =>
        setSelectedCols((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const completedMatches = useMemo(() => matches.filter((m) => m.isCompleted && m.scorecards), [matches]);

    // ─── KPI cards + charts ────────────────────────────────────────────────
    const { tablesValidated, scorecardCount, bestScore, bestScorePlayerName, boardCounts, corpCounts, scoreBuckets, perPlayer } = useMemo(() => {
        const participantById = new Map(participants.map((p) => [p.id, p]));
        const boardCounts = new Map<string, number>();
        const corpCounts = new Map<string, number>();
        const buckets = SCORE_BUCKETS.map((b) => ({ ...b, count: 0 }));
        let scorecardCount = 0;
        let bestScore = -Infinity;
        let bestScorePlayerName = "";

        interface Agg {
            id: string;
            games: number;
            totalScore: number;
            best: number;
            wins: number;
            placementSum: number;
            forets: number;
            villes: number;
            cartes: number;
            boards: Set<string>;
        }
        const aggByPlayer = new Map<string, Agg>();
        const getAgg = (id: string): Agg => {
            let a = aggByPlayer.get(id);
            if (!a) {
                a = { id, games: 0, totalScore: 0, best: -Infinity, wins: 0, placementSum: 0, forets: 0, villes: 0, cartes: 0, boards: new Set() };
                aggByPlayer.set(id, a);
            }
            return a;
        };

        for (const m of completedMatches) {
            const ranked = rankTablePlayers(m);
            const board = roundBoards?.[m.round];
            if (board) boardCounts.set(board, (boardCounts.get(board) || 0) + 1);
            for (const pid of m.participantIds) {
                if (!pid || !m.scorecards?.[pid]) continue;
                scorecardCount++;
                const total = matchScoreTotal(m, pid);
                if (total > bestScore) {
                    bestScore = total;
                    bestScorePlayerName = playerDisplayName(participantById.get(pid), false);
                }
                const bucket = buckets.find((b) => total >= b.min && total <= b.max);
                if (bucket) bucket.count++;

                const sc = m.scorecards[pid];
                const corp = sc.corporation ? canonicalCorporation(sc.corporation) : "";
                if (corp && corp !== CORPORATION_PLACEHOLDER && corp !== "Pas de corporation") {
                    corpCounts.set(corp, (corpCounts.get(corp) || 0) + 1);
                }

                const a = getAgg(pid);
                a.games++;
                a.totalScore += total;
                a.best = Math.max(a.best, total);
                a.placementSum += ranked.indexOf(pid) + 1;
                if (ranked[0] === pid) a.wins++;
                a.forets += sc.forets || 0;
                a.villes += sc.villes || 0;
                a.cartes += sc.cartes || 0;
                if (board) a.boards.add(board);
            }
        }

        const perPlayer = [...aggByPlayer.values()].map((a) => {
            const p = participantById.get(a.id);
            return {
                id: a.id,
                name: p ? playerDisplayName(p, false) : "?",
                games: a.games,
                parties: a.games,
                winPct: a.games > 0 ? (a.wins / a.games) * 100 : 0,
                avgPlace: a.games > 0 ? a.placementSum / a.games : 0,
                avgScore: a.games > 0 ? a.totalScore / a.games : 0,
                record: a.best === -Infinity ? 0 : a.best,
                forets: a.games > 0 ? a.forets / a.games : 0,
                villes: a.games > 0 ? a.villes / a.games : 0,
                cartes: a.games > 0 ? a.cartes / a.games : 0,
                boards: a.boards,
            };
        });

        return {
            tablesValidated: completedMatches.length,
            scorecardCount,
            bestScore: bestScore === -Infinity ? 0 : bestScore,
            bestScorePlayerName,
            boardCounts,
            corpCounts,
            scoreBuckets: buckets,
            perPlayer,
        };
    }, [completedMatches, participants, roundBoards]);

    const boardEntries = [...boardCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topBoard = boardEntries[0];
    const maxBoardCount = Math.max(1, ...boardEntries.map(([, c]) => c));
    const corpEntries = [...corpCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCorpBarCount = Math.max(1, ...corpEntries.map(([, c]) => c));
    const maxBucketCount = Math.max(1, ...scoreBuckets.map((b) => b.count));

    const topPlayersByWinPct = [...perPlayer]
        .filter((p) => p.games >= 5)
        .sort((a, b) => b.winPct - a.winPct || b.games - a.games)
        .slice(0, 3);

    // ─── Joueurs table ──────────────────────────────────────────────────
    const allBoards = [...new Set(perPlayer.flatMap((p) => [...p.boards]))].sort();
    const searchQuery = search.trim().toLowerCase();
    const filteredRows = perPlayer
        .filter((p) => p.games >= minGames)
        .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery))
        .filter((p) => boardFilter === "Tous" || p.boards.has(boardFilter))
        .sort((a, b) => b.winPct - a.winPct || b.games - a.games);

    const columnRanges = new Map<ColKey, { min: number; max: number }>();
    for (const col of COLUMN_DEFS) {
        if (col.key === "parties") continue;
        const values = filteredRows.map((r) => r[col.key] as number);
        columnRanges.set(col.key, { min: Math.min(...values, 0), max: Math.max(...values, 1) });
    }

    const heatStyle = (key: ColKey, value: number): React.CSSProperties => {
        const def = COLUMN_DEFS.find((c) => c.key === key);
        const range = columnRanges.get(key);
        if (!def || !range || range.max === range.min) return {};
        let ratio = (value - range.min) / (range.max - range.min);
        if (def.lowerIsBetter) ratio = 1 - ratio;
        ratio = Math.max(0, Math.min(1, ratio));
        return {
            backgroundColor: `rgba(232, 116, 59, ${0.1 + ratio * 0.55})`,
            color: ratio > 0.55 ? "#fff" : "#d4d4d4",
        };
    };

    return (
        <div className="space-y-6">
            <h2 className="text-lg sm:text-xl font-prototype">Aperçu</h2>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Tables validées</p>
                    <p className="text-[28px] leading-tight font-prototype mt-1">{tablesValidated}</p>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Scorecards</p>
                    <p className="text-[28px] leading-tight font-prototype mt-1">{scorecardCount}</p>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Meilleur score</p>
                    <p className="text-[28px] leading-tight font-prototype mt-1">{bestScore || "—"}</p>
                    {bestScorePlayerName && <p className="text-xs text-muted-foreground mt-1 truncate">{bestScorePlayerName}</p>}
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Plateau le plus joué</p>
                    <p className="text-lg leading-tight font-prototype mt-1 truncate">{topBoard ? topBoard[0] : "—"}</p>
                    {topBoard && <p className="text-xs text-muted-foreground mt-1">{topBoard[1]} tables</p>}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Parties par plateau</p>
                    {boardEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-prototype">Aucune donnée pour l&apos;instant.</p>
                    ) : boardEntries.map(([board, count]) => (
                        <BarRow key={board} label={board} value={count} max={maxBoardCount} color={BOARD_COLORS[board] || "#e8743b"} dotColor={BOARD_COLORS[board]} />
                    ))}
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Corporations jouées</p>
                    {corpEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-prototype">Aucune donnée pour l&apos;instant.</p>
                    ) : corpEntries.map(([corp, count]) => (
                        <div key={corp} className="flex items-center gap-3">
                            {CORPORATION_LOGOS[corp] && <Image src={CORPORATION_LOGOS[corp]} alt={corp} width={18} height={18} className="shrink-0" />}
                            <span className="text-xs font-prototype text-muted-foreground w-36 shrink-0 truncate">{corp}</span>
                            <div className="flex-1 h-5 rounded-sm bg-white/5 overflow-hidden">
                                <div className="h-full rounded-sm bg-[#e8743b]" style={{ width: `${(count / maxCorpBarCount) * 100}%` }} />
                            </div>
                            <span className="text-sm font-prototype tabular-nums w-10 text-right shrink-0">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Distribution des scores</p>
                    <div className="flex items-end gap-2 h-32">
                        {scoreBuckets.map((b) => (
                            <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                                <span className="text-xs font-prototype tabular-nums">{b.count || ""}</span>
                                <div
                                    className="w-full rounded-t-sm bg-[#e8743b]"
                                    style={{ height: `${maxBucketCount > 0 ? (b.count / maxBucketCount) * 100 : 0}%`, minHeight: b.count > 0 ? 4 : 0 }}
                                />
                                <span className="text-[10px] text-muted-foreground font-prototype">{b.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-2">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Top joueurs · % victoire (5+ parties)</p>
                    {topPlayersByWinPct.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-prototype">Pas encore assez de parties jouées.</p>
                    ) : topPlayersByWinPct.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 py-1.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-prototype shrink-0 ${
                                i === 0 ? "bg-[#e8b400] text-black" : i === 1 ? "bg-[#cfd6de] text-black" : "bg-[#e06a00] text-black"
                            }`}>
                                {i === 0 ? <Trophy className="w-3 h-3" /> : i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-prototype text-sm truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground font-prototype">{p.games} parties</p>
                            </div>
                            <span className="font-prototype text-base text-[#e8743b] shrink-0">{Math.round(p.winPct)}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Joueurs table */}
            <div className="space-y-3">
                <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Joueurs · colonnes au choix</p>

                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un joueur..."
                        className="h-9 rounded-md border border-input bg-card/60 px-3 text-xs font-prototype placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
                    />
                    <select
                        value={minGames}
                        onChange={(e) => setMinGames(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-card/60 px-2 text-xs font-prototype focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {[1, 3, 5, 10, 15].map((n) => <option key={n} value={n}>Parties min : {n}</option>)}
                    </select>
                    {allBoards.length > 0 && (
                        <select
                            value={boardFilter}
                            onChange={(e) => setBoardFilter(e.target.value)}
                            className="h-9 rounded-md border border-input bg-card/60 px-2 text-xs font-prototype focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="Tous">Plateau : Tous</option>
                            {allBoards.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {COLUMN_DEFS.map((col) => (
                        <button
                            key={col.key}
                            type="button"
                            onClick={() => toggleCol(col.key)}
                            className={`px-3 py-1.5 rounded-md text-xs font-prototype border transition-colors ${
                                selectedCols.has(col.key)
                                    ? "bg-[#e8743b] border-[#e8743b] text-black"
                                    : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                            }`}
                        >
                            {col.label}
                        </button>
                    ))}
                </div>

                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] overflow-x-auto">
                    <table className="w-full text-sm font-prototype border-collapse min-w-[560px]">
                        <thead>
                            <tr className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-3 py-3 text-left sticky left-0 bg-[#16151a] z-10">Joueur</th>
                                {COLUMN_DEFS.filter((c) => selectedCols.has(c.key)).map((c) => (
                                    <th key={c.key} className="px-3 py-3 text-center">{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={1 + selectedCols.size} className="px-3 py-8 text-center text-muted-foreground">Aucun joueur ne correspond aux filtres.</td></tr>
                            )}
                            {filteredRows.map((r) => (
                                <tr key={r.id} className="border-t border-white/5 h-12">
                                    <td className="px-3 py-2 sticky left-0 bg-[#16151a] z-10 min-w-[160px]">
                                        <span className="truncate">{r.name}</span>
                                    </td>
                                    {COLUMN_DEFS.filter((c) => selectedCols.has(c.key)).map((c) => (
                                        <td key={c.key} className="px-3 py-2 text-center tabular-nums">
                                            {c.key === "parties" ? (
                                                r.parties
                                            ) : (
                                                <span className="inline-block px-2.5 py-1 rounded-md min-w-[48px]" style={heatStyle(c.key, r[c.key])}>
                                                    {c.format(r[c.key])}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-prototype">
                    <span>Moins bon</span>
                    <span className="inline-block w-20 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgba(232,116,59,0.1), rgba(232,116,59,0.65))" }} />
                    <span>Meilleur (Place moy. : plus bas = meilleur)</span>
                </div>
            </div>
        </div>
    );
}
