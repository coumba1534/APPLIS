import { useLayoutEffect, useRef } from 'preact/hooks';
import { SURAHS } from '../data/quran';

/**
 * En-tête de sourate (unwan) : bandeau vert à rinceaux dorés (dessinés pour l'appli), cartouche sable,
 * et « سورة » + le nom écrits avec la police calligraphique des noms de sourates de quran.com (licence MIT).
 * Dans cette police, « 018 » donne le nom calligraphié de la sourate 18 et « surah » le mot سورة.
 */
const W = 600;

function Flower({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g class="uw-gold-fill">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse cx={x} cy={y - r * 0.55} rx={r * 0.32} ry={r * 0.55} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.22} class="uw-band-fill" />
    </g>
  );
}

/** Rinceaux : deux volutes de part et d'autre d'une fleur, à gauche (sens 1) ou à droite (sens -1). */
function Vine({ x0, s }: { x0: number; s: 1 | -1 }) {
  const cx = x0 + 75 * s;
  const d = `M${x0 + 8 * s} 42 C${x0 + 25 * s} 18 ${x0 + 48 * s} 18 ${cx - 14 * s} 30 `
    + `M${x0 + 8 * s} 42 C${x0 + 25 * s} 66 ${x0 + 48 * s} 66 ${cx - 14 * s} 54 `
    + `M${cx + 14 * s} 30 C${cx + 40 * s} 16 ${x0 + 140 * s} 22 ${x0 + 150 * s} 42 `
    + `M${cx + 14 * s} 54 C${cx + 40 * s} 68 ${x0 + 140 * s} 62 ${x0 + 150 * s} 42`;
  const curls: [number, number][] = [[x0 + 30 * s, 25], [x0 + 30 * s, 59], [x0 + 118 * s, 23], [x0 + 118 * s, 61]];
  return (
    <g>
      <path d={d} class="uw-gold-line" stroke-width="1.8" stroke-linecap="round" />
      {curls.map(([x, y]) => <path d={`M${x} ${y} q${6 * s} -8 ${12 * s} 0 q${-4 * s} 6 ${-9 * s} 2`} class="uw-gold-line" stroke-width="1.4" />)}
      <Flower x={cx} y={42} r={15} />
      <Flower x={x0 + 8 * s} y={42} r={6} />
    </g>
  );
}

/** Cartouche en pourcentage de la largeur du cadre : le nom y est centré et le remplit. */
const BOX_W = (196 / W) * 100; // en cqw
const MAX_FS = 7.4; // taille maximale du nom, en cqw (limitée par la hauteur du cartouche)

export function Unwan({ s }: { s: number }) {
  const name = useRef<HTMLSpanElement>(null);
  // Le nom est du texte HTML (Safari n'applique pas les ligatures de la police dans un dessin SVG).
  // Une fois la police chargée, on mesure le nom et on règle sa taille pour remplir le cartouche.
  useLayoutEffect(() => {
    const el = name.current;
    if (!el) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      // Police introuvable (hors connexion la toute première fois, par exemple) : le nom en écriture simple.
      if (document.fonts && !document.fonts.check('40px surahnames')) {
        el.textContent = `سورة ${SURAHS[s - 1][0]}`;
        el.style.fontFamily = 'var(--arabic)';
      }
      el.style.fontSize = '100px';
      const w = el.getBoundingClientRect().width;
      if (!w) return;
      el.style.fontSize = `${Math.min(MAX_FS, (BOX_W * 100) / w)}cqw`;
      el.style.visibility = 'visible';
    };
    const ready = document.fonts?.load('40px surahnames') ?? Promise.resolve();
    ready.then(fit).catch(fit);
    return () => { alive = false; };
  }, [s]);
  return (
    <div class="unwan" role="img" aria-label={`Sourate ${s} · ${SURAHS[s - 1][1]} · ${SURAHS[s - 1][0]}`}>
      <svg viewBox={`0 0 ${W} 84`} aria-hidden="true">
        <rect x="1" y="1" width={W - 2} height="82" rx="3" class="uw-band-fill uw-gold-line" stroke-width="2" />
        <rect x="6" y="6" width={W - 12} height="72" rx="2" class="uw-gold-line" stroke-width=".8" />
        <Vine x0={14} s={1} />
        <Vine x0={W - 14} s={-1} />
        <circle cx="184" cy="42" r="5" class="uw-gold-fill" />
        <circle cx="416" cy="42" r="5" class="uw-gold-fill" />
        <path d="M190 42 C210 10 232 8 252 8 H348 C368 8 390 10 410 42 C390 74 368 76 348 76 H252 C232 76 210 74 190 42 Z" class="uw-cart-fill uw-gold-line" stroke-width="2" />
        <path d="M200 42 C218 15 238 14 254 14 H346 C362 14 382 15 400 42 C382 69 362 70 346 70 H254 C238 70 218 69 200 42 Z" class="uw-gold-line" stroke-width=".8" />
      </svg>
      <span ref={name} class="uw-name" aria-hidden="true" translate={false}>{String(s).padStart(3, '0')}surah</span>
    </div>
  );
}
