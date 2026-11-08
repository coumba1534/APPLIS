// Mode page : une page du mushaf de Médine à la fois, ligne par ligne comme le mushaf imprimé.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SURAHS, BISMILLAH, posOf, pageFirstVerse, juzOf, loadMushaf, toArabicDigits, MushafLine, TOTAL_PAGES } from '../data/quran';

interface Props {
  page: number;
  onPage: (p: number) => void;
  markAbs: number;
  onMark: (abs: number) => void;
  paper: boolean;
}

export function PageView({ page, onPage, markAbs, onMark, paper }: Props) {
  const [pages, setPages] = useState<MushafLine[][] | null>(null);
  const [error, setError] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

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
      const available = window.innerHeight - top - nav - 64;
      if (el.scrollHeight > available && available > 200) size *= available / el.scrollHeight;
      el.style.setProperty('--mfs', `${Math.max(13, size)}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [pages, page]);

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
            return <span key={ti} class={`aya ${here === markAbs ? 'mk' : ''}`} onClick={() => onMark(here)}>{'۝' + toArabicDigits(tok)}</span>;
          }
          return <span key={ti} class={here === markAbs ? 'mk' : undefined} onClick={() => onMark(here)}>{tok}</span>;
        })}
      </div>
    );
  });

  const next = () => page < TOTAL_PAGES && onPage(page + 1);
  const prev = () => page > 1 && onPage(page - 1);

  return (
    <div
      class={`mushaf ${paper ? 'paper' : ''}`}
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
