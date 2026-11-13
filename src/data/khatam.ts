// Moteur du khatam : découpe le Coran en N jours, en unités traditionnelles.
//  - jusqu'à 240 jours : en quarts de hizb (30 jours = 1 juz par jour, 60 = 1 hizb, 120 = ½ hizb…) ;
//  - de 241 à 365 jours : en pages.
import { QUARTERS, PAGE_STARTS, JUZ_STARTS, JUZ_NAMES, SURAHS, TOTAL_PAGES, TOTAL_VERSES, posOf, pagePos, pagesBetween, pageOf } from './quran';

export const MIN_DAYS = 1;
export const MAX_DAYS = 365;
export const QUARTER_DAYS_LIMIT = 240;

export const clampDays = (n: number) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(Number.isFinite(n) ? n : 30)));

const cache = new Map<number, number[]>();

/** Premier verset (numéro absolu) de chaque jour, puis 6237 : `days + 1` valeurs. */
export function boundaries(days: number): number[] {
  days = clampDays(days);
  let b = cache.get(days);
  if (!b) {
    const list = days <= QUARTER_DAYS_LIMIT ? QUARTERS : PAGE_STARTS;
    const n = list.length - 1; // 240 quarts ou 604 pages
    b = Array.from({ length: days + 1 }, (_, k) => list[Math.round((k * n) / days)]);
    cache.set(days, b);
  }
  return b;
}

/** Versets (numéros absolus, bornes incluses) à lire le jour `day` (1 à days). */
export function portion(days: number, day: number): [number, number] {
  const b = boundaries(days);
  const d = Math.min(Math.max(day, 1), clampDays(days));
  return [b[d - 1], b[d] - 1];
}

/** Pages occupées par la portion (fractionnaire). */
export const portionPages = (a: number, b: number) => pagesBetween(a, b);

const fmt = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');

/** Taille d'une portion en pages, pour l'affichage : « 20 pages », « ≈ 2,5 pages ». */
export function pagesLabel(x: number) {
  if (x < 0.75) return "moins d'une page";
  const r = Math.round(x * 2) / 2;
  if (r === 1) return '1 page';
  return Number.isInteger(r) ? `${r} pages` : `≈ ${fmt(r)} pages`;
}

/** Unité de lecture par jour, en termes traditionnels. */
export function unitLabel(days: number) {
  days = clampDays(days);
  if (days > QUARTER_DAYS_LIMIT) return `environ ${fmt(TOTAL_PAGES / days)} pages`;
  const q = QUARTER_DAYS_LIMIT / days; // quarts de hizb par jour
  if (Number.isInteger(q)) {
    if (q === 1) return '¼ de hizb';
    if (q === 2) return '½ hizb';
    if (q === 3) return '¾ de hizb';
    if (q === 4) return '1 hizb (½ juz)';
    if (q === 8) return '1 juz';
    if (q % 8 === 0) return `${q / 8} juz`;
    if (q % 4 === 0) return `${q / 4} hizb`;
    if (q % 2 === 0) return `${fmt(q / 4)} hizb`;
    return `${q} quarts de hizb`;
  }
  const juz = q / 8; // juz par jour
  if (juz < 1) {
    for (const d of [2, 3, 4, 5, 6]) for (let k = 1; k < d; k++) if (Math.abs(juz - k / d) < 0.02) return `${k}/${d} de juz`;
  }
  return juz >= 1 ? `environ ${fmt(juz)} juz` : `environ ${fmt(q)} quarts de hizb`;
}

/** Résumé : « 1 juz par jour · ≈ 20 pages ». */
export function dayLabel(days: number) {
  days = clampDays(days);
  return days > QUARTER_DAYS_LIMIT ? `${unitLabel(days)} par jour` : `${unitLabel(days)} par jour · ${pagesLabel(TOTAL_PAGES / days)}`;
}

/** Si la portion est un ou plusieurs juz entiers : [premier juz, dernier juz]. */
export function wholeJuz(a: number, b: number): [number, number] | null {
  const i = JUZ_STARTS.indexOf(a);
  const j = JUZ_STARTS.indexOf(b + 1);
  return i >= 0 && j > i ? [i + 1, j] : null;
}

/** Titre de la portion : « Juz 12 », « Juz 3 à 4 », sinon null. */
export function juzTitle(a: number, b: number) {
  const w = wholeJuz(a, b);
  if (!w) return null;
  return w[0] === w[1] ? `Juz ${w[0]}` : `Juz ${w[0]} à ${w[1]}`;
}

/** Nom arabe affiché à droite de la portion (nom du juz ou de la sourate de départ). */
export function arabicName(a: number, b: number) {
  const w = wholeJuz(a, b);
  if (w) return JUZ_NAMES[w[0] - 1];
  return SURAHS[posOf(a).s - 1][0];
}

/** Pages du mushaf couvertes : première et dernière. */
export const pageSpan = (a: number, b: number): [number, number] => [pageOf(a), pageOf(b)];

/** Découpe a..b en `parts` morceaux de taille égale (en pages) : renvoie le premier verset de chaque morceau. */
export function splitEqual(a: number, b: number, parts: number): number[] {
  return splitByFractions(a, b, Array.from({ length: parts - 1 }, (_, i) => (i + 1) / parts));
}

/** Premier verset de chaque section, pour des fractions cumulées croissantes (la 1re section commence en a). */
export function splitByFractions(a: number, b: number, fractions: number[]): number[] {
  const p0 = pagePos(a), p1 = pagePos(b + 1);
  // Quand les sections font plusieurs pages, on s'arrête en fin de page (pratique avec un mushaf papier).
  const snap = (p1 - p0) / (fractions.length + 1) >= 3;
  const starts = [a];
  for (let i = 0; i < fractions.length; i++) {
    const t = p0 + fractions[i] * (p1 - p0);
    let lo = starts[i] + 1, hi = b; // plus petit verset dont la position atteint t
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (pagePos(m) >= t) hi = m; else lo = m + 1;
    }
    let v = lo;
    if (v - 1 > starts[i] && Math.abs(pagePos(v - 1) - t) < Math.abs(pagePos(v) - t)) v--;
    if (snap) {
      const ps = PAGE_STARTS[Math.round(t) - 1];
      if (ps !== undefined && ps > starts[i] && ps <= b) v = ps;
    }
    // chaque section garde au moins un verset
    const room = b - (fractions.length - i - 1);
    starts.push(Math.min(Math.max(v, starts[i] + 1), Math.max(room, starts[i] + 1)));
  }
  return starts;
}

/** Fin de l'intervalle (bornes incluses) pour la section k, d'après les débuts calculés. */
export const sectionEnd = (starts: number[], k: number, b: number) => (k + 1 < starts.length ? starts[k + 1] - 1 : b);

const pageStartSet = new Set(PAGE_STARTS);
/** Vrai si ce verset est le premier d'une page du mushaf. */
export const isPageStart = (abs: number) => pageStartSet.has(abs);

/** Référence courte : « 2:142 ». */
export function refShort(abs: number) {
  const { s, n } = posOf(abs);
  return `${s}:${n}`;
}

/** Un nombre de pages pour un compteur : entier, ou à la demi-page près pour les petites portions. */
export function pn(x: number) {
  const r = x >= 6 ? Math.round(x) : Math.round(x * 2) / 2;
  return String(r).replace('.', ',');
}

export { TOTAL_VERSES };
