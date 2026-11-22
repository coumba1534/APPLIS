// Réglages à distance : un petit fichier (config.json) lu à chaque ouverture de l'appli.
// On peut le modifier sur GitHub sans mettre l'appli à jour. Hors connexion, on garde le dernier réglage connu.
//
//   ramadan.start          : 1er jour du Ramadan (date estimée, à corriger après l'annonce de la lune)
//   ramadan.days           : durée du mois de Ramadan, 29 ou 30 (null tant que ce n'est pas annoncé : 30 par prudence)
//   ramadan.name           : nom affiché, par exemple « Ramadan 1448 »
//   ramadan.showDaysBefore : nombre de jours avant le Ramadan où son khatam est annoncé
//   ramadan.enabled        : null = automatique, true = toujours visible, false = toujours masqué
//   testMode               : affiche les outils de test (simulation d'un Ramadan sur son propre téléphone)
import { useEffect, useState } from 'preact/hooks';
import { addDays, daysBetween, isISODate, todayISO } from './dates';

export interface Config {
  ramadan: { start: string; days: 29 | 30 | null; name: string; showDaysBefore: number; enabled: boolean | null };
  testMode: boolean;
}

/** Début estimé du Ramadan 1448, utilisé tant qu'aucun réglage n'a pu être lu. */
export const FALLBACK_RAMADAN_START = '2027-02-08';
/** Le khatam du Ramadan se fait en 29 jours, comme dans les mosquées. */
export const RAMADAN_KHATAM_DAYS = 29;
/** Après le Ramadan, on garde encore un peu le bandeau (pour ceux qui découvrent l'appli). */
const AFTER_DAYS = 0;

const DEFAULT: Config = {
  ramadan: { start: FALLBACK_RAMADAN_START, days: null, name: 'Ramadan 1448', showDaysBefore: 10, enabled: null },
  testMode: false,
};
const KEY = 'khatam-config';
const TEST_KEY = 'khatam-ramadan-test';

/** Ne garde que des valeurs valides : un fichier mal écrit ne doit jamais casser l'appli. */
export function sanitize(raw: unknown): Config {
  const root = (raw as Record<string, unknown> | null) ?? {};
  const r = (root.ramadan as Record<string, unknown> | undefined) ?? {};
  const days = Number(r.showDaysBefore);
  return {
    ramadan: {
      start: isISODate(r.start) ? r.start : DEFAULT.ramadan.start,
      days: r.days === 29 || r.days === 30 ? r.days : null,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : DEFAULT.ramadan.name,
      showDaysBefore: Number.isInteger(days) && days >= 0 && days <= 365 ? days : DEFAULT.ramadan.showDaysBefore,
      enabled: typeof r.enabled === 'boolean' ? r.enabled : null,
    },
    testMode: root.testMode === true,
  };
}

function readSaved(): Config {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* ignoré */ }
  return DEFAULT;
}

/** Ramadan simulé sur ce téléphone seulement (outils de test) : date de début, ou null. */
function readTest(): string | null {
  try { const v = localStorage.getItem(TEST_KEY); return isISODate(v) ? v : null; } catch { return null; }
}

let config: Config = readSaved();
let testStart: string | null = readTest();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const getConfig = () => config;

/** Lit config.json (toujours depuis le réseau) et prévient l'appli si quelque chose a changé. */
export async function loadConfig() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const next = sanitize(await res.json());
    if (JSON.stringify(next) === JSON.stringify(config)) return;
    config = next;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignoré */ }
    notify();
  } catch { /* hors connexion : on garde le dernier réglage */ }
}

export function useConfig(): Config {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return config;
}

// ---- Simulation (outils de test) ----

export const ramadanTest = () => testStart;
export function setRamadanTest(start: string | null) {
  testStart = start;
  try { start ? localStorage.setItem(TEST_KEY, start) : localStorage.removeItem(TEST_KEY); } catch { /* ignoré */ }
  notify();
}

// ---- Le Ramadan ----

/** 1er jour du Ramadan (simulé si un test est en cours). */
export const ramadanStart = () => testStart ?? config.ramadan.start;
export const ramadanName = () => (testStart ? 'Ramadan (essai)' : config.ramadan.name);
/** Durée du mois : 29 ou 30 jours (30 tant que ce n'est pas annoncé). */
export const ramadanMonthDays = () => (testStart ? 30 : config.ramadan.days ?? 30);
/** Dernier jour du mois de Ramadan (jusqu'à ce jour, on peut rattraper son khatam). */
export const ramadanEnd = () => addDays(ramadanStart(), ramadanMonthDays() - 1);
/** Jour de l'Aïd : le lendemain du dernier jour du Ramadan. */
export const eidDate = () => addDays(ramadanEnd(), 1);

/** Jours restants avant le Ramadan (négatif ou nul une fois commencé). */
export const daysToRamadan = (today = todayISO()) => daysBetween(today, ramadanStart());

/** Vrai quand le khatam du Ramadan est proposé : à l'approche (10 jours avant) et pendant le mois. */
export function ramadanVisible(today = todayISO()): boolean {
  const afterEnd = daysBetween(ramadanEnd(), today) > AFTER_DAYS;
  if (testStart) return !afterEnd;
  const { enabled, showDaysBefore } = config.ramadan;
  if (enabled !== null) return enabled && !afterEnd;
  return daysBetween(today, ramadanStart()) <= showDaysBefore && !afterEnd;
}
