// Réglages à distance : un petit fichier (config.json) lu à chaque ouverture de l'appli.
// On peut le modifier sur GitHub sans mettre l'appli à jour. Hors connexion, on garde le dernier réglage connu.
//
//   ramadan.start          : 1er jour du Ramadan (à corriger après l'annonce de la lune)
//   ramadan.showDaysBefore : nombre de jours avant le Ramadan où ses fonctions apparaissent
//   ramadan.enabled        : null = automatique, true = toujours visible, false = toujours masqué
import { useEffect, useState } from 'preact/hooks';
import { addDays, daysBetween, isISODate, todayISO } from './dates';

export interface Config {
  ramadan: { start: string; showDaysBefore: number; enabled: boolean | null };
}

/** Début estimé du Ramadan 1448, utilisé tant qu'aucun réglage n'a pu être lu. */
export const FALLBACK_RAMADAN_START = '2027-02-08';
/** Le Ramadan dure 29 ou 30 jours ; on garde ses fonctions visibles un peu après la fin. */
const RAMADAN_DAYS = 30;
const AFTER_DAYS = 7;

const DEFAULT: Config = { ramadan: { start: FALLBACK_RAMADAN_START, showDaysBefore: 30, enabled: null } };
const KEY = 'khatam-config';

/** Ne garde que des valeurs valides : un fichier mal écrit ne doit jamais casser l'appli. */
export function sanitize(raw: unknown): Config {
  const r = (raw as { ramadan?: Record<string, unknown> } | null)?.ramadan ?? {};
  const days = Number(r.showDaysBefore);
  return {
    ramadan: {
      start: isISODate(r.start) ? r.start : DEFAULT.ramadan.start,
      showDaysBefore: Number.isInteger(days) && days >= 0 && days <= 365 ? days : DEFAULT.ramadan.showDaysBefore,
      enabled: typeof r.enabled === 'boolean' ? r.enabled : null,
    },
  };
}

function readSaved(): Config {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* ignoré */ }
  return DEFAULT;
}

let config: Config = readSaved();
const listeners = new Set<() => void>();

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
    listeners.forEach((l) => l());
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

export const ramadanStart = () => config.ramadan.start;

/** Dernier jour du Ramadan. */
export const ramadanEnd = () => addDays(config.ramadan.start, RAMADAN_DAYS - 1);

/** Jours restants avant le Ramadan (négatif ou nul une fois commencé). */
export const daysToRamadan = (today = todayISO()) => daysBetween(today, config.ramadan.start);

/** Vrai quand les fonctions du Ramadan doivent apparaître : à l'approche, pendant, et peu après. */
export function ramadanVisible(today = todayISO()): boolean {
  const { enabled, showDaysBefore } = config.ramadan;
  if (enabled !== null) return enabled;
  return daysBetween(today, config.ramadan.start) <= showDaysBefore && daysBetween(today, ramadanEnd()) >= -AFTER_DAYS;
}
