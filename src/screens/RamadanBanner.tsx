import { useStore, update, formatDate } from '../store';
import { daysToRamadan, ramadanStart, ramadanVisible, useConfig } from '../config';

/** Bandeau qui apparaît quand le Ramadan approche : propose de préparer le khatam du Ramadan. */
export function RamadanBanner({ onOpen }: { onOpen: () => void }) {
  const s = useStore();
  useConfig();
  if (!ramadanVisible() || s.khatam.kind === 'ramadan' || s.hideRamadanBanner === ramadanStart()) return null;
  const n = daysToRamadan();
  return (
    <div class="ramadan-banner">
      <div class="rb-top">
        <span class="rb-moon" aria-hidden="true">🌙</span>
        <div>
          <b>{n > 0 ? (n === 1 ? 'Le Ramadan commence demain' : `Le Ramadan approche · J − ${n}`) : 'Le Ramadan est en cours'}</b>
          <small>{n > 0 ? `Début prévu le ${formatDate(ramadanStart())}, selon l'annonce de la lune.` : 'Il n\'est pas trop tard pour commencer.'}</small>
        </div>
      </div>
      <p>Lisez le Coran en entier pendant le mois de Ramadan : 1 juz par jour pendant 30 jours.</p>
      <div class="rb-actions">
        <button class="btn" onClick={onOpen}>Préparer mon khatam du Ramadan</button>
        <button class="link" onClick={() => update({ hideRamadanBanner: ramadanStart() })}>Plus tard</button>
      </div>
    </div>
  );
}
