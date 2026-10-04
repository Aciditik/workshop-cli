// Shared helper for displaying a player's name. When `usePseudo` is on and
// the player has a pseudo set, show that instead of firstname+name.
export function playerDisplayName(
    p: { firstname: string; name: string; pseudo?: string } | null | undefined,
    usePseudo: boolean
): string {
    if (!p) return "Unknown";
    if (usePseudo && p.pseudo) return p.pseudo;
    return `${p.firstname} ${p.name}`.trim();
}
