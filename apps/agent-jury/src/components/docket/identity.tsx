import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { avatarTone, initials, shortId } from "@/lib/people";
import { cn } from "@/lib/utils";

// Each pair reaches 4.5:1 in both themes (the dark-theme tokens are light, --ink-inverse turns dark).
const AVATAR_TONES = ["bg-ruled text-ink-inverse", "bg-review-text text-ink-inverse", "bg-action-text text-ink-inverse", "bg-ink text-ink-inverse"];

/** Round initials badge in a stable colour per person; dashed when the person is inactive. */
export function Avatar({ id, label, inactive = false }: { id: string; label: string; inactive?: boolean }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                inactive ? "border-2 border-dashed border-text-muted text-text-muted" : AVATAR_TONES[avatarTone(id, AVATAR_TONES.length)],
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
