import { useId, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { TextAreaField, TextField } from "@/components/docket/field";
import { Objection } from "@/components/docket/objection";
import { Segmented } from "@/components/docket/segmented";
import { createCase, createTestimony } from "@/data/cases.service";
import { canonicalCategory } from "@/data/docket";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { AnswerFields } from "./answer-form";
import { EMPTY_ANSWER, trimDraft, validateAnswer, type AnswerDraft, type AnswerErrors } from "./answer-draft";

interface ProposeCaseFormProps {
    client: AppRayfinClient;
    agentId: string;
    agentName: string;
    categories: string[];
    onSaved: (caseId: string) => void;
    onCancel: () => void;
    /** Shown as "change" in the header when there is more than one agent to pick from. */
    onChangeAgent?: () => void;
}

type CaseErrors = Partial<Record<"text" | "category", string>> & AnswerErrors;

/**
 * A case is saved with its first answer. If the case saves and the answer doesn't, the form keeps
 * what was typed and the retry only adds the answer, so no second case is created.
 */
export function ProposeCaseForm({ client, agentId, agentName, categories, onSaved, onCancel, onChangeAgent }: ProposeCaseFormProps) {
    const { t, i18n } = useTranslation();
    const uiLanguage: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";
    // Defaults to the screen language; the juror can say the question is in the other one.
    const [chosenLanguage, setChosenLanguage] = useState<AppLanguage>();
    const language = chosenLanguage ?? uiLanguage;
    const listId = useId();
    const [text, setText] = useState("");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState("");
    const [answer, setAnswer] = useState<AnswerDraft>(EMPTY_ANSWER);
    const [errors, setErrors] = useState<CaseErrors>({});
    const [busy, setBusy] = useState(false);
    const [savedCaseId, setSavedCaseId] = useState<string>();
    const [failure, setFailure] = useState<unknown>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        const found: CaseErrors = { ...validateAnswer(answer) };
        if (!text.trim()) found.text = "proposeCase.questionRequired";
        if (!category.trim()) found.category = "proposeCase.categoryRequired";
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        setBusy(true);
        setFailure(undefined);
        let caseId = savedCaseId;
        try {
            if (!caseId) {
                const created = await createCase(client, {
                    agentId,
                    text: text.trim(),
                    category: canonicalCategory(category, categories),
                    tags: tags.trim() || undefined,
                    language,
                });
                caseId = created.id;
                setSavedCaseId(caseId);
            }
            await createTestimony(client, { caseId, ...trimDraft(answer) });
            onSaved(caseId);
        } catch (error) {
            setFailure(error);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 border border-ink bg-paper-raised p-5">
            <div className="flex flex-col gap-1">
                <h2 className="m-0 font-serif text-[28px] font-bold text-ink">
                    <Trans i18nKey="proposeCase.title" values={{ agent: agentName }} components={{ agent: <strong className="font-black" /> }} />
                    {onChangeAgent && !savedCaseId && (
                        <>
                            {" · "}
                            <button type="button" onClick={onChangeAgent} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[16px] font-bold text-action-text underline underline-offset-2 hover:text-ink">
                                {t("proposeCase.change")}
                            </button>
                        </>
                    )}
                </h2>
                <p className="m-0 text-[15px] text-text">{t("proposeCase.help")}</p>
            </div>
            <TextAreaField
                label={t("proposeCase.question")}
                hint={t("proposeCase.questionHint")}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={1000}
                rows={2}
                required
                disabled={Boolean(savedCaseId)}
                error={errors.text && t(errors.text)}
            />
            <div className="flex flex-col gap-1.5">
                <span id={`${listId}-language`} className="text-[14px] font-semibold text-ink">
                    {t("proposeCase.language")}
                </span>
                <div className={savedCaseId ? "pointer-events-none w-fit opacity-60" : "w-fit"}>
                    <Segmented<AppLanguage>
                        label={t("proposeCase.language")}
                        value={language}
                        onChange={setChosenLanguage}
                        options={[
                            { value: "en", label: t("language.en"), ariaLabel: t("language.enName"), lang: "en" },
                            { value: "es", label: t("language.es"), ariaLabel: t("language.esName"), lang: "es" },
                        ]}
                    />
                </div>
                <span className="text-[14px] text-text-muted">{t("proposeCase.languageHint")}</span>
            </div>
            <div className="grid gap-4 min-[700px]:grid-cols-2">
                <TextField
                    label={t("proposeCase.category")}
                    hint={t("proposeCase.categoryHint")}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    maxLength={100}
                    list={listId}
                    required
                    disabled={Boolean(savedCaseId)}
                    error={errors.category && t(errors.category)}
                />
                <TextField
                    label={t("proposeCase.tags")}
                    hint={t("proposeCase.tagsHint")}
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    maxLength={500}
                    disabled={Boolean(savedCaseId)}
                />
                <datalist id={listId}>
                    {categories.map((item) => (
                        <option key={item} value={item} />
                    ))}
                </datalist>
            </div>
            <h3 className="m-0 border-t border-rule pt-4 font-serif text-[20px] font-bold text-ink">{t("proposeCase.firstAnswer")}</h3>
            <AnswerFields draft={answer} onChange={setAnswer} errors={errors} />
            {failure !== undefined && (
                <Objection
                    compact
                    message={savedCaseId ? t("proposeCase.answerFailed") : t("errors.save")}
                    technicalDetails={String(failure)}
                />
            )}
            <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" compact disabled={busy}>
                    {busy ? t("proposeCase.saving") : savedCaseId ? t("proposeCase.retryAnswer") : t("proposeCase.submit")}
                </Button>
                <Button variant="quiet" onClick={savedCaseId ? () => onSaved(savedCaseId) : onCancel} disabled={busy}>
                    {savedCaseId ? t("proposeCase.openCase") : t("common.cancel")}
                </Button>
            </div>
        </form>
    );
}
