// PixelFlame: llamita pixel art animada para marcar los tickets críticos ("algo está ardiendo").
// 5x7 píxeles con dos fotogramas que se alternan. Respeta prefers-reduced-motion.
// Uso: <PixelFlame size={18} />

const A = ['..A..', '.AA..', '.AYA.', 'AYYA.', 'AYRYA', 'ARRRA', '.RRR.'];
const B = ['..A..', '..AA.', '.AYA.', '.AYYA', 'AYRYA', 'ARRRA', '.RRR.'];
const COLORS: Record<string, string> = { A: '#F97316', Y: '#FDE047', R: '#DC2626' };

const css = `
@keyframes pf-a{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes pf-b{0%,49%{opacity:0}50%,100%{opacity:1}}
.pf-a{animation:pf-a .4s steps(1) infinite}
.pf-b{animation:pf-b .4s steps(1) infinite}
@media (prefers-reduced-motion: reduce){.pf-a{animation:none}.pf-b{animation:none;opacity:0}}
`;

const Frame = ({ map, className }: { map: string[]; className: string }) => (
  <g className={className}>
    {map.flatMap((row, y) =>
      row.split('').map((c, x) =>
        COLORS[c] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLORS[c]} /> : null,
      ),
    )}
  </g>
);

export function PixelFlame({ size = 18, title = 'Crítico: algo está ardiendo' }: { size?: number; title?: string }) {
  return (
    <svg
      width={(size * 5) / 7}
      height={size}
      viewBox="0 0 5 7"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      style={{ imageRendering: 'pixelated', flexShrink: 0 }}
    >
      <style>{css}</style>
      <Frame map={A} className="pf-a" />
      <Frame map={B} className="pf-b" />
    </svg>
  );
}

export default PixelFlame;
