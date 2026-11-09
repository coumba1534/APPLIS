// Mode page : une page du mushaf de Médine à la fois, ligne par ligne comme le mushaf imprimé.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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

export function PageView({ page, onPage, markAbs, onMark, paper, focus, onToggleFocus }: Props) {
  const [pages, setPages] = useState<MushafLine[][] | null>(null);
  const [error, setError] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
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

  // Taille du texte : la page entière doit tenir à l'écran (15 lignes) et chaque ligne dans la largeur.
  // Toutes les lignes d'une page gardent la même taille, comme dans le mushaf imprimé.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !pages) return;
    const fit = () => {
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
      const footer = el.parentElement?.querySelector('.mfoot')?.getBoundingClientRect().height ?? 48;
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
  }, [pages, page, focus]);

  if (error) return <p class="loading">Les pages n'ont pas pu être chargées. Vérifiez la connexion puis rouvrez cet onglet.</p>;
  if (!pages) return <p class="loading">Chargement du mushaf…</p>;

  const first = pageFirstVerse(page);
  const startRef = posOf(first);
  const special = page <= 2; // Al-Fatiha et le début d'Al-Baqara : lignes centrées
  let abs = first;

  const lines = pages[page - 1].map((line, li) => {
    if (line[0] === 'H') {
      const s = line[1] as number;
      return <div class="mline head" key={li}><span class="frame">سورة {SURAHS[s - 1][0]}</span></div>;
    }
    if (line[0] === 'B') return <div class="mline bism-line" key={li}>{BISMILLAH}</div>;
    return (
      <div class={`mline text ${special ? 'center' : ''}`} key={li}>
        {line.map((tok, ti) => {
          const here = abs;
          if (typeof tok === 'number') {
            abs++;
            return <span key={ti} data-abs={here} class={`aya ${here === markAbs ? 'mk' : ''}`}>{'۝' + toArabicDigits(tok)}</span>;
          }
          return <span key={ti} data-abs={here} class={here === markAbs ? 'mk' : undefined}>{tok}</span>;
        })}
      </div>
    );
  });

  const next = () => page < TOTAL_PAGES && onPage(page + 1);
  const prev = () => page > 1 && onPage(page - 1);

  return (
    <div
      class={`mushaf ${paper ? 'paper' : ''} ${focus ? 'focus' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { if (press.current) clearTimeout(press.current.timer); press.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => {
        const t0 = touch.current; touch.current = null;
        if (!t0) return;
        const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
        // Comme un mushaf : glisser vers la droite tourne la page vers la suivante.
        if (Math.abs(dx) > 60 && Math.abs(dy) < 60) (dx > 0 ? next : prev)();
      }}
    >
      <div class="mpage" ref={box} dir="rtl">{lines}</div>
      <div class="mfoot">
        <button class="ghost" disabled={page >= TOTAL_PAGES} onClick={next}>‹ Suivante</button>
        <span class="minfo"><b>{page}</b><small>Juz {juzOf(first)} · {SURAHS[startRef.s - 1][0]}</small></span>
        <button class="ghost" disabled={page <= 1} onClick={prev}>Précédente ›</button>
      </div>
    </div>
  );
}
