import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Progress, Stage } from "@/screens/docket/your-turn";

/**
 * "The game": one index line under the hero's double rule. A small-caps label, then the count at each stage (number in
 * Fraunces, label in Inter, thin vertical rules between), the bottleneck in coral, and on the right what is needed now.
 */
export function ProgressStrip({ progress, agentName, className }: { progress: Progress; agentName: string; className?: string }) {
    const { t } = useTranslation();
    const stuck = progress.stages.find((item) => item.stage === progress.bottleneck);
    const nowKey = (stage: Stage) => (stage === "review" ? "review" : stage === "hearing" ? "hearing" : "vote");
    return (
        <section aria-label={t("progress.label", { agent: agentName })} className={cn("flex flex-col gap-x-6 gap-y-3 border-b border-rule py-4 min-[900px]:flex-row min-[900px]:items-center", className)}>
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink">{t("progress.title")}</span>
            <ol className="m-0 grid min-w-0 list-none grid-cols-3 gap-x-4 gap-y-3 p-0 min-[700px]:flex min-[700px]:flex-wrap min-[700px]:gap-y-2">
                {progress.stages.map((item) => {
                    const isStuck = item.stage === progress.bottleneck;
                    return (
                        <li
                            key={item.stage}
                            aria-current={isStuck ? "step" : undefined}
                            className={cn(
                                "flex min-w-0 items-baseline gap-2 min-[700px]:border-l min-[700px]:border-rule min-[700px]:pl-4 min-[700px]:first:border-l-0 min-[700px]:first:pl-0",
                                isStuck ? "text-action-text" : "text-ink",
                            )}
                        >
                            <span className="font-serif text-[26px] font-black leading-none">{item.count}</span>
                            <span className={cn("text-[15px] leading-tight", isStuck ? "font-semibold" : "text-text")}>{t(`progress.stages.${item.stage}`, { count: item.count })}</span>
                        </li>
                    );
                })}
            </ol>
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold text-action-text min-[900px]:ml-auto">
                {stuck ? (
                    <>
                        <span>{t(`progress.now.${nowKey(stuck.stage)}`)}</span>
                        <span className="border border-action px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.1em]">
                            {t(`progress.nowCount.${nowKey(stuck.stage)}`, { count: stuck.waiting })}
                        </span>
                    </>
                ) : (
                    <span className="text-text-muted">{t("progress.allClear")}</span>
                )}
            </p>
        </section>
    );
}
