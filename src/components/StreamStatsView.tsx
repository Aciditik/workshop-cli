"use client";

import { useMemo } from "react";
import { Participant, TableMatch } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import { matchScoreTotal, rankTablePlayers } from "@/lib/qualifier-rules";
import { canonicalCorporation } from "@/lib/corporations";
import { OverviewStats, OverviewEntry } from "@/components/stats/OverviewStats";

interface Props {
    participants: Participant[];
    matches: TableMatch[]; // already suspense-scoped by the caller (hidden final round excluded)
    roundBoards?: Record<number, string>; // round number -> board, one board per round
    tournamentName?: string;
}

// Thin adapter: flattens this tournament's completed matches into the
// generic OverviewEntry shape so the streamer's "Statistiques" tab and the
// cross-tournament /stats page share one overview + heatmap implementation.
export function StreamStatsView({ participants, matches, roundBoards, tournamentName }: Props) {
    const entries = useMemo<OverviewEntry[]>(() => {
        const participantById = new Map(participants.map((p) => [p.id, p]));
        const rows: OverviewEntry[] = [];
        for (const m of matches) {
            if (!m.isCompleted || !m.scorecards) continue;
            const ranked = rankTablePlayers(m);
            const board = roundBoards?.[m.round];
            for (const pid of m.participantIds) {
                if (!pid || !m.scorecards[pid]) continue;
                const sc = m.scorecards[pid];
                rows.push({
                    playerId: pid,
                    playerName: playerDisplayName(participantById.get(pid), false),
                    totalScore: matchScoreTotal(m, pid),
                    rank: ranked.indexOf(pid) + 1,
                    corporation: sc.corporation ? canonicalCorporation(sc.corporation) : "",
                    nt: sc.nt || 0,
                    objectifs: sc.objectifs || 0,
                    recompenses: sc.recompenses || 0,
                    forets: sc.forets || 0,
                    villes: sc.villes || 0,
                    cartes: sc.cartes || 0,
                    matchId: m.id,
                    board,
                    round: m.round,
                    tournamentName,
                });
            }
        }
        return rows;
    }, [participants, matches, roundBoards, tournamentName]);

    return <OverviewStats entries={entries} />;
}
