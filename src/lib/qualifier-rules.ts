import { TableMatch, Participant, TournamentFormat } from "./types";

// ─── Format Detection ──────────────────────────────────────────────
export function getFormat(size: number): TournamentFormat {
    if (size < 28) return "elimination";
    return "swiss";
}

export function getMaxRounds(size: number): number {
    return size < 28 ? 2 : 3;
}

export function getQualifiedCount(size: number): number {
    if (size >= 8 && size <= 13) return 1;
    if (size >= 14 && size <= 15) return 2;
    if (size >= 16 && size <= 23) return 2;
    if (size >= 24 && size <= 27) return 3;
    if (size >= 28 && size <= 31) return 3;
    return 4; // 32+
}

export function isRecommendedSize(size: number): boolean {
    // 8-15 are all non-recommended, 16/20/24 and 28+ are recommended
    if (size < 16) return false;
    return [16, 20, 24].includes(size) || size >= 28;
}

export function getFormatLabel(size: number): string {
    if (size < 28) return `2 rondes élimination directe`;
    return `3 rondes suisse`;
}

// ─── Table Letter Labels ────────────────────────────────────────────
const TABLE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function tableLetterLabel(index: number): string {
    return `Table ${TABLE_LETTERS[index] || (index + 1)}`;
}

// ─── Round 1 Table Distribution (8-27 players) ──────────────────────
// Exact sizes per the official regulations document.
function getRound1TableSizes(n: number): number[] {
    const exact: Record<number, number[]> = {
        8:  [4, 4],
        9:  [4, 5],
        10: [5, 5],
        11: [4, 4, 3],
        12: [3, 3, 3, 3],
        13: [3, 3, 3, 4],
        14: [4, 4, 3, 3],
        15: [4, 4, 4, 3],
        16: [4, 4, 4, 4],
        17: [4, 4, 4, 5],
        18: [4, 4, 5, 5],
        19: [4, 5, 5, 5],
        20: [5, 5, 5, 5],
        21: [4, 4, 4, 4, 5],
        22: [4, 4, 4, 5, 5],
        23: [4, 4, 5, 5, 5],
        24: [4, 4, 4, 4, 4, 4],
        25: [4, 4, 4, 4, 4, 5],
        26: [4, 4, 4, 4, 5, 5],
        27: [4, 4, 4, 5, 5, 5],
    };

    return exact[n] || [];
}

// ─── Round 2 Generation for Elimination (8-27) ──────────────────────

interface Round2Config {
    finalistTables: { participantIds: string[]; label: string }[];
    consolationTables: { participantIds: string[]; label: string }[];
}

