import { useEffect, useState } from "react";
import { loadCaseLanguages } from "@/data/cases.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";

/**
 * The language of each case, for pages that don't load the docket. One small query, and it fails open:
 * when it can't be read the badges are simply not shown.
 */
export function useCaseLanguages(client: Pick<AppRayfinClient, "data" | "auth">, caseIds: readonly string[]): Record<string, "en" | "es"> {
    const key = [...new Set(caseIds.map((id) => id.toLowerCase()))].sort().join(",");
    const [loaded, setLoaded] = useState<{ key: string; languages: Record<string, "en" | "es"> }>();
    useEffect(() => {
        if (!key) return;
        let active = true;
        loadCaseLanguages(client, key.split(","))
            .then((languages) => active && setLoaded({ key, languages }))
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [client, key]);
    return loaded?.key === key ? loaded.languages : {};
}
