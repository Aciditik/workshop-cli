"use client";

import { useTournaments } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Trophy, Calendar, Users, ChevronRight, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { tournaments, isLoaded, deleteTournament } = useTournaments();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground">Chargement des tournois...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Gérez vos tournois ou commencez-en un nouveau.
          </p>
        </div>
        <Link href="/tournaments/new">
          <Button size="lg" className="gap-2">
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
          <h3 className="text-xl font-semibold mb-2">Aucun tournoi pour le moment</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Vous n'avez pas créé de tournoi. Cliquez sur le bouton ci-dessous pour créer votre premier tournoi!
          </p>
          <Link href="/tournaments/new">
            <Button>Créer votre premier tournoi</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Card className="hover:border-primary/50 transition-colors group cursor-pointer h-full flex flex-col relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive z-10 hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this tournament?")) {
                      deleteTournament(tournament.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <span
                  className={`absolute top-2 left-2 text-xs px-2.5 py-0.5 rounded-full font-medium ${tournament.status === "completed"
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : tournament.status === "in_progress"
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                    }`}
                >
                  {tournament.status.replace("_", " ").toUpperCase()}
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
                    <h3 className="text-lg font-bold text-center mb-2">{tournament.name}</h3>
                  </div>
                  <div className="w-full pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(tournament.eventDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{tournament.participants.length} / {tournament.size}</span>
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
