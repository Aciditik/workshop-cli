"use client";

import { use, useState, useEffect } from "react";
import { Tournament } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trophy, CheckCircle2, ChevronUp, ChevronDown, ArrowLeft, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
    "Choisissez votre corporation",
    "Arcadian Communities","AstroDrill", "Cheung Shing Mars", "Credicor", "Desertron", "Ecoline", "Ecotec", "Green Power",
    "Guilde des Voleurs", "Guilde Ouvrière", "Helion", "Interplanetary Cinematics", "Inventrix", "Kuiper Cooperative", 
    "Ludophiles d'Asnières et d'ailleurs","Mining Guild", "Nirgal Enterprise", "Palladin Shipping", "Phobolog", "Point Luna", "Recyclon", 
    "Robinson Industries", "Sagitta", "Saturn Systems", "Soleil Vert", "Spire", "Teractor", "Tharsis Republic", "Thorgate", 
    "Tycho Magnetics", "Union Pharmaceutique","United Nations Mars Initiative", "Valley Trust", "Vitor", "World Series Mars"
];

export default function MobileScorecard({ params }: { params: Promise<{ tournamentId: string, tableId: string }> }) {
    const { tournamentId, tableId } = use(params);

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showRecap, setShowRecap] = useState(false);

    // Form state: mapping participantId -> score obj
    const [scores, setScores] = useState<Record<string, PlayerScore>>({});

    useEffect(() => {
        const loadTournament = async () => {
            try {
                // Use relative URL in production (same domain), absolute URL for local development
                const apiUrl = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
                const res = await fetch(`${apiUrl}/api/public/tournaments/${tournamentId}`);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                setTournament(data);
            } catch (error) {
                console.error("Failed to load tournament:", error);
            } finally {
                setLoading(false);
            }
        };
        loadTournament();
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

    if (loading) return <div className="p-8 text-center animate-pulse font-prototype">Chargement des données de la table...</div>;
    if (!tournament) return <div className="p-8 text-center font-prototype text-red-500">Tournoi non trouvé.</div>;
    if (!match) return <div className="p-8 text-center font-prototype text-red-500">Table non trouvée.</div>;

    if (match.isCompleted || submitted) {
        return (
            <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
                <Card className="w-full max-w-sm border-green-500/50 bg-green-500/5 text-center p-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-prototype mb-2">Scores envoyés!</h2>
                    <p className="font-prototype text-muted-foreground mb-6">Merci. L&apos;admin vérifiera ces résultats sous peu.</p>
                    <Link href={`/t/${tournamentId}`} className="inline-block w-full">
                        <Button className="w-full gap-2 font-prototype" variant="outline">
                            <ArrowLeft className="w-4 h-4" />
                            Retour aux tables
                        </Button>
                    </Link>
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

    // True as soon as any player has a non-zero category score — avoids showing
    // a default "winner" medal before anyone has actually entered scores.
    const hasAnyScore = activePlayers.some(pId => calculateTotal(pId) > 0);

    const getRankings = () => {
        const rankings: Record<string, { rank: number, displayRank: string, points: number, base: number, bonus: number, diff: number }> = {};
        if (!hasAnyScore) return rankings;

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

        playersWithSums.forEach((p, index) => {
            let rankStr = `${index + 1}e`;
            if (index === 0) rankStr = `1er`;
            if (index === 1) rankStr = `2e`;
            if (index === 2) rankStr = `3e`;

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

            const apiUrl = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
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
        <div className="min-h-screen bg-transparent flex flex-col items-center py-6 sm:py-8 px-3 sm:px-4">
            <div className="w-full max-w-5xl space-y-6">
                <div className="text-center space-y-2 mb-6 sm:mb-8">
                    <div className="w-16 h-16 relative mx-auto">
                        <Image 
                            src="/cdf-logo.png" 
                            alt="CDF Logo"
                            width={64}
                            height={64}
                            className="object-contain"
                        />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-prototype text-foreground tracking-tight">Table {match.tableNumber} - Tableau des scores</h1>
                    <p className="text-muted-foreground font-prototype text-sm sm:text-base">{tournament.name} - Round {match.round}</p>
                </div>

                {/* MOBILE LAYOUT: one card per player */}
                <div className="md:hidden space-y-4">
                    {activePlayers.map((pId, i) => {
                        const p = getParticipant(pId);
                        const rank = rankings[pId];
                        return (
                            <div key={pId} className="glass rounded-xl overflow-hidden">
                                <div className="bg-primary/20 px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-muted-foreground font-prototype">Joueur #{i + 1}</div>
                                        <div className="font-prototype">{p ? `${p.firstname} ${p.name}` : "Unknown"}</div>
                                    </div>
                                    {rank && (
                                        <div className="flex items-center gap-1 font-prototype text-lg">
                                            {rank.rank === 1 && <span className="text-yellow-500 text-xl drop-shadow-md">🥇</span>}
                                            {rank.rank === 2 && <span className="text-gray-300 text-xl drop-shadow-md">🥈</span>}
                                            {rank.rank === 3 && <span className="text-orange-500 text-xl drop-shadow-md">🥉</span>}
                                            <span>{rank.displayRank}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground font-prototype block mb-1">Corporation</label>
                                        <select
                                            className="w-full p-2 border border-border rounded-md bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            value={scores[pId]?.corporation || ""}
                                            onChange={(e) => handleScoreChange(pId, "corporation", e.target.value)}
                                        >
                                            {CORPORATIONS.map(c => (
                                                <option key={c} value={c === "Select Corporation" ? "" : c} className="font-prototype">{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {CATEGORIES.map(cat => (
                                            <div key={cat.key}>
                                                <label className="text-xs text-muted-foreground font-prototype block mb-1">{cat.label}</label>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    step="1"
                                                    min="0"
                                                    placeholder="0"
                                                    className="w-full text-center p-2 border border-border rounded-md bg-background text-foreground font-prototype focus:outline-none focus:ring-2 focus:ring-primary hide-arrows"
                                                    value={scores[pId]?.[cat.key] || ''}
                                                    onChange={(e) => handleScoreChange(pId, cat.key, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                        <span className="text-sm font-prototype text-muted-foreground">Total NT</span>
                                        <span className="text-2xl font-prototype text-primary">{calculateTotal(pId)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* DESKTOP LAYOUT: original table */}
                <div className="hidden md:block glass rounded-xl overflow-x-auto">
                    <div className="min-w-[800px] w-full">
                        {/* HEADER */}
                        <div className="flex bg-primary/20 text-primary-foreground font-prototype text-sm tracking-wide">
                            <div className="w-48 flex-shrink-0 p-4 border-r border-border font-prototype">Table {match.tableNumber}</div>
                            {activePlayers.map((pId, i) => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 text-center border-r border-border last:border-0 font-prototype">
                                    Joueur #{i + 1}
                                </div>
                            ))}
                        </div>

                        {/* PLAYER NAMES */}
                        <div className="flex bg-secondary text-secondary-foreground font-bold">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/50 text-center font-prototype">
                                Nom du joueur
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-card text-card-foreground border-r border-border border-b border-border flex items-center justify-center font-prototype">
                                    {(() => { const p = getParticipant(pId); return p ? `${p.firstname} ${p.name}` : "Unknown"; })()}
                                </div>
                            ))}
                        </div>

                        {/* CORPORATION */}
                        <div className="flex bg-secondary text-secondary-foreground font-bold">
                            <div className="w-48 font-prototype flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/50 text-center">
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
                            <div key={cat.key} className="flex bg-secondary/80 text-secondary-foreground font-prototype">
                                <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/30 text-center">
                                    {cat.label}
                                </div>
                                {activePlayers.map(pId => (
                                    <div key={pId} className="flex-1 min-w-[150px] p-3 bg-card border-r border-border border-b border-border flex items-center justify-center">
                                        <div className="flex items-center w-full max-w-[120px] border border-border rounded-md overflow-hidden bg-background">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                step="1"
                                                min="0"
                                                placeholder="0"
                                                className="w-full text-center p-2 text-foreground font-prototype focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary hide-arrows bg-transparent placeholder:text-muted-foreground"
                                                value={scores[pId]?.[cat.key] || ''}
                                                onChange={(e) => handleScoreChange(pId, cat.key, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* TOTAL ROW */}
                        <div className="flex bg-primary/40 text-primary-foreground font-prototype">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border border-b border-border/30 text-center">
                                NT
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-primary/10 text-foreground border-r border-primary/20 border-b border-primary/20 flex items-center justify-center text-xl font-prototype">
                                    {calculateTotal(pId)}
                                </div>
                            ))}
                        </div>
                        {/* CLASSEMENT ROW */}
                        <div className="flex bg-accent/80 text-accent-foreground font-prototype">
                            <div className="w-48 flex-shrink-0 p-4 flex items-center justify-center border-r border-border text-center">
                                Classement
                            </div>
                            {activePlayers.map(pId => (
                                <div key={pId} className="flex-1 min-w-[150px] p-4 bg-accent/20 text-foreground border-r border-border flex items-center justify-center font-prototype text-lg gap-2">
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
                        className="w-full h-14 text-xl font-prototype shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all transform hover:scale-[1.02] ring-1 ring-primary/50"
                        onClick={() => setShowRecap(true)}
                        disabled={submitting || Object.keys(scores).length === 0 || !hasAnyScore}
                    >
                        {submitting ? "Envoi..." : "Envoi à l'admin"}
                    </Button>
                    {!hasAnyScore && (
                        <p className="text-xs text-muted-foreground text-center mt-2 font-prototype">
                            Saisissez au moins un score avant d&apos;envoyer.
                        </p>
                    )}
                </div>

                {/* Recap modal */}
                {showRecap && (
                    <div
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
                        onClick={() => !submitting && setShowRecap(false)}
                    >
                        <div
                            className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-border flex items-start gap-3">
                                <div className="bg-yellow-500/20 p-2 rounded-full shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-prototype">Vérification avant envoi</h3>
                                    <p className="text-sm text-muted-foreground font-prototype">
                                        Relisez le classement. Une fois envoyé, l&apos;admin validera ces scores.
                                    </p>
                                </div>
                            </div>

                            <div className="p-5 space-y-3">
                                {[...activePlayers]
                                    .sort((a, b) => (rankings[a]?.rank || 99) - (rankings[b]?.rank || 99))
                                    .map(pId => {
                                        const p = getParticipant(pId);
                                        const r = rankings[pId];
                                        return (
                                            <div key={pId} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background/50">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="flex items-center gap-1 shrink-0 w-14">
                                                        {r?.rank === 1 && <span className="text-yellow-500 text-xl">🥇</span>}
                                                        {r?.rank === 2 && <span className="text-gray-300 text-xl">🥈</span>}
                                                        {r?.rank === 3 && <span className="text-orange-500 text-xl">🥉</span>}
                                                        <span className="font-prototype text-sm">{r?.displayRank || "-"}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-prototype truncate">{p ? `${p.firstname} ${p.name}` : "Unknown"}</div>
                                                        <div className="text-xs text-muted-foreground font-prototype truncate">
                                                            {scores[pId]?.corporation || "— Corporation non choisie —"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-xs text-muted-foreground font-prototype">NT</div>
                                                    <div className="text-xl font-prototype text-primary">{calculateTotal(pId)}</div>
                                                    {r && (
                                                        <div className="text-xs text-muted-foreground font-prototype">
                                                            {r.points} pt{r.points > 1 ? "s" : ""}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            <div className="p-5 border-t border-border flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0 bg-card">
                                <Button
                                    variant="outline"
                                    className="w-full font-prototype"
                                    onClick={() => setShowRecap(false)}
                                    disabled={submitting}
                                >
                                    Retour / Modifier
                                </Button>
                                <Button
                                    className="w-full font-prototype bg-primary hover:bg-primary/90"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? "Envoi..." : "Confirmer et envoyer"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
