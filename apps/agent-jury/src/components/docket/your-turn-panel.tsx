import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { formatRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import type { TurnLine, YourTurn } from "@/screens/docket/your-turn";

interface YourTurnPanelProps {
    agentId: string;
    agentName: string;
    turn: YourTurn;
    onPropose: () => void;
    className?: string;
}

function hrefFor(line: TurnLine, agentId: string): string {
    if (line.key === "review" && line.hearingId) return formatRoute({ page: "hearing", hearingId: line.hearingId });
    if (line.key === "hearing") return formatRoute({ page: "hearings", agentId });
    return formatRoute({ page: "case", caseId: line.caseId ?? "" });
}

/** "Your turn": the few things that need this person now, each one plain sentence and one action. */
export function YourTurnPanel({ agentId, agentName, turn, onPropose, className }: YourTurnPanelProps) {
    const { t } = useTranslation();
    if (turn.lines.length === 0 && !turn.upToDate) return null;
    return (
        <section aria-labelledby="your-turn-title" className={cn("flex flex-col gap-3 border-2 border-ink bg-paper-raised p-5", className)}>
            <div className="flex flex-col gap-1">
                <h2 id="your-turn-title" className="m-0 font-serif text-[30px] font-bold leading-none text-ink">
                    {t("turn.title")}
                </h2>
                <p className="m-0 text-[15px] text-text">{t("turn.help", { agent: agentName })}</p>
            </div>
            {turn.upToDate ? (
                <div className="flex flex-wrap items-center gap-4">
                    <p className="m-0 font-serif text-[20px] text-ink">{t("turn.upToDate")}</p>
                    <Button variant="primary" onClick={onPropose}>
                        {t("turn.propose")}
                    </Button>
                </div>
            ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                    {turn.lines.map((line) => (
                        <li key={line.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-3 first:border-t-0 first:pt-0">
                            <span className="font-serif text-[20px] leading-snug text-ink">{t(`turn.lines.${line.key}`, { count: line.count })}</span>
                            <a
                                href={hrefFor(line, agentId)}
                                className="inline-flex min-h-11 items-center border-2 border-ink px-4 text-[15px] font-bold text-ink no-underline hover:bg-paper-hover"
                            >
                                {t(`turn.actions.${line.key}`)}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
            {turn.hearingMayBeBusy && (
                <p role="note" className="m-0 border-l-4 border-review pl-3 text-[14px] text-text">
                    {t("turn.hearingBusy")}
                </p>
            )}
        </section>
    );
}
