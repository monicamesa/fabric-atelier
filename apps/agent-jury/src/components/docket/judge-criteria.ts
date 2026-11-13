import { DEFAULT_CRITIC_PROMPT_VERSION } from "@/rules/judge-trust";

/** True while the hearings use Fabric's standard evaluation criteria (no custom critic prompt). */
export function isStandardCriteria(version: string): boolean {
    return version === DEFAULT_CRITIC_PROMPT_VERSION;
}
