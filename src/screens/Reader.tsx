import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { useStore, update } from '../store';
import {
  SURAHS, JUZ_NAMES, BISMILLAH, juzVerses, surahVerses, posOf, pageOf, juzOf, absOf, loadArabic, loadFrench, toArabicDigits,
} from '../data/quran';
import { toast } from '../ui';

export const SCRIPTS = [
  { id: 'classique', font: '"Scheherazade New"', name: 'Classique', desc: 'Proche du mushaf de Médine' },
  { id: 'moderne', font: '"Noto Naskh Arabic"', name: 'Moderne posée', desc: 'Lettres nettes, très lisible', spacing: 2.4, size: -2 },
  { id: 'ouest', font: 'Harmattan', name: 'Ouest-africaine', desc: 'Style des mushaf du Sénégal' },
  { id: 'fine', font: 'Lateef', name: 'Fine et aérée', desc: 'Légère, à lire en grand', size: 4 },
];

export type ReaderTarget = { mode: 'juz'; juz: number } | { mode: 'sura'; sura: number };

export function Reader({ target, setTarget, onTitle }: {
  target: ReaderTarget; setTarget: (t: ReaderTarget) => void; onTitle: (t: [string, string]) => void;
}) {
  const s = useStore();
  const prefs = s.reader;
  const [ar, setAr] = useState<string[][] | null>(null);
  const [fr, setFr] = useState<string[][] | null>(null);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  useEffect(() => { loadArabic().then(setAr).catch(() => setError(true)); }, []);
  useEffect(() => { if (prefs.french && !fr) loadFrench().then(setFr).catch(() => toast('La traduction n\'a pas pu être chargée.')); }, [prefs.french]);

  const [a, b] = target.mode === 'juz' ? juzVerses(target.juz) : surahVerses(target.sura);
  useEffect(() => {
    onTitle(target.mode === 'juz'
      ? [`Juz ${target.juz} · ${JUZ_NAMES[target.juz - 1]}`, `Pages ${pageOf(a)} à ${pageOf(b)}`]
      : [`${SURAHS[target.sura - 1][1]} · ${SURAHS[target.sura - 1][0]}`, `Sourate ${target.sura} · ${SURAHS[target.sura - 1][3]} versets`]);
  }, [target.mode === 'juz' ? target.juz : -target.sura]);

  // Aller au marque-page quand il est dans la portion affichée.
  useLayoutEffect(() => {
    if (!ar || !s.bookmark) return;
    const el = document.getElementById(`v${s.bookmark.s}-${s.bookmark.n}`);
    if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
  }, [ar, a]);

  const script = SCRIPTS.find((x) => x.id === prefs.script) ?? SCRIPTS[0];
  const style = {
    '--qf': `${script.font}, "Scheherazade New", serif`,
    '--qs': `${prefs.size + (script.size ?? 0)}px`,
    '--lh': String(prefs.spacing ?? script.spacing ?? 2.1),
  };
  const setPrefs = (p: Partial<typeof prefs>) => update({ reader: { ...prefs, ...p } });
  const markAbs = s.bookmark ? absOf(s.bookmark.s, s.bookmark.n) : -1;

  const go = (t: ReaderTarget) => { setTarget(t); window.scrollTo(0, 0); };
  const step = (d: number) => go(target.mode === 'juz' ? { mode: 'juz', juz: target.juz + d } : { mode: 'sura', sura: target.sura + d });

  const rows = [];
  if (ar) {
    let page = 0, sura = 0;
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
      if (p !== page) { page = p; rows.push(<div class="pagemark" key={`p${p}`}>Page {p}</div>); }
      rows.push(
        <button key={i} id={`v${si}-${n}`} class={`verse ${i === markAbs ? 'marked' : ''}`} aria-label={`Sourate ${si}, verset ${n}`}
          onClick={() => { update({ bookmark: { s: si, n } }); toast(`Marque-page posé : ${SURAHS[si - 1][1]}, verset ${n} (page ${p})`); }}>
          <span class="ar">{ar[si - 1][n - 1]} <span class="num">﴿{toArabicDigits(n)}﴾</span></span>
          {prefs.french && fr && <span class="fr"><b>{n}</b>{fr[si - 1][n - 1]}</span>}
        </button>,
      );
    }
  }

  const curJuz = target.mode === 'juz' ? target.juz : juzOf(a);
  const curSura = target.mode === 'sura' ? target.sura : posOf(a).s;

  return (
    <>
      <div class="tools">
        <div class="line">
          <select aria-label="Choisir un juz" value={curJuz} onChange={(e) => go({ mode: 'juz', juz: +(e.target as HTMLSelectElement).value })}>
            {JUZ_NAMES.map((n, i) => <option value={i + 1}>Juz {i + 1} · {n}</option>)}
          </select>
          <select aria-label="Choisir une sourate" value={curSura} onChange={(e) => go({ mode: 'sura', sura: +(e.target as HTMLSelectElement).value })}>
            {SURAHS.map((x, i) => <option value={i + 1}>{i + 1}. {x[1]} · {x[0]}</option>)}
          </select>
        </div>
        <div class="line">
          <div class="seg" role="group" aria-label="Affichage">
            <button aria-pressed={!prefs.french} onClick={() => setPrefs({ french: false })}>Arabe</button>
            <button aria-pressed={prefs.french} onClick={() => setPrefs({ french: true })}>+ Français</button>
          </div>
          {s.bookmark && <span class="mark-info">Marque-page : {SURAHS[s.bookmark.s - 1][1]} {s.bookmark.n}</span>}
        </div>
      </div>

      <button class="fab" aria-label="Choisir l'écriture et la taille du texte" aria-expanded={panel} onClick={() => setPanel(true)}>Aa</button>

      {panel && (
        <div class="sheet-backdrop" onClick={() => setPanel(false)}>
          <div class="sheet" role="dialog" aria-label="Réglages de lecture" onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head">
              <b>Écriture du Coran</b>
              <button class="close" aria-label="Fermer" onClick={() => setPanel(false)}>✕</button>
            </div>
            <div class="scripts">
              {SCRIPTS.map((x) => (
                <button class="script" aria-pressed={x.id === script.id} onClick={() => setPrefs({ script: x.id, spacing: null })}>
                  <span class="smp" style={{ fontFamily: x.font }}>{BISMILLAH}</span><b>{x.name}</b><small>{x.desc}</small>
                </button>
              ))}
            </div>
            <div class="prow"><span>Taille du texte</span><div class="seg">
              <button aria-label="Texte plus petit" onClick={() => setPrefs({ size: Math.max(18, prefs.size - 3) })}>A−</button>
              <button aria-label="Texte plus grand" onClick={() => setPrefs({ size: Math.min(44, prefs.size + 3) })}>A+</button>
            </div></div>
            <div class="prow"><span>Espacement des lignes</span><div class="seg">
              <button aria-pressed={(prefs.spacing ?? script.spacing ?? 2.1) < 2.5} onClick={() => setPrefs({ spacing: 2.1 })}>Normal</button>
              <button aria-pressed={(prefs.spacing ?? script.spacing ?? 2.1) >= 2.5} onClick={() => setPrefs({ spacing: 2.6 })}>Aéré</button>
            </div></div>
            <div class="prow"><span>Fond de page</span><div class="seg">
              <button aria-pressed={!prefs.paper} onClick={() => setPrefs({ paper: false })}>Clair</button>
              <button aria-pressed={prefs.paper} onClick={() => setPrefs({ paper: true })}>Papier</button>
            </div></div>
            <div class="prow"><span>Traduction française</span><div class="seg">
              <button aria-pressed={!prefs.french} onClick={() => setPrefs({ french: false })}>Non</button>
              <button aria-pressed={prefs.french} onClick={() => setPrefs({ french: true })}>Oui</button>
            </div></div>
            <button class="btn teal" onClick={() => setPanel(false)}>Terminé</button>
          </div>
        </div>
      )}

      <div class={`reader ${prefs.paper ? 'paper' : ''}`} style={style}>
        {error ? <p class="loading">Le texte n'a pas pu être chargé. Vérifiez la connexion puis rouvrez cet onglet.</p>
          : !ar ? <p class="loading">Chargement du Coran…</p> : rows}
      </div>
      <div class="rnav">
        <button class="ghost" disabled={target.mode === 'juz' ? target.juz === 1 : target.sura === 1} onClick={() => step(-1)}>‹ Précédent</button>
        <button class="ghost" disabled={target.mode === 'juz' ? target.juz === 30 : target.sura === 114} onClick={() => step(1)}>Suivant ›</button>
      </div>
      <p class="credit">Texte uthmani : The Noble Qur'an Encyclopedia (quranenc.com) · Traduction : Muhammad Hamidullah (tanzil.net) · Pages : mushaf de Médine</p>
    </>
  );
}
