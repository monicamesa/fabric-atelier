import { useTranslation } from "react-i18next";
import { Objection } from "@/components/docket/objection";
import type { ClerkErrorView } from "@/data/clerk-errors";

/** Plain-language result of a failed clerk action; the server detail stays under "Technical details". */
export function ClerkError({ view }: { view: ClerkErrorView | null }) {
    const { t } = useTranslation();
    if (!view) return null;
    return (
        <Objection
            compact
            message={t(`clerk.errors.${view.key}`)}
            reassurance={t("clerk.errors.nothingChanged")}
            technicalDetails={view.technicalDetails}
        />
    );
}

/** Polite confirmation after a change. */
export function ClerkNotice({ message }: { message: string | null }) {
    return (
        <p role="status" className="m-0 min-h-0 text-[15px] font-semibold text-ruled">
            {message ?? ""}
        </p>
    );
}
