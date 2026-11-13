import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { loadVerdictTrace, parseTraceSteps, queryLanguages, toolKind, type TraceStep } from "@/data/trace";
import { useAsync } from "@/hooks/use-async";
import type { AppRayfinClient } from "@/lib/rayfin-client";

function CopyQuery({ code }: { code: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    return (
        <Button
            variant="link"
            compact
            className="self-start text-[13px]"
            onClick={() => {
                void navigator.clipboard
                    .writeText(code)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
            }}
        >
            {copied ? t("trace.copied") : t("trace.copy")}
        </Button>
    );
}

function Step({ label, children }: { label: string; children: ReactNode }) {
    return (
        <li className="flex flex-col gap-1 border-l-2 border-ink pl-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</span>
            {children}
        </li>
    );
}

function Timeline({ steps }: { steps: TraceStep[] }) {
    const { t } = useTranslation();
    const languages = queryLanguages(steps);
    const queries = steps.filter((step) => step.k === "query").length;
    return (
        <>
            <p className="m-0 text-[15px] text-ink">
                {queries > 0 ? t("trace.summary", { count: queries, languages: languages.map((item) => item.toUpperCase()).join(", ") }) : t("trace.summaryNone")}
            </p>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {steps.map((step, index) =>
                    step.k === "source" ? (
                        <Step key={index} label={t("trace.step.source")}>
                            <span className="text-[15px] font-semibold text-ink">
                                {toolKind(step.tool) === "other" ? t("trace.tools.other", { tool: step.tool }) : t(`trace.tools.${toolKind(step.tool)}`)}
                            </span>
                            {step.request && <span className="text-[14px] text-text">{t("trace.asked", { request: step.request })}</span>}
                        </Step>
                    ) : (
                        <Step key={index} label={t("trace.step.query", { language: (step.lang ?? "").toUpperCase() })}>
                            <pre className="m-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words border border-rule bg-paper p-3 font-mono text-[13px] leading-snug text-ink">{step.code}</pre>
                            {step.code && <CopyQuery code={step.code} />}
                        </Step>
                    ),
                )}
                <Step label={t("trace.step.answer")}>
                    <span className="text-[14px] text-text">{t("trace.answerNote")}</span>
                </Step>
            </ol>
        </>
    );
}

function TraceBody({ client, verdictId }: { client: Pick<AppRayfinClient, "data">; verdictId: string }) {
    const { t } = useTranslation();
    const trace = useAsync(() => loadVerdictTrace(client, verdictId));
    if (trace.status === "loading" && !trace.data) return <p className="m-0 text-[14px] text-text-muted">{t("trace.loading")}</p>;
    if (trace.status === "error") {
        return (
            <p role="status" className="m-0 flex flex-wrap items-center gap-x-3 text-[14px] text-text-muted">
                {t("trace.failed")}
                <Button variant="link" compact onClick={trace.reload}>
                    {t("common.retry")}
                </Button>
            </p>
        );
    }
    const steps = parseTraceSteps(trace.data?.steps);
    if (!trace.data || steps.length === 0) return <p className="m-0 text-[14px] text-text-muted">{t("trace.none")}</p>;
    return (
        <>
            <Timeline steps={steps} />
            {trace.data.truncated && <p className="m-0 text-[13px] text-text-muted">{t("trace.truncated")}</p>}
        </>
    );
}

/**
 * "How the agent got there": a closed accordion on the verdict card. The trace is read only when it is opened (one query per
 * verdict), and a failed read only changes the accordion's own text: the card and the review keep working.
 */
export function VerdictTracePanel({ client, verdictId }: { client: Pick<AppRayfinClient, "data">; verdictId: string }) {
    const { t } = useTranslation();
    const [opened, setOpened] = useState(false);
    return (
        <details
            data-testid="verdict-trace"
            onToggle={(event) => {
                if (event.currentTarget.open) setOpened(true);
            }}
            className="border-t border-rule pt-2"
        >
            <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-semibold text-ink">{t("trace.title")}</summary>
            <div className="flex flex-col gap-3 pb-1 pt-1">
                <p className="m-0 text-[14px] text-text-muted">{t("trace.help")}</p>
                {opened && <TraceBody client={client} verdictId={verdictId} />}
            </div>
        </details>
    );
}
