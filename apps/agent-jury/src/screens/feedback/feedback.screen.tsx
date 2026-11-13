import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { TextAreaField, SelectField } from "@/components/docket/field";
import { Objection } from "@/components/docket/objection";
import { PageHeader } from "@/components/docket/page-header";
import { createFeedback, FEEDBACK_MAX_LENGTH, FEEDBACK_PAGES, FEEDBACK_TYPES, isFeedbackPage, type FeedbackType } from "@/data/feedback.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { Viewer } from "../docket/viewer";

interface FeedbackScreenProps {
    client: Pick<AppRayfinClient, "data" | "auth">;
    viewer: Viewer;
    /** The page the juror came from; it prefills "which page is it about". */
    from?: string;
    onBack: () => void;
}

const NO_PAGE = "";

/** A short form that tells the admins what to improve. Insert-only; nothing identifies the sender except the subject claim. */
export function FeedbackScreen({ client, viewer, from, onBack }: FeedbackScreenProps) {
    const { t } = useTranslation();
    const [type, setType] = useState<FeedbackType>("idea");
    const [message, setMessage] = useState("");
    const [page, setPage] = useState(isFeedbackPage(from) ? from : NO_PAGE);
    const [canContact, setCanContact] = useState(false);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<unknown>();
    const [sent, setSent] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!message.trim()) {
            setError("feedback.messageRequired");
            return;
        }
        setError(undefined);
        setBusy(true);
        setFailure(undefined);
        try {
            await createFeedback(client, { type, message, page, canContact });
            setSent(true);
        } catch (caught) {
            setFailure(caught);
        } finally {
            setBusy(false);
        }
    }

    const back = (
        <div className="flex items-start min-[900px]:justify-end">
            <Button variant="secondary" onClick={onBack}>
                ← {t("feedback.back")}
            </Button>
        </div>
    );

    return (
        <div className="flex flex-col gap-8">
            <PageHeader kicker={t("feedback.kicker")} title={t("feedback.title")} help={t("feedback.help")} aside={back} />
            {sent ? (
                <div role="status" className="flex max-w-[680px] flex-col gap-4 border-l-4 border-ruled pl-4">
                    <p className="m-0 font-serif text-[26px] leading-tight text-ink">{t("feedback.thanks")}</p>
                    <p className="m-0 text-[16px] text-text">{t("feedback.thanksHelp")}</p>
                    <Button variant="primary" compact className="self-start" onClick={onBack}>
                        {t("feedback.back")}
                    </Button>
                </div>
            ) : !viewer.canAct ? (
                <p role="note" className="m-0 max-w-[680px] border-l-4 border-review pl-3 text-[15px] text-text">
                    {t("feedback.jurorsOnly")}
                </p>
            ) : (
                <form onSubmit={(submitEvent) => void submit(submitEvent)} noValidate className="flex max-w-[680px] flex-col gap-5">
                    <SelectField label={t("feedback.type")} value={type} onChange={(value) => setType(value as FeedbackType)}>
                        {FEEDBACK_TYPES.map((item) => (
                            <option key={item} value={item}>
                                {t(`feedback.types.${item}`)}
                            </option>
                        ))}
                    </SelectField>
                    <TextAreaField
                        label={t("feedback.message")}
                        hint={t("feedback.messageHint")}
                        value={message}
                        onChange={(changeEvent) => setMessage(changeEvent.target.value)}
                        maxLength={FEEDBACK_MAX_LENGTH}
                        rows={6}
                        required
                        error={error && t(error)}
                    />
                    <SelectField label={t("feedback.page")} value={page} onChange={setPage}>
                        <option value={NO_PAGE}>{t("feedback.pages.none")}</option>
                        {FEEDBACK_PAGES.map((item) => (
                            <option key={item} value={item}>
                                {t(`feedback.pages.${item}`)}
                            </option>
                        ))}
                    </SelectField>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
                        <input type="checkbox" checked={canContact} onChange={(changeEvent) => setCanContact(changeEvent.target.checked)} className="size-5 shrink-0 accent-[var(--ink)]" />
                        {t("feedback.canContact")}
                    </label>
                    {failure !== undefined && <Objection compact message={t("feedback.failed")} technicalDetails={String(failure)} />}
                    <div className="flex flex-wrap gap-3">
                        <Button type="submit" variant="primary" compact disabled={busy}>
                            {busy ? t("feedback.sending") : t("feedback.submit")}
                        </Button>
                        <Button variant="quiet" onClick={onBack} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
