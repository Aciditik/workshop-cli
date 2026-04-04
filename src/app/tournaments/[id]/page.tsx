"use client";

import { use, useState, useRef, KeyboardEvent } from "react";
import { useTournaments } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SwissRounds } from "@/components/SwissRounds";
import { Participant } from "@/lib/types";
import { Participant } from "@/lib/types";
import {
    generateEliminationRound2,
    generateSwissRound,
    determineQualifiedPlayers,
    getFormatLabel,
    generateRound1,
    getFormat,
    getMaxRounds,
    getQualifiedCount,
} from "@/lib/qualifier-rules";
import { Trophy, Play, ChevronLeft, ListOrdered, Award, Star, RotateCcw, Plus, X, UserPlus } from "lucide-react";
import Link from "next/link";

export default function TournamentView({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getTournament, updateTournament, isLoaded, refresh } = useTournaments();
    const [playerName, setPlayerName] = useState("");
    const [playerEmail, setPlayerEmail] = useState("");
    const [playerPhone, setPlayerPhone] = useState("");
    const playerInputRef = useRef<HTMLInputElement>(null);

    const tournament = isLoaded ? getTournament(id) : null;

    if (!isLoaded) return <div className="p-8 animate-pulse text-muted-foreground">Loading...</div>;
    if (!tournament) return <div className="p-8 text-destructive">Tournament not found.</div>;

    const format = tournament.format || "swiss";
    const maxRounds = tournament.maxRounds || 3;
    const qualifiedCount = tournament.qualifiedCount || 2;

    const currentRound = tournament.currentRound || 0;

    const generateNextRound = () => {
        const nextRound = currentRound + 1;
        if (nextRound > maxRounds) return;

        let newMatches;

        if (format === "elimination" && nextRound === 2) {
            // Elimination Round 2: crossed finalist tables
            const round1Matches = tournament.matches.filter(m => m.round === 1);
            newMatches = generateEliminationRound2(tournament.id, playerCount, round1Matches);
        } else {
            // Swiss rounds 2-3: sorted by score
            newMatches = generateSwissRound(tournament.id, tournament.participants, currentRound);
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
            participants: updatedParticipants,
            qualifiedIds: undefined as string[] | undefined,
        };

        // Check if all tables in current round are completed or pending review
        const currentRoundMatches = updatedMatches.filter(m => m.round === currentRound);
        const allCompleted = currentRoundMatches.every(m => m.isCompleted || m.isPendingReview);

        // Tournament completes when the last round finishes
        if (allCompleted && currentRound === maxRounds) {
            newTournamentData.status = "completed";
            newTournamentData.qualifiedIds = determineQualifiedPlayers(
                format, tournament.size, updatedMatches, updatedParticipants
            );
        }

        updateTournament(newTournamentData);
    };

    const playerCount = tournament.participants.length;
    const canGenerateNextRound = () => {
        if (currentRound >= maxRounds) return false;
        const roundMatches = tournament.matches.filter(m => m.round === currentRound);
        // Matches must be completed OR pending review to proceed to next round
        return roundMatches.length > 0 && roundMatches.every(m => m.isCompleted || m.isPendingReview);
    };

    const addPlayer = () => {
        const trimmed = playerName.trim();
        if (!trimmed || tournament.status !== "draft") return;

        const newParticipant: Participant = {
            id: crypto.randomUUID(),
            name: trimmed,
            email: trimmed,
            phone: trimmed,
            score: 0,
        };

        updateTournament({
            ...tournament,
            participants: [...tournament.participants, newParticipant],
            size: tournament.participants.length + 1,
        });

        setPlayerName("");
        setPlayerEmail("");
        setPlayerPhone("");
        playerInputRef.current?.focus();
    };

    const removePlayer = (participantId: string) => {
        if (tournament.status !== "draft") return;

        updateTournament({
            ...tournament,
            participants: tournament.participants.filter(p => p.id !== participantId),
            size: tournament.participants.length - 1,
        });
    };

    const handlePlayerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); addPlayer(); }
    };

    const startTournament = () => {
        if (playerCount < 8) return;

        const format = getFormat(playerCount);
        const maxRounds = getMaxRounds(playerCount);
        const round1Matches = generateRound1(tournament.id, tournament.participants, playerCount);

        updateTournament({
            ...tournament,
            status: "in_progress",
            format,
            maxRounds,
            qualifiedCount: getQualifiedCount(playerCount),
            currentRound: 1,
            matches: round1Matches,
        });
    };

    const addPlayer = () => {
        const trimmed = playerName.trim();
        if (!trimmed || tournament.status !== "draft") return;

        const newParticipant: Participant = {
            id: crypto.randomUUID(),
            name: trimmed,
            email: trimmed,
            phone: trimmed,
            score: 0,
        };

        updateTournament({
            ...tournament,
            participants: [...tournament.participants, newParticipant],
            size: tournament.participants.length + 1,
        });

        setPlayerName("");
        setPlayerEmail("");
        setPlayerPhone("");
        playerInputRef.current?.focus();
    };

    const removePlayer = (participantId: string) => {
        if (tournament.status !== "draft") return;

        updateTournament({
            ...tournament,
            participants: tournament.participants.filter(p => p.id !== participantId),
            size: tournament.participants.length - 1,
        });
    };

    const handlePlayerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); addPlayer(); }
    };

    const startTournament = () => {
        if (playerCount < 8) return;

        const format = getFormat(playerCount);
        const maxRounds = getMaxRounds(playerCount);
        const round1Matches = generateRound1(tournament.id, tournament.participants, playerCount);

        updateTournament({
            ...tournament,
            status: "in_progress",
            format,
            maxRounds,
            qualifiedCount: getQualifiedCount(playerCount),
            currentRound: 1,
            matches: round1Matches,
        });
    };

    const qualifiedIds = new Set(tournament.qualifiedIds || []);

    // Calculate total placement points for each participant (5,3,2,1 system)
    const calculateTotalPoints = (participantId: string): number => {
        let total = 0;
        tournament.matches.forEach(m => {
            if (m.isCompleted && m.results[participantId]) {
                total += m.results[participantId];
            }
        });
        return total;
    };

    // Calculate NT score from scorecards for each participant
    const calculateNTScore = (participantId: string): number => {
        let ntTotal = 0;
        tournament.matches.forEach(m => {
            if (m.isCompleted && m.scorecards && m.scorecards[participantId]) {
                const scorecard = m.scorecards[participantId] as any;
                ntTotal += (scorecard.nt || 0) + (scorecard.objectifs || 0) + (scorecard.recompenses || 0) + (scorecard.forets || 0) + (scorecard.villes || 0) + (scorecard.cartes || 0);
            }
        });
        return ntTotal;
    };

    // Calculate difference from table winner for each participant
    const calculateTableDifference = (participantId: string): number => {
        let totalDifference = 0;
        let matchesCounted = 0;

        tournament.matches.forEach(m => {
            if (m.isCompleted && m.scorecards && m.scorecards[participantId]) {
                // Find the NT score of the winner (1st place) at this table
                const tableScores: { [key: string]: number } = {};
                Object.entries(m.scorecards).forEach(([pid, scorecard]: [string, any]) => {
                    if (scorecard) {
                        const nt = (scorecard.nt || 0) + (scorecard.objectifs || 0) + (scorecard.recompenses || 0) + (scorecard.forets || 0) + (scorecard.villes || 0) + (scorecard.cartes || 0);
                        tableScores[pid] = nt;
                    }
                });

                // Sort by results to find the winner
                const sortedByResults = Object.entries(m.results || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([pid]) => pid);

                if (sortedByResults.length > 0 && tableScores[sortedByResults[0]]) {
                    const winnerNT = tableScores[sortedByResults[0]];
                    const playerNT = tableScores[participantId];
                    totalDifference += winnerNT - playerNT;
                    matchesCounted++;
                }
            }
        });

        return matchesCounted > 0 ? totalDifference : 0;
    };

    // Sort participants: first by placement points, then by NT scores, then by table difference
    const sortedParticipants = [...tournament.participants].sort((a, b) => {
        const pointsA = calculateTotalPoints(a.id);
        const pointsB = calculateTotalPoints(b.id);
        const ntA = calculateNTScore(a.id);
        const ntB = calculateNTScore(b.id);
        const diffA = calculateTableDifference(a.id);
        const diffB = calculateTableDifference(b.id);
        
        // First sort by placement points (descending)
        if (pointsB !== pointsA) {
            return pointsB - pointsA;
        }
        // Then sort by NT scores (descending)
        if (ntB !== ntA) {
            return ntB - ntA;
        }
        // Finally sort by table difference (ascending - smaller difference is better)
        return diffA - diffB;
    });

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
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
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
                            {playerCount} joueur{playerCount > 1 ? "s" : ""} • {getFormatLabel(playerCount)} • {qualifiedCount} qualifié{qualifiedCount > 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={refresh}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            {/* Qualified Players Banner */}
            {tournament.status === "completed" && tournament.qualifiedIds && tournament.qualifiedIds.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-xl font-bold text-yellow-400">Joueurs Qualifiés</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {tournament.qualifiedIds.map((qId, idx) => {
                                const p = tournament.participants.find(pp => pp.id === qId);
                                return (
                                    <div key={qId} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
                                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                        <div>
                                            <p className="font-bold">{p?.name || "Inconnu"}</p>
                                            <p className="text-xs text-muted-foreground">Qualifié #{idx + 1}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* DRAFT Mode: Player Management */}
            {tournament.status === "draft" && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-400">
                            <UserPlus className="w-5 h-5" />
                            Ajouter des joueurs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add player form */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    ref={playerInputRef}
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Nom du joueur *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="email"
                                    value={playerEmail}
                                    onChange={(e) => setPlayerEmail(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Email *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="tel"
                                    value={playerPhone}
                                    onChange={(e) => setPlayerPhone(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Téléphone *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <Button onClick={addPlayer} className="gap-2 w-full md:w-auto">
                                <Plus className="w-4 h-4" />
                                Ajouter le joueur
                            </Button>
                        </div>

                        {/* Player list with delete buttons */}
                        {tournament.participants.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {tournament.participants.map((p, index) => (
                                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md border bg-card/50 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="font-medium">{p.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removePlayer(p.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                            title="Supprimer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tournament.participants.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                                Aucun joueur ajouté. Ajoutez au moins 8 joueurs pour lancer le tournoi.
                            </p>
                        )}

                        {/* Start tournament button */}
                        <div className="pt-4 border-t">
                            <Button
                                onClick={startTournament}
                                disabled={playerCount < 8}
                                className="w-full gap-2"
                                size="lg"
                            >
                                <Play className="w-4 h-4 fill-white" />
                                Lancer le tournoi ({playerCount} joueur{playerCount !== 1 ? "s" : ""})
                                {playerCount < 8 && ` - ${8 - playerCount} manquant${8 - playerCount > 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* DRAFT Mode: Player Management */}
            {tournament.status === "draft" && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-400">
                            <UserPlus className="w-5 h-5" />
                            Ajouter des joueurs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add player form */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    ref={playerInputRef}
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Nom du joueur *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="email"
                                    value={playerEmail}
                                    onChange={(e) => setPlayerEmail(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Email *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="tel"
                                    value={playerPhone}
                                    onChange={(e) => setPlayerPhone(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Téléphone *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <Button onClick={addPlayer} className="gap-2 w-full md:w-auto">
                                <Plus className="w-4 h-4" />
                                Ajouter le joueur
                            </Button>
                        </div>

                        {/* Player list with delete buttons */}
                        {tournament.participants.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {tournament.participants.map((p, index) => (
                                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md border bg-card/50 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="font-medium">{p.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removePlayer(p.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                            title="Supprimer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tournament.participants.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                                Aucun joueur ajouté. Ajoutez au moins 8 joueurs pour lancer le tournoi.
                            </p>
                        )}

                        {/* Start tournament button */}
                        <div className="pt-4 border-t">
                            <Button
                                onClick={startTournament}
                                disabled={playerCount < 8}
                                className="w-full gap-2"
                                size="lg"
                            >
                                <Play className="w-4 h-4 fill-white" />
                                Lancer le tournoi ({playerCount} joueur{playerCount !== 1 ? "s" : ""})
                                {playerCount < 8 && ` - ${8 - playerCount} manquant${8 - playerCount > 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold flex items-center gap-2">
                                <ListOrdered className="w-6 h-6 text-primary" />
                                Rondes & Tables
                            </h3>
                            {tournament.status === "completed" ? (
                                <div className="text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded-lg">
                                    Tournoi Terminé !
                                </div>
                            ) : canGenerateNextRound() ? (
                                <Button onClick={generateNextRound} className="gap-2" variant="secondary">
                                    <Play className="w-4 h-4 fill-foreground" />
                                    Générer Ronde {currentRound + 1}
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
                            maxRounds={maxRounds}
                            qualifiedIds={tournament.qualifiedIds}
                        />
                    </div>

                    <div>
                        <Card className="sticky top-8 border-primary/20">
                            <CardHeader className="bg-primary/5 border-b border-border">
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-primary" />
                                    Joueurs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {sortedParticipants.map((p, index) => {
                                        const totalPoints = format === "swiss" ? calculateTotalPoints(p.id) : null;
                                        const ntScore = calculateNTScore(p.id);
                                        const tableDiff = calculateTableDifference(p.id);
                                        return (
                                            <div key={p.id} className={`p-4 flex items-center justify-between hover:bg-accent/30 transition-colors ${qualifiedIds.has(p.id) ? "bg-yellow-500/5" : ""}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-500" :
                                                        index === 1 ? "bg-slate-300" :
                                                            index === 2 ? "bg-amber-600" : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-medium">{p.name}</span>
                                                    {qualifiedIds.has(p.id) && (
                                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {tableDiff > 0 && (
                                                        <span className="text-sm font-mono text-orange-600">
                                                            Diff {tableDiff}
                                                        </span>
                                                    )}
                                                    {ntScore > 0 && (
                                                        <span className="text-sm font-mono text-blue-600">
                                                            {ntScore} NT
                                                        </span>
                                                    )}
                                                    {totalPoints !== null && (
                                                        <span className="text-sm font-mono text-muted-foreground">
                                                            {totalPoints} pts
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
        </div>
    );
}
