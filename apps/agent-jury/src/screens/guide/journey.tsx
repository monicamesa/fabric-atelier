import { useTranslation } from "react-i18next";
import { STAGES } from "@/guide/stages";

const INK = "var(--ink)";
const PAPER = "var(--paper)";
const CORAL = "var(--action)";

/**
 * The game as a drawn journey (The Docket style: rules and squares, no cards): a double rule through five numbered
 * stations, the last one in coral because the end of the journey is measuring the agent. Horizontal from 640 px, vertical below.
 */
export function Journey() {
    const { t } = useTranslation();
    const names = STAGES.map((stage) => t(`guide.journey.stages.${stage}`));
    return (
        <div role="img" aria-label={t("guide.journey.label")} className="w-full">
            <svg viewBox="0 0 1000 150" className="hidden h-auto w-full min-[640px]:block" aria-hidden="true" focusable="false">
                <line x1="100" y1="57" x2="900" y2="57" stroke={INK} strokeWidth="2" />
                <line x1="100" y1="63" x2="900" y2="63" stroke={INK} strokeWidth="2" />
                {STAGES.map((stage, index) => {
                    const x = 100 + index * 200;
                    const last = index === STAGES.length - 1;
                    return (
                        <g key={stage}>
                            <rect x={x - 26} y={34} width={52} height={52} fill={last ? CORAL : PAPER} stroke={INK} strokeWidth="3" />
                            <text x={x} y={70} textAnchor="middle" className="font-serif" fontSize="30" fontWeight="900" fill={last ? PAPER : INK}>
                                {index + 1}
                            </text>
                            <text x={x} y={125} textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="2" fill={INK} className="font-sans uppercase">
                                {names[index].toUpperCase()}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <svg viewBox="0 0 320 470" className="mx-auto block h-auto w-full max-w-[320px] min-[640px]:hidden" aria-hidden="true" focusable="false">
                <line x1="37" y1="45" x2="37" y2="425" stroke={INK} strokeWidth="2" />
                <line x1="43" y1="45" x2="43" y2="425" stroke={INK} strokeWidth="2" />
                {STAGES.map((stage, index) => {
                    const y = 45 + index * 95;
                    const last = index === STAGES.length - 1;
                    return (
                        <g key={stage}>
                            <rect x={14} y={y - 26} width={52} height={52} fill={last ? CORAL : PAPER} stroke={INK} strokeWidth="3" />
                            <text x={40} y={y + 10} textAnchor="middle" className="font-serif" fontSize="30" fontWeight="900" fill={last ? PAPER : INK}>
                                {index + 1}
                            </text>
                            <text x={88} y={y + 7} fontSize="19" fontWeight="700" letterSpacing="2" fill={INK} className="font-sans">
                                {names[index].toUpperCase()}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
