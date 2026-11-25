import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useStore, update } from '../store';
import {
  SURAHS, JUZ_NAMES, BISMILLAH, TOTAL_PAGES, juzVerses, surahVerses, posOf, pageOf, juzOf, absOf, pageFirstVerse, hizbOf,
  loadArabic, loadFrench, toArabicDigits,
} from '../data/quran';
import { toast } from '../ui';
import { PageView } from './PageView';
import { ColoredAyah } from './QuranText';
import { setTheme } from '../theme';
import { Unwan } from './Unwan';

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
  const focusDone = useRef(false);
  /** Choix fait dans « Aller à » : on va au début de la sourate ou du juz, pas au marque-page. */
  const fromGoto = useRef(false);
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

  // Dans Lire, la barre tout-en-un remplace le titre de l'écran : toute la place va au texte.
  useEffect(() => {
    document.body.classList.add('immersive');
    return () => document.body.classList.remove('immersive');
  }, []);
  useEffect(() => { if (!pageMode) setFocusMode(false); }, [pageMode]);
  /** Fenêtre « Aller à » ouverte, et menu ⋯ d'un verset (numéro absolu). */
  const [goto, setGoto] = useState(false);
  const [verseMenu, setVerseMenu] = useState<number | null>(null);
  /** Barre flottante du bas : masquée quand on descend dans la lecture, visible quand on remonte. */
  const [floatHidden, setFloatHidden] = useState(false);
  // Mode page : la barre flottante s'efface aussi quand on descend (pour dégager « Suivante / Précédente »).
  useEffect(() => {
    if (!pageMode) return;
    let lastY = window.scrollY;
    const onScroll = () => { const y = window.scrollY; if (Math.abs(y - lastY) > 8) { setFloatHidden(y > lastY); lastY = y; } };
    setFloatHidden(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pageMode]);

  // Défilement : en venant du mode page, se placer sur le même verset ;
  // sinon aller au marque-page quand il est dans la portion affichée.
  useLayoutEffect(() => {
    if (pageMode || !ar || ar.kind !== textKind) return;
    // Le verset demandé vient d'être affiché : ne pas repartir ailleurs quand `focus` se remet à zéro.
    if (focusDone.current && focus === null) { focusDone.current = false; return; }
    // Se placer sur un élément, puis recommencer une fois la police du mushaf chargée (les hauteurs changent).
    const place = (el: Element, block: ScrollLogicalPosition) => {
      el.scrollIntoView({ block });
      const y = window.scrollY;
      document.fonts?.ready.then(() => { if (Math.abs(window.scrollY - y) < 2) el.scrollIntoView({ block }); });
    };
    if (focus !== null) {
      const { s: fs, n: fn } = posOf(focus);
      const el = document.getElementById(`v${fs}-${fn}`);
      if (el) {
        focusDone.current = true;
        setFocus(null);
        place(el, 'start');
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1600);
        return;
      }
      setFocus(null);
    }
    // Le marque-page s'il est dans le juz ou la sourate ouverts (hors « Aller à »), sinon leur début.
    const explicit = fromGoto.current;
    fromGoto.current = false;
    if (!explicit && markAbs >= a && markAbs <= b) {
      const el = document.getElementById(`v${s.bookmark!.s}-${s.bookmark!.n}`);
      if (el) { place(el, 'center'); return; }
    }
    const { s: ss, n: sn } = posOf(a);
    const head = a === juzVerses(juzOf(a))[0] ? document.getElementById(`j${juzOf(a)}`) : sn === 1 ? document.getElementById(`s${ss}`) : null;
    const el = head ?? document.getElementById(`v${ss}-${sn}`);
    if (!el || (juzOf(a) === 1 && a === 1)) { window.scrollTo(0, 0); return; }
    place(el, 'start');
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
    let lastY = window.scrollY;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = window.scrollY;
        if (Math.abs(y - lastY) > 12) { setFloatHidden(y > lastY && y > 200); lastY = y; }
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

  // Fenêtres du bas (réglages, menu d'un verset) : on peut les fermer en les faisant glisser vers le bas.
  const settingsSwipe = useSwipeClose(() => setPanel(false));
  const verseSwipe = useSwipeClose(() => setVerseMenu(null));


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

  /** Aller au marque-page, dans le mode de lecture en cours. */
  const goBookmark = () => {
    if (!s.bookmark) { toast(pageMode ? 'Pas encore de marque-page : appui long sur un verset pour en poser un' : 'Pas encore de marque-page : touchez un verset pour en poser un'); return; }
    const v = absOf(s.bookmark.s, s.bookmark.n);
    if (pageMode) { go({ mode: 'page', page: pageOf(v) }); return; }
    setFocus(v);
    setTarget({ mode: 'juz', juz: juzOf(v) });
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
          ? <div class="sura" id={`s${si}`} key={`s${si}`}><Unwan s={si} /><small>Sourate {si} · {m[1]} · {m[2]} · {m[3]} versets</small></div>
          : <div class="sura" key={`s${si}`}><small>Sourate {si} · {m[1]} · suite, à partir du verset {n}</small></div>);
        if (n === 1 && si !== 1 && si !== 9) rows.push(<div class="bism" key={`b${si}`}><ColoredAyah text={BISMILLAH} s={1} n={1} /></div>);
      }
      const p = pageOf(i);
      if (p !== pg) { pg = p; rows.push(<div class="pagemark" key={`p${p}`}>Page {p}</div>); }
      rows.push(
        <div key={i} id={`v${si}-${n}`} class={`verse ${i === markAbs ? 'marked' : ''}`} role="button" tabIndex={0} aria-label={`Sourate ${si}, verset ${n}`}
          onClick={() => mark(i)} onKeyDown={(e) => { if (e.key === 'Enter') mark(i); }}>
          <span class="vh">
            <span class="ref">{si}:{n}</span>
            {i === markAbs && <span class="vmark">Marque-page</span>}
            <button class="vmore" aria-label={`Options du verset ${si}:${n}`} onClick={(e) => { e.stopPropagation(); setVerseMenu(i); }}>⋯</button>
          </span>
          <span class="ar"><ColoredAyah text={ar.data[si - 1][n - 1]} s={si} n={n} />{' '}
            {script.id === 'medine' ? <span class="num hafs">{'۝' + toArabicDigits(n)}</span> : <span class="num">﴿{toArabicDigits(n)}﴾</span>}
          </span>
          {prefs.french && fr && <span class="fr">{fr[si - 1][n - 1]}</span>}
        </div>,
      );
    }
  }

  // Les menus suivent le verset en cours de lecture.
  const reading = !pageMode && here !== null ? here : a;
  const curJuz = pageMode ? juzOf(a) : juzOf(reading);
  const curSura = pageMode ? posOf(a).s : posOf(reading).s;
  const curPage = pageMode ? page : pageOf(reading);
  const curHizb = hizbOf(pageMode ? a : reading);
  useEffect(() => {
    if (pageMode) return;
    const j = juzOf(reading), { s: rs } = posOf(reading);
    onTitle([`Juz ${j} · ${JUZ_NAMES[j - 1]}`, `${SURAHS[rs - 1][1]} · page ${pageOf(reading)}`]);
  }, [pageMode, reading]);

  return (
    <>
      <div class="tools rbar">
        <button class="where" aria-label="Aller à une sourate, un juz ou une page" onClick={() => setGoto(true)}>
          <span class="medal">{curSura}</span>
          <span class="wtxt">
            <b>{SURAHS[curSura - 1][1]}<span class="war">{SURAHS[curSura - 1][0]}</span></b>
            <small>Page {curPage} · Juz {curJuz} · Hizb {curHizb}</small>
          </span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <button class={`ibtn ${s.bookmark ? 'on' : ''}`} aria-label={s.bookmark ? 'Aller au marque-page' : 'Marque-page'} onClick={goBookmark}>
          <svg viewBox="0 0 24 24" fill={s.bookmark ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
        </button>
        <button class="ibtn aa" aria-label="Réglages de lecture" aria-expanded={panel} onClick={() => setPanel(true)}>Aa</button>
      </div>

      <div class={`rfloat ${floatHidden ? 'hide' : ''}`} role="group" aria-label="Affichage">
        <button aria-pressed={!pageMode} onClick={() => setLayout('scroll')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M5 12h14M5 18h14" /></svg>Défilement
        </button>
        <button aria-pressed={pageMode} onClick={() => setLayout('page')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="3" width="12" height="18" rx="2" /></svg>Page
        </button>
        {!pageMode && <button aria-pressed={prefs.french} aria-label="Traduction française" onClick={() => setPrefs({ french: !prefs.french })}>FR</button>}
      </div>

      {goto && <GoTo cur={{ sura: curSura, juz: curJuz, page: curPage }} bookmark={s.bookmark}
        onClose={() => setGoto(false)}
        onBookmark={() => { setGoto(false); goBookmark(); }}
        onGo={(t) => {
          setGoto(false);
          fromGoto.current = true;
          // Une page en mode défilement : se placer sur son premier verset.
          if (t.mode === 'page' && !pageMode) { const v = pageFirstVerse(t.page); setFocus(v); setTarget({ mode: 'juz', juz: juzOf(v) }); return; }
          toPageOr(t);
        }} />}

      {verseMenu !== null && (() => {
        const v = verseMenu, { s: vs, n: vn } = posOf(v);
        const text = () => `${ar?.data[vs - 1][vn - 1] ?? ''}${fr ? `\n\n${fr[vs - 1][vn - 1]}` : ''}\n\nSourate ${SURAHS[vs - 1][1]} (${vs}), verset ${vn}`;
        const close = () => setVerseMenu(null);
        return (
          <div class="sheet-backdrop" onClick={close}>
            <div class="sheet vmenu" role="dialog" aria-label={`Verset ${vs}:${vn}`} onClick={(e) => e.stopPropagation()} {...verseSwipe}>
              <div class="sheet-head"><b>{SURAHS[vs - 1][1]} · verset {vn}</b><button class="close" aria-label="Fermer" onClick={close}>✕</button></div>
              <button class="vact" onClick={() => { mark(v); close(); }}>{v === markAbs ? 'Retirer le marque-page' : 'Poser le marque-page ici'}</button>
              <button class="vact" onClick={async () => {
                try { await navigator.clipboard.writeText(text()); toast('Verset copié'); } catch { toast("La copie n'a pas pu se faire"); }
                close();
              }}>Copier le verset{prefs.french ? ' (arabe et français)' : ''}</button>
              {typeof navigator.share === 'function' && (
                <button class="vact" onClick={async () => { try { await navigator.share({ text: text() }); } catch { /* partage annulé */ } close(); }}>Partager</button>
              )}
            </div>
          </div>
        );
      })()}

      {panel && (
        <div class="sheet-backdrop" onClick={() => setPanel(false)}>
          <div class="sheet" role="dialog" aria-label="Réglages de lecture" onClick={(e) => e.stopPropagation()} {...settingsSwipe}>
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
            <p class="credit">Mushaf de Médine et écriture officielle : Complexe du Roi Fahd (KFGQPC) · Autres écritures : The Noble Qur'an Encyclopedia · Traduction : Muhammad Hamidullah (tanzil.net) · Noms des sourates calligraphiés : police de quran.com (licence MIT)</p>
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
    </>
  );
}

/** Fenêtre « Aller à » : une sourate (avec recherche), un juz ou une page, et le marque-page. */
function GoTo({ cur, bookmark, onClose, onGo, onBookmark }: {
  cur: { sura: number; juz: number; page: number };
  bookmark: { s: number; n: number } | null;
  onClose: () => void; onGo: (t: ReaderTarget) => void; onBookmark: () => void;
}) {
  const [tab, setTab] = useState<'sura' | 'juz' | 'page'>('sura');
  const [q, setQ] = useState('');
  const [pg, setPg] = useState(String(cur.page));
  const list = useRef<HTMLDivElement>(null);
  const swipe = useSwipeClose(onClose);
  // Ouvrir la liste sur la sourate ou le juz en cours.
  useLayoutEffect(() => {
    list.current?.querySelector<HTMLElement>('.gorow.cur')?.scrollIntoView({ block: 'center' });
  }, [tab]);
  const plain = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ'’\-\s]/g, '');
  const qq = plain(q.trim());
  const suras = SURAHS.map((x, i) => ({ x, n: i + 1 })).filter(({ x, n }) =>
    !qq || String(n) === q.trim() || plain(x[1]).includes(qq) || plain(x[2]).includes(qq) || x[0].includes(q.trim()));
  const pageNum = Math.min(Math.max(parseInt(pg, 10) || 0, 0), TOTAL_PAGES);
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet goto" role="dialog" aria-label="Aller à" onClick={(e) => e.stopPropagation()} {...swipe}>
        <div class="sheet-head"><b>Aller à</b><button class="close" aria-label="Fermer" onClick={onClose}>✕</button></div>
        <div class="seg goseg" role="tablist">
          <button role="tab" aria-pressed={tab === 'sura'} onClick={() => setTab('sura')}>Sourate</button>
          <button role="tab" aria-pressed={tab === 'juz'} onClick={() => setTab('juz')}>Juz</button>
          <button role="tab" aria-pressed={tab === 'page'} onClick={() => setTab('page')}>Page</button>
        </div>
        {bookmark && (
          <button class="gomark" onClick={onBookmark}>Reprendre au marque-page · {SURAHS[bookmark.s - 1][1]} {bookmark.n}</button>
        )}
        {tab === 'sura' && <input class="gosearch" type="search" value={q} placeholder="Chercher une sourate (nom ou numéro)" aria-label="Chercher une sourate"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)} />}
        <div class="golist" ref={list}>
          {tab === 'sura' && suras.map(({ x, n }) => (
            <button class={`gorow ${n === cur.sura ? 'cur' : ''}`} onClick={() => onGo({ mode: 'sura', sura: n })}>
              <span class="gono">{n}</span>
              <span class="gotxt"><b>{x[1]}</b><small>{x[2]} · {x[3]} versets · p. {pageOf(surahVerses(n)[0])}</small></span>
              <span class="goar">{x[0]}</span>
            </button>
          ))}
          {tab === 'sura' && suras.length === 0 && <p class="note">Aucune sourate ne correspond à « {q} ».</p>}
          {tab === 'juz' && JUZ_NAMES.map((name, i) => {
            const [ja] = juzVerses(i + 1), { s: js, n: jn } = posOf(ja);
            return (
              <button class={`gorow ${i + 1 === cur.juz ? 'cur' : ''}`} onClick={() => onGo({ mode: 'juz', juz: i + 1 })}>
                <span class="gono">{i + 1}</span>
                <span class="gotxt"><b>Juz {i + 1}</b><small>{SURAHS[js - 1][1]} {js}:{jn} · p. {pageOf(ja)}</small></span>
                <span class="goar">{name}</span>
              </button>
            );
          })}
          {tab === 'page' && (
            <form class="gopage" onSubmit={(e) => { e.preventDefault(); if (pageNum >= 1) onGo({ mode: 'page', page: pageNum }); }}>
              <label for="goto-page">Numéro de page (1 à {TOTAL_PAGES})</label>
              <div class="gopage-row">
                <input id="goto-page" type="number" inputMode="numeric" min={1} max={TOTAL_PAGES} value={pg} onInput={(e) => setPg((e.target as HTMLInputElement).value)} />
                <button class="btn teal" type="submit" disabled={pageNum < 1}>Aller</button>
              </div>
              {pageNum >= 1 && <small class="note">Page {pageNum} : {SURAHS[posOf(pageFirstVerse(pageNum)).s - 1][1]}, juz {juzOf(pageFirstVerse(pageNum))}</small>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fermer une fenêtre du bas en la faisant glisser vers le bas.
 * Le geste ne démarre que si le contenu touché est déjà tout en haut (sinon on fait défiler la liste).
 */
function useSwipeClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number; t: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const el = ref.current;
    if (!el) return;
    // Remonter du point touché jusqu'à la fenêtre : si une zone qui défile n'est pas en haut, on la laisse défiler.
    for (let n = e.target as HTMLElement | null; n && n !== el.parentElement; n = n.parentElement) {
      if (n.scrollTop > 0) return;
      if (n === el) break;
    }
    drag.current = { y: e.touches[0].clientY, dy: 0, t: Date.now() };
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current, el = ref.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    if (d.dy > 0) {
      e.preventDefault();
      el.style.transition = 'none';
      el.style.transform = `translateY(${d.dy}px)`;
    }
  };
  const onTouchEnd = () => {
    const d = drag.current, el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    const fast = d.dy > 40 && d.dy / (Date.now() - d.t) > 0.6;
    el.style.transition = 'transform .22s ease-out';
    if (d.dy > el.offsetHeight * 0.25 || fast) {
      el.style.transform = 'translateY(100%)';
      window.setTimeout(onClose, 200);
    } else el.style.transform = '';
  };
  return { ref, onTouchStart, onTouchMove, onTouchEnd };
}
