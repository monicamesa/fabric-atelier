import type { ReactNode } from "react";

/** Shows the agent's answer as written, rendering only **bold** (the agent answers in light Markdown). */
export function AgentAnswer({ text }: { text: string }): ReactNode {
    return (
        <p className="m-0 whitespace-pre-line text-[17px] text-text">
            {text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
        </p>
    );
}
