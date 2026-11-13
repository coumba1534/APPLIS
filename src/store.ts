// État de l'appli, enregistré sur le téléphone (localStorage).
// Les groupes et la synchronisation en ligne arriveront avec Firebase.
import { useEffect, useState } from 'preact/hooks';
import type { ReaderTarget } from './screens/Reader';
import { clampDays, portion, portionPages } from './data/khatam';
import type { CustomSession } from './data/programmes';

/**
 * Rattrapage d'un jour manqué : la portion de ce jour est lue en `parts` morceaux égaux,
 * un morceau par jour en plus de la lecture normale.
 */
export interface CatchPlan { day: number; parts: number; partsDone: number; lastDay: string | null }
export interface ReaderPrefs { script: string; size: number; spacing: number | null; paper: boolean; french: boolean; layout?: 'scroll' | 'page' }

export type KhatamKind = 'ramadan' | 'custom';

/** Un khatam : une date de début, une durée en jours, et le Coran découpé en autant de portions. */
export interface Khatam {
  id: string;
  kind: KhatamKind;
  name: string;
  /** 1er jour (AAAA-MM-JJ). Pour le Ramadan : date estimée, à ajuster selon l'annonce de la lune. */
  start: string;
  days: number;
  /** En mode essai : la date prévue à l'origine (le début a été avancé à aujourd'hui). */
  plannedStart?: string;
  /** Date à laquelle le dernier jour a été validé. */
  finishedOn?: string;
}

export interface HistoryItem {
  id: string;
  name: string;
  kind: KhatamKind;
  start: string;
  days: number;
  doneDays: number;
  /** Date de fin (khatam terminé) ou d'arrêt. */
  end: string;
  status: 'done' | 'stopped';
}

export interface State {
  version: 2;
  onboarded: boolean;
  name: string;
  groupCode: string;
  programmeId: string;
  /** Séances du programme personnalisé. */
  customProgramme: CustomSession[];
  /** Le khatam en cours (un seul à la fois). */
  khatam: Khatam;
  history: HistoryItem[];
  /** Jours du khatam terminés. */
  done: number[];
  /** Séances cochées, par jour : { "12": [0, 1] } */
  sessions: Record<string, number[]>;
  catchPlan: CatchPlan | null;
  bookmark: { s: number; n: number } | null;
  reader: ReaderPrefs;
  /** Dernier onglet ouvert, pour rouvrir l'appli au même endroit. */
  lastTab: string;
  /** Dernière portion ouverte dans Lire (juz, sourate ou page). */
  readerTarget: ReaderTarget | null;
  /** Dernier verset lu en haut de l'écran, en mode défilement (numéro absolu). */
  readerAbs: number | null;
  /** L'astuce du mode focus a déjà été montrée. */
  focusHintSeen: boolean;
  /** Apparence : 'auto' suit le réglage du téléphone. */
  theme: 'auto' | 'light' | 'dark';
  /** Heures de rappel personnalisées, clé `${programmeId}:${index}` (programmes prédéfinis). */
  reminderTimes: Record<string, string>;
  reminders: { sessions: boolean; lateEvening: boolean };
  /** Rappels déjà affichés, pour ne pas les répéter : `${date}:${clé}`. */
  shown: string[];
}

/** 1er jour du Ramadan 1448 (estimation, à ajuster selon l'annonce de la lune). */
export const DEFAULT_RAMADAN_START = '2027-02-08';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function ramadanKhatam(start = DEFAULT_RAMADAN_START): Khatam {
  return { id: newId(), kind: 'ramadan', name: 'Ramadan', start, days: 30 };
}

const initial: State = {
  version: 2,
  onboarded: false,
  name: '',
  groupCode: '',
  programmeId: 'p1',
  customProgramme: [],
  khatam: ramadanKhatam(),
  history: [],
  done: [],
  sessions: {},
  catchPlan: null,
  bookmark: null,
  theme: 'auto',
  focusHintSeen: false,
  lastTab: 'today',
  readerTarget: null,
  readerAbs: null,
  reader: { script: 'medine', size: 26, spacing: null, paper: false, french: false, layout: 'scroll' },
  reminderTimes: {},
  reminders: { sessions: true, lateEvening: true },
  shown: [],
};

const KEY = 'khatam-entre-soeurs';

/** Reprend les données de la version 1 (Ramadan seulement, 30 juz). */
function migrate(old: Record<string, unknown>): State {
  const start = (old.trialStart as string | null) ?? (old.ramadanStart as string | undefined) ?? DEFAULT_RAMADAN_START;
  const khatam: Khatam = { ...ramadanKhatam(start), ...(old.trialStart ? { plannedStart: (old.ramadanStart as string) ?? DEFAULT_RAMADAN_START } : {}) };
  let catchPlan: CatchPlan | null = null;
  const cp = old.catchPlan as { juz: number; perDay: number; read: number; lastDay: string | null } | null | undefined;
  if (cp && cp.juz) {
    const [a, b] = portion(30, cp.juz);
    const parts = Math.max(1, Math.round(portionPages(a, b) / Math.max(1, cp.perDay)));
    catchPlan = { day: cp.juz, parts, partsDone: Math.min(parts - 1, Math.round(cp.read / Math.max(1, cp.perDay))), lastDay: cp.lastDay };
  }
  const { ramadanStart: _r, trialStart: _t, ...rest } = old;
  return { ...initial, ...(rest as Partial<State>), version: 2, khatam, history: [], customProgramme: [], catchPlan };
}

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.version === 2 && data.khatam ? { ...initial, ...data } : migrate(data);
    }
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

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Nombre de jours entre deux dates (b - a). */
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);

