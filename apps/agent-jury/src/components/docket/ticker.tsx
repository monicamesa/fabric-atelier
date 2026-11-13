import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Newspaper, Pause, Play } from "lucide-react";
import { LanguageBadge } from "@/components/docket/language-badge";
import { TICKER_MIN_ITEMS, type TickerEvent, type TickerStatus } from "@/data/ticker-events";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { formatRoute } from "@/lib/route";
import { caseNumber } from "@/screens/docket/docket-views";

const QUESTION_LENGTH = 50;

/** Fills use tokens that are the same in both themes, because the band is dark in both. Status is always text too. */
const BADGE: Record<TickerStatus, string> = {
    new: "border border-ticker-text text-ticker-text",
    disputed: "bg-action text-ticker-text",
    ruled: "bg-ruled-fill text-ticker-text",
    correct: "bg-ruled-fill text-ticker-text",
    incorrect: "bg-action text-ticker-text",
    unclear: "border border-ticker-text text-ticker-text",
    overruled: "bg-overruled text-overruled-text",
};

const FOCUS = "focus-visible:[outline-color:var(--ticker-text)]";

function truncate(text: string): string {
    return text.length > QUESTION_LENGTH ? `${text.slice(0, QUESTION_LENGTH - 1).trimEnd()}…` : text;
}

function Detail({ event }: { event: TickerEvent }) {
    const { t } = useTranslation();
    if (event.status === "ruled" && event.agreed !== undefined && event.total !== undefined) {
        return event.agreed === event.total ? t("ticker.detail.ruledAll", { count: event.agreed }) : t("ticker.detail.ruledSome", { agreed: event.agreed, total: event.total });
    }
    return t(`ticker.detail.${event.status}`);
}

function Line({ event, hidden }: { event: TickerEvent; hidden?: boolean }) {
    const { t } = useTranslation();
    return (
        <a
            href={formatRoute({ page: "case", caseId: event.caseId })}
            tabIndex={hidden ? -1 : undefined}
            className={cn("text-ticker-text no-underline hover:underline", FOCUS)}
        >
            <b className={cn("inline-block px-1.5 py-0.5 align-middle font-sans text-[11px] font-bold uppercase tracking-[0.08em]", BADGE[event.status])}>
                {t(`ticker.status.${event.status}`)}
            </b>{" "}
            <span aria-hidden="true">·</span>{" "}
            <span>
                {caseNumber(event.caseId)} {truncate(event.caseText)}
            </span>{" "}
            <LanguageBadge language={event.caseLanguage} className="border-ticker-text text-ticker-text" />{" "}
            <span aria-hidden="true">·</span>{" "}
            <span>
                <Detail event={event} />
            </span>
        </a>
    );
}

/**
 * "Latest on the docket" band (Home only, design guide section 5). One line per case, from records already loaded.
 * It scrolls in a 48 s loop over a duplicated list (the copy is hidden from screen readers), pauses on hover, on
 * keyboard focus and with the pause button, and under reduced motion it is a static, wrapping list. No live region.
 */
export function Ticker({ events }: { events: TickerEvent[] }) {
    const { t } = useTranslation();
    const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
    const [paused, setPaused] = useState(false);
    if (events.length < TICKER_MIN_ITEMS) return null;

    const label = (
        <h2 className="m-0 flex shrink-0 items-center gap-2 bg-action px-3 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-ticker-text sm:px-4">
            <Newspaper aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t("ticker.title")}</span>
            <span className="sm:hidden">{t("ticker.short")}</span>
        </h2>
    );

    if (reduced) {
        return (
            <section aria-label={t("ticker.label")} data-motion="static" className="docket-ticker flex items-stretch bg-ticker-bg font-mono text-[14px] text-ticker-text">
                {label}
                <ul className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-x-8 gap-y-1 px-4 py-2">
                    {events.map((event) => (
                        <li key={`${event.caseId}-${event.status}`}>
                            <Line event={event} />
                        </li>
                    ))}
                </ul>
            </section>
        );
    }

    const list = (copy: boolean) => (
        <ul aria-hidden={copy || undefined} className="m-0 flex shrink-0 list-none items-center gap-10 p-0 pr-10">
            {events.map((event) => (
                <li key={`${event.caseId}-${event.status}`} className="whitespace-nowrap">
                    <Line event={event} hidden={copy} />
                </li>
            ))}
        </ul>
    );
    return (
        <section
            aria-label={t("ticker.label")}
            data-motion="scroll"
            data-paused={paused}
            className="docket-ticker flex min-h-10 items-stretch overflow-hidden bg-ticker-bg font-mono text-[14px] text-ticker-text"
        >
            {label}
            <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-4">
                <div className="docket-ticker-track flex w-max">
                    {list(false)}
                    {list(true)}
                </div>
            </div>
            <button
                type="button"
                aria-pressed={paused}
                aria-label={t("ticker.pause")}
                onClick={() => setPaused((value) => !value)}
                className={cn("flex min-h-10 min-w-10 shrink-0 items-center justify-center border-l border-ticker-text/40 text-ticker-text hover:bg-ticker-text/10", FOCUS)}
            >
                {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
            </button>
        </section>
    );
}
