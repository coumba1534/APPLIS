// Programmes de lecture : la portion du jour est découpée en séances.
// Les séances sont des parts de la portion : le même programme marche pour 20 pages par jour comme pour 7.
import { QUARTERS, pagesBetween, pageOf } from './quran';
import { splitByFractions, sectionEnd, wholeJuz } from './khatam';
import { getState } from '../store';

export interface SessionDef {
  label: string;
  /** Part de la portion (poids relatif), ou 'half1' / 'half2' pour couper la portion en deux au quart de hizb le plus proche du milieu. */
  size: number | 'half1' | 'half2';
  /** Heure de rappel par défaut (HH:MM). */
  time: string;
}

export interface Programme {
  id: string;
  name: string;
  forWho: string;
  sessions: SessionDef[];
}

export const BUILT_IN: Programme[] = [
  {
    id: 'p1', name: 'Programme 1', forWho: 'Étudiantes, personnes occupées la journée',
    sessions: [
      { label: 'Après Fajr', size: 'half1', time: '05:50' },
      { label: 'Avant de dormir', size: 'half2', time: '22:30' },
    ],
  },
  {
    id: 'p2', name: 'Programme 2', forWho: "Femmes au foyer, indisponibles l'après-midi",
    sessions: [
      { label: 'Après Fajr', size: 5, time: '05:50' },
      { label: 'Dans la matinée', size: 15, time: '09:30' },
    ],
  },
  {
    id: 'p2b', name: 'Programme 2 · variante', forWho: '5 pages après Fajr, puis matin et soir',
    sessions: [
      { label: 'Après Fajr', size: 5, time: '05:50' },
      { label: 'Le matin', size: 10, time: '09:30' },
      { label: 'Le soir avant de dormir', size: 5, time: '22:30' },
    ],
  },
  {
    id: 'p3', name: 'Programme 3', forWho: 'Emploi du temps flexible',
    sessions: [
      { label: 'Après Fajr', size: 4, time: '05:50' },
      { label: 'Après Dhuhr', size: 4, time: '14:00' },
      { label: 'Après Asr', size: 4, time: '17:15' },
      { label: 'Après Maghrib', size: 4, time: '19:20' },
      { label: 'Après Isha', size: 4, time: '20:40' },
    ],
  },
];

/** Séance d'un programme personnalisé : part en pourcentage de la portion du jour. */
export interface CustomSession { label: string; share: number; time: string }

export const DEFAULT_CUSTOM: CustomSession[] = [
  { label: 'Après Fajr', share: 50, time: '05:50' },
  { label: 'Le soir', share: 50, time: '21:00' },
];
export const MAX_CUSTOM_SESSIONS = 8;

export const CUSTOM_ID = 'custom';

export function customProgramme(): Programme {
  const list = getState().customProgramme?.length ? getState().customProgramme : DEFAULT_CUSTOM;
  return {
    id: CUSTOM_ID, name: 'Mon programme', forWho: 'Vos propres séances, à vos horaires',
    sessions: list.map((x) => ({ label: x.label.trim() || 'Séance', size: Math.max(1, x.share), time: x.time })),
  };
}

export const allProgrammes = (): Programme[] => [...BUILT_IN, customProgramme()];
export const programmeById = (id: string) => allProgrammes().find((p) => p.id === id) ?? BUILT_IN[0];

export interface Session {
  index: number;
  label: string;
  /** « 1er hizb », « Première moitié »… ou vide. */
  detail: string;
  /** Versets (numéros absolus), bornes incluses. */
  a: number;
  b: number;
  /** Pages du mushaf : première et dernière. */
  pageFrom: number;
  pageTo: number;
  /** Taille en pages (fractionnaire). */
  pages: number;
  defaultTime: string;
}

/** Séances concrètes pour une portion du jour [a, b]. */
export function sessionsFor(prog: Programme, [a, b]: [number, number]): Session[] {
  const defs = prog.sessions;
  const n = defs.length;
  const total = defs.reduce((t, d) => t + (typeof d.size === 'number' ? d.size : 1), 0);
  let cum = 0;
  const fractions: number[] = [];
  for (let i = 0; i < n - 1; i++) { cum += typeof defs[i].size === 'number' ? (defs[i].size as number) : 1; fractions.push(cum / total); }
  let starts = splitByFractions(a, b, fractions);

  // Programme « 1er hizb / 2e hizb » : on coupe au quart de hizb le plus proche du milieu.
  if (n === 2 && defs[0].size === 'half1' && defs[1].size === 'half2') {
    const inside = QUARTERS.filter((q) => q > a && q <= b);
    if (inside.length) starts = [a, inside[Math.floor(inside.length / 2)]];
  }

  const whole = wholeJuz(a, b);
  const single = whole !== null && whole[0] === whole[1];
  return defs.map((d, i) => {
    const sa = starts[i], sb = sectionEnd(starts, i, b);
    let detail = '';
    if (d.size === 'half1') detail = single ? '1er hizb' : 'Première moitié';
    if (d.size === 'half2') detail = single ? '2e hizb' : 'Seconde moitié';
    return { index: i, label: d.label, detail, a: sa, b: sb, pageFrom: pageOf(sa), pageTo: pageOf(sb), pages: pagesBetween(sa, sb), defaultTime: d.time };
  });
}

/** Taille de chaque séance pour une portion donnée : « 5 pages », « ≈ 2,5 pages »… */
export function sessionSizes(prog: Programme, p: [number, number]) {
  return sessionsFor(prog, p).map((s) => s.pages);
}
