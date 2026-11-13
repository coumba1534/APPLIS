import duas from '../data/duas.json';
import { toArabicDigits } from '../data/quran';
import type { Khatam } from '../store';

export function Finale({ khatam, onClose }: { khatam: Khatam; onClose: () => void }) {
  return (
    <div class="overlay finale" role="dialog" aria-label="Khatam terminé">
      <div class="inner">
        <div class="moon">🌙</div>
        <h1>Khatam terminé, machallah !</h1>
        <p>{khatam.kind === 'ramadan' ? 'Vous avez lu le Coran en entier pendant ce Ramadan.' : `Vous avez lu le Coran en entier en ${khatam.days} jours.`} Qu'Allah l'accepte de vous.</p>
        <div class="figs"><div><b>30</b><span>juz</span></div><div><b>604</b><span>pages</span></div><div><b>{khatam.days}</b><span>jours</span></div></div>
        {duas.map((d) => (
          <div class="dua">
            <div class="ar">{d.ar} <span>﴿{toArabicDigits(d.v)}﴾</span></div>
            <div class="fr">{d.fr}</div>
            <small>Sourate Al-Imran ({d.s}:{d.v})</small>
          </div>
        ))}
        <button class="btn" style="width:100%" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
