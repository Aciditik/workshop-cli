// Canonical corporation list shared by the scorecard form, the stats page
// filters, and the admin scorecard editor.
export const CORPORATIONS = [
    "Communautés Arcadiennes", "AstroDrill", "Cheung Shing Mars", "Credicor", "Desertron", "Ecoline", "Ecotec", "Green Power",
    "Guilde des Voleurs", "Guilde Ouvrière", "Helion", "Cinématiques Interplanétaires", "Inventrix", "Kuiper Cooperative",
    "Ludophiles d'Asnières et d'ailleurs", "Mining Guild", "Nirgal Enterprise", "Palladin Shipping", "Phobolog", "Point Luna", "Recyclon",
    "Robinson Industries", "Sagitta", "Saturn Systems", "Soleil Vert", "Spire", "Splice", "Teractor", "République de Tharsis", "Thorgate",
    "Tycho Magnetics", "Union Pharmaceutique", "United Nations Mars Initiative", "Valley Trust", "Vitor", "World Series Mars", "Pas de corporation"
];

export const CORPORATION_PLACEHOLDER = "Choisissez votre corporation";

// Corporations renamed after scorecards were submitted: old stored name ->
// current canonical name. Used to display stats consistently even before the
// API normalizes them server-side.
export const CORPORATION_ALIASES: Record<string, string> = {
    "Tharsis Republic": "République de Tharsis",
    "Arcadian Communities": "Communautés Arcadiennes",
    "Interplanetary Cinematics": "Cinématiques Interplanétaires",
};

export function canonicalCorporation(name: string): string {
    return CORPORATION_ALIASES[name] ?? name;
}