/** Dernier jour d'un khatam. */
export const endDate = (k: Khatam) => addDays(k.start, k.days - 1);

/** Jour du khatam : 1 à `days`, 0 ou moins avant le début, plus de `days` après la fin. */
export function currentDay(s: State = state) {
  return daysBetween(s.khatam.start, todayISO()) + 1;
}

export function formatDate(iso: string, withWeekday = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { ...(withWeekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', ...(withWeekday ? {} : { year: 'numeric' }) });
}

// ---- Actions ----

/** Applique un nouvel ensemble de jours terminés : enregistre la fin du khatam dans l'historique, ou l'en retire. */
function commitDone(s: State, doneSet: Set<number>, extra: Partial<State> = {}): Partial<State> {
  const done = [...doneSet].sort((a, b) => a - b);
  const k = s.khatam;
  const complete = done.length >= k.days;
  let khatam = k, history = s.history;
  if (complete && !k.finishedOn) {
    const end = todayISO();
    khatam = { ...k, finishedOn: end };
    history = [{ id: k.id, name: k.name, kind: k.kind, start: k.start, days: k.days, doneDays: done.length, end, status: 'done' }, ...history.filter((h) => h.id !== k.id)];
  } else if (!complete && k.finishedOn) {
    const { finishedOn: _f, ...rest } = k;
    khatam = rest;
    history = history.filter((h) => h.id !== k.id);
  }
  return { done, khatam, history, ...extra };
}

export function toggleSession(day: number, index: number, total: number) {
  update((s) => {
    const cur = new Set(s.sessions[day] ?? (s.done.includes(day) ? [...Array(total).keys()] : []));
    cur.has(index) ? cur.delete(index) : cur.add(index);
    const doneSet = new Set(s.done);
    cur.size >= total ? doneSet.add(day) : doneSet.delete(day);
    return commitDone(s, doneSet, { sessions: { ...s.sessions, [day]: [...cur] } });
  });
}

export function setDayDone(day: number, done: boolean) {
  update((s) => {
    const doneSet = new Set(s.done);
    done ? doneSet.add(day) : doneSet.delete(day);
    const sessions = { ...s.sessions };
    delete sessions[day];
    return commitDone(s, doneSet, { sessions });
  });
}

/** Valide le morceau de rattrapage du jour. Renvoie true si le jour rattrapé est terminé. */
export function readCatchUp(): boolean {
  const plan = state.catchPlan;
  if (!plan) return false;
  const partsDone = plan.partsDone + 1;
  if (partsDone >= plan.parts) {
    setDayDone(plan.day, true);
    update({ catchPlan: null });
    return true;
  }
  update({ catchPlan: { ...plan, partsDone, lastDay: todayISO() } });
  return false;
}

/** Vrai si le khatam en cours a déjà un début de lecture (un jour terminé ou une séance cochée). */
export const hasProgress = (s: State = state) => s.done.length > 0 || Object.values(s.sessions).some((x) => x.length > 0);

/** Commence un nouveau khatam. Le khatam en cours, s'il n'est pas terminé, est gardé dans l'historique comme interrompu. */
export function startKhatam(k: Omit<Khatam, 'id'>) {
  update((s) => {
    let history = s.history;
    const cur = s.khatam;
    if (!cur.finishedOn && hasProgress(s)) {
      history = [{ id: cur.id, name: cur.name, kind: cur.kind, start: cur.start, days: cur.days, doneDays: s.done.length, end: todayISO(), status: 'stopped' }, ...history];
    }
    return {
      history,
      khatam: { ...k, id: newId(), days: clampDays(k.days) },
      done: [], sessions: {}, catchPlan: null, shown: [],
    };
  });
}

/** Change les réglages du khatam en cours sans toucher à la progression (date de début). */
export function setKhatamStart(start: string) {
  update((s) => ({ khatam: { ...s.khatam, start, plannedStart: undefined } }));
}

/** Mode essai : commence aujourd'hui, en gardant la date prévue. */
export function startTrial() {
  update((s) => ({ khatam: { ...s.khatam, plannedStart: s.khatam.plannedStart ?? s.khatam.start, start: todayISO() }, done: [], sessions: {}, catchPlan: null, shown: [] }));
}

export function stopTrial() {
  update((s) => ({ khatam: { ...s.khatam, start: s.khatam.plannedStart ?? s.khatam.start, plannedStart: undefined, finishedOn: undefined }, done: [], sessions: {}, catchPlan: null, shown: [], history: s.history.filter((h) => h.id !== s.khatam.id) }));
}

/** Heure de rappel d'une séance : programme personnalisé (dans le programme) ou prédéfini (réglage à part). */
export function setReminderTime(programmeId: string, index: number, time: string) {
  update((s) => {
    if (programmeId === 'custom') {
      const list = s.customProgramme.map((x, i) => (i === index ? { ...x, time } : x));
      return { customProgramme: list };
    }
    return { reminderTimes: { ...s.reminderTimes, [`${programmeId}:${index}`]: time } };
  });
}
