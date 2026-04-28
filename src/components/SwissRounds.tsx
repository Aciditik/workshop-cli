"use client";

import { useState } from "react";
import { TableMatch, Participant, PlayerScore } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QRCodeModal } from "@/components/QRCodeModal";
import { Star, ChevronDown, ChevronRight } from "lucide-react";

interface SwissRoundsProps {
    matches: TableMatch[];
    participants: Participant[];
    onSubmitResults: (matchId: string, results: Record<string, number>) => void;
    onDeclineResults: (matchId: string) => void;
    onEditScorecards?: (matchId: string, results: Record<string, number>, scorecards: Record<string, PlayerScore>) => void;
    currentRound: number;
    tournamentId: string;
    tournamentName: string;
    tournamentLogoUrl?: string;
    eventDate?: string;
    maxRounds?: number;
    qualifiedIds?: string[];
    isAdmin?: boolean;
}

// Category keys used to compute a player's raw NT total.
const SCORE_CATEGORIES: { key: keyof PlayerScore; label: string }[] = [
    { key: "nt", label: "NT" },
    { key: "objectifs", label: "Objectifs" },
    { key: "recompenses", label: "Récomp." },
    { key: "forets", label: "Forêts" },
    { key: "villes", label: "Villes" },
    { key: "cartes", label: "Cartes" },
];

// Recompute placement points from raw scorecards using the same rule as the
// mobile scorecard page: sort by total (tiebreaker: megacredits), assign
// [5,3,2,1] (or [5,3,2] for 3p), plus +1 bonus for non-winners within 5 pts.
function computePlacementPoints(scorecards: Record<string, PlayerScore>): Record<string, number> {
    const ids = Object.keys(scorecards);
    const totals = ids.map(id => {
        const s = scorecards[id];
        const total = s.nt + s.objectifs + s.recompenses + s.forets + s.villes + s.cartes;
        return { id, total, megacredits: s.megacredits || 0 };
    });
    totals.sort((a, b) => b.total !== a.total ? b.total - a.total : b.megacredits - a.megacredits);
    const placement = ids.length === 3 ? [5, 3, 2] : [5, 3, 2, 1];
    const winnerTotal = totals[0]?.total ?? 0;
    const out: Record<string, number> = {};
    totals.forEach((p, i) => {
        const base = placement[i] ?? 0;
        const bonus = i > 0 && (winnerTotal - p.total) <= 5 ? 1 : 0;
        out[p.id] = base + bonus;
    });
    return out;
}

