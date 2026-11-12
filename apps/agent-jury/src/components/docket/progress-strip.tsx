import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Progress } from "@/screens/docket/your-turn";

/** Propose · Vote · Ruled · Hearing · Review, with the count at each stage and the current bottleneck highlighted. */
export function ProgressStrip({ progress, agentName, className }: { progress: Progress; agentName: string; className?: string }) {
    const { t } = useTranslation();
    const stuck = progress.stages.find((item) => item.stage === progress.bottleneck);
    return (
        <section aria-label={t("progress.label", { agent: agentName })} className={cn("flex flex-col gap-2", className)}>
            <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0 min-[700px]:gap-2.5">
                {progress.stages.map((item, index) => {
                    const isStuck = item.stage === progress.bottleneck;
                    return (
                        <li
                            key={item.stage}
                            aria-current={isStuck ? "step" : undefined}
                            className={cn(
                                "flex min-w-0 flex-col gap-0.5 border px-2 py-2 min-[700px]:px-3.5 min-[700px]:py-3",
                                isStuck ? "border-2 border-action bg-dispute-bg" : "border-rule bg-paper-raised",
                            )}
                        >
                            <span className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-ink min-[700px]:text-[12px]">
                                {index + 1} · {t(`progress.stages.${item.stage}`)}
                            </span>
                            <span className="font-serif text-[26px] font-black leading-none text-ink min-[700px]:text-[34px]">{item.count}</span>
                            <span className="truncate text-[12px] text-text-muted min-[700px]:text-[13px]">
                                {item.stage === "review" && item.total !== undefined
                                    ? t("progress.reviewOf", { count: item.count, total: item.total })
                                    : t(`progress.captions.${item.stage}`)}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className="m-0 text-[15px] font-semibold text-ink">
                {stuck ? t(`progress.bottleneck.${stuck.stage}`, { count: stuck.waiting }) : t("progress.allClear")}
            </p>
        </section>
    );
}
