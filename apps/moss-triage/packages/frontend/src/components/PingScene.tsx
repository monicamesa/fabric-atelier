// PingScene: la mascota del banner de Moss Triage, copiada tal cual del mockup.
// Pixel art en SVG (cuadrados de 5 px en un lienzo de 180x120) + animación CSS de 9 s:
// teclea -> aparecen líneas de código -> humo -> pantalla roja + llamas -> vuelve a empezar.
// No depende de ninguna librería. Úsalo así: <PingScene />

type Px = { x: number; y: number; fill: string };

const L = (map: string[], ox: number, oy: number, colors: Record<string, string>): Px[] => {
  const out: Px[] = [];
  map.forEach((row, y) =>
    row.split('').forEach((c, x) => {
      if (colors[c]) out.push({ x: (x + ox) * 5, y: (y + oy) * 5, fill: colors[c] });
    }),
  );
  return out;
};

const person = [
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '...hhhhhhhhhh...',
  '..PSSSSSSSSSSP..',
  '..PSSSSEESSEESP.',
  '..PSSSSEESSEESP.',
  '..PSSSSSSSSSSP..',
  '...SSSSMMMSSKK..',
  '....SSSSSSSS....',
  '......SSSS......',
  '...VVVVVVVVVV...',
  '..VVVVVVVVVVVV..',
  '.VVVVVVVVVVVVVV.',
  '.VVVVDDDDVVVVVV.',
  '.VVVVDDDDVVVVVV.',
  '.VVVVVVVVVVVVVV.',
  '.VVVVVVVVVVVVVV.',
  '................',
];
const monitor = [
  'BBBBBBBBBBBBBBBB',
  'BKKKKKKKKKKKKKKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKSSSSSSSSSSSSKB',
  'BKKKKKKKKKKKKKKB',
  'BBBBBBBBBBBBBAGB',
  '.....BBBBBB.....',
  '...BBBBBBBBBB...',
];
const fire = [
  '....A.....A...',
  '...AA..A..AA..',
  '..AYA.AYA.AYA.',
  '.AYYAAYYAAYYA.',
  'AYYRYYYRYYYRYA',
  'ARRRRRRRRRRRRA',
  '..RRRRRRRRRR..',
];
const smoke = ['...GG...GG..', '..GGGG.GGGG.', '...GG...GG..', '..GG..GG....', '...GGGG.....'];
const desk = ['TTTTTTTTTTTTTTTTTTTTTTTT', 'DDDDDDDDDDDDDDDDDDDDDDDD', '.D....................D.'];

const lPerson = L(person, 0, 3, {
  H: '#F97316', h: '#C2410C', P: '#1F2937', S: '#D9A07A', E: '#111827',
  M: '#7C2D12', K: '#1F2937', V: '#7C3AED', D: '#5B21B6',
});
const lHands = L(['VVSS'], 14, 19, { V: '#7C3AED', S: '#D9A07A' });
const lMonitor = L(monitor, 18, 5, { B: '#94A3B8', K: '#334155', S: '#052E16', A: '#F5B841', G: '#4ADE80' });
const lKeys = L(['KLKLKLKLKLK'], 15, 20, { K: '#374151', L: '#9CA3AF' });
const lMug = L(['WWW', 'WGW', 'WWW'], 32, 18, { W: '#F5F5F4', G: '#4ADE80' });
const lDesk = L(desk, 12, 21, { T: '#B45309', D: '#78350F' });
const lSmoke = L(smoke, 21, 0, { G: '#9CA3AF' });
const lFire = L(fire, 19, 0, { A: '#F97316', Y: '#FDE047', R: '#DC2626' });

const css = `
@keyframes ping-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
@keyframes ping-hands{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes ping-keys{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ping-l1{0%,8%{opacity:0}9%,62%{opacity:1}63%,100%{opacity:0}}
@keyframes ping-l2{0%,20%{opacity:0}21%,62%{opacity:1}63%,100%{opacity:0}}
@keyframes ping-l3{0%,32%{opacity:0}33%,62%{opacity:1}63%,100%{opacity:0}}
@keyframes ping-l4{0%,44%{opacity:0}45%,62%{opacity:1}63%,100%{opacity:0}}
@keyframes ping-smoke{0%,50%{opacity:0}54%,68%{opacity:.9}72%,100%{opacity:0}}
@keyframes ping-fire{0%,63%{opacity:0}66%,95%{opacity:1}97%,100%{opacity:0}}
@keyframes ping-flicker{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.ping-scene svg{shape-rendering:crispEdges;image-rendering:pixelated}
.ping-body{animation:ping-bob .3s steps(2) infinite}
.ping-hands{animation:ping-hands .2s steps(2) infinite}
.ping-keys{animation:ping-keys .2s steps(2) infinite}
.ping-l1{animation:ping-l1 9s steps(1) infinite}
.ping-l2{animation:ping-l2 9s steps(1) infinite}
.ping-l3{animation:ping-l3 9s steps(1) infinite}
.ping-l4{animation:ping-l4 9s steps(1) infinite}
.ping-smoke{animation:ping-smoke 9s steps(1) infinite}
.ping-fire{animation:ping-fire 9s steps(1) infinite}
.ping-flame{animation:ping-flicker .3s steps(2) infinite}
@media (prefers-reduced-motion: reduce){.ping-body,.ping-hands,.ping-keys,.ping-flame{animation:none}}
`;

const Rects = ({ list }: { list: Px[] }) => (
  <>
    {list.map((p, i) => (
      <rect key={i} x={p.x} y={p.y} width={5} height={5} fill={p.fill} />
    ))}
  </>
);

export function PingScene() {
  return (
    <div
      className="ping-scene"
      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <style>{css}</style>
      <svg
        width={216}
        height={144}
        viewBox="0 0 180 120"
        role="img"
        aria-label="Ping, la mascota, teclea sin parar en su monitor hasta que el monitor empieza a echar humo y acaba ardiendo"
      >
        <g aria-hidden="true">
          <Rects list={lDesk} />
          <g className="ping-body"><Rects list={lPerson} /></g>
          <Rects list={lMonitor} />
          <g className="ping-l1"><rect x={100} y={40} width={35} height={5} fill="#4ADE80" /></g>
          <g className="ping-l2"><rect x={100} y={50} width={45} height={5} fill="#4ADE80" /></g>
          <g className="ping-l3"><rect x={110} y={60} width={30} height={5} fill="#86EFAC" /></g>
          <g className="ping-l4"><rect x={100} y={70} width={40} height={5} fill="#4ADE80" /></g>
          <g className="ping-fire"><rect x={100} y={35} width={60} height={40} fill="#DC2626" fillOpacity={0.75} /></g>
          <g className="ping-keys"><Rects list={lKeys} /></g>
          <g className="ping-hands"><Rects list={lHands} /></g>
          <Rects list={lMug} />
          <g className="ping-smoke"><Rects list={lSmoke} /></g>
          <g className="ping-fire"><g className="ping-flame"><Rects list={lFire} /></g></g>
        </g>
      </svg>
      <span
        className="ping-fire"
        style={{ fontFamily: 'VT323, monospace', fontSize: 22, color: '#FDE047', height: 22, lineHeight: '22px' }}
      >
        ¡FUEGO EN EL SÓTANO!
      </span>
    </div>
  );
}

export default PingScene;
