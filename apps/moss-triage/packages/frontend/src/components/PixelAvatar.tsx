// PixelAvatar: avatares pixel art originales para el equipo de soporte de Moss Triage.
// 12x12 píxeles. No representan a nadie real: solo varían pelo, gafas, barba y ropa.
// Uso: <PixelAvatar memberId="ST01" size={32} />  (o <PixelAvatar look={...} />)

type Look = {
  hair: 'long' | 'short';
  hairColor: string;
  skin: string;
  shirt: string;
  glasses?: boolean;
  beard?: boolean;
  headset?: boolean;
};

// Un aspecto por persona del equipo (support_team.member_id). Si llega un id desconocido, se usa DEFAULT.
export const TEAM_LOOKS: Record<string, Look> = {
  ST01: { hair: 'long', hairColor: '#3F2A1D', skin: '#E0AC85', shirt: '#7C3AED', glasses: true, headset: true },
  ST02: { hair: 'long', hairColor: '#111827', skin: '#C68A62', shirt: '#0EA5E9' },
  ST03: { hair: 'long', hairColor: '#D6A84E', skin: '#F1C7A5', shirt: '#16A34A', headset: true },
  ST04: { hair: 'short', hairColor: '#1F2937', skin: '#D9A07A', shirt: '#F97316', beard: true, headset: true },
  ST05: { hair: 'short', hairColor: '#B45309', skin: '#F3D2B8', shirt: '#DB2777', glasses: true },
};
const DEFAULT: Look = { hair: 'short', hairColor: '#4B5563', skin: '#D9A07A', shirt: '#4ADE80' };

const LONG = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '.HHSSSSSSHH.',
  '.HSSSSSSSSH.',
  '.HSEESSEESH.',
  '.HSSSSSSSSH.',
  '.HSSSMMSSSH.',
  '.HHSSSSSSHH.',
  '.HH.SSSS.HH.',
  '.HCCCCCCCCH.',
  'CCCCCCCCCCCC',
  'CCCCCCCCCCCC',
];
const SHORT = [
  '..HHHHHHHH..',
  '.HHHHHHHHHH.',
  '.HSSSSSSSSH.',
  '..SSSSSSSS..',
  '..SEESSEES..',
  '..SSSSSSSS..',
  '..SSSMMSSS..',
  '...SSSSSS...',
  '....SSSS....',
  '..CCCCCCCC..',
  '.CCCCCCCCCC.',
  'CCCCCCCCCCCC',
];

function buildMap(look: Look): string[] {
  const m = (look.hair === 'long' ? LONG : SHORT).slice();
  if (look.glasses) m[4] = look.hair === 'long' ? '.HGEGSSGEGH.' : '..GEGSSGEG..';
  if (look.beard) {
    m[6] = '..BBBMMBBB..';
    m[7] = '...BBBBBB...';
  }
  if (look.headset) {
    m[3] = 'K' + m[3].slice(1, 11) + 'K';
    m[4] = 'K' + m[4].slice(1, 11) + 'K';
    m[5] = 'K' + m[5].slice(1, 11) + 'K';
    m[6] = m[6].slice(0, 10) + 'KK';
  }
  return m;
}

export function PixelAvatar({
  memberId,
  look,
  size = 32,
  title,
}: {
  memberId?: string;
  look?: Look;
  size?: number;
  title?: string;
}) {
  const l = look ?? (memberId ? TEAM_LOOKS[memberId] : undefined) ?? DEFAULT;
  const colors: Record<string, string> = {
    H: l.hairColor, S: l.skin, E: '#111827', M: '#9F1239', C: l.shirt,
    G: '#CBD5E1', B: l.hairColor, K: '#1F2937',
  };
  const rects: JSX.Element[] = [];
  buildMap(l).forEach((row, y) =>
    row.split('').forEach((c, x) => {
      if (colors[c]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[c]} />);
    }),
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ imageRendering: 'pixelated', borderRadius: 6, background: 'var(--panel-2, #0B110E)', flexShrink: 0 }}
    >
      {rects}
    </svg>
  );
}

export default PixelAvatar;
