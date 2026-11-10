import { cn } from "@/lib/utils";

export type StampTone = "correct" | "incorrect" | "unclear";

const TONES: Record<StampTone, string> = {
    correct: "border-ruled text-ruled",
    incorrect: "border-action text-action-text",
    unclear: "border-review text-review-text",
};

/** Thick-bordered verdict stamp: CORRECT, INCORRECT or UNCLEAR. The label is always text, never colour alone. */
export function Stamp({ tone, children, className }: { tone: StampTone; children: string; className?: string }) {
    return (
        <span
            className={cn(
                "docket-stamp inline-block -rotate-[8deg] border-4 px-3 py-1 font-serif text-[22px] font-black uppercase leading-none tracking-[0.04em]",
                TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}
