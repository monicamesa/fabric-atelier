import { useTranslation } from "react-i18next";
import { Chip } from "@/components/docket/chip";
import { Objection } from "@/components/docket/objection";
import { EmptyState, LoadingLine, Skeleton } from "@/components/docket/states";
import { describeClerkError } from "@/data/clerk-errors";
import { isFeedbackPage, readFeedback } from "@/data/feedback.service";
import { useAsync } from "@/hooks/use-async";
import { isAppLanguage } from "@/i18n/language-preference";
import { formatDateTime } from "@/lib/format";
import type { AppRayfinClient } from "@/lib/rayfin-client";

export const FEEDBACK_LIST_SIZE = 200;

/**
 * What jurors sent through "Give feedback", newest first. Read through the admin Function (the table is not readable by
 * other users), and only when this tab is opened, so the Clerk's office does not make an extra admin request on every visit.
 */
export function FeedbackPanel({ client }: { client: AppRayfinClient }) {
    const { t, i18n } = useTranslation();
    const language = isAppLanguage(i18n.language) ? i18n.language : "en";
    const feedback = useAsync(() => readFeedback(client, FEEDBACK_LIST_SIZE));

    return (
        <section aria-labelledby="clerk-feedback-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 id="clerk-feedback-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                    {t("clerk.feedback.title")}
                </h2>
                <p className="m-0 text-[15px] text-text-muted">{t("clerk.feedback.help")}</p>
            </div>
            {feedback.status === "error" && !feedback.data ? (
                <Objection compact message={t("clerk.feedback.loadError")} technicalDetails={describeClerkError(feedback.error).technicalDetails} onRetry={feedback.reload} />
            ) : !feedback.data ? (
                <div className="flex flex-col gap-2">
                    <LoadingLine>{t("clerk.loading")}</LoadingLine>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : feedback.data.length === 0 ? (
                <EmptyState message={t("clerk.feedback.empty")} />
            ) : (
                <ol className="m-0 flex list-none flex-col p-0">
                    {feedback.data.map((entry) => (
                        <li key={entry.id} className="flex flex-col gap-2 border-b border-rule py-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-text-muted">
                                <time dateTime={entry.createdAt} className="font-mono">
                                    {formatDateTime(entry.createdAt, language)}
                                </time>
                                <Chip tone="muted">{t(`feedback.types.${entry.type}`)}</Chip>
                                {isFeedbackPage(entry.page) && <span>{t("clerk.feedback.about", { page: t(`feedback.pages.${entry.page}`) })}</span>}
                                {entry.canContact && <Chip tone="ruled">{t("clerk.feedback.canContact")}</Chip>}
                            </div>
                            <p className="m-0 max-w-[820px] whitespace-pre-wrap break-words text-[16px] leading-normal text-ink">{entry.message}</p>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
