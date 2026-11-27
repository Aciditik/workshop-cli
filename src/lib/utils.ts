import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "Qualifier CdF 2026 - Paris BNF" → "Q26 - Paris BNF". Non-qualifier names
// pass through unchanged; season year comes from the name, eventDate as
// fallback (same convention as the stats page).
export function shortTournamentName(name: string, eventDate?: string): string {
  if (!name || !/\bqualif\w*/i.test(name)) return name;
  const suffix = name.split("-").slice(1).join("-").trim();
  const year = name.match(/\b(19|20)\d{2}\b/)?.[0] ?? (eventDate ?? "").match(/\d{4}/)?.[0];
  if (!suffix || !year) return name;
  return `Q${year.slice(-2)} - ${suffix}`;
}

// League scope: "ligue" = Terraforming Mars Ligue data space, "cdf" (default)
// = the normal CdF space. One site, one deployment — the super admin picks
// the space after login (stored locally) and it's sent as an X-League header
// on every API call so league tournaments stay invisible to everyone else.
export type LeagueMode = "cdf" | "ligue";

// Guarded by the logged-in account, not just the raw flag — a stale
// "leagueMode" value left in localStorage (e.g. from a previous session on
// a shared browser) must never scope a different, non-super-admin account.
export function getLeagueMode(): LeagueMode {
  if (typeof window === "undefined") return "cdf";
  if (localStorage.getItem("authEmail") !== SUPER_ADMIN_EMAIL) return "cdf";
  return localStorage.getItem("leagueMode") === "ligue" ? "ligue" : "cdf";
}

export function leagueHeader(): Record<string, string> {
  return getLeagueMode() === "ligue" ? { "X-League": "ligue" } : {};
}

export const SUPER_ADMIN_EMAIL = "spadmin@tm.com";
