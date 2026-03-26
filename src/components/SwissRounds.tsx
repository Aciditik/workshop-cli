import { TableMatch, Participant, PlayerScore } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QRCodeModal } from "@/components/QRCodeModal";
import { Star } from "lucide-react";

interface SwissRoundsProps {
    matches: TableMatch[];
    participants: Participant[];
    onSubmitResults: (matchId: string, results: Record<string, number>) => void;
    currentRound: number;
    tournamentId: string;
    tournamentName: string;
    maxRounds?: number;
    qualifiedIds?: string[];
}

export function SwissRounds({ matches, participants, onSubmitResults, currentRound, tournamentId, tournamentName, maxRounds = 3, qualifiedIds }: SwissRoundsProps) {
    const rounds = Array.from({ length: maxRounds }, (_, i) => i + 1);
    const qualifiedSet = new Set(qualifiedIds || []);

    const getParticipant = (id: string | null) =>
        id ? participants.find(p => p.id === id) : null;

    return (
        <div className="space-y-8">
            {rounds.map(round => {
                const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.tableNumber - b.tableNumber);

                if (roundMatches.length === 0) return null;

                // Separate finalist and non-finalist tables for display
                const finalistMatches = roundMatches.filter(m => m.isFinalist);
                const otherMatches = roundMatches.filter(m => !m.isFinalist);

                return (
                    <div key={round} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                Ronde {round}
                                {round === currentRound && <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
                            </h3>
                            {round === currentRound && (
                                <QRCodeModal
                                    tournamentId={tournamentId}
                                    tournamentName={tournamentName}
                                />
                            )}
                        </div>

                        {/* Finalist tables section */}
                        {finalistMatches.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Tables Finalistes</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {finalistMatches.map(match => renderMatchCard(match, round, true))}
                                </div>
                            </div>
                        )}

                        {/* Other tables (consolation or regular swiss) */}
                        {otherMatches.length > 0 && (
                            <div className="space-y-2">
                                {finalistMatches.length > 0 && (
                                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Autres Tables</p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {otherMatches.map(match => renderMatchCard(match, round, false))}
                                </div>
                            </div>
                        )}

                        {/* Regular display when no finalist distinction */}
                        {finalistMatches.length === 0 && otherMatches.length === 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {roundMatches.map(match => renderMatchCard(match, round, false))}
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
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className={isFinalist ? "text-yellow-400 font-bold" : ""}>{displayLabel}</span>
                        <span className="text-xs text-muted-foreground/60 font-normal">{playerCount}p · {scale} pts</span>
                        {match.isCompleted && <span className="text-green-500">Validé</span>}
                        {match.isPendingReview && !match.isCompleted && <span className="text-yellow-500">En attente</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Pending review: show full scorecard for verification */}
                    {match.isPendingReview && !match.isCompleted && match.scorecards ? (
                        <div className="space-y-3">
                            {(match.participantIds || []).filter((id): id is string => id !== null).map(pId => {
                                const p = getParticipant(pId);
                                const sc = match.scorecards![pId] as PlayerScore | undefined;
                                if (!p || !sc) return null;
                                const total = sc.nt + sc.objectifs + sc.recompenses + sc.forets + sc.villes + sc.cartes;
                                const pts = match.results[pId] || 0;
                                return (
                                    <div key={pId} className="rounded-md border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 bg-yellow-500/10 font-semibold text-sm">
                                            <span>{p.name}</span>
                                            <span className="text-yellow-400">{total} pts → <span className="text-primary">+{pts} placement</span></span>
                                        </div>
                                        {sc.corporation && (
                                            <div className="px-3 py-1 text-xs text-muted-foreground border-b border-border/40">
                                                Corp: <span className="text-foreground font-medium">{sc.corporation}</span>
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
                                                    <span className="text-muted-foreground">{label}</span>
                                                    <span className="font-bold text-foreground">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {sc.megacredits > 0 && (
                                            <div className="px-3 py-1 text-xs text-muted-foreground">
                                                MC (tiebreaker): <span className="font-medium text-foreground">{sc.megacredits}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <Button
                                className="w-full text-xs h-8 bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={() => onSubmitResults(match.id, match.results)}
                            >
                                Valider les scores
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Normal players list */}
                            <div className="space-y-2">
                                {(match.participantIds || []).map((pId, i) => {
                                    const p = getParticipant(pId);
                                    // Calculate placement if match is completed
                                    let placement = "";
                                    if (match.isCompleted && p) {
                                        const playerIds = match.participantIds.filter((id): id is string => id !== null);
                                        const sorted = [...playerIds].sort((a, b) => (match.results[b] || 0) - (match.results[a] || 0));
                                        const rank = sorted.indexOf(p.id) + 1;
                                        const suffixes = ["er", "ème", "ème", "ème", "ème"];
                                        placement = `${rank}${suffixes[rank - 1] || "ème"}`;
                                    }
                                    return (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-md bg-accent/50 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span>{p ? p.name : "Place vide"}</span>
                                                {p && qualifiedSet.has(p.id) && (
                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                )}
                                            </div>
                                            {match.isCompleted && p && (
                                                <span className="font-bold text-primary">{placement}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {!match.isCompleted && round === currentRound && !match.isPendingReview && (
                                <div className="text-center text-xs text-muted-foreground p-2 border border-dashed rounded-md">
                                    En attente des scores des joueurs...
                                </div>
                            )}

                            {match.isPendingReview && !match.isCompleted && round === currentRound && (
                                <Button
                                    className="w-full text-xs h-8 bg-yellow-500 hover:bg-yellow-600 text-white"
                                    onClick={() => onSubmitResults(match.id, match.results)}
                                >
                                    Valider les scores
                                </Button>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }
}
