import { useState } from 'preact/hooks';
import { useStore, startKhatam, hasProgress, todayISO, addDays, daysBetween, formatDate, DEFAULT_RAMADAN_START } from '../store';
import { portion, dayLabel, clampDays, MAX_DAYS, MIN_DAYS } from '../data/khatam';
import { refText } from '../data/quran';
import { toast } from '../ui';

type Choice = 'ramadan' | '30' | '60' | '90' | 'custom';

const CHOICES: { id: Choice; title: string; days: number | null }[] = [
  { id: 'ramadan', title: 'Ramadan', days: 30 },
  { id: '30', title: '1 mois', days: 30 },
  { id: '60', title: '2 mois', days: 60 },
  { id: '90', title: '3 mois', days: 90 },
  { id: 'custom', title: 'Personnalisé', days: null },
];

export function khatamName(choice: Choice, days: number) {
  if (choice === 'ramadan') return 'Ramadan';
  if (choice === '30') return "Khatam d'un mois";
  if (choice === '60') return 'Khatam de 2 mois';
  if (choice === '90') return 'Khatam de 3 mois';
  return `Khatam de ${days} jours`;
}

/** Fenêtre de création d'un khatam : durée (Ramadan, 1, 2, 3 mois ou personnalisée) et date de début. */
export function NewKhatam({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
  const s = useStore();
  const [choice, setChoice] = useState<Choice>('ramadan');
  const [start, setStart] = useState(s.khatam.kind === 'ramadan' ? (s.khatam.plannedStart ?? s.khatam.start) : DEFAULT_RAMADAN_START);
  const [customDays, setCustomDays] = useState(45);
  const days = choice === 'custom' ? clampDays(customDays) : CHOICES.find((c) => c.id === choice)!.days!;
  const end = addDays(start, days - 1);
  const [a, b] = portion(days, 1);
  const inProgress = !s.khatam.finishedOn && hasProgress(s);

  const pick = (c: Choice) => {
    setChoice(c);
    // Le Ramadan a sa date estimée ; les autres durées commencent aujourd'hui.
    setStart(c === 'ramadan' ? DEFAULT_RAMADAN_START : todayISO());
  };

  const go = () => {
    startKhatam({ kind: choice === 'ramadan' ? 'ramadan' : 'custom', name: khatamName(choice, days), start, days });
    toast('Nouveau khatam commencé, bismillah !');
    onStarted();
    onClose();
  };

  return (
    <div class="overlay" role="dialog" aria-label="Nouveau khatam">
      <div class="inner">
        <div class="row"><h1>Nouveau khatam</h1><button class="close" aria-label="Fermer" onClick={onClose}>✕</button></div>
        <p>Choisissez la durée. Le Coran est découpé en parts égales, en unités traditionnelles (juz, hizb, ½ hizb).</p>

        <div class="choices" role="group" aria-label="Durée">
          {CHOICES.map((c) => (
            <button class="choice" aria-pressed={choice === c.id} onClick={() => pick(c.id)}>
              <b>{c.title}</b>
              <small>{c.days ? `${c.days} jours` : 'Vous choisissez'}</small>
            </button>
          ))}
        </div>

        <div class="card">
          <label class="field">{choice === 'ramadan' ? '1er jour du Ramadan (estimation)' : 'Date de début'}
            <input type="date" value={start} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) setStart(v); }} />
          </label>
          {choice === 'custom' && (
            <>
              <label class="field">Durée en jours (de {MIN_DAYS} à {MAX_DAYS})
                <input type="number" min={MIN_DAYS} max={MAX_DAYS} value={customDays} onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10); if (v > 0) setCustomDays(Math.min(MAX_DAYS, v)); }} />
              </label>
              <label class="field">ou date de fin
                <input type="date" value={end} min={start} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) setCustomDays(clampDays(daysBetween(start, v) + 1)); }} />
              </label>
            </>
          )}
          {choice === 'ramadan' && <p class="note">La date sera à ajuster selon l'annonce de la lune.</p>}
        </div>

        <div class="summary">
          <b>{days} jour{days > 1 ? 's' : ''} · {dayLabel(days)}</b>
          <span>Du {formatDate(start)} au {formatDate(end)}</span>
          <small>Jour 1 : de {refText(a)} à {refText(b)}</small>
        </div>

        {inProgress && <p class="note warn">Votre khatam en cours ({s.done.length}/{s.khatam.days} jours lus) sera gardé dans l'historique comme interrompu.</p>}

        <div class="actions">
          <button class="link" onClick={onClose}>Annuler</button>
          <button class="btn teal" onClick={go}>Commencer ce khatam</button>
        </div>
      </div>
    </div>
  );
}
