"use client";

// Lightweight dependency-free charts for the stats page.
// All components accept plain data arrays and render with divs/SVG.

export function BarChart({
    data,
    height = 160,
    formatValue = (v: number) => String(v),
}: {
    data: { label: string; value: number }[];
    height?: number;
    formatValue?: (v: number) => string;
}) {
    if (data.length === 0) return <Empty />;
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center justify-end gap-1 min-w-[36px] flex-1 h-full group">
                    <span className="text-[10px] font-prototype text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatValue(d.value)}
                    </span>
                    <div
                        className="w-full max-w-10 bg-primary/80 group-hover:bg-primary rounded-t transition-colors"
                        style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
                        title={`${d.label}: ${formatValue(d.value)}`}
                    />
                    <span className="text-[9px] font-prototype text-muted-foreground truncate w-full text-center" title={d.label}>
                        {d.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function HBarChart({
    data,
    formatValue = (v: number) => String(v),
    highlightMin,
}: {
    data: { label: string; value: number; sub?: string; dimmed?: boolean }[];
    formatValue?: (v: number) => string;
    highlightMin?: boolean;
}) {
    if (data.length === 0) return <Empty />;
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="space-y-1.5">
            {data.map((d, i) => (
                <div key={i} className={`flex items-center gap-2 ${d.dimmed ? "opacity-50" : ""}`}>
                    <span className="w-32 sm:w-44 shrink-0 truncate text-xs font-prototype text-foreground" title={d.label}>
                        {d.label}
                    </span>
                    <div className="flex-1 h-5 bg-muted/20 rounded overflow-hidden">
                        <div
                            className="h-full bg-primary/80 rounded flex items-center justify-end pr-1.5"
                            style={{ width: `${Math.max((d.value / max) * 100, 3)}%` }}
                        >
                            <span className="text-[10px] font-prototype text-primary-foreground whitespace-nowrap">
                                {formatValue(d.value)}
                            </span>
                        </div>
                    </div>
                    {d.sub && (
                        <span className="w-14 shrink-0 text-right text-[10px] font-prototype text-muted-foreground">{d.sub}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function Histogram({
    values,
    bins = 10,
    height = 140,
}: {
    values: number[];
    bins?: number;
    height?: number;
}) {
    if (values.length === 0) return <Empty />;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const bucketSize = range / bins;
    const counts = Array(bins).fill(0);
    for (const v of values) {
        const idx = Math.min(Math.floor((v - min) / bucketSize), bins - 1);
        counts[idx]++;
    }
    const maxCount = Math.max(...counts, 1);
    return (
        <div>
            <div className="flex items-end gap-1" style={{ height }}>
                {counts.map((c, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                        <span className="text-[10px] font-prototype text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {c}
                        </span>
                        <div
                            className="w-full bg-primary/80 group-hover:bg-primary rounded-t transition-colors"
                            style={{ height: `${Math.max((c / maxCount) * 100, c > 0 ? 3 : 0)}%` }}
                            title={`${Math.round(min + i * bucketSize)}–${Math.round(min + (i + 1) * bucketSize)} pts : ${c}`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] font-prototype text-muted-foreground mt-1">
                <span>{Math.round(min)} pts</span>
                <span>{Math.round(max)} pts</span>
            </div>
        </div>
    );
}

export function LineChart({
    points,
    height = 160,
    formatValue = (v: number) => String(v),
}: {
    points: { label: string; value: number }[];
    height?: number;
    formatValue?: (v: number) => string;
}) {
    if (points.length === 0) return <Empty />;
    if (points.length === 1) {
        return (
            <div className="flex items-center justify-center text-sm font-prototype text-muted-foreground" style={{ height }}>
                {points[0].label} : {formatValue(points[0].value)} — une seule partie
            </div>
        );
    }
    const W = 600;
    const H = 120;
    const PAD = 24;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
    const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD);
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
                <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {points.map((p, i) => (
                    <circle key={i} cx={x(i)} cy={y(p.value)} r="4" className="fill-primary">
                        <title>{`${p.label}: ${formatValue(p.value)}`}</title>
                    </circle>
                ))}
            </svg>
            <div className="flex justify-between text-[10px] font-prototype text-muted-foreground mt-1 gap-2 overflow-hidden">
                {points.map((p, i) => (
                    <span key={i} className="truncate" title={`${p.label}: ${formatValue(p.value)}`}>
                        {p.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function Empty() {
    return <p className="text-muted-foreground font-prototype text-sm py-4">Pas assez de données.</p>;
}
