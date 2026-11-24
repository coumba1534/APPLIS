import { useState } from 'preact/hooks';
import { useStore, update, formatDate, joinRamadan, hasActiveKhatam, canJoinRamadan, ramadanDoneThisYear } from '../store';
import { daysToRamadan, ramadanStart, ramadanVisible, ramadanName, ramadanEnd, useConfig } from '../config';
import { toast } from '../ui';

/**
 * Annonce du khatam du Ramadan.
 * Avant le 1er jour : on informe seulement (rejoindre plus tôt mettrait le khatam personnel en pause pour rien).
 * Pendant le mois : « Rejoindre ». « Plus tard » masque l'annonce avant le Ramadan, puis une seconde fois pendant le mois.
 * Dans l'onglet Programme (`always`), la carte reste toujours là, sans « Plus tard ».
 */
export function RamadanBanner({ always = false }: { always?: boolean }) {
  const s = useStore();
  useConfig();
  const [asking, setAsking] = useState(false);
  const start = ramadanStart();
  const n = daysToRamadan();
  const before = n > 0;
  const open = canJoinRamadan(s);
  // Clé de masquage : une pour l'annonce, une pour le mois (l'ancienne valeur, la date seule, vaut pour l'annonce).
  const hideKey = `${start}:${before ? 'annonce' : 'mois'}`;
  const hidden = !always && (s.hideRamadanBanner === hideKey || (before && s.hideRamadanBanner === start));
  if (!ramadanVisible() || s.ramadan || ramadanDoneThisYear(s) || hidden || (!before && !open)) return null;
  const personal = hasActiveKhatam(s) ? s.khatam : null;
  const restart = s.history.some((h) => h.kind === 'ramadan' && h.status === 'stopped' && h.start === start);

  return (
    <div class={`ramadan-banner ${always ? 'in-prog' : ''}`}>
      <div class="rb-top">
        <span class="rb-moon" aria-hidden="true">🌙</span>
        <div>
          <b>{before ? `${ramadanName()} approche` : restart ? `Khatam du ${ramadanName()}` : 'Votre khatam du Ramadan est ouvert'}</b>
          <small>{n > 1 ? `Il commence dans ${n} jours, le ${formatDate(start)}, selon l'annonce de la lune.`
            : n === 1 ? `Il commence demain, in shaa Allah.`
            : restart ? `Vous pouvez le recommencer au jour 1 : les jours déjà passés seront à rattraper.`
            : `${ramadanName()} a commencé : il n'est pas trop tard pour le rejoindre.`}</small>
        </div>
      </div>
      <p>{before
        ? "Le khatam du Ramadan s'ouvrira le 1er jour : le Coran en entier en 29 jours, comme dans les mosquées. Vous pourrez le rejoindre ici."
        : 'Le Coran en entier en 29 jours, comme dans les mosquées : environ 21 pages par jour.'}</p>
      {before ? (
        !always && <div class="rb-actions"><button class="link" onClick={() => update({ hideRamadanBanner: hideKey })}>J'ai compris</button></div>
      ) : asking ? (
        <div class="confirm">
          <p>{restart ? 'Recommencer' : 'Rejoindre'} le khatam du {ramadanName()} ?
            {personal ? ` Votre khatam personnel « ${personal.name} » sera mis en pause pendant le Ramadan, puis reprendra le lendemain, là où vous l'aurez laissé.` : ''}
            {n < 0 ? ` Les jours déjà passés seront à rattraper, jusqu'au ${formatDate(ramadanEnd())}.` : ''}</p>
          <div class="actions-row">
            <button class="btn" onClick={() => { joinRamadan(); setAsking(false); toast('Bienvenue dans le khatam du Ramadan, bismillah !'); }}>{restart ? 'Recommencer' : 'Rejoindre'}</button>
            <button class="ghost" onClick={() => setAsking(false)}>Annuler</button>
          </div>
        </div>
      ) : (
        <div class="rb-actions">
          <button class="btn" onClick={() => setAsking(true)}>{restart ? 'Recommencer le khatam du Ramadan' : 'Rejoindre le khatam du Ramadan'}</button>
          {!always && <button class="link" onClick={() => update({ hideRamadanBanner: hideKey })}>Plus tard</button>}
        </div>
      )}
    </div>
  );
}
