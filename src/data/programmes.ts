// Programmes de lecture : le juz du jour (environ 20 pages) découpé en séances.
import { juzPages, secondHizb } from './quran';

export interface SessionDef {
  label: string;
  /** Nombre de pages, ou 'hizb1' / 'hizb2' pour suivre le découpage exact en hizb. */
  size: number | 'hizb1' | 'hizb2';
  /** Heure de rappel par défaut (HH:MM). */
  time: string;
}

export interface Programme {
  id: string;
  name: string;
  forWho: string;
  sessions: SessionDef[];
}

export const PROGRAMMES: Programme[] = [
  {
    id: 'p1', name: 'Programme 1', forWho: 'Étudiantes, personnes occupées la journée',
    sessions: [
      { label: 'Après Fajr', size: 'hizb1', time: '05:50' },
      { label: 'Avant de dormir', size: 'hizb2', time: '22:30' },
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

export const programmeById = (id: string) => PROGRAMMES.find((p) => p.id === id) ?? PROGRAMMES[0];

export interface Session {
  index: number;
  label: string;
  detail: string;
  from: number;
  to: number;
  pages: number;
  defaultTime: string;
}

/** Séances concrètes (avec les pages du mushaf) pour un juz donné. */
export function sessionsFor(prog: Programme, juz: number): Session[] {
  const [first, last] = juzPages(juz);
  const hizb2 = secondHizb(juz);
  let cursor = first;
  return prog.sessions.map((def, i) => {
    const isLast = i === prog.sessions.length - 1;
    let from = cursor, to: number, detail = '';
    if (def.size === 'hizb1') { from = first; to = hizb2.atTop ? hizb2.page - 1 : hizb2.page; detail = '1er hizb'; }
    else if (def.size === 'hizb2') { from = hizb2.page; to = last; detail = '2e hizb'; }
    else to = isLast ? last : Math.min(last, cursor + def.size - 1);
    cursor = to + 1;
    const pages = to - from + 1;
    return { index: i, label: def.label, detail, from, to, pages, defaultTime: def.time };
  });
}

export function describeSessions(prog: Programme) {
  return prog.sessions.map((s) => (s.size === 'hizb1' ? '1er hizb' : s.size === 'hizb2' ? '2e hizb' : `${s.size} pages`));
}
