import { useState } from 'preact/hooks';
import { useStore, update, formatDate, joinRamadan, currentRamadanId, hasActiveKhatam } from '../store';
import { daysToRamadan, ramadanStart, ramadanVisible, ramadanName, ramadanEnd, useConfig } from '../config';
import { toast } from '../ui';

/**
 * Annonce du khatam du Ramadan (10 jours avant, et pendant le mois) : « Rejoindre ».
 * Le khatam personnel est mis en pause pendant le Ramadan.
 */
export function RamadanBanner() {
  const s = useStore();
  useConfig();
  const [asking, setAsking] = useState(false);
  const start = ramadanStart();
  const alreadyThisYear = s.history.some((h) => h.id === currentRamadanId());
  if (!ramadanVisible() || s.ramadan || alreadyThisYear || s.hideRamadanBanner === start) return null;
  const n = daysToRamadan();
  const personal = hasActiveKhatam(s) ? s.khatam : null;

  return (
    <div class="ramadan-banner">
      <div class="rb-top">
        <span class="rb-moon" aria-hidden="true">🌙</span>
        <div>
          <b>Votre khatam du Ramadan est disponible</b>
          <small>{n > 1 ? `${ramadanName()} commence dans ${n} jours, le ${formatDate(start)}, selon l'annonce de la lune.`
            : n === 1 ? `${ramadanName()} commence demain, in shaa Allah.`
            : `${ramadanName()} a commencé : il n'est pas trop tard pour le rejoindre.`}</small>
        </div>
      </div>
      <p>Le Coran en entier en 29 jours, comme dans les mosquées : environ 21 pages par jour.</p>
      {asking ? (
        <div class="confirm">
          <p>Rejoindre le khatam du {ramadanName()} ?
            {personal ? ` Votre khatam personnel « ${personal.name} » sera mis en pause pendant le Ramadan, puis reprendra le lendemain, là où vous l'aurez laissé.` : ''}
            {n < 0 ? ` Les jours déjà passés seront à rattraper, jusqu'au ${formatDate(ramadanEnd())}.` : ''}</p>
          <div class="actions-row">
            <button class="btn" onClick={() => { joinRamadan(); setAsking(false); toast('Bienvenue dans le khatam du Ramadan, bismillah !'); }}>Rejoindre</button>
            <button class="ghost" onClick={() => setAsking(false)}>Annuler</button>
          </div>
        </div>
      ) : (
        <div class="rb-actions">
          <button class="btn" onClick={() => setAsking(true)}>Rejoindre le khatam du Ramadan</button>
          <button class="link" onClick={() => update({ hideRamadanBanner: start })}>Plus tard</button>
        </div>
      )}
    </div>
  );
}
