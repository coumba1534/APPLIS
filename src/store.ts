// État de l'appli, enregistré sur le téléphone (localStorage).
// Les groupes et la synchronisation en ligne arriveront avec Firebase.
import { useEffect, useState } from 'preact/hooks';
import type { ReaderTarget } from './screens/Reader';
import { clampDays, portion, portionPages } from './data/khatam';
import type { CustomSession } from './data/programmes';
import { addDays, daysBetween, todayISO } from './dates';
import { ramadanStart, ramadanName, ramadanEnd, ramadanTest, setRamadanTest, daysToRamadan, RAMADAN_KHATAM_DAYS } from './config';

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
  /** Ramadan : le début suit la date annoncée à distance, tant qu'on ne l'a pas modifié soi-même. */
  followsConfig?: boolean;
  /** Khatam personnel : périodes de pause (pendant le Ramadan, si on suit le khatam du Ramadan). */
  pauses?: Pause[];
}

/** Une pause du khatam personnel, du `from` au `to` inclus. `test` : issue d'un Ramadan simulé. */
export interface Pause { from: string; to: string; test?: boolean }

/** Le khatam du Ramadan : 29 jours, à côté du khatam personnel (qui est mis en pause pendant le mois). */
export interface RamadanState {
  khatam: Khatam;
  done: number[];
  sessions: Record<string, number[]>;
  catchPlan: CatchPlan | null;
  /** Jour où on l'a rejoint. */
  joinedOn: string;
  /** Le parcours d'accueil du Ramadan a été fait. */
  welcomed?: boolean;
  /** Rythme choisi pour le Ramadan (indépendant du programme habituel). */
  programme?: string;
  /** Rythme personnalisé : les moments choisis. */
  moments?: string[];
  /** Intention (facultative), rappelée chaque jour sur la carte du Ramadan. */
  niyya?: string;
  /** Rappels en plus : encouragement du soir, les 10 dernières nuits. */
  extras?: { evening: boolean; last10: boolean };
}

/** Les deux suivis possibles : le khatam personnel et celui du Ramadan. */
export type TrackId = 'personal' | 'ramadan';
export interface Track { id: TrackId; khatam: Khatam; done: number[]; sessions: Record<string, number[]>; catchPlan: CatchPlan | null }

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
  /** Progression au moment de l'arrêt, pour pouvoir reprendre un khatam interrompu. */
  progress?: { done: number[]; sessions: Record<string, number[]>; catchPlan: CatchPlan | null };
}

export type Gender = 'f' | 'm';

