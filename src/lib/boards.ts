// Terraforming Mars maps an organizer can pick for a round. Chosen once per
// round (all tables in that round play on the same board).
export const BOARDS = [
    "🟠 Tharsis",
    "🟢 Elysium",
    "🔵 Hellas",
    "⚪ Vastitas Borealis",
    //"Amazonis Planitia",
    "🟤 Utopia Planitia",
    "🟣 Terra Cimmeria",
] as const;

export type Board = typeof BOARDS[number];