export function SwissRounds({ matches, participants, onSubmitResults, onDeclineResults, onEditScorecards, currentRound, tournamentId, tournamentName, tournamentLogoUrl, eventDate, maxRounds = 3, qualifiedIds, isAdmin }: SwissRoundsProps) {
    const rounds = Array.from({ length: maxRounds }, (_, i) => i + 1);
    const qualifiedSet = new Set(qualifiedIds || []);
    // By default, only the current round is expanded
    const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([currentRound]));
    // Inline edit mode for pending-review scorecards.
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Record<string, PlayerScore>>({});

    const startEditing = (match: TableMatch) => {
        const draft: Record<string, PlayerScore> = {};
        (match.participantIds || []).forEach(pid => {
            if (!pid) return;
            const sc = match.scorecards?.[pid] as PlayerScore | undefined;
            draft[pid] = sc
                ? { ...sc }
                : { corporation: "", nt: 0, objectifs: 0, recompenses: 0, forets: 0, villes: 0, cartes: 0, megacredits: 0 };
        });
        setEditDraft(draft);
        setEditingMatchId(match.id);
    };

    const cancelEditing = () => {
        setEditingMatchId(null);
        setEditDraft({});
    };

    const updateDraftField = (pid: string, key: keyof PlayerScore, value: number) => {
        setEditDraft(prev => ({
            ...prev,
            [pid]: { ...prev[pid], [key]: Math.max(0, value) },
        }));
    };

    const saveEditing = (matchId: string) => {
        if (!onEditScorecards) return;
        const results = computePlacementPoints(editDraft);
        onEditScorecards(matchId, results, editDraft);
        setEditingMatchId(null);
        setEditDraft({});
    };

    const toggleRound = (round: number) => {
        setExpandedRounds(prev => {
            const next = new Set(prev);
            if (next.has(round)) next.delete(round);
            else next.add(round);
            return next;
        });
    };

    const getParticipant = (id: string | null) =>
        id ? participants.find(p => p.id === id) : null;

    return (
        <div className="space-y-4">
            {rounds.map(round => {
                const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.tableNumber - b.tableNumber);

                if (roundMatches.length === 0) return null;

                const isExpanded = expandedRounds.has(round);
                const completedCount = roundMatches.filter(m => m.isCompleted).length;
                const totalCount = roundMatches.length;

                // Separate finalist and non-finalist tables for display
                const finalistMatches = roundMatches.filter(m => m.isFinalist);
                const otherMatches = roundMatches.filter(m => !m.isFinalist);

                return (
                    <div key={round} className="space-y-4">
                        {/* Clickable round header */}
                        <div
                            onClick={() => toggleRound(round)}
                            className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                            <h3 className="text-base sm:text-xl font-prototype flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                                {isExpanded ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
                                <span className="font-prototype">Ronde {round}</span>
                                {round === currentRound && <span className="bg-primary/20 text-primary text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-wider font-prototype">Active</span>}
                                <span className="text-xs sm:text-sm font-prototype text-muted-foreground">
                                    {completedCount}/{totalCount}
                                </span>
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                {round === currentRound && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <QRCodeModal
                                            tournamentId={tournamentId}
                                            tournamentName={tournamentName}
                                            tournamentLogoUrl={tournamentLogoUrl}
                                            eventDate={eventDate}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="space-y-4 pl-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {roundMatches.map(match => renderMatchCard(match, round, match.isFinalist || false))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    function renderMatchCard(match: TableMatch, round: number, isFinalist: boolean) {
        const displayLabel = match.tableLabel || `Table ${match.tableNumber}`;
        const playerCount = (match.participantIds || []).filter((id): id is string => id !== null).length;
        const scale = playerCount === 3 ? "3/2/1" : playerCount === 5 ? "5/3/2/1/0" : "5/3/2/1";

        return (
            <Card
                key={match.id}
                className={`${match.isCompleted ? "opacity-75 bg-muted/20" : isFinalist ? "border-yellow-500/50 bg-yellow-500/5" : "border-primary/50"}`}
            >
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-prototype text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className={isFinalist ? "text-yellow-400 font-prototype" : "font-prototype"}>{displayLabel}</span>
                        {/* <span className="text-xs text-muted-foreground/60 font-normal">{playerCount}p · {scale} pts</span> */}
                        {match.isCompleted && <span className="text-green-500 font-prototype">Validé</span>}
                        {match.isPendingReview && !match.isCompleted && <span className="text-yellow-500 font-prototype">En attente</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Edit mode (inline): shown whenever admin/organizer has clicked
                        Modifier / Corriger on a pending-review OR a validated match. */}
                    {editingMatchId === match.id ? (
                        <div className="space-y-3">
                            {(match.participantIds || []).filter((id): id is string => id !== null).map(pId => {
                                const p = getParticipant(pId);
                                const sc = editDraft[pId];
                                if (!p || !sc) return null;
                                const total = sc.nt + sc.objectifs + sc.recompenses + sc.forets + sc.villes + sc.cartes;
                                return (
                                    <div key={pId} className="rounded-md border border-orange-500/30 bg-orange-500/5 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-orange-500/10 font-prototype text-sm">
                                            <span className="font-prototype">{p.firstname} {p.name}</span>
                                            <span className="text-orange-400 font-prototype">{total} pts</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 p-2 text-xs">
                                            {SCORE_CATEGORIES.map(({ key, label }) => (
                                                <div key={key} className="flex flex-col">
                                                    <label className="text-muted-foreground font-prototype mb-1">{label}</label>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={0}
                                                        step={1}
                                                        value={sc[key] as number}
                                                        onChange={e => updateDraftField(pId, key, e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                                                        className="w-full text-center p-1.5 border border-border rounded bg-background text-foreground font-prototype focus:outline-none focus:ring-1 focus:ring-primary hide-arrows"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="px-2 pb-2">
                                            <label className="text-xs text-muted-foreground font-prototype mb-1 block">Tiebreaker (MC)</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                step={1}
                                                value={sc.megacredits}
                                                onChange={e => updateDraftField(pId, "megacredits", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                                                className="w-full text-center p-1.5 border border-border rounded bg-background text-foreground text-xs font-prototype focus:outline-none focus:ring-1 focus:ring-primary hide-arrows"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1 text-xs h-8 bg-muted hover:bg-muted/80 text-foreground font-prototype"
                                    onClick={cancelEditing}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 text-xs h-8 bg-green-500 hover:bg-green-600 text-white font-prototype"
                                    onClick={() => saveEditing(match.id)}
                                >
                                    Valider les modifications
                                </Button>
                            </div>
                        </div>
                    ) : match.isPendingReview && !match.isCompleted && match.scorecards ? (
                        <div className="space-y-3">
                            {(match.participantIds || []).filter((id): id is string => id !== null).map(pId => {
                                const p = getParticipant(pId);
                                const sc = match.scorecards![pId] as PlayerScore | undefined;
                                if (!p || !sc) return null;
                                const total = sc.nt + sc.objectifs + sc.recompenses + sc.forets + sc.villes + sc.cartes;
                                const pts = match.results[pId] || 0;
                                return (
                                    <div key={pId} className="rounded-md border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-yellow-500/10 font-prototype text-sm">
                                            <span className="font-prototype">{p.firstname} {p.name}</span>
                                            <span className="text-yellow-400 font-prototype">{total} pts {/*→ <span className="text-primary">+{pts} placement</span>*/}</span>
                                        </div>
                                        {sc.corporation && (
                                            <div className="px-3 py-1 text-xs font-prototype text-muted-foreground border-b border-border/40">
                                                Corp: <span className="text-foreground font-prototype">{sc.corporation}</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 gap-0 text-xs">
                                            {([
                                                ["NT", sc.nt],
                                                ["Objectifs", sc.objectifs],
                                                ["Récomp.", sc.recompenses],
                                                ["Forêts", sc.forets],
                                                ["Villes", sc.villes],
                                                ["Cartes", sc.cartes],
                                            ] as [string, number][]).map(([label, val]) => (
                                                <div key={label} className="flex flex-col items-center p-1.5 border-r border-b border-border/30 last:border-r-0">
                                                    <span className="text-muted-foreground font-prototype">{label}</span>
                                                    <span className="font-prototype text-foreground">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sc.megacredits > 0 && (
                                            <div className="px-3 py-1 text-xs font-prototype text-muted-foreground">
                                                Tiebreaker: <span className="font-prototype text-foreground">{sc.megacredits}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-prototype"
                                    onClick={() => startEditing(match)}
                                >
                                    Modifier
                                </Button>
                                <Button
                                    className="flex-1 text-xs h-8 bg-green-500 hover:bg-green-600 text-white font-prototype"
                                    onClick={() => onSubmitResults(match.id, match.results)}
                                >
                                    Valider
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Normal players list */}
                            <div className="space-y-2">
                                {(() => {
                                    const playerIds = (match.participantIds || []).filter((id): id is string => id !== null);
                                    // Sort by ranking (1st to last) when completed
                                    const sortedIds = match.isCompleted
                                        ? [...playerIds].sort((a, b) => (match.results[b] || 0) - (match.results[a] || 0))
                                        : playerIds;

                                    // Calculate NT for each player from scorecards
                                    const getNT = (pId: string): number => {
                                        const sc = match.scorecards?.[pId] as PlayerScore | undefined;
                                        if (!sc) return 0;
                                        return sc.nt + sc.objectifs + sc.recompenses + sc.forets + sc.villes + sc.cartes;
                                    };

                                    return sortedIds.map((pId, i) => {
                                        const p = getParticipant(pId);
                                        let placement = "";
                                        if (match.isCompleted && p) {
                                            const rank = sortedIds.indexOf(p.id) + 1;
                                            const suffixes = ["er", "ème", "ème", "ème", "ème"];
                                            placement = `${rank}${suffixes[rank - 1] || "ème"}`;
                                        }
                                        const nt = getNT(pId);
                                        return (
                                            <div key={i} className="flex flex-col gap-1 p-2 rounded-md bg-accent/50 text-sm">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-prototype">{p ? `${p.firstname} ${p.name}` : "Place vide"}</span>
                                                    {p && qualifiedSet.has(p.id) && (
                                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {match.isCompleted && nt > 0 && (
                                                        <span className="text-xs font-prototype text-muted-foreground whitespace-nowrap">{nt} NT</span>
                                                    )}
                                                    {match.isCompleted && p && (
                                                        <span className="font-prototype text-primary whitespace-nowrap">{placement}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {!match.isCompleted && round === currentRound && !match.isPendingReview && (
                                <div className="text-center font-prototype text-xs text-muted-foreground p-2 border border-dashed rounded-md">
                                    En attente des scores des joueurs...
                                </div>
                            )}

                            {match.isPendingReview && !match.isCompleted && round === currentRound && (
                                <Button
                                    className="w-full text-xs h-8 bg-yellow-500 hover:bg-yellow-600 text-white font-prototype"
                                    onClick={() => onSubmitResults(match.id, match.results)}
                                >
                                    Valider les scores
                                </Button>
                            )}

                            {/* Admin-only: re-open a validated match to correct scores. */}
                            {match.isCompleted && isAdmin && match.scorecards && onEditScorecards && (
                                <Button
                                    className="w-full text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-prototype"
                                    onClick={() => startEditing(match)}
                                >
                                    Corriger les scores
                                </Button>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }
}
