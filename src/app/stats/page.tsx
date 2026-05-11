"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart3, Trophy, Users, Star, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  participantId: string;
  firstname: string;
  name: string;
  tournamentId: string;
  tournamentName: string;
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

type StatsData = {
  entries: Entry[];
  tournaments: { id: string; name: string }[];
  corporations: string[];
  totalMatches: number;
};

type SortMetric = "totalScore" | "nt" | "objectifs" | "recompenses" | "forets" | "villes" | "cartes" | "megacredits";
type SortDir = "desc" | "asc";
type View = "leaderboard" | "corporations";

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
}: {
  entries: Entry[];
  sortMetric: SortMetric;
  sortDir: SortDir;
  onSort: (m: SortMetric) => void;
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
                <p className="font-prototype text-sm font-semibold truncate">{fullName}</p>
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

function CorporationsView({ entries }: { entries: Entry[] }) {
  type CorpRow = {
    corporation: string;
    count: number;
    avgScore: number;
    bestScore: number;
    bestPlayer: string;
  };

  const rows: CorpRow[] = useMemo(() => {
    const map = new Map<string, { scores: number[]; bestScore: number; bestPlayer: string }>();
    for (const e of entries) {
      const existing = map.get(e.corporation);
      const fullName = [e.firstname, e.name].filter(Boolean).join(" ") || "Joueur inconnu";
      if (!existing) {
        map.set(e.corporation, { scores: [e.totalScore], bestScore: e.totalScore, bestPlayer: fullName });
      } else {
        existing.scores.push(e.totalScore);
        if (e.totalScore > existing.bestScore) {
          existing.bestScore = e.totalScore;
          existing.bestPlayer = fullName;
        }
      }
    }
    return Array.from(map.entries())
      .map(([corporation, { scores, bestScore, bestPlayer }]) => ({
        corporation,
        count: scores.length,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        bestScore,
        bestPlayer,
      }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  if (rows.length === 0) {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Aucune donnée pour ces filtres.</p>;
  }

  const maxCount = rows[0].count;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.corporation} className="p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <span className="font-prototype text-sm font-semibold truncate">{row.corporation}</span>
            <div className="flex items-center gap-4 shrink-0 text-right">
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
          {/* Progress bar */}
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(row.count / maxCount) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground font-prototype mt-1 truncate">
            Meilleur score : {row.bestPlayer} ({row.bestScore} pts)
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [corporationFilter, setCorporationFilter] = useState("");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>("totalScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<View>("leaderboard");

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    const apiUrl = process.env.NODE_ENV === 'production'
      ? ''
      : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
    fetch(`${apiUrl}/api/public/stats`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Impossible de charger les statistiques."))
      .finally(() => setLoading(false));
  }, [isAdmin, router]);

  function handleSortMetric(m: SortMetric) {
    if (sortMetric === m) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortMetric(m);
      setSortDir("desc");
    }
  }

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    let entries = data.entries;
    if (tournamentFilter) entries = entries.filter((e) => e.tournamentId === tournamentFilter);
    if (corporationFilter) entries = entries.filter((e) => e.corporation === corporationFilter);
    if (qualifiedOnly) entries = entries.filter((e) => e.isQualified);
    return [...entries].sort((a, b) =>
      sortDir === "desc" ? b[sortMetric] - a[sortMetric] : a[sortMetric] - b[sortMetric]
    );
  }, [data, tournamentFilter, corporationFilter, qualifiedOnly, sortMetric, sortDir]);

  const qualifiedCount = useMemo(() => data?.entries.filter((e) => e.isQualified).length ?? 0, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <BarChart3 className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground font-prototype">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-destructive font-prototype">{error ?? "Erreur inconnue"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-prototype tracking-tight mb-2">Statistiques</h1>
        <p className="text-muted-foreground font-prototype text-base">
          Explorez les données de toutes les parties disputées.
        </p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 p-2.5 rounded-full shrink-0">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-prototype font-bold">{data.totalMatches}</p>
              <p className="text-xs text-muted-foreground font-prototype">Parties</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 p-2.5 rounded-full shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-prototype font-bold">{data.entries.length}</p>
              <p className="text-xs text-muted-foreground font-prototype">Scorecards</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={tournamentFilter}
              onChange={setTournamentFilter}
              placeholder="Tous les tournois"
              options={data.tournaments.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              value={corporationFilter}
              onChange={setCorporationFilter}
              placeholder="Toutes les corporations"
              options={data.corporations.map((c) => ({ value: c, label: c }))}
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
            <span className="ml-auto text-xs text-muted-foreground font-prototype">
              {filteredEntries.length} résultat{filteredEntries.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* View toggle + content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("leaderboard")}
              className={`px-3 py-1.5 rounded-md text-sm font-prototype transition-colors ${
                view === "leaderboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              Classement
            </button>
            <button
              onClick={() => setView("corporations")}
              className={`px-3 py-1.5 rounded-md text-sm font-prototype transition-colors ${
                view === "corporations"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              Corporations
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {view === "leaderboard" ? (
            <LeaderboardView
              entries={filteredEntries}
              sortMetric={sortMetric}
              sortDir={sortDir}
              onSort={handleSortMetric}
            />
          ) : (
            <CorporationsView entries={filteredEntries} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
