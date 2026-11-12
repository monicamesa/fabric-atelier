import { cn } from "@/lib/utils";

export type LaunchGavelMode = "breathe" | "strike" | "loop" | "still";

interface LaunchGavelProps {
    mode: LaunchGavelMode;
    /** Accessible name; the gavel is an image, not decoration. */
    label: string;
    className?: string;
}

/** The big gavel of the launch screen and the Intro. Motion is decided by CSS (and switched off under reduced motion). */
export function LaunchGavel({ mode, label, className }: LaunchGavelProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label={label}
            className={cn("text-ink", mode !== "still" && `launch-gavel-${mode}`, className)}
        >
            <g className="launch-gavel-head" stroke="currentColor" strokeWidth="2.2">
                <rect x="9" y="15" width="26" height="13" rx="3" transform="rotate(-45 22 21.5)" />
                <line x1="27" y1="27" x2="52" y2="52" />
            </g>
            {mode === "strike" && (
                <g className="launch-gavel-impact" stroke="var(--action)" strokeWidth="1.8">
                    <line x1="20" y1="46" x2="20" y2="41" />
                    <line x1="11" y1="48" x2="7" y2="44" />
                    <line x1="29" y1="48" x2="33" y2="44" />
                </g>
            )}
            <rect x="6" y="52" width="28" height="6" rx="2" stroke="var(--action)" strokeWidth="2.2" />
        </svg>
    );
}
