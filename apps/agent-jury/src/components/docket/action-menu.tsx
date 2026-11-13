import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
    key: string;
    label: string;
    /** Longer accessible name, e.g. "Edit details of Ana". */
    ariaLabel?: string;
    onSelect: () => void;
    tone?: "default" | "danger";
    disabled?: boolean;
}

interface ActionMenuProps {
    /** Visible text of the button, e.g. "Actions". */
    label: string;
    /** Accessible name of the button, e.g. "Actions for Ana". */
    ariaLabel?: string;
    items: ActionMenuItem[];
    /** A short line shown under the items (not an action). */
    note?: ReactNode;
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
}

/**
 * One "Actions ▾" button that opens a small menu (WAI-ARIA menu button): Enter/Space/ArrowDown open it, arrows move,
 * Escape and a click outside close it and give the focus back. The menu overlays what is below, so rows keep one line.
 */
export function ActionMenu({ label, ariaLabel, items, note, disabled, fullWidth, className }: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    useEffect(() => {
        if (open) root.current?.querySelector<HTMLElement>("[role='menuitem']:not([disabled])")?.focus();
    }, [open]);

    function onMenuKey(event: KeyboardEvent) {
        const entries = [...(root.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])") ?? [])];
        const index = entries.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            button.current?.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            entries[(index + step + entries.length) % entries.length]?.focus();
        } else if (event.key === "Tab") {
            setOpen(false);
        }
    }

    return (
        <div ref={root} className={cn("relative inline-block text-left", fullWidth && "w-full", className)}>
            <button
                ref={button}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={ariaLabel}
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 border border-ink bg-transparent px-4 text-[15px] font-semibold text-ink hover:bg-paper-hover disabled:cursor-not-allowed disabled:opacity-60",
                    fullWidth && "w-full",
                )}
            >
                {label}
                <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div
                    id={menuId}
                    role="menu"
                    aria-label={ariaLabel ?? label}
                    onKeyDown={onMenuKey}
                    className={cn("absolute right-0 z-20 mt-1 flex min-w-[220px] flex-col border-2 border-ink bg-paper-raised py-1 shadow-[4px_4px_0_var(--ink)]", fullWidth && "left-0")}
                >
                    {items.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            aria-label={item.ariaLabel}
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                            className={cn(
                                "min-h-11 w-full px-4 text-left text-[15px] font-semibold hover:bg-paper-hover focus-visible:bg-paper-hover disabled:cursor-not-allowed disabled:opacity-60",
                                item.tone === "danger" ? "text-action-text" : "text-ink",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                    {note && <p className="m-0 border-t border-rule px-4 py-2 text-[13px] text-text-muted">{note}</p>}
                </div>
            )}
        </div>
    );
}
