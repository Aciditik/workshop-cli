"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart3, Trophy, Users, ChevronUp, ChevronDown, ChevronsUpDown, Download, Search, X, Medal } from "lucide-react";
import { BarChart, HBarChart, Histogram, LineChart } from "@/components/stats/Charts";
import { CORPORATIONS, canonicalCorporation } from "@/lib/corporations";
import { CorpLabel } from "@/components/CorpLabel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  participantId: string;
  firstname: string;
  name: string;
  tournamentId: string;
  tournamentName: string;
  eventDate: string;
  matchId: string;
  rank: number;
  corporation: string;
  nt: number;
  objectifs: number;
  recompenses: number;
  forets: number;
  villes: number;
  cartes: number;
  megacredits: number;
  totalScore: number;
  isQualified: boolean;
};

type TournamentMeta = { id: string; name: string; eventDate: string; status?: string; ownerId: string; ownerName: string };

type StatsData = {
  entries: Entry[];
  tournaments: TournamentMeta[];
  corporations: string[];
  organizers: { id: string; name: string }[];
  totalMatches: number;
};

type SortMetric = "totalScore" | "nt" | "objectifs" | "recompenses" | "forets" | "villes" | "cartes";
type SortDir = "desc" | "asc";
type View = "leaderboard" | "players" | "corporations" | "charts" | "compare";

const CATEGORY_KEYS = ["nt", "objectifs", "recompenses", "forets", "villes", "cartes"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  nt: "NT",
  objectifs: "Objectifs",
  recompenses: "Récomp.",
  forets: "Forêts",
  villes: "Villes",
  cartes: "Cartes",
};


const ALL_CORPORATIONS = CORPORATIONS;

const MIN_GAMES_FOR_WINRATE = 3;

// ─── Fetch cache ──────────────────────────────────────────────────────────────
// Simple in-memory cache keyed by query string: revisiting a filter combination
// doesn't re-hit the API.
const statsCache = new Map<string, StatsData>();

function playerKey(e: { firstname: string; name: string }) {
  return `${e.firstname} ${e.name}`.trim().toLowerCase();
}

function fullName(e: { firstname: string; name: string }) {
  return [e.firstname, e.name].filter(Boolean).join(" ") || "Joueur inconnu";
}

function shortTournamentName(name: string, eventDate?: string): string {
  if (!name || !/\bqualif\w*/i.test(name)) return name;
  const suffix = name.split("-").slice(1).join("-").trim();
  const year = (eventDate ?? "").match(/\d{4}/)?.[0] ?? name.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!suffix || !year) return name;
  return `Q${year.slice(-2)} - ${suffix}`;
}

