import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { LaunchGavel } from "@/components/docket/launch-gavel";
import { LanguageToggle } from "@/components/docket/masthead";
import { cn } from "@/lib/utils";

const STEPS = ["step1", "step2", "step3"] as const;

interface IntroScreenProps {
    /** Called when the user finishes the Intro or skips it. */
    onDone: () => void;
}

/** The Intro (design guide, section 10): three steps, skippable at any time, shown once per user. */
export function IntroScreen({ onDone }: IntroScreenProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const moved = useRef(false);
    const last = step === STEPS.length - 1;
    const key = STEPS[step];

    // Keyboard and screen reader users land on the new step's heading; the first step keeps the page's natural focus.
    useEffect(() => {
        if (moved.current) headingRef.current?.focus();
    }, [step]);

    function goTo(next: number) {
        moved.current = true;
        setStep(next);
    }

    return (
        <div className="flex min-h-dvh flex-col bg-paper text-ink">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-4 py-3.5 sm:px-7">
                <span className="font-serif text-[22px] font-black">{t("app.title")}</span>
                <span className="hidden font-mono text-[13px] text-text-muted sm:inline">{t("intro.pageLabel", { step: step + 1 })}</span>
                <div className="flex items-center gap-2">
                    <LanguageToggle />
                    <button type="button" onClick={onDone} className="min-h-10 px-3.5 text-[15px] font-bold text-ink hover:underline">
                        {t("intro.skip")}
                    </button>
                </div>
            </header>

            <main className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-8 px-4 py-8 sm:px-7 min-[900px]:grid-cols-[260px_minmax(0,1fr)] min-[900px]:gap-14">
                <div className="flex flex-col items-center gap-[18px]">
                    <LaunchGavel mode="loop" label={t("intro.gavelLabel")} className="size-32 min-[900px]:size-[220px]" />
                    <ol aria-label={t("intro.stepsLabel")} className="m-0 flex w-full list-none flex-col gap-2 p-0 text-[14px]">
                        {STEPS.map((name, index) => (
                            <li
                                key={name}
                                aria-current={index === step ? "step" : undefined}
                                className={cn(
                                    "px-3 py-2",
                                    index === step && "bg-ink font-bold text-ink-inverse",
                                    index < step && "text-text-muted line-through",
                                    index > step && "border border-rule text-text-muted",
                                )}
                            >
                                {t(`intro.${name}.nav`)}
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="flex min-w-0 flex-col gap-6 min-[900px]:border-l-[6px] min-[900px]:border-double min-[900px]:border-ink min-[900px]:pl-12">
                    <div key={key} className="intro-press flex flex-col gap-[18px]">
                        <span className="text-[14px] font-bold uppercase tracking-[0.16em] text-action-text">{t(`intro.${key}.kicker`)}</span>
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="m-0 text-balance font-serif text-[44px] font-black leading-[0.92] tracking-[-0.04em] [word-spacing:0.08em] outline-none min-[640px]:text-[64px] min-[900px]:text-[96px]"
                        >
                            {t(`intro.${key}.titleStart`)} <span className="hero-highlight">{t(`intro.${key}.titleHighlight`)}</span>
                        </h1>
                        <p className="m-0 max-w-[680px] font-serif text-[20px] leading-snug text-text min-[900px]:text-[26px]">{t(`intro.${key}.body`)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {step > 0 && (
                            <Button variant="secondary" onClick={() => goTo(step - 1)} className="min-h-[54px] px-6 text-[16px]">
                                {t("intro.back")}
                            </Button>
                        )}
                        {last ? (
                            <Button variant="primary" onClick={onDone} className="px-[30px] text-[16px]">
                                {t("intro.enter")} →
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={() => goTo(step + 1)} className="px-[30px] text-[16px]">
                                {step === 0 ? t("intro.begin") : t("intro.next")} →
                            </Button>
                        )}
                    </div>
                </div>
            </main>

            <p className="m-0 border-t border-ink px-4 py-3.5 text-center text-[14px] text-text-muted">{t("intro.footer")}</p>
        </div>
    );
}
