import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { GuideStage } from "@/guide/stages";

const INK = "var(--ink)";
const PAPER = "var(--paper)";
const RAISED = "var(--paper-raised)";
const RULE = "var(--rule)";
const MUTED = "var(--text-muted)";
const CORAL = "var(--action)";
const GREEN = "var(--ruled-fill)";
const BLUE = "var(--review)";

/** Grey bars that stand for lines of text. */
function Lines({ x, y, widths, gap = 22 }: { x: number; y: number; widths: number[]; gap?: number }) {
    return (
        <>
            {widths.map((width, index) => (
                <rect key={index} x={x} y={y + index * gap} width={width} height={8} fill={RULE} />
            ))}
        </>
    );
}

/** A button as the Docket draws it: ink block with a coral offset shadow, or an outlined one. */
function Button({ x, y, width, primary, children }: { x: number; y: number; width: number; primary?: boolean; children?: ReactNode }) {
    return (
        <g>
            {primary && <rect x={x + 6} y={y + 6} width={width} height={46} fill={CORAL} />}
            <rect x={x} y={y} width={width} height={46} fill={primary ? INK : RAISED} stroke={INK} strokeWidth="2.5" />
            {children}
        </g>
    );
}

function Propose() {
    return (
        <>
            <text x="60" y="78" fontSize="34" fontWeight="900" fill={INK} className="font-serif">
                ?
            </text>
            <rect x="110" y="44" width="730" height="64" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <Lines x={132} y={66} widths={[420]} />
            <rect x="556" y="62" width="3" height="28" fill={INK} />
            <rect x="110" y="140" width="350" height="44" fill={RAISED} stroke={INK} strokeWidth="1.5" />
            <Lines x={128} y={158} widths={[150]} />
            <rect x="490" y="140" width="350" height="44" fill={RAISED} stroke={INK} strokeWidth="1.5" />
            <Lines x={508} y={158} widths={[110]} />
            <line x1="60" y1="226" x2="840" y2="226" stroke={RULE} strokeWidth="2" />
            <rect x="110" y="256" width="220" height="88" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <text x="220" y="318" textAnchor="middle" fontSize="54" fontWeight="900" fill={INK} className="font-serif">
                141
            </text>
            <rect x="360" y="256" width="480" height="88" fill={RAISED} stroke={INK} strokeWidth="1.5" />
            <Lines x={382} y={282} widths={[360, 250]} />
            <Button x={110} y={400} width={230} primary>
                <rect x="132" y="418" width="150" height="10" fill={PAPER} />
            </Button>
            <Button x={380} y={400} width={140}>
                <rect x="402" y="418" width="96" height="10" fill={RULE} />
            </Button>
            <rect x="640" y="410" width="200" height="30" fill="none" stroke={CORAL} strokeWidth="2.5" strokeDasharray="6 5" />
            <text x="740" y="431" textAnchor="middle" fontSize="16" fontWeight="700" fill={CORAL} className="font-sans">
                0
            </text>
        </>
    );
}

function Answer({ x, letter, value, accent }: { x: number; letter: string; value: string; accent: string }) {
    return (
        <g>
            <rect x={x} y="40" width="380" height="400" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <rect x={x} y="40" width="380" height="8" fill={accent} />
            <text x={x + 26} y="92" fontSize="22" fontWeight="700" letterSpacing="3" fill={INK} className="font-sans">
                {letter}
            </text>
            <text x={x + 26} y="190" fontSize="96" fontWeight="900" fill={INK} className="font-serif">
                {value}
            </text>
            <line x1={x + 26} y1="224" x2={x + 354} y2="224" stroke={RULE} strokeWidth="2" />
            {[0, 1, 2, 3].map((row) => (
                <g key={row}>
                    <rect x={x + 26} y={250 + row * 32} width="86" height="8" fill={MUTED} />
                    <rect x={x + 130} y={250 + row * 32} width={row === 0 ? 190 : 120} height="8" fill={RULE} />
                </g>
            ))}
            <Button x={x + 26} y={380} width={170} />
            <rect x={x + 44} y={398} width="120" height="10" fill={INK} />
            <line x1={x + 226} y1="412" x2={x + 330} y2="412" stroke={CORAL} strokeWidth="3" />
        </g>
    );
}

function Vote() {
    return (
        <>
            <Answer x={50} letter="A" value="141" accent={INK} />
            <Answer x={470} letter="B" value="265" accent={CORAL} />
        </>
    );
}

