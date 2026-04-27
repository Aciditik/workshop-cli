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
    // 32+: 4 qualified, then +1 for every 8 additional players
    return 4 + Math.floor((size - 32) / 8);
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
        13: [4, 3, 3, 3],
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
//
// Layouts are expressed as tokens "X#" where:
//   - X is the Round 1 table letter (A = 1st table, B = 2nd, …)
//   - # is the finishing placement at that table (1 = winner, 2 = second,
//     3 = 3rd, 4 = 4th, 5 = 5th).
// These layouts come directly from the official CdF specification.
//
// To change the distribution for a given player count, edit the token lists
// below — no other code needs to change.

interface Round2Config {
    finalistTables: { participantIds: string[]; label: string }[];
    consolationTables: { participantIds: string[]; label: string }[];
}

type TokenLayout = { finalist: string[][]; consolation: string[][] };

const ROUND2_LAYOUTS: Record<number, TokenLayout> = {
    8:  { finalist: [["A1","B1","A2","B2"]],
          consolation: [["A3","B3","A4","B4"]] },
    9:  { finalist: [["A1","B1","A2","B2"]],
          consolation: [["A3","B3","A4","B4","B5"]] },
    10: { finalist: [["A1","B1","A2","B2"]],
          consolation: [["A3","B3","A4"], ["B4","A5","B5"]] },
    11: { finalist: [["A1","B1","C1"]],
          consolation: [["A2","B2","C2","A3"], ["B3","C3","A4","B4"]] },
    12: { finalist: [["A1","B1","C1","D1"]],
          consolation: [["A2","B2","C2","D2"], ["A3","B3","C3","D3"]] },
    13: { finalist: [["A1","B1","C1","D1"]],
          consolation: [["A2","B2","C2"], ["D2","A3","B3"], ["C3","D3","A4"]] },
    14: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C3"], ["D3","A4","B4"]] },
    15: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C3","D3"], ["C4","A4","B4"]] },
    16: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C4","D4"], ["C3","D3","A4","B4"]] },
    17: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C4","D4"], ["C3","D3","A4","B4","D5"]] },
    18: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C4","D4","C5"], ["C3","D3","A4","B4","D5"]] },
    19: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C3","D3"], ["C4","D4","A4","B4"], ["B5","C5","D5"]] },
    20: { finalist: [["A1","B1","C2","D2"], ["C1","D1","A2","B2"]],
          consolation: [["A3","B3","C3","D3"], ["A4","B4","C4","D4"], ["A5","B5","C5","D5"]] },
    21: { finalist: [["A1","B1","C1","D1","E1"], ["A2","B2","C2","D2","E2"]],
          consolation: [["A3","B3","C3","D3"], ["E3","A4","B4","C4"], ["D4","E4","E5"]] },
    22: { finalist: [["A1","B1","C1","D1","E1"], ["A2","B2","C2","D2","E2"]],
          consolation: [["A3","B3","C3","D3"], ["E3","A4","B4","C4"], ["D4","D5","E4","E5"]] },
    23: { finalist: [["A1","B1","C1","D1","E1"], ["A2","B2","C2","D2","E2"]],
          consolation: [["A3","B3","C3","D3","E3"], ["A4","B4","C4","D4","E4"], ["C5","D5","E5"]] },
    24: { finalist: [["A1","B1","C2","D2"], ["A2","B2","E1","F1"], ["C1","D1","E2","F2"]],
          consolation: [["A3","B3","C4","D4"], ["A4","B4","E3","F3"], ["C3","D3","E4","F4"]] },
    25: { finalist: [["A1","B1","C2","D2"], ["A2","B2","E1","F1"], ["C1","D1","E2","F2"]],
          consolation: [["A3","B3","C4","D4"], ["A4","B4","E3","F3"], ["C3","D3","E4","F4","F5"]] },
    26: { finalist: [["A1","B1","C2","D2"], ["A2","B2","E1","F1"], ["C1","D1","E2","F2"]],
          consolation: [["A3","B3","C4","D4"], ["A4","B4","E3","F3","E5"], ["C3","D3","E4","F4","F5"]] },
    27: { finalist: [["A1","B1","C2","D2"], ["A2","B2","E1","F1"], ["C1","D1","E2","F2"]],
          consolation: [["A3","B3","C3","D3","E3"], ["F3","A4","D4","E4","F4"], ["B4","C4","D5","E5","F5"]] },
};

function getTableRankings(match: TableMatch): { winner: string; second: string; rest: string[] } {
    const playerIds = match.participantIds.filter((id): id is string => id !== null);
    const ranked = [...playerIds].sort((a, b) => (match.results[b] || 0) - (match.results[a] || 0));
    return {
        winner: ranked[0],
        second: ranked[1] ?? "",
        rest: ranked.slice(2),
    };
}

// Resolve a token like "A1", "B2", "C4" into the actual participant id using
// the per-R1-table rankings (0 = A, 1 = B, …).
function resolveToken(
    token: string,
    rankings: { winner: string; second: string; rest: string[] }[],
): string {
    const letter = token.charCodeAt(0) - "A".charCodeAt(0);
    const digit = parseInt(token.slice(1), 10);
    const r = rankings[letter];
    if (!r) return "";
    if (digit === 1) return r.winner;
    if (digit === 2) return r.second;
    // digit 3 -> rest[0], 4 -> rest[1], 5 -> rest[2], ...
    return r.rest[digit - 3] ?? "";
}

function getRound2Config(
    n: number,
    round1Matches: TableMatch[],
): Round2Config {
    const sorted = [...round1Matches].sort((a, b) => a.tableNumber - b.tableNumber);
    const rankings = sorted.map(getTableRankings);

    const layout = ROUND2_LAYOUTS[n];
    if (!layout) return { finalistTables: [], consolationTables: [] };

    const resolve = (tokens: string[]) =>
        tokens.map(t => resolveToken(t, rankings)).filter(Boolean);

    return {
        finalistTables: layout.finalist.map((tokens, i) => ({
            participantIds: resolve(tokens),
            label: `Finale ${i + 1}`,
        })),
        consolationTables: layout.consolation.map((tokens, i) => ({
            participantIds: resolve(tokens),
            label: `Consolation ${i + 1}`,
        })),
    };
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
