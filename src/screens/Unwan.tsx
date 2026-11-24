import { SURAHS } from '../data/quran';

/**
 * En-tête de sourate (unwan), dessiné pour l'appli dans la tradition des mushafs :
 * cartouche central qui porte le nom, deux médaillons, panneaux d'entrelacs aux extrémités.
 * Couleurs : or sur sable (variables --uw-*), le nom écrit avec la police du mushaf de Médine.
 */
const W = 600;

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`} class="uw-ink-fill">
      <rect x={-r} y={-r} width={2 * r} height={2 * r} />
      <rect x={-r} y={-r} width={2 * r} height={2 * r} transform="rotate(45)" />
    </g>
  );
}

function Panel({ x0 }: { x0: number }) {
  const pts: [number, number][] = [[x0 + 24, 26], [x0 + 72, 26], [x0 + 48, 42], [x0 + 24, 58], [x0 + 72, 58]];
  return (
    <g>
      <rect x={x0} y={10} width={96} height={64} class="uw-panel" />
      {pts.map(([cx, cy]) => <circle cx={cx} cy={cy} r={14} class="uw-line" stroke-width="1.6" />)}
      {pts.map(([cx, cy]) => <Star x={cx} y={cy} r={4} />)}
    </g>
  );
}

export function Unwan({ s }: { s: number }) {
  const name = `سورة ${SURAHS[s - 1][0]}`;
  return (
    <svg class="unwan" viewBox={`0 0 ${W} 84`} role="img" aria-label={`Sourate ${s} · ${SURAHS[s - 1][1]}`}>
      <rect x="1.5" y="1.5" width={W - 3} height="81" rx="4" class="uw-ground uw-line" stroke-width="3" />
      <rect x="7" y="7" width={W - 14} height="70" rx="2" class="uw-line" stroke-width="1.2" />
      <Panel x0={10} />
      <Panel x0={W - 106} />
      <path d={`M106 10 V74 M${W - 106} 10 V74`} class="uw-line" stroke-width="1.2" />
      {[148, W - 148].map((cx) => (
        <g>
          <circle cx={cx} cy="42" r="21" class="uw-ground uw-line" stroke-width="2" />
          <circle cx={cx} cy="42" r="15" class="uw-line" stroke-width="1" />
          <Star x={cx} y={42} r={6} />
        </g>
      ))}
      <path d="M190 42 C205 14 225 12 245 12 H355 C375 12 395 14 410 42 C395 70 375 72 355 72 H245 C225 72 205 70 190 42 Z" class="uw-ground uw-line" stroke-width="2.4" />
      <path d="M200 42 C213 20 230 18 247 18 H353 C370 18 387 20 400 42 C387 64 370 66 353 66 H247 C230 66 213 64 200 42 Z" class="uw-line" stroke-width="1" />
      <text x="300" y="53" text-anchor="middle" class="uw-name">{name}</text>
    </svg>
  );
}