function Ruled() {
    const jurors = [
        { x: 120, approver: false },
        { x: 300, approver: true },
    ];
    return (
        <>
            <text x="60" y="190" fontSize="140" fontWeight="900" fill={INK} className="font-serif">
                141
            </text>
            <rect x="60" y="210" width="360" height="10" fill={INK} />
            <rect x="60" y="226" width="360" height="4" fill={INK} />
            {jurors.map((juror) => (
                <g key={juror.x}>
                    <circle cx={juror.x} cy="340" r="44" fill={RAISED} stroke={INK} strokeWidth="2.5" />
                    <path d={`M${juror.x - 18} 340 l13 14 l24 -30`} fill="none" stroke={GREEN} strokeWidth="8" strokeLinecap="square" />
                    {juror.approver && (
                        <>
                            <rect x={juror.x - 40} y="402" width="80" height="26" fill={INK} />
                            <rect x={juror.x - 24} y="411" width="48" height="8" fill={PAPER} />
                        </>
                    )}
                </g>
            ))}
            <g transform="rotate(-8 640 190)">
                <rect x="480" y="120" width="330" height="140" fill="none" stroke={GREEN} strokeWidth="8" />
                <rect x="494" y="134" width="302" height="112" fill="none" stroke={GREEN} strokeWidth="3" />
                <path d="M560 190 l34 38 l76 -88" fill="none" stroke={GREEN} strokeWidth="18" strokeLinecap="square" />
            </g>
            <rect x="480" y="330" width="330" height="10" fill={GREEN} />
            <rect x="480" y="356" width="250" height="8" fill={RULE} />
            <rect x="480" y="380" width="290" height="8" fill={RULE} />
        </>
    );
}

function Hearing({ correct }: { correct: string }) {
    return (
        <>
            <rect x="50" y="40" width="360" height="190" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <rect x="50" y="40" width="360" height="8" fill={GREEN} />
            <rect x="74" y="74" width="120" height="8" fill={MUTED} />
            <text x="74" y="170" fontSize="84" fontWeight="900" fill={INK} className="font-serif">
                141
            </text>
            <rect x="490" y="40" width="360" height="190" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <rect x="490" y="40" width="360" height="8" fill={INK} />
            <rect x="514" y="74" width="120" height="8" fill={MUTED} />
            <text x="514" y="170" fontSize="84" fontWeight="900" fill={INK} className="font-serif">
                141
            </text>
            <text x="450" y="146" textAnchor="middle" fontSize="40" fill={INK} className="font-serif">
                =
            </text>
            <g transform="rotate(-6 450 330)">
                <rect x="300" y="290" width="300" height="76" fill="none" stroke={GREEN} strokeWidth="6" />
                <text x="450" y="342" textAnchor="middle" fontSize="36" fontWeight="900" letterSpacing="4" fill={GREEN} className="font-sans">
                    {correct.toUpperCase()}
                </text>
            </g>
            {[0, 1, 2].map((step) => (
                <g key={step}>
                    <rect x={150 + step * 230} y="440" width="56" height="56" fill={step === 2 ? INK : RAISED} stroke={INK} strokeWidth="2.5" />
                    <text x={178 + step * 230} y="478" textAnchor="middle" fontSize="28" fontWeight="900" fill={step === 2 ? PAPER : INK} className="font-serif">
                        {step + 1}
                    </text>
                    {step < 2 && <line x1={212 + step * 230} y1="468" x2={374 + step * 230} y2="468" stroke={INK} strokeWidth="2.5" strokeDasharray="8 6" />}
                </g>
            ))}
        </>
    );
}

function Review() {
    return (
        <>
            <rect x="50" y="40" width="800" height="150" fill={RAISED} stroke={INK} strokeWidth="2.5" />
            <rect x="50" y="40" width="10" height="150" fill={GREEN} />
            <Lines x={90} y={74} widths={[420, 320]} />
            <rect x="700" y="76" width="110" height="64" fill="none" stroke={GREEN} strokeWidth="5" transform="rotate(-6 755 108)" />
            <Button x={90} y={240} width={190} primary>
                <path d="M120 263 l12 12 l22 -26" fill="none" stroke={PAPER} strokeWidth="6" strokeLinecap="square" />
                <rect x="170" y="258" width="76" height="10" fill={PAPER} />
            </Button>
            <Button x={330} y={240} width={190}>
                <path d="M362 255 l24 24 M386 255 l-24 24" stroke={CORAL} strokeWidth="6" strokeLinecap="square" />
                <rect x="410" y="258" width="76" height="10" fill={INK} />
            </Button>
            <line x1="60" y1="340" x2="840" y2="340" stroke={RULE} strokeWidth="2" />
            <rect x="90" y="388" width="720" height="26" fill="var(--track)" />
            <rect x="90" y="388" width="540" height="26" fill={BLUE} />
            <text x="90" y="466" fontSize="40" fontWeight="900" fill={INK} className="font-serif">
                3 / 4
            </text>
            <rect x="660" y="470" width="150" height="8" fill={RULE} />
        </>
    );
}

/**
 * One drawn illustration per stage, in The Docket style (rules, squares, stamps, no photos). Nothing in them needs
 * translating except the verdict word, so the same drawing serves both languages and both themes through the colour tokens.
 */
export function StageIllustration({ stage, alt }: { stage: GuideStage; alt: string }) {
    const { t } = useTranslation();
    return (
        <div className="aspect-[900/560] w-full overflow-hidden border border-ink bg-paper-raised">
            <svg viewBox="0 0 900 560" role="img" aria-label={alt} className="block size-full" data-stage={stage}>
                {stage === "propose" && <Propose />}
                {stage === "vote" && <Vote />}
                {stage === "ruled" && <Ruled />}
                {stage === "hearing" && <Hearing correct={t("hearings.verdicts.correct")} />}
                {stage === "review" && <Review />}
            </svg>
        </div>
    );
}
