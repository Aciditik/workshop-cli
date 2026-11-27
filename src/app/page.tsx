"use client";

import { useEffect, useState } from "react";
import { useTournaments } from "@/lib/store";
import { useAuth, getApiUrl } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import Image from "next/image";
import { Trophy, Calendar, Users, ChevronRight, ChevronDown, Check, Trash2, BarChart3, LogOut, QrCode, Shield } from "lucide-react";
import { QRCodeModal } from "@/components/QRCodeModal";
import { isLeagueForced, SUPER_ADMIN_EMAIL, type LeagueMode } from "@/lib/utils";

const isFinaleTournament = (name: string) => /finale/i.test(name);

// Season year: the year written in the name wins ("Qualifier CdF 2027" can be
// played in late 2026); eventDate is the fallback.
const tournamentYear = (t: { name: string; eventDate: string }) =>
  Number(t.name.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? new Date(t.eventDate).getFullYear());

type PublicTournamentItem = {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  ownerName?: string;
};

export default function Dashboard() {
  const { tournaments, isLoaded, deleteTournament } = useTournaments();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isGuest = user?.role === "guest";
  const isStreamer = user?.role === "streamer";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Super admin picks a data space on first login: CdF (default) or the
  // Terraforming Mars Ligue (same app, separate tournaments). The choice is
  // sent as X-League on every API call; reloading re-runs all fetches.
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  useEffect(() => {
    if (isSuperAdmin && !isLeagueForced() && !localStorage.getItem("leagueMode")) setLeagueModalOpen(true);
  }, [isSuperAdmin]);
  const chooseSpace = (mode: LeagueMode) => {
    localStorage.setItem("leagueMode", mode);
    window.location.reload();
  };

  // Guest/streamer home: the authenticated /api/tournaments list is
  // ownership-filtered (and guests have no JWT anyway), so browse via the
  // public stats metadata endpoint instead — read-only links to the public
  // /t/* pages.
  const [publicTournaments, setPublicTournaments] = useState<PublicTournamentItem[]>([]);
  const [publicLoaded, setPublicLoaded] = useState(false);
  useEffect(() => {
    if (!isGuest && !isStreamer) return;
    let cancelled = false;
    fetch(`${getApiUrl()}/api/public/stats?meta=1`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setPublicTournaments(data.tournaments || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPublicLoaded(true); });
    return () => { cancelled = true; };
  }, [isGuest, isStreamer]);

  // Finale tournaments always pinned first; the rest sorted by event date (newest first).
  const sortByDate = <T extends { name: string; eventDate: string }>(list: T[]) =>
    [...list].sort((a, b) => {
      const aFinale = isFinaleTournament(a.name);
      const bFinale = isFinaleTournament(b.name);
      if (aFinale !== bFinale) return aFinale ? -1 : 1;
      return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
    });
  const sortedTournaments = sortByDate(tournaments);
  const sortedPublic = sortByDate(publicTournaments);

  // Year filter — defaults to the current year; "all" shows every season.
  const [yearFilter, setYearFilter] = useState<number | "all">(new Date().getFullYear());
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const availableYears = [
    ...new Set([new Date().getFullYear(), ...tournaments.map(tournamentYear)]),
  ].sort((a, b) => b - a);
  const visibleTournaments = sortedTournaments.filter(
    (t) => yearFilter === "all" || tournamentYear(t) === yearFilter
  );

  const effectiveLoaded = (isGuest || isStreamer) ? publicLoaded : isLoaded;

  if (!effectiveLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground font-prototype">Chargement des tournois...</p>
        </div>
      </div>
    );
  }

  // Streamer home — broadcast-only account: sees live Finale tournaments and
  // nothing else. Cards open the dedicated stream view (/t/.../stream).
  if (isStreamer) {
    const liveFinales = sortedPublic.filter(
      (t) => t.status === "en_cours" && isFinaleTournament(t.name)
    );
    return (
      <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="w-16 h-16 relative">
                <Image
                  src="/cdf-logo.png"
                  alt="CdF Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-prototype tracking-tight">Espace Streamer</h1>
            <p className="text-muted-foreground font-prototype">Vue broadcast des finales en cours.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/50 hover:bg-accent/50 text-sm font-prototype text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Quitter
              </button>
            </div>
          </div>

          {liveFinales.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground font-prototype">Aucune finale en cours pour le moment.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {liveFinales.map((tournament) => (
                <Link key={tournament.id} href={`/t/${tournament.id}/stream`}>
                  <Card className="p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer border-yellow-500/40">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-prototype truncate">{tournament.name}</h3>
                      <p className="text-xs text-muted-foreground font-prototype">
                        {new Date(tournament.eventDate).toLocaleDateString()}
                        {tournament.ownerName ? ` · ${tournament.ownerName}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-prototype shrink-0 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      EN COURS
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Guest home — bare black-background style like the public /t/* pages.
  // Guests only pick among live ("en_cours") tournaments, opened in the
  // read-only streamer view (/t/.../stream).
  if (isGuest) {
    const liveTournaments = sortedPublic.filter((t) => t.status === "en_cours");
    return (
      <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="w-16 h-16 relative">
                <Image
                  src="/cdf-logo.png"
                  alt="CdF Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-prototype tracking-tight">Tournois en direct</h1>
            <p className="text-muted-foreground font-prototype">Choisissez un tournoi en cours pour le suivre en direct.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              <Link
                href="/stats"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/50 hover:bg-accent/50 text-sm font-prototype text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Statistiques
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/50 hover:bg-accent/50 text-sm font-prototype text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Quitter
              </button>
            </div>
          </div>

          {liveTournaments.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground font-prototype">Aucun tournoi en cours pour le moment.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {liveTournaments.map((tournament) => {
                const isFinale = isFinaleTournament(tournament.name);
                return (
                  <Link key={tournament.id} href={`/t/${tournament.id}/stream`}>
                    <Card className={`p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer ${isFinale ? "border-yellow-500/40" : ""}`}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-prototype truncate">{tournament.name}</h3>
                        <p className="text-xs text-muted-foreground font-prototype">
                          {new Date(tournament.eventDate).toLocaleDateString()}
                          {tournament.ownerName ? ` · ${tournament.ownerName}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-prototype shrink-0 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        EN COURS
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {leagueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#26252c] bg-[#1f1e26] p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-center mb-4">
              <Image src="/cdf-logo.png" alt="CdF Logo" width={56} height={56} className="object-contain" />
            </div>
            <h2 className="text-xl font-prototype tracking-tight text-center">Choisissez votre espace</h2>
            <p className="text-sm text-muted-foreground font-prototype text-center mt-2 mb-6">
              Même application, données séparées — les tournois de la Ligue ne mélangent pas ceux du CdF.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => chooseSpace("cdf")}
                className="flex flex-col items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/15 p-5 transition-colors"
              >
                <Trophy className="w-8 h-8 text-primary" />
                <span className="font-prototype text-sm">CDF Terraforming Mars</span>
                <span className="text-[11px] text-muted-foreground font-prototype">Espace classique</span>
              </button>
              <button
                type="button"
                onClick={() => chooseSpace("ligue")}
                className="flex flex-col items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 hover:bg-red-500/15 p-5 transition-colors"
              >
                <Shield className="w-8 h-8 text-red-400" />
                <span className="font-prototype text-sm">Terraforming Mars Ligue</span>
                <span className="text-[11px] text-muted-foreground font-prototype">Espace dédié</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-prototype tracking-tight mb-2">Tableau de bord</h1>
          <p className="text-muted-foreground font-prototype text-base sm:text-lg">
            Gérez vos tournois ou commencez-en un nouveau.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {tournaments.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setYearMenuOpen((o) => !o)}
                className="h-11 px-4 rounded-md border border-border bg-card/50 hover:bg-accent/50 font-prototype text-sm inline-flex items-center gap-2 transition-colors"
              >
                {yearFilter === "all" ? "Tous" : yearFilter}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {yearMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setYearMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-full rounded-md border border-border bg-card shadow-lg py-1">
                    {availableYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => { setYearFilter(y); setYearMenuOpen(false); }}
                        className="w-full px-3 py-1.5 text-sm font-prototype text-left hover:bg-accent/50 flex items-center justify-between gap-6 transition-colors"
                      >
                        {y}
                        {yearFilter === y && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <Link href="/tournaments/new">
            <Button size="lg" className="gap-2 w-full sm:w-auto font-prototype">
              <Trophy className="w-5 h-5" />
              Créer un tournoi
            </Button>
          </Link>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-prototype mb-2">Aucun tournoi pour le moment</h3>
          <p className="text-muted-foreground font-prototype mb-6 max-w-md">
            Vous n&apos;avez pas créé de tournoi. Cliquez sur le bouton ci-dessous pour créer votre premier tournoi!
          </p>
          <Link href="/tournaments/new">
            <Button className="font-prototype">Créer votre premier tournoi</Button>
          </Link>
        </Card>
      ) : visibleTournaments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <p className="text-muted-foreground font-prototype">
            Aucun tournoi en {yearFilter}.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleTournaments.map((tournament) => {
            const isFinale = isFinaleTournament(tournament.name);
            return (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Card className={`hover:border-primary/50 transition-colors group cursor-pointer h-full flex flex-col relative ${isFinale ? "bg-zinc-950 border-yellow-500/40 hover:border-yellow-500/70 shadow-lg shadow-yellow-500/10" : ""}`}>
                <div
                  className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <QRCodeModal
                    tournamentId={tournament.id}
                    tournamentName={tournament.name}
                    tournamentLogoUrl={tournament.logoUrl}
                    eventDate={tournament.eventDate}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        title="Voir le QR code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive z-10 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Voulez-vous vraiment supprimer ce tournoi ?")) {
                        deleteTournament(tournament.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <span
                  className={`absolute top-2 left-2 text-xs px-2.5 py-0.5 rounded-full font-prototype ${tournament.status === "fini"
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : tournament.status === "en_cours"
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                    }`}
                >
                  {tournament.status === "fini" ? "FINI" : tournament.status === "en_cours" ? "EN COURS" : "BROUILLON"}
                </span>
                <CardContent className="flex-1 flex flex-col items-center justify-between p-6 pt-12">
                  <div className="flex flex-col items-center justify-center flex-1 w-full">
                    {tournament.logoUrl ? (
                      <img 
                        src={tournament.logoUrl} 
                        alt={`${tournament.name} logo`}
                        className="w-32 h-32 object-contain mb-4"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center bg-muted/30 rounded-lg mb-4">
                        <Trophy className="w-16 h-16 text-muted-foreground/50" />
                      </div>
                    )}
                    <h3 className="text-lg font-prototype text-center mb-2">{tournament.name}</h3>
                  </div>
                  <div className="w-full pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm font-prototype text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span className="font-prototype">{new Date(tournament.eventDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-prototype">{tournament.participants.length} / {tournament.size}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