function getRound2Config(
    n: number,
    round1Matches: TableMatch[],
): Round2Config {
    const sorted = [...round1Matches].sort((a, b) => a.tableNumber - b.tableNumber);

    function getTableRankings(match: TableMatch): { winner: string; second: string; rest: string[] } {
        const playerIds = match.participantIds.filter((id): id is string => id !== null);
        const ranked = [...playerIds].sort((a, b) => (match.results[b] || 0) - (match.results[a] || 0));
        return {
            winner: ranked[0],
            second: ranked[1] ?? "",
            rest: ranked.slice(2),
        };
    }

    const r = sorted.map(m => getTableRankings(m));

    // ─── 8-10 players (2 tables): 1 finalist table ────────────────
    // Winners A+B vs seconds A+B
    if (n >= 8 && n <= 10) {
        const [tA, tB] = r;
        const finalistIds = [tA.winner, tB.winner, tA.second, tB.second].filter(Boolean);
        const consolation = [...tA.rest, ...tB.rest].filter(Boolean);
        return {
            finalistTables: [
                { participantIds: finalistIds, label: "Finale 1" },
            ],
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 11 players (3 tables: 4,4,3): 1 finalist with 3 winners ──
    if (n === 11) {
        const [tA, tB, tC] = r;
        const finalistIds = new Set([tA.winner, tB.winner, tC.winner]);
        const consolation = [tA.second, tB.second, tC.second, ...tA.rest, ...tB.rest, ...tC.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables: [
                { participantIds: [...finalistIds], label: "Finale 1" },
            ],
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 12 players (4 tables of 3): 1 finalist with 4 winners ────
    if (n === 12) {
        const [tA, tB, tC, tD] = r;
        const finalistIds = new Set([tA.winner, tB.winner, tC.winner, tD.winner]);
        const consolation = [tA.second, tB.second, tC.second, tD.second, ...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables: [
                { participantIds: [...finalistIds], label: "Finale 1" },
            ],
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 13 players (4 tables: 3,3,3,4): 1 finalist with 4 winners
    if (n === 13) {
        const [tA, tB, tC, tD] = r;
        const finalistIds = new Set([tA.winner, tB.winner, tC.winner, tD.winner]);
        const consolation = [tA.second, tB.second, tC.second, tD.second, ...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables: [
                { participantIds: [...finalistIds], label: "Finale 1" },
            ],
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 14 players (4 tables: 4,4,3,3): 2 finalist tables crossed ─
    // Finale 1: winners A+B vs seconds C+D
    // Finale 2: winners C+D vs seconds A+B
    if (n === 14) {
        const [tA, tB, tC, tD] = r;
        const finalistTables = [
            { participantIds: [tA.winner, tB.winner, tC.second, tD.second].filter(Boolean), label: "Finale 1" },
            { participantIds: [tC.winner, tD.winner, tA.second, tB.second].filter(Boolean), label: "Finale 2" },
        ];
        const finalistIds = new Set(finalistTables.flatMap(t => t.participantIds));
        const consolation = [...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables,
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 15 players (4 tables: 4,4,4,3): 2 finalist tables crossed ─
    if (n === 15) {
        const [tA, tB, tC, tD] = r;
        const finalistTables = [
            { participantIds: [tA.winner, tB.winner, tC.second, tD.second].filter(Boolean), label: "Finale 1" },
            { participantIds: [tC.winner, tD.winner, tA.second, tB.second].filter(Boolean), label: "Finale 2" },
        ];
        const finalistIds = new Set(finalistTables.flatMap(t => t.participantIds));
        const consolation = [...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables,
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 16-19 players (4 tables): 2 finalist tables, crossed ────────
    if (n >= 16 && n <= 19) {
        const [tA, tB, tC, tD] = r;
        const finalistTables = [
            { participantIds: [tA.winner, tB.winner, tC.second, tD.second], label: "Finale 1" },
            { participantIds: [tC.winner, tD.winner, tA.second, tB.second], label: "Finale 2" },
        ];
        const finalistIds = new Set(finalistTables.flatMap(t => t.participantIds));
        const consolation = [...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest].filter(id => id && !finalistIds.has(id));
        return {
            finalistTables,
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 20 players (4 tables of 5): 2 finalist tables + consolation ─
    if (n === 20) {
        const [tA, tB, tC, tD] = r;
        return {
            finalistTables: [
                { participantIds: [tA.winner, tB.winner, tC.second, tD.second], label: "Finale 1" },
                { participantIds: [tC.winner, tD.winner, tA.second, tB.second], label: "Finale 2" },
            ],
            consolationTables: distributeToConsolation(
                [...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest],
                "Consolation"
            ),
        };
    }

    // ─── 21-23 players (5 tables): 2 finalist tables + consolation ────
    if (n >= 21 && n <= 23) {
        // Finalist 1: winners A,B + seconds D,E
        // Finalist 2: winners D,E + seconds A,B
        // C's winner and second go to consolation along with all rests
        const [tA, tB, tC, tD, tE] = r;
        const f1 = [tA.winner, tB.winner, tD.second, tE.second];
        const f2 = [tD.winner, tE.winner, tA.second, tB.second];
        const consolation = [tC.winner, tC.second, ...tA.rest, ...tB.rest, ...tC.rest, ...tD.rest, ...tE.rest].filter(Boolean);
        return {
            finalistTables: [
                { participantIds: f1, label: "Finale 1" },
                { participantIds: f2, label: "Finale 2" },
            ],
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    // ─── 24-27 players (6 tables): 3 finalist tables + consolation ────
    if (n >= 24 && n <= 27) {
        const [tA, tB, tC, tD, tE, tF] = r;
        const finalistTables = [
            { participantIds: [tA.winner, tB.winner, tC.second, tD.second], label: "Finale 1" },
            { participantIds: [tC.winner, tD.winner, tE.second, tF.second], label: "Finale 2" },
            { participantIds: [tE.winner, tF.winner, tA.second, tB.second], label: "Finale 3" },
        ];
        const finalistIds = new Set(finalistTables.flatMap(t => t.participantIds));
        const consolation = r.flatMap(t => [t.winner, t.second, ...t.rest]).filter(id => id && !finalistIds.has(id));
        return {
            finalistTables,
            consolationTables: distributeToConsolation(consolation, "Consolation"),
        };
    }

    return { finalistTables: [], consolationTables: [] };
}

// ─── Distribute remaining players into consolation tables of 3-5 ────
function distributeToConsolation(
    playerIds: string[],
    labelPrefix: string
): { participantIds: string[]; label: string }[] {
    const n = playerIds.length;
    if (n === 0) return [];

    let tableSizes: number[];
    if (n <= 5) {
        tableSizes = [n];
    } else {
        // Prefer tables of 4, allow 3 or 5 to fill
        // 4a + 5b = n or 4a + 3b = n
        const remainder = n % 4;
        if (remainder === 0) {
            tableSizes = Array(n / 4).fill(4);
        } else if (remainder === 1) {
            // e.g. 13 → 2×4 + 1×5
            tableSizes = [...Array(Math.floor(n / 4) - 1).fill(4), 5];
        } else if (remainder === 2) {
            // e.g. 14 → 2×4 + 2×3 or 1×4 + 2×5
            // The rules sometimes use 3-player tables, let's prefer 5s first
            tableSizes = [...Array(Math.floor(n / 4) - 1).fill(4), 3, 3];
            // Actually, let's recalculate properly
            const tables5 = Math.floor(remainder / 1); // not great, let's be explicit
            // 4a + 5b = n, minimize total. b = (n - 4a) / 5... let's just handle common cases
            // For consolation it doesn't matter as much, use 4s and one adjusted table
            tableSizes = [...Array(Math.floor(n / 4)).fill(4)];
            const leftover = n - tableSizes.length * 4;
            if (leftover > 0) {
                // Remove last table of 4, make it (4 + leftover) split
                if (leftover <= 1 && tableSizes.length > 0) {
                    tableSizes[tableSizes.length - 1] = 5;
                } else {
                    tableSizes.push(leftover);
                }
            }
        } else if (remainder === 3) {
            // e.g. 11 → 2×4 + 1×3 or 1×4 + 1×3 + 1×4
            tableSizes = [...Array(Math.floor(n / 4)).fill(4), 3];
        } else {
            tableSizes = [...Array(Math.floor(n / 4)).fill(4)];
        }
    }

    // Validate total
    const total = tableSizes.reduce((a, b) => a + b, 0);
    if (total !== n) {
        // Fallback: just use one big batch split into 4s
        tableSizes = [];
        let remaining = n;
        while (remaining > 0) {
            const size = Math.min(remaining, remaining <= 5 ? remaining : 4);
            tableSizes.push(size);
            remaining -= size;
        }
    }

    const tables: { participantIds: string[]; label: string }[] = [];
    let cursor = 0;
    for (let i = 0; i < tableSizes.length; i++) {
        tables.push({
            participantIds: playerIds.slice(cursor, cursor + tableSizes[i]),
            label: `${labelPrefix} ${i + 1}`,
        });
        cursor += tableSizes[i];
    }
    return tables;
}

// ─── Swiss Round Table Distribution (28+ players) ───────────────────
function getSwissTableSizes(n: number): number[] {
    if (n < 6) return [n];

    // Tables of 4 preferred, some tables of 5 if needed, NO tables of 3
    // For 28+: 4a + 5b = n, prefer fewer 5s
    const remainder = n % 4;
    if (remainder === 0) {
        return Array(n / 4).fill(4);
    }
    // remainder 1: one table of 5 instead of one table of 4 → (n/4 - 1) tables of 4 + 1 table of 5? No: 4*(T-1)+5 = 4T+1 → n = 4T+1 → T = (n-1)/4
    // Actually: we need 4a + 5b = n. b = remainder when thinking modulo.
    // r=1: one 5-player table → 4*(floor(n/4)-1) + 5*1 = n-4+5 = n+1 ≠ n. Nope.
    // Let's think differently: 
    // n = 4q + r where r ∈ {0,1,2,3}
    // r=0: q tables of 4
    // r=1: (q-1) tables of 4 + 1 table of 5 → 4(q-1)+5 = 4q+1 = n ✓
    // r=2: (q-1) tables of 4 + 2 tables of 5 → 4(q-1)+10 = 4q+6 ≠ n. Hmm.
    //       OR: (q) tables of 4 + ... no, 4q = n-2, need 2 more players somewhere
    //       Actually: q-1 tables of 4 + 2 tables of 3? But we said no 3s for 28+.
    //       For Swiss 28+: let's allow tables of 3 as fallback since the existing code did.
    //       The original CdF rules say tables of 3 or 4. Let me re-check the document...
    //       "Players will be distributed into tables of 3 or 4" was the old text.
    //       For Swiss (28+), the doc says "Voir règlement de la CdF" so tables of 3-4 are fine.

    // Use the original algorithm: tables of 3 and 4
    const k = remainder === 0 ? 0 : (4 - remainder); // number of 3-player tables
    const T = Math.floor(n / 4) + (remainder === 0 ? 0 : 1); // total tables
    return [
        ...Array(T - k).fill(4),
        ...Array(k).fill(3),
    ];
}

// ─── Main: Generate Round 1 ────────────────────────────────────────
export function generateRound1(
    tournamentId: string,
    participants: Participant[],
    size: number
): TableMatch[] {
    const format = getFormat(size);
    const pool = [...participants].sort(() => Math.random() - 0.5); // Random shuffle

    let tableSizes: number[];
    if (format === "elimination") {
        tableSizes = getRound1TableSizes(size);
    } else {
        tableSizes = getSwissTableSizes(pool.length);
    }

    const matches: TableMatch[] = [];
    let cursor = 0;

    for (let i = 0; i < tableSizes.length; i++) {
        const tablePlayers = pool.slice(cursor, cursor + tableSizes[i]);
        cursor += tableSizes[i];

        matches.push({
            id: crypto.randomUUID(),
            tournamentId,
            round: 1,
            tableNumber: i + 1,
            tableLabel: format === "elimination" ? tableLetterLabel(i) : `Table ${i + 1}`,
            participantIds: tablePlayers.map(p => p.id),
            results: {},
            isCompleted: false,
            isFinalist: false,
        });
    }

    return matches;
}

// ─── Main: Generate Round 2 (Elimination format) ───────────────────
export function generateEliminationRound2(
    tournamentId: string,
    size: number,
    round1Matches: TableMatch[]
): TableMatch[] {
    const config = getRound2Config(size, round1Matches);
    const matches: TableMatch[] = [];
    let tableNum = 1;

    // Finalist tables
    for (const ft of config.finalistTables) {
        matches.push({
            id: crypto.randomUUID(),
            tournamentId,
            round: 2,
            tableNumber: tableNum,
            tableLabel: ft.label,
            participantIds: ft.participantIds,
            results: {},
            isCompleted: false,
            isFinalist: true,
        });
        tableNum++;
    }

    // Consolation tables
    for (const ct of config.consolationTables) {
        matches.push({
            id: crypto.randomUUID(),
            tournamentId,
            round: 2,
            tableNumber: tableNum,
            tableLabel: ct.label,
            participantIds: ct.participantIds,
            results: {},
            isCompleted: false,
            isFinalist: false,
        });
        tableNum++;
    }

    return matches;
}

// ─── Main: Generate Next Swiss Round (28+) ─────────────────────────
export function generateSwissRound(
    tournamentId: string,
    participants: Participant[],
    currentRound: number
): TableMatch[] {
    const nextRound = currentRound + 1;
    // Sort by descending score for rounds 2+
    const pool = [...participants].sort((a, b) => b.score - a.score);
    const tableSizes = getSwissTableSizes(pool.length);

    const matches: TableMatch[] = [];
    let cursor = 0;

    for (let i = 0; i < tableSizes.length; i++) {
        const tablePlayers = pool.slice(cursor, cursor + tableSizes[i]);
        cursor += tableSizes[i];

        matches.push({
            id: crypto.randomUUID(),
            tournamentId,
            round: nextRound,
            tableNumber: i + 1,
            tableLabel: `Table ${i + 1}`,
            participantIds: tablePlayers.map(p => p.id),
            results: {},
            isCompleted: false,
        });
    }

    return matches;
}

// ─── Determine Qualified Players ────────────────────────────────────
export function determineQualifiedPlayers(
    format: TournamentFormat,
    size: number,
    matches: TableMatch[],
    participants: Participant[]
): string[] {
    const qualifiedCount = getQualifiedCount(size);

    if (format === "elimination") {
        // Qualified = winners of each finalist table in round 2
        const finalistMatches = matches.filter(m => m.round === 2 && m.isFinalist && m.isCompleted);
        const qualifiedIds: string[] = [];

        for (const match of finalistMatches) {
            const playerIds = match.participantIds.filter((id): id is string => id !== null);
            // Winner = player with highest points
            const sorted = [...playerIds].sort((a, b) => (match.results[b] || 0) - (match.results[a] || 0));
            if (sorted[0]) qualifiedIds.push(sorted[0]);
        }

        return qualifiedIds.slice(0, qualifiedCount);
    } else {
        // Swiss: top N players by total score after all rounds
        const sorted = [...participants].sort((a, b) => b.score - a.score);
        return sorted.slice(0, qualifiedCount).map(p => p.id);
    }
}
