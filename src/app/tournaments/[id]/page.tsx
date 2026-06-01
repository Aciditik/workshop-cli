"use client";

import { use, useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTournaments } from "@/lib/store";
import { useAuth, getApiUrl } from "@/lib/auth";
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
import { Trophy, Play, ChevronLeft, ListOrdered, Award, Star, RotateCcw, Plus, X, UserPlus, Download, AlertTriangle, Check, CalendarPlus, Pencil, Settings, Upload } from "lucide-react";
import Link from "next/link";

export default function TournamentView({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { tournaments, getTournament, updateTournament, addTournament, isLoaded, refresh } = useTournaments();
    const { user } = useAuth();
    const router = useRouter();
    const isAdmin = user?.role === "admin";
    const { token } = useAuth();

    // Admin tournament edit modal (name, date, logo, owner)
    const [showTournamentEdit, setShowTournamentEdit] = useState(false);
    const [editTName, setEditTName] = useState("");
    const [editTDate, setEditTDate] = useState("");
    const [editTLogoUrl, setEditTLogoUrl] = useState("");
    const [editTLogoFileName, setEditTLogoFileName] = useState("");
    const [editTOwnerId, setEditTOwnerId] = useState("");
    const [organizers, setOrganizers] = useState<{ id: string; name: string; email: string; city?: string }[]>([]);
    const [savingTournament, setSavingTournament] = useState(false);

    useEffect(() => {
        if (!isAdmin || !token) return;
        fetch(`${getApiUrl()}/api/auth/users`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => (res.ok ? res.json() : []))
            .then(data => setOrganizers(data))
            .catch(() => { });
    }, [isAdmin, token]);

    const [playerFirstname, setPlayerFirstname] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [playerEmail, setPlayerEmail] = useState("");
    const [playerPhone, setPlayerPhone] = useState("");
    const playerInputRef = useRef<HTMLInputElement>(null);

    // Admin mid-tournament player removal confirmation
    const [removeConfirm, setRemoveConfirm] = useState<Participant | null>(null);

    // Admin edit-participant modal (available at any tournament stage)
    const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
    const [editFirstname, setEditFirstname] = useState("");
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");

    const openEditParticipant = (p: Participant) => {
        setEditParticipant(p);
        setEditFirstname(p.firstname);
        setEditName(p.name);
        setEditEmail(p.email);
        setEditPhone(p.phone);
    };

    const closeEditParticipant = () => {
        setEditParticipant(null);
    };

    const saveEditParticipant = () => {
        if (!editParticipant || !tournament) return;
        const firstname = editFirstname.trim();
        const name = editName.trim();
        const email = editEmail.trim();
        const phone = editPhone.trim();
        if (!firstname || !name || !email || !phone) return;

        const updatedParticipants = tournament.participants.map(p =>
            p.id === editParticipant.id
                ? { ...p, firstname, name, email, phone }
                : p
        );

        updateTournament({
            ...tournament,
            participants: updatedParticipants,
        });

        closeEditParticipant();
    };

    // Admin: tournament edit modal handlers
    const openTournamentEdit = () => {
        if (!tournament) return;
        setEditTName(tournament.name);
        setEditTDate(tournament.eventDate || "");
        setEditTLogoUrl(tournament.logoUrl || "");
        setEditTLogoFileName("");
        setEditTOwnerId(tournament.ownerId || "");
        setShowTournamentEdit(true);
    };

    const closeTournamentEdit = () => {
        if (savingTournament) return;
        setShowTournamentEdit(false);
    };

    const handleEditLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { alert("Merci d'uploader une image (PNG, JPG, SVG)"); return; }
        if (file.size > 800 * 1024) { alert("Fichier trop lourd (max 800 ko)"); return; }
        setEditTLogoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => setEditTLogoUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const saveTournamentEdit = async () => {
        if (!tournament) return;
        const name = editTName.trim();
        if (!name || !editTDate) return;
        setSavingTournament(true);
        try {
            await updateTournament({
                ...tournament,
                name,
                eventDate: editTDate,
                logoUrl: editTLogoUrl || undefined,
                ownerId: editTOwnerId || undefined,
            } as Tournament);
            setShowTournamentEdit(false);
        } finally {
            setSavingTournament(false);
        }
    };

    // Finale CdF planning modal (shown when tournament completed)
    const [showFinaleModal, setShowFinaleModal] = useState(false);
    const [availability, setAvailability] = useState<Record<string, boolean>>({});
    const [creatingFinale, setCreatingFinale] = useState(false);

    const tournament = isLoaded ? getTournament(id) : null;

    // Auto-refresh while the tournament is in progress so newly-submitted
    // scorecards from other devices show up without a manual reload.
    const tournamentStatus = tournament?.status;
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;
    useEffect(() => {
        if (tournamentStatus !== "en_cours") return;
        const interval = setInterval(() => { refreshRef.current(); }, 10000);
        const onFocus = () => { refreshRef.current(); };
        window.addEventListener("focus", onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, [tournamentStatus]);

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

            // Non-admins cannot see the Finale in their list (ownership-filtered
            // on the API), so they call a dedicated endpoint that appends players
            // to the shared "CdF Finale 2026" brouillon regardless of ownership.
            if (!isAdmin) {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                const res = await fetch(`${getApiUrl()}/api/tournaments/finale/add-players`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ participants: newParticipants }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    alert(data.error || "Impossible d'ajouter les joueurs à la Finale. Réessayez plus tard.");
                    return;
                }
                const { added } = await res.json();
                setShowFinaleModal(false);
                alert(`${added} joueur${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à la Finale CdF.`);
                return;
            }

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
                router.push(`/tournaments/${existingFinale.id}`);
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

    // Finale-only: map each finalist (by email) to the source qualifier tournament
    // they were qualified from, so we can display that tournament's logo next to
    // their name in the player lists.
    const isFinaleTournament = /finale/i.test(tournament.name);
    const qualifierTournamentByEmail = new Map<string, Tournament>();
    if (isFinaleTournament) {
        const others = tournaments.filter(t => t.id !== tournament.id && !/finale/i.test(t.name));
        for (const t of others) {
            const qSet = new Set(t.qualifiedIds || []);
            for (const p of t.participants) {
                if (!qSet.has(p.id)) continue;
                const email = (p.email || "").trim().toLowerCase();
                if (!email) continue;
                const existing = qualifierTournamentByEmail.get(email);
                if (!existing || new Date(t.eventDate).getTime() > new Date(existing.eventDate).getTime()) {
                    qualifierTournamentByEmail.set(email, t);
                }
            }
        }
    }
    const getQualifierTournament = (p: Participant): Tournament | null => {
        if (!isFinaleTournament) return null;
        const email = (p.email || "").trim().toLowerCase();
        if (!email) return null;
        return qualifierTournamentByEmail.get(email) ?? null;
    };

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

    // Sort participants:
    //   1) Placement points (5/3/2/1 with +1 boost) — descending
    //   2) Table difference vs. table winner — ascending (smaller is better)
    //   3) Total NT points won across the tournament — descending
    const sortedParticipants = [...tournament.participants].sort((a, b) => {
        const pointsA = calculateTotalPoints(a.id);
        const pointsB = calculateTotalPoints(b.id);
        if (pointsB !== pointsA) return pointsB - pointsA;

        const diffA = calculateTableDifference(a.id);
        const diffB = calculateTableDifference(b.id);
        if (diffA !== diffB) return diffA - diffB;

        const ntA = calculateNTScore(a.id);
        const ntB = calculateNTScore(b.id);
        return ntB - ntA;
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
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {isAdmin && (
                        <Button
                            onClick={openTournamentEdit}
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full sm:w-auto shrink-0 font-prototype"
                            title="Modifier le tournoi (admin)"
                        >
                            <Settings className="w-4 h-4" />
                            Modifier le tournoi
                        </Button>
                    )}
                </div>
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
                                {tournament.participants.map((p, index) => {
                                    const qualifierT = getQualifierTournament(p);
                                    return (
                                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md border bg-card/50 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-prototype text-muted-foreground shrink-0">
                                                {index + 1}
                                            </span>
                                            {qualifierT?.logoUrl && (
                                                <img
                                                    src={qualifierT.logoUrl}
                                                    alt={qualifierT.name}
                                                    title={`Qualifié via ${qualifierT.name}`}
                                                    className="w-6 h-6 object-contain shrink-0"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                            <span className="font-prototype">{p.firstname} {p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => openEditParticipant(p)}
                                                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Modifier les infos du joueur (admin)"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removePlayer(p.id)}
                                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Supprimer"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })}
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

            {/* Classement section above the rounds — elimination format only, at end of tournament */}
            {format === "elimination" && tournament.status === "fini" && (
                <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-prototype flex items-center gap-2">
                            <Award className="w-6 h-6 text-primary" />
                            Classement
                        </h3>
                    </div>
                    <Card className="border-primary/20">
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {sortedParticipants.map((p, index) => {
                                    const ntScore = calculateNTScore(p.id);
                                    const tableDiff = calculateTableDifference(p.id);
                                    return (
                                        <div key={p.id} className={`px-4 py-3 grid grid-cols-[1.5rem_1fr_5rem_6rem] items-center gap-3 hover:bg-accent/30 transition-colors ${qualifiedIds.has(p.id) ? "bg-yellow-500/5" : ""}`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-500" :
                                                index === 1 ? "bg-slate-300" :
                                                    index === 2 ? "bg-amber-600" : "bg-muted text-muted-foreground"
                                                }`}>
                                                {index + 1}
                                            </span>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-prototype truncate" title={`${p.firstname} ${p.name}`}>{p.firstname} {p.name}</span>
                                                {qualifiedIds.has(p.id) && (
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                                                )}
                                            </div>
                                            <span className="text-sm font-prototype text-orange-600 text-right tabular-nums">
                                                {tableDiff > 0 ? `Diff ${tableDiff}` : ""}
                                            </span>
                                            <span className="text-sm font-prototype text-blue-600 text-right tabular-nums">
                                                {ntScore > 0 ? `${ntScore} NT` : ""}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
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
                                    Liste de joueurs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {sortedParticipants.map((p, index) => {
                                        const totalPoints = format === "swiss" ? calculateTotalPoints(p.id) : null;
                                        const ntScore = calculateNTScore(p.id);
                                        const tableDiff = calculateTableDifference(p.id);
                                        const qualifierT = getQualifierTournament(p);
                                        const showStats = tournament.status !== "brouillon" && format === "swiss";
                                        return (
                                            <div
                                                key={p.id}
                                                className={`px-3 py-3 flex flex-col gap-2 hover:bg-accent/30 transition-colors group ${qualifiedIds.has(p.id) ? "bg-yellow-500/5" : ""}`}
                                            >
                                                {/* Row 1: rank + name + actions */}
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${index === 0 ? "bg-yellow-500" :
                                                        index === 1 ? "bg-slate-300" :
                                                            index === 2 ? "bg-amber-600" : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    {qualifierT?.logoUrl && (
                                                        <img
                                                            src={qualifierT.logoUrl}
                                                            alt={qualifierT.name}
                                                            title={`Qualifié via ${qualifierT.name}`}
                                                            className="w-7 h-7 object-contain shrink-0"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                    <span className="font-prototype flex-1 min-w-0 break-words" title={`${p.firstname} ${p.name}`}>{p.firstname} {p.name}</span>
                                                    {qualifiedIds.has(p.id) && (
                                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                                                    )}
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditParticipant(p)}
                                                            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Modifier les infos du joueur"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
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
                                                {/* Row 2: stats aligned in fixed columns */}
                                                {showStats && (
                                                    <div className="pl-8 grid grid-cols-3 gap-2 text-sm font-prototype tabular-nums">
                                                        <span className="text-orange-600 text-right">
                                                            {tableDiff > 0 ? `Diff ${tableDiff}` : ""}
                                                        </span>
                                                        <span className="text-blue-600 text-right">
                                                            {ntScore > 0 ? `${ntScore} NT` : ""}
                                                        </span>
                                                        <span className="text-muted-foreground text-right">
                                                            {totalPoints !== null ? `${totalPoints} pts` : ""}
                                                        </span>
                                                    </div>
                                                )}
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

            {/* Admin: edit participant infos (available at any tournament stage) */}
            {editParticipant && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={closeEditParticipant}
                >
                    <div
                        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-border flex items-start gap-3">
                            <div className="bg-primary/20 p-2 rounded-full shrink-0">
                                <Pencil className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-prototype">Modifier le joueur</h3>
                                <p className="text-sm text-muted-foreground font-prototype">Mettez à jour les informations du joueur.</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={editFirstname}
                                    onChange={(e) => setEditFirstname(e.target.value)}
                                    placeholder="Prénom *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nom *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <input
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    placeholder="Email *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:col-span-2"
                                />
                                <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    placeholder="Téléphone *"
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:col-span-2"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
                            <Button variant="outline" className="w-full font-prototype" onClick={closeEditParticipant}>
                                Annuler
                            </Button>
                            <Button
                                className="w-full gap-2 font-prototype"
                                onClick={saveEditParticipant}
                                disabled={!editFirstname.trim() || !editName.trim() || !editEmail.trim() || !editPhone.trim()}
                            >
                                <Check className="w-4 h-4" />
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin: edit tournament infos (name, date, logo, owner) */}
            {showTournamentEdit && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={closeTournamentEdit}
                >
                    <div
                        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-border flex items-start gap-3">
                            <div className="bg-primary/20 p-2 rounded-full shrink-0">
                                <Settings className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-prototype">Modifier le tournoi</h3>
                                <p className="text-sm text-muted-foreground font-prototype">
                                    Action réservée à l&apos;administration. Modifiable à tout moment, même en cours de tournoi.
                                </p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-sm font-prototype">Nom du tournoi *</label>
                                <input
                                    type="text"
                                    value={editTName}
                                    onChange={(e) => setEditTName(e.target.value)}
                                    placeholder="Nom du tournoi"
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-prototype">Date de l&apos;événement *</label>
                                <input
                                    type="date"
                                    value={editTDate}
                                    onChange={(e) => setEditTDate(e.target.value)}
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-prototype">Organisateur</label>
                                <select
                                    value={editTOwnerId}
                                    onChange={(e) => setEditTOwnerId(e.target.value)}
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">Admin (moi-même)</option>
                                    {organizers.map(o => (
                                        <option key={o.id} value={o.id}>
                                            {o.city ? `${o.name} (${o.city})` : o.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs font-prototype text-muted-foreground">
                                    Réassigner le tournoi à un organisateur ou le reprendre. L&apos;ancien organisateur perdra l&apos;accès.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-prototype">Logo du tournoi</label>
                                <div className="relative">
                                    <input
                                        id="editLogoUpload"
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                        onChange={handleEditLogoUpload}
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="editLogoUpload"
                                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                                    >
                                        <Upload className="w-6 h-6 text-primary mb-1" />
                                        <span className="text-sm font-prototype text-foreground">
                                            {editTLogoFileName || "Téléchargez un nouveau logo"}
                                        </span>
                                        <span className="text-xs font-prototype text-muted-foreground mt-0.5">PNG, SVG • max 800 ko</span>
                                    </label>
                                    {editTLogoUrl && (
                                        <div className="mt-3 flex items-center justify-center gap-3">
                                            <img src={editTLogoUrl} alt="Logo preview" className="max-h-16 max-w-32 object-contain" />
                                            <button
                                                type="button"
                                                onClick={() => { setEditTLogoUrl(""); setEditTLogoFileName(""); }}
                                                className="text-xs font-prototype text-destructive hover:underline"
                                            >
                                                Retirer le logo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
                            <Button variant="outline" className="w-full font-prototype" onClick={closeTournamentEdit} disabled={savingTournament}>
                                Annuler
                            </Button>
                            <Button
                                className="w-full gap-2 font-prototype"
                                onClick={saveTournamentEdit}
                                disabled={!editTName.trim() || !editTDate || savingTournament}
                            >
                                <Check className="w-4 h-4" />
                                {savingTournament ? "Enregistrement..." : "Enregistrer"}
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
