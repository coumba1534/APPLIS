// Notifications même appli fermée : abonnement du téléphone et liste des prochains rappels,
// envoyés au programme Cloudflare (push/worker.js) qui les expédie à l'heure.
import { getState, subscribe as onStore, todayISO, addDays, daysBetween, getTrack, currentRamadanId, currentDay, livePause } from './store';
import type { State, TrackId } from './store';
import { ramadanStart, ramadanEnd, ramadanVisible, ramadanName, RAMADAN_KHATAM_DAYS } from './config';
import { programmeOf, sessionsFor } from './data/programmes';
import { portion, juzTitle, pagesLabel } from './data/khatam';
import { timeFor } from './device';

export const PUSH_URL = 'https://khatm-push.khatm-app.workers.dev';
export const VAPID_PUBLIC = 'BGEH3Ui3kdZMYm91l3XUOmbaQjnKvw2Nz9Dgf74SUoVu8m-zZ9YC8Q-CsoIki5SZaF_uqlWOD3XcQUbtmi_8MgY';
const ID_KEY = 'khatm-push-id';
const ON_KEY = 'khatm-push-actif';
const DAYS_AHEAD = 14;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } },
};

/** Identifiant anonyme de ce téléphone pour le programme d'envoi (aléatoire, sans lien avec la personne). */
function deviceId() {
  let id = ls.get(ID_KEY);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
    ls.set(ID_KEY, id);
  }
  return id;
}

/** Vrai quand les notifications passent par le programme Cloudflare (l'appli n'envoie plus les siennes). */
export const pushActive = () => ls.get(ON_KEY) === '1';
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const post = (path: string, body: unknown) =>
  fetch(PUSH_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => null);

const keyBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Abonne ce téléphone (notifications autorisées), puis envoie les prochains rappels. */
export async function enablePush(idToken?: string) {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
    const r = await post('/subscribe', { id: deviceId(), sub: sub.toJSON(), idToken });
    if (!r?.ok) return false;
    ls.set(ON_KEY, '1');
    lastSent = '';
    await sendSchedule();
    return true;
  } catch {
    return false;
  }
}

/** Relie ce téléphone à la connexion Firebase (pour recevoir les messages de groupe). */
export async function linkPushToAccount(idToken: string) {
  if (pushActive()) await enablePush(idToken);
}

/** Rappel de test envoyé par le programme d'envoi, tout de suite ou dans `delay` secondes. */
export async function testPush(delay = 0) {
  const r = await post('/test', { id: deviceId(), delay });
  return !!r?.ok;
}

/** Message de groupe à un autre membre (vérifié par le programme d'envoi). */
export async function pushGroupMessage(p: { idToken: string; target: string; type: 'request' | 'accepted' | 'refused' | 'removed'; groupId: string; from?: string }) {
  await post('/notify', p);
}

// ---- Les rappels des 14 prochains jours ----

type Item = { at: number; title: string; body: string; tag: string };

const atTime = (date: string, hhmm: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};

/** Le khatm personnel est-il en pause ce jour-là (Ramadan) ? */
function personalPausedOn(s: State, date: string) {
  const pauses = [...(s.khatam?.pauses ?? []), ...(livePause(s) ? [livePause(s)!] : [])];
  return pauses.some((p) => p.from <= date && date <= p.to);
}

/** Rappels des séances (et du soir) d'un suivi pour un jour donné. */
function dayItems(s: State, id: TrackId, date: string, day: number, items: Item[]) {
  const t = getTrack(s, id);
  if (!t || t.khatam.finishedOn) return;
  const N = t.khatam.days;
  if (day < 1 || day > N || t.done.includes(day)) return;
  const prog = programmeOf(s, id);
  const checked = new Set(t.sessions[day] ?? []);
  const prefix = id === 'ramadan' ? '🌙 ' : '';
  const p = portion(N, day);
  if (s.reminders.sessions) {
    for (const sess of sessionsFor(prog, p)) {
      if (checked.has(sess.index)) continue;
      items.push({
        at: atTime(date, timeFor(prog.id, sess.index, sess.defaultTime)),
        title: `${prefix}${sess.label} · ${juzTitle(...p) ?? `Jour ${day}`}`,
        body: `${sess.detail ? sess.detail + ', ' : ''}pages ${sess.pageFrom} à ${sess.pageTo} (${pagesLabel(sess.pages)}). Bismillah !`,
        tag: `${date}:${id}:s${sess.index}`,
      });
    }
  }
  const evening = id === 'ramadan' ? s.ramadan?.extras?.evening !== false : s.reminders.lateEvening;
  if (evening) {
    items.push({
      at: atTime(date, id === 'ramadan' ? '22:30' : '21:00'),
      title: `${prefix}Jour ${day} pas encore terminé`,
      body: 'Il reste encore un peu de temps ce soir, courage !',
      tag: `${date}:${id}:soir`,
    });
  }
}

