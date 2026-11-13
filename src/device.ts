// Installation sur l'écran d'accueil et notifications.
import { getState, todayISO, update, currentDay } from './store';
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

/**
 * Vérifie chaque minute s'il est l'heure d'une séance non cochée.
 * Limite actuelle : fonctionne quand l'appli est ouverte ou en arrière-plan récent.
 * Les rappels appli fermée nécessitent un serveur d'envoi (étape Firebase).
 */
export function startReminders() {
  const tick = () => {
    const s = getState();
    const day = currentDay(s);
    const N = s.khatam.days;
    if (day < 1 || day > N || s.khatam.finishedOn || notificationPermission() !== 'granted') return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const date = todayISO();
    const prog = programmeById(s.programmeId);
    const doneToday = s.done.includes(day);
    const checked = new Set(s.sessions[day] ?? []);
    const due: { key: string; title: string; body: string }[] = [];
    if (s.reminders.sessions && !doneToday) {
      for (const sess of sessionsFor(prog, portion(N, day))) {
        const t = minutes(timeFor(prog.id, sess.index, sess.defaultTime));
        if (!checked.has(sess.index) && nowMin >= t && nowMin < t + 90)
          due.push({ key: `s${sess.index}`, title: `${sess.label} · ${juzTitle(...portion(N, day)) ?? `Jour ${day}`}`, body: `${sess.detail ? sess.detail + ', ' : ''}pages ${sess.pageFrom} à ${sess.pageTo} (${pagesLabel(sess.pages)}). Bismillah !` });
      }
    }
    if (s.reminders.lateEvening && !doneToday && nowMin >= 21 * 60 && nowMin < 23 * 60)
      due.push({ key: 'late', title: `Jour ${day} pas encore terminé`, body: 'Il reste encore un peu de temps ce soir, courage !' });
    for (const d of due) {
      const id = `${date}:${d.key}`;
      if (s.shown.includes(id)) continue;
      update((st) => ({ shown: [...st.shown.filter((x) => x.startsWith(date)), id] }));
      notify(d.title, d.body, id);
    }
  };
  tick();
  return window.setInterval(tick, 60_000);
}
