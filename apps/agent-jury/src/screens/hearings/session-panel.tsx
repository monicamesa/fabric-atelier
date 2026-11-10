import { useTranslation } from "react-i18next";
import { Gavel } from "@/components/docket/gavel";
import { Button } from "@/components/docket/button";
import { cn } from "@/lib/utils";
import type { HearingView } from "./hearing-view";

type StepState = "done" | "now" | "next";

function Step({ state, children }: { state: StepState; children: string }) {
    const { t } = useTranslation();
    const mark = state === "done" ? "✓" : state === "now" ? "●" : "○";
    return (
        <li className={cn("flex items-baseline gap-3 text-[16px]", state === "next" ? "opacity-70" : "font-semibold")}>
            <span aria-hidden="true" className="w-4 font-mono">
                {mark}
            </span>
            <span>{children}</span>
            <span className="sr-only">{t(`hearings.session.step.${state}`)}</span>
        </li>
    );
}

/** Long-work state (design guide, section 6): dark panel, step list, progress bar, estimate and "You can leave". */
export function SessionPanel({ view, agentName, onLeave }: { view: HearingView; agentName: string; onLeave: () => void }) {
    const { t } = useTranslation();
    const asking = view.done < view.total;
    const percent = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100);
    const minutes = Math.max(1, Math.ceil(view.remainingSeconds / 60));
    return (
        <section aria-label={t("hearings.session.kicker")} className="flex flex-col gap-4 bg-ticker-bg p-6 text-ticker-text">
            <div className="flex items-center gap-3">
                <Gavel loop className="size-9 shrink-0" />
                <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-ticker-text">{t("hearings.session.kicker")}</span>
            </div>
            <h2 className="m-0 font-serif text-[28px] font-black leading-tight">{t("hearings.session.title", { agent: agentName })}</h2>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
                <Step state="done">{t("hearings.session.collected", { count: view.total })}</Step>
                <Step state={view.started ? "done" : "now"}>{t("hearings.session.started")}</Step>
                <Step state={!view.started ? "next" : asking ? "now" : "done"}>
                    {t("hearings.session.asking", { current: Math.min(view.done + 1, view.total), total: view.total })}
                </Step>
                <Step state={asking ? "next" : "now"}>{t("hearings.session.rules")}</Step>
            </ol>
            <div
                role="progressbar"
                aria-label={t("hearings.session.progress")}
                aria-valuemin={0}
                aria-valuemax={view.total}
                aria-valuenow={view.done}
                className="h-3 w-full border border-ticker-text"
            >
                <div className="h-full bg-action" style={{ width: `${percent}%` }} />
            </div>
            <p className="m-0 text-[15px]">
                {view.overtime ? t("hearings.session.overtime") : t("hearings.session.estimate", { minutes })}
            </p>
            <div>
                <Button variant="quiet" compact onClick={onLeave} className="border-ticker-text text-ticker-text hover:bg-transparent hover:underline">
                    {t("hearings.session.leave")}
                </Button>
            </div>
        </section>
    );
}