export function buildSchedule(s: State = getState()): Item[] {
  const items: Item[] = [];
  const today = todayISO();
  const rStart = ramadanStart(), rEnd = ramadanEnd();
  // Jour du khatm personnel pour chaque date : il n'avance pas les jours de pause.
  let pDay = s.khatam ? currentDay(s, 'personal') : 0;
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    if (i > 0 && s.khatam && !personalPausedOn(s, date) && date >= s.khatam.start) pDay++;
    const inRamadan = date >= rStart && date <= addDays(rStart, RAMADAN_KHATAM_DAYS - 1);
    if (s.ramadan && inRamadan) dayItems(s, 'ramadan', date, daysBetween(s.ramadan.khatam.start, date) + 1, items);
    else if (s.khatam && !personalPausedOn(s, date)) dayItems(s, 'personal', date, pDay, items);
    if (s.group) {
      const gDay = daysBetween(s.group.khatam.start, date) + 1;
      if (!(date >= rStart && date <= rEnd)) dayItems(s, 'group', date, gDay, items);
    }
  }
  // Ramadan : annonce, ouverture, veille des 10 dernières nuits.
  const rid = currentRamadanId();
  const doneThisYear = s.history.some((h) => h.id === rid);
  const announce = addDays(rStart, -10);
  if (!s.ramadan && !doneThisYear && announce >= today && ramadanVisible(announce)) {
    items.push({ at: atTime(announce, '10:00'), title: `${ramadanName()} approche 🌙`, body: `Il commence le ${rStart.split('-').reverse().join('/')}, selon l'annonce de la lune. Faites votre khatm du Ramadan seul ou en groupe : les groupes du Ramadan ouvrent 3 jours avant.`, tag: `annonce:${rid}` });
  }
  if (!s.ramadan && !doneThisYear && !s.rgroup && rStart >= today) {
    items.push({ at: atTime(rStart, '09:00'), title: 'Le khatm du Ramadan est ouvert 🌙', body: "Rejoignez-le dans l'appli : le Coran en entier en 29 jours, comme dans les mosquées.", tag: `ouvert:${rid}` });
  }
  if (s.rgroup && rStart >= today) {
    items.push({ at: atTime(rStart, '07:00'), title: 'Ramadan Moubarak 🌙', body: `Votre khatm du Ramadan commence aujourd'hui avec « ${s.rgroup.name} ». Ouvrez l'appli pour choisir votre rythme. Bismillah !`, tag: `debut-groupe:${rid}` });
  }
  if ((s.ramadan || s.rgroup) && s.ramadan?.extras?.last10 !== false) {
    const d20 = addDays(rStart, 19);
    if (d20 >= today) items.push({ at: atTime(d20, '18:00'), title: 'Les 10 dernières nuits commencent ce soir 🌙', body: 'La dernière ligne droite de votre khatm du Ramadan. Courage, vous y êtes presque !', tag: `dix:${rid}` });
  }
  const now = Date.now();
  return items.filter((x) => x.at > now).sort((a, b) => a.at - b.at);
}

let lastSent = '';
let timer: number | undefined;
async function sendSchedule() {
  if (!pushActive()) return;
  const items = buildSchedule();
  const key = JSON.stringify(items);
  if (key === lastSent) return;
  const r = await post('/schedule', { id: deviceId(), items });
  if (r?.ok) lastSent = key;
  else if (r?.error === 'unknown') { ls.set(ON_KEY, ''); void enablePush(); }
}

/** À appeler au lancement : réabonne si besoin, puis renvoie les rappels à chaque changement. */
export function startPush() {
  if (!pushSupported()) return;
  if (Notification.permission === 'granted') void enablePush();
  else ls.set(ON_KEY, '');
  onStore(() => { window.clearTimeout(timer); timer = window.setTimeout(() => void sendSchedule(), 1500); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lastSent = ''; void sendSchedule(); } });
}

