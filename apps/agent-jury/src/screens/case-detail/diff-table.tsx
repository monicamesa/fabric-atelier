import { useTranslation } from "react-i18next";
import type { TestimonyRow } from "@/data/cases.service";
import { cn } from "@/lib/utils";
import { canDiff, differingRows, DIFF_ROWS } from "../docket/docket-views";

interface DiffTableProps {
    left: { letter: string; testimony: TestimonyRow };
    right: { letter: string; testimony: TestimonyRow };
}

/** "Where the definitions part ways": rows that differ are highlighted and say so in words. */
export function DiffTable({ left, right }: DiffTableProps) {
    const { t } = useTranslation();
    if (!canDiff(left.testimony, right.testimony)) {
        return (
            <div className="flex flex-col gap-3">
                <div className="grid gap-px border border-ink bg-rule min-[700px]:grid-cols-2">
                    {[left, right].map(({ letter, testimony }) => (
                        <div key={testimony.id} className="flex flex-col gap-1 bg-paper-raised p-4">
                            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink">{t("answer.label", { letter })}</span>
                            <span className="text-[15px] text-text">{testimony.definition}</span>
                        </div>
                    ))}
                </div>
                <p className="m-0 text-[14px] text-text-muted">{t("diff.addDetails")}</p>
            </div>
        );
    }
    const differs = new Set(differingRows(left.testimony, right.testimony));
    return (
        <table className="w-full border-collapse border border-ink bg-paper-raised text-left text-[15px]">
            <caption className="sr-only">{t("diff.caption", { left: left.letter, right: right.letter })}</caption>
            <thead>
                <tr className="border-b border-ink">
                    <th scope="col" className="px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
                        {t("diff.rule")}
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
                        {t("answer.label", { letter: left.letter })}
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
                        {t("answer.label", { letter: right.letter })}
                    </th>
                </tr>
            </thead>
            <tbody>
                {DIFF_ROWS.map((key) => {
                    const differ = differs.has(key);
                    const cell = (value?: string | null) => (
                        <td className={cn("px-3.5 py-2.5 text-text", key === "source" && "font-mono text-[14px]")}>{value?.trim() || "—"}</td>
                    );
                    return (
                        <tr key={key} className={cn("border-b border-rule last:border-b-0", differ && "bg-dispute-bg")}>
                            <th scope="row" className="px-3.5 py-2.5 font-semibold text-ink">
                                {t(`diff.rows.${key}`)}
                                {differ && <span className="sr-only"> ({t("diff.differs")})</span>}
                            </th>
                            {cell(left.testimony[key])}
                            {cell(right.testimony[key])}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