function exportCsv(entries: Entry[]) {
  const header = ["Joueur", "Tournoi", "Date", "Corporation", "Rang table", "NT", "Objectifs", "Récompenses", "Forêts", "Villes", "Cartes", "Total", "Qualifié"];
  const rows = entries.map((e) => [
    fullName(e), e.tournamentName, e.eventDate, e.corporation, e.rank,
    e.nt, e.objectifs, e.recompenses, e.forets, e.villes, e.cartes, e.totalScore,
    e.isQualified ? "Oui" : "Non",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cdf-stats-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const METRIC_LABELS: Record<SortMetric, string> = {
  totalScore: "Score total",
  nt: "NT",
  objectifs: "Objectifs",
  recompenses: "Récompenses",
  forets: "Forêts",
  villes: "Villes",
  cartes: "Cartes",
};

// ─── Small components ──────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-background border border-border rounded-md px-3 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-prototype transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {label}
      {active ? (
        dir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    2: "bg-slate-400/20 text-slate-300 border-slate-400/30",
    3: "bg-amber-700/20 text-amber-600 border-amber-700/30",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-prototype font-bold shrink-0 ${
        colors[rank] ?? "bg-muted/30 text-muted-foreground border-border"
      }`}
    >
      {rank}
    </span>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function LeaderboardView({
  entries,
  sortMetric,
  sortDir,
  onSort,
  onPlayerClick,
}: {
  entries: Entry[];
  sortMetric: SortMetric;
  sortDir: SortDir;
  onSort: (m: SortMetric) => void;
  onPlayerClick: (key: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  const metrics: SortMetric[] = ["totalScore", "nt", "objectifs", "recompenses", "forets", "villes", "cartes"];

  return (
    <div className="space-y-3">
      {/* Sort buttons */}
      <div className="flex flex-wrap gap-1.5">
        {metrics.map((m) => (
          <SortButton
            key={m}
            label={METRIC_LABELS[m]}
            active={sortMetric === m}
            dir={sortDir}
            onClick={() => onSort(m)}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const fullName = [entry.firstname, entry.name].filter(Boolean).join(" ") || "Joueur inconnu";
          return (
            <div
              key={`${entry.participantId}-${i}`}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
            >
              <RankBadge rank={i + 1} />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onPlayerClick(playerKey(entry))}
                  className={`font-prototype text-sm font-semibold truncate hover:text-primary hover:underline transition-colors text-left w-full ${entry.isQualified ? "text-yellow-400" : ""}`}
                >
                  {fullName}
                </button>
                <p className="text-xs text-muted-foreground font-prototype truncate flex items-center gap-1.5">
                  <CorpLabel name={entry.corporation} size={16} />
                  {entry.tournamentName ? ` · ${shortTournamentName(entry.tournamentName, entry.eventDate)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {sortMetric !== "totalScore" && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground font-prototype">{METRIC_LABELS[sortMetric]}</p>
                    <p className="font-prototype font-bold text-sm">{entry[sortMetric]}</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-prototype">Total</p>
                  <p className="font-prototype font-bold text-primary">{entry.totalScore}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type CorpStats = {
  corporation: string;
  count: number;
  wins: number;
  winRate: number;
  avgScore: number;
  bestScore: number;
  bestPlayer: string;
  avgByCategory: Record<CategoryKey, number>;
  avgRank: number;
  rankCounts: Record<number, number>;
};

type CorpSortMetric = "count" | "winRate" | "avgScore" | "bestScore" | "avgRank";

function computeCorpStats(entries: Entry[]): CorpStats[] {
  const map = new Map<string, {
    scores: number[];
    wins: number;
    bestScore: number;
    bestPlayer: string;
    cat: Record<CategoryKey, number>;
    rankSum: number;
    rankCounts: Record<number, number>;
  }>();
  for (const e of entries) {
    if (!e.corporation || e.corporation === "Pas de corporation") continue;
    let c = map.get(e.corporation);
    if (!c) {
      c = { scores: [], wins: 0, bestScore: 0, bestPlayer: "", cat: { nt: 0, objectifs: 0, recompenses: 0, forets: 0, villes: 0, cartes: 0 }, rankSum: 0, rankCounts: {} };
      map.set(e.corporation, c);
    }
    c.scores.push(e.totalScore);
    if (e.rank === 1) c.wins++;
    c.rankSum += e.rank;
    c.rankCounts[e.rank] = (c.rankCounts[e.rank] || 0) + 1;
    for (const k of CATEGORY_KEYS) c.cat[k] += e[k];
    if (e.totalScore > c.bestScore) {
      c.bestScore = e.totalScore;
      c.bestPlayer = fullName(e);
    }
  }
  return Array.from(map.entries())
    .map(([corporation, c]) => ({
      corporation,
      count: c.scores.length,
      wins: c.wins,
      winRate: Math.round((c.wins / c.scores.length) * 100),
      avgScore: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
      bestScore: c.bestScore,
      bestPlayer: c.bestPlayer,
      avgByCategory: Object.fromEntries(
        CATEGORY_KEYS.map((k) => [k, Math.round((c.cat[k] / c.scores.length) * 10) / 10])
      ) as Record<CategoryKey, number>,
      avgRank: Math.round((c.rankSum / c.scores.length) * 100) / 100,
      rankCounts: c.rankCounts,
    }))
    .sort((a, b) => b.count - a.count);
}

const CORP_SORT_LABELS: Record<CorpSortMetric, string> = {
  count: "Parties",
  winRate: "% Victoire",
  avgScore: "Score moyen",
  bestScore: "Meilleur score",
  avgRank: "Place moyenne",
};

// Lower is better for avgRank; higher is better for everything else.
function sortCorpStats(rows: CorpStats[], metric: CorpSortMetric): CorpStats[] {
  return [...rows].sort((a, b) =>
    metric === "avgRank" ? a.avgRank - b.avgRank : b[metric] - a[metric]
  );
}

function CorporationsView({ entries }: { entries: Entry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortMetric, setSortMetric] = useState<CorpSortMetric>("count");
  const [search, setSearch] = useState("");
  const allRows = useMemo(() => computeCorpStats(entries), [entries]);

  const rows = useMemo(() => {
    const filtered = search.trim()
      ? allRows.filter((r) => r.corporation.toLowerCase().includes(search.trim().toLowerCase()))
      : allRows;
    return sortCorpStats(filtered, sortMetric);
  }, [allRows, sortMetric, search]);

  if (allRows.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  const metricMax = Math.max(...rows.map((r) => r[sortMetric] as number), 1);
  const barWidth = (row: CorpStats) => {
    if (sortMetric === "avgRank") {
      // Lower average rank is better; invert the scale for the progress bar.
      const worst = Math.max(...rows.map((r) => r.avgRank), row.avgRank, 1);
      return worst > 0 ? Math.max(((worst - row.avgRank) / worst) * 100, 4) : 4;
    }
    return Math.max(((row[sortMetric] as number) / metricMax) * 100, row[sortMetric] ? 3 : 0);
  };
  const metricDisplay = (row: CorpStats) =>
    sortMetric === "winRate" ? `${row.winRate}%` : sortMetric === "avgRank" ? row.avgRank.toFixed(2) : row[sortMetric];

  const sortOptions: CorpSortMetric[] = ["count", "winRate", "avgScore", "bestScore", "avgRank"];
  const maxRankSeen = Math.max(1, ...allRows.flatMap((r) => Object.keys(r.rankCounts).map(Number)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une corporation..."
            className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-56"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((m) => (
            <SortButton
              key={m}
              label={CORP_SORT_LABELS[m]}
              active={sortMetric === m}
              dir={m === "avgRank" ? "asc" : "desc"}
              onClick={() => setSortMetric(m)}
            />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground font-prototype text-sm py-4">Aucune corporation ne correspond à la recherche.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isOpen = expanded === row.corporation;
            const significant = row.count >= MIN_GAMES_FOR_WINRATE;
            return (
              <div key={row.corporation} className="p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                <button onClick={() => setExpanded(isOpen ? null : row.corporation)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <span className="font-prototype text-sm font-semibold truncate flex items-center gap-1.5">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronUp className="w-3.5 h-3.5 shrink-0 rotate-90" />}
                      <CorpLabel name={row.corporation} size={44} />
                    </span>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="hidden sm:block" title={significant ? undefined : `Moins de ${MIN_GAMES_FOR_WINRATE} parties — non significatif`}>
                        <p className="text-xs text-muted-foreground font-prototype">Victoires</p>
                        <p className={`font-prototype text-sm font-bold ${significant ? "text-green-400" : "text-muted-foreground"}`}>
                          {row.winRate}%{!significant && "*"}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-muted-foreground font-prototype">Moy.</p>
                        <p className="font-prototype text-sm font-bold">{row.avgScore}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-muted-foreground font-prototype">Meilleur</p>
                        <p className="font-prototype text-sm font-bold text-primary">{row.bestScore}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-muted-foreground font-prototype">Place moy.</p>
                        <p className="font-prototype text-sm font-bold">{row.avgRank.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-prototype">{CORP_SORT_LABELS[sortMetric]}</p>
                        <p className="font-prototype text-sm font-bold">{metricDisplay(row)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth(row)}%` }} />
                  </div>
                </button>
                <p className="text-xs text-muted-foreground font-prototype mt-1 truncate">
                  {row.count} partie{row.count > 1 ? "s" : ""} · Meilleur score : {row.bestPlayer} ({row.bestScore} pts)
                  {!significant && ` · * moins de ${MIN_GAMES_FOR_WINRATE} parties`}
                </p>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                    <div>
                      <p className="text-xs font-prototype text-muted-foreground mb-2">
                        Répartition des places (moyenne : {row.avgRank.toFixed(2)})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: maxRankSeen }, (_, i) => i + 1).map((r) => (
                          <div key={r} className="text-center px-2.5 py-1.5 rounded bg-background/50 min-w-[52px]">
                            <p className="text-[10px] font-prototype text-muted-foreground">
                              {r === 1 ? "1er" : `${r}e`}
                            </p>
                            <p className="font-prototype text-sm font-bold">{row.rankCounts[r] || 0}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-prototype text-muted-foreground mb-2">Score moyen par catégorie</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {CATEGORY_KEYS.map((k) => (
                          <div key={k} className="text-center p-2 rounded bg-background/50">
                            <p className="text-[10px] font-prototype text-muted-foreground">{CATEGORY_LABELS[k]}</p>
                            <p className="font-prototype text-sm font-bold">{row.avgByCategory[k]}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Players view (podiums) ───────────────────────────────────────────────────

type PlayerRow = {
  key: string;
  name: string;
  games: number;
  p1: number;
  p2: number;
  p3: number;
  total: number;
  best: number;
  rankSum: number;
  qualified: boolean;
  topCorp: string;
  avg: number;
  winRate: number;
  avgRank: number;
};

type PlayerSortMetric = "games" | "winRate" | "avg" | "best" | "avgRank" | "p1";

const PLAYER_SORT_LABELS: Record<PlayerSortMetric, string> = {
  games: "Parties",
  winRate: "Taux de victoire",
  avg: "Moyenne",
  best: "Record",
  avgRank: "Place moyenne",
  p1: "Victoires",
};

function PlayersView({ entries, onPlayerClick }: { entries: Entry[]; onPlayerClick: (key: string) => void }) {
  const [sortMetric, setSortMetric] = useState<PlayerSortMetric>("p1");
  const [search, setSearch] = useState("");

  const allRows = useMemo(() => {
    const map = new Map<string, {
      name: string; games: number; p1: number; p2: number; p3: number; total: number; best: number;
      rankSum: number; qualified: boolean; corpCounts: Map<string, number>;
    }>();
    for (const e of entries) {
      const key = playerKey(e);
      let p = map.get(key);
      if (!p) {
        p = { name: fullName(e), games: 0, p1: 0, p2: 0, p3: 0, total: 0, best: 0, rankSum: 0, qualified: false, corpCounts: new Map() };
        map.set(key, p);
      }
      p.games++;
      if (e.rank === 1) p.p1++;
      else if (e.rank === 2) p.p2++;
      else if (e.rank === 3) p.p3++;
      p.total += e.totalScore;
      p.rankSum += e.rank;
      p.best = Math.max(p.best, e.totalScore);
      if (e.isQualified) p.qualified = true;
      if (e.corporation && e.corporation !== "Pas de corporation") {
        p.corpCounts.set(e.corporation, (p.corpCounts.get(e.corporation) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([key, p]): PlayerRow => {
      let topCorp = "";
      let topCorpCount = 0;
      for (const [corp, count] of p.corpCounts) {
        if (count > topCorpCount) {
          topCorp = corp;
          topCorpCount = count;
        }
      }
      return {
        key,
        name: p.name,
        games: p.games,
        p1: p.p1,
        p2: p.p2,
        p3: p.p3,
        total: p.total,
        best: p.best,
        rankSum: p.rankSum,
        qualified: p.qualified,
        topCorp,
        avg: Math.round(p.total / p.games),
        winRate: Math.round((p.p1 / p.games) * 100),
        avgRank: Math.round((p.rankSum / p.games) * 100) / 100,
      };
    });
  }, [entries]);

  const rows = useMemo(() => {
    const filtered = search.trim()
      ? allRows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
      : allRows;
    return [...filtered].sort((a, b) =>
      sortMetric === "avgRank" ? a.avgRank - b.avgRank : b[sortMetric] - a[sortMetric]
    );
  }, [allRows, sortMetric, search]);

  if (allRows.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  const sortOptions: PlayerSortMetric[] = ["p1", "winRate", "games", "avg", "best", "avgRank"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-56"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((m) => (
            <SortButton
              key={m}
              label={PLAYER_SORT_LABELS[m]}
              active={sortMetric === m}
              dir={m === "avgRank" ? "asc" : "desc"}
              onClick={() => setSortMetric(m)}
            />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground font-prototype text-sm py-4">Aucun joueur ne correspond à la recherche.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs font-prototype text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Joueur</th>
                <th className="py-2 px-2 text-left">Corpo principale</th>
                <th className="py-2 px-2 text-center">Parties</th>
                <th className="py-2 px-2 text-center"><span className="text-yellow-400">1er</span></th>
                <th className="py-2 px-2 text-center"><span className="text-slate-300">2e</span></th>
                <th className="py-2 px-2 text-center"><span className="text-amber-600">3e</span></th>
                <th className="py-2 px-2 text-center">% Victoire</th>
                <th className="py-2 px-2 text-center">Place moy.</th>
                <th className="py-2 px-2 text-center">Moy.</th>
                <th className="py-2 pl-2 text-center">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-3">
                    <button onClick={() => onPlayerClick(r.key)} className={`font-prototype font-semibold hover:text-primary hover:underline text-left ${r.qualified ? "text-yellow-400" : ""}`}>
                      {r.name}
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    {r.topCorp ? <CorpLabel name={r.topCorp} size={18} /> : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-2 px-2 text-center font-prototype">{r.games}</td>
                  <td className="py-2 px-2 text-center font-prototype font-bold text-yellow-400">{r.p1 || "-"}</td>
                  <td className="py-2 px-2 text-center font-prototype text-slate-300">{r.p2 || "-"}</td>
                  <td className="py-2 px-2 text-center font-prototype text-amber-600">{r.p3 || "-"}</td>
                  <td className="py-2 px-2 text-center font-prototype">{r.winRate}%</td>
                  <td className="py-2 px-2 text-center font-prototype">{r.avgRank.toFixed(2)}</td>
                  <td className="py-2 px-2 text-center font-prototype">{r.avg}</td>
                  <td className="py-2 pl-2 text-center font-prototype font-bold text-primary">{r.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Charts view ──────────────────────────────────────────────────────────────

function ChartsView({ entries }: { entries: Entry[] }) {
  const corps = useMemo(() => computeCorpStats(entries), [entries]);

  const distribution = corps.map((c) => ({ label: c.corporation, value: c.count }));
  const winRates = [...corps]
    .sort((a, b) => b.winRate - a.winRate)
    .map((c) => ({
      label: c.corporation,
      value: c.winRate,
      sub: `${c.count}p`,
      dimmed: c.count < MIN_GAMES_FOR_WINRATE,
    }));
  const scores = entries.map((e) => e.totalScore);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-prototype text-sm font-semibold mb-2">Corporations jouées</h4>
        <BarChart data={distribution} />
      </div>
      <div>
        <h4 className="font-prototype text-sm font-semibold mb-1">Taux de victoire par corporation</h4>
        <p className="text-[10px] font-prototype text-muted-foreground mb-2">
          Grisé : moins de {MIN_GAMES_FOR_WINRATE} parties (non significatif)
        </p>
        <HBarChart data={winRates} formatValue={(v) => `${v}%`} />
      </div>
      <div>
        <h4 className="font-prototype text-sm font-semibold mb-2">Distribution des scores</h4>
        <Histogram values={scores} />
      </div>
      <p className="text-xs font-prototype text-muted-foreground">
        Astuce : cliquez sur un joueur (Classement ou Joueurs) pour voir sa courbe de progression.
      </p>
    </div>
  );
}

// ─── Compare view ─────────────────────────────────────────────────────────────

const COMPARE_COLORS = [
  { ring: "ring-orange-400", border: "border-orange-400", bg: "bg-orange-400/10", text: "text-orange-400", dot: "bg-orange-400" },
  { ring: "ring-sky-400", border: "border-sky-400", bg: "bg-sky-400/10", text: "text-sky-400", dot: "bg-sky-400" },
  { ring: "ring-emerald-400", border: "border-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-400", dot: "bg-emerald-400" },
];

function CompareView({ entries }: { entries: Entry[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const stats = useMemo(() => computeCorpStats(entries), [entries]);
  const byName = useMemo(() => new Map(stats.map((s) => [s.corporation, s])), [stats]);

  const toggle = (corp: string) =>
    setSelected((prev) =>
      prev.includes(corp) ? prev.filter((c) => c !== corp) : prev.length < 3 ? [...prev, corp] : prev
    );

  const rows: { label: string; render: (s: CorpStats) => React.ReactNode }[] = [
    { label: "Parties jouées", render: (s) => s.count },
    { label: "Victoires (1er à table)", render: (s) => s.wins },
    { label: "Taux de victoire", render: (s) => `${s.winRate}%` },
    { label: "Place moyenne", render: (s) => s.avgRank.toFixed(2) },
    { label: "Score moyen", render: (s) => s.avgScore },
    { label: "Meilleur score", render: (s) => s.bestScore },
    { label: "Meilleur joueur", render: (s) => <span className="text-xs">{s.bestPlayer}</span> },
    ...CATEGORY_KEYS.map((k) => ({
      label: `Moy. ${CATEGORY_LABELS[k]}`,
      render: (s: CorpStats) => s.avgByCategory[k],
    })),
  ];

  const visibleCorps = ALL_CORPORATIONS.filter(
    (c) => c !== "Pas de corporation" && (!search.trim() || c.toLowerCase().includes(search.trim().toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-muted/10 border border-border/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-prototype font-semibold">
            Choisissez 2 ou 3 corporations{" "}
            <span className={`ml-1 ${selected.length === 3 ? "text-primary" : "text-muted-foreground"}`}>
              ({selected.length}/3)
            </span>
          </p>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-xs font-prototype text-muted-foreground hover:text-destructive transition-colors"
              >
                Tout désélectionner
              </button>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
              />
            </div>
          </div>
        </div>

        {visibleCorps.length === 0 ? (
          <p className="text-muted-foreground font-prototype text-sm py-2">Aucune corporation ne correspond à la recherche.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {visibleCorps.map((c) => {
              const activeIdx = selected.indexOf(c);
              const active = activeIdx !== -1;
              const hasData = byName.has(c);
              const disabled = !active && selected.length >= 3;
              const color = active ? COMPARE_COLORS[activeIdx] : null;
              return (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  disabled={disabled}
                  title={c}
                  className={`relative flex items-center justify-center h-14 px-2 rounded-lg border text-xs font-prototype transition-all ${
                    active
                      ? `${color!.bg} border-transparent ring-2 ${color!.ring}`
                      : hasData
                        ? "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-primary/40"
                        : "bg-muted/5 border-border/30 text-muted-foreground/50"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {active && (
                    <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full ${color!.dot} text-[9px] text-black font-bold flex items-center justify-center shadow`}>
                      {activeIdx + 1}
                    </span>
                  )}
                  <CorpLabel name={c} size={22} className="max-w-full" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left text-xs font-prototype text-muted-foreground border-b border-border"></th>
                {selected.map((c, i) => (
                  <th key={c} className={`py-2 px-2 text-center font-prototype text-xs border-b-2 ${COMPARE_COLORS[i].border}`}>
                    <span className="flex flex-col items-center justify-center gap-1">
                      <CorpLabel name={c} size={26} />
                      <span className="flex items-center gap-1">
                        <span className={`truncate max-w-[100px] font-semibold ${COMPARE_COLORS[i].text}`}>{c}</span>
                        <button onClick={() => toggle(c)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.label} className={ri % 2 === 0 ? "bg-muted/10" : ""}>
                  <td className="py-2 pr-3 text-xs font-prototype text-muted-foreground border-b border-border/40">{r.label}</td>
                  {selected.map((c, i) => {
                    const s = byName.get(c);
                    return (
                      <td
                        key={c}
                        className={`py-2 px-2 text-center font-prototype font-semibold border-b border-border/40 ${s ? COMPARE_COLORS[i].bg : ""}`}
                      >
                        {s ? r.render(s) : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground font-prototype text-sm py-4 text-center">
          Sélectionnez au moins 2 corporations ci-dessus pour les comparer.
        </p>
      )}
    </div>
  );
}

// ─── Player modal ─────────────────────────────────────────────────────────────

function PlayerModal({ playerKey: key, entries, onClose }: { playerKey: string; entries: Entry[]; onClose: () => void }) {
  const playerEntries = useMemo(
    () =>
      entries
        .filter((e) => playerKey(e) === key)
        .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || "")),
    [entries, key]
  );

  if (playerEntries.length === 0) return null;
  const name = fullName(playerEntries[0]);
  const games = playerEntries.length;
  const wins = playerEntries.filter((e) => e.rank === 1).length;
  const podiums = playerEntries.filter((e) => e.rank <= 3).length;
  const best = Math.max(...playerEntries.map((e) => e.totalScore));
  const avg = Math.round(playerEntries.reduce((a, e) => a + e.totalScore, 0) / games);
  const winRate = Math.round((wins / games) * 100);
  const avgRank = Math.round((playerEntries.reduce((a, e) => a + e.rank, 0) / games) * 100) / 100;
  const corps = [...new Set(playerEntries.map((e) => e.corporation))];
  const corpCounts = new Map<string, number>();
  for (const e of playerEntries) corpCounts.set(e.corporation, (corpCounts.get(e.corporation) || 0) + 1);
  const favoriteCorp = [...corpCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const qualified = playerEntries.some((e) => e.isQualified);
  const evolution = playerEntries.map((e) => ({
    label: e.tournamentName ? shortTournamentName(e.tournamentName, e.eventDate) : e.eventDate || "?",
    value: e.totalScore,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/20 p-2 rounded-full shrink-0">
              <Medal className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-lg font-prototype truncate ${qualified ? "text-yellow-400" : ""}`}>
                {name}
              </h3>
              <p className="text-sm text-muted-foreground font-prototype flex items-center gap-1.5 flex-wrap">
                {games} partie{games > 1 ? "s" : ""}
                {favoriteCorp && (
                  <>
                    · Corpo principale : <CorpLabel name={favoriteCorp} size={16} />
                  </>
                )}
              </p>
              {corps.length > 1 && (
                <p className="text-xs text-muted-foreground font-prototype mt-0.5 flex items-center gap-1 flex-wrap">
                  Autres : {corps.filter((c) => c !== favoriteCorp).map((c) => (
                    <CorpLabel key={c} name={c} size={13} />
                  ))}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { label: "Victoires", value: wins, color: "text-yellow-400" },
              { label: "% Victoire", value: `${winRate}%`, color: "text-yellow-400" },
              { label: "Podiums", value: podiums, color: "text-foreground" },
              { label: "Place moy.", value: avgRank.toFixed(2), color: "text-foreground" },
              { label: "Moyenne", value: avg, color: "text-foreground" },
              { label: "Record", value: best, color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="p-2 rounded-lg bg-muted/20">
                <p className={`font-prototype font-bold text-lg ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-prototype text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-prototype text-muted-foreground mb-2">Progression (score par partie)</p>
            <LineChart points={evolution} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-prototype text-muted-foreground">Historique</p>
            {playerEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/20 text-xs font-prototype">
                <span className="truncate">
                  {shortTournamentName(e.tournamentName, e.eventDate)}
                  {e.eventDate && <span className="text-muted-foreground"> · {e.eventDate}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground truncate"><CorpLabel name={e.corporation} size={16} /></span>
                <span className="shrink-0 font-bold">
                  {e.rank === 1 ? "1er" : `${e.rank}e`} · {e.totalScore} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.role === "guest";

  // Dropdown metadata (tournaments, organizers) — fetched once, unfiltered.
  const [meta, setMeta] = useState<StatsData | null>(null);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (all pushed to the API as query params)
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [corporationFilter, setCorporationFilter] = useState("");
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);

  const [sortMetric, setSortMetric] = useState<SortMetric>("totalScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<View>("leaderboard");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard + one-time metadata fetch for the filter dropdowns.
  useEffect(() => {
    if (!isAdmin && !isGuest) {
      router.push("/");
      return;
    }
    fetch(`${apiUrl}/api/public/stats?meta=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMeta)
      .catch(() => {});
  }, [isAdmin, isGuest, router, apiUrl]);

  // Filtered data fetch — debounced (player search) + in-memory cache.
  useEffect(() => {
    if (!isAdmin && !isGuest) return;
    const params = new URLSearchParams();
    if (tournamentFilter) params.set("tournament", tournamentFilter);
    if (corporationFilter) params.set("corporation", corporationFilter);
    if (organizerFilter) params.set("organizer", organizerFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (playerSearch.trim()) params.set("player", playerSearch.trim());
    if (qualifiedOnly) params.set("qualified", "1");
    const qs = params.toString();
    const url = `${apiUrl}/api/public/stats${qs ? `?${qs}` : ""}`;

    const cached = statsCache.get(url);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRefreshing(true);
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((d: StatsData) => {
          statsCache.set(url, d);
          setData(d);
          setError(null);
        })
        .catch(() => setError("Impossible de charger les statistiques."))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isAdmin, isGuest, apiUrl, tournamentFilter, corporationFilter, organizerFilter, dateFrom, dateTo, playerSearch, qualifiedOnly]);

  function handleSortMetric(m: SortMetric) {
    if (sortMetric === m) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortMetric(m);
      setSortDir("desc");
    }
  }

  // Guests only see data from finished tournaments.
  const finishedTournamentIds = useMemo(
    () => new Set((meta?.tournaments ?? data?.tournaments ?? []).filter((t) => t.status === "fini").map((t) => t.id)),
    [meta, data]
  );

  const visibleEntries = useMemo(() => {
    if (!data) return [];
    // Hide scorecards with 0 total score (incomplete/placeholder data) and
    // normalize renamed corporations so old/new names aggregate together.
    let entries = data.entries
      .filter((e) => e.totalScore !== 0)
      .map((e) => ({ ...e, corporation: canonicalCorporation(e.corporation) }));
    if (isGuest) entries = entries.filter((e) => finishedTournamentIds.has(e.tournamentId));
    return entries;
  }, [data, isGuest, finishedTournamentIds]);

  const sortedEntries = useMemo(() => {
    return [...visibleEntries].sort((a, b) =>
      sortDir === "desc" ? b[sortMetric] - a[sortMetric] : a[sortMetric] - b[sortMetric]
    );
  }, [visibleEntries, sortMetric, sortDir]);

  const tournamentOptions = useMemo(
    () =>
      (meta?.tournaments ?? data?.tournaments ?? [])
        // Guests only see finished tournaments in the filter.
        .filter((t) => !isGuest || t.status === "fini")
        .slice()
        .sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""))
        .map((t) => ({ value: t.id, label: shortTournamentName(t.name, t.eventDate) })),
    [meta, data, isGuest]
  );
  const organizerOptions = useMemo(
    () => (meta?.organizers ?? data?.organizers ?? []).map((o) => ({ value: o.id, label: o.name || "Sans nom" })),
    [meta, data]
  );
  const corporationOptions = useMemo(() => {
    const fromData = data?.corporations ?? [];
    const all = [...new Set([...ALL_CORPORATIONS, ...fromData.map(canonicalCorporation)])]
      .filter((c) => c !== "Pas de corporation")
      .sort((a, b) => a.localeCompare(b, "fr"));
    return all.map((c) => ({ value: c, label: c }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <BarChart3 className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground font-prototype">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-destructive font-prototype">{error}</p>
      </div>
    );
  }

  const tabs: { key: View; label: string }[] = [
    { key: "leaderboard", label: "Classement" },
    { key: "players", label: "Joueurs" },
    { key: "corporations", label: "Corporations" },
    { key: "charts", label: "Graphiques" },
    { key: "compare", label: "Comparer" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-prototype tracking-tight mb-2">Statistiques</h1>
          <p className="text-muted-foreground font-prototype text-base">
            Explorez les données de toutes les parties disputées.
          </p>
        </div>
        {!isGuest && (
          <button
            onClick={() => exportCsv(sortedEntries)}
            disabled={sortedEntries.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 text-sm font-prototype transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 p-2.5 rounded-full shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-prototype font-bold">{data?.totalMatches ?? 0}</p>
              <p className="text-xs text-muted-foreground font-prototype">Tables validées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 p-2.5 rounded-full shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-prototype font-bold">{visibleEntries.length}</p>
              <p className="text-xs text-muted-foreground font-prototype">Scorecards</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters — guests only get the tournament filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {isGuest ? (
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={tournamentFilter}
                onChange={setTournamentFilter}
                placeholder="Tous les tournois"
                options={tournamentOptions}
              />
              <span className="ml-auto text-xs text-muted-foreground font-prototype">
                {refreshing ? "Chargement..." : `${sortedEntries.length} résultat${sortedEntries.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Rechercher un joueur..."
                    className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                  />
                </div>
                <Select
                  value={tournamentFilter}
                  onChange={setTournamentFilter}
                  placeholder="Tous les tournois"
                  options={tournamentOptions}
                />
                <Select
                  value={corporationFilter}
                  onChange={setCorporationFilter}
                  placeholder="Toutes les corporations"
                  options={corporationOptions}
                />
                <Select
                  value={organizerFilter}
                  onChange={setOrganizerFilter}
                  placeholder="Tous les organisateurs"
                  options={organizerOptions}
                />
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={qualifiedOnly}
                    onChange={(e) => setQualifiedOnly(e.target.checked)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-sm font-prototype text-muted-foreground">Qualifiés seulement</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-prototype text-muted-foreground">
                  Du
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-prototype text-muted-foreground">
                  Au
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1.5 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                {(dateFrom || dateTo || playerSearch || tournamentFilter || corporationFilter || organizerFilter || qualifiedOnly) && (
                  <button
                    onClick={() => {
                      setTournamentFilter("");
                      setCorporationFilter("");
                      setOrganizerFilter("");
                      setDateFrom("");
                      setDateTo("");
                      setPlayerSearch("");
                      setQualifiedOnly(false);
                    }}
                    className="text-xs font-prototype text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Réinitialiser
                  </button>
                )}
                <span className="ml-auto text-xs text-muted-foreground font-prototype">
                  {refreshing ? "Chargement..." : `${sortedEntries.length} résultat${sortedEntries.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View toggle + content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-prototype transition-colors ${
                  view === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {view === "leaderboard" && (
            <LeaderboardView
              entries={sortedEntries}
              sortMetric={sortMetric}
              sortDir={sortDir}
              onSort={handleSortMetric}
              onPlayerClick={setSelectedPlayer}
            />
          )}
          {view === "players" && <PlayersView entries={sortedEntries} onPlayerClick={setSelectedPlayer} />}
          {view === "corporations" && <CorporationsView entries={sortedEntries} />}
          {view === "charts" && <ChartsView entries={sortedEntries} />}
          {view === "compare" && <CompareView entries={sortedEntries} />}
        </CardContent>
      </Card>

      {selectedPlayer && data && (
        <PlayerModal playerKey={selectedPlayer} entries={visibleEntries} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
