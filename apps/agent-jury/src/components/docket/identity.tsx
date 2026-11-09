import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { initials, shortId } from "@/lib/people";
import { cn } from "@/lib/utils";

/** Round initials badge; dashed when the person is inactive. */
export function Avatar({ label, inactive = false }: { label: string; inactive?: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                inactive ? "border-2 border-dashed border-text-muted text-text-muted" : "bg-ink text-ink-inverse",
            )}
        >
            {initials(label)}
        </span>
    );
}

/** An id shortened to first 4 + last 4 characters, with a button that copies the full id. */
export function ShortId({ id, label }: { id: string; label: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <span className="inline-flex items-center gap-1">
            <span className="font-mono text-[13px] text-text-muted" title={id}>
                {label} {shortId(id)}
            </span>
            <button
                type="button"
                onClick={() => void copy()}
                aria-label={t("common.copyId", { label })}
                className="inline-flex size-9 items-center justify-center text-ink hover:bg-paper-hover"
            >
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            </button>
            <span role="status" className="sr-only">
                {copied ? t("states.copied") : ""}
            </span>
        </span>
    );
}
