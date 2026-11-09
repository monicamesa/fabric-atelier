import type { ReactNode } from "react";

interface PageHeaderProps {
    kicker?: string;
    title: string;
    help: string;
    aside?: ReactNode;
}

/** Page title with its plain-language help line and the 6 px double "newspaper" rule. */
export function PageHeader({ kicker, title, help, aside }: PageHeaderProps) {
    return (
        <div className="grid items-end gap-6 border-b-[6px] border-double border-ink pb-5 min-[900px]:grid-cols-[minmax(0,1fr)_380px] min-[900px]:gap-10">
            <div className="flex flex-col gap-2">
                {kicker && <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-action-text">{kicker}</span>}
                <h1 className="m-0 font-serif text-[44px] font-black leading-[0.95] tracking-[-0.03em] text-ink min-[900px]:text-[64px]">
                    {title}
                </h1>
                <p className="m-0 max-w-[700px] text-[17px] leading-normal text-text">{help}</p>
            </div>
            {aside}
        </div>
    );
}
