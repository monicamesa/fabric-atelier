import { useTranslation } from "react-i18next";
import { formatRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type { TurnLine, YourTurn } from "@/screens/docket/your-turn";

interface YourTurnPanelProps {
    agentId: string;
    agentName: string;
    turn: YourTurn;
    className?: string;
}

function hrefFor(line: TurnLine, agentId: string): string {
    if (line.key === "review" && line.hearingId) return formatRoute({ page: "hearing", hearingId: line.hearingId });
    if (line.key === "hearing") return formatRoute({ page: "hearings", agentId });
    return formatRoute({ page: "case", caseId: line.caseId ?? "" });
}

const LINK = "font-bold text-action-text underline underline-offset-2 hover:text-ink";

/**
 * "Your turn": an editorial sidebar, not a card. Small-caps heading with the agent on the right, a 1 px rule, then plain
 * lines of text with one link each (at most four, most urgent first).
 */
export function YourTurnPanel({ agentId, agentName, turn, className }: YourTurnPanelProps) {
    const { t } = useTranslation();
    if (turn.lines.length === 0 && !turn.upToDate) return null;
    return (
        <section aria-labelledby="your-turn-title" className={cn("flex flex-col gap-3", className)}>
            <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
                <h2 id="your-turn-title" className="m-0 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                    {t("turn.title")}
                </h2>
                <span className="min-w-0 truncate text-[14px] text-text-muted">{agentName}</span>
            </div>
            {turn.upToDate ? (
                <div className="flex flex-col gap-2">
                    <p className="m-0 font-serif text-[26px] leading-tight text-ink">{t("turn.upToDate")}</p>
                    <p className="m-0 text-[15px] leading-normal text-text">
                        {t("turn.nobodyWaiting")}
                        {turn.othersWaiting > 0 && ` ${t("turn.othersWaiting", { count: turn.othersWaiting })}`}
                    </p>
                    <a
                        href={formatRoute({ page: "cases", agentId, filter: "all", query: "" })}
                        className={cn(LINK, "inline-flex min-h-11 w-fit items-center text-[15px]")}
                    >
                        {t("turn.seeOpen")} →
                    </a>
                </div>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {turn.lines.map((line) => (
                        <li key={line.key} className="flex flex-col gap-0.5 text-[16px] leading-snug text-ink">
                            <span>{t(`turn.lines.${line.key}`, { count: line.count })}</span>
                            <a href={hrefFor(line, agentId)} className={cn(LINK, "inline-flex min-h-8 w-fit items-center text-[15px]")}>
                                {t(`turn.actions.${line.key}`)} →
                            </a>
                        </li>
                    ))}
                </ul>
            )}
            {turn.hearingMayBeBusy && (
                <p role="note" className="m-0 border-l-2 border-review pl-3 text-[14px] text-text">
                    {t("turn.hearingBusy")}
                </p>
            )}
        </section>
    );
}
