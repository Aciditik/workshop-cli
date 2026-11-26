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
