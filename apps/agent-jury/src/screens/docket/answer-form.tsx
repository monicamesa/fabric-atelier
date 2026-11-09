import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { TextAreaField, TextField } from "@/components/docket/field";
import { Objection } from "@/components/docket/objection";
import { createTestimony } from "@/data/cases.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { EMPTY_ANSWER, trimDraft, validateAnswer, type AnswerDraft, type AnswerErrors } from "./answer-draft";

const DETAILS = [
    { key: "criterion", max: 300 },
    { key: "timeWindow", max: 300 },
    { key: "population", max: 300 },
    { key: "source", max: 300 },
] as const;

/** Answer, its definition, and the four optional definition details that feed the diff table (D3). */
export function AnswerFields({ draft, onChange, errors }: { draft: AnswerDraft; onChange: (draft: AnswerDraft) => void; errors: AnswerErrors }) {
    const { t } = useTranslation();
    const set = (key: keyof AnswerDraft) => (event: { target: { value: string } }) => onChange({ ...draft, [key]: event.target.value });
    return (
        <>
            <TextField
                label={t("answerForm.answer")}
                hint={t("answerForm.answerHint")}
                value={draft.answer}
                onChange={set("answer")}
                maxLength={2000}
                required
                error={errors.answer && t(errors.answer)}
            />
            <TextAreaField
                label={t("answerForm.definition")}
                hint={t("answerForm.definitionHint")}
                value={draft.definition}
                onChange={set("definition")}
                maxLength={1000}
                rows={2}
                required
                error={errors.definition && t(errors.definition)}
            />
            <details className="border border-rule px-3 py-2">
                <summary className="min-h-9 cursor-pointer py-1.5 text-[14px] font-semibold text-ink">{t("answerForm.details")}</summary>
                <p className="mb-3 mt-1 text-[14px] text-text-muted">{t("answerForm.detailsHelp")}</p>
                <div className="grid gap-3 min-[700px]:grid-cols-2">
                    {DETAILS.map(({ key, max }) => (
                        <TextField
                            key={key}
                            label={t(`diff.rows.${key}`)}
                            hint={t(`answerForm.hints.${key}`)}
                            value={draft[key]}
                            onChange={set(key)}
                            maxLength={max}
                        />
                    ))}
                </div>
            </details>
        </>
    );
}

interface AnswerFormProps {
    client: AppRayfinClient;
    caseId: string;
    title: string;
    onSaved: () => void;
    onCancel: () => void;
}

/** Adds a testimony to an existing case. */
export function AnswerForm({ client, caseId, title, onSaved, onCancel }: AnswerFormProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<AnswerDraft>(EMPTY_ANSWER);
    const [errors, setErrors] = useState<AnswerErrors>({});
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<unknown>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        const found = validateAnswer(draft);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        setBusy(true);
        setFailure(undefined);
        try {
            await createTestimony(client, { caseId, ...trimDraft(draft) });
            onSaved();
        } catch (error) {
            setFailure(error);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 border border-ink bg-paper-raised p-5">
            <h3 className="m-0 font-serif text-[24px] font-bold text-ink">{title}</h3>
            <AnswerFields draft={draft} onChange={setDraft} errors={errors} />
            {failure !== undefined && <Objection compact message={t("errors.save")} technicalDetails={String(failure)} />}
            <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" compact disabled={busy}>
                    {busy ? t("answerForm.saving") : t("answerForm.submit")}
                </Button>
                <Button variant="quiet" onClick={onCancel} disabled={busy}>
                    {t("common.cancel")}
                </Button>
            </div>
        </form>
    );
}
