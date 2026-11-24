import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useStore, update } from '../store';
import {
  SURAHS, JUZ_NAMES, BISMILLAH, TOTAL_PAGES, juzVerses, surahVerses, posOf, pageOf, juzOf, absOf, pageFirstVerse,
  loadArabic, loadFrench, toArabicDigits,
} from '../data/quran';
import { toast } from '../ui';
import { PageView } from './PageView';
import { ColoredAyah } from './QuranText';
import { setTheme } from '../theme';

export const SCRIPTS = [
  { id: 'medine', font: '"KFGQPC Hafs"', name: 'Mushaf de Médine', desc: 'Écriture officielle du Complexe Roi Fahd', text: 'ar-hafs' as const, size: 2 },
  { id: 'classique', font: '"Scheherazade New"', name: 'Classique', desc: 'Proche du mushaf de Médine' },
  { id: 'moderne', font: '"Noto Naskh Arabic"', name: 'Moderne posée', desc: 'Lettres nettes, très lisible', spacing: 2.4, size: -2 },
];

/** Tailles du texte proposées en mode défilement (en pixels). */
const SIZES = [18, 20, 23, 26, 29, 32, 36, 40, 44];
const nearestLevel = (size: number) => SIZES.reduce((best, v, i) => (Math.abs(v - size) < Math.abs(SIZES[best] - size) ? i : best), 0);

export type ReaderTarget = { mode: 'juz'; juz: number } | { mode: 'sura'; sura: number } | { mode: 'page'; page: number };

/** Versets (numéros absolus) couverts par une cible. */
function versesOf(t: ReaderTarget): [number, number] {
  if (t.mode === 'juz') return juzVerses(t.juz);
  if (t.mode === 'sura') return surahVerses(t.sura);
  return [pageFirstVerse(t.page), t.page < TOTAL_PAGES ? pageFirstVerse(t.page + 1) - 1 : 6236];
}

