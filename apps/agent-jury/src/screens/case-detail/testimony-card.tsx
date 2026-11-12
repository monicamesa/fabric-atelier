import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { TextAreaField } from "@/components/docket/field";
import { UnverifiedChip } from "@/components/docket/status-chip";
import { VoteBar } from "@/components/docket/vote-bar";
import type { TestimonyRow } from "@/data/cases.service";
import type { TestimonyTally, VoteValue } from "@/rules/case-validity";
import { cn } from "@/lib/utils";

interface TestimonyCardProps {
    letter: string;
    testimony: TestimonyRow;
    tally: TestimonyTally;
    author: string;
    team?: string;
    minVotes: number;
    isRuling: boolean;
    /** My standing vote on this answer, if any. */
    myVote?: VoteValue;
    /** Whether the voting buttons are shown at all (active juror, open case, not my answer). */
    canVote: boolean;
    isOwn: boolean;
    busy: boolean;
    onVote: (value: VoteValue, comment?: string) => Promise<boolean>;
}

/** "ANSWER A · NAME, TEAM", the answer, its definition, the vote bar and the vote actions. */
export function TestimonyCard({ letter, testimony, tally, author, team, minVotes, isRuling, myVote, canVote, isOwn, busy, onVote }: TestimonyCardProps) {
    const { t } = useTranslation();
    const [against, setAgainst] = useState(false);
    const [comment, setComment] = useState("");
    const [commentError, setCommentError] = useState<string>();
    const short = testimony.answer.length <= 24;
    // Ruling needs a valid approver vote in favour (R3); say so until one is in, unless an approver already voted against.
    const needsApprover = !isRuling && tally.valid && tally.approverFor === 0 && tally.approverAgainst === 0;

    async function submitAgainst(event: FormEvent) {
        event.preventDefault();
        // D4: an "against" vote needs a reason; the rules ignore one without it.
        if (!comment.trim()) {
            setCommentError(t("vote.commentRequired"));
            return;
        }
        if (await onVote("against", comment.trim())) {
            setAgainst(false);
            setComment("");
            setCommentError(undefined);
        }
    }

    return (
        <article
            aria-labelledby={`answer-${testimony.id}`}
            className={cn("flex flex-col gap-3 border bg-paper-raised p-5", isRuling ? "border-2 border-ruled" : "border-ink")}
        >
            <header className="flex flex-wrap items-start justify-between gap-2">
                <h3 id={`answer-${testimony.id}`} className="m-0 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                    {t("answer.label", { letter })} · {team ? t("answer.byTeam", { name: author, team }) : author}
                </h3>
                <span className="font-mono text-[14px] text-text">{t("answer.votes", { count: tally.votesFor })}</span>
            </header>
            <div className="flex flex-wrap items-center gap-2">
                {isRuling && (
                    <Chip tone="ruled" filled>
                        {t("answer.ruling")}
                    </Chip>
                )}
                {!tally.valid && <UnverifiedChip />}
            </div>
            <p className={cn("m-0 break-words font-serif font-black leading-tight text-ink", short ? "text-[44px]" : "text-[22px]")}>
                {testimony.answer}
            </p>
            <p className="m-0 text-[16px] text-text">{testimony.definition}</p>
            <VoteBar value={tally.votesFor} max={minVotes} />
            <p className="m-0 text-[14px] text-text-muted">
                {t("answer.progress", { votes: tally.votesFor, count: minVotes })}
                {needsApprover && ` · ${t("answer.approverNeeded")}`}
                {tally.votesAgainst > 0 && ` · ${t("answer.against", { count: tally.votesAgainst })}`}
            </p>
            {isOwn && <p className="m-0 text-[14px] text-text-muted">{t("vote.ownAnswer")}</p>}
            {myVote && <p className="m-0 text-[14px] font-semibold text-ink">{t(myVote === "for" ? "vote.youVotedFor" : "vote.youVotedAgainst")}</p>}
            {canVote && !against && (
                <div className="flex flex-wrap items-center gap-3">
                    {myVote !== "for" && (
                        <Button variant="secondary" disabled={busy} onClick={() => void onVote("for")}>
                            {t(myVote ? "vote.changeToFor" : "vote.for", { letter })}
                        </Button>
                    )}
                    {myVote !== "against" && (
                        <Button variant="danger-text" disabled={busy} onClick={() => setAgainst(true)}>
                            {t(myVote ? "vote.changeToAgainst" : "vote.against", { letter })}
                        </Button>
                    )}
                </div>
            )}
            {canVote && against && (
                <form onSubmit={(event) => void submitAgainst(event)} noValidate className="flex flex-col gap-3">
                    <TextAreaField
                        label={t("vote.comment")}
                        hint={t("vote.commentHint")}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        maxLength={1000}
                        rows={2}
                        required
                        error={commentError}
                    />
                    <div className="flex flex-wrap gap-3">
                        <Button type="submit" variant="secondary" disabled={busy}>
                            {t("vote.submitAgainst", { letter })}
                        </Button>
                        <Button variant="quiet" disabled={busy} onClick={() => setAgainst(false)}>
                            {t("common.cancel")}
                        </Button>
                    </div>
                </form>
            )}
        </article>
    );
}
