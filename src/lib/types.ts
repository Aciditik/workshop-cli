export type TournamentStatus = "draft" | "in_progress" | "completed";

export interface Participant {
    id: string;
    name: string;
    score: number; // Accrued Swiss format points
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
    participantIds: (string | null)[]; // Up to 4 players per table
    results: Record<string, number>; // Maps participantId -> points earned this round
    scorecards?: Record<string, PlayerScore>; // Maps participantId -> detailed score breakdown
    isPendingReview?: boolean; // Set when players submit scores via QR code
    isCompleted: boolean;
}

export interface Tournament {
    id: string;
    name: string;
    logoUrl?: string;
    eventDate: string;
    createdAt: string;
    status: TournamentStatus;
    participants: Participant[];
    matches: TableMatch[];
    size: number;
    currentRound: number; // Tracks the current active round
}
