"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BarChart3, ChevronLeft } from "lucide-react";
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

type TournamentMeta = { id: string; name: string; eventDate: string; status?: string; ownerId: string; ownerName: string };

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
        forets: e.forets,
        villes: e.villes,
        cartes: e.cartes,
        matchId: e.matchId,
        board: e.board || undefined,
      }));
  }, [data]);

  const tournamentOptions = useMemo(
    () =>
      (meta?.tournaments ?? data?.tournaments ?? [])
        .slice()
        .sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""))
        .map((t) => ({ value: t.id, label: shortTournamentName(t.name, t.eventDate) })),
    [meta, data]
  );

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
      <div className="flex items-start gap-2">
        {!isGuest && (
          <button
            onClick={() => router.back()}
            className="md:hidden mt-1 p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Retour"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-3xl sm:text-4xl font-prototype tracking-tight mb-2">Statistiques</h1>
          <p className="text-muted-foreground font-prototype text-base">
            Explorez les données de toutes les parties disputées.
          </p>
        </div>
      </div>

      <select
        value={tournamentFilter}
        onChange={(e) => setTournamentFilter(e.target.value)}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">Tous les tournois</option>
        {tournamentOptions.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <OverviewStats entries={entries} />
    </div>
  );
}
