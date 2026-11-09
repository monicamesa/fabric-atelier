import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
    label: string;
    hint?: string;
    error?: string;
}

export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={id} className="text-[14px] font-semibold text-ink">
                {label}
            </label>
            <input
                id={id}
                aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
                aria-invalid={error ? true : undefined}
                className={cn(
                    "min-h-11 rounded-none border bg-paper-raised px-3 text-[15px] text-ink placeholder:text-text-muted",
                    error ? "border-2 border-action" : "border-ink",
                )}
                {...props}
            />
            {hint && (
                <span id={hintId} className="text-[14px] text-text-muted">
                    {hint}
                </span>
            )}
            {error && (
                <span id={errorId} className="text-[14px] font-semibold text-action-text">
                    {error}
                </span>
            )}
        </div>
    );
}

export interface RadioOption<T extends string> {
    value: T;
    label: string;
    description: string;
}

interface RadioFieldProps<T extends string> {
    legend: string;
    name: string;
    value: T;
    options: RadioOption<T>[];
    onChange: (value: T) => void;
}

/** Radio group with a one-line description per option. */
export function RadioField<T extends string>({ legend, name, value, options, onChange }: RadioFieldProps<T>) {
    return (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 text-[14px]">
            <legend className="mb-1.5 font-semibold text-ink">{legend}</legend>
            {options.map((option) => (
                <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1">
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => onChange(option.value)}
                        className="mt-1 size-4 accent-[var(--ink)]"
                    />
                    <span className="text-text">
                        <b className="text-ink">{option.label}</b> · {option.description}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}

interface SelectFieldProps {
    label: string;
    /** Keep the label for screen readers only (row actions). */
    hiddenLabel?: boolean;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
    className?: string;
}

/** Docket select: square, 1 px ink border, 44 px tall, token colours in both themes. */
export function SelectField({ label, hiddenLabel = false, value, onChange, children, className }: SelectFieldProps) {
    return (
        <label className={cn("inline-flex flex-col gap-1.5", className)}>
            <span className={hiddenLabel ? "sr-only" : "text-[14px] font-semibold text-ink"}>{label}</span>
            <span className="relative flex">
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-h-11 w-full appearance-none rounded-none border border-ink bg-paper-raised py-0 pl-3 pr-9 text-[15px] font-semibold text-ink"
                >
                    {children}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink" />
            </span>
        </label>
    );
}
