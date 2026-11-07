import { useState } from 'preact/hooks';
import { useStore, update, currentDay } from '../store';
import { programmeById, sessionsFor } from '../data/programmes';
import { askNotifications, notificationPermission, notificationsSupported, notify, timeFor, isIOS, isStandalone } from '../device';
import { toast } from '../ui';

export function Reminders() {
  const s = useStore();
  const [perm, setPerm] = useState(notificationPermission());
  const prog = programmeById(s.programmeId);
  const day = Math.min(Math.max(currentDay(s), 1), 30);
  const sessions = sessionsFor(prog, day);

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
            <button class="ghost" style="justify-self:start" onClick={() => notify('Khatam entre sœurs', 'Ceci est un rappel de test. Bismillah !').then(() => toast('Rappel de test envoyé'))}>Envoyer un rappel de test</button>
          </>
        ) : perm === 'denied' ? (
          <p>Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone pour cette appli.</p>
        ) : (
          <button class="btn teal" onClick={() => askNotifications().then((p) => { setPerm(p); toast(p === 'granted' ? 'Rappels autorisés' : 'Rappels non autorisés'); })}>Autoriser les rappels</button>
        )}
        <p class="note">Pour l'instant, les rappels arrivent quand l'appli est ouverte ou utilisée récemment. Les rappels appli fermée arriveront avec l'étape Firebase.</p>
      </div>

      <h2>Un rappel par séance</h2>
      <div>
        {sessions.map((x) => (
          <div class="setting">
            <div>{x.label}<small>{x.detail || `${x.pages} pages`}</small></div>
            <input type="time" aria-label={`Heure du rappel ${x.label}`} value={timeFor(prog.id, x.index, x.defaultTime)}
              onChange={(e) => { const v = (e.target as HTMLInputElement).value; update({ reminderTimes: { ...s.reminderTimes, [`${prog.id}:${x.index}`]: v } }); toast(`Rappel réglé à ${v}`); }} />
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
    </>
  );
}
