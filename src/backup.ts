// Sauvegarde automatique et « code personnel » : sur un nouveau téléphone (ou après une réinstallation),
// le code fait tout revenir : progression, réglages, groupe (on retrouve le même compte anonyme).
//
// La sauvegarde est chiffrée sur le téléphone avec une clé tirée du code, puis rangée dans Firestore
// (backups/{empreinte du code}). Sans le code, elle est illisible et introuvable.
import { getState, update, subscribe } from './store';
import { fb, firebaseConfig } from './group';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const STATE_KEY = 'khatam-entre-soeurs';
const AUTH_KEY = `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newCode = () => {
  const c = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `KHTM-${c.slice(0, 4)}-${c.slice(4)}`;
};
/** Code tapé par la personne, remis en forme (minuscules, espaces, tirets oubliés…). */
export function cleanCode(input: string) {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^KHTM/, '');
  return c.length === 8 ? `KHTM-${c.slice(0, 4)}-${c.slice(4)}` : '';
}

/** Identifiant de la sauvegarde et clé de chiffrement, tirés du code. */
async function keysOf(code: string) {
  const id = hex(await crypto.subtle.digest('SHA-256', enc.encode(`khatm-sauvegarde-id:${code}`)));
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`khatm-sauvegarde-cle:${code}`));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id, key };
}

let last = '';
let timer: number | undefined;

async function save() {
  const s = getState();
  if (!s.onboarded) return;
  let code = s.backupCode;
  if (!code) { code = newCode(); update({ backupCode: code }); }
  try {
    const { db, fs, auth, uid } = await fb();
    const payload = JSON.stringify({ v: 1, state: getState(), auth: auth.currentUser?.toJSON() ?? null });
    if (payload === last) return;
    const { id, key } = await keysOf(code);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload));
    await fs.setDoc(fs.doc(db, 'backups', id), { owner: uid, iv: b64(iv), ct: b64(ct), at: fs.serverTimestamp() });
    last = payload;
  } catch { /* hors connexion : on réessaiera au prochain changement */ }
}

/** Sauvegarde quelques secondes après chaque série de changements. */
export function startBackup() {
  const plan = (delay: number) => { window.clearTimeout(timer); timer = window.setTimeout(() => void save(), delay); };
  subscribe(() => plan(5000));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void save(); });
  plan(4000);
}

/**
 * Retrouver une progression avec un code : remplace tout ce qui est sur ce téléphone,
 * reprend le même compte (groupe, rôle d'administratrice), puis recharge l'appli.
 */
export async function restore(input: string): Promise<'ok' | 'code' | 'introuvable' | 'reseau'> {
  const code = cleanCode(input);
  if (!code) return 'code';
  try {
    const { db, fs, auth } = await fb();
    const { id, key } = await keysOf(code);
    const snap = await fs.getDoc(fs.doc(db, 'backups', id));
    if (!snap.exists()) return 'introuvable';
    const d = snap.data();
    const data = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, key, unb64(d.ct))));
    const state = { ...data.state, backupCode: code, backupNoted: true };
    // Le compte de ce téléphone laisse la place à celui de la sauvegarde.
    await auth.signOut();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    if (data.auth) localStorage.setItem(AUTH_KEY, JSON.stringify(data.auth));
    location.reload();
    return 'ok';
  } catch {
    return 'reseau';
  }
}
