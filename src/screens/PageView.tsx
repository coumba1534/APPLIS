// Mode page : une page du mushaf de Médine à la fois, ligne par ligne comme le mushaf imprimé.
// Les pages glissent sous le doigt, comme dans un vrai mushaf : la page suivante arrive par la gauche.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { isAllah, isRabb, RABB_EXCEPTIONS } from '../data/divine';
import { ColoredAyah } from './QuranText';
import { SURAHS, BISMILLAH, posOf, pageFirstVerse, juzOf, loadMushaf, toArabicDigits, MushafLine, TOTAL_PAGES } from '../data/quran';

interface Props {
  page: number;
  onPage: (p: number) => void;
  markAbs: number;
  onMark: (abs: number) => void;
  paper: boolean;
  /** Mode focus : seul le mushaf reste à l'écran. */
  focus: boolean;
  onToggleFocus: () => void;
}

/** Durée du glissement d'une page (ms). */
const TURN_MS = 280;
/** Écart entre deux pages pendant le glissement (le fin trait de séparation). */
const GAP = 2;

export function PageView({ page, onPage, markAbs, onMark, paper, focus, onToggleFocus }: Props) {
  const [pages, setPages] = useState<MushafLine[][] | null>(null);
  const [error, setError] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const turning = useRef(false);

  // Toucher brièvement la page : mode focus. Appui long sur un verset : marque-page.
  const press = useRef<{ x: number; y: number; t: number; timer: number; long: boolean; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) { press.current = null; return; }
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-abs]');
    const p = { x: e.clientX, y: e.clientY, t: Date.now(), timer: 0, long: false, moved: false };
    if (target) p.timer = window.setTimeout(() => { p.long = true; onMark(Number(target.dataset.abs)); navigator.vibrate?.(15); }, 550);
    press.current = p;
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { p.moved = true; clearTimeout(p.timer); }
  };
  const onPointerUp = () => {
    const p = press.current; press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (!p.long && !p.moved && Date.now() - p.t < 400) onToggleFocus();
  };

  useEffect(() => { loadMushaf().then(setPages).catch(() => setError(true)); }, []);

  // ---- Glissement des pages ----
  // La piste contient 3 pages côte à côte : [suivante, actuelle, précédente] (sens arabe).
  // Au repos, on voit celle du milieu ; décalée vers la droite, on voit la suivante.
  const setX = (px: number, animate: boolean) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${TURN_MS}ms cubic-bezier(.2,.7,.3,1)` : 'none';
    el.style.transform = `translateX(calc(-100% - ${GAP}px + ${px}px))`;
  };
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Tourne la page : 1 = suivante (la page glisse vers la droite), -1 = précédente. */
  const turn = (dir: 1 | -1) => {
    const target = page + dir;
    if (turning.current) return;
    if (target < 1 || target > TOTAL_PAGES) { setX(0, true); return; }
    if (reduceMotion()) { onPage(target); return; }
    turning.current = true;
    const w = (viewport.current?.clientWidth ?? 0) + GAP;
    setX(dir === 1 ? w : -w, true);
    window.setTimeout(() => onPage(target), TURN_MS);
  };

  // Nouvelle page affichée : on recentre la piste sans animation (la page visible ne bouge pas).
  useLayoutEffect(() => { setX(0, false); turning.current = false; }, [page, pages]);

  const drag = useRef<{ x: number; y: number; t: number; dx: number; dir: 'h' | 'v' | null } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    if (turning.current || e.touches.length > 1) { drag.current = null; return; }
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, dir: null };
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x, dy = t.clientY - d.y;
    if (!d.dir && Math.hypot(dx, dy) > 8) d.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (d.dir !== 'h') return;
    // Au bord du mushaf (page 1 ou 604), la page résiste un peu.
    const blocked = (dx > 0 && page >= TOTAL_PAGES) || (dx < 0 && page <= 1);
    d.dx = blocked ? dx * 0.25 : dx;
    setX(d.dx, false);
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.dir !== 'h') return;
    const w = viewport.current?.clientWidth ?? 1;
    const speed = Math.abs(d.dx) / Math.max(1, Date.now() - d.t); // px/ms
    const dir: 1 | -1 = d.dx > 0 ? 1 : -1;
    const blocked = (dir === 1 && page >= TOTAL_PAGES) || (dir === -1 && page <= 1);
    if (!blocked && (Math.abs(d.dx) > w * 0.25 || (speed > 0.5 && Math.abs(d.dx) > 30))) turn(dir);
    else setX(0, true);
  };

  if (error) return <p class="loading">Les pages n'ont pas pu être chargées. Vérifiez la connexion puis rouvrez cet onglet.</p>;
  if (!pages) return <p class="loading">Chargement du mushaf…</p>;

  const first = pageFirstVerse(page);
  const startRef = posOf(first);
  const slides = [page + 1, page, page - 1];

  return (
    <div
      class={`mushaf ${paper ? 'paper' : ''} ${focus ? 'focus' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { if (press.current) clearTimeout(press.current.timer); press.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div class="mviewport" ref={viewport} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { drag.current = null; setX(0, true); }}>
        <div class="mtrack" ref={track}>
          {slides.map((p, i) => (
            <div class="mslide" key={p >= 1 && p <= TOTAL_PAGES ? p : `vide-${i}`} aria-hidden={p !== page}>
              {p >= 1 && p <= TOTAL_PAGES && <Sheet lines={pages[p - 1]} page={p} markAbs={markAbs} focus={focus} />}
            </div>
          ))}
        </div>
      </div>
      <div class="mfoot">
        <button class="ghost" disabled={page >= TOTAL_PAGES} onClick={() => turn(1)}>‹ Suivante</button>
        <span class="minfo"><b>{page}</b><small>Juz {juzOf(first)} · {SURAHS[startRef.s - 1][0]}</small></span>
        <button class="ghost" disabled={page <= 1} onClick={() => turn(-1)}>Précédente ›</button>
      </div>
    </div>
  );
}

