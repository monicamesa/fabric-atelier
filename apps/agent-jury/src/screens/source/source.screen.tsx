import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { PageHeader } from "@/components/docket/page-header";
import snapshot from "@/data/source-salesmodel.json";
import diagram from "@/data/salesmodel-diagram.svg?raw";
import { isAppLanguage, LOCALE_BY_LANGUAGE } from "@/i18n/language-preference";

export function SourceScreen() {
    const { t, i18n } = useTranslation();
    const language = isAppLanguage(i18n.language) ? i18n.language : "en";
    const locale = LOCALE_BY_LANGUAGE[language];
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${snapshot.snapshotDate}T00:00:00Z`));
    const [copyState, setCopyState] = useState<{ name: string; success: boolean }>();
    const model = snapshot.models.find((item) => item.key === "salesmodel");
    if (!model) throw new Error("SalesModel is missing from the source snapshot.");

    const diagramLabels: [string, string][] = [
        ["Star schema: SalesOrder in the centre, related to Customer, Product and Calendar; Contract related to Customer.", "diagramDescription"],
        ["FACT · 1 ROW PER ORDER", "diagramOrderFact"],
        ["DIMENSION", "diagramDimension"],
        [">FACT<", "diagramFact"],
        ["Year  ← fiscal (Jul–Jun)", "diagramFiscal"],
        ["NetAmount     ← net", "diagramNet"],
        ["TotalAmount   ← gross", "diagramGross"],
        ["Country  ← billing", "diagramBilling"],
        ["ShipToCountry ← ship", "diagramShipping"],
        ["EndDate empty = open", "diagramOpen"],
    ];
    const svg = diagramLabels.reduce((markup, [original, key]) => {
        const label = t(`source.${key}`).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        return markup.replaceAll(original, original === ">FACT<" ? `>${label}<` : label);
    }, diagram);

    async function copy(name: string, dax: string) {
        try {
            await navigator.clipboard.writeText(dax);
            setCopyState({ name, success: true });
        } catch {
            setCopyState({ name, success: false });
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader kicker={t("source.kicker", { model: model.name })} title={t("source.title")} help={t("source.help")}
                aside={<div className="flex flex-col gap-2 text-[15px] text-text-muted"><strong>{t("source.snapshot", { date })}</strong><p className="m-0">{model.dataRange[language]}</p></div>} />

            <section aria-labelledby="source-how" className="border border-ink bg-paper-raised p-5">
                <h2 id="source-how" className="m-0 font-serif text-[28px] font-bold text-ink">{t("source.howToUse")}</h2>
                <ol className="mb-0 flex flex-col gap-2 pl-6">
                    <li>{t("source.step1")}</li>
                    <li>{t("source.step2")}</li>
                    <li>{t("source.step3")}</li>
                </ol>
            </section>

            <section aria-labelledby="source-figures">
                <h2 id="source-figures" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.referenceFigures")}</h2>
                <table className="w-full border-collapse text-left">
                    <thead className="hidden min-[900px]:table-header-group"><tr>{["figure", "variantA", "variantB", "difference"].map((key) => <th key={key} scope="col" className="border-b border-rule p-3 text-[14px] text-text-muted">{t(`source.${key}`)}</th>)}</tr></thead>
                    <tbody>{model.referenceFigures.map((figure) => (
                        <tr key={figure.figure.en} className="block border-b border-rule min-[900px]:table-row">
                            <th scope="row" className="block p-3 text-[16px] text-ink min-[900px]:table-cell">{figure.figure[language]}</th>
                            {figure.variants.map((variant) => {
                                const decimals = variant.value.split(".")[1]?.length ?? 0;
                                const value = Number(variant.value.replaceAll(",", ""));
                                return <td key={variant.label.en} className="block px-3 pb-3 align-top min-[900px]:table-cell min-[900px]:p-3"><span className="block text-[14px] text-text">{variant.label[language]}</span><span className="font-serif text-[24px] font-bold text-ink">{new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}</span></td>;
                            })}
                            <td className="block px-3 pb-3 text-[15px] text-text min-[900px]:table-cell min-[900px]:p-3">{figure.difference[language]}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </section>
            <section aria-labelledby="source-ideas">
                <h2 id="source-ideas" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.questionIdeas")}</h2>
                <ol className="flex flex-col gap-2 pl-6">{model.questionIdeas[language].map((idea) => <li key={idea}>{idea}</li>)}</ol>
            </section>
            <section aria-labelledby="source-diagram">
                <h2 id="source-diagram" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.diagram")}</h2>
                <figure className="m-0 mt-4 max-w-[760px]">
                    <div className="overflow-x-auto text-ink [--muted:var(--text-muted)] [--raised:var(--paper-raised)]" tabIndex={0} role="region" aria-label={t("source.diagram")}>
                        <div className="w-[760px]" dangerouslySetInnerHTML={{ __html: svg }} />
                    </div>
                    <figcaption className="mt-2 text-[15px] text-text">{t("source.diagramCaption")}</figcaption>
                </figure>
            </section>
            <section aria-labelledby="source-measures">
                <h2 id="source-measures" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.measures")}</h2>
                <p className="mb-0 text-[16px] text-text">{t("source.measuresHelp")}</p>
                {model.measures.map((measure) => (
                    <div key={measure.name} className="grid gap-3 border-b border-rule py-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="flex flex-col items-start gap-2"><strong className="text-ink">{measure.name}</strong><span>{measure.description[language]}</span><div className="flex gap-2">{measure.tags.map((tag) => <Chip key={tag} tone={tag === "net" ? "ruled" : "review"}>{t(`source.${tag}`)}</Chip>)}</div></div>
                        <div className="min-w-0"><pre className="m-0 whitespace-pre-wrap break-words border border-rule bg-paper-raised p-3 font-mono text-[13px] text-ink">{measure.dax}</pre><Button variant="link" compact onClick={() => void copy(measure.name, measure.dax)}>{copyState?.name === measure.name && copyState.success ? t("trace.copied") : t("trace.copy")}</Button>{copyState?.name === measure.name && !copyState.success && <span role="alert" className="text-action-text">{t("source.copyFailed")}</span>}</div>
                    </div>
                ))}
            </section>
            <details className="border border-ink bg-paper-raised">
                <summary className="cursor-pointer px-4 py-3"><h2 className="m-0 inline font-serif text-[28px] font-bold text-ink">{t("source.technicalDetails")}</h2></summary>
                <div className="flex flex-col gap-6 px-4 pb-4">
                    <section aria-labelledby="source-tables">
                        <h2 id="source-tables" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.tables")}</h2>
                        {model.tables.map((table) => <div key={table.name} className="grid gap-2 border-b border-rule py-3 min-[900px]:grid-cols-[180px_minmax(0,1fr)_minmax(0,2fr)]"><strong className="text-ink">{table.name}</strong><span>{table.description[language]}</span><span className="break-words font-mono text-[13px]">{table.columns.join(", ")}</span></div>)}
                    </section>
                    <section aria-labelledby="source-relationships">
                        <h2 id="source-relationships" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.relationships")}</h2>
                        <ul className="flex list-none flex-col gap-2 p-0">{model.relationships.map((relation) => <li key={relation}>{relation}</li>)}</ul>
                    </section>
                </div>
            </details>
        </div>
    );
}
