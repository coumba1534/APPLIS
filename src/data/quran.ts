// Données du Coran : métadonnées (sourates, juz, hizb, pages du mushaf de Médine)
// et chargement du texte arabe et de la traduction depuis /data.
import meta from './meta.json';

type SurahMeta = [nameAr: string, translit: string, nameFr: string, verses: number];

/** Sourates : [nom arabe, translittération, nom français, nombre de versets] */
export const SURAHS = meta.S as SurahMeta[];
/** Numéro absolu (1 à 6236) du premier verset de chaque juz, plus une sentinelle 6237. */
const JUZ_START: number[] = meta.J;
/** Numéro absolu du premier verset de chaque page (604 pages), plus une sentinelle. */
const PAGE_START: number[] = meta.P;
/** Numéro absolu du premier verset de chaque quart de hizb (240), plus une sentinelle. */
const QUARTER_START: number[] = meta.H;
/**
 * Débuts des 240 quarts de hizb (numéro absolu), plus une sentinelle 6237.
 * Un juz = 8 quarts : le début de chaque juz est aligné sur l'édition officielle de Médine.
 */
export const QUARTERS: number[] = (() => {
  const q = [...QUARTER_START];
  for (let k = 0; k < 30; k++) q[8 * k] = JUZ_START[k];
  return q;
})();
/** Débuts des 604 pages (numéro absolu), plus une sentinelle 6237. */
export const PAGE_STARTS: number[] = PAGE_START;
export const JUZ_STARTS: number[] = JUZ_START;
export const TOTAL_VERSES = 6236;

/** Position fractionnaire dans le mushaf : 22,5 = au milieu de la page 22. */
export function pagePos(abs: number): number {
  if (abs > TOTAL_VERSES) return TOTAL_PAGES + 1;
  const p = pageOf(abs);
  const first = PAGE_START[p - 1], next = PAGE_START[p];
  return p + (abs - first) / (next - first);
}
/** Nombre de pages (fractionnaire) occupées par les versets a à b inclus. */
export const pagesBetween = (a: number, b: number) => pagePos(b + 1) - pagePos(a);
/** Référence lisible d'un verset : « Al-Baqarah 2:142 ». */
export function refText(abs: number) {
  const { s, n } = posOf(abs);
  return `${SURAHS[s - 1][1]} ${s}:${n}`;
}

export const TOTAL_PAGES = 604;
export const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
export const JUZ_NAMES = ['الم', 'سيقول', 'تلك الرسل', 'لن تنالوا', 'والمحصنات', 'لا يحب الله', 'وإذا سمعوا', 'ولو أننا', 'قال الملأ', 'واعلموا', 'يعتذرون', 'وما من دابة', 'وما أبرئ', 'ربما', 'سبحان الذي', 'قال ألم', 'اقترب للناس', 'قد أفلح', 'وقال الذين', 'أمن خلق', 'اتل ما أوحي', 'ومن يقنت', 'وما لي', 'فمن أظلم', 'إليه يرد', 'حم', 'قال فما خطبكم', 'قد سمع الله', 'تبارك الذي', 'عم'];

/** Numéro absolu du premier verset de chaque sourate (index 0 = sourate 1). */
const SURAH_START: number[] = [1];
SURAHS.forEach((s, i) => SURAH_START.push(SURAH_START[i] + s[3]));

export interface VerseRef { s: number; n: number }

export const absOf = (s: number, n: number) => SURAH_START[s - 1] + n - 1;

export function posOf(abs: number): VerseRef {
  let s = 1;
  while (SURAH_START[s] <= abs) s++;
  return { s, n: abs - SURAH_START[s - 1] + 1 };
}

function lastIndexAtOrBefore(list: number[], abs: number): number {
  let lo = 0, hi = list.length - 2;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (list[m] <= abs) lo = m; else hi = m - 1;
  }
  return lo;
}

export const pageOf = (abs: number) => lastIndexAtOrBefore(PAGE_START, abs) + 1;
export const juzOf = (abs: number) => lastIndexAtOrBefore(JUZ_START, abs) + 1;

/** Versets (numéros absolus) d'un juz, bornes incluses. */
export const juzVerses = (j: number): [number, number] => [JUZ_START[j - 1], JUZ_START[j] - 1];
/** Versets d'une sourate, bornes incluses. */
export const surahVerses = (s: number): [number, number] => [SURAH_START[s - 1], SURAH_START[s] - 1];
/** Pages du mushaf couvertes par un juz : [première, dernière]. */
export const juzPages = (j: number): [number, number] => {
  const [a, b] = juzVerses(j);
  return [pageOf(a), pageOf(b)];
};
/** Début du 2e hizb d'un juz : page, et s'il commence en haut de cette page. */
export function secondHizb(j: number) {
  const abs = QUARTER_START[(2 * j - 1) * 4];
  const page = pageOf(abs);
  return { page, atTop: PAGE_START[page - 1] === abs };
}
/** Premier verset d'une page du mushaf. */
export const pageFirstVerse = (p: number) => PAGE_START[p - 1];

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(name: string): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}

/** Texte arabe [sourate][verset]. 'ar-hafs' : écriture officielle du Complexe Roi Fahd ; 'ar' : pour les autres polices. */
export const loadArabic = (kind: 'ar' | 'ar-hafs' = 'ar') => fetchJson<string[][]>(kind);

/** Traduction française de Muhammad Hamidullah : tableau [sourate][verset]. */
export const loadFrench = () => fetchJson<string[][]>('fr');

/**
 * Les 604 pages du mushaf de Médine, ligne par ligne (Complexe Roi Fahd, édition Hafs).
 * Une ligne vaut ["H", sourate] (titre), ["B"] (basmala) ou une suite de mots,
 * où un nombre marque la fin d'un verset (son numéro dans la sourate).
 */
export type MushafLine = (string | number)[];
export const loadMushaf = () => fetchJson<MushafLine[][]>('mushaf');

export const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