/** Une page du mushaf, avec sa taille de texte ajustée à l'écran. */
function Sheet({ lines, page, markAbs, focus }: { lines: MushafLine[]; page: number; markAbs: number; focus: boolean }) {
  const box = useRef<HTMLDivElement>(null);

  // Taille du texte : la page entière doit tenir à l'écran (15 lignes) et chaque ligne dans la largeur.
  // Toutes les lignes d'une page gardent la même taille, comme dans le mushaf imprimé.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      if (!el.clientWidth) return;
      // 1. Largeur : la ligne la plus longue de la page doit tenir.
      let size = el.clientWidth / 16.2;
      el.style.setProperty('--mfs', `${size}px`);
      let over = 1;
      el.querySelectorAll<HTMLElement>('.mline.text').forEach((line) => { over = Math.max(over, line.scrollWidth / line.clientWidth); });
      size /= over;
      el.style.setProperty('--mfs', `${size}px`);
      // 2. Hauteur : la page entière doit tenir au-dessus du pied de page et de la barre de navigation.
      const top = el.getBoundingClientRect().top;
      const nav = document.querySelector('nav.tabs')?.getBoundingClientRect().height ?? 80;
      const footer = el.closest('.mushaf')?.querySelector('.mfoot')?.getBoundingClientRect().height ?? 48;
      const available = window.innerHeight - top - nav - footer - 28;
      if (el.scrollHeight > available && available > 200) size *= available / el.scrollHeight;
      el.style.setProperty('--mfs', `${Math.max(13, size)}px`);
    };
    fit();
    const raf = requestAnimationFrame(fit); // après l'affichage ou le masquage des menus (mode focus)
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [lines, focus]);

  const special = page <= 2; // Al-Fatiha et le début d'Al-Baqara : lignes centrées
  let abs = pageFirstVerse(page);
  let rabbInAyah = 0; // occurrences de Rabb dans le verset en cours (pour les exceptions)
  /** Vrai pour les noms d'Allah et de Rabb (sauf exceptions). */
  const divine = (w: string, verse: number) => {
    if (isAllah(w)) return true;
    if (!isRabb(w)) return false;
    rabbInAyah++;
    const { s: vs, n: vn } = posOf(verse);
    return !(RABB_EXCEPTIONS[`${vs}:${vn}`] ?? []).includes(rabbInAyah);
  };

  return (
    <div class="mpage" ref={box} dir="rtl">
      {lines.map((line, li) => {
        if (line[0] === 'H') {
          const s = line[1] as number;
          return <div class="mline head" key={li}><span class="frame">سورة {SURAHS[s - 1][0]}</span></div>;
        }
        if (line[0] === 'B') return <div class="mline bism-line" key={li}><ColoredAyah text={BISMILLAH} s={1} n={1} /></div>;
        return (
          <div class={`mline text ${special ? 'center' : ''}`} key={li}>
            {line.map((tok, ti) => {
              const here = abs;
              if (typeof tok === 'number') {
                abs++;
                rabbInAyah = 0;
                return <span key={ti} data-abs={here} class={`aya ${here === markAbs ? 'mk' : ''}`}>{'۝' + toArabicDigits(tok)}</span>;
              }
              const cls = [here === markAbs ? 'mk' : '', divine(tok, here) ? 'allah' : ''].filter(Boolean).join(' ');
              return <span key={ti} data-abs={here} class={cls || undefined}>{tok}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}
