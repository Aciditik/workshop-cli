"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { CORPORATIONS, CORPORATION_PLACEHOLDER } from "@/lib/corporations";
import { CorpLabel } from "@/components/CorpLabel";
import type { OverviewEntry } from "./OverviewStats";

const COMPARE_COLORS = [
    { ring: "ring-orange-400", border: "border-orange-400", bg: "bg-orange-400/10", text: "text-orange-400", dot: "bg-orange-400" },
    { ring: "ring-sky-400", border: "border-sky-400", bg: "bg-sky-400/10", text: "text-sky-400", dot: "bg-sky-400" },
    { ring: "ring-emerald-400", border: "border-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-400", dot: "bg-emerald-400" },
];

const CATEGORY_KEYS = ["nt", "objectifs", "recompenses", "forets", "villes", "cartes"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
    nt: "NT",
    objectifs: "Objectifs",
    recompenses: "Récomp.",
    forets: "Forêts",
    villes: "Villes",
    cartes: "Cartes",
};

interface CorpStats {
    corporation: string;
    count: number;
    wins: number;
    winRate: number;
    avgScore: number;
    bestScore: number;
    bestPlayer: string;
    avgByCategory: Record<CategoryKey, number>;
    avgRank: number;
}

function computeCorpStats(entries: OverviewEntry[]): CorpStats[] {
    const map = new Map<string, {
        scores: number[];
        wins: number;
        bestScore: number;
        bestPlayer: string;
        cat: Record<CategoryKey, number>;
        rankSum: number;
    }>();
    for (const e of entries) {
        if (!e.corporation || e.corporation === CORPORATION_PLACEHOLDER || e.corporation === "Pas de corporation") continue;
        let c = map.get(e.corporation);
        if (!c) {
            c = {
                scores: [],
                wins: 0,
                bestScore: 0,
                bestPlayer: "",
                cat: { nt: 0, objectifs: 0, recompenses: 0, forets: 0, villes: 0, cartes: 0 },
                rankSum: 0,
            };
            map.set(e.corporation, c);
        }
        c.scores.push(e.totalScore);
        if (e.rank === 1) c.wins++;
        c.rankSum += e.rank;
        c.cat.nt += e.nt || 0;
        c.cat.objectifs += e.objectifs || 0;
        c.cat.recompenses += e.recompenses || 0;
        c.cat.forets += e.forets || 0;
        c.cat.villes += e.villes || 0;
        c.cat.cartes += e.cartes || 0;
        if (e.totalScore > c.bestScore) {
            c.bestScore = e.totalScore;
            c.bestPlayer = e.playerName;
        }
    }
    return Array.from(map.entries()).map(([corporation, c]) => ({
        corporation,
        count: c.scores.length,
        wins: c.wins,
        winRate: Math.round((c.wins / c.scores.length) * 100),
        avgScore: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
        bestScore: c.bestScore,
        bestPlayer: c.bestPlayer,
        avgByCategory: Object.fromEntries(
            CATEGORY_KEYS.map((k) => [k, Math.round((c.cat[k] / c.scores.length) * 10) / 10])
        ) as Record<CategoryKey, number>,
        avgRank: Math.round((c.rankSum / c.scores.length) * 100) / 100,
    }));
}

