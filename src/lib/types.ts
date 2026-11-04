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
    pseudo?: string; // Optional in-game nickname, shown instead of firstname+name when toggled on
    email: string;
    phone: string;
    score: number; // Accrued points
    dnf?: boolean; // Dropped / Did Not Finish — permanent, admin only
    sourceTournamentId?: string; // Finale only: qualifier tournament this player came from (persisted server-side)
    teamId?: string; // Finale only: references a Team in Tournament.teams
}

export interface Team {
    id: string;
    name: string;
    tag: string; // Key into TEAM_TAGS (src/lib/team-tags.ts), used as the team's icon
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
    roundBoards?: Record<number, string>; // Maps round number -> board name chosen by the organizer
    ownerId?: string; // Owner user ID (set by admin when creating on behalf of organizer)
    teams?: Team[]; // Finale only: team rosters (players reference a team via Participant.teamId)
    // Two-day CdF Finale: set when the organizer clicks "Passer au Jour 2"
    // after Day 1's last round. day2StartRound is the first absolute round
    // number that belongs to Day 2 (e.g. 4 when Day 1 had 3 rounds);
    // day2ParticipantIds are the top 32 Day 1 finishers carried over, with
    // their Participant.score reset to 0 at the moment of the transition.
    day2StartRound?: number;
    day2ParticipantIds?: string[];
    // Finale suspense reveal: each day's final (round 3) classement — both
    // the individual ranking and the team ranking — stays hidden from
    // non-admins (spectators/players) once that round starts resolving,
    // until the organizer explicitly publishes it.
    day1ResultsPublished?: boolean;
    day2ResultsPublished?: boolean;
}
