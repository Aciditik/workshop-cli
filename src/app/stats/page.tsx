"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BarChart3, Users, Layers, Map as MapIcon, CalendarDays, Trophy, ChevronDown } from "lucide-react";
import { canonicalCorporation } from "@/lib/corporations";
import { OverviewStats, OverviewEntry } from "@/components/stats/OverviewStats";

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

// Simple in-memory cache keyed by the (single) tournament filter — revisiting
// a tournament doesn't re-hit the API.
const statsCache = new Map<string, StatsData>();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.role === "guest";

  const [meta, setMeta] = useState<StatsData | null>(null);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournamentFilter, setTournamentFilter] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  // Preselect a tournament when arriving from a public tournament page
  // ("Voir les statistiques" links to /stats?tournament=<id>). Deferred so
  // the URL-param read doesn't setState synchronously in the effect body.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tournament");
    if (!t) return;
    const id = setTimeout(() => setTournamentFilter(t), 0);
    return () => clearTimeout(id);
  }, []);

  // Guard + one-time metadata fetch for the tournament dropdown.
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

  // Data fetch — one query param (tournament), cached per value fetched.
  useEffect(() => {
    if (!isAdmin && !isGuest) return;
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
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(id);
  }, [isAdmin, isGuest, apiUrl, tournamentFilter]);

  const entries = useMemo<OverviewEntry[]>(() => {
    if (!data) return [];
    // Hide scorecards with 0 total score (incomplete/placeholder data). The
    // API only ever returns scorecards from admin-validated tables
    // (isCompleted), so guests can safely see en_cours tournaments too —
    // pending-review tables never leak into stats.
    return data.entries
      .filter((e) => e.totalScore !== 0)
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
        board: e.board || undefined,
        tournamentName: e.tournamentName || undefined,
        eventDate: e.eventDate || undefined,
      }));
  }, [data]);

  const tournamentList = useMemo(
    () =>
      (meta?.tournaments ?? data?.tournaments ?? [])
        .slice()
        .sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || "")),
    [meta, data]
  );
  const selectedTournament = tournamentList.find((t) => t.id === tournamentFilter);

  // Banner counters, computed over the currently filtered entries.
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

  return (
    <div className="space-y-6">
      {/* Event selector — compact button opening an emblem grid, like
          the league switcher on esports stats pages */}
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

      <OverviewStats entries={entries} />
    </div>
  );
}
