// État de l'appli, enregistré sur le téléphone (localStorage).
// Les groupes et la synchronisation en ligne arriveront avec Firebase (étape 2).
import { useEffect, useState } from 'preact/hooks';

export interface CatchPlan { juz: number; perDay: number; read: number; lastDay: string | null }
export interface ReaderPrefs { script: string; size: number; spacing: number | null; paper: boolean; french: boolean; layout?: 'scroll' | 'page' }

export interface State {
  version: 1;
  onboarded: boolean;
  name: string;
  groupCode: string;
  programmeId: string;
  /** 1er jour du Ramadan (AAAA-MM-JJ). Date estimée, à ajuster selon l'annonce de la lune. */
  ramadanStart: string;
  /** Si renseignée, remplace ramadanStart : permet d'essayer l'appli avant le Ramadan. */
  trialStart: string | null;
  /** Juz terminés. */
  done: number[];
  /** Séances cochées, par juz : { "12": [0, 1] } */
  sessions: Record<string, number[]>;
  catchPlan: CatchPlan | null;
  bookmark: { s: number; n: number } | null;
  reader: ReaderPrefs;
  /** Heures de rappel personnalisées, clé `${programmeId}:${index}`. */
  reminderTimes: Record<string, string>;
  reminders: { sessions: boolean; lateEvening: boolean };
  /** Rappels déjà affichés, pour ne pas les répéter : `${date}:${clé}`. */
  shown: string[];
}

export const DEFAULT_RAMADAN_START = '2027-02-08';

const initial: State = {
  version: 1,
  onboarded: false,
  name: '',
  groupCode: '',
  programmeId: 'p1',
  ramadanStart: DEFAULT_RAMADAN_START,
  trialStart: null,
  done: [],
  sessions: {},
  catchPlan: null,
  bookmark: null,
  reader: { script: 'medine', size: 26, spacing: null, paper: false, french: false, layout: 'scroll' },
  reminderTimes: {},
  reminders: { sessions: true, lateEvening: true },
  shown: [],
};

const KEY = 'khatam-entre-soeurs';

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch { /* stockage indisponible : on repart de zéro */ }
  return initial;
}

let state: State = read();
const listeners = new Set<() => void>();

export const getState = () => state;

export function update(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignoré */ }
  listeners.forEach((l) => l());
}

export function useStore(): State {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

// ---- Calendrier ----

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Jour du programme (1 à 30), 0 ou moins avant le début, plus de 30 après la fin. */
export function currentDay(s: State = state) {
  return dayNumber(todayISO()) - dayNumber(s.trialStart ?? s.ramadanStart) + 1;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---- Actions ----

export function toggleSession(juz: number, index: number, total: number) {
  update((s) => {
    const cur = new Set(s.sessions[juz] ?? (s.done.includes(juz) ? [...Array(total).keys()] : []));
    cur.has(index) ? cur.delete(index) : cur.add(index);
    const doneSet = new Set(s.done);
    cur.size >= total ? doneSet.add(juz) : doneSet.delete(juz);
    return { sessions: { ...s.sessions, [juz]: [...cur] }, done: [...doneSet].sort((a, b) => a - b) };
  });
}

export function setJuzDone(juz: number, done: boolean) {
  update((s) => {
    const doneSet = new Set(s.done);
    done ? doneSet.add(juz) : doneSet.delete(juz);
    const sessions = { ...s.sessions };
    delete sessions[juz];
    return { done: [...doneSet].sort((a, b) => a - b), sessions };
  });
}

/** Valide la portion de rattrapage du jour. Renvoie true si le juz rattrapé est terminé. */
export function readCatchUp(totalPages: number): boolean {
  const plan = state.catchPlan;
  if (!plan) return false;
  const read = Math.min(totalPages, plan.read + plan.perDay);
  if (read >= totalPages) {
    setJuzDone(plan.juz, true);
    update({ catchPlan: null });
    return true;
  }
  update({ catchPlan: { ...plan, read, lastDay: todayISO() } });
  return false;
}

export function resetProgress() {
  update({ done: [], sessions: {}, catchPlan: null, shown: [] });
}