export function Reader({ target, setTarget, onTitle, start = 'resume' }: {
  target: ReaderTarget; setTarget: (t: ReaderTarget) => void; onTitle: (t: [string, string]) => void;
  /** 'resume' : reprendre au dernier verset lu ; 'bookmark' : aller au marque-page. */
  start?: 'resume' | 'bookmark';
}) {
  const s = useStore();
  const prefs = s.reader;
  const layout = prefs.layout ?? 'scroll';
  const script = SCRIPTS.find((x) => x.id === prefs.script) ?? SCRIPTS[0];
  const textKind = script.text ?? 'ar';
  const [ar, setAr] = useState<{ kind: string; data: string[][] } | null>(null);
  const [fr, setFr] = useState<string[][] | null>(null);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(false);
  /** Mode focus (mode page) : on masque tout sauf le mushaf. */
  const [focusMode, setFocusMode] = useState(false);
  /** Verset à afficher en haut de l'écran après un changement de mode (numéro absolu). */
  const [focus, setFocus] = useState<number | null>(() => (start === 'resume' ? s.readerAbs : null));
  const markAbs = s.bookmark ? absOf(s.bookmark.s, s.bookmark.n) : -1;

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  useEffect(() => {
    if (layout !== 'scroll') return;
    loadArabic(textKind).then((data) => setAr({ kind: textKind, data })).catch(() => setError(true));
  }, [textKind, layout]);
  useEffect(() => { if (prefs.french && !fr) loadFrench().then(setFr).catch(() => toast('La traduction n\'a pas pu être chargée.')); }, [prefs.french]);

  // En mode page, on affiche une page : celle du marque-page s'il est dans la portion choisie, sinon la première.
  const pageMode = layout === 'page';
  let page = 1;
  if (target.mode === 'page') page = target.page;
  else {
    const [a0, b0] = versesOf(target);
    page = pageOf(markAbs >= a0 && markAbs <= b0 ? markAbs : a0);
  }
  const shown: ReaderTarget = pageMode ? { mode: 'page', page } : target.mode === 'page' ? { mode: 'juz', juz: juzOf(pageFirstVerse(target.page)) } : target;
  const [a, b] = versesOf(shown);

  // Défilement continu : on affiche une suite de juz [lo, hi], qui s'allonge quand on arrive en haut ou en bas.
  const winKey = `${shown.mode}-${a}`;
  const fresh = () => {
    const ja = juzOf(a), jf = focus !== null ? juzOf(focus) : ja;
    // Reprise de lecture loin du juz choisi : on part directement de là où on s'était arrêté.
    // Le juz précédent est déjà là : on peut se placer précisément et remonter sans attendre.
    if (Math.abs(jf - ja) > 1) return { key: winKey, lo: Math.max(1, jf - 1), hi: jf };
    return { key: winKey, lo: Math.max(1, Math.min(ja, jf) - 1), hi: Math.max(ja, jf) };
  };
  const [winState, setWin] = useState(fresh);
  const win = winState.key === winKey ? winState : fresh();
  /** Hauteur et position avant d'ajouter un juz au-dessus, pour ne pas faire sauter la lecture. */
  const prepend = useRef<{ h: number; y: number } | null>(null);

  useEffect(() => {
    if (shown.mode === 'page') {
      const first = posOf(a);
      onTitle([`Page ${shown.page} · ${SURAHS[first.s - 1][1]}`, `Juz ${juzOf(a)} · ${JUZ_NAMES[juzOf(a) - 1]}`]);
    }
  }, [shown.mode, a]);

  // Mode page : on masque le titre de l'écran pour laisser toute la place au mushaf.
  useEffect(() => {
    document.body.classList.toggle('immersive', pageMode);
    if (!pageMode) setFocusMode(false);
    return () => document.body.classList.remove('immersive');
  }, [pageMode]);

  // Défilement : en venant du mode page, se placer sur le même verset ;
  // sinon aller au marque-page quand il est dans la portion affichée.
  useLayoutEffect(() => {
    if (pageMode || !ar || ar.kind !== textKind) return;
    if (focus !== null) {
      const { s: fs, n: fn } = posOf(focus);
      const el = document.getElementById(`v${fs}-${fn}`);
      setFocus(null);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1600);
        return;
      }
    }
    // Le marque-page s'il est dans le juz ou la sourate choisis, sinon leur début.
    if (markAbs >= a && markAbs <= b) {
      const el = document.getElementById(`v${s.bookmark!.s}-${s.bookmark!.n}`);
      if (el) { el.scrollIntoView({ block: 'center' }); return; }
    }
    const { s: ss, n: sn } = posOf(a);
    const head = a === juzVerses(juzOf(a))[0] ? document.getElementById(`j${juzOf(a)}`) : sn === 1 ? document.getElementById(`s${ss}`) : null;
    const el = head ?? document.getElementById(`v${ss}-${sn}`);
    if (!el || (juzOf(a) === 1 && a === 1)) { window.scrollTo(0, 0); return; }
    el.scrollIntoView({ block: 'start' });
  }, [ar, a, pageMode, focus]);

  // Après l'ajout d'un juz au-dessus : garder le même verset sous les yeux.
  useLayoutEffect(() => {
    const p = prepend.current;
    if (!p) return;
    prepend.current = null;
    window.scrollTo(0, p.y + (document.documentElement.scrollHeight - p.h));
  }, [win.lo]);

  // En défilement : retenir le verset en haut de l'écran (pour les menus et le changement de mode).
  const [here, setHere] = useState<number | null>(null);
  useEffect(() => {
    if (pageMode) return;
    let queued = false;
    let saveTimer: number | undefined;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const v = topVisibleVerse();
        setHere(v);
        // Ajouter le juz suivant (ou précédent) quand on approche du bas (ou du haut).
        const doc = document.documentElement;
        if (doc.scrollHeight - window.scrollY - window.innerHeight < 1500 && win.hi < 30) setWin({ ...win, hi: win.hi + 1 });
        else if (window.scrollY < 600 && win.lo > 1 && !prepend.current && v !== null) {
          prepend.current = { h: doc.scrollHeight, y: window.scrollY };
          setWin({ ...win, lo: win.lo - 1 });
        }
        // Retenir le verset lu, pour reprendre au même endroit à la réouverture.
        if (v !== null) { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => update({ readerAbs: v }), 500); }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pageMode, a, ar, win.lo, win.hi, win.key]);

  /** Premier verset visible sous la barre d'outils, en mode défilement. */
  const topVisibleVerse = () => {
    const limit = (document.querySelector('.tools')?.getBoundingClientRect().bottom ?? 0) + 4;
    for (const el of document.querySelectorAll<HTMLElement>('.verse[id]')) {
      // Un verset dont il ne reste qu'un bout visible sous la barre ne compte pas.
      if (el.getBoundingClientRect().bottom > limit + 40) {
        const [vs, vn] = el.id.slice(1).split('-').map(Number);
        return absOf(vs, vn);
      }
    }
    return null;
  };

  const style = {
    '--qf': `${script.font}, "Scheherazade New", serif`,
    '--qs': `${prefs.size + (script.size ?? 0)}px`,
    '--lh': String(prefs.spacing ?? script.spacing ?? 2.1),
  };
  const setPrefs = (p: Partial<typeof prefs>) => update({ reader: { ...prefs, ...p } });
  const level = nearestLevel(prefs.size);
  const toggleFocus = () => {
    const on = !focusMode;
    setFocusMode(on);
    if (on) {
      window.scrollTo(0, 0);
      if (!s.focusHintSeen) { toast('Mode focus · touchez la page pour revenir'); update({ focusHintSeen: true }); }
    }
  };
  useEffect(() => {
    document.body.classList.toggle('focus', focusMode);
    return () => document.body.classList.remove('focus');
  }, [focusMode]);

  // Fenêtre de réglages : on peut la fermer en la faisant glisser vers le bas.
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number; t: number } | null>(null);
  const onSheetTouchStart = (e: TouchEvent) => {
    const el = sheet.current;
    if (!el || el.scrollTop > 0) return; // on fait défiler le contenu, pas la fenêtre
    drag.current = { y: e.touches[0].clientY, dy: 0, t: Date.now() };
  };
  const onSheetTouchMove = (e: TouchEvent) => {
    const d = drag.current, el = sheet.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    if (d.dy > 0) {
      e.preventDefault();
      el.style.transition = 'none';
      el.style.transform = `translateY(${d.dy}px)`;
    }
  };
  const onSheetTouchEnd = () => {
    const d = drag.current, el = sheet.current;
    drag.current = null;
    if (!d || !el) return;
    const fast = d.dy > 40 && d.dy / (Date.now() - d.t) > 0.6;
    el.style.transition = 'transform .22s ease-out';
    if (d.dy > el.offsetHeight * 0.25 || fast) {
      el.style.transform = 'translateY(100%)';
      window.setTimeout(() => setPanel(false), 200);
    } else el.style.transform = '';
  };

  const removeBookmark = () => { update({ bookmark: null }); toast('Marque-page retiré'); };
  const mark = (abs: number) => {
    // Sur le verset déjà marqué, le même geste retire le marque-page.
    if (abs === markAbs) { removeBookmark(); return; }
    const { s: si, n } = posOf(abs);
    update({ bookmark: { s: si, n } });
    toast(`Marque-page posé : ${SURAHS[si - 1][1]}, verset ${n} (page ${pageOf(abs)})`);
  };

  const go = (t: ReaderTarget) => { setTarget(t); window.scrollTo(0, 0); };
  const toPageOr = (t: ReaderTarget) => go(pageMode ? { mode: 'page', page: pageOf(versesOf(t)[0]) } : t);
  const setLayout = (l: 'scroll' | 'page') => {
    if (l === layout) return;
    // Rester au même endroit du Coran en changeant de mode.
    if (l === 'page') {
      const v = topVisibleVerse() ?? a;
      setTarget({ mode: 'page', page: pageOf(v) });
      window.scrollTo(0, 0);
    } else {
      // Le marque-page s'il est sur cette page, sinon le premier verset de la page.
      const v = markAbs >= a && markAbs <= b ? markAbs : a;
      setFocus(v);
      setTarget({ mode: 'juz', juz: juzOf(v) });
    }
    setPrefs({ layout: l });
  };

  const rows = [];
  if (!pageMode && ar && ar.kind === textKind) {
    let pg = 0, sura = 0;
    const from = juzVerses(win.lo)[0], to = juzVerses(win.hi)[1];
    for (let i = from; i <= to; i++) {
      const { s: si, n } = posOf(i);
      const j = juzOf(i);
      if (i === juzVerses(j)[0]) rows.push(<div class="juzmark" id={`j${j}`} key={`j${j}`}><span>Juz {j} · {JUZ_NAMES[j - 1]}</span></div>);
      if (si !== sura) {
        sura = si;
        const m = SURAHS[si - 1];
        rows.push(n === 1
          ? <div class="sura" id={`s${si}`} key={`s${si}`}><div class="frame">سورة {m[0]}</div><small>Sourate {si} · {m[1]} · {m[2]} · {m[3]} versets</small></div>
          : <div class="sura" key={`s${si}`}><small>Sourate {si} · {m[1]} · suite, à partir du verset {n}</small></div>);
        if (n === 1 && si !== 1 && si !== 9) rows.push(<div class="bism" key={`b${si}`}><ColoredAyah text={BISMILLAH} s={1} n={1} /></div>);
      }
      const p = pageOf(i);
      if (p !== pg) { pg = p; rows.push(<div class="pagemark" key={`p${p}`}>Page {p}</div>); }
      rows.push(
        <button key={i} id={`v${si}-${n}`} class={`verse ${i === markAbs ? 'marked' : ''}`} aria-label={`Sourate ${si}, verset ${n}`} onClick={() => mark(i)}>
          <span class="ar"><ColoredAyah text={ar.data[si - 1][n - 1]} s={si} n={n} />{' '}
            {script.id === 'medine' ? <span class="num hafs">{'۝' + toArabicDigits(n)}</span> : <span class="num">﴿{toArabicDigits(n)}﴾</span>}
          </span>
          {prefs.french && fr && <span class="fr"><b>{n}</b>{fr[si - 1][n - 1]}</span>}
        </button>,
      );
    }
  }

  // Les menus suivent le verset en cours de lecture.
  const reading = !pageMode && here !== null ? here : a;
  const curJuz = pageMode ? juzOf(a) : juzOf(reading);
  const curSura = pageMode ? posOf(a).s : posOf(reading).s;
  useEffect(() => {
    if (pageMode) return;
    const j = juzOf(reading), { s: rs } = posOf(reading);
    onTitle([`Juz ${j} · ${JUZ_NAMES[j - 1]}`, `${SURAHS[rs - 1][1]} · page ${pageOf(reading)}`]);
  }, [pageMode, reading]);

  return (
    <>
      <div class="tools">
        <div class="line">
          <select aria-label="Choisir un juz" value={curJuz} onChange={(e) => toPageOr({ mode: 'juz', juz: +(e.target as HTMLSelectElement).value })}>
            {JUZ_NAMES.map((n, i) => <option value={i + 1}>Juz {i + 1} · {n}</option>)}
          </select>
          <select aria-label="Choisir une sourate" value={curSura} onChange={(e) => toPageOr({ mode: 'sura', sura: +(e.target as HTMLSelectElement).value })}>
            {SURAHS.map((x, i) => <option value={i + 1}>{i + 1}. {x[1]} · {x[0]}</option>)}
          </select>
          {pageMode && (
            <select aria-label="Choisir une page" class="page-sel" value={page} onChange={(e) => go({ mode: 'page', page: +(e.target as HTMLSelectElement).value })}>
              {Array.from({ length: TOTAL_PAGES }, (_, i) => <option value={i + 1}>p. {i + 1}</option>)}
            </select>
          )}
        </div>
        <div class="line">
          <div class="seg" role="group" aria-label="Mode de lecture">
            <button aria-pressed={!pageMode} onClick={() => setLayout('scroll')}>Défilement</button>
            <button aria-pressed={pageMode} onClick={() => setLayout('page')}>Page</button>
          </div>
          {!pageMode && (
            <div class="seg" role="group" aria-label="Traduction">
              <button aria-pressed={prefs.french} onClick={() => setPrefs({ french: !prefs.french })}>+ Français</button>
            </div>
          )}
          {pageMode && <button class="ghost" aria-label="Réglages de lecture" onClick={() => setPanel(true)}>Aa</button>}
          {s.bookmark && (
            <span class="mark-info">
              Marque-page : {SURAHS[s.bookmark.s - 1][1]} {s.bookmark.n}
              <button class="mark-x" aria-label="Retirer le marque-page" onClick={removeBookmark}>✕</button>
            </span>
          )}
        </div>
      </div>

      {!pageMode && <button class="fab" aria-label="Réglages de lecture" aria-expanded={panel} onClick={() => setPanel(true)}>Aa</button>}

      {panel && (
        <div class="sheet-backdrop" onClick={() => setPanel(false)}>
          <div class="sheet" role="dialog" aria-label="Réglages de lecture" ref={sheet} onClick={(e) => e.stopPropagation()}
            onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd}>
            <div class="sheet-head">
              <b>Réglages de lecture</b>
              <button class="close" aria-label="Fermer" onClick={() => setPanel(false)}>✕</button>
            </div>
            <div class="prow"><span>Mode de lecture</span><div class="seg">
              <button aria-pressed={!pageMode} onClick={() => setLayout('scroll')}>Défilement</button>
              <button aria-pressed={pageMode} onClick={() => setLayout('page')}>Page</button>
            </div></div>
            {pageMode ? (
              <p class="note">En mode page, le Coran s'affiche exactement comme le mushaf de Médine imprimé : 15 lignes par page, dans l'écriture du Complexe Roi Fahd. Glissez vers la droite pour la page suivante.</p>
            ) : (
              <>
                <b style="font-size:14px">Écriture</b>
                <div class="scripts">
                  {SCRIPTS.map((x) => (
                    <button class="script" aria-pressed={x.id === script.id} onClick={() => setPrefs({ script: x.id, spacing: null })}>
                      <span class="smp" style={{ fontFamily: x.font }}><ColoredAyah text={BISMILLAH} s={1} n={1} /></span><b>{x.name}</b><small>{x.desc}</small>
                    </button>
                  ))}
                </div>
                <div class="size-box">
                  <div class="prow"><span>Taille du texte</span>
                    <div class="size-ctl">
                      <button class="ghost" aria-label="Texte plus petit" disabled={level === 0} onClick={() => setPrefs({ size: SIZES[level - 1] })}>A−</button>
                      <span class="size-val" aria-live="polite">{level + 1} / {SIZES.length}</span>
                      <button class="ghost" aria-label="Texte plus grand" disabled={level === SIZES.length - 1} onClick={() => setPrefs({ size: SIZES[level + 1] })}>A+</button>
                    </div>
                  </div>
                  <div class="size-dots" aria-hidden="true">{SIZES.map((_, i) => <i class={i <= level ? 'on' : ''} />)}</div>
                  <div class="size-preview" style={{ fontFamily: `${script.font}, "Scheherazade New", serif`, fontSize: `${prefs.size + (script.size ?? 0)}px` }}>{BISMILLAH}</div>
                </div>
                <div class="prow"><span>Espacement des lignes</span><div class="seg">
                  <button aria-pressed={(prefs.spacing ?? script.spacing ?? 2.1) < 2.5} onClick={() => setPrefs({ spacing: 2.1 })}>Normal</button>
                  <button aria-pressed={(prefs.spacing ?? script.spacing ?? 2.1) >= 2.5} onClick={() => setPrefs({ spacing: 2.6 })}>Aéré</button>
                </div></div>
                <div class="prow"><span>Traduction française</span><div class="seg">
                  <button aria-pressed={!prefs.french} onClick={() => setPrefs({ french: false })}>Non</button>
                  <button aria-pressed={prefs.french} onClick={() => setPrefs({ french: true })}>Oui</button>
                </div></div>
              </>
            )}
            <div class="prow"><span>Apparence</span><div class="seg">
              <button aria-pressed={(s.theme ?? 'auto') === 'light'} onClick={() => setTheme('light')}>Clair</button>
              <button aria-pressed={s.theme === 'dark'} onClick={() => setTheme('dark')}>Sombre</button>
              <button aria-pressed={(s.theme ?? 'auto') === 'auto'} onClick={() => setTheme('auto')}>Auto</button>
            </div></div>
            <div class="prow"><span>Fond de page</span><div class="seg">
              <button aria-pressed={!prefs.paper} onClick={() => setPrefs({ paper: false })}>Clair</button>
              <button aria-pressed={prefs.paper} onClick={() => setPrefs({ paper: true })}>Papier</button>
            </div></div>
            <button class="btn teal" onClick={() => setPanel(false)}>Terminé</button>
          </div>
        </div>
      )}

      {pageMode ? (
        <PageView page={page} onPage={(p) => go({ mode: 'page', page: p })} markAbs={markAbs} onMark={mark} paper={prefs.paper}
          focus={focusMode} onToggleFocus={toggleFocus} />
      ) : (
        <>
          <div class={`reader ${prefs.paper ? 'paper' : ''}`} style={style}>
            {error ? <p class="loading">Le texte n'a pas pu être chargé. Vérifiez la connexion puis rouvrez cet onglet.</p>
              : rows.length === 0 ? <p class="loading">Chargement du Coran…</p> : rows}
          </div>
        </>
      )}
      <p class="credit">Mushaf de Médine et écriture officielle : Complexe du Roi Fahd (KFGQPC) · Autres écritures : The Noble Qur'an Encyclopedia · Traduction : Muhammad Hamidullah (tanzil.net)</p>
    </>
  );
}
