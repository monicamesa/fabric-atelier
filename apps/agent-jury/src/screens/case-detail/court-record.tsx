import { useTranslation } from "react-i18next";
import type { JurorRow } from "@/data/directory.service";
import { isAppLanguage } from "@/i18n/language-preference";
import { formatRelativeDay } from "@/lib/format";
import type { CaseEvent } from "@/rules/case-validity";
import { personName } from "../docket/viewer";

interface CourtRecordProps {
    events: CaseEvent[];
    letters: Map<string, string>;
    jurors: readonly JurorRow[];
    now: Date;
}

/** Read-only timeline, newest first. "Ruled" and "disputed" lines are replayed from the records, never stored (R6). */
export function CourtRecord({ events, letters, jurors, now }: CourtRecordProps) {
    const { t, i18n } = useTranslation();
    const language = isAppLanguage(i18n.language) ? i18n.language : "en";
    const ordered = [...events].reverse();

    function sentence(event: CaseEvent) {
        if (event.kind === "state") {
            return (
                <>
                    {t("record.stateBefore")}
                    <b className={event.state === "disputed" ? "text-action-text" : event.state === "ruled" ? "text-ruled" : "text-ink"}>
                        {t(`caseState.${event.state}`)}
                    </b>
                </>
            );
        }
        const who = personName(event.actorEmail, jurors);
        if (event.kind === "proposed") return t("record.proposed", { who });
        if (event.kind === "review") {
            const main = !event.appeal
                ? t("record.reviewAgree", { who })
                : t(event.reopens ? "record.reviewReopens" : "record.reviewAppeal", { who, verdict: t(`hearings.review.human.${event.humanVerdict}`) });
            return (
                <>
                    {main}
                    {event.reason && event.appeal && <span className="text-text-muted"> · {t(`hearings.review.reason.${event.reason}`)}</span>}
                    {event.comment?.trim() && <span className="text-text-muted">: “{event.comment.trim()}”</span>}
                    {event.futureDated && <span className="text-text-muted"> · {t("record.futureDated")}</span>}
                </>
            );
        }
        const notes: string[] = [];
        if (event.kind !== "vote" && !event.counts) notes.push(t("record.notCounted"));
        if (event.kind === "vote" && event.beforeReview) notes.push(t("record.beforeReview"));
        if (event.kind === "vote" && event.value === "against" && !event.comment?.trim()) notes.push(t("record.noReason"));
        if (event.futureDated) notes.push(t("record.futureDated"));
        const letter = "testimonyId" in event ? (letters.get(event.testimonyId) ?? "?") : "";
        const main =
            event.kind === "answer"
                ? t("record.answer", { who, letter })
                : event.kind === "dismissal"
                  ? t("record.dismissed", { who })
                  : t(event.value === "for" ? "record.voteFor" : "record.voteAgainst", { who, letter });
        return (
            <>
                {main}
                {event.kind === "vote" && event.comment?.trim() && <span className="text-text-muted">: “{event.comment.trim()}”</span>}
                {notes.length > 0 && <span className="text-text-muted"> · {notes.join(" · ")}</span>}
            </>
        );
    }

    return (
        <section aria-labelledby="court-record-title" className="flex flex-col">
            <h2 id="court-record-title" className="m-0 border-b border-ink pb-2.5 font-serif text-[26px] font-bold text-ink">
                {t("record.title")}
            </h2>
            <ol className="m-0 list-none p-0">
                {ordered.map((event, index) => (
                    <li key={`${event.kind}-${event.at}-${index}`} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5">
                        <time dateTime={event.at} className="font-mono text-[13px] text-text-muted">
                            {formatRelativeDay(event.at, language, now)}
                        </time>
                        <span className="text-[15px] text-ink">{sentence(event)}</span>
                    </li>
                ))}
            </ol>
            <p className="mb-0 mt-3 text-[13px] text-text-muted">{t("record.footnote")}</p>
        </section>
    );
}
