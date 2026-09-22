"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart3, Trophy, Users, ChevronUp, ChevronDown, ChevronsUpDown, Download, Search, X, Medal } from "lucide-react";
import { BarChart, HBarChart, Histogram, LineChart } from "@/components/stats/Charts";

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

type SortMetric = "totalScore" | "nt" | "objectifs" | "recompenses" | "forets" | "villes" | "cartes" | "megacredits";
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

// Canonical corporation list (same as the mobile scorecard page) so the filter
// dropdown stays complete even when the API returns filtered entries.
const ALL_CORPORATIONS = [
  "Arcadian Communities","AstroDrill", "Cheung Shing Mars", "Credicor", "Desertron", "Ecoline", "Ecotec", "Green Power",
  "Guilde des Voleurs", "Guilde Ouvrière", "Helion", "Interplanetary Cinematics", "Inventrix", "Kuiper Cooperative",
  "Ludophiles d'Asnières et d'ailleurs","Mining Guild", "Nirgal Enterprise", "Palladin Shipping", "Phobolog", "Point Luna", "Recyclon",
  "Robinson Industries", "Sagitta", "Saturn Systems", "Soleil Vert", "Spire", "Teractor", "Tharsis Republic", "Thorgate",
  "Tycho Magnetics", "Union Pharmaceutique","United Nations Mars Initiative", "Valley Trust", "Vitor", "World Series Mars"
];

// Minimum games for a corporation win rate to be shown as significant.
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

function exportCsv(entries: Entry[]) {
  const header = ["Joueur", "Tournoi", "Date", "Corporation", "Rang table", "NT", "Objectifs", "Récompenses", "Forêts", "Villes", "Cartes", "Tiebreaker", "Total", "Qualifié"];
  const rows = entries.map((e) => [
    fullName(e), e.tournamentName, e.eventDate, e.corporation, e.rank,
    e.nt, e.objectifs, e.recompenses, e.forets, e.villes, e.cartes, e.megacredits, e.totalScore,
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
  megacredits: "Tiebreaker",
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

  const metrics: SortMetric[] = ["totalScore", "nt", "objectifs", "recompenses", "forets", "villes", "cartes", "megacredits"];

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
                  className="font-prototype text-sm font-semibold truncate hover:text-primary hover:underline transition-colors text-left w-full"
                >
                  {fullName}
                </button>
                <p className="text-xs text-muted-foreground font-prototype truncate">
                  {entry.corporation}
                  {entry.tournamentName ? ` · ${entry.tournamentName}` : ""}
                  {entry.isQualified && (
                    <span className="ml-1.5 text-yellow-400">★ Qualifié</span>
                  )}
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
};

function computeCorpStats(entries: Entry[]): CorpStats[] {
  const map = new Map<string, { scores: number[]; wins: number; bestScore: number; bestPlayer: string; cat: Record<CategoryKey, number> }>();
  for (const e of entries) {
    let c = map.get(e.corporation);
    if (!c) {
      c = { scores: [], wins: 0, bestScore: 0, bestPlayer: "", cat: { nt: 0, objectifs: 0, recompenses: 0, forets: 0, villes: 0, cartes: 0 } };
      map.set(e.corporation, c);
    }
    c.scores.push(e.totalScore);
    if (e.rank === 1) c.wins++;
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
    }))
    .sort((a, b) => b.count - a.count);
}

