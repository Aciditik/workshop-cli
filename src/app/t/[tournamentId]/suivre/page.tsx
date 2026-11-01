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
import { Award, ChevronLeft, ChevronDown, ListOrdered, Ban, Users } from "lucide-react";
import { TEAM_TAGS } from "@/lib/team-tags";
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
    const [mainView, setMainView] = useState<"rounds" | "classement" | "teams">("rounds");
    // Two-day CdF Finale: which day to show. null = follow the live day.
    const [activeDayOverride, setActiveDayOverride] = useState<1 | 2 | null>(null);
    const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
    const toggleTeamExpanded = (teamId: string) => {
        setExpandedTeamIds(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
            return next;
        });
    };

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
    const isFinaleTournament = /finale/i.test(tournament.name);
    // A Finale has no "qualified" players — the empty set removes every
    // qualified highlight for it.
    const qualifiedIds = new Set(isFinaleTournament ? [] : (tournament.qualifiedIds || []));
    const maxRounds = tournament.maxRounds || 3;

    // Two-day CdF Finale — same day scoping as the admin page: Day 1 is
    // rounds 1..day1Rounds, Day 2 the rounds from day2StartRound on,
    // displayed as its own Ronde 1..N with only its 32 participants.
    const isTwoDayFinale = isFinaleTournament && format === "swiss";
    const day1Rounds = 3;
    const day2StartRound = tournament.day2StartRound;
    const day2ParticipantIdSet = new Set(tournament.day2ParticipantIds || []);
    const liveDay: 1 | 2 = (isTwoDayFinale && day2StartRound && (tournament.currentRound || 0) >= day2StartRound) ? 2 : 1;
    const activeDay = activeDayOverride ?? liveDay;
    // Équipes is a Day 1-only view: while Day 2 is active, fall back to
    // Rondes & Tables instead of leaving a tab selected with no content.
    const effectiveMainView = mainView === "teams" && activeDay === 2 ? "rounds" : mainView;
    const day1ScopedMatches = tournament.matches.filter(m => !day2StartRound || m.round < day2StartRound);
    const day2ScopedMatches = tournament.matches.filter(m => day2StartRound && m.round >= day2StartRound);
    const scopedMatches = isTwoDayFinale && day2StartRound
        ? (activeDay === 2 ? day2ScopedMatches : day1ScopedMatches)
        : tournament.matches;
    const scopedParticipants = isTwoDayFinale && day2StartRound && activeDay === 2
        ? tournament.participants.filter(p => day2ParticipantIdSet.has(p.id))
        : tournament.participants;
    const dayMaxRounds = isTwoDayFinale && day2StartRound
        ? (activeDay === 2 ? Math.max(1, maxRounds - day1Rounds) : Math.min(maxRounds, day1Rounds))
        : maxRounds;
    const dayRoundLabelOffset = isTwoDayFinale && day2StartRound && activeDay === 2 ? day1Rounds : 0;

    // Swiss / elimination classement.
    const sortedParticipants = rankSwissPlayers(scopedMatches, scopedParticipants);

    // Bracket classement: same grouping logic as the admin view (advancing /
    // pending / eliminated, no raw points shown — see qualifier-rules.ts).
    const bracketRanked = format === "bracket" ? rankBracketPlayers(tournament.matches, tournament.participants) : [];
    const bracketFinalRound = tournament.matches.reduce((max, m) => Math.max(max, m.round), 0);
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

    // Finale team ranking (Day 1 only) — same rule as the admin view: a
    // team's score is the sum of its members' Day 1 placement points,
    // tie-broken by summed table-diff then summed NT (swiss only). Day 2
    // participants have their `score` reset, so the totals are derived from
    // the Day-1-scoped matches rather than the score field.
    const teamScoreMatches = isTwoDayFinale && day2StartRound ? day1ScopedMatches : tournament.matches;
    const teams = tournament.teams || [];
    const teamRows = teams
        .map(team => {
            const members = tournament.participants.filter(p => p.teamId === team.id);
            const totalScore = members.reduce((sum, p) => sum + (format === "swiss" ? calculateSwissTotalPoints(teamScoreMatches, p.id) : (p.score || 0)), 0);
            const totalDiff = format === "swiss" ? members.reduce((sum, p) => sum + calculateSwissTableDifference(teamScoreMatches, p.id), 0) : 0;
            const totalNT = format === "swiss" ? members.reduce((sum, p) => sum + calculateSwissNTScore(teamScoreMatches, p.id), 0) : 0;
            return { team, members, totalScore, totalDiff, totalNT };
        })
        .sort((a, b) => b.totalScore - a.totalScore || a.totalDiff - b.totalDiff || b.totalNT - a.totalNT);

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

                {isTwoDayFinale && day2StartRound && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveDayOverride(1)}
                            className={`p-3 rounded-xl border text-center transition-colors ${
                                activeDay === 1 ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border text-muted-foreground hover:bg-accent/30"
                            }`}
                        >
                            <div className="font-prototype">Jour 1</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveDayOverride(2)}
                            className={`p-3 rounded-xl border text-center transition-colors ${
                                activeDay === 2 ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border text-muted-foreground hover:bg-accent/30"
                            }`}
                        >
                            <div className="font-prototype">Jour 2</div>
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMainView("rounds")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-prototype text-sm transition-colors ${effectiveMainView === "rounds" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <ListOrdered className="w-4 h-4" />
                            Rondes &amp; Tables
                        </button>
                        <button
                            type="button"
                            onClick={() => setMainView("classement")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-prototype text-sm transition-colors ${effectiveMainView === "classement" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <Award className="w-4 h-4" />
                            Classement
                        </button>
                        {teams.length > 0 && activeDay === 1 && (
                            <button
                                type="button"
                                onClick={() => setMainView("teams")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-prototype text-sm transition-colors ${effectiveMainView === "teams" ? "bg-primary/10 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Users className="w-4 h-4" />
                                Équipes
                            </button>
                        )}
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

                {tournament.status !== "brouillon" && effectiveMainView === "rounds" && (
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
                            matches={scopedMatches}
                            participants={scopedParticipants}
                            currentRound={tournament.currentRound || 0}
                            tournamentId={tournament.id}
                            tournamentName={tournament.name}
                            tournamentLogoUrl={tournament.logoUrl}
                            eventDate={tournament.eventDate}
                            maxRounds={dayMaxRounds}
                            roundLabelOffset={dayRoundLabelOffset}
                            qualifiedIds={isFinaleTournament ? undefined : tournament.qualifiedIds}
                            roundBoards={tournament.roundBoards}
                            usePseudo={showPseudos}
                            readOnly
                        />
                    </>
                )}

                {tournament.status !== "brouillon" && effectiveMainView === "classement" && (format === "swiss" || format === "elimination") && (
                    <Card className="border-primary/20">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {sortedParticipants.map((p, index) => {
                                    const totalPoints = format === "swiss" ? calculateSwissTotalPoints(scopedMatches, p.id) : null;
                                    const ntScore = calculateSwissNTScore(scopedMatches, p.id);
                                    const tableDiff = calculateSwissTableDifference(scopedMatches, p.id);
                                    const showStats = format === "swiss";
                                    const isDay2Cutoff = isFinaleTournament && format === "swiss" && !p.dnf && index < 32;
                                    return (
                                        <div key={p.id} className={`px-3 py-2.5 flex items-center gap-3 ${p.dnf ? "opacity-50 bg-muted/20" : qualifiedIds.has(p.id) ? "bg-yellow-500/5" : isDay2Cutoff ? "bg-orange-500/15" : ""}`}>
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

                {tournament.status !== "brouillon" && effectiveMainView === "classement" && format === "bracket" && (
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

                {tournament.status !== "brouillon" && effectiveMainView === "teams" && activeDay === 1 && (
                    <div className="space-y-2">
                        {teamRows.length === 0 && (
                            <Card className="p-6 text-center">
                                <p className="text-muted-foreground font-prototype">Aucune équipe pour l&apos;instant.</p>
                            </Card>
                        )}
                        {teamRows.map(({ team, members, totalScore }, index) => {
                            const isExpanded = expandedTeamIds.has(team.id);
                            return (
                                <Card key={team.id} className="border-primary/20 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleTeamExpanded(team.id)}
                                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-accent/30 transition-colors text-left"
                                    >
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                            index === 0 ? "bg-yellow-500 text-black" :
                                            index === 1 ? "bg-slate-300 text-black" :
                                            index === 2 ? "bg-amber-600 text-black" : "bg-muted text-muted-foreground"
                                        }`}>
                                            {index + 1}
                                        </span>
                                        {TEAM_TAGS[team.tag] && (
                                            <Image src={TEAM_TAGS[team.tag]} alt={team.tag} width={28} height={28} className="object-contain shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-prototype truncate">{team.name}</p>
                                            <p className="text-xs text-muted-foreground font-prototype">{members.length} joueur{members.length !== 1 ? "s" : ""}</p>
                                        </div>
                                        <span className="font-prototype text-base text-primary tabular-nums px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                                            {totalScore}<span className="text-xs text-muted-foreground ml-0.5">pts</span>
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                    {isExpanded && (
                                        <div className="divide-y divide-border border-t border-border bg-background/40">
                                            {members
                                                .slice()
                                                .sort((a, b) => (b.score || 0) - (a.score || 0))
                                                .map(p => (
                                                    <div key={p.id} className="pl-12 pr-3 py-2 flex items-center gap-3">
                                                        <span className={`font-prototype truncate text-sm ${p.dnf ? "line-through text-muted-foreground" : ""}`}>
                                                            {playerDisplayName(p, showPseudos)}
                                                        </span>
                                                        {p.dnf && (
                                                            <span className="text-[10px] font-prototype px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500 border border-orange-500/30 shrink-0">DNF</span>
                                                        )}
                                                        <span className="ml-auto font-prototype text-sm text-muted-foreground tabular-nums shrink-0">{p.score || 0} pts</span>
                                                    </div>
                                                ))}
                                            {members.length === 0 && (
                                                <p className="pl-12 pr-3 py-2 text-sm text-muted-foreground font-prototype">Aucun joueur assigné.</p>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
