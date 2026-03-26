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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        fetch(`${apiUrl}/api/public/tournaments/${tournamentId}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then((data: Tournament) => {
                setTournament(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [tournamentId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading tournament...</div>;
    if (!tournament) return <div className="p-8 text-center text-red-500">Tournament not found.</div>;

    const currentRound = tournament.currentRound || 0;
    const activeMatches = tournament.matches
        .filter(m => m.round === currentRound && !m.isCompleted)
        .sort((a, b) => a.tableNumber - b.tableNumber);

    const getParticipantNames = (ids: (string | null)[]) =>
        ids
            .filter((id): id is string => id !== null)
            .map(id => tournament.participants.find(p => p.id === id)?.name || "Unknown")
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
                        {activeMatches.length === 0 ? (
                            <Card className="p-6 text-center">
                                <p className="text-muted-foreground">All tables for this round are completed.</p>
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
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