function CorporationsView({ entries }: { entries: Entry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = useMemo(() => computeCorpStats(entries), [entries]);

  if (rows.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  const maxCount = rows[0].count;

  return (
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
                  {row.corporation}
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
                  <div>
                    <p className="text-xs text-muted-foreground font-prototype">Parties</p>
                    <p className="font-prototype text-sm font-bold">{row.count}×</p>
                  </div>
                </div>
              </div>
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(row.count / maxCount) * 100}%` }} />
              </div>
            </button>
            <p className="text-xs text-muted-foreground font-prototype mt-1 truncate">
              Meilleur score : {row.bestPlayer} ({row.bestScore} pts)
              {!significant && ` · * moins de ${MIN_GAMES_FOR_WINRATE} parties`}
            </p>
            {isOpen && (
              <div className="mt-3 pt-3 border-t border-border/50">
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
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Players view (podiums) ───────────────────────────────────────────────────

function PlayersView({ entries, onPlayerClick }: { entries: Entry[]; onPlayerClick: (key: string) => void }) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; games: number; p1: number; p2: number; p3: number; total: number; best: number; qualified: boolean }>();
    for (const e of entries) {
      const key = playerKey(e);
      let p = map.get(key);
      if (!p) {
        p = { name: fullName(e), games: 0, p1: 0, p2: 0, p3: 0, total: 0, best: 0, qualified: false };
        map.set(key, p);
      }
      p.games++;
      if (e.rank === 1) p.p1++;
      else if (e.rank === 2) p.p2++;
      else if (e.rank === 3) p.p3++;
      p.total += e.totalScore;
      p.best = Math.max(p.best, e.totalScore);
      if (e.isQualified) p.qualified = true;
    }
    return Array.from(map.entries())
      .map(([key, p]) => ({ key, ...p, avg: Math.round(p.total / p.games) }))
      .sort((a, b) => b.p1 - a.p1 || b.p2 - a.p2 || b.p3 - a.p3 || b.avg - a.avg);
  }, [entries]);

  if (rows.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left text-xs font-prototype text-muted-foreground border-b border-border">
            <th className="py-2 pr-3">Joueur</th>
            <th className="py-2 px-2 text-center">Parties</th>
            <th className="py-2 px-2 text-center"><span className="text-yellow-400">1er</span></th>
            <th className="py-2 px-2 text-center"><span className="text-slate-300">2e</span></th>
            <th className="py-2 px-2 text-center"><span className="text-amber-600">3e</span></th>
            <th className="py-2 px-2 text-center">Moy.</th>
            <th className="py-2 pl-2 text-center">Record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3">
                <button onClick={() => onPlayerClick(r.key)} className="font-prototype font-semibold hover:text-primary hover:underline text-left">
                  {r.name}
                  {r.qualified && <span className="ml-1.5 text-yellow-400 text-xs">★</span>}
                </button>
              </td>
              <td className="py-2 px-2 text-center font-prototype">{r.games}</td>
              <td className="py-2 px-2 text-center font-prototype font-bold text-yellow-400">{r.p1 || "-"}</td>
              <td className="py-2 px-2 text-center font-prototype text-slate-300">{r.p2 || "-"}</td>
              <td className="py-2 px-2 text-center font-prototype text-amber-600">{r.p3 || "-"}</td>
              <td className="py-2 px-2 text-center font-prototype">{r.avg}</td>
              <td className="py-2 pl-2 text-center font-prototype font-bold text-primary">{r.best}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function CompareView({ entries }: { entries: Entry[] }) {
  const [selected, setSelected] = useState<string[]>([]);
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
    { label: "Score moyen", render: (s) => s.avgScore },
    { label: "Meilleur score", render: (s) => s.bestScore },
    { label: "Meilleur joueur", render: (s) => <span className="text-xs">{s.bestPlayer}</span> },
    ...CATEGORY_KEYS.map((k) => ({
      label: `Moy. ${CATEGORY_LABELS[k]}`,
      render: (s: CorpStats) => s.avgByCategory[k],
    })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-prototype text-muted-foreground mb-2">
          Sélectionnez 2 ou 3 corporations ({selected.length}/3)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CORPORATIONS.map((c) => {
            const active = selected.includes(c);
            const hasData = byName.has(c);
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                disabled={!active && selected.length >= 3}
                className={`px-2.5 py-1 rounded-md text-xs font-prototype transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : hasData
                      ? "bg-muted/30 text-foreground hover:bg-muted/50"
                      : "bg-muted/10 text-muted-foreground/50 hover:bg-muted/30"
                } ${!active && selected.length >= 3 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left text-xs font-prototype text-muted-foreground">Métrique</th>
                {selected.map((c) => (
                  <th key={c} className="py-2 px-2 text-center font-prototype text-xs">
                    <span className="flex items-center justify-center gap-1">
                      {c}
                      <button onClick={() => toggle(c)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/40">
                  <td className="py-2 pr-3 text-xs font-prototype text-muted-foreground">{r.label}</td>
                  {selected.map((c) => {
                    const s = byName.get(c);
                    return (
                      <td key={c} className="py-2 px-2 text-center font-prototype font-semibold">
                        {s ? r.render(s) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground font-prototype text-sm py-4">
          Sélectionnez au moins 2 corporations pour les comparer.
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
  const corps = [...new Set(playerEntries.map((e) => e.corporation))];
  const qualified = playerEntries.some((e) => e.isQualified);
  const evolution = playerEntries.map((e) => ({
    label: e.tournamentName || e.eventDate || "?",
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
              <h3 className="text-lg font-prototype truncate">
                {name}
                {qualified && <span className="ml-2 text-yellow-400 text-sm">★ Qualifié</span>}
              </h3>
              <p className="text-sm text-muted-foreground font-prototype">
                {games} partie{games > 1 ? "s" : ""} · {corps.join(", ")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Victoires", value: wins, color: "text-yellow-400" },
              { label: "Podiums", value: podiums, color: "text-foreground" },
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
                  {e.tournamentName}
                  {e.eventDate && <span className="text-muted-foreground"> · {e.eventDate}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground truncate">{e.corporation}</span>
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
    if (!isGuest) return data.entries;
    return data.entries.filter((e) => finishedTournamentIds.has(e.tournamentId));
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
        .map((t) => ({ value: t.id, label: t.name })),
    [meta, data, isGuest]
  );
  const organizerOptions = useMemo(
    () => (meta?.organizers ?? data?.organizers ?? []).map((o) => ({ value: o.id, label: o.name || "Sans nom" })),
    [meta, data]
  );
  const corporationOptions = useMemo(() => {
    const fromData = data?.corporations ?? [];
    const all = [...new Set([...ALL_CORPORATIONS, ...fromData])].sort((a, b) => a.localeCompare(b, "fr"));
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
