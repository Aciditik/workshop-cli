"use client";

import { use, useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTournaments } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SwissRounds } from "@/components/SwissRounds";
import { Participant, Tournament } from "@/lib/types";
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
import { Trophy, Play, ChevronLeft, ListOrdered, Award, Star, RotateCcw, Plus, X, UserPlus, Download, AlertTriangle, Check, CalendarPlus } from "lucide-react";
import Link from "next/link";

export default function TournamentView({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { tournaments, getTournament, updateTournament, addTournament, isLoaded, refresh } = useTournaments();
    const { user } = useAuth();
    const router = useRouter();
    const isAdmin = user?.role === "admin";
    const [playerFirstname, setPlayerFirstname] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [playerEmail, setPlayerEmail] = useState("");
    const [playerPhone, setPlayerPhone] = useState("");
    const playerInputRef = useRef<HTMLInputElement>(null);

    // Admin mid-tournament player removal confirmation
    const [removeConfirm, setRemoveConfirm] = useState<Participant | null>(null);

    // Finale CdF planning modal (shown when tournament completed)
    const [showFinaleModal, setShowFinaleModal] = useState(false);
    const [availability, setAvailability] = useState<Record<string, boolean>>({});
    const [creatingFinale, setCreatingFinale] = useState(false);

    const tournament = isLoaded ? getTournament(id) : null;

    if (!isLoaded) return <div className="p-8 animate-pulse font-prototype text-muted-foreground">Loading...</div>;
    if (!tournament) return <div className="p-8 font-prototype text-destructive">Tournament not found.</div>;

    const format = tournament.format || "swiss";
    const maxRounds = tournament.maxRounds || 3;
    const qualifiedCount = tournament.status === "brouillon"
        ? getQualifiedCount(tournament.participants.length)
        : (tournament.qualifiedCount || 2);

    const currentRound = tournament.currentRound || 0;

    const generateNextRound = () => {
        console.log("=== GENERATING NEXT ROUND ===");
        console.log("Current round:", currentRound);
        console.log("Format:", format);
        console.log("Player count:", playerCount);
        console.log("Participants count:", tournament.participants.length);
        
        const nextRound = currentRound + 1;
        if (nextRound > maxRounds) return;

        let newMatches;

        if (format === "elimination" && nextRound === 2) {
            // Elimination Round 2: crossed finalist tables
            const round1Matches = tournament.matches.filter(m => m.round === 1);
            console.log("Generating elimination Round 2 with", round1Matches.length, "Round 1 matches");
            newMatches = generateEliminationRound2(tournament.id, playerCount, round1Matches);
        } else {
            // Swiss rounds 2-3: sorted by score
            console.log("Generating Swiss round", nextRound, "with", tournament.participants.length, "participants");
            newMatches = generateSwissRound(tournament.id, tournament.participants, currentRound);
        }

        console.log("Generated", newMatches.length, "new matches");
        console.log("Sending update with:", {
            currentRound: nextRound,
            totalMatches: tournament.matches.length + newMatches.length,
            participantsIncluded: !!tournament.participants,
            participantCount: tournament.participants.length
        });

        updateTournament({
            ...tournament,
            status: "en_cours",
            currentRound: nextRound,
            matches: [...tournament.matches, ...newMatches]
        });
        
        console.log("=== ROUND GENERATION SENT ===");
    };

    const submitMatchResults = (matchId: string, results: Record<string, number>) => {
        if (tournament.status !== "en_cours") return;

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

        // Check if ALL tables (including finale/consolation) are completed
        const allTablesCompleted = updatedMatches.every(m => m.isCompleted);

        // Tournament completes when current round is max AND all tables are truly done
        if (allTablesCompleted && currentRound === maxRounds) {
            newTournamentData.status = "fini";
            newTournamentData.qualifiedIds = determineQualifiedPlayers(
                format, tournament.size, updatedMatches, updatedParticipants
            );
        }

        updateTournament(newTournamentData);
    };

    const declineMatchResults = (matchId: string) => {
        if (tournament.status !== "en_cours") return;

        const updatedMatches = tournament.matches.map(m =>
            m.id === matchId ? { ...m, isPendingReview: false, results: {}, scorecards: undefined } : m
        );

        updateTournament({
            ...tournament,
            matches: updatedMatches,
        });
    };

    // Admin / organizer inline-edit of a pending-review scorecard from the
    // dashboard. Overwrites both raw scorecards and placement results, then
    // validates the match (same end state as submitMatchResults). Admins may
    // also correct already-validated matches, including on finished tournaments.
    const editMatchScorecards = (
        matchId: string,
        results: Record<string, number>,
        scorecards: Record<string, import("@/lib/types").PlayerScore>,
    ) => {
        if (tournament.status === "brouillon") return;

        const updatedMatches = tournament.matches.map(m =>
            m.id === matchId
                ? { ...m, scorecards, results, isCompleted: true, isPendingReview: false }
                : m
        );

        const updatedParticipants = tournament.participants.map(p => {
            let newTotal = 0;
            updatedMatches.forEach(m => {
                if (m.isCompleted && m.results[p.id]) newTotal += m.results[p.id];
            });
            return { ...p, score: newTotal };
        });

        const newTournamentData = {
            ...tournament,
            matches: updatedMatches,
            participants: updatedParticipants,
            qualifiedIds: undefined as string[] | undefined,
        };

        const allTablesCompleted = updatedMatches.every(m => m.isCompleted);
        if (allTablesCompleted && currentRound === maxRounds) {
            newTournamentData.status = "fini";
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
        // All matches must be validated (isCompleted) — pending review is not enough
        return roundMatches.length > 0 && roundMatches.every(m => m.isCompleted);
    };

    const addPlayer = () => {
        const firstname = playerFirstname.trim();
        const name = playerName.trim();
        const email = playerEmail.trim();
        const phone = playerPhone.trim();
        if (!firstname || !name || !email || !phone || tournament.status !== "brouillon") return;

        const newParticipant: Participant = {
            id: crypto.randomUUID(),
            firstname,
            name,
            email,
            phone,
            score: 0,
        };

        updateTournament({
            ...tournament,
            participants: [...tournament.participants, newParticipant],
            size: tournament.participants.length + 1,
        });

        setPlayerFirstname("");
        setPlayerName("");
        setPlayerEmail("");
        setPlayerPhone("");
        playerInputRef.current?.focus();
    };

    const removePlayer = (participantId: string) => {
        // Draft: always allowed. In-progress: admin only. Completed: never (results are frozen).
        if (tournament.status === "fini") return;
        if (tournament.status === "en_cours" && !isAdmin) return;

        const newParticipants = tournament.participants.filter(p => p.id !== participantId);
        const newSize = newParticipants.length;

        // Draft: simple removal.
        if (tournament.status === "brouillon") {
            updateTournament({
                ...tournament,
                participants: newParticipants,
                size: newSize,
            });
            return;
        }

        // Mid-tournament (admin): block if it would go below the minimum playable size.
        if (newSize < 8) {
            alert("Impossible: un tournoi doit conserver au minimum 8 joueurs.");
            return;
        }

        // Recompute format metadata based on the new size.
        // maxRounds is never lowered below the current round to avoid invalidating
        // rounds already generated / en cours.
        const newFormat = getFormat(newSize);
        const newMaxRounds = Math.max(getMaxRounds(newSize), currentRound);
        const newQualifiedCount = getQualifiedCount(newSize);

        // Step 1 — clean the removed player out of every match.
        // Completed matches: keep them (historical record), but strip the removed
        // player from participantIds/results/scorecards so the UI no longer shows
        // them and their points don't influence future ranking computations.
        // Uncompleted matches: same treatment — they'll either be regenerated
        // below (for future rounds) or simply show a freed slot.
        let updatedMatches = tournament.matches.map(m => {
            if (!m.participantIds.includes(participantId)) return m;
            return {
                ...m,
                participantIds: m.participantIds.map(pid => pid === participantId ? null : pid),
                results: Object.fromEntries(
                    Object.entries(m.results || {}).filter(([pid]) => pid !== participantId)
                ),
                scorecards: m.scorecards
                    ? Object.fromEntries(
                        Object.entries(m.scorecards).filter(([pid]) => pid !== participantId)
                    )
                    : m.scorecards,
            };
        });

        // Step 2 — regenerate any *uncompleted* future round that contained the
        // removed player, so that slots cascade correctly instead of leaving
        // "Place vide" and an oversized consolation table (matches the canonical
        // tournament config for the new player count).
        const impactedRounds = Array.from(new Set(
            tournament.matches
                .filter(m => m.round > 1 && m.participantIds.includes(participantId))
                .map(m => m.round)
        )).sort((a, b) => a - b);

        for (const round of impactedRounds) {
            const roundMatches = updatedMatches.filter(m => m.round === round);
            // Only regenerate if the whole round is still uncompleted. If any
            // table is already validated we keep history and leave a null slot.
            if (roundMatches.some(m => m.isCompleted)) continue;

            // Drop this round's matches, then regenerate.
            updatedMatches = updatedMatches.filter(m => m.round !== round);

            if (newFormat === "elimination" && round === 2) {
                // Regenerate finalist + consolation tables from the Round 1
                // completed matches, pretending the removed player was never there.
                const round1ForRanking = updatedMatches
                    .filter(m => m.round === 1)
                    .map(m => ({
                        ...m,
                        // participantIds already had the removed player nulled out in step 1
                        // results already stripped of their entry in step 1
                    }));
                const regenerated = generateEliminationRound2(tournament.id, newSize, round1ForRanking);
                updatedMatches = [...updatedMatches, ...regenerated];
            } else {
                // Swiss: regenerate the next round from participants' accumulated
                // scores (computed from all *remaining* completed matches).
                const scoredParticipants = newParticipants.map(p => {
                    let total = 0;
                    updatedMatches.forEach(m => {
                        if (m.isCompleted && m.results[p.id]) {
                            total += m.results[p.id];
                        }
                    });
                    return { ...p, score: total };
                });
                const regenerated = generateSwissRound(tournament.id, scoredParticipants, round - 1);
                updatedMatches = [...updatedMatches, ...regenerated];
            }
        }

        // Step 3 — recompute scores for surviving participants (historical
        // completed matches may have had the removed player's slot stripped).
        const rescored = newParticipants.map(p => {
            let total = 0;
            updatedMatches.forEach(m => {
                if (m.isCompleted && m.results[p.id]) {
                    total += m.results[p.id];
                }
            });
            return { ...p, score: total };
        });

        updateTournament({
            ...tournament,
            participants: rescored,
            size: newSize,
            format: newFormat,
            maxRounds: newMaxRounds,
            qualifiedCount: newQualifiedCount,
            matches: updatedMatches,
        });
    };

    // ── Finale CdF ────────────────────────────────────────────────────────────
    // When a tournament is completed, admin can pick available qualified players
    // and spin up a brand-new "Finale" tournament pre-populated with them.
    const openFinaleModal = () => {
        if (!tournament.qualifiedIds || tournament.qualifiedIds.length === 0) return;
        // Default everyone to available.
        const initial: Record<string, boolean> = {};
        tournament.qualifiedIds.forEach(qid => { initial[qid] = true; });
        setAvailability(initial);
        setShowFinaleModal(true);
    };

    const createFinaleTournament = async () => {
        if (!tournament.qualifiedIds) return;
        const availableIds = tournament.qualifiedIds.filter(qid => availability[qid]);
        if (availableIds.length === 0) {
            alert("Sélectionnez au moins un joueur disponible pour créer la Finale.");
            return;
        }

        setCreatingFinale(true);
        try {
            // Build fresh participant records (new ids) so the finale tournament
            // owns its own player list independently from the qualifier.
            const newParticipants: Participant[] = availableIds.map(qid => {
                const src = tournament.participants.find(p => p.id === qid);
                return {
                    id: crypto.randomUUID(),
                    firstname: src?.firstname || "",
                    name: src?.name || "Inconnu",
                    email: src?.email || "",
                    phone: src?.phone || "",
                    score: 0,
                };
            });

            // If a brouillon "CdF Finale 2026" already exists (e.g. created from
            // another qualifier), merge new players into it instead of
            // creating a duplicate. Dedup by email (case-insensitive).
            const existingFinale = tournaments.find(
                t => t.name === "CdF Finale 2026" && t.status === "brouillon"
            );

            if (existingFinale) {
                const existingEmails = new Set(
                    existingFinale.participants
                        .map(p => (p.email || "").trim().toLowerCase())
                        .filter(Boolean)
                );
                const toAdd = newParticipants.filter(p => {
                    const e = (p.email || "").trim().toLowerCase();
                    return e ? !existingEmails.has(e) : true;
                });
                const mergedParticipants = [...existingFinale.participants, ...toAdd];
                const size = mergedParticipants.length;

                await updateTournament({
                    ...existingFinale,
                    participants: mergedParticipants,
                    size,
                    format: getFormat(size),
                    maxRounds: getMaxRounds(size),
                    qualifiedCount: getQualifiedCount(size),
                });
                setShowFinaleModal(false);
                // Only admins can view the Finale tournament; organizers just
                // get a confirmation and stay on the qualifier.
                if (isAdmin) {
                    router.push(`/tournaments/${existingFinale.id}`);
                } else {
                    alert(`${toAdd.length} joueur${toAdd.length > 1 ? "s" : ""} ajouté${toAdd.length > 1 ? "s" : ""} à la Finale CdF.`);
                }
                return;
            }

            // Non-admins cannot create the Finale from scratch — only merge into
            // one an admin has already pre-created.
            if (!isAdmin) {
                alert("La Finale CdF n'a pas encore été créée par l'administrateur. Réessayez plus tard.");
                return;
            }

            const size = newParticipants.length;
            const finale: Tournament = {
                id: crypto.randomUUID(),
                name: "CdF Finale 2026",
                logoUrl: "/cdf-logo.png",
                eventDate: "2026-11-14",
                createdAt: new Date().toISOString(),
                status: "brouillon",
                format: getFormat(size),
                participants: newParticipants,
                matches: [],
                size,
                currentRound: 0,
                maxRounds: getMaxRounds(size),
                qualifiedCount: getQualifiedCount(size),
                ...(tournament.ownerId ? { ownerId: tournament.ownerId } : {}),
            };

            await addTournament(finale);
            setShowFinaleModal(false);
            router.push(`/tournaments/${finale.id}`);
        } catch (e) {
            console.error("Failed to create finale tournament", e);
            alert("La création du tournoi Finale a échoué. Réessayez.");
        } finally {
            setCreatingFinale(false);
        }
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
            status: "en_cours",
            format,
            maxRounds,
            qualifiedCount: getQualifiedCount(playerCount),
            currentRound: 1,
            matches: round1Matches,
        });
    };

    const exportTopPlayers = () => {
        const exportCount = qualifiedCount * 2 + 1;
        const topPlayers = sortedParticipants.slice(0, exportCount);
        const csvHeader = "Prénom,Nom,Email,Téléphone";
        const csvRows = topPlayers.map(p => `${p.firstname || ""},${p.name},${p.email || ""},${p.phone || ""}`);
        const csvContent = [csvHeader, ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${tournament.name}_top${exportCount}.csv`;
        link.click();
        URL.revokeObjectURL(url);
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    {tournament.logoUrl && (
                        <img
                            src={tournament.logoUrl}
                            alt={`${tournament.name} logo`}
                            className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-lg bg-muted/50 p-2 shrink-0"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                    )}
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-4xl font-prototype tracking-tight mb-1 sm:mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="truncate">{tournament.name}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-prototype whitespace-nowrap ${tournament.status === "fini" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                                tournament.status === "en_cours" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                                    "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                }`}>
                                {tournament.status === "fini" ? "FINI" : tournament.status === "en_cours" ? "EN COURS" : "BROUILLON"}
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm font-prototype text-muted-foreground">
                            {playerCount} joueur{playerCount > 1 ? "s" : ""} • {getFormatLabel(playerCount)} • {qualifiedCount} qualifié{qualifiedCount > 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={refresh}
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto shrink-0 font-prototype"
                >
                    <RotateCcw className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            {/* Qualified Players Banner */}
            {tournament.status === "fini" && tournament.qualifiedIds && tournament.qualifiedIds.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Award className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-xl font-prototype text-yellow-400">Joueurs Qualifiés</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {tournament.qualifiedIds.map((qId, idx) => {
                                const p = tournament.participants.find(pp => pp.id === qId);
                                return (
                                    <div key={qId} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
                                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                        <div>
                                            <p className="font-prototype">{p?.firstname} {p?.name || "Inconnu"}</p>
                                            <p className="text-xs font-prototype text-muted-foreground">Qualifié #{idx + 1}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-yellow-500/20 flex flex-col sm:flex-row gap-3">
                            <Button onClick={exportTopPlayers} className="gap-2 font-prototype" variant="outline">
                                <Download className="w-4 h-4" />
                                Exporter le top {qualifiedCount * 2 + 1} (CSV)
                            </Button>
                            <Button onClick={openFinaleModal} className="gap-2 font-prototype bg-yellow-500 hover:bg-yellow-500/90 text-black">
                                <CalendarPlus className="w-4 h-4" />
                                Ajouter les joueurs à la finale de la CdF
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* brouillon Mode: Player Management */}
            {tournament.status === "brouillon" && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-400 font-prototype">
                            <UserPlus className="w-5 h-5" />
                            Ajouter des joueurs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add player form */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    ref={playerInputRef}
                                    type="text"
                                    value={playerFirstname}
                                    onChange={(e) => setPlayerFirstname(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Prénom *"
                                    required
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Nom *"
                                    required
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="email"
                                    value={playerEmail}
                                    onChange={(e) => setPlayerEmail(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Email *"
                                    required
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="tel"
                                    value={playerPhone}
                                    onChange={(e) => setPlayerPhone(e.target.value)}
                                    onKeyDown={handlePlayerKeyDown}
                                    placeholder="Téléphone *"
                                    required
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <Button onClick={addPlayer} className="gap-2 w-full md:w-auto font-prototype">
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
                                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-prototype text-muted-foreground shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="font-prototype">{p.firstname} {p.name}</span>
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
                            <p className="text-sm font-prototype text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                                Aucun joueur ajouté. Ajoutez au moins 8 joueurs pour lancer le tournoi.
                            </p>
                        )}

                        {/* Start tournament button */}
                        <div className="pt-4 border-t">
                            <Button
                                onClick={startTournament}
                                disabled={playerCount < 8}
                                className="w-full gap-2 font-prototype"
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
                            <h3 className="text-2xl font-prototype flex items-center gap-2">
                                <ListOrdered className="w-6 h-6 text-primary" />
                                Rondes & Tables
                            </h3>
                            {tournament.status === "fini" ? (
                                <div className="text-green-500 font-prototype bg-green-500/10 px-4 py-2 rounded-lg">
                                    Tournoi Terminé !
                                </div>
                            ) : canGenerateNextRound() ? (
                                <Button onClick={generateNextRound} className="gap-2 font-prototype" variant="secondary">
                                    <Play className="w-4 h-4 fill-foreground" />
                                    Générer Ronde {currentRound + 1}
                                </Button>
                            ) : null}
                        </div>
                        <SwissRounds
                            matches={tournament.matches}
                            participants={tournament.participants}
                            onSubmitResults={submitMatchResults}
                            onDeclineResults={declineMatchResults}
                            onEditScorecards={editMatchScorecards}
                            isAdmin={isAdmin}
                            currentRound={tournament.currentRound || 0}
                            tournamentId={tournament.id}
                            tournamentName={tournament.name}
                            tournamentLogoUrl={tournament.logoUrl}
                            eventDate={tournament.eventDate}
                            maxRounds={maxRounds}
                            qualifiedIds={tournament.qualifiedIds}
                        />
                    </div>

                    <div>
                        <Card className="sticky top-8 border-primary/20">
                            <CardHeader className="bg-primary/5 border-b border-border">
                                <CardTitle className="flex items-center gap-2 font-prototype">
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
                                            <div key={p.id} className={`p-4 flex items-center justify-between gap-3 hover:bg-accent/30 transition-colors group ${qualifiedIds.has(p.id) ? "bg-yellow-500/5" : ""}`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${index === 0 ? "bg-yellow-500" :
                                                        index === 1 ? "bg-slate-300" :
                                                            index === 2 ? "bg-amber-600" : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-prototype truncate">{p.firstname} {p.name}</span>
                                                    {qualifiedIds.has(p.id) && (
                                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {tournament.status !== "brouillon" && (
                                                        <>
                                                            {tableDiff > 0 && (
                                                                <span className="text-sm font-prototype text-orange-600">
                                                                    Diff {tableDiff}
                                                                </span>
                                                            )}
                                                            {ntScore > 0 && (
                                                                <span className="text-sm font-prototype text-blue-600">
                                                                    {ntScore} NT
                                                                </span>
                                                            )}
                                                            {totalPoints !== null && (
                                                                <span className="text-sm font-prototype text-muted-foreground">
                                                                    {totalPoints} pts
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {isAdmin && tournament.status === "en_cours" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRemoveConfirm(p)}
                                                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Retirer ce joueur du tournoi (admin)"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
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

            {/* Admin: Confirm player removal mid-tournament */}
            {removeConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={() => setRemoveConfirm(null)}
                >
                    <div
                        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-border flex items-start gap-3">
                            <div className="bg-red-500/20 p-2 rounded-full shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-prototype">Retirer un joueur du tournoi</h3>
                                <p className="text-sm text-muted-foreground font-prototype">Cette action est réservée à l&apos;administration.</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3 text-sm font-prototype">
                            <p>
                                Vous êtes sur le point de retirer{" "}
                                <strong>{removeConfirm.firstname} {removeConfirm.name}</strong> du tournoi.
                            </p>
                            {(() => {
                                const newSize = tournament.participants.length - 1;
                                const newMax = Math.max(getMaxRounds(newSize), currentRound);
                                const newQual = getQualifiedCount(newSize);
                                return (
                                    <div className="rounded-lg border border-border bg-background/50 p-3 space-y-1 text-xs text-muted-foreground">
                                        <p>• Le tournoi passera à <strong className="text-foreground">{newSize} joueurs</strong>.</p>
                                        <p>• Format recalculé: <strong className="text-foreground">{getFormatLabel(newSize)}</strong>.</p>
                                        <p>• Rondes: <strong className="text-foreground">{newMax}</strong> · Qualifiés: <strong className="text-foreground">{newQual}</strong>.</p>
                                        <p>• Les rondes déjà validées restent dans l&apos;historique.</p>
                                        <p>• Les rondes suivantes non jouées seront <strong className="text-foreground">régénérées</strong> pour correspondre au nouveau format ({newSize} joueurs).</p>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="p-5 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
                            <Button variant="outline" className="w-full font-prototype" onClick={() => setRemoveConfirm(null)}>
                                Annuler
                            </Button>
                            <Button
                                className="w-full font-prototype bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                onClick={() => {
                                    removePlayer(removeConfirm.id);
                                    setRemoveConfirm(null);
                                }}
                            >
                                Retirer le joueur
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finale CdF: pick available qualified players and create the finale tournament */}
            {showFinaleModal && tournament.qualifiedIds && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
                    onClick={() => !creatingFinale && setShowFinaleModal(false)}
                >
                    <div
                        className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-border flex items-start gap-3">
                            <div className="bg-yellow-500/20 p-2 rounded-full shrink-0">
                                <CalendarPlus className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-prototype">Ajouter les joueurs à la finale de la CdF</h3>
                                <p className="text-sm text-muted-foreground font-prototype">
                                    Cochez les joueurs disponibles. {isAdmin ? "La Finale sera créée (ou mise à jour) avec eux." : "Ils seront ajoutés à la Finale gérée par l'administrateur."}
                                </p>
                            </div>
                        </div>

                        <div className="p-5 space-y-2 overflow-y-auto flex-1">
                            {tournament.qualifiedIds.map((qid, idx) => {
                                const p = tournament.participants.find(pp => pp.id === qid);
                                const available = !!availability[qid];
                                return (
                                    <button
                                        key={qid}
                                        type="button"
                                        onClick={() => setAvailability(prev => ({ ...prev, [qid]: !prev[qid] }))}
                                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors text-left ${available ? "border-green-500/40 bg-green-500/10" : "border-border bg-background/50 hover:bg-accent/40"}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-prototype shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="font-prototype truncate">{p?.firstname} {p?.name || "Inconnu"}</div>
                                                {p?.email && <div className="text-xs text-muted-foreground font-prototype truncate">{p.email}</div>}
                                            </div>
                                        </div>
                                        <div className={`shrink-0 flex items-center gap-2 text-sm font-prototype ${available ? "text-green-500" : "text-muted-foreground"}`}>
                                            {available ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Disponible
                                                </>
                                            ) : (
                                                <>
                                                    <X className="w-4 h-4" />
                                                    Indisponible
                                                </>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-5 border-t border-border space-y-3">
                            {(() => {
                                const availableCount = Object.values(availability).filter(Boolean).length;
                                return (
                                    <p className="text-sm font-prototype text-muted-foreground text-center">
                                        {availableCount} joueur{availableCount > 1 ? "s" : ""} disponible{availableCount > 1 ? "s" : ""}
                                        {availableCount > 0 && availableCount < 8 && " — la Finale sera créée en brouillon, vous pourrez ajouter d'autres joueurs ensuite"}
                                    </p>
                                );
                            })()}
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <Button
                                    variant="outline"
                                    className="w-full font-prototype"
                                    onClick={() => setShowFinaleModal(false)}
                                    disabled={creatingFinale}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="w-full font-prototype bg-yellow-500 hover:bg-yellow-500/90 text-black"
                                    onClick={createFinaleTournament}
                                    disabled={creatingFinale || Object.values(availability).filter(Boolean).length === 0}
                                >
                                    {creatingFinale ? "Envoi..." : (isAdmin ? "Créer / Mettre à jour la Finale" : "Ajouter à la Finale")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
