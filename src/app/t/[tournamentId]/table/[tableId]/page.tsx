"use client";

import { use, useState, useEffect } from "react";
import { Tournament } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trophy, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";

type PlayerScore = {
    corporation: string;
    nt: number;
    objectifs: number;
    recompenses: number;
    forets: number;
    villes: number;
    cartes: number;
    megacredits: number;
};

const DEFAULT_SCORE: PlayerScore = {
    corporation: "",
    nt: 0,
    objectifs: 0,
    recompenses: 0,
    forets: 0,
    villes: 0,
    cartes: 0,
    megacredits: 0,
};

const CATEGORIES: { key: keyof PlayerScore; label: string }[] = [
    { key: "nt", label: "NT" },
    { key: "objectifs", label: "Objectifs" },
    { key: "recompenses", label: "Récompenses" },
    { key: "forets", label: "Forêts" },
    { key: "villes", label: "Villes" },
    { key: "cartes", label: "Cartes" },
    { key: "megacredits", label: "Tiebreaker" },
];

const CORPORATIONS = [
    "Select Corporation",
    "Arcadian Communities", "Cheung Shing Mars", "Credicor", "Desertron", "Ecoline", "Ecotec", "Green Power",
    "Guilde des Voleurs", "Guilde Ouvrière", "Helion", "Interplanetary Cinematics", "Inventrix", "Kuiper Cooperative", 
    "Ludophiles d'Asnières et d'ailleurs","Mining Guild", "Nirgal Enterprise", "Palladin Shipping", "Phobolog", "Point Luna", "Recyclon", 
    "Robinson Industries", "Sagitta", "Saturn Systems", "Soleil Vert", "Spire", "Teractor", "Tharsis Republic", "Thorgate", 
    "Tycho Magnetics", "United Nations Mars Initiative", "Valley Trust", "Vitor"
];

