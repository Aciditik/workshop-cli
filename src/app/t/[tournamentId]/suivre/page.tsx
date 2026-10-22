"use client";

import { use, useEffect, useState } from "react";
import { Tournament, Participant } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import {
    rankSwissPlayers,
    calculateSwissTotalPoints,
    calculateSwissNTScore,
    calculateSwissTableDifference,
    rankBracketPlayers,
    splitQualifiersAcrossFinalTables,
} from "@/lib/qualifier-rules";
import { SwissRounds } from "@/components/SwissRounds";
import { BracketTreeView } from "@/components/BracketTreeView";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Award, ChevronLeft, ListOrdered, Ban } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Read-only spectator view: anyone with the link (no login, no "playing" a
// table) can follow a tournament's rounds/tables and classement live.
// Scores for a table only ever appear once the admin has actually validated
// it (SwissRounds readOnly mode hides pending-review scorecards).
export default function TournamentFollow({ params }: { params: Promise<{ tournamentId: string }> }) {
    const { tournamentId } = use(params);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPseudos, setShowPseudos] = useState(false);
    const [mainView, setMainView] = useState<"rounds" | "classement">("rounds");

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(`${apiUrl}/api/public/tournaments/${tournamentId}`);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                if (!cancelled) setTournament(data);
            } catch (error) {
                console.error("Failed to load tournament:", error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        // Poll for live updates while the tournament is running, same cadence
        // as the organizer's dashboard.
        const interval = setInterval(load, 10000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [tournamentId]);

    if (loading) return <div className="p-8 text-center animate-pulse font-prototype">Chargement du tournoi...</div>;
    if (!tournament) return <div className="p-8 text-center text-red-500 font-prototype">Tournoi introuvable.</div>;

    const format = tournament.format || "swiss";
    const qualifiedIds = new Set(tournament.qualifiedIds || []);

    // Swiss / elimination classement.
    const sortedParticipants = rankSwissPlayers(tournament.matches, tournament.participants);

    // Bracket classement: same grouping logic as the admin view (advancing /
    // pending / eliminated, no raw points shown — see qualifier-rules.ts).
    const bracketRanked = format === "bracket" ? rankBracketPlayers(tournament.matches, tournament.participants) : [];
    const bracketFinalRound = tournament.matches.reduce((max, m) => Math.max(max, m.round), 0);
    const maxRounds = tournament.maxRounds || 3;
    const atBracketFinalRound = format === "bracket" && bracketFinalRound > 0 && bracketFinalRound >= maxRounds;
    const bracketFinaleQualifiedIds = atBracketFinalRound
        ? new Set(
            tournament.status === "fini" && tournament.qualifiedIds
                ? tournament.qualifiedIds
                : splitQualifiersAcrossFinalTables(
                    tournament.matches.filter(m => m.round === bracketFinalRound && m.isCompleted),
                    tournament.qualifiedCount || 2,
                    tournament.participants
                )
        )
        : null;
    const bracketDisplayList = [
        ...bracketRanked.map(r => ({
            p: r.participant,
            status: bracketFinaleQualifiedIds
                ? (r.lastRound === 0 ? "pending" as const : bracketFinaleQualifiedIds.has(r.participant.id) ? "advancing" as const : "eliminated" as const)
                : r.status,
        })),
        ...tournament.participants.filter(p => p.dnf).map(p => ({ p, status: "eliminated" as const })),
    ];
    const bracketAdvancing = bracketDisplayList.filter(r => r.status === "advancing");
    const bracketPending = bracketDisplayList.filter(r => r.status === "pending");
    const bracketEliminated = bracketDisplayList.filter(r => r.status === "eliminated");

    const renderBracketRow = (p: Participant) => (
        <div key={p.id} className="px-3 py-2.5 flex items-center gap-3">
            <span className={`font-prototype truncate ${p.dnf ? "line-through text-muted-foreground" : qualifiedIds.has(p.id) ? "text-yellow-400" : ""}`}>
                {playerDisplayName(p, showPseudos)}
            </span>
            {p.dnf && <span className="text-[10px] font-prototype px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500 border border-orange-500/30 shrink-0">DNF</span>}
        </div>
    );

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="w-full max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <Link href={`/t/${tournamentId}`}>
                        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    {tournament.logoUrl && (
                        <div className="w-10 h-10 relative shrink-0">
                            <Image src={tournament.logoUrl} alt={`${tournament.name} logo`} width={40} height={40} className="object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-prototype truncate">{tournament.name}</h1>
                        <p className="text-xs font-prototype text-muted-foreground">Suivi du tournoi (lecture seule)</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMainView("rounds")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-prototype text-sm transition-colors ${mainView === "rounds" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <ListOrdered className="w-4 h-4" />
                            Rondes &amp; Tables
                        </button>
                        <button
                            type="button"
                            onClick={() => setMainView("classement")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-prototype text-sm transition-colors ${mainView === "classement" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <Award className="w-4 h-4" />
                            Classement
                        </button>
                    </div>
                    {tournament.participants.some(p => p.pseudo) && (
                        <label className="flex items-center gap-1.5 text-xs font-prototype text-muted-foreground cursor-pointer select-none">
                            <input type="checkbox" checked={showPseudos} onChange={(e) => setShowPseudos(e.target.checked)} className="rounded border-border accent-primary" />
                            Afficher les pseudos
                        </label>
                    )}
                </div>

                {tournament.status === "brouillon" && (
                    <Card className="p-6 text-center">
                        <p className="text-muted-foreground font-prototype">Le tournoi n&apos;a pas encore commencé.</p>
                    </Card>
                )}

                {tournament.status !== "brouillon" && mainView === "rounds" && (
                    <>
                        {format === "bracket" && tournament.matches.length > 0 && (
                            <Card className="border-primary/20">
                                <CardHeader>
                                    <CardTitle className="font-prototype">Arbre d&apos;élimination</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <BracketTreeView
                                        matches={tournament.matches}
                                        participants={tournament.participants}
                                        qualifiedIds={tournament.qualifiedIds}
                                        roundBoards={tournament.roundBoards}
                                        usePseudo={showPseudos}
                                    />
                                </CardContent>
                            </Card>
                        )}
                        <SwissRounds
                            matches={tournament.matches}
                            participants={tournament.participants}
                            currentRound={tournament.currentRound || 0}
                            tournamentId={tournament.id}
                            tournamentName={tournament.name}
                            tournamentLogoUrl={tournament.logoUrl}
                            eventDate={tournament.eventDate}
                            maxRounds={maxRounds}
                            qualifiedIds={tournament.qualifiedIds}
                            roundBoards={tournament.roundBoards}
                            usePseudo={showPseudos}
                            readOnly
                        />
                    </>
                )}

                {tournament.status !== "brouillon" && mainView === "classement" && (format === "swiss" || format === "elimination") && (
                    <Card className="border-primary/20">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {sortedParticipants.map((p, index) => {
                                    const totalPoints = format === "swiss" ? calculateSwissTotalPoints(tournament.matches, p.id) : null;
                                    const ntScore = calculateSwissNTScore(tournament.matches, p.id);
                                    const tableDiff = calculateSwissTableDifference(tournament.matches, p.id);
                                    const showStats = format === "swiss";
                                    return (
                                        <div key={p.id} className={`px-3 py-2.5 flex items-center gap-3 ${p.dnf ? "opacity-50 bg-muted/20" : qualifiedIds.has(p.id) ? "bg-yellow-500/5" : ""}`}>
                                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${p.dnf ? "bg-muted text-muted-foreground" :
                                                index === 0 ? "bg-yellow-500 text-black" :
                                                index === 1 ? "bg-slate-300 text-black" :
                                                index === 2 ? "bg-amber-600 text-black" : "bg-muted text-muted-foreground"}`}>
                                                {p.dnf ? <Ban className="w-3.5 h-3.5" /> : index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`font-prototype truncate ${p.dnf ? "line-through" : ""} ${!p.dnf && qualifiedIds.has(p.id) ? "text-yellow-400" : ""}`}>{playerDisplayName(p, showPseudos)}</span>
                                                    {p.dnf && <span className="text-[10px] font-prototype px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500 border border-orange-500/30 shrink-0">DNF</span>}
                                                </div>
                                                {showStats && (
                                                    <div className="text-xs font-prototype tabular-nums mt-0.5 flex items-center gap-2">
                                                        <span className="text-orange-600">Diff {tableDiff}</span>
                                                        <span className="text-muted-foreground">·</span>
                                                        <span className="text-blue-600">{ntScore} NT</span>
                                                    </div>
                                                )}
                                            </div>
                                            {showStats && totalPoints !== null && (
                                                <span className="font-prototype text-base text-primary tabular-nums px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                                                    {totalPoints}<span className="text-xs text-muted-foreground ml-0.5">pts</span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {tournament.status !== "brouillon" && mainView === "classement" && format === "bracket" && (
                    <div className="space-y-6">
                        {bracketAdvancing.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-prototype text-green-500 flex items-center gap-2">
                                    <Award className="w-4 h-4" />
                                    {atBracketFinalRound ? `Qualifiés pour la finale (${tournament.qualifiedCount || 2})` : `Qualifiés pour la ronde suivante (${bracketAdvancing.length})`}
                                </h4>
                                <Card className="border-green-500/20">
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-border">
                                            {bracketAdvancing.map(row => renderBracketRow(row.p))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        {bracketPending.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-prototype text-muted-foreground">En attente de résultats ({bracketPending.length})</h4>
                                <Card className="border-primary/20">
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-border">
                                            {bracketPending.map(row => renderBracketRow(row.p))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        {bracketEliminated.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-prototype text-muted-foreground">{atBracketFinalRound ? "Non qualifiés" : "Éliminés"} ({bracketEliminated.length})</h4>
                                <Card className="border-border opacity-80">
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-border">
                                            {bracketEliminated.map(row => renderBracketRow(row.p))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
