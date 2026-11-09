import { useTranslation } from "react-i18next";
import type { CaseState } from "@/rules/case-validity";
import { cn } from "@/lib/utils";
import { caseNumber } from "@/screens/docket/docket-views";
import { Chip, type ChipTone } from "./chip";

const TONE: Record<CaseState, { tone: ChipTone; filled: boolean }> = {
    under_review: { tone: "review", filled: false },
    disputed: { tone: "action", filled: false },
    ruled: { tone: "ruled", filled: true },
    dismissed: { tone: "muted", filled: false },
};

/** Open states are outlined, ruled is filled, dismissed is dashed; the label always says the state. */
export function StatusChip({ state }: { state: CaseState }) {
    const { t } = useTranslation();
    return (
        <Chip tone={TONE[state].tone} filled={TONE[state].filled}>
            {t(`caseState.${state}`)}
        </Chip>
    );
}

/** R7: a case or answer by someone who is not an active juror. */
export function UnverifiedChip() {
    const { t } = useTranslation();
    return (
        <span title={t("caseValidity.unverifiedHelp")}>
            <Chip tone="muted">{t("caseValidity.unverified")}</Chip>
        </span>
    );
}

export function CaseNumber({ id, className }: { id: string; className?: string }) {
    return <span className={cn("font-mono text-[14px] text-text-muted", className)}>{caseNumber(id)}</span>;
}
