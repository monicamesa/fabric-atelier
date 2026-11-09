import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LoadingLine } from "./states";

/** Inline gavel (design guide, section 5). The head strikes in a loop only while loading. */
export function Gavel({ loop = false, className }: { loop?: boolean; className?: string }) {
    return (
        <svg viewBox="0 0 96 96" aria-hidden="true" className={cn("text-ink", loop && "docket-gavel-loop", className)}>
            <rect x="14" y="80" width="46" height="8" fill="none" stroke="var(--action)" strokeWidth="4" />
            <g className="docket-gavel-head">
                <line x1="44" y1="52" x2="78" y2="86" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                <rect x="22" y="14" width="22" height="40" rx="3" transform="rotate(-45 33 34)" fill="none" stroke="currentColor" strokeWidth="5" />
            </g>
        </svg>
    );
}

const LINES = ["loading.deliberating", "loading.countingVotes", "loading.readingRecord"] as const;

/** Page loading: gavel, a rotating line and skeletons with the shape of the content. */
export function Deliberating({ children }: { children?: ReactNode }) {
    const { t } = useTranslation();
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const timer = window.setInterval(() => setIndex((value) => (value + 1) % LINES.length), 2600);
        return () => window.clearInterval(timer);
    }, []);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Gavel loop className="size-10" />
                <LoadingLine>{t(LINES[index])}</LoadingLine>
            </div>
            {children}
        </div>
    );
}
