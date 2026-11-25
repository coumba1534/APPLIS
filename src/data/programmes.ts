// Programmes de lecture : la portion du jour est découpée en séances.
// Les séances sont des parts de la portion : le même programme marche pour 20 pages par jour comme pour 7.
import { QUARTERS, pagesBetween, pageOf } from './quran';
import { splitByFractions, sectionEnd, wholeJuz } from './khatam';
import { getState } from '../store';
import type { State, TrackId, RamadanState } from '../store';

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
    id: 'p1', name: 'Matin et soir', forWho: 'Deux séances par jour : une après Fajr, une avant de dormir. Idéal si la journée est bien remplie.',
    sessions: [
      { label: 'Après Fajr', size: 'half1', time: '05:50' },
      { label: 'Avant de dormir', size: 'half2', time: '22:30' },
    ],
  },
  {
    id: 'p2', name: 'Surtout le matin', forWho: 'Un court début après Fajr, puis le reste dans la matinée. Pour une journée libre le matin.',
    sessions: [
      { label: 'Après Fajr', size: 5, time: '05:50' },
      { label: 'Matinée', size: 15, time: '09:30' },
    ],
  },
  {
    id: 'p2b', name: 'Réparti sur la journée', forWho: 'Après Fajr, en matinée, puis un peu avant de dormir.',
    sessions: [
      { label: 'Après Fajr', size: 5, time: '05:50' },
      { label: 'Matinée', size: 10, time: '09:30' },
      { label: 'Avant de dormir', size: 5, time: '22:30' },
    ],
  },
  {
    id: 'p3', name: 'Après chaque prière', forWho: 'Une petite part après chacune des 5 prières. Facile à tenir, même avec un emploi du temps variable.',
    sessions: [
      { label: 'Après Fajr', size: 4, time: '05:50' },
      { label: 'Après Dhuhr', size: 4, time: '14:00' },
      { label: 'Après Asr', size: 4, time: '17:15' },
      { label: 'Après Maghrib', size: 4, time: '19:20' },
      { label: 'Après Isha', size: 4, time: '20:40' },
    ],
  },
];

/**
 * Séance d'un programme personnalisé : un moment de la journée et une heure de rappel.
 * Les parts ne se règlent pas : la portion du jour est partagée à parts égales entre les séances.
 */
export interface CustomSession { label: string; time: string; /** ancien réglage, ignoré */ share?: number }

/** Moments proposés pour une séance, avec une heure de rappel suggérée. */
export const MOMENTS: { label: string; time: string }[] = [
  { label: 'Après Fajr', time: '05:50' },
  { label: 'Matin', time: '08:00' },
  { label: 'Matinée', time: '09:30' },
  { label: 'Midi', time: '12:30' },
  { label: 'Après Dhuhr', time: '14:00' },
  { label: 'Après-midi', time: '16:00' },
  { label: 'Après Asr', time: '17:15' },
  { label: 'Après Maghrib', time: '19:20' },
  { label: 'Soir', time: '20:30' },
  { label: 'Après Isha', time: '20:40' },
  { label: 'Avant de dormir', time: '22:30' },
];

export const DEFAULT_CUSTOM: CustomSession[] = [
  { label: 'Après Fajr', time: '05:50' },
  { label: 'Avant de dormir', time: '22:30' },
];
export const MAX_CUSTOM_SESSIONS = 8;

export const CUSTOM_ID = 'custom';

/** Range les séances dans l'ordre de la journée (la lecture suit l'ordre des heures). */
export const sortByTime = (list: CustomSession[]) => [...list].sort((a, b) => a.time.localeCompare(b.time));

export function customProgramme(): Programme {
  const list = getState().customProgramme?.length ? getState().customProgramme : DEFAULT_CUSTOM;
  return {
    id: CUSTOM_ID, name: 'Mon programme', forWho: 'Vos propres séances, à vos horaires',
    sessions: list.map((x) => ({ label: x.label.trim() || 'Séance', size: 1, time: x.time })),
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

// ---- Rythmes du Ramadan (indépendants du programme habituel) ----

/** Moments de la journée pendant le Ramadan, dans l'ordre, avec une heure de rappel suggérée. */
export const RAMADAN_MOMENTS: { label: string; time: string }[] = [
  { label: 'Après le suhur', time: '04:45' },
  { label: 'Après Fajr', time: '05:50' },
  { label: 'Matinée', time: '09:30' },
  { label: 'Après Dhuhr', time: '14:00' },
  { label: 'Après Asr', time: '17:15' },
  { label: "Avant l'iftar", time: '18:00' },
  { label: 'Après Maghrib', time: '19:20' },
  { label: 'Après Isha', time: '20:40' },
  { label: 'Après les Tarawih', time: '22:15' },
  { label: 'Avant de dormir', time: '22:45' },
];
export const DEFAULT_RAMADAN_MOMENTS = ['Après le suhur', "Avant l'iftar", 'Après les Tarawih'];
export const RAMADAN_CUSTOM_ID = 'r-perso';

const moment = (label: string) => RAMADAN_MOMENTS.find((m) => m.label === label) ?? { label, time: '12:00' };

export const RAMADAN_PROGRAMMES: Programme[] = [
  {
    id: 'r-suhur', name: 'Suhur et Tarawih', forWho: 'Une séance après le suhur, une après les Tarawih',
    sessions: [{ label: 'Après le suhur', size: 'half1', time: '04:45' }, { label: 'Après les Tarawih', size: 'half2', time: '22:15' }],
  },
  {
    id: 'r-iftar', name: "Autour de l'iftar", forWho: "Après Fajr, avant l'iftar et après les Tarawih",
    sessions: [{ label: 'Après Fajr', size: 1, time: '05:50' }, { label: "Avant l'iftar", size: 1, time: '18:00' }, { label: 'Après les Tarawih', size: 1, time: '22:15' }],
  },
  {
    id: 'r-prieres', name: 'Après chaque prière', forWho: '5 petites séances, une après chaque prière',
    sessions: ['Après Fajr', 'Après Dhuhr', 'Après Asr', 'Après Maghrib', 'Après Isha'].map((l) => ({ label: l, size: 1, time: moment(l).time })),
  },
];

/** Rythme personnalisé du Ramadan : les moments choisis, rangés dans l'ordre de la journée, à parts égales. */
export function ramadanCustom(moments: string[]): Programme {
  const order = (l: string) => RAMADAN_MOMENTS.findIndex((m) => m.label === l);
  const list = [...(moments.length ? moments : DEFAULT_RAMADAN_MOMENTS)].sort((a, b) => order(a) - order(b));
  return { id: RAMADAN_CUSTOM_ID, name: 'Rythme personnalisé', forWho: 'Vos moments à vous, à parts égales', sessions: list.map((l) => ({ label: l, size: 1, time: moment(l).time })) };
}

export function ramadanProgramme(r: RamadanState): Programme {
  if (r.programme === RAMADAN_CUSTOM_ID) return ramadanCustom(r.moments ?? DEFAULT_RAMADAN_MOMENTS);
  return RAMADAN_PROGRAMMES.find((p) => p.id === r.programme) ?? RAMADAN_PROGRAMMES[0];
}

/** Le programme d'un suivi : rythme du Ramadan pour le khatam du Ramadan, programme habituel sinon. */
export function programmeOf(s: State, id: TrackId): Programme {
  if (id === 'group' && s.group) return programmeById(s.group.programmeId);
  return id === 'ramadan' && s.ramadan ? ramadanProgramme(s.ramadan) : programmeById(s.programmeId);
}
