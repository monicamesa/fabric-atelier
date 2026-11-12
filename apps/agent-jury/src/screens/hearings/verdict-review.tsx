import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { RadioField, SelectField, TextAreaField } from "@/components/docket/field";
import type { VerdictRow } from "@/data/hearings.service";
import type { JurorRow } from "@/data/directory.service";
import { isAppeal, validReviews, type HumanVerdict, type ReviewReason, type ReviewRecord } from "@/rules/case-validity";
import type { Viewer } from "../docket/viewer";
import { appealChoices, REVIEW_REASONS, type AppealInput } from "./review-choices";

interface VerdictReviewProps {
    verdict: VerdictRow;
    /** Every review of the hearing; this panel keeps the ones about its verdict. */
    reviews: readonly ReviewRecord[];
    jurors: readonly JurorRow[];
    viewer: Viewer;
    appealing: boolean;
    saving: boolean;
    failed: boolean;
    onAppealingChange: (open: boolean) => void;
    onAgree: () => void;
    onAppeal: (input: AppealInput) => void;
}

/** "Yes, agree" / "No, appeal" under a verdict (design guide: live hearing), with the jury's answers so far. */
export function VerdictReviewPanel({ verdict, reviews, jurors, viewer, appealing, saving, failed, onAppealingChange, onAgree, onAppeal }: VerdictReviewProps) {
    const { t } = useTranslation();
    const [humanVerdict, setHumanVerdict] = useState<HumanVerdict | undefined>();
    const [reason, setReason] = useState<ReviewReason>("judge_too_strict");
    const [comment, setComment] = useState("");
    const [commentError, setCommentError] = useState<string>();

    const link = { id: verdict.id, hearing_id: verdict.hearing_id, case_id: verdict.case_id, judgeVerdict: verdict.judgeVerdict };
    const standing = validReviews({ verdicts: [link], hearingCases: [], reviews: reviews.filter((review) => review.verdict_id === verdict.id) }, jurors, new Date()).map((item) => item.review);
    const agreed = standing.filter((review) => !isAppeal(review, link)).length;
    const appeals = standing.length - agreed;
    const mine = standing.find((review) => review.reviewerUserId === viewer.me?.userId);
    const choices = appealChoices(verdict.judgeVerdict);
    const chosen = humanVerdict && choices.includes(humanVerdict) ? humanVerdict : choices[0];
    const isApprover = viewer.juror?.role === "approver";

    function submit() {
        if (!comment.trim()) {
            setCommentError(t("hearings.review.commentRequired"));
            return;
        }
        setCommentError(undefined);
        onAppeal({ humanVerdict: chosen, reason, comment: comment.trim() });
    }

    const mineText = mine
        ? isAppeal(mine, link)
            ? t("hearings.review.mineAppeal", { verdict: t(`hearings.review.human.${mine.humanVerdict}`) })
            : t("hearings.review.mineAgree")
        : undefined;

    return (
        <div className="flex flex-col gap-3 border-t border-rule pt-4">
            <p className="m-0 text-[14px] text-text-muted" data-testid="review-summary">
                {standing.length === 0 ? t("hearings.review.none") : t("hearings.review.summary", { agree: agreed, appeal: appeals })}
                {mineText && <b className="text-ink"> · {mineText}</b>}
            </p>
            {!viewer.canAct && <p className="m-0 text-[14px] text-text-muted">{t("hearings.review.jurorsOnly")}</p>}
            {viewer.canAct && !appealing && (
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" compact disabled={saving} onClick={onAgree} aria-keyshortcuts="A">
                        {t("hearings.review.agree")} <kbd className="font-mono text-[12px] text-text-muted">A</kbd>
                    </Button>
                    <Button variant="secondary" compact disabled={saving} onClick={() => onAppealingChange(true)} aria-keyshortcuts="X">
                        {t("hearings.review.appeal")} <kbd className="font-mono text-[12px] text-text-muted">X</kbd>
                    </Button>
                </div>
            )}
            {viewer.canAct && appealing && (
                <form
                    className="flex flex-col gap-4 border border-ink bg-paper p-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <h4 className="m-0 font-serif text-[20px] font-bold text-ink">{t("hearings.review.formTitle")}</h4>
                    <RadioField<HumanVerdict>
                        legend={t("hearings.review.humanLegend")}
                        name={`human-${verdict.id}`}
                        value={chosen}
                        onChange={setHumanVerdict}
                        options={choices.map((choice) => ({ value: choice, label: t(`hearings.review.human.${choice}`), description: t(`hearings.review.humanHelp.${choice}`) }))}
                    />
                    <SelectField label={t("hearings.review.reasonLabel")} value={reason} onChange={(value) => setReason(value as ReviewReason)}>
                        {REVIEW_REASONS.map((item) => (
                            <option key={item} value={item}>
                                {t(`hearings.review.reason.${item}`)}
                            </option>
                        ))}
                    </SelectField>
                    {reason === "expected_answer_wrong" && (
                        <p className="m-0 border-l-4 border-review pl-3 text-[14px] text-text">
                            {isApprover ? t("hearings.review.reopensNote") : t("hearings.review.approverOnlyNote")}
                        </p>
                    )}
                    <TextAreaField
                        label={t("hearings.review.commentLabel")}
                        hint={t("hearings.review.commentHint")}
                        value={comment}
                        maxLength={1000}
                        onChange={(event) => setComment(event.target.value)}
                        error={commentError}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" variant="primary" compact disabled={saving}>
                            {saving ? t("hearings.review.saving") : t("hearings.review.send")}
                        </Button>
                        <Button variant="quiet" compact disabled={saving} onClick={() => onAppealingChange(false)}>
                            {t("common.cancel")}
                        </Button>
                    </div>
                </form>
            )}
            {failed && (
                <p role="alert" className="m-0 text-[14px] font-semibold text-action-text">
                    {t("errors.save")}
                </p>
            )}
        </div>
    );
}
