import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { PageHeader } from "@/components/docket/page-header";
import snapshot from "@/data/source-salesmodel.json";
import { isAppLanguage, LOCALE_BY_LANGUAGE } from "@/i18n/language-preference";

export function SourceScreen() {
    const { t, i18n } = useTranslation();
    const language = isAppLanguage(i18n.language) ? i18n.language : "en";
    const locale = LOCALE_BY_LANGUAGE[language];
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${snapshot.snapshotDate}T00:00:00Z`));
    const [copyState, setCopyState] = useState<{ name: string; success: boolean }>();
    const model = snapshot.models.find((item) => item.key === "salesmodel");
    if (!model) throw new Error("SalesModel is missing from the source snapshot.");

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
            <section aria-labelledby="source-measures">
                <h2 id="source-measures" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.measures")}</h2>
                {model.measures.map((measure) => (
                    <div key={measure.name} className="grid gap-3 border-b border-rule py-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="flex flex-col items-start gap-2"><strong className="text-ink">{measure.name}</strong><span>{measure.description[language]}</span><div className="flex gap-2">{measure.tags.map((tag) => <Chip key={tag} tone={tag === "net" ? "ruled" : "review"}>{t(`source.${tag}`)}</Chip>)}</div></div>
                        <div className="min-w-0"><pre className="m-0 whitespace-pre-wrap break-words border border-rule bg-paper-raised p-3 font-mono text-[13px] text-ink">{measure.dax}</pre><Button variant="link" compact onClick={() => void copy(measure.name, measure.dax)}>{copyState?.name === measure.name && copyState.success ? t("trace.copied") : t("trace.copy")}</Button>{copyState?.name === measure.name && !copyState.success && <span role="alert" className="text-action-text">{t("source.copyFailed")}</span>}</div>
                    </div>
                ))}
            </section>
            <section aria-labelledby="source-tables">
                <h2 id="source-tables" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.tables")}</h2>
                {model.tables.map((table) => <div key={table.name} className="grid gap-2 border-b border-rule py-3 min-[900px]:grid-cols-[180px_minmax(0,1fr)_minmax(0,2fr)]"><strong className="text-ink">{table.name}</strong><span>{table.description[language]}</span><span className="break-words font-mono text-[13px]">{table.columns.join(", ")}</span></div>)}
            </section>
            <section aria-labelledby="source-relationships">
                <h2 id="source-relationships" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.relationships")}</h2>
                <ul className="flex list-none flex-col gap-2 p-0">{model.relationships.map((relation) => <li key={relation}>{relation}</li>)}</ul>
            </section>
            <section aria-labelledby="source-ideas">
                <h2 id="source-ideas" className="m-0 border-b border-ink pb-2 font-serif text-[28px] font-bold text-ink">{t("source.questionIdeas")}</h2>
                <ol className="flex flex-col gap-2 pl-6">{model.questionIdeas[language].map((idea) => <li key={idea}>{idea}</li>)}</ol>
            </section>
        </div>
    );
}