export default function MobileScorecard({ params }: { params: Promise<{ tournamentId: string, tableId: string }> }) {
    const { tournamentId, tableId } = use(params);

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form state: mapping participantId -> score obj
    const [scores, setScores] = useState<Record<string, PlayerScore>>({});

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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

    const match = tournament?.matches.find(m => m.id === tableId);
    const activePlayers = (match?.participantIds || []).filter((id): id is string => id !== null);

    // Ensure all players have a default score object initialized
    useEffect(() => {
        if (activePlayers.length > 0 && Object.keys(scores).length === 0) {
            const initialScores: Record<string, PlayerScore> = {};
            activePlayers.forEach(pId => {
                initialScores[pId] = { ...DEFAULT_SCORE };
            });
            setScores(initialScores);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [match?.participantIds, scores]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading table data...</div>;
    if (!tournament) return <div className="p-8 text-center text-red-500">Tournament not found.</div>;
    if (!match) return <div className="p-8 text-center text-red-500">Table not found.</div>;

    if (match.isCompleted || submitted) {
        return (
            <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
                <Card className="w-full max-w-sm border-green-500/50 bg-green-500/5 text-center p-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Scores Submitted!</h2>
                    <p className="text-muted-foreground">Thank you. The admin will verify these results shortly.</p>
                </Card>
            </div>
        );
    }

    const getParticipant = (id: string) => tournament.participants.find(p => p.id === id);

    const handleScoreChange = (playerId: string, category: keyof PlayerScore, value: string | number) => {
        setScores(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [category]: typeof value === 'number' ? Math.max(0, value) : value
            }
        }));
    };

    const calculateTotal = (playerId: string) => {
        const pScores = scores[playerId];
        if (!pScores) return 0;
        return pScores.nt + pScores.objectifs + pScores.recompenses + pScores.forets + pScores.villes + pScores.cartes;
    };

    const getRankings = () => {
        const playersWithSums = activePlayers.map(pId => ({
            id: pId,
            total: calculateTotal(pId),
            megacredits: scores[pId]?.megacredits || 0
        }));

        playersWithSums.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            return b.megacredits - a.megacredits; // Tiebreaker
        });

        const placementPoints = activePlayers.length === 3 ? [5, 3, 2] : [5, 3, 2, 1];

        const winnerTotal = playersWithSums[0]?.total ?? 0;

        const rankings: Record<string, { rank: number, displayRank: string, points: number, base: number, bonus: number, diff: number }> = {};

        playersWithSums.forEach((p, index) => {
            let rankStr = `${index + 1}th`;
            if (index === 0) rankStr = `1st`;
            if (index === 1) rankStr = `2nd`;
            if (index === 2) rankStr = `3rd`;

            const base = placementPoints[index] || 0;
            const bonus = index > 0 && (winnerTotal - p.total) <= 5 ? 1 : 0;

            rankings[p.id] = {
                rank: index + 1,
                displayRank: rankStr,
                points: base + bonus,
                base,
                bonus,
                diff: winnerTotal - p.total
            };
        });

        return rankings;
    };

    const rankings = getRankings();

    const handleSubmit = async () => {
        if (Object.keys(scores).length === 0) return;

        setSubmitting(true);
        try {
            // We submit the calculated placement points back to the API
            const pointsToSubmit: Record<string, number> = {};
            activePlayers.forEach(pId => {
                pointsToSubmit[pId] = rankings[pId]?.points || 0;
            });

            const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
            await fetch(`${apiUrl}/api/public/tournaments/${tournamentId}/table/${tableId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ results: pointsToSubmit, scorecards: scores })
            });
            setSubmitted(true);
        } catch (e) {
            console.error(e);
            alert("Failed to submit scores. Please try again or tell the admin.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent flex flex-col items-center py-8 px-2 sm:px-4">
            <div className="w-full max-w-5xl space-y-6">
                <div className="text-center space-y-2 mb-8">
                    <div className="bg-primary/20 p-3 rounded-full inline-block text-primary shadow-lg ring-1 ring-primary/30">
                        <Trophy className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Table {match.tableNumber} Scorecard</h1>
                    <p className="text-muted-foreground font-medium">{tournament.name} - Round {match.round}</p>
                </div>

                <div className="glass rounded-xl overflow-x-auto">
                    <div className="min-w-[800px] w-full">
                        {/* HEADER */}
                        <div className="flex bg-primary/20 text-primary-foreground font-bold text-sm tracking-wide">
                            <div className="w-48 flex-shrink-0 p-4 border-r border-border">Table {match.tableNumber}</div>
                            {activePlayers.map((pId, i) => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 text-center border-r border-border last:border-0">
                                    Joueur #{i + 1}
                                </div>
                            ))}
                        </div>

                        {/* PLAYER NAMES */}
                        <div className="flex bg-secondary text-secondary-foreground font-bold">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/50 text-center">
                                Nom du joueur
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-card text-card-foreground border-r border-border border-b border-border flex items-center justify-center font-medium">
                                    {getParticipant(pId)?.name || "Unknown"}
                                </div>
                            ))}
                        </div>

                        {/* CORPORATION */}
                        <div className="flex bg-secondary text-secondary-foreground font-bold">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/50 text-center">
                                Corporation
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-3 bg-muted/20 border-r border-border border-b border-border flex items-center justify-center">
                                    <select
                                        className="w-full p-2 border border-border rounded-md bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={scores[pId]?.corporation || ""}
                                        onChange={(e) => handleScoreChange(pId, "corporation", e.target.value)}
                                    >
                                        {CORPORATIONS.map(c => (
                                            <option key={c} value={c === "Select Corporation" ? "" : c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* CATEGORY ROWS */}
                        {CATEGORIES.map(cat => (
                            <div key={cat.key} className="flex bg-secondary/80 text-secondary-foreground font-bold">
                                <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/30 text-center">
                                    {cat.label}
                                </div>
                                {activePlayers.map(pId => (
                                    <div key={pId} className="flex-1 min-w-[150px] p-3 bg-card border-r border-border border-b border-border flex items-center justify-center">
                                        <div className="flex items-center w-full max-w-[120px] border border-border rounded-md overflow-hidden bg-background">
                                            <input
                                                type="number"
                                                className="w-full text-center p-2 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary hide-arrows bg-transparent"
                                                value={scores[pId]?.[cat.key] || 0}
                                                onChange={(e) => handleScoreChange(pId, cat.key, parseInt(e.target.value) || 0)}
                                            />
                                            <div className="flex flex-col bg-muted border-l border-border">
                                                <button
                                                    className="px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground h-[18px] flex items-center justify-center transition-colors"
                                                    onClick={() => handleScoreChange(pId, cat.key, (scores[pId]?.[cat.key] as number || 0) + 1)}
                                                >
                                                    <ChevronUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    className="px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground border-t border-border h-[18px] flex items-center justify-center transition-colors"
                                                    onClick={() => handleScoreChange(pId, cat.key, Math.max(0, (scores[pId]?.[cat.key] as number || 0) - 1))}
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* TOTAL ROW */}
                        <div className="flex bg-primary/40 text-primary-foreground font-bold">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/30 text-center">
                                NT
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-primary/10 text-foreground border-r border-primary/20 border-b border-primary/20 flex items-center justify-center text-xl font-black">
                                    {calculateTotal(pId)}
                                </div>
                            ))}
                        </div>
                        {/* CLASSEMENT ROW */}
                        <div className="flex bg-accent/80 text-accent-foreground font-bold">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border text-center">
                                Classement
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-accent/20 text-foreground border-r border-border flex items-center justify-center font-bold text-lg gap-2">
                                    {rankings[pId] && rankings[pId].rank === 1 && <span className="text-yellow-500 text-xl drop-shadow-md">🥇</span>}
                                    {rankings[pId] && rankings[pId].rank === 2 && <span className="text-gray-300 text-xl drop-shadow-md">🥈</span>}
                                    {rankings[pId] && rankings[pId].rank === 3 && <span className="text-orange-500 text-xl drop-shadow-md">🥉</span>}
                                    {rankings[pId] ? rankings[pId].displayRank : ""}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .hide-arrows::-webkit-outer-spin-button,
                    .hide-arrows::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                    .hide-arrows {
                        -moz-appearance: textfield;
                    }
                `}} />

                <div className="pt-4 pb-12 w-full max-w-sm mx-auto">
                    <Button
                        className="w-full h-14 text-xl font-extrabold shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all transform hover:scale-[1.02] ring-1 ring-primary/50"
                        onClick={handleSubmit}
                        disabled={submitting || Object.keys(scores).length === 0}
                    >
                        {submitting ? "Submitting..." : "Submit to Admin"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