// Pick 2-3 corporations from the logo grid to compare their stats side by
// side. Follows the board filter through the `entries` prop.
export function CorpCompare({ entries }: { entries: OverviewEntry[] }) {
    const [selected, setSelected] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const stats = useMemo(() => computeCorpStats(entries), [entries]);
    const byName = useMemo(() => new Map(stats.map((s) => [s.corporation, s])), [stats]);

    const toggle = (corp: string) =>
        setSelected((prev) =>
            prev.includes(corp) ? prev.filter((c) => c !== corp) : prev.length < 3 ? [...prev, corp] : prev
        );

    const rows: { label: string; render: (s: CorpStats) => React.ReactNode }[] = [
        { label: "Parties jouées", render: (s) => s.count },
        { label: "Victoires (1er à table)", render: (s) => s.wins },
        { label: "Taux de victoire", render: (s) => `${s.winRate}%` },
        { label: "Place moyenne", render: (s) => s.avgRank.toFixed(2) },
        { label: "Score moyen", render: (s) => s.avgScore },
        { label: "Meilleur score", render: (s) => s.bestScore },
        { label: "Meilleur joueur", render: (s) => <span className="text-xs">{s.bestPlayer}</span> },
        ...CATEGORY_KEYS.map((k) => ({
            label: `Moy. ${CATEGORY_LABELS[k]}`,
            render: (s: CorpStats) => s.avgByCategory[k],
        })),
    ];

    const searchQuery = search.trim().toLowerCase();
    const visibleCorps = CORPORATIONS.filter(
        (c) => c !== "Pas de corporation" && (!searchQuery || c.toLowerCase().includes(searchQuery))
    );

    return (
        <div className="space-y-3">
            <p className="text-[11px] font-prototype uppercase tracking-wider text-muted-foreground">Comparer des corporations</p>

            <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-prototype font-semibold">
                        Choisissez 2 ou 3 corporations{" "}
                        <span className={`ml-1 ${selected.length === 3 ? "text-[#e8743b]" : "text-muted-foreground"}`}>
                            ({selected.length}/3)
                        </span>
                    </p>
                    <div className="flex items-center gap-2">
                        {selected.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelected([])}
                                className="text-xs font-prototype text-muted-foreground hover:text-destructive transition-colors"
                            >
                                Tout désélectionner
                            </button>
                        )}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher..."
                                className="bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs font-prototype text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
                            />
                        </div>
                    </div>
                </div>

                {visibleCorps.length === 0 ? (
                    <p className="text-muted-foreground font-prototype text-sm py-2">Aucune corporation ne correspond à la recherche.</p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {visibleCorps.map((c) => {
                            const activeIdx = selected.indexOf(c);
                            const active = activeIdx !== -1;
                            const hasData = byName.has(c);
                            const disabled = !active && selected.length >= 3;
                            const color = active ? COMPARE_COLORS[activeIdx] : null;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => toggle(c)}
                                    disabled={disabled}
                                    title={c}
                                    className={`relative flex items-center justify-center h-14 px-2 rounded-lg border text-xs font-prototype transition-all ${
                                        active
                                            ? `${color!.bg} border-transparent ring-2 ${color!.ring}`
                                            : hasData
                                                ? "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-primary/40"
                                                : "bg-muted/5 border-border/30 text-muted-foreground/50"
                                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                                >
                                    {active && (
                                        <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full ${color!.dot} text-[9px] text-black font-bold flex items-center justify-center shadow`}>
                                            {activeIdx + 1}
                                        </span>
                                    )}
                                    <CorpLabel name={c} size={44} className="max-w-full" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {selected.length >= 2 ? (
                <div className="rounded-[10px] border border-[#26252c] bg-[#16151a] overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px] border-separate border-spacing-0">
                        <thead>
                            <tr>
                                <th className="py-2 pr-3 text-left text-xs font-prototype text-muted-foreground border-b border-border"></th>
                                {selected.map((c, i) => (
                                    <th key={c} className={`py-2 px-2 text-center font-prototype text-xs border-b-2 ${COMPARE_COLORS[i].border}`}>
                                        <span className="flex flex-col items-center justify-center gap-1">
                                            <CorpLabel name={c} size={26} />
                                            <span className="flex items-center gap-1">
                                                <span className={`truncate max-w-[100px] font-semibold ${COMPARE_COLORS[i].text}`}>{c}</span>
                                                <button type="button" onClick={() => toggle(c)} className="text-muted-foreground hover:text-destructive shrink-0">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, ri) => (
                                <tr key={r.label} className={ri % 2 === 0 ? "bg-muted/10" : ""}>
                                    <td className="py-2 pr-3 pl-3 text-xs font-prototype text-muted-foreground border-b border-border/40">{r.label}</td>
                                    {selected.map((c, i) => {
                                        const s = byName.get(c);
                                        return (
                                            <td
                                                key={c}
                                                className={`py-2 px-2 text-center font-prototype font-semibold border-b border-border/40 ${s ? COMPARE_COLORS[i].bg : ""}`}
                                            >
                                                {s ? r.render(s) : <span className="text-muted-foreground font-normal">—</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-muted-foreground font-prototype text-sm py-2 text-center">
                    Sélectionnez au moins 2 corporations ci-dessus pour les comparer.
                </p>
            )}
        </div>
    );
}
