import duas from '../data/duas.json';
import { toArabicDigits } from '../data/quran';

export function Finale({ days, onClose }: { days: number; onClose: () => void }) {
  return (
    <div class="overlay finale" role="dialog" aria-label="Khatam terminé">
      <div class="inner">
        <div class="moon">🌙</div>
        <h1>Khatam terminé, machallah !</h1>
        <p>Vous avez lu le Coran en entier pendant ce Ramadan. Qu'Allah l'accepte de vous.</p>
        <div class="figs"><div><b>30</b><span>juz</span></div><div><b>604</b><span>pages</span></div><div><b>{days}</b><span>jours</span></div></div>
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
