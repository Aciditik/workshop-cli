"use client";

import { use, useState, useEffect } from "react";
import { Tournament } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Users, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function TournamentLanding({ params }: { params: Promise<{ tournamentId: string }> }) {
    const { tournamentId } = use(params);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        // Use relative URL in production (same domain), absolute URL for local development
        const apiUrl = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
        const loadTournament = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/public/tournaments/${tournamentId}`);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                setTournament(data);
            } catch (error) {
                console.error("Failed to load tournament:", error);
            } finally {
                setLoading(false);
            }
        };
        loadTournament();
    }, [tournamentId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading tournament...</div>;
    if (!tournament) return <div className="p-8 text-center text-red-500">Tournament not found.</div>;

    const currentRound = tournament.currentRound || 0;
    const currentRoundMatches = tournament.matches
        .filter(m => m.round === currentRound)
        .sort((a, b) => a.tableNumber - b.tableNumber);

    const normalizedSearch = search.trim().toLowerCase();

    const participantMatchesSearch = (id: string | null): boolean => {
        if (!id || !normalizedSearch) return false;
        const p = tournament.participants.find(pp => pp.id === id);
        if (!p) return false;
        const full = `${p.firstname} ${p.name}`.toLowerCase();
        return full.includes(normalizedSearch);
    };

    const matchContainsSearched = (match: { participantIds: (string | null)[] }) =>
        normalizedSearch.length > 0 && match.participantIds.some(participantMatchesSearch);

    const rawActiveMatches = currentRoundMatches.filter(m => !m.isCompleted && !m.isPendingReview);
    const rawSubmittedMatches = currentRoundMatches.filter(m => m.isCompleted || m.isPendingReview);

    // When a search is active, only show matches that contain the searched player.
    const activeMatches = normalizedSearch
        ? rawActiveMatches.filter(matchContainsSearched)
        : rawActiveMatches;
    const submittedMatches = normalizedSearch
        ? rawSubmittedMatches.filter(matchContainsSearched)
        : rawSubmittedMatches;

    // Suggestions while typing: list of matching participants (up to 6)
    const searchSuggestions = normalizedSearch
        ? tournament.participants
              .filter(p => `${p.firstname} ${p.name}`.toLowerCase().includes(normalizedSearch))
              .slice(0, 6)
        : [];

    const renderParticipantNames = (ids: (string | null)[]) => {
        const names = ids
            .filter((id): id is string => id !== null)
            .map(id => {
                const p = tournament.participants.find(pp => pp.id === id);
                return { id, label: p ? `${p.firstname} ${p.name}` : "Unknown" };
            });
        return (
            <>
                {names.map((n, idx) => {
                    const isMatch = participantMatchesSearch(n.id);
                    return (
                        <span key={n.id} className={isMatch ? "text-primary font-prototype" : ""}>
                            {n.label}{idx < names.length - 1 ? ", " : ""}
                        </span>
                    );
                })}
            </>
        );
    };

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
                        {tournament.logoUrl && (
                            <div className="w-16 h-16 relative">
                                <Image 
                                    src={tournament.logoUrl} 
                                    alt={`${tournament.name} logo`}
                                    width={64}
                                    height={64}
                                    className="object-contain"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                            </div>
                        )}
                    </div>
                    <h1 className="text-3xl font-prototype tracking-tight">{tournament.name}</h1>
                    {currentRound > 0 && (
                        <p className="text-muted-foreground font-prototype">Round {currentRound} — Choisissez votre table</p>
                    )}
                </div>

                {tournament.status === "fini" && (
                    <Card className="p-6 text-center border-green-500/50 bg-green-500/5">
                        <p className="text-green-500 font-prototype text-lg">Tournoi Terminé !</p>
                    </Card>
                )}

                {tournament.status === "brouillon" && (
                    <Card className="p-6 text-center">
                        <p className="text-muted-foreground font-prototype">The tournament has not started yet.</p>
                    </Card>
                )}

                {tournament.status === "en_cours" && currentRound > 0 && (
                    <>
                        {currentRoundMatches.length === 0 ? (
                            <Card className="p-6 text-center">
                                <p className="text-muted-foreground font-prototype">No tables for this round yet.</p>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {/* Player search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Rechercher un joueur…"
                                        className="w-full h-11 pl-10 pr-10 rounded-lg border border-border bg-card/80 text-sm font-prototype placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    {search && (
                                        <button
                                            onClick={() => setSearch("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"
                                            aria-label="Effacer la recherche"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {normalizedSearch && searchSuggestions.length === 0 && (
                                    <Card className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground font-prototype">Aucun joueur ne correspond à « {search} ».</p>
                                    </Card>
                                )}

                                {normalizedSearch && searchSuggestions.length > 0 && activeMatches.length === 0 && submittedMatches.length === 0 && (
                                    <Card className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground font-prototype">
                                            Ce joueur n&apos;est pas assigné à une table de cette ronde.
                                        </p>
                                    </Card>
                                )}

                                {activeMatches.map(match => (
                                    <Link
                                        key={match.id}
                                        href={`/t/${tournamentId}/table/${match.id}`}
                                        className="block"
                                    >
                                        <Card className={`p-4 transition-all cursor-pointer ${matchContainsSearched(match) ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-primary/30 hover:border-primary hover:bg-primary/5"}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/20 text-primary font-prototype rounded-lg w-10 h-10 flex items-center justify-center text-lg">
                                                        {match.tableNumber}
                                                    </div>
                                                    <div>
                                                        <p className="font-prototype text-sm">Table {match.tableNumber}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 font-prototype">
                                                            <Users className="w-3 h-3" />
                                                            {renderParticipantNames(match.participantIds)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-primary text-sm font-prototype">→ Entrer vos scores</span>
                                            </div>
                                        </Card>
                                    </Link>
                                ))}

                                {submittedMatches.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4">
                                            Scores déjà soumis ({submittedMatches.length}/{currentRoundMatches.length})
                                        </p>
                                        {submittedMatches.map(match => (
                                            <Card key={match.id} className={`p-4 opacity-80 ${matchContainsSearched(match) ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-green-500/30 bg-green-500/5"}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-green-500/20 text-green-500 font-bold rounded-lg w-10 h-10 flex items-center justify-center text-lg">
                                                            {match.tableNumber}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">Table {match.tableNumber}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Users className="w-3 h-3" />
                                                                {renderParticipantNames(match.participantIds)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                                                        ✓ {match.isCompleted ? "Validé" : "En attente"}
                                                    </span>
                                                </div>
                                            </Card>
                                        ))}
                                    </>
                                )}

                                {!normalizedSearch && activeMatches.length === 0 && submittedMatches.length > 0 && (
                                    <Card className="p-6 text-center border-green-500/30 bg-green-500/5">
                                        <p className="text-green-500 font-medium">Tous les scores de cette ronde ont été soumis !</p>
                                    </Card>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
