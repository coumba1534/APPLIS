import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { useStore, update } from '../store';
import {
  SURAHS, JUZ_NAMES, BISMILLAH, TOTAL_PAGES, juzVerses, surahVerses, posOf, pageOf, juzOf, absOf, pageFirstVerse,
  loadArabic, loadFrench, toArabicDigits,
} from '../data/quran';
import { toast } from '../ui';
import { PageView } from './PageView';
import { setTheme } from '../theme';

export const SCRIPTS = [
  { id: 'medine', font: '"KFGQPC Hafs"', name: 'Mushaf de Médine', desc: 'Écriture officielle du Complexe Roi Fahd', text: 'ar-hafs' as const, size: 2 },
  { id: 'classique', font: '"Scheherazade New"', name: 'Classique', desc: 'Proche du mushaf de Médine' },
  { id: 'moderne', font: '"Noto Naskh Arabic"', name: 'Moderne posée', desc: 'Lettres nettes, très lisible', spacing: 2.4, size: -2 },
  { id: 'ouest', font: 'Harmattan', name: 'Ouest-africaine', desc: 'Style des mushaf du Sénégal' },
  { id: 'fine', font: 'Lateef', name: 'Fine et aérée', desc: 'Légère, à lire en grand', size: 4 },
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

  useEffect(() => {
    if (shown.mode === 'page') {
      const first = posOf(a);
      onTitle([`Page ${shown.page} · ${SURAHS[first.s - 1][1]}`, `Juz ${juzOf(a)} · ${JUZ_NAMES[juzOf(a) - 1]}`]);
    } else if (shown.mode === 'juz') onTitle([`Juz ${shown.juz} · ${JUZ_NAMES[shown.juz - 1]}`, `Pages ${pageOf(a)} à ${pageOf(b)}`]);
    else onTitle([`${SURAHS[shown.sura - 1][1]} · ${SURAHS[shown.sura - 1][0]}`, `Sourate ${shown.sura} · ${SURAHS[shown.sura - 1][3]} versets`]);
  }, [shown.mode, a]);

  // Mode page : on masque le titre de l'écran pour laisser toute la place au mushaf.
  useEffect(() => {
    document.body.classList.toggle('immersive', pageMode);
    return () => document.body.classList.remove('immersive');
  }, [pageMode]);

  // Défilement : en venant du mode page, se placer sur le même verset ;
  // sinon aller au marque-page quand il est dans la portion affichée.
  useLayoutEffect(() => {
    if (pageMode || !ar || ar.kind !== textKind) return;
    if (focus !== null) {
      const { s: fs, n: fn } = posOf(focus);
      const el = document.getElementById(`v${fs}-${fn}`);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1600);
        setFocus(null);
        return;
      }
      setFocus(null); // verset hors de la portion affichée : on va au marque-page
    }
    if (!s.bookmark) return;
    const el = document.getElementById(`v${s.bookmark.s}-${s.bookmark.n}`);
    if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
  }, [ar, a, pageMode, focus]);

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
        // Retenir le verset lu, pour reprendre au même endroit à la réouverture.
        if (v !== null) { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => update({ readerAbs: v }), 500); }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [pageMode, a, ar]);

  /** Premier verset visible sous la barre d'outils, en mode défilement. */
  const topVisibleVerse = () => {
    const limit = (document.querySelector('.tools')?.getBoundingClientRect().bottom ?? 0) + 4;
    for (const el of document.querySelectorAll<HTMLElement>('.verse[id]')) {
      if (el.getBoundingClientRect().bottom > limit) {
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
  const mark = (abs: number) => {
    const { s: si, n } = posOf(abs);
    update({ bookmark: { s: si, n } });
    toast(`Marque-page posé : ${SURAHS[si - 1][1]}, verset ${n} (page ${pageOf(abs)})`);
  };

  const go = (t: ReaderTarget) => { setTarget(t); window.scrollTo(0, 0); };
  const toPageOr = (t: ReaderTarget) => go(pageMode ? { mode: 'page', page: pageOf(versesOf(t)[0]) } : t);
  const step = (d: number) => {
    if (shown.mode === 'juz') go({ mode: 'juz', juz: shown.juz + d });
    else if (shown.mode === 'sura') go({ mode: 'sura', sura: shown.sura + d });
  };
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
    for (let i = a; i <= b; i++) {
      const { s: si, n } = posOf(i);
      if (si !== sura) {
        sura = si;
        const m = SURAHS[si - 1];
        rows.push(n === 1
          ? <div class="sura" key={`s${si}`}><div class="frame">سورة {m[0]}</div><small>Sourate {si} · {m[1]} · {m[2]} · {m[3]} versets</small></div>
          : <div class="sura" key={`s${si}`}><small>Sourate {si} · {m[1]} · suite, à partir du verset {n}</small></div>);
        if (n === 1 && si !== 1 && si !== 9) rows.push(<div class="bism" key={`b${si}`}>{BISMILLAH}</div>);
      }
      const p = pageOf(i);
      if (p !== pg) { pg = p; rows.push(<div class="pagemark" key={`p${p}`}>Page {p}</div>); }
      rows.push(
        <button key={i} id={`v${si}-${n}`} class={`verse ${i === markAbs ? 'marked' : ''}`} aria-label={`Sourate ${si}, verset ${n}`} onClick={() => mark(i)}>
          <span class="ar">{ar.data[si - 1][n - 1]}{' '}
            {script.id === 'medine' ? <span class="num hafs">{'۝' + toArabicDigits(n)}</span> : <span class="num">﴿{toArabicDigits(n)}﴾</span>}
          </span>
          {prefs.french && fr && <span class="fr"><b>{n}</b>{fr[si - 1][n - 1]}</span>}
        </button>,
      );
    }
  }

  // Les menus suivent le verset en cours de lecture.
  const reading = !pageMode && here !== null && here >= a && here <= b ? here : a;
  const curJuz = shown.mode === 'juz' ? shown.juz : juzOf(reading);
  const curSura = shown.mode === 'sura' ? shown.sura : posOf(reading).s;

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
          {s.bookmark && <span class="mark-info">Marque-page : {SURAHS[s.bookmark.s - 1][1]} {s.bookmark.n}</span>}
        </div>
      </div>

      {!pageMode && <button class="fab" aria-label="Réglages de lecture" aria-expanded={panel} onClick={() => setPanel(true)}>Aa</button>}

      {panel && (
        <div class="sheet-backdrop" onClick={() => setPanel(false)}>
          <div class="sheet" role="dialog" aria-label="Réglages de lecture" onClick={(e) => e.stopPropagation()}>
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
                      <span class="smp" style={{ fontFamily: x.font }}>{BISMILLAH}</span><b>{x.name}</b><small>{x.desc}</small>
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
        <PageView page={page} onPage={(p) => go({ mode: 'page', page: p })} markAbs={markAbs} onMark={mark} paper={prefs.paper} />
      ) : (
        <>
          <div class={`reader ${prefs.paper ? 'paper' : ''}`} style={style}>
            {error ? <p class="loading">Le texte n'a pas pu être chargé. Vérifiez la connexion puis rouvrez cet onglet.</p>
              : rows.length === 0 ? <p class="loading">Chargement du Coran…</p> : rows}
          </div>
          <div class="rnav">
            <button class="ghost" disabled={shown.mode === 'juz' ? shown.juz === 1 : shown.mode === 'sura' && shown.sura === 1} onClick={() => step(-1)}>‹ Précédent</button>
            <button class="ghost" disabled={shown.mode === 'juz' ? shown.juz === 30 : shown.mode === 'sura' && shown.sura === 114} onClick={() => step(1)}>Suivant ›</button>
          </div>
        </>
      )}
      <p class="credit">Mushaf de Médine et écriture officielle : Complexe du Roi Fahd (KFGQPC) · Autres écritures : The Noble Qur'an Encyclopedia · Traduction : Muhammad Hamidullah (tanzil.net)</p>
    </>
  );
}
