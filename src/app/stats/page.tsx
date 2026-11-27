"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BarChart3, Users, Layers, Map as MapIcon, CalendarDays, Trophy, ChevronDown, Check } from "lucide-react";
import { canonicalCorporation } from "@/lib/corporations";
import { shortTournamentName, leagueHeader } from "@/lib/utils";
import { OverviewStats, OverviewEntry } from "@/components/stats/OverviewStats";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  participantId: string;
  playerId?: string | null;
  firstname: string;
  name: string;
  tournamentId: string;
  tournamentName: string;
  eventDate: string;
  matchId: string;
  round?: number;
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
  board: string;
};

type TournamentMeta = { id: string; name: string; eventDate: string; status?: string; ownerId: string; ownerName: string; logoUrl?: string };

type StatsData = {
  entries: Entry[];
  tournaments: TournamentMeta[];
  corporations: string[];
  organizers: { id: string; name: string }[];
  boards: string[];
  totalMatches: number;
};

// Canonical identity is the real Player row (playerId) now that it's
// backfilled server-side; the old name-string key only remains as a
// fallback for rows that somehow never got linked (shouldn't happen).
function playerKey(e: { playerId?: string | null; firstname: string; name: string }) {
  return e.playerId || `${e.firstname} ${e.name}`.trim().toLowerCase();
}

function fullName(e: { firstname: string; name: string }) {
  return [e.firstname, e.name].filter(Boolean).join(" ") || "Joueur inconnu";
}

// Season year: read from the name first ("Qualifier CdF 2027" can run in
// late 2026), eventDate is the fallback. Shared by the year filter.
const seasonYear = (t: { name: string; eventDate?: string }) =>
  Number(t.name.match(/\b(?:19|20)\d{2}\b/)?.[0]) ||
  Number((t.eventDate ?? "").match(/\d{4}/)?.[0]) ||
  new Date().getFullYear();

