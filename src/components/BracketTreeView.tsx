"use client";

import { TableMatch, Participant } from "@/lib/types";
import { Star, ArrowRight } from "lucide-react";

interface BracketTreeViewProps {
    matches: TableMatch[];
    participants: Participant[];
    qualifiedIds?: string[];
}

const ROUND_LABELS: Record<number, string> = {
    1: "Quarts de finale",
    2: "Demi-finales",
    3: "Finale",
};

// Visual tree for the "bracket" format: one column per round (Quarts → Demies
// → Finale), each showing its tables with players ranked by points. Because
// advancing players are crossed/interleaved across tables between rounds
// (to avoid immediate rematches), a single table doesn't map to one specific
// table in the next round — the arrow between columns conveys the overall
// progression instead of a literal per-table bracket line.
export function BracketTreeView({ matches, participants, qualifiedIds }: BracketTreeViewProps) {
    const qualifiedSet = new Set(qualifiedIds || []);
    const getParticipant = (id: string | null) => (id ? participants.find(p => p.id === id) : null);

    const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
    if (rounds.length === 0) return null;

    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-3 min-w-max">
                {rounds.map((round, roundIdx) => {
                    const roundMatches = matches
                        .filter(m => m.round === round)
                        .sort((a, b) => a.tableNumber - b.tableNumber);
                    return (
                        <div key={round} className="flex items-center gap-3">
                            <div className="space-y-3 w-60">
                                <h4 className="text-sm font-prototype text-center text-muted-foreground uppercase tracking-wide">
                                    {ROUND_LABELS[round] || `Ronde ${round}`}
                                </h4>
                                {roundMatches.map(m => {
                                    const ids = m.participantIds.filter((id): id is string => id !== null);
                                    const ranked = [...ids].sort((a, b) => (m.results[b] || 0) - (m.results[a] || 0));
                                    return (
                                        <div
                                            key={m.id}
                                            className={`rounded-lg border p-2 space-y-1 bg-card/50 ${
                                                m.isCompleted ? "border-border" : "border-dashed border-muted-foreground/40"
                                            }`}
                                        >
                                            <p className="text-[10px] font-prototype text-muted-foreground uppercase">{m.tableLabel}</p>
                                            {ranked.length === 0 && (
                                                <p className="text-xs font-prototype text-muted-foreground italic">À déterminer</p>
                                            )}
                                            {ranked.map((pid, i) => {
                                                const p = getParticipant(pid);
                                                if (!p) return null;
                                                return (
                                                    <div key={pid} className="flex items-center justify-between text-xs font-prototype gap-1">
                                                        <span className={`truncate flex items-center gap-1 ${i === 0 && m.isCompleted ? "font-semibold" : ""}`}>
                                                            {qualifiedSet.has(pid) && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                                            {p.firstname} {p.name}
                                                        </span>
                                                        <span className="tabular-nums text-muted-foreground shrink-0">{m.results[pid] ?? "-"}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                            {roundIdx < rounds.length - 1 && (
                                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-8" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
