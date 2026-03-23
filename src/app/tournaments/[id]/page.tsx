"use client";

import { useState, use } from "react";
import { useTournaments } from "@/lib/store";
import { TableMatch } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SwissRounds } from "@/components/SwissRounds";
import { Trophy, Users, Play, ChevronLeft, Plus, ListOrdered } from "lucide-react";
import Link from "next/link";

export default function TournamentView({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getTournament, updateTournament, isLoaded } = useTournaments();

    const [newParticipant, setNewParticipant] = useState("");
    const tournament = isLoaded ? getTournament(id) : null;

    if (!isLoaded) return <div className="p-8 animate-pulse text-muted-foreground">Loading...</div>;
    if (!tournament) return <div className="p-8 text-destructive">Tournament not found.</div>;

    const handleAddParticipant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newParticipant.trim() || tournament.participants.length >= tournament.size || tournament.status !== "draft") return;

        updateTournament({
            ...tournament,
            participants: [
                ...tournament.participants,
                { id: crypto.randomUUID(), name: newParticipant.trim(), score: 0 }
            ]
        });
        setNewParticipant("");
    };

    const currentRound = tournament.currentRound || 0;

    const generateNextRound = () => {
        const participants = [...tournament.participants];
        const nextRound = currentRound + 1;
        if (nextRound > 3) return; // Max 3 rounds

        const pool = [...participants];

        // Round 1: Random Shuffle
        if (nextRound === 1) {
            pool.sort(() => Math.random() - 0.5);
        } else {
            // Round 2/3: Sort by descending score
            pool.sort((a, b) => b.score - a.score);
        }

        // Distribute players into tables of 3 or 4 — no byes, no nulls.
        // For n < 6: only one table (can't split into two groups of ≥ 3 otherwise).
        // For n >= 6: find T tables and k 3-player tables so that: 3k + 4(T-k) = n → k = 4T - n
        //   r=0 → k=0 (all 4), r=1 → k=3, r=2 → k=2, r=3 → k=1
        const n = pool.length;
        let tableSizes: number[];

        if (n < 6) {
            // Too few to meaningfully split; one table of all players
            tableSizes = [n];
        } else {
            const remainder = n % 4;
            const k = remainder === 0 ? 0 : (4 - remainder); // number of 3-player tables
            const T = Math.floor(n / 4) + (remainder === 0 ? 0 : 1); // total tables
            tableSizes = [
                ...Array(T - k).fill(4),
                ...Array(k).fill(3),
            ];
        }

        const newMatches: TableMatch[] = [];
        let cursor = 0;

        for (let i = 0; i < tableSizes.length; i++) {
            const tableSize = tableSizes[i];
            const tablePlayers = pool.slice(cursor, cursor + tableSize);
            cursor += tableSize;

            newMatches.push({
                id: crypto.randomUUID(),
                tournamentId: tournament.id,
                round: nextRound,
                tableNumber: i + 1,
                participantIds: tablePlayers.map(p => p.id),
                results: {},
                isCompleted: false
            });
        }

        updateTournament({
            ...tournament,
            status: "in_progress",
            currentRound: nextRound,
            matches: [...tournament.matches, ...newMatches]
        });
    };

    const submitMatchResults = (matchId: string, results: Record<string, number>) => {
        if (tournament.status !== "in_progress") return;

        const updatedMatches = tournament.matches.map(m =>
            m.id === matchId ? { ...m, results, isCompleted: true, isPendingReview: false } : m
        );

        // Update overall participant scores based on these results
        const updatedParticipants = tournament.participants.map(p => {
            // Calculate fresh sum of all completed match scores to be safe (idempotent design)
            let newTotal = 0;
            updatedMatches.forEach(m => {
                if (m.isCompleted && m.results[p.id]) {
                    newTotal += m.results[p.id];
                }
            });
            return { ...p, score: newTotal };
        });

        const newTournamentData = {
            ...tournament,
            matches: updatedMatches,
            participants: updatedParticipants
        };

        // Check if all tables in current round are completed
        const currentRoundMatches = updatedMatches.filter(m => m.round === currentRound);
        const allCompleted = currentRoundMatches.every(m => m.isCompleted);

        if (allCompleted && currentRound === 3) {
            newTournamentData.status = "completed";
        }

        updateTournament(newTournamentData);
    };

    const isFull = tournament.participants.length >= tournament.size;
    const canGenerateNextRound = () => {
        if (currentRound >= 3) return false;
        if (currentRound === 0) return true;
        // Else, all matches in current round must be completed
        const roundMatches = tournament.matches.filter(m => m.round === currentRound);
        return roundMatches.length > 0 && roundMatches.every(m => m.isCompleted);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    {tournament.logoUrl && (
                        <img 
                            src={tournament.logoUrl} 
                            alt={`${tournament.name} logo`}
                            className="w-16 h-16 object-contain rounded-lg bg-muted/50 p-2"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                            {tournament.name}
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${tournament.status === "completed" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                                tournament.status === "in_progress" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                                    "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                }`}>
                                {tournament.status.replace("_", " ").toUpperCase()}
                            </span>
                        </h1>
                        <p className="text-muted-foreground">
                            {tournament.size} Players • 3-Round Swiss
                        </p>
                    </div>
                </div>
            </div>

            {tournament.status === "draft" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Participants ({tournament.participants.length}/{tournament.size})
                            </div>
                            {isFull && tournament.status === "draft" && (
                                <Button onClick={generateNextRound} className="gap-2">
                                    <Play className="w-4 h-4 fill-white" />
                                    Generate Pairings
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddParticipant} className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={newParticipant}
                                onChange={(e) => setNewParticipant(e.target.value)}
                                placeholder="Enter player/team name"
                                disabled={isFull}
                                className="flex-1 flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <Button type="submit" disabled={isFull} className="gap-2">
                                <Plus className="w-4 h-4" /> Add Player
                            </Button>
                        </form>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {tournament.participants.map(p => (
                                <div key={p.id} className="p-3 rounded-lg border bg-card/50 text-sm font-medium">
                                    {p.name}
                                </div>
                            ))}
                            {Array.from({ length: tournament.size - tournament.participants.length }).map((_, i) => (
                                <div key={i} className="p-3 rounded-lg border border-dashed border-border text-muted-foreground text-sm flex items-center justify-center">
                                    Empty Slot
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {tournament.status !== "draft" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold flex items-center gap-2">
                                <ListOrdered className="w-6 h-6 text-primary" />
                                Rounds & Pairings
                            </h3>
                            {tournament.status === "completed" ? (
                                <div className="text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded-lg">
                                    Tournament Completed!
                                </div>
                            ) : canGenerateNextRound() && currentRound > 0 ? (
                                <Button onClick={generateNextRound} className="gap-2" variant="secondary">
                                    <Play className="w-4 h-4 fill-foreground" />
                                    Generate Round {currentRound + 1}
                                </Button>
                            ) : null}
                        </div>
                        <SwissRounds
                            matches={tournament.matches}
                            participants={tournament.participants}
                            onSubmitResults={submitMatchResults}
                            currentRound={tournament.currentRound || 0}
                            tournamentId={tournament.id}
                            tournamentName={tournament.name}
                        />               </div>

                    <div>
                        <Card className="sticky top-8 border-primary/20">
                            <CardHeader className="bg-primary/5 border-b border-border">
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-primary" />
                                    Leaderboard
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {[...tournament.participants]
                                        .sort((a, b) => b.score - a.score)
                                        .map((p, index) => (
                                            <div key={p.id} className="p-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-500" :
                                                        index === 1 ? "bg-slate-300" :
                                                            index === 2 ? "bg-amber-600" : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-medium">{p.name}</span>
                                                </div>
                                                <div className="font-bold font-mono text-primary">
                                                    {p.score} <span className="text-muted-foreground text-xs font-sans">pts</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
