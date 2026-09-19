export type TournamentStatus = "brouillon" | "en_cours" | "fini";
// "elimination": 2-round table elimination (8-28 players, fixed layouts)
// "swiss": 3-round swiss stage, ranking by cumulative score (29+ players, default)
// "bracket": 3-round table-based elimination tree (29+ players, opt-in) —
// quarterfinals/semifinals/finals, tables halve in count and players each round.
export type TournamentFormat = "elimination" | "swiss" | "bracket";

export interface Participant {
    id: string;
    firstname: string;
    name: string;
    email: string;
    phone: string;
    score: number; // Accrued points
    dnf?: boolean; // Dropped / Did Not Finish — permanent, admin only
    sourceTournamentId?: string; // Finale only: qualifier tournament this player came from (persisted server-side)
}

export interface PlayerScore {
    corporation: string;
    nt: number;
    objectifs: number;
    recompenses: number;
    forets: number;
    villes: number;
    cartes: number;
    megacredits: number;
}

export interface TableMatch {
    id: string;
    tournamentId: string;
    round: number;
    tableNumber: number; // Position in the round
    tableLabel?: string; // e.g. "Finale 1", "Consolation 2", "Table A"
    participantIds: (string | null)[]; // Up to 5 players per table
    results: Record<string, number>; // Maps participantId -> points earned this round
    scorecards?: Record<string, PlayerScore>; // Maps participantId -> detailed score breakdown
    isPendingReview?: boolean; // Set when players submit scores via QR code
    isCompleted: boolean;
    isFinalist?: boolean; // True for finalist tables in elimination format
}

export interface Tournament {
    id: string;
    name: string;
    logoUrl?: string;
    eventDate: string;
    createdAt: string;
    status: TournamentStatus;
    format: TournamentFormat; // "elimination" (16-27) or "swiss" (28+)
    participants: Participant[];
    matches: TableMatch[];
    size: number;
    currentRound: number; // Tracks the current active round
    maxRounds: number; // 2 for elimination, 3 for swiss
    qualifiedCount: number; // Number of qualified players
    qualifiedIds?: string[]; // IDs of qualified players (set when tournament completes)
    ownerId?: string; // Owner user ID (set by admin when creating on behalf of organizer)
}
