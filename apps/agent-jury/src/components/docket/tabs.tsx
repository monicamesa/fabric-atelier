import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
    id: T;
    label: string;
}

interface TabsProps<T extends string> {
    label: string;
    tabs: TabItem<T>[];
    selected: T;
    onSelect: (id: T) => void;
    idPrefix: string;
}

/** WAI-ARIA tabs; the matching panel uses id `${idPrefix}-panel-${id}`. Arrow keys move between tabs. */
export function Tabs<T extends string>({ label, tabs, selected, onSelect, idPrefix }: TabsProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    function onKeyDown(event: KeyboardEvent, index: number) {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + tabs.length) % tabs.length;
        onSelect(tabs[next].id);
        refs.current[next]?.focus();
    }

    return (
        <div role="tablist" aria-label={label} className="flex flex-wrap border-b border-ink">
            {tabs.map((tab, index) => {
                const isSelected = tab.id === selected;
                return (
                    <button
                        key={tab.id}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        id={`${idPrefix}-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-controls={`${idPrefix}-panel-${tab.id}`}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onSelect(tab.id)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "-mb-px min-h-[46px] border-b-[3px] px-5 text-[16px]",
                            isSelected ? "border-action font-bold text-ink" : "border-transparent font-semibold text-text-muted hover:text-ink",
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
