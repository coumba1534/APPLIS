import { useState } from 'preact/hooks';
import { update, getState, newId, todayISO, DEFAULT_RAMADAN_START } from '../store';
import { allProgrammes, sessionsFor } from '../data/programmes';
import { portion, dayLabel, pagesLabel } from '../data/khatam';
import { khatamName } from './NewKhatam';
import { askNotifications, notificationsSupported } from '../device';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const init = getState();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(init.name);
  const [prog, setProg] = useState(init.programmeId);
  const [code, setCode] = useState(init.groupCode);
  const [dur, setDur] = useState<'ramadan' | '30' | '60' | '90'>(init.khatam.kind === 'ramadan' ? 'ramadan' : '30');
  const days = dur === 'ramadan' ? 30 : Number(dur);
  const progs = allProgrammes().filter((p) => p.id !== 'custom');
  const chosen = progs.find((p) => p.id === prog) ?? progs[0];
  const sample = portion(days, 1);

  const finish = async (askNotif: boolean) => {
    update({
      onboarded: true, name: name.trim(), programmeId: prog, groupCode: code.trim().toUpperCase(),
      khatam: { id: newId(), kind: dur === 'ramadan' ? 'ramadan' : 'custom', name: khatamName(dur, days), days, start: dur === 'ramadan' ? DEFAULT_RAMADAN_START : todayISO() },
      done: [], sessions: {}, catchPlan: null,
    });
    if (askNotif && notificationsSupported()) await askNotifications();
    onDone();
  };

  const bodies = [
    <>
      <h1>Assalamou alaykoum 🌙</h1>
      <p>Bienvenue dans Khatam entre sœurs : un juz par jour pendant le Ramadan, à votre rythme, avec vos sœurs.</p>
      <label class="field">Votre prénom<input type="text" value={name} placeholder="Ex. Aminata" autocomplete="given-name" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
    </>,
    <>
      <h1>Quelle durée pour votre khatam ?</h1>
      <p>Le Coran est découpé en parts égales, une par jour. Vous pourrez aussi choisir une durée personnalisée dans l'onglet Programme.</p>
      {([['ramadan', 'Ramadan', 30], ['30', '1 mois', 30], ['60', '2 mois', 60], ['90', '3 mois', 90]] as const).map(([id, title, d]) => (
        <button class="choice" aria-pressed={dur === id} onClick={() => setDur(id)}>
          <b>{title} · {d} jours</b><small>{dayLabel(d)}</small>
        </button>
      ))}
    </>,
    <>
      <h1>Quel rythme vous convient ?</h1>
      <p>{dayLabel(days)}, réparties selon vos occupations.</p>
      {progs.map((p) => (
        <button class="choice" aria-pressed={p.id === prog} onClick={() => setProg(p.id)}>
          <b>{p.name}</b><small>{p.forWho} · {sessionsFor(p, sample).map((x) => pagesLabel(x.pages)).join(' + ')}</small>
        </button>
      ))}
    </>,
    <>
      <h1>Rejoindre votre groupe</h1>
      <p>Entrez le code d'invitation envoyé par l'administratrice, par exemple sur WhatsApp.</p>
      <label class="field">Code d'invitation<input type="text" value={code} placeholder="Ex. BA-1448" autocapitalize="characters" onInput={(e) => setCode((e.target as HTMLInputElement).value)} /></label>
      <p style="font-size:13px">Vous n'avez pas encore de code ? Continuez : vous pourrez l'ajouter plus tard dans l'onglet Groupe.</p>
    </>,
    <>
      <h1>Les rappels</h1>
      <p>Un rappel à l'heure de chaque séance de votre programme :</p>
      <div>{sessionsFor(chosen, sample).map((x) => <div class="setting"><div>{x.label}<small>{pagesLabel(x.pages)}</small></div><b>{x.defaultTime}</b></div>)}</div>
      <p style="font-size:13px">Vous pourrez changer les heures dans l'onglet Rappels.</p>
    </>,
  ];

  return (
    <div class="overlay">
      <div class="inner">
        <div class="steps">{[0, 1, 2, 3, 4].map((i) => <i class={i <= step ? 'on' : ''} />)}</div>
        <div class="grow">{bodies[step]}</div>
        <div class="actions">
          {step > 0
            ? <button class="link" onClick={() => setStep(step - 1)}>Retour</button>
            : <button class="link" onClick={() => finish(false)}>Passer</button>}
          {step < 4
            ? <button class="btn teal" onClick={() => setStep(step + 1)}>Continuer</button>
            : <button class="btn teal" onClick={() => finish(true)}>Autoriser les rappels</button>}
        </div>
      </div>
    </div>
  );
}
