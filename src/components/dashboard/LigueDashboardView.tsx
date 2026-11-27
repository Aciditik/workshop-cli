"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Trophy, Calendar, Users, ChevronDown, Check, Trash2, QrCode } from "lucide-react";
import { QRCodeModal } from "@/components/QRCodeModal";
import { Tournament } from "@/lib/types";

// Terraforming Mars Ligue dashboard — same look as the CdF dashboard
// (src/app/page.tsx) but kept as its own file so Ligue-specific branding or
// behavior can diverge later without touching the CdF view. Data is already
// scoped server-side via the X-League header (see src/lib/store.ts), so
// `tournaments` here only ever contains Ligue tournaments.
const isFinaleTournament = (name: string) => /finale/i.test(name);

const tournamentYear = (t: { name: string; eventDate: string }) =>
  Number(t.name.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? new Date(t.eventDate).getFullYear());

export function LigueDashboardView({
  tournaments,
  isAdmin,
  deleteTournament,
}: {
  tournaments: Tournament[];
  isAdmin: boolean;
  deleteTournament: (id: string) => void;
}) {
  const sortedTournaments = [...tournaments].sort((a, b) => {
    const aFinale = isFinaleTournament(a.name);
    const bFinale = isFinaleTournament(b.name);
    if (aFinale !== bFinale) return aFinale ? -1 : 1;
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

  const [yearFilter, setYearFilter] = useState<number | "all">(new Date().getFullYear());
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const availableYears = [
    ...new Set([new Date().getFullYear(), ...tournaments.map(tournamentYear)]),
  ].sort((a, b) => b - a);
  const visibleTournaments = sortedTournaments.filter(
    (t) => yearFilter === "all" || tournamentYear(t) === yearFilter
  );

  return (
    <div className="space-y-8">
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
