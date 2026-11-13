/** Element id of the agent selector shown at the top of Home, Cases and Hearings. */
export const AGENT_SELECTOR_ID = "agent-selector";

/** Moves the view to the agent selector (used by "change" in the propose form). */
export function focusAgentSelector() {
    const element = document.getElementById(AGENT_SELECTOR_ID);
    element?.scrollIntoView?.({ block: "center" });
    (element?.querySelector("button[aria-pressed='true'], select") as HTMLElement | null)?.focus();
}
