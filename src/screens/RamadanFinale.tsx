// Fin du khatam du Ramadan : un écran épuré qui félicite, avec des dou'a, et une carte de validation à partager.
import { useState } from 'preact/hooks';
import { useStore } from '../store';
import { APP_NAME } from '../brand';
import { Stars } from './RamadanArt';
import type { Khatam } from '../store';
import { toast } from '../ui';

// Coran, Al-Baqarah 2:127 (extrait), repris mot pour mot du texte de l'appli (édition KFGQPC) et de la traduction Hamidullah.
const VERSE_AR = 'رَبَّنَا تَقَبَّلۡ مِنَّآۖ إِنَّكَ أَنتَ ٱلسَّمِيعُ ٱلۡعَلِيمُ';
const VERSE_FR = "« Ô notre Seigneur, accepte ceci de notre part ! Car c'est Toi l'Audient, l'Omniscient »";

/** Dessine la carte de validation (image carrée) : « Machallah », le prénom, le khatam terminé. */
async function drawCard(name: string, khatamName: string): Promise<Blob> {
  const W = 1080, cv = document.createElement('canvas');
  cv.width = W; cv.height = W;
  const ctx = cv.getContext('2d')!;
  try { await Promise.all(['700 64px "Bricolage Grotesque"', '96px Amiri', '28px "Atkinson Hyperlegible"'].map((f) => document.fonts.load(f))); } catch { /* polices de secours */ }
  const bg = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 400, 900);
  bg.addColorStop(0, '#17403A'); bg.addColorStop(1, '#071513');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.25 + Math.random() * 0.6; ctx.fillStyle = '#F7F0E1';
    ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * W * 0.55, Math.random() * 2.2 + 0.6, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Pleine lune
  const glow = ctx.createRadialGradient(W / 2, 300, 60, W / 2, 300, 230);
  glow.addColorStop(0, 'rgba(246,221,176,.45)'); glow.addColorStop(1, 'rgba(246,221,176,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 600);
  const moon = ctx.createRadialGradient(W / 2 - 30, 270, 10, W / 2, 300, 120);
  moon.addColorStop(0, '#FFF6E2'); moon.addColorStop(0.55, '#F6DDB0'); moon.addColorStop(1, '#E3BF7E');
  ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(W / 2, 300, 120, 0, 6.28); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E9B45F'; ctx.font = '96px Amiri, serif'; ctx.direction = 'rtl';
  ctx.fillText('ما شاء الله', W / 2, 560);
  ctx.direction = 'ltr';
  ctx.fillStyle = '#F7F0E1'; ctx.font = '700 64px "Bricolage Grotesque", sans-serif';
  ctx.fillText(name ? `${name} a terminé` : 'Khatm terminé', W / 2, 690);
  ctx.font = '700 52px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`son khatm du ${khatamName}`, W / 2, 770);
  ctx.fillStyle = 'rgba(247,240,225,.75)'; ctx.font = '30px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText('29 nuits · 30 juz · 604 pages', W / 2, 850);
  ctx.fillStyle = 'rgba(247,240,225,.45)'; ctx.font = '700 24px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText(APP_NAME.toUpperCase().split('').join(' '), W / 2, 1010);
  return new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'));
}

export function RamadanFinale({ khatam, onClose, onNewKhatam }: { khatam: Khatam; onClose: () => void; onNewKhatam: () => void }) {
  const s = useStore();
  const [preview, setPreview] = useState<string | null>(null);
  const personal = s.khatam && !s.khatam.finishedOn;

  const share = async () => {
    const blob = await drawCard(s.name, khatam.name);
    const file = new File([blob], 'khatam-ramadan.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: `Khatm du ${khatam.name}` }); return; } catch { /* partage annulé */ return; }
    }
    // Sans partage de fichiers : on montre l'image, à enregistrer par un appui long.
    setPreview(URL.createObjectURL(blob));
    toast("Appui long sur l'image pour l'enregistrer");
  };

  return (
    <div class="overlay rw rf" role="dialog" aria-label="Khatm du Ramadan terminé">
      <Stars count={70} />
      <div class="rf-inner">
        {preview ? (
          <>
            <img class="rf-card" src={preview} alt={`Carte : ${s.name || ''} a terminé son khatm du ${khatam.name}`} />
            <button class="rw-back" onClick={() => setPreview(null)}>Retour</button>
          </>
        ) : (
          <>
            <div class="rf-moon" aria-hidden="true" />
            <div class="rw-ar">ما شاء الله</div>
            <div class="rf-bravo">Machallah{s.name ? `, ${s.name}` : ' !'}</div>
            <p class="rw-lead">Vous avez lu le Coran en entier pendant ce Ramadan.</p>
            <span class="rf-quiet">29 nuits · 30 juz · 604 pages</span>
            <div class="rf-sep" />
            <div class="rf-verse">{VERSE_AR}</div>
            <div class="rf-vfr">{VERSE_FR} (Al-Baqarah, 2:127)</div>
            <div class="rf-sep" />
            <div class="rf-wish">Qu'Allah accepte votre jeûne, vos prières et chaque page lue.<br />Qu'Il fasse du Coran la lumière de votre cœur, et vous donne de le relire encore.</div>
            {s.ramadan?.niyya && <div class="rf-niyya">{s.ramadan.niyya}</div>}
            <div class="grow" />
            {personal
              ? <button class="rw-btn wide" onClick={onClose}>Continuer mon khatm personnel</button>
              : <button class="rw-btn wide" onClick={() => { onClose(); onNewKhatam(); }}>Commencer un nouveau khatm</button>}
            <button class="rf-ghost" onClick={share}>Partager ma réussite</button>
            <button class="rw-back" onClick={onClose}>Fermer</button>
          </>
        )}
      </div>
    </div>
  );
}
