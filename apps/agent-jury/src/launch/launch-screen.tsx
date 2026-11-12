import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { LaunchGavel, type LaunchGavelMode } from "@/components/docket/launch-gavel";
import { cn } from "@/lib/utils";
import type { LaunchErrorKind, LaunchPhase, LaunchView } from "./launch-machine";

interface LaunchScreenProps {
    view: LaunchView;
    onRetry: () => void;
    onSignIn?: () => void;
    signingIn?: boolean;
}

const STEPS = ["launch.step1", "launch.step2", "launch.step3"] as const;
const STATUS_LINE: Record<Exclude<LaunchPhase, "error">, string> = {
    session: "launch.session",
    docket: "launch.docket",
    ready: "launch.ready",
    done: "launch.ready",
};
const ERROR_MESSAGE: Record<LaunchErrorKind, string> = {
    session: "launch.errors.session",
    signIn: "launch.errors.signIn",
    notJuror: "launch.errors.notJuror",
    busy: "launch.errors.busy",
    unknown: "launch.errors.unknown",
};

function currentStep(phase: LaunchPhase): number {
    return phase === "session" ? 0 : phase === "docket" ? 1 : 2;
}

/** The full-screen launch (design guide, section 6b). Shown once per app load, before anything else. */
export function LaunchScreen({ view, onRetry, onSignIn, signingIn = false }: LaunchScreenProps) {
    const { t } = useTranslation();
    const { phase, error } = view;
    const step = currentStep(phase);
    const statusLine = phase === "error" ? undefined : STATUS_LINE[phase];
    const mode: LaunchGavelMode = phase === "ready" || phase === "done" ? "strike" : phase === "error" ? "still" : "breathe";

    return (
        <div className="flex min-h-dvh flex-col bg-paper text-text">
            <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center sm:gap-[22px]">
                <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-action-text sm:text-[13px]">{t("launch.kicker")}</span>
                <LaunchGavel mode={mode} label={t("launch.gavelLabel")} className="size-32 sm:size-[168px]" />
                <div className="flex w-full flex-col items-center gap-1.5">
                    <span className="font-serif text-[28px] font-black text-ink sm:text-[30px]">{t("app.title")}</span>
                    <h1 className="m-0 max-w-full text-balance font-serif text-[clamp(40px,7vw,88px)] font-black leading-[0.92] tracking-[-0.045em] [word-spacing:0.08em] text-ink">
                        {t("launch.headlineStart")} <span className="hero-highlight">{t("launch.headlineEnd")}</span>
                    </h1>
                </div>
                <div className="flex w-full max-w-[520px] flex-col items-center gap-3.5 border-t-[6px] border-double border-ink pt-[18px]">
                    {error ? (
                        <div role="alert" className="launch-rise flex w-full flex-col gap-2.5 border-2 border-action bg-dispute-bg p-[18px] text-left text-dispute-text">
                            <p className="m-0 font-serif text-[32px] font-black leading-none">{t("states.objection")}</p>
                            <p className="m-0 leading-normal">{t(ERROR_MESSAGE[error.kind])}</p>
                            <details className="text-[13px]">
                                <summary className="min-h-9 cursor-pointer py-1 font-semibold">{t("states.technicalDetails")}</summary>
                                <code className="block whitespace-pre-wrap break-words font-mono text-[13px]">{error.details}</code>
                            </details>
                            <div>
                                {(error.kind === "session" || error.kind === "signIn") && onSignIn ? (
                                    <Button variant="primary" onClick={onSignIn} disabled={signingIn} aria-busy={signingIn}>
                                        {signingIn ? t("launch.signingIn") : t("launch.signIn")}
                                    </Button>
                                ) : (
                                    <Button variant="primary" onClick={onRetry}>
                                        {t("common.retry")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
                            <span key={statusLine} className="launch-rise font-serif text-[22px] font-bold text-ink sm:text-[24px]">
                                {statusLine && t(statusLine)}
                            </span>
                            <ol aria-hidden="true" className="m-0 flex list-none flex-wrap justify-center gap-x-[18px] gap-y-1 p-0 text-[13px] font-bold uppercase tracking-[0.08em]">
                                {STEPS.map((key, index) => (
                                    <li
                                        key={key}
                                        className={cn(
                                            index < step && "text-ruled",
                                            index === step && "border-b-2 border-action pb-0.5 text-ink",
                                            index > step && "text-text-muted",
                                        )}
                                    >
                                        {t(key)}
                                    </li>
                                ))}
                            </ol>
                            {view.slow && (
                                <div className="launch-rise flex flex-col items-center gap-2.5">
                                    <span className="text-[15px] text-text-muted">{t("launch.slow")}</span>
                                    <Button variant="secondary" onClick={onRetry}>
                                        {t("common.retry")}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <footer className="px-4 py-3.5 text-center text-[13px] text-text-muted">{t("launch.footer")}</footer>
        </div>
    );
}
