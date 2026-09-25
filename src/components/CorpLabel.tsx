import Image from "next/image";
import { CORPORATION_LOGOS } from "@/lib/corporation-logos";
import { canonicalCorporation } from "@/lib/corporations";

// Renders a corporation's logo when one exists in src/assets/corpos,
// otherwise falls back to the plain corporation name. Old (renamed)
// corporation names are normalized so their logo still resolves.
export function CorpLabel({
    name,
    size = 20,
    className = "",
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    const canonical = canonicalCorporation(name);
    const logo = CORPORATION_LOGOS[canonical];
    if (!logo) {
        return <span className={className}>{canonical}</span>;
    }
    return (
        // Logos sit on a soft, muted light background: several assets contain
        // dark shapes/text that otherwise disappear against the dark theme.
        // Kept low-contrast (not pure white) so it doesn't clash with the UI.
        <span
            title={canonical}
            className={`inline-flex items-center justify-center bg-zinc-300/90 rounded-sm px-1 py-0.5 shrink-0 ${className}`}
        >
            <Image
                src={logo}
                alt={canonical}
                style={{ height: size, width: "auto" }}
                className="object-contain"
            />
        </span>
    );
}
