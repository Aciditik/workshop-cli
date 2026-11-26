"use client";

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import { CORPORATION_LOGOS } from "@/lib/corporation-logos";
import { CORPORATION_PLACEHOLDER } from "@/lib/corporations";
import { Trophy, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { CorpCompare } from "./CorpCompare";
import { PlayerProfileView } from "./PlayerProfileView";

// A single flattened scorecard row — the common shape both the single-
// tournament streamer view and the cross-tournament /stats page reduce their
// data down to, so this overview + heatmap table only needs to be built once.
export interface OverviewEntry {
    playerId: string; // stable grouping key (name-based across tournaments, or participantId within one)
    playerName: string;
    totalScore: number;
    rank: number; // table placement, 1 = won the table
    corporation: string;
    nt?: number;
    objectifs?: number;
    recompenses?: number;
    forets: number;
    villes: number;
    cartes: number;
    matchId: string; // unique per table — used to count distinct tables, not scorecards
    board?: string;
    round?: number; // within-tournament round number, used to order a player's recent games
    tournamentName?: string;
    eventDate?: string;
}

export const BOARD_COLORS: Record<string, string> = {
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
    { key: "record", label: "Record", format: (v) => String(v) },
    { key: "winPct", label: "% Victoire", format: (v) => `${Math.round(v)}%` },
    { key: "avgPlace", label: "Place moy.", lowerIsBetter: true, format: (v) => v.toFixed(2) },
    { key: "avgScore", label: "Moy.", format: (v) => Math.round(v).toString() },
    { key: "forets", label: "Forêts", format: (v) => v.toFixed(1) },
    { key: "villes", label: "Villes", format: (v) => v.toFixed(1) },
    { key: "cartes", label: "Cartes", format: (v) => v.toFixed(1) },
];

const DEFAULT_COLUMNS: ColKey[] = ["parties", "record", "winPct", "avgPlace", "avgScore"];
// Clicking a column for the first time starts it sorted in whichever
// direction shows the "best" players first (lower is better for Place moy.).
const defaultSortDir = (key: ColKey): "asc" | "desc" =>
    COLUMN_DEFS.find((c) => c.key === key)?.lowerIsBetter ? "asc" : "desc";

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

export const OverviewStats = memo(function OverviewStats({
    entries,
    playerId,
    onPlayerChange,
}: {
    entries: OverviewEntry[];
    // Optional controlled player selection — lets a parent page (e.g. /stats)
    // sync the open profile to a URL query param for a real, shareable "page".
    // Uncontrolled (internal state) when omitted, e.g. the streamer tab.
    playerId?: string | null;
    onPlayerChange?: (id: string | null) => void;
}) {
    const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLUMNS));
    const [search, setSearch] = useState("");
    const [minGames, setMinGames] = useState(1);
    const [boardFilter, setBoardFilter] = useState<string>("Tous");
    const [internalPlayerId, setInternalPlayerId] = useState<string | null>(null);
    const selectedPlayerId = playerId !== undefined ? playerId : internalPlayerId;
    const setSelectedPlayerId = (id: string | null) => {
        if (onPlayerChange) onPlayerChange(id);
        else setInternalPlayerId(id);
    };
    const [showAllSmallCard, setShowAllSmallCard] = useState(false);
    // Which dataset fills the big "colonnes au choix" table — the small
    // bar card automatically shows the other one.
    const [mainTableMode, setMainTableMode] = useState<"corps" | "players">("corps");
    const smallCardMode = mainTableMode === "corps" ? "players" : "corps";
    // Classement order: best single-game score first by default; clicking a
    // column header sorts by it, toggling asc/desc on repeated clicks.
    const [sortCol, setSortCol] = useState<ColKey>("record");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const handleSort = (key: ColKey) => {
        if (key === sortCol) {
            setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        } else {
            setSortCol(key);
            setSortDir(defaultSortDir(key));
        }
    };

    const toggleCol = (key: ColKey) =>
        setSelectedCols((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    // Global KPIs/charts — always computed over every entry, independent of
    // the Corporations table's board filter below.
    const { tablesValidated, scorecardCount, bestScore, bestScorePlayerName, boardCounts, scoreBuckets, allBoards } = useMemo(() => {
        const boardCounts = new Map<string, number>();
        const seenMatchIds = new Set<string>();
        const matchBoardSeen = new Set<string>();
        const buckets = SCORE_BUCKETS.map((b) => ({ ...b, count: 0 }));
        const boards = new Set<string>();
        let bestScore = -Infinity;
        let bestScorePlayerName = "";

        for (const e of entries) {
            seenMatchIds.add(e.matchId);
            if (e.board) {
                boards.add(e.board);
                if (!matchBoardSeen.has(e.matchId)) {
                    matchBoardSeen.add(e.matchId);
                    boardCounts.set(e.board, (boardCounts.get(e.board) || 0) + 1);
                }
            }
            if (e.totalScore > bestScore) {
                bestScore = e.totalScore;
                bestScorePlayerName = e.playerName;
            }
            const bucket = buckets.find((b) => e.totalScore >= b.min && e.totalScore <= b.max);
            if (bucket) bucket.count++;
        }

        return {
            tablesValidated: seenMatchIds.size,
            scorecardCount: entries.length,
            bestScore: bestScore === -Infinity ? 0 : bestScore,
            bestScorePlayerName,
            boardCounts,
            scoreBuckets: buckets,
            allBoards: [...boards].sort(),
        };
    }, [entries]);

    // Entries scoped to the selected board — shared by the per-player /
    // per-corporation aggregates and the corporation comparator below, so
    // switching "Plateau" recomputes numbers from only games on that board
    // instead of just hiding rows that never played it.
    const scopedEntries = useMemo(
        () => (boardFilter === "Tous" ? entries : entries.filter((e) => e.board === boardFilter)),
        [entries, boardFilter]
    );

    // Per-player stats (small "Joueurs les plus actifs" card, the "Top
    // joueurs" podium, and the player detail drawer) and per-corporation
    // stats (the main "Corporations" table).
    const perPlayer = useMemo(() => {
        const scoped = scopedEntries;

        interface Agg {
            id: string;
            name: string;
            games: number;
            totalScore: number;
            best: number;
            wins: number;
            placementSum: number;
            forets: number;
            villes: number;
            cartes: number;
        }
        const aggByKey = new Map<string, Agg>();
        const getAgg = (id: string, name: string): Agg => {
            let a = aggByKey.get(id);
            if (!a) {
                a = { id, name, games: 0, totalScore: 0, best: -Infinity, wins: 0, placementSum: 0, forets: 0, villes: 0, cartes: 0 };
                aggByKey.set(id, a);
            }
            return a;
        };

        for (const e of scoped) {
            const a = getAgg(e.playerId, e.playerName);
            a.games++;
            a.totalScore += e.totalScore;
            a.best = Math.max(a.best, e.totalScore);
            a.placementSum += e.rank;
            if (e.rank === 1) a.wins++;
            a.forets += e.forets || 0;
            a.villes += e.villes || 0;
            a.cartes += e.cartes || 0;
        }

        return [...aggByKey.values()].map((a) => ({
            id: a.id,
            name: a.name,
            games: a.games,
            parties: a.games,
            winPct: a.games > 0 ? (a.wins / a.games) * 100 : 0,
            avgPlace: a.games > 0 ? a.placementSum / a.games : 0,
            avgScore: a.games > 0 ? a.totalScore / a.games : 0,
            record: a.best === -Infinity ? 0 : a.best,
            forets: a.games > 0 ? a.forets / a.games : 0,
            villes: a.games > 0 ? a.villes / a.games : 0,
            cartes: a.games > 0 ? a.cartes / a.games : 0,
        }));
    }, [scopedEntries]);

    const perCorp = useMemo(() => {
        const scoped = scopedEntries
            .filter((e) => e.corporation && e.corporation !== CORPORATION_PLACEHOLDER && e.corporation !== "Pas de corporation");

        interface Agg {
            id: string;
            name: string;
            games: number;
            totalScore: number;
            best: number;
            wins: number;
            placementSum: number;
            forets: number;
            villes: number;
            cartes: number;
        }
        const aggByKey = new Map<string, Agg>();
        const getAgg = (id: string, name: string): Agg => {
            let a = aggByKey.get(id);
            if (!a) {
                a = { id, name, games: 0, totalScore: 0, best: -Infinity, wins: 0, placementSum: 0, forets: 0, villes: 0, cartes: 0 };
                aggByKey.set(id, a);
            }
            return a;
        };

        for (const e of scoped) {
            const a = getAgg(e.corporation, e.corporation);
            a.games++;
            a.totalScore += e.totalScore;
            a.best = Math.max(a.best, e.totalScore);
            a.placementSum += e.rank;
            if (e.rank === 1) a.wins++;
            a.forets += e.forets || 0;
            a.villes += e.villes || 0;
            a.cartes += e.cartes || 0;
        }

        return [...aggByKey.values()].map((a) => ({
            id: a.id,
            name: a.name,
            games: a.games,
            parties: a.games,
            winPct: a.games > 0 ? (a.wins / a.games) * 100 : 0,
            avgPlace: a.games > 0 ? a.placementSum / a.games : 0,
            avgScore: a.games > 0 ? a.totalScore / a.games : 0,
            record: a.best === -Infinity ? 0 : a.best,
            forets: a.games > 0 ? a.forets / a.games : 0,
            villes: a.games > 0 ? a.villes / a.games : 0,
            cartes: a.games > 0 ? a.cartes / a.games : 0,
        }));
    }, [scopedEntries]);

    const boardEntries = [...boardCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topBoard = boardEntries[0];
    const maxBoardCount = Math.max(1, ...boardEntries.map(([, c]) => c));
    const maxBucketCount = Math.max(1, ...scoreBuckets.map((b) => b.count));

    const topPlayersByWinPct = [...perPlayer]
        .filter((p) => p.games >= 5)
        .sort((a, b) => b.winPct - a.winPct || b.games - a.games)
        .slice(0, 3);

    // Small card — toggleable between "Joueurs les plus actifs" and
    // "Corporations jouées", both top-5-then-expand bar lists by games.
    const allCardRows = smallCardMode === "players"
        ? [...perPlayer].sort((a, b) => b.games - a.games)
        : [...perCorp].sort((a, b) => b.games - a.games);
    const cardRowsShown = showAllSmallCard ? allCardRows : allCardRows.slice(0, 5);
    const maxCardRowGames = Math.max(1, ...cardRowsShown.map((r) => r.games));

    // ─── Main table (Corporations or Joueurs, per the header toggle) ─────
    const tableRows = mainTableMode === "corps" ? perCorp : perPlayer;
    const searchQuery = search.trim().toLowerCase();
    const filteredRows = tableRows
        .filter((p) => p.games >= minGames)
        .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery))
        .sort((a, b) => {
            const diff = (a[sortCol] as number) - (b[sortCol] as number);
            return sortDir === "desc" ? -diff || b.games - a.games : diff || b.games - a.games;
        });

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

    // Selecting a player replaces the whole panel with a full profile page
    // (own "← Retour" back button) instead of the overview — `perPlayer` is
    // reused as the circuit-wide population for the average-comparison bars,
    // radar chart, and similar-players ranking.
    if (selectedPlayerId) {
        return (
            <PlayerProfileView
                entries={entries}
                circuit={perPlayer}
                playerId={selectedPlayerId}
                onBack={() => setSelectedPlayerId(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
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
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => allCardRows.length > 5 && setShowAllSmallCard((v) => !v)}
                            disabled={allCardRows.length <= 5}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left disabled:cursor-default"
                        >
                            <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground truncate">
                                {smallCardMode === "players" ? "Joueurs les plus actifs" : "Corporations jouées"}
                                {allCardRows.length > 5 && !showAllSmallCard ? ` (top 5 / ${allCardRows.length})` : ""}
                            </p>
                            {allCardRows.length > 5 && (
                                showAllSmallCard ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                        </button>
                    </div>
                    {cardRowsShown.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-prototype">Aucune donnée pour l&apos;instant.</p>
                    ) : (
                        <div className={showAllSmallCard ? "space-y-3 max-h-80 overflow-y-auto pr-1" : "space-y-3"}>
                            {cardRowsShown.map((r) => {
                                const inner = (
                                    <>
                                        {smallCardMode === "corps" && CORPORATION_LOGOS[r.name] && (
                                            <Image src={CORPORATION_LOGOS[r.name]} alt="" width={18} height={18} className="shrink-0" />
                                        )}
                                        <span className="text-xs font-prototype text-muted-foreground w-36 shrink-0 truncate group-hover:text-[#e8743b] transition-colors">{r.name}</span>
                                        <div className="flex-1 h-5 rounded-sm bg-white/5 overflow-hidden">
                                            <div className="h-full rounded-sm bg-[#e8743b]" style={{ width: `${(r.games / maxCardRowGames) * 100}%` }} />
                                        </div>
                                        <span className="text-sm font-prototype tabular-nums w-10 text-right shrink-0">{r.games}</span>
                                    </>
                                );
                                return smallCardMode === "players" ? (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setSelectedPlayerId(r.id)}
                                        className="flex items-center gap-3 w-full text-left group"
                                    >
                                        {inner}
                                    </button>
                                ) : (
                                    <div key={r.id} className="flex items-center gap-3">
                                        {inner}
                                    </div>
                                );
                            })}
                        </div>
                    )}
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

            {/* Main table — Corporations or Joueurs */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">
                        {mainTableMode === "corps" ? "Corporations" : "Joueurs"} · colonnes au choix
                    </p>
                    <div className="flex rounded-md border border-border overflow-hidden">
                        {([["players", "Joueurs"], ["corps", "Corporations"]] as const).map(([mode, label]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setMainTableMode(mode)}
                                className={`px-2.5 py-1 text-[10px] font-prototype transition-colors ${
                                    mainTableMode === mode
                                        ? "bg-[#e8743b] text-black"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={mainTableMode === "corps" ? "Rechercher une corporation..." : "Rechercher un joueur..."}
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
                                <th className="px-3 py-3 text-left sticky left-0 bg-[#16151a] z-10">{mainTableMode === "corps" ? "Corporation" : "Joueur"}</th>
                                {COLUMN_DEFS.filter((c) => selectedCols.has(c.key)).map((c) => {
                                    const active = sortCol === c.key;
                                    return (
                                        <th key={c.key} className="px-3 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleSort(c.key)}
                                                className={`inline-flex items-center gap-1 transition-colors ${active ? "text-[#e8743b]" : "hover:text-foreground"}`}
                                            >
                                                {c.label}
                                                {active ? (
                                                    sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                                ) : (
                                                    <ChevronsUpDown className="w-3 h-3 opacity-40" />
                                                )}
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={1 + selectedCols.size} className="px-3 py-8 text-center text-muted-foreground">{mainTableMode === "corps" ? "Aucune corporation" : "Aucun joueur"} ne correspond aux filtres.</td></tr>
                            )}
                            {filteredRows.map((r) => (
                                <tr key={r.id} className="border-t border-white/5 h-12">
                                    <td className="px-3 py-2 sticky left-0 bg-[#16151a] z-10 min-w-[160px]">
                                        <span className="flex items-center gap-2 truncate">
                                            {mainTableMode === "corps" && CORPORATION_LOGOS[r.name] && <Image src={CORPORATION_LOGOS[r.name]} alt="" width={18} height={18} className="shrink-0" />}
                                            {mainTableMode === "players" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedPlayerId(r.id)}
                                                    className="hover:text-[#e8743b] transition-colors truncate text-left"
                                                >
                                                    {r.name}
                                                </button>
                                            ) : r.name}
                                        </span>
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

            {/* Corporation comparator — logo picker, 2-3 corps side by side */}
            <CorpCompare entries={scopedEntries} />

        </div>
    );
});
