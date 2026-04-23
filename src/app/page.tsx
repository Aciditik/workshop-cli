"use client";

import { useTournaments } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Trophy, Calendar, Users, ChevronRight, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { tournaments, isLoaded, deleteTournament } = useTournaments();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground font-prototype">Chargement des tournois...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-prototype tracking-tight mb-2">Tableau de bord</h1>
          <p className="text-muted-foreground font-prototype text-base sm:text-lg">
            Gérez vos tournois ou commencez-en un nouveau.
          </p>
        </div>
        <Link href="/tournaments/new" className="shrink-0">
          <Button size="lg" className="gap-2 w-full sm:w-auto font-prototype">
            <Trophy className="w-5 h-5" />
            Créer un tournoi
          </Button>
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-prototype mb-2">Aucun tournoi pour le moment</h3>
          <p className="text-muted-foreground font-prototype mb-6 max-w-md">
            Vous n'avez pas créé de tournoi. Cliquez sur le bouton ci-dessous pour créer votre premier tournoi!
          </p>
          <Link href="/tournaments/new">
            <Button className="font-prototype">Créer votre premier tournoi</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Card className="hover:border-primary/50 transition-colors group cursor-pointer h-full flex flex-col relative">
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
          ))}
        </div>
      )}
    </div>
  );
}