const statsCache = new Map<string, StatsData>();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.role === "guest";
  const isStreamer = user?.role === "streamer";

  const [meta, setMeta] = useState<StatsData | null>(null);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  // Player profile view — synced to a `?player=<id>` query param so it's a
  // real, shareable/back-button-able page instead of just panel state.
  const [playerFilter, setPlayerFilter] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tournament");
    const p = params.get("player");
    const id = setTimeout(() => {
      if (t) setTournamentFilter(t);
      if (p) setPlayerFilter(p);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Handle browser back/forward while the player profile is open.
  useEffect(() => {
    const onPopState = () => setPlayerFilter(new URLSearchParams(window.location.search).get("player"));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handlePlayerChange = (id: string | null) => {
    setPlayerFilter(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("player", id);
    else url.searchParams.delete("player");
    window.history.pushState({}, "", url);
  };

  useEffect(() => {
    if (!isAdmin && !isGuest && !isStreamer) {
      router.push("/");
      return;
    }
    fetch(`${apiUrl}/api/public/stats?meta=1`, { headers: leagueHeader() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMeta)
      .catch(() => {});
  }, [isAdmin, isGuest, isStreamer, router, apiUrl]);

  useEffect(() => {
    if (!isAdmin && !isGuest && !isStreamer) return;
    const qs = tournamentFilter ? `?tournament=${tournamentFilter}` : "";
    const url = `${apiUrl}/api/public/stats${qs}`;

    const id = setTimeout(() => {
      const cached = statsCache.get(url);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      fetch(url, { headers: leagueHeader() })
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
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(id);
  }, [isAdmin, isGuest, isStreamer, apiUrl, tournamentFilter]);

  const entries = useMemo<OverviewEntry[]>(() => {
    if (!data) return [];
    return data.entries
      .filter((e) => e.totalScore !== 0)
      .filter(
        (e) =>
          seasonYear({ name: e.tournamentName ?? "", eventDate: e.eventDate }) === yearFilter
      )
      .map((e): OverviewEntry => ({
        playerId: playerKey(e),
        playerName: fullName(e),
        totalScore: e.totalScore,
        rank: e.rank,
        corporation: canonicalCorporation(e.corporation),
        nt: e.nt,
        objectifs: e.objectifs,
        recompenses: e.recompenses,
        forets: e.forets,
        villes: e.villes,
        cartes: e.cartes,
        matchId: e.matchId,
        round: e.round,
        tournamentId: e.tournamentId,
        board: e.board || undefined,
        tournamentName: e.tournamentName || undefined,
        eventDate: e.eventDate || undefined,
      }));
  }, [data, yearFilter]);

  const allTournaments = useMemo(
    () => meta?.tournaments ?? data?.tournaments ?? [],
    [meta, data]
  );
  const tournamentLogos = useMemo(
    () => Object.fromEntries(allTournaments.filter((t) => t.logoUrl).map((t) => [t.id, t.logoUrl!])),
    [allTournaments]
  );
  const tournamentList = useMemo(
    () =>
      allTournaments
        .filter((t) => seasonYear(t) === yearFilter)
        .slice()
        .sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || "")),
    [allTournaments, yearFilter]
  );
  const availableYears = useMemo(
    () =>
      [...new Set([new Date().getFullYear(), ...allTournaments.map(seasonYear)])].sort(
        (a, b) => b - a
      ),
    [allTournaments]
  );
  const selectedTournament = allTournaments.find((t) => t.id === tournamentFilter);

  // Deep links (?tournament=<id>) pull the year filter along so the selected
  // event stays visible even if it belongs to another season. This only
  // fires once the tournament metadata (fetched async) resolves the id to a
  // season year different from the current filter.
  useEffect(() => {
    if (selectedTournament && seasonYear(selectedTournament) !== yearFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync once async metadata resolves the deep-linked tournament's season
      setYearFilter(seasonYear(selectedTournament));
    }
  }, [selectedTournament, yearFilter]);

  const bannerPlayers = new Set(entries.map((e) => e.playerId)).size;
  const bannerTables = new Set(entries.map((e) => e.matchId)).size;
  const bannerBoards = new Set(entries.map((e) => e.board).filter(Boolean)).size;

  const statusChip = (status?: string) =>
    status === "fini"
      ? "bg-green-500/10 text-green-500 border border-green-500/20"
      : status === "en_cours"
        ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
        : "bg-orange-500/10 text-orange-500 border border-orange-500/20";

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

  // Player profile — a full page of its own (synced to ?player=<id>),
  // replacing the tournament/year selectors entirely rather than opening on
  // top of them.
  if (playerFilter) {
    return (
      <OverviewStats entries={entries} playerId={playerFilter} onPlayerChange={handlePlayerChange} tournamentLogos={tournamentLogos} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setYearMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-md bg-card/60 border border-border text-sm font-prototype hover:bg-accent/50 transition-colors"
          >
            <span>{yearFilter}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${yearMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {yearMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setYearMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-2 z-50 min-w-full rounded-md border border-[#26252c] bg-[#141318] py-1 shadow-2xl">
                {availableYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setYearFilter(y);
                      setYearMenuOpen(false);
                      if (selectedTournament && seasonYear(selectedTournament) !== y) {
                        setTournamentFilter("");
                      }
                    }}
                    className="w-full px-3.5 py-1.5 text-sm font-prototype text-left hover:bg-white/5 flex items-center justify-between gap-6 transition-colors"
                  >
                    {y}
                    {yearFilter === y && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative">
        <button
          type="button"
          onClick={() => setSelectorOpen((v) => !v)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-md bg-card/60 border border-border text-sm font-prototype hover:bg-accent/50 transition-colors"
        >
          {selectedTournament?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedTournament.logoUrl} alt="" className="w-5 h-5 object-contain" />
          ) : (
            <Trophy className="w-4 h-4 text-primary" />
          )}
          <span>{selectedTournament ? shortTournamentName(selectedTournament.name, selectedTournament.eventDate) : "Tous les tournois"}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
        </button>

        {selectorOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
            <div className="absolute left-0 top-full mt-2 z-50 w-[min(560px,90vw)] rounded-[10px] border border-[#26252c] bg-[#141318] p-3 shadow-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {/* "All tournaments" cell */}
                <button
                  type="button"
                  onClick={() => { setTournamentFilter(""); setSelectorOpen(false); }}
                  className={`flex flex-col items-center justify-center gap-2 h-20 rounded-lg border text-center transition-colors ${
                    !tournamentFilter
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <Trophy className="w-6 h-6 text-primary" />
                  <span className="text-[11px] font-prototype leading-tight">Tous les tournois</span>
                </button>
                {tournamentList.map((t) => {
                  const active = tournamentFilter === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTournamentFilter(t.id); setSelectorOpen(false); }}
                      title={t.name}
                      className={`flex flex-col items-center justify-center gap-2 h-20 rounded-lg border px-1 transition-colors ${
                        active ? "border-primary bg-primary/10" : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Trophy className="w-6 h-6 text-muted-foreground/60" />
                      )}
                      <span className={`text-[11px] font-prototype leading-tight line-clamp-2 ${active ? "text-primary" : ""}`}>
                        {shortTournamentName(t.name, t.eventDate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Event banner — logo, name, date, and headline counters */}
      <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] px-5 py-4 flex items-center gap-5 flex-wrap">
        {selectedTournament ? (
          selectedTournament.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedTournament.logoUrl} alt="" className="w-14 h-14 object-contain shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-primary" />
            </div>
          )
        ) : (
          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-7 h-7 text-primary" />
          </div>
        )}

        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl sm:text-2xl font-prototype tracking-tight">
            {selectedTournament ? selectedTournament.name : "Statistiques — tous les tournois"}
          </h1>
          <p className="text-sm text-muted-foreground font-prototype mt-0.5 flex items-center gap-2 flex-wrap">
            {selectedTournament ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {new Date(selectedTournament.eventDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-prototype ${statusChip(selectedTournament.status)}`}>
                  {selectedTournament.status === "fini" ? "FINI" : selectedTournament.status === "en_cours" ? "EN COURS" : "BROUILLON"}
                </span>
                {selectedTournament.ownerName && <span>· organisé par {selectedTournament.ownerName}</span>}
              </>
            ) : (
              "Explorez les données de toutes les parties disputées du circuit."
            )}
          </p>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <div className="text-center">
            <p className="text-xl font-prototype font-bold flex items-center justify-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />{bannerPlayers}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-prototype">Joueurs</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-prototype font-bold flex items-center justify-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />{bannerTables}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-prototype">Tables</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-prototype font-bold flex items-center justify-center gap-1.5">
              <MapIcon className="w-4 h-4 text-primary" />{selectedTournament ? bannerBoards : tournamentList.length}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-prototype">
              {selectedTournament ? "Plateaux" : "Tournois"}
            </p>
          </div>
        </div>
      </div>

      <OverviewStats entries={entries} playerId={playerFilter} onPlayerChange={handlePlayerChange} tournamentLogos={tournamentLogos} />
    </div>
  );
}
