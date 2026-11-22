// Installation sur l'écran d'accueil et notifications.
import { getState, todayISO, update, currentDay, getTrack, activeTrackId, closeRamadanIfOver, currentRamadanId, formatDate } from './store';
import { ramadanVisible, ramadanName, ramadanStart } from './config';
import { programmeById, sessionsFor } from './data/programmes';
import { portion, juzTitle, pagesLabel } from './data/khatam';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

// Android / Chrome : on garde l'invitation d'installation pour l'afficher au bon moment.
interface InstallPrompt extends Event { prompt: () => Promise<void> }
let deferred: InstallPrompt | null = null;
const installListeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPrompt;
  installListeners.forEach((l) => l());
});
export const canPromptInstall = () => deferred !== null;
export const onInstallAvailable = (l: () => void) => { installListeners.add(l); return () => installListeners.delete(l); };
export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  deferred = null;
}

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'denied');

export async function askNotifications() {
  if (!notificationsSupported()) return 'denied' as NotificationPermission;
  return Notification.requestPermission();
}

export async function notify(title: string, body: string, tag?: string) {
  if (notificationPermission() !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
  return true;
}

export const timeFor = (programmeId: string, index: number, fallback: string) =>
  getState().reminderTimes[`${programmeId}:${index}`] ?? fallback;

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Textes des notifications du Ramadan (utilisés aussi par les outils de test). */
export const ramadanNotifications = {
  available: () => ({
    title: 'Votre khatam du Ramadan est disponible 🌙',
    body: `${ramadanName()} commence le ${formatDate(ramadanStart())}. Rejoignez le khatam : le Coran en entier en 29 jours.`,
  }),
  firstDay: () => ({
    title: 'Ramadan Moubarak 🌙',
    body: "Votre khatam du Ramadan commence aujourd'hui : jour 1, juz 1. Bismillah !",
  }),
};

/**
 * Vérifie chaque minute : l'annonce du khatam du Ramadan, son premier jour, et l'heure des séances non cochées.
 * Limite actuelle : fonctionne quand l'appli est ouverte ou en arrière-plan récent.
 * Les rappels appli fermée nécessitent un serveur d'envoi (étape Firebase).
 */
export function startReminders() {
  const tick = () => {
    closeRamadanIfOver();
    if (notificationPermission() !== 'granted') return;
    const s = getState();
    const date = todayISO();

    // Notifications ponctuelles du Ramadan (une seule fois chacune).
    const rid = currentRamadanId();
    const once = (key: string, n: { title: string; body: string }) => {
      if (getState().notified.includes(key)) return;
      update((st) => ({ notified: [...st.notified, key] }));
      notify(n.title, n.body, key);
    };
    const doneThisYear = s.history.some((h) => h.id === rid);
    if (ramadanVisible() && !s.ramadan && !doneThisYear) once(`annonce:${rid}`, ramadanNotifications.available());
    if (s.ramadan && s.ramadan.khatam.start === date) once(`debut:${s.ramadan.khatam.id}`, ramadanNotifications.firstDay());

    // Rappels des séances du khatam qu'on lit en ce moment (celui du Ramadan pendant le mois).
    const id = activeTrackId(s);
    const t = id ? getTrack(s, id) : null;
    if (!id || !t) return;
    const day = currentDay(s, id);
    const N = t.khatam.days;
    if (day < 1 || day > N || t.khatam.finishedOn) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const prog = programmeById(s.programmeId);
    const doneToday = t.done.includes(day);
    const checked = new Set(t.sessions[day] ?? []);
    const prefix = id === 'ramadan' ? '🌙 ' : '';
    const due: { key: string; title: string; body: string }[] = [];
    if (s.reminders.sessions && !doneToday) {
      for (const sess of sessionsFor(prog, portion(N, day))) {
        const m = minutes(timeFor(prog.id, sess.index, sess.defaultTime));
        if (!checked.has(sess.index) && nowMin >= m && nowMin < m + 90)
          due.push({ key: `${id}:s${sess.index}`, title: `${prefix}${sess.label} · ${juzTitle(...portion(N, day)) ?? `Jour ${day}`}`, body: `${sess.detail ? sess.detail + ', ' : ''}pages ${sess.pageFrom} à ${sess.pageTo} (${pagesLabel(sess.pages)}). Bismillah !` });
      }
    }
    if (s.reminders.lateEvening && !doneToday && nowMin >= 21 * 60 && nowMin < 23 * 60)
      due.push({ key: `${id}:late`, title: `${prefix}Jour ${day} pas encore terminé`, body: 'Il reste encore un peu de temps ce soir, courage !' });
    for (const d of due) {
      const key = `${date}:${d.key}`;
      if (getState().shown.includes(key)) continue;
      update((st) => ({ shown: [...st.shown.filter((x) => x.startsWith(date)), key] }));
      notify(d.title, d.body, key);
    }
  };
  tick();
  return window.setInterval(tick, 60_000);
}
