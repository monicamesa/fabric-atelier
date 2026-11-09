import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
    /** Accessible name when the visible label is an abbreviation. */
    ariaLabel?: string;
    lang?: string;
}

interface SegmentedProps<T extends string> {
    label: string;
    value: T;
    options: SegmentOption<T>[];
    onChange: (value: T) => void;
    size?: "sm" | "md";
}

/** Toggle buttons with aria-pressed (language switch, list filters). */
export function Segmented<T extends string>({ label, value, options, onChange, size = "md" }: SegmentedProps<T>) {
    return (
        <div role="group" aria-label={label} className={cn("flex border border-ink", size === "md" && "gap-1 p-[3px]")}>
            {options.map((option) => {
                const pressed = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={pressed}
                        aria-label={option.ariaLabel}
                        lang={option.lang}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "min-w-11 font-semibold",
                            size === "sm" ? "min-h-9 text-[13px] font-bold" : "min-h-[34px] px-3.5 text-[14px]",
                            pressed ? "bg-ink text-ink-inverse" : "bg-transparent text-ink hover:bg-paper-hover",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
