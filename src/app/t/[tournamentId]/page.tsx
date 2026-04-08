"use client";

import { use, useState, useEffect } from "react";
import { Tournament } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Trophy, Users } from "lucide-react";
import Link from "next/link";

export default function TournamentLanding({ params }: { params: Promise<{ tournamentId: string }> }) {
    const { tournamentId } = use(params);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);

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
    const activeMatches = currentRoundMatches.filter(m => !m.isCompleted && !m.isPendingReview);
    const submittedMatches = currentRoundMatches.filter(m => m.isCompleted || m.isPendingReview);

    const getParticipantNames = (ids: (string | null)[]) =>
        ids
            .filter((id): id is string => id !== null)
            .map(id => {
                const p = tournament.participants.find(p => p.id === id);
                return p ? `${p.firstname} ${p.name}` : "Unknown";
            })
            .join(", ");

    return (
        <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-2">
                    <div className="bg-primary/20 p-3 rounded-full inline-block text-primary shadow-lg ring-1 ring-primary/30">
                        <Trophy className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight">{tournament.name}</h1>
                    {currentRound > 0 && (
                        <p className="text-muted-foreground font-medium">Round {currentRound} — Select your table</p>
                    )}
                </div>

                {tournament.status === "completed" && (
                    <Card className="p-6 text-center border-green-500/50 bg-green-500/5">
                        <p className="text-green-500 font-bold text-lg">Tournament Completed!</p>
                    </Card>
                )}

                {tournament.status === "draft" && (
                    <Card className="p-6 text-center">
                        <p className="text-muted-foreground">The tournament has not started yet.</p>
                    </Card>
                )}

                {tournament.status === "in_progress" && currentRound > 0 && (
                    <>
                        {currentRoundMatches.length === 0 ? (
                            <Card className="p-6 text-center">
                                <p className="text-muted-foreground">No tables for this round yet.</p>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {activeMatches.map(match => (
                                    <Link
                                        key={match.id}
                                        href={`/t/${tournamentId}/table/${match.id}`}
                                        className="block"
                                    >
                                        <Card className="p-4 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/20 text-primary font-bold rounded-lg w-10 h-10 flex items-center justify-center text-lg">
                                                        {match.tableNumber}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">Table {match.tableNumber}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Users className="w-3 h-3" />
                                                            {getParticipantNames(match.participantIds)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-primary text-sm font-medium">→ Enter scores</span>
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
                                            <Card key={match.id} className="p-4 border-green-500/30 bg-green-500/5 opacity-70">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-green-500/20 text-green-500 font-bold rounded-lg w-10 h-10 flex items-center justify-center text-lg">
                                                            {match.tableNumber}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">Table {match.tableNumber}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Users className="w-3 h-3" />
                                                                {getParticipantNames(match.participantIds)}
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

                                {activeMatches.length === 0 && submittedMatches.length > 0 && (
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
