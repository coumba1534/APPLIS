import { ProfileCard } from './Profile';
import { pushActive, testPush } from '../push';
import { useState } from 'preact/hooks';
import { useStore, update, currentDay, setReminderTime, activeTrackId, getTrack, simulateRamadan, setRamadanSetup, formatDate, addDays, todayISO } from '../store';
import { useConfig, ramadanTest, ramadanEnd } from '../config';
import { ramadanNotifications } from '../device';
import { programmeOf, sessionsFor } from '../data/programmes';
import { portion, pagesLabel } from '../data/khatam';
import { askNotifications, notificationPermission, notificationsSupported, notify, timeFor, isIOS, isStandalone } from '../device';
import { toast } from '../ui';
import { APP_NAME } from '../brand';

export function Reminders() {
  const s = useStore();
  const [perm, setPerm] = useState(notificationPermission());
  const config = useConfig();
  const id = activeTrackId(s) ?? 'personal';
  const prog = programmeOf(s, id);
  const N = getTrack(s, id)?.khatam.days ?? 30;
  const day = Math.min(Math.max(currentDay(s, id), 1), N);
  const sessions = sessionsFor(prog, portion(N, day));

  return (
    <>
      <div class="card">
        <h3>Notifications</h3>
        {!notificationsSupported() ? (
          <p>{isIOS() && !isStandalone()
            ? 'Sur iPhone, ajoutez d\'abord l\'appli à l\'écran d\'accueil (Safari → Partager → « Sur l\'écran d\'accueil »), puis ouvrez-la depuis son icône.'
            : 'Ce navigateur ne permet pas les notifications.'}</p>
        ) : perm === 'granted' ? (
          <>
            <p>Les rappels sont autorisés.</p>
            {pushActive() ? (
              <>
                <p class="note">Les rappels arrivent même quand l'appli est fermée.</p>
                <button class="ghost" style="justify-self:start" onClick={() => testPush(60).then((ok) => toast(ok ? 'Rappel de test dans une minute : fermez l\'appli pour le voir arriver' : "Le rappel de test n'a pas pu être programmé"))}>Rappel de test (dans 1 minute)</button>
              </>
            ) : (
              <button class="ghost" style="justify-self:start" onClick={() => notify(APP_NAME, 'Ceci est un rappel de test. Bismillah !').then(() => toast('Rappel de test envoyé'))}>Envoyer un rappel de test</button>
            )}
          </>
        ) : perm === 'denied' ? (
          <p>Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone pour cette appli.</p>
        ) : (
          <button class="btn teal" onClick={() => askNotifications().then((p) => { setPerm(p); toast(p === 'granted' ? 'Rappels autorisés' : 'Rappels non autorisés'); })}>Autoriser les rappels</button>
        )}
        {!pushActive() && <p class="note">Une fois les rappels autorisés, ils arrivent même quand l'appli est fermée (appli installée sur l'écran d'accueil, iOS 16.4 ou plus récent).</p>}
      </div>

      <h2>Un rappel par séance</h2>
      <div>
        {sessions.map((x) => (
          <div class="setting">
            <div>{x.label}<small>{x.detail || pagesLabel(x.pages)}</small></div>
            <input type="time" aria-label={`Heure du rappel ${x.label}`} value={timeFor(prog.id, x.index, x.defaultTime)}
              onChange={(e) => { const v = (e.target as HTMLInputElement).value; setReminderTime(prog.id, x.index, v); toast(`Rappel réglé à ${v}`); }} />
          </div>
        ))}
        <div class="setting">
          <div>Rappels des séances<small>À l'heure de chaque séance non cochée</small></div>
          <input type="checkbox" class="switch" aria-label="Rappels des séances" checked={s.reminders.sessions}
            onChange={() => update({ reminders: { ...s.reminders, sessions: !s.reminders.sessions } })} />
        </div>
        <div class="setting">
          <div>Si je n'ai pas fini<small>Un rappel vers 21 h s'il reste des pages</small></div>
          <input type="checkbox" class="switch" aria-label="Rappel du soir" checked={s.reminders.lateEvening}
            onChange={() => update({ reminders: { ...s.reminders, lateEvening: !s.reminders.lateEvening } })} />
        </div>
      </div>
      <h2>Mon profil</h2>
      <ProfileCard inGroup={!!s.group || !!s.groupRequest} />
      {config.testMode && <TestTools />}
    </>
  );
}

/**
 * Outils de test (affichés quand config.json contient "testMode": true) :
 * simule un Ramadan sur ce téléphone seulement, pour voir l'annonce, le khatam, la pause et la fin du mois.
 */
function TestTools() {
  const s = useStore();
  useConfig();
  const t = ramadanTest();
  const today = todayISO();
  const sim = (offset: number, label: string) => { simulateRamadan(addDays(today, offset)); toast(label); };
  const sendAll = async () => {
    const a = ramadanNotifications.available(), b = ramadanNotifications.firstDay();
    const ok = await notify(a.title, a.body, 'test-annonce');
    await notify(b.title, b.body, 'test-debut');
    await notify('Après Fajr · Jour 1', 'Pages 1 à 11 (≈ 10,5 pages). Bismillah !', 'test-seance');
    toast(ok ? 'Notifications de test envoyées' : "Autorisez d'abord les rappels (en haut de cet écran)");
  };
  return (
    <div class="card test-tools">
      <h3>Outils de test</h3>
      <p class="note">Simule un Ramadan sur ce téléphone seulement, pour voir l'annonce, le khatm du Ramadan, la pause du khatm personnel et la fin du mois. Les autres utilisateurs ne voient rien.</p>
      <p><b>{t ? `Ramadan simulé : du ${formatDate(t)} au ${formatDate(ramadanEnd())}` : 'Aucune simulation en cours'}</b>{s.ramadan ? ' · khatm rejoint' : ''}</p>
      <div class="test-grid">
        <button class="ghost" onClick={() => sim(10, 'Le Ramadan commence dans 10 jours (annonce)')}>Annonce · J − 10</button>
        <button class="ghost" onClick={() => sim(1, 'Le Ramadan commence demain')}>Veille du Ramadan</button>
        <button class="ghost" onClick={() => sim(0, "Le Ramadan commence aujourd'hui")}>1er jour</button>
        <button class="ghost" onClick={() => sim(-26, 'Jour 27 du Ramadan')}>Jour 27</button>
        <button class="ghost" onClick={() => sim(-29, 'Dernier jour du Ramadan (jour 30)')}>Dernier jour</button>
        <button class="ghost" onClick={() => sim(-30, "C'est l'Aïd : le Ramadan est terminé")}>Après l'Aïd</button>
      </div>
      <div class="actions-row">
        <button class="ghost" onClick={sendAll}>Envoyer les notifications de test</button>
        {s.ramadan && <button class="ghost" onClick={() => { setRamadanSetup({ welcomed: false }); toast("L'accueil du Ramadan va s'ouvrir"); }}>Revoir l'accueil du Ramadan</button>}
        {s.ramadan && t && <button class="ghost" onClick={() => { const today = Math.min(Math.max(currentDay(s, 'ramadan'), 1), 29); update({ ramadan: { ...s.ramadan!, done: Array.from({ length: 29 }, (_, i) => i + 1).filter((d) => d !== today), sessions: {} } }); toast("28 jours marqués comme lus : validez celui d'aujourd'hui"); }}>Marquer 28 jours lus</button>}
        {t && <button class="ghost danger" onClick={() => { simulateRamadan(null); toast('Simulation arrêtée'); }}>Arrêter la simulation</button>}
      </div>
    </div>
  );
}
