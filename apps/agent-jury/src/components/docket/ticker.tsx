import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface TickerItem {
    key: string;
    content: ReactNode;
    href: string;
}

/** "Latest verdicts" band (Home only). The list is drawn twice so the loop is seamless; the copy is hidden from screen readers. */
export function Ticker({ items }: { items: TickerItem[] }) {
    const { t } = useTranslation();
    if (items.length === 0) return null;
    const list = (copy: boolean) => (
        <ul aria-hidden={copy || undefined} className="m-0 flex shrink-0 list-none items-center gap-10 p-0 pr-10">
            {items.map((item) => (
                <li key={item.key} className="whitespace-nowrap">
                    <a href={item.href} tabIndex={copy ? -1 : undefined} className="text-ticker-text no-underline hover:underline">
                        {item.content}
                    </a>
                </li>
            ))}
        </ul>
    );
    return (
        <section aria-label={t("ticker.label")} className="docket-ticker flex min-h-10 items-stretch overflow-hidden bg-ticker-bg font-mono text-[14px] text-ticker-text">
            <h2 className="m-0 flex shrink-0 items-center bg-action px-4 font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ticker-text">
                {t("ticker.title")}
            </h2>
            <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-4">
                <div className="docket-ticker-track flex w-max">
                    {list(false)}
                    {list(true)}
                </div>
            </div>
        </section>
    );
}