export interface State {
  version: 2;
  onboarded: boolean;
  name: string;
  /** Homme ou femme : les groupes ne sont pas mixtes (null tant que la question n'a pas été posée). */
  gender: Gender | null;
  groupCode: string;
  programmeId: string;
  /** Séances du programme personnalisé. */
  customProgramme: CustomSession[];
  /** Date du Ramadan pour laquelle on a masqué le bandeau « Le Ramadan approche ». */
  hideRamadanBanner: string | null;
  /** Le khatam personnel en cours (un seul à la fois), ou null s'il n'y en a pas. */
  khatam: Khatam | null;
  /** Le khatam du Ramadan, si on l'a rejoint. */
  ramadan: RamadanState | null;
  /** Message à afficher après la fin du Ramadan (khatam terminé ou non). */
  ramadanEnded: { name: string; doneDays: number; days: number; finished: boolean; test?: boolean } | null;
  /** Notifications ponctuelles déjà envoyées (annonce du Ramadan, premier jour…). */
  notified: string[];
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

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Khatam du Ramadan : 30 jours, 1 juz par jour. Par défaut, il suit la date annoncée à distance. */
export function ramadanKhatam(start = ramadanStart()): Khatam {
  return { id: newId(), kind: 'ramadan', name: 'Ramadan', start, days: 30, followsConfig: start === ramadanStart() };
}

/** Khatam d'un mois qui commence aujourd'hui : le point de départ avant le premier choix. */
export const monthKhatam = (): Khatam => ({ id: newId(), kind: 'custom', name: "Khatm d'un mois", start: todayISO(), days: 30 });

const initial: State = {
  version: 2,
  onboarded: false,
  name: '',
  gender: null,
  groupCode: '',
  programmeId: 'p1',
  customProgramme: [],
  khatam: monthKhatam(),
  ramadan: null,
  ramadanEnded: null,
  notified: [],
  history: [],
  hideRamadanBanner: null,
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
  const start = (old.trialStart as string | null) ?? (old.ramadanStart as string | undefined) ?? ramadanStart();
  const khatam: Khatam = { ...ramadanKhatam(start), ...(old.trialStart ? { plannedStart: (old.ramadanStart as string) ?? ramadanStart() } : {}) };
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

/** Nouveau nom (« khatm ») dans les noms déjà enregistrés : « Khatam de 2 mois » devient « Khatm de 2 mois ». */
function renameKhatm(s: State): State {
  const fix = (n: string) => n.replace(/\bKhatam\b/g, 'Khatm').replace(/\bkhatam\b/g, 'khatm');
  return {
    ...s,
    khatam: s.khatam ? { ...s.khatam, name: fix(s.khatam.name) } : s.khatam,
    history: s.history.map((h) => ({ ...h, name: fix(h.name) })),
  };
}

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return renameKhatm(data.version === 2 && data.khatam ? { ...initial, ...data } : migrate(data));
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

export { todayISO, addDays, daysBetween };

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);
/** Nombre de jours communs aux périodes [from, to] et [a, b] (bornes incluses). */
function overlap(from: string, to: string, a: string, b: string) {
  const x = later(from, a), y = earlier(to, b);
  return x > y ? 0 : daysBetween(x, y) + 1;
}

/**
 * Pause en cours ou à venir du khatam personnel : pendant le Ramadan, si on a rejoint son khatam.
 * Elle commence au 1er jour du Ramadan (ou au jour où on l'a rejoint) et finit au dernier jour du mois.
 */
export function livePause(s: State = state): Pause | null {
  if (!s.ramadan || !s.khatam) return null;
  const from = later(s.ramadan.khatam.start, s.ramadan.joinedOn);
  const to = ramadanEnd();
  return from > to ? null : { from, to, test: !!ramadanTest() };
}
const pausesOf = (s: State) => [...(s.khatam?.pauses ?? []), ...(livePause(s) ? [livePause(s)!] : [])];
const pausedDays = (s: State, a: string, b: string) => pausesOf(s).reduce((t, p) => t + overlap(p.from, p.to, a, b), 0);

/** Vrai si le khatam personnel est en pause aujourd'hui (Ramadan). */
export function isPaused(s: State = state) {
  const t = todayISO();
  return !!s.khatam && t >= s.khatam.start && pausesOf(s).some((p) => p.from <= t && t <= p.to);
}
/** Fin de la pause en cours : le khatam personnel reprend le lendemain. */
export function pauseEnd(s: State = state) {
  const t = todayISO();
  return pausesOf(s).find((p) => p.from <= t && t <= p.to)?.to ?? null;
}

/** Dernier jour d'un khatam (le khatam personnel est prolongé de ses jours de pause). */
export const endDate = (k: Khatam, s: State = state) =>
  addDays(k.start, k.days - 1 + (s.khatam && k.id === s.khatam.id ? pausedDays(s, k.start, '9999-12-31') : 0));

/**
 * Jour du khatam : 1 à `days`, 0 ou moins avant le début, plus de `days` après la fin (0 sans khatam).
 * Les jours de pause ne comptent pas : le calendrier du khatam personnel se décale pendant le Ramadan.
 */
export function currentDay(s: State = state, id: TrackId = 'personal') {
  const t = todayISO();
  if (id === 'ramadan') return s.ramadan ? daysBetween(s.ramadan.khatam.start, t) + 1 : 0;
  if (!s.khatam) return 0;
  const raw = daysBetween(s.khatam.start, t) + 1;
  return raw < 1 ? raw : raw - pausedDays(s, s.khatam.start, t);
}

/** Le suivi demandé (khatam personnel ou du Ramadan), ou null s'il n'existe pas. */
export function getTrack(s: State, id: TrackId): Track | null {
  if (id === 'personal') return s.khatam ? { id, khatam: s.khatam, done: s.done, sessions: s.sessions, catchPlan: s.catchPlan } : null;
  return s.ramadan ? { id, khatam: s.ramadan.khatam, done: s.ramadan.done, sessions: s.ramadan.sessions, catchPlan: s.ramadan.catchPlan } : null;
}
type TrackPatch = Partial<Pick<Track, 'khatam' | 'done' | 'sessions' | 'catchPlan'>>;
function patchTrack(s: State, id: TrackId, p: TrackPatch): Partial<State> {
  if (id === 'ramadan') return s.ramadan ? { ramadan: { ...s.ramadan, ...p } } : {};
  return { ...p } as Partial<State>;
}

/** Le Ramadan est-il en cours pour ce khatam du Ramadan (du 1er jour au dernier jour du mois) ? */
export function ramadanActive(s: State = state) {
  const t = todayISO();
  return !!s.ramadan && t >= s.ramadan.khatam.start && t <= ramadanEnd();
}

/** Vrai si un khatam personnel est en cours (commencé ou à venir, pas terminé). */
export const hasActiveKhatam = (s: State = state) => !!s.khatam && !s.khatam.finishedOn;

export function formatDate(iso: string, withWeekday = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { ...(withWeekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', ...(withWeekday ? {} : { year: 'numeric' }) });
}

// ---- Actions ----

/** Applique un nouvel ensemble de jours terminés : enregistre la fin du khatam dans l'historique, ou l'en retire. */
function commitDone(s: State, id: TrackId, doneSet: Set<number>, extra: TrackPatch = {}): Partial<State> {
  const done = [...doneSet].sort((a, b) => a - b);
  const t = getTrack(s, id);
  if (!t) return {};
  const k = t.khatam;
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
  // Un jour terminé autrement (séances cochées, « Je l'ai déjà lu ») n'a plus besoin de son rattrapage.
  const plan = 'catchPlan' in extra ? extra.catchPlan : t.catchPlan;
  const catchPlan = plan && doneSet.has(plan.day) ? null : plan;
  return { ...patchTrack(s, id, { done, khatam, ...extra, catchPlan }), history };
}

export function toggleSession(day: number, index: number, total: number, id: TrackId = 'personal') {
  update((s) => {
    const t = getTrack(s, id);
    if (!t) return {};
    const cur = new Set(t.sessions[day] ?? (t.done.includes(day) ? [...Array(total).keys()] : []));
    cur.has(index) ? cur.delete(index) : cur.add(index);
    const doneSet = new Set(t.done);
    cur.size >= total ? doneSet.add(day) : doneSet.delete(day);
    return commitDone(s, id, doneSet, { sessions: { ...t.sessions, [day]: [...cur] } });
  });
}

export function setDayDone(day: number, done: boolean, id: TrackId = 'personal') {
  update((s) => {
    const t = getTrack(s, id);
    if (!t) return {};
    const doneSet = new Set(t.done);
    done ? doneSet.add(day) : doneSet.delete(day);
    const sessions = { ...t.sessions };
    delete sessions[day];
    return commitDone(s, id, doneSet, { sessions });
  });
}

export function setCatchPlan(plan: CatchPlan | null, id: TrackId = 'personal') {
  update((s) => patchTrack(s, id, { catchPlan: plan }));
}

/** Valide le morceau de rattrapage du jour. Renvoie true si le jour rattrapé est terminé. */
export function readCatchUp(id: TrackId = 'personal'): boolean {
  const plan = getTrack(state, id)?.catchPlan;
  if (!plan) return false;
  const partsDone = plan.partsDone + 1;
  if (partsDone >= plan.parts) {
    setDayDone(plan.day, true, id);
    setCatchPlan(null, id);
    return true;
  }
  setCatchPlan({ ...plan, partsDone, lastDay: todayISO() }, id);
  return false;
}

/** Vrai si le khatam a déjà un début de lecture (un jour terminé ou une séance cochée). */
export const hasProgress = (s: State = state, id: TrackId = 'personal') => {
  const t = getTrack(s, id);
  return !!t && (t.done.length > 0 || Object.values(t.sessions).some((x) => x.length > 0));
};

/** Le khatam en cours, tel qu'on le range dans l'historique s'il est interrompu (null s'il n'a pas commencé ou s'il est terminé). */
function interruptedEntry(s: State): HistoryItem | null {
  const cur = s.khatam;
  if (!cur || cur.finishedOn || !hasProgress(s)) return null;
  return {
    id: cur.id, name: cur.name, kind: cur.kind, start: cur.start, days: cur.days, doneDays: s.done.length, end: todayISO(), status: 'stopped',
    progress: { done: s.done, sessions: s.sessions, catchPlan: s.catchPlan },
  };
}

/** Premier jour pas encore lu d'un khatam interrompu : c'est là qu'on reprend. */
export function resumeDay(item: HistoryItem) {
  const done = new Set(item.progress?.done ?? []);
  let d = 1;
  while (done.has(d) && d < item.days) d++;
  return d;
}

/**
 * Reprend un khatam interrompu : il redevient le khatam en cours, avec sa progression.
 * Le calendrier est décalé pour qu'aujourd'hui tombe sur le premier jour pas encore lu.
 * Possible seulement s'il n'y a pas de khatam personnel en cours.
 */
export function resumeKhatam(id: string) {
  update((s) => {
    const item = s.history.find((h) => h.id === id && h.status === 'stopped');
    if (!item || hasActiveKhatam(s)) return {}; // un seul khatam personnel à la fois
    const history = s.history.filter((h) => h.id !== id);
    return {
      history,
      khatam: { id: item.id, kind: item.kind, name: item.name, days: item.days, start: addDays(todayISO(), -(resumeDay(item) - 1)), followsConfig: false },
      done: item.progress?.done ?? [],
      sessions: item.progress?.sessions ?? {},
      catchPlan: item.progress?.catchPlan ?? null,
      shown: [],
    };
  });
}

/** Retire un khatam de l'historique. */
export function deleteHistoryItem(id: string) {
  update((s) => ({ history: s.history.filter((h) => h.id !== id) }));
}

/** Commence un nouveau khatam. Le khatam en cours, s'il n'est pas terminé, est gardé dans l'historique comme interrompu. */
export function startKhatam(k: Omit<Khatam, 'id'>) {
  update((s) => {
    const stopped = interruptedEntry(s);
    const history = stopped ? [stopped, ...s.history] : s.history;
    return {
      history,
      khatam: { ...k, id: newId(), days: clampDays(k.days), followsConfig: k.kind === 'ramadan' && k.start === ramadanStart() },
      done: [], sessions: {}, catchPlan: null, shown: [],
    };
  });
}

/** Change les réglages du khatam en cours sans toucher à la progression (date de début). */
export function setKhatamStart(start: string) {
  update((s) => (s.khatam ? { khatam: { ...s.khatam, start, plannedStart: undefined, followsConfig: false } } : {}));
}

/**
 * Arrête le khatam personnel en cours.
 * `keep` : il est gardé dans l'historique (comme interrompu, on pourra le reprendre) ; sinon il est supprimé.
 */
export function stopKhatam(keep: boolean) {
  update((s) => {
    const stopped = keep ? interruptedEntry(s) : null;
    return { khatam: null, history: stopped ? [stopped, ...s.history] : s.history, done: [], sessions: {}, catchPlan: null, shown: [] };
  });
}

/** Mode essai : commence aujourd'hui, en gardant la date prévue. */
export function startTrial() {
  update((s) => !s.khatam ? {} : ({ khatam: { ...s.khatam, plannedStart: s.khatam.plannedStart ?? s.khatam.start, start: todayISO() }, done: [], sessions: {}, catchPlan: null, shown: [] }));
}

export function stopTrial() {
  update((s) => !s.khatam ? {} : ({ khatam: { ...s.khatam, start: s.khatam.plannedStart ?? s.khatam.start, plannedStart: undefined, finishedOn: undefined }, done: [], sessions: {}, catchPlan: null, shown: [], history: s.history.filter((h) => h.id !== s.khatam!.id) }));
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

/**
 * Quand la date du Ramadan change à distance (annonce de la lune), les khatams du Ramadan
 * qui n'ont pas encore commencé et dont la date n'a pas été modifiée suivent la nouvelle date.
 */
export function syncRamadanStart() {
  const s = state, target = ramadanStart(), today = todayISO();
  const k = s.khatam;
  if (k && k.kind === 'ramadan' && k.followsConfig && !k.plannedStart && k.start !== target && daysBetween(today, k.start) > 0) {
    update({ khatam: { ...k, start: target } });
  }
  const r = state.ramadan;
  if (r && r.khatam.followsConfig && r.khatam.start !== target && (daysBetween(today, r.khatam.start) > 0 || isTestRamadan(r))) {
    update({ ramadan: { ...r, khatam: { ...r.khatam, start: target } } });
  }
}

// ---- Khatam du Ramadan ----

const isTestRamadan = (r: RamadanState) => r.khatam.id.endsWith('-essai');

/** Identifiant du khatam du Ramadan de cette année (ou du Ramadan simulé). */
export const currentRamadanId = () => `ramadan-${ramadanStart()}${ramadanTest() ? '-essai' : ''}`;

/** Le khatam qu'on lit en ce moment : celui du Ramadan pendant le mois (si on l'a rejoint), sinon le personnel (s'il n'est pas en pause). */
export function activeTrackId(s: State = state): TrackId | null {
  if (ramadanActive(s)) return 'ramadan';
  return s.khatam && !isPaused(s) ? 'personal' : null;
}

/** Rejoint le khatam du Ramadan : 29 jours. Le khatam personnel sera en pause pendant le mois. */
/** Khatam du Ramadan de cette année déjà terminé (on ne le propose plus). */
export const ramadanDoneThisYear = (s: State = state) => s.history.some((h) => h.id === currentRamadanId() && h.status === 'done');

/** On peut rejoindre le khatam du Ramadan seulement une fois le mois commencé, et jusqu'à son dernier jour. */
export const canJoinRamadan = (s: State = state) =>
  !s.ramadan && !ramadanDoneThisYear(s) && daysToRamadan() <= 0 && todayISO() <= ramadanEnd();

/** Rejoint (ou recommence à zéro) le khatam du Ramadan : les jours déjà passés sont à rattraper. */
export function joinRamadan() {
  update((s) => {
    if (!canJoinRamadan(s)) return {};
    const start = ramadanStart();
    return {
      // Recommencer après avoir quitté : l'ancien essai interrompu laisse la place au nouveau.
      history: s.history.filter((h) => h.id !== currentRamadanId()),
      // La pause figée en quittant ne doit pas compter deux fois les jours de la nouvelle pause.
      ...(s.khatam?.pauses?.length ? { khatam: { ...s.khatam, pauses: s.khatam.pauses
        .map((p) => (p.to >= todayISO() ? { ...p, to: addDays(todayISO(), -1) } : p))
        .filter((p) => p.from <= p.to) } } : {}),
      ramadan: {
        khatam: { id: currentRamadanId(), kind: 'ramadan', name: ramadanName(), start, days: RAMADAN_KHATAM_DAYS, followsConfig: true },
        done: [], sessions: {}, catchPlan: null, joinedOn: todayISO(),
      },
    };
  });
}

/** La pause du khatam personnel, figée jusqu'à `to` (inclus), ajoutée à ses pauses. */
function freezePause(s: State, to: string): Partial<State> {
  const p = livePause(s);
  if (!p || !s.khatam) return {};
  const end = earlier(p.to, to);
  if (end < p.from) return {};
  return { khatam: { ...s.khatam, pauses: [...(s.khatam.pauses ?? []), { ...p, to: end }] } };
}

/** Enregistre les choix du parcours d'accueil du Ramadan. */
export function setRamadanSetup(p: Partial<Pick<RamadanState, 'welcomed' | 'programme' | 'moments' | 'niyya' | 'extras'>>) {
  update((s) => (s.ramadan ? { ramadan: { ...s.ramadan, ...p } } : {}));
}

/** Quitte le khatam du Ramadan avant la fin : le khatam personnel reprend dès demain. */
export function leaveRamadan() {
  update((s) => {
    const r = s.ramadan;
    if (!r) return {};
    const k = r.khatam;
    const history = r.done.length > 0 && !k.finishedOn
      ? [{ id: k.id, name: k.name, kind: k.kind, start: k.start, days: k.days, doneDays: r.done.length, end: todayISO(), status: 'stopped' as const }, ...s.history]
      : s.history;
    return { ...freezePause(s, todayISO()), history, ramadan: null };
  });
}

/**
 * Après le dernier jour du Ramadan : le khatam du Ramadan s'arrête (les jours non lus disparaissent),
 * il passe dans l'historique, un message s'affiche, et le khatam personnel reprend.
 */
export function closeRamadanIfOver() {
  const s = state, r = s.ramadan;
  if (!r || daysBetween(ramadanEnd(), todayISO()) <= 0) return;
  const k = r.khatam, finished = !!k.finishedOn, test = isTestRamadan(r);
  const history = finished ? s.history
    : [{ id: k.id, name: k.name, kind: k.kind, start: k.start, days: k.days, doneDays: r.done.length, end: ramadanEnd(), status: 'stopped' as const }, ...s.history.filter((h) => h.id !== k.id)];
  update({
    ...freezePause(s, ramadanEnd()),
    history,
    ramadan: null,
    ramadanEnded: { name: k.name, doneDays: r.done.length, days: k.days, finished, test },
  });
}

/** Outils de test : simule un Ramadan qui commence à `start` (sur ce téléphone seulement), ou arrête la simulation. */
export function simulateRamadan(start: string | null) {
  setRamadanTest(start);
  if (start === null) {
    update((s) => ({
      ramadan: s.ramadan && isTestRamadan(s.ramadan) ? null : s.ramadan,
      history: s.history.filter((h) => !h.id.endsWith('-essai')),
      khatam: s.khatam ? { ...s.khatam, pauses: (s.khatam.pauses ?? []).filter((p) => !p.test) } : null,
      ramadanEnded: s.ramadanEnded?.test ? null : s.ramadanEnded,
      notified: s.notified.filter((n) => !n.endsWith('-essai')),
      hideRamadanBanner: null,
    }));
    return;
  }
  const r = state.ramadan;
  if (r && isTestRamadan(r)) update({ ramadan: { ...r, khatam: { ...r.khatam, start } } });
  closeRamadanIfOver();
}
