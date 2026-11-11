"use client";

import { use, useEffect, useState, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { Tournament, Team } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import {
    matchScoreTotal,
    calculateSwissTotalPoints,
    calculateSwissNTScore,
    calculateSwissTableDifference,
} from "@/lib/qualifier-rules";
import { SwissRounds } from "@/components/SwissRounds";
import { TeamsStreamView, TeamStreamEntry } from "@/components/TeamsStreamView";
import { StreamStatsView } from "@/components/StreamStatsView";
import { TEAM_TAGS } from "@/lib/team-tags";
import { CORPORATION_LOGOS } from "@/lib/corporation-logos";
import { canonicalCorporation, CORPORATION_PLACEHOLDER } from "@/lib/corporations";
import { ListOrdered, Users, Lock, BarChart3 } from "lucide-react";
import Image from "next/image";

// Read-only broadcast view for the streamer account: large, self-explanatory
// numbers for the finale. Same suspense rules as the spectator view — a day's
// final round stays hidden (cards "—", classement empty) until the organizer
// publishes it.
export default function TournamentStreamPage({ params }: { params: Promise<{ tournamentId: string }> }) {
    return (
        <Suspense fallback={<div className="p-8 text-center animate-pulse font-prototype">Chargement du tournoi...</div>}>
            <TournamentStream params={params} />
        </Suspense>
    );
}

function TournamentStream({ params }: { params: Promise<{ tournamentId: string }> }) {
    const { tournamentId } = use(params);
    const searchParams = useSearchParams();
    // ?stream=1 strips navigation chrome for an OBS scene; ?view=... picks the
    // initial tab (useful combined with ?stream=1 for a dedicated scene);
    // ?rosters=1 opens the Équipes view with every card already flipped;
    // ?rotate=N auto-pages the team grid every N seconds in stream mode.
    const streamMode = searchParams.get("stream") === "1";
    const initialRostersOpen = searchParams.get("rosters") === "1";
    const rotateParam = parseInt(searchParams.get("rotate") || "", 10);
    const rotateSeconds = Number.isFinite(rotateParam) && rotateParam > 0 ? rotateParam : undefined;
    const viewParam = searchParams.get("view");
    const initialView = viewParam === "rounds" || viewParam === "teams" || viewParam === "classement" || viewParam === "stats"
        ? viewParam : "classement";

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [mainView, setMainView] = useState<"rounds" | "classement" | "teams" | "stats">(initialView);
    const [activeDayOverride, setActiveDayOverride] = useState<1 | 2 | null>(null);

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
        const interval = setInterval(load, 10000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [tournamentId]);

    if (loading) return <div className="p-8 text-center animate-pulse font-prototype">Chargement du tournoi...</div>;
    if (!tournament) return <div className="p-8 text-center text-red-500 font-prototype">Tournoi introuvable.</div>;

    const format = tournament.format || "swiss";
    const isFinaleTournament = /finale/i.test(tournament.name);
    const maxRounds = tournament.maxRounds || 3;
    const teams: Team[] = tournament.teams || [];
    const teamById = new Map(teams.map((t) => [t.id, t]));

    // Two-day CdF Finale — same day scoping as the spectator view.
    const isTwoDayFinale = isFinaleTournament && format === "swiss";
    const day1Rounds = 3;
    const day2StartRound = tournament.day2StartRound;
    const day2ParticipantIdSet = new Set(tournament.day2ParticipantIds || []);
    const liveDay: 1 | 2 = (isTwoDayFinale && day2StartRound && (tournament.currentRound || 0) >= day2StartRound) ? 2 : 1;
    const activeDay = activeDayOverride ?? liveDay;
    const day1ScopedMatches = tournament.matches.filter((m) => !day2StartRound || m.round < day2StartRound);
    const day2ScopedMatches = tournament.matches.filter((m) => day2StartRound && m.round >= day2StartRound);
    const scopedMatches = isTwoDayFinale && day2StartRound
        ? (activeDay === 2 ? day2ScopedMatches : day1ScopedMatches)
        : tournament.matches;
    const scopedParticipants = isTwoDayFinale && day2StartRound && activeDay === 2
        ? tournament.participants.filter((p) => day2ParticipantIdSet.has(p.id))
        : tournament.participants;
    const dayMaxRounds = isTwoDayFinale && day2StartRound
        ? (activeDay === 2 ? Math.max(1, maxRounds - day1Rounds) : Math.min(maxRounds, day1Rounds))
        : maxRounds;
    const dayRoundLabelOffset = isTwoDayFinale && day2StartRound && activeDay === 2 ? day1Rounds : 0;

    // Suspense gates — same rules as /suivre.
    const dayPublished = isTwoDayFinale
        ? (activeDay === 1 ? !!tournament.day1ResultsPublished : !!tournament.day2ResultsPublished)
        : true;
    const dayFinalRound = isTwoDayFinale ? dayMaxRounds + dayRoundLabelOffset : -1;
    const currentDayBlurred = isTwoDayFinale && !dayPublished &&
        scopedMatches.some((m) => m.round === dayFinalRound && m.isCompleted);
    const hiddenResultRounds = currentDayBlurred ? new Set([dayFinalRound]) : undefined;
    // Équipes is a Day 1-only view: while Day 2 is active, fall back to the
    // classement instead of leaving a tab selected with no content.
    const effectiveMainView = mainView === "teams" && activeDay === 2 ? "classement" : mainView;

    // ─── Statistiques ───────────────────────────────────────────────────
    // Tournament-wide aggregate, independent of the Jour 1/Jour 2 toggle, but
    // still suspense-safe: strip out whichever day's final round is hidden
    // (Day 1 and Day 2 are gated independently) so corp picks / best score /
    // distribution can't leak a result before the organizer publishes it.
    const day1HiddenRound = isTwoDayFinale && !tournament.day1ResultsPublished ? day1Rounds : null;
    const day2HiddenRound = isTwoDayFinale && day2StartRound && !tournament.day2ResultsPublished ? maxRounds : null;
    const statsMatches = tournament.matches.filter(
        (m) => m.round !== day1HiddenRound && m.round !== day2HiddenRound
    );

    // ─── Round stat cards ────────────────────────────────────────────────
    // "Current round" = the most recent round of the displayed day that has
    // tables. If every table is validated it is shown as finished.
    const absoluteCurrentRound = scopedMatches.reduce((max, m) => Math.max(max, m.round), 0);
    const relCurrentRound = absoluteCurrentRound - dayRoundLabelOffset;
    const roundBoard = absoluteCurrentRound > 0 ? tournament.roundBoards?.[absoluteCurrentRound] : undefined;
    const currentRoundMatches = scopedMatches.filter((m) => m.round === absoluteCurrentRound);
    const roundFinished = currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.isCompleted);
    // Cards never leak the suspense-gated final round.
    const cardsHidden = isTwoDayFinale && !dayPublished && absoluteCurrentRound === dayFinalRound;

    interface RoundEntry { pid: string; total: number; points: number; corporation: string }
    const roundEntries: RoundEntry[] = currentRoundMatches
        .filter((m) => m.isCompleted)
        .flatMap((m) =>
            m.participantIds
                .filter((pid): pid is string => !!pid && !!m.scorecards?.[pid])
                .map((pid) => ({
                    pid,
                    total: matchScoreTotal(m, pid),
                    points: m.results[pid] || 0,
                    corporation: m.scorecards![pid].corporation
                        ? canonicalCorporation(m.scorecards![pid].corporation)
                        : "",
                }))
        );
    const participantById = new Map(tournament.participants.map((p) => [p.id, p]));

    const bestEntry = roundEntries.reduce<RoundEntry | null>(
        (best, e) => (!best || e.total > best.total ? e : best), null
    );
    const bestPlayer = bestEntry ? participantById.get(bestEntry.pid) : undefined;
    const bestPlayerTeam = bestPlayer?.teamId ? teamById.get(bestPlayer.teamId) : undefined;
    const avgScore = roundEntries.length > 0
        ? roundEntries.reduce((sum, e) => sum + e.total, 0) / roundEntries.length
        : 0;

    const corpCounts = new Map<string, number>();
    for (const e of roundEntries) {
        if (!e.corporation || e.corporation === CORPORATION_PLACEHOLDER || e.corporation === "Pas de corporation") continue;
        corpCounts.set(e.corporation, (corpCounts.get(e.corporation) || 0) + 1);
    }
    const maxCorpCount = Math.max(0, ...corpCounts.values());
    const topCorps = maxCorpCount > 0
        ? [...corpCounts.entries()].filter(([, n]) => n === maxCorpCount).map(([c]) => c).sort()
        : [];

    const teamRoundTotals = teams.map((team) => ({
        team,
        total: roundEntries
            .filter((e) => participantById.get(e.pid)?.teamId === team.id)
            .reduce((sum, e) => sum + e.points, 0),
    }));
    const bestTeam = teamRoundTotals.reduce<{ team: Team; total: number } | null>(
        (best, t) => (t.total > 0 && (!best || t.total > best.total) ? t : best), null
    );

    // ─── Équipes classement ──────────────────────────────────────────────
    // Same rule as the spectator view: totals come from the Day-1-scoped
    // matches (Day 2 participants have their score reset), tie-broken by
    // summed table-diff then summed NT. Day 1 only.
    const teamScoreMatches = isTwoDayFinale && day2StartRound ? day1ScopedMatches : scopedMatches;
    const hasTeamScores = teamScoreMatches.some((m) => m.isCompleted);
    const teamRows = teams
        .map((team) => {
            const members = tournament.participants.filter((p) => p.teamId === team.id);
            const totalScore = members.reduce((sum, p) => sum + calculateSwissTotalPoints(teamScoreMatches, p.id), 0);
            const totalDiff = members.reduce((sum, p) => sum + calculateSwissTableDifference(teamScoreMatches, p.id), 0);
            const totalNT = members.reduce((sum, p) => sum + calculateSwissNTScore(teamScoreMatches, p.id), 0);
            return { team, members, totalScore, totalDiff, totalNT };
        })
        .sort((a, b) => b.totalScore - a.totalScore || a.totalDiff - b.totalDiff || b.totalNT - a.totalNT);
    // Standard competition ranking (1, 2, 2, 4 ...) — tied teams share a rank
    // instead of being arbitrarily split by the tie-break fields above, which
    // only decide display order, not the rank *number* shown on the card.
    let lastRank = 0;
    let lastRankScore: number | null = null;
    const teamEntries: TeamStreamEntry[] = teamRows.map(({ team, members, totalScore }, idx) => {
        if (lastRankScore === null || totalScore !== lastRankScore) {
            lastRank = idx + 1;
            lastRankScore = totalScore;
        }
        const displayName = currentDayBlurred ? "Team ???" : team.name;
        const displayTag = currentDayBlurred ? "Wild" : team.tag;
        const players = members
            .map((p) => {
                const games = teamScoreMatches.filter((m) => m.isCompleted && m.scorecards?.[p.id]).length;
                return {
                    id: p.id,
                    name: playerDisplayName(p, false),
                    points: games > 0 ? calculateSwissTotalPoints(teamScoreMatches, p.id) : null,
                    dnf: !!p.dnf,
                };
            })
            .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity));
        return {
            id: team.id,
            name: displayName,
            tag: displayTag,
            points: hasTeamScores ? totalScore : null,
            rank: lastRank,
            players,
        };
    });
    const day1CurrentRound = day1ScopedMatches.reduce((max, m) => Math.max(max, m.round), 0);
    const teamsRoundLabel = day1CurrentRound > 0
        ? `Mis à jour après la ronde ${day1CurrentRound}`
        : "En attente de la première ronde";

    // ─── Classement ──────────────────────────────────────────────────────
    const rows = scopedParticipants.map((p) => {
        const pts = calculateSwissTotalPoints(scopedMatches, p.id);
        const nt = calculateSwissNTScore(scopedMatches, p.id);
        const diff = calculateSwissTableDifference(scopedMatches, p.id);
        const games = scopedMatches.filter((m) => m.isCompleted && m.scorecards?.[p.id]).length;
        return { p, pts, nt, diff, games, avg: games > 0 ? nt / games : 0 };
    });
    rows.sort((a, b) => {
        if (!!a.p.dnf !== !!b.p.dnf) return a.p.dnf ? 1 : -1;
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (a.diff !== b.diff) return a.diff - b.diff;
        return b.avg - a.avg;
    });
    const hasCompletedMatch = scopedMatches.some((m) => m.isCompleted);
    const maxAvg = Math.max(1, ...rows.map((r) => r.avg));
    const maxPts = Math.max(1, ...rows.map((r) => r.pts));
    // Top-32 cut line: Day 1 of a two-day finale only. Visible throughout
    // Round 1/2 (and Round 3 once published) — only hidden while the
    // classement itself is suspense-locked behind an unpublished Round 3.
    // Once Day 2 exists the actual qualifiers are known, so badge from
    // day2ParticipantIds rather than rank alone (covers DNF/manual edits
    // between the two days).
    const showCutLine = isTwoDayFinale && activeDay === 1 && !currentDayBlurred;

    const pill = (on: boolean) =>
        `px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-prototype transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`;

    return (
        <div className="min-h-screen relative">
            {/* Mars canyon artwork backdrop — dimmed so the broadcast cards
                stay readable; lighter dim in ?stream=1 scene mode. */}
            <div className="fixed inset-0 z-0">
                <Image src="/background.png" alt="" fill className="object-cover" priority />
                <div className={`absolute inset-0 ${streamMode ? "bg-black/55" : "bg-background/80"}`} />
            </div>
            <div className={`relative z-10 mx-auto px-4 py-6 space-y-6 ${streamMode ? "max-w-[1800px]" : "max-w-6xl 2xl:max-w-7xl"}`}>
                {/* Header — hidden entirely in ?stream=1 scenes (no nav chrome) */}
                {!streamMode && (
                    <div className="flex flex-col items-center gap-3 text-center">
                        {tournament.logoUrl && (
                            <img src={tournament.logoUrl} alt="" className="w-20 h-20 object-contain" />
                        )}
                        <h1 className="text-2xl sm:text-4xl font-prototype tracking-tight">{tournament.name}</h1>
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-prototype ${tournament.status === "fini"
                                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                : tournament.status === "en_cours"
                                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    : "bg-orange-500/10 text-orange-500 border border-orange-500/20"}`}>
                                {tournament.status === "fini" ? "FINI" : tournament.status === "en_cours" ? "EN COURS" : "BROUILLON"}
                            </span>
                            <span className="text-xs text-muted-foreground font-prototype">
                                {new Date(tournament.eventDate).toLocaleDateString()} · {tournament.participants.length} joueurs
                            </span>
                        </div>
                        {isTwoDayFinale && day2StartRound && (
                            <div className="flex items-center gap-1 bg-card/50 border border-border rounded-lg p-1">
                                <button type="button" onClick={() => setActiveDayOverride(1)} className={pill(activeDay === 1)}>Jour 1</button>
                                <button type="button" onClick={() => setActiveDayOverride(2)} className={pill(activeDay === 2)}>Jour 2</button>
                            </div>
                        )}
                        <div className="flex items-center gap-1 bg-card/50 border border-border rounded-lg p-1">
                            <button type="button" onClick={() => setMainView("classement")} className={pill(effectiveMainView === "classement")}>
                                <ListOrdered className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Classement
                            </button>
                            <button type="button" onClick={() => setMainView("rounds")} className={pill(effectiveMainView === "rounds")}>
                                <Users className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Rondes &amp; Tables
                            </button>
                            {teams.length > 0 && activeDay === 1 && (
                                <button type="button" onClick={() => setMainView("teams")} className={pill(effectiveMainView === "teams")}>
                                    <Users className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Équipes
                                </button>
                            )}
                            <button type="button" onClick={() => setMainView("stats")} className={pill(effectiveMainView === "stats")}>
                                <BarChart3 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />Statistiques
                            </button>
                        </div>
                    </div>
                )}

                {effectiveMainView === "rounds" && (
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
                        roundBoards={tournament.roundBoards}
                        teams={activeDay === 1 ? teams : undefined}
                        hiddenResultRounds={hiddenResultRounds}
                        readOnly
                    />
                )}

                {effectiveMainView === "classement" && (
                    <div className="space-y-8">
                        {/* ── Round stat cards ── */}
                        <section>
                            <h2 className="text-lg sm:text-xl font-prototype mb-4">
                                {absoluteCurrentRound > 0 ? (
                                    <>Ronde {relCurrentRound}{roundBoard ? ` · ${roundBoard}` : ""}
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                            {roundFinished ? "(ronde terminée)" : "(en direct)"}
                                        </span>
                                    </>
                                ) : "En attente de la première ronde"}
                            </h2>
                            {cardsHidden && (
                                <p className="flex items-center gap-2 text-xs text-muted-foreground font-prototype mb-3">
                                    <Lock className="w-3.5 h-3.5" /> Résultats masqués jusqu&apos;à publication par l&apos;organisateur.
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Meilleur score */}
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Meilleur score</p>
                                    <p className="text-[28px] leading-tight font-prototype mt-1">
                                        {!cardsHidden && bestEntry ? bestEntry.total : "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 min-h-[18px]">
                                        {!cardsHidden && bestPlayer && (
                                            <>
                                                {bestPlayerTeam && TEAM_TAGS[bestPlayerTeam.tag] && (
                                                    <Image src={TEAM_TAGS[bestPlayerTeam.tag]} alt={bestPlayerTeam.name} width={16} height={16} />
                                                )}
                                                <span className="truncate">{playerDisplayName(bestPlayer, false)}</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                {/* Score moyen */}
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Score moyen</p>
                                    <p className="text-[28px] leading-tight font-prototype mt-1">
                                        {!cardsHidden && roundEntries.length > 0 ? avgScore.toFixed(1) : "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 min-h-[18px]">
                                        {!cardsHidden && roundEntries.length > 0 ? `${roundEntries.length} scores` : ""}
                                    </p>
                                </div>
                                {/* Corporation la plus choisie */}
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Corporation la plus choisie</p>
                                    <p className="text-lg leading-tight font-prototype mt-2 truncate" title={topCorps.join(", ")}>
                                        {!cardsHidden && topCorps.length > 0
                                            ? `${topCorps.slice(0, 2).join(", ")}${topCorps.length > 2 ? ` +${topCorps.length - 2}` : ""}`
                                            : "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 min-h-[18px]">
                                        {!cardsHidden && topCorps.length > 0 && (
                                            <>
                                                {CORPORATION_LOGOS[topCorps[0]] && (
                                                    <Image src={CORPORATION_LOGOS[topCorps[0]]} alt={topCorps[0]} width={16} height={16} />
                                                )}
                                                <span>choisie par {maxCorpCount} joueur{maxCorpCount > 1 ? "s" : ""}</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                {/* Équipe la plus performante */}
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4">
                                    <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Équipe la plus performante</p>
                                    <p className="text-lg leading-tight font-prototype mt-2 truncate">
                                        {!cardsHidden && bestTeam ? bestTeam.team.name : "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 min-h-[18px]">
                                        {!cardsHidden && bestTeam && (
                                            <>
                                                {TEAM_TAGS[bestTeam.team.tag] && (
                                                    <Image src={TEAM_TAGS[bestTeam.team.tag]} alt={bestTeam.team.name} width={16} height={16} />
                                                )}
                                                <span>{bestTeam.total} pts de ronde</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* ── Classement ── */}
                        <section>
                            <h2 className="text-lg sm:text-xl font-prototype mb-4">
                                Classement{isTwoDayFinale ? ` — Jour ${activeDay}` : ""}
                            </h2>
                            {currentDayBlurred ? (
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-10 text-center">
                                    <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground font-prototype">Classement du Jour {activeDay} masqué — en attente de publication par l&apos;organisateur.</p>
                                </div>
                            ) : !hasCompletedMatch ? (
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-10 text-center">
                                    <p className="text-muted-foreground font-prototype">Classement disponible à la fin de la première ronde.</p>
                                </div>
                            ) : (
                                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] overflow-x-auto">
                                    <table className="w-full text-sm font-prototype border-collapse min-w-[720px]">
                                        <thead>
                                            <tr className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-muted-foreground">
                                                <th className="px-3 py-3 text-center w-12 sticky left-0 bg-[#16151a] z-10">Place</th>
                                                <th className="px-3 py-3 text-center w-12 sticky left-12 bg-[#16151a] z-10">Équipe</th>
                                                <th className="px-3 py-3 text-left sticky left-24 bg-[#16151a] z-10 min-w-[160px]">Nom</th>
                                                <th className="px-3 py-3 text-center">Parties</th>
                                                <th className="px-3 py-3 text-center">NT moy.</th>
                                                <th className="px-3 py-3 text-center">Diff</th>
                                                <th className="px-3 py-3 text-center">NT total</th>
                                                <th className="px-3 py-3 text-center">Pts de ronde</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, i) => {
                                                const rank = i + 1;
                                                const team = r.p.teamId ? teamById.get(r.p.teamId) : undefined;
                                                const qualified = showCutLine &&
                                                    (day2ParticipantIdSet.size > 0 ? day2ParticipantIdSet.has(r.p.id) : rank <= 32);
                                                const medal = rank === 1 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                                                    : rank === 2 ? "bg-gray-300/15 text-gray-300 border-gray-300/30"
                                                    : rank === 3 ? "bg-amber-700/20 text-amber-500 border-amber-700/40"
                                                    : "bg-white/5 text-muted-foreground border-white/10";
                                                const green = Math.min(1, r.pts / maxPts);
                                                return (
                                                    <Fragment key={r.p.id}>
                                                        <tr className={`border-t border-white/5 h-14 ${r.p.dnf ? "opacity-50" : ""}`}>
                                                            <td className="px-3 py-2 text-center sticky left-0 bg-[#16151a] z-10">
                                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs ${medal}`}>{rank}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-center sticky left-12 bg-[#16151a] z-10">
                                                                {team && TEAM_TAGS[team.tag] ? (
                                                                    <Image src={TEAM_TAGS[team.tag]} alt={team.name} title={team.name} width={24} height={24} className="inline-block" />
                                                                ) : "—"}
                                                            </td>
                                                            <td className="px-3 py-2 sticky left-24 bg-[#16151a] z-10 min-w-[160px]">
                                                                <div className="flex items-center gap-2">
                                                                    {qualified && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 uppercase tracking-wide shrink-0">Qualifié</span>
                                                                    )}
                                                                    <span className="truncate">{playerDisplayName(r.p, false)}{r.p.dnf ? " (DNF)" : ""}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-center tabular-nums">{r.games}</td>
                                                            <td className="px-3 py-2 text-center tabular-nums">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span>{r.avg.toFixed(1)}</span>
                                                                    <div className="w-14 h-1 rounded-full bg-white/10 overflow-hidden">
                                                                        <div className="h-full bg-primary/70" style={{ width: `${(r.avg / maxAvg) * 100}%` }} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-center tabular-nums text-[#e8743b]">{r.diff}</td>
                                                            <td className="px-3 py-2 text-center tabular-nums text-blue-400">{r.nt}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span
                                                                    className="inline-block px-3.5 py-1.5 rounded-md text-sm font-bold tabular-nums border"
                                                                    style={{
                                                                        backgroundColor: `rgba(34, 197, 94, ${0.08 + green * 0.35})`,
                                                                        borderColor: `rgba(34, 197, 94, ${0.2 + green * 0.4})`,
                                                                        color: green > 0.5 ? "#86efac" : "#a3a3a3",
                                                                    }}
                                                                >{r.pts}</span>
                                                            </td>
                                                        </tr>
                                                        {showCutLine && rows.length > 32 && rank === 32 && (
                                                            <tr aria-hidden="true">
                                                                <td colSpan={8} className="p-0">
                                                                    <div className="border-y-2 border-dashed border-green-500/70 bg-green-500/10 relative">
                                                                        <span className="block text-center py-1.5 text-[11px] uppercase tracking-wider text-green-300 font-prototype whitespace-nowrap">
                                                                            — Top 32 · qualifiés pour le Jour 2 —
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {effectiveMainView === "teams" && activeDay === 1 && (
                    <TeamsStreamView
                        teams={teamEntries}
                        blurred={currentDayBlurred}
                        roundLabel={teamsRoundLabel}
                        initialRostersOpen={initialRostersOpen}
                        streamMode={streamMode}
                        rotateSeconds={rotateSeconds}
                    />
                )}

                {effectiveMainView === "stats" && (
                    <StreamStatsView
                        participants={tournament.participants}
                        matches={statsMatches}
                        roundBoards={tournament.roundBoards}
                    />
                )}
            </div>
        </div>
    );
}
