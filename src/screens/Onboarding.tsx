import { useState } from 'preact/hooks';
import { update, getState } from '../store';
import { PROGRAMMES, describeSessions } from '../data/programmes';
import { askNotifications, notificationsSupported } from '../device';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const init = getState();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(init.name);
  const [prog, setProg] = useState(init.programmeId);
  const [code, setCode] = useState(init.groupCode);
  const chosen = PROGRAMMES.find((p) => p.id === prog)!;

  const finish = async (askNotif: boolean) => {
    update({ onboarded: true, name: name.trim(), programmeId: prog, groupCode: code.trim().toUpperCase() });
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
      <h1>Quel rythme vous convient ?</h1>
      <p>20 pages par jour, réparties selon vos occupations.</p>
      {PROGRAMMES.map((p) => (
        <button class="choice" aria-pressed={p.id === prog} onClick={() => setProg(p.id)}>
          <b>{p.name}</b><small>{p.forWho} · {describeSessions(p).join(' + ')}</small>
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
      <div>{chosen.sessions.map((x, i) => <div class="setting"><div>{x.label}<small>{describeSessions(chosen)[i]}</small></div><b>{x.time}</b></div>)}</div>
      <p style="font-size:13px">Vous pourrez changer les heures dans l'onglet Rappels.</p>
    </>,
  ];

  return (
    <div class="overlay">
      <div class="inner">
        <div class="steps">{[0, 1, 2, 3].map((i) => <i class={i <= step ? 'on' : ''} />)}</div>
        <div class="grow">{bodies[step]}</div>
        <div class="actions">
          {step > 0
            ? <button class="link" onClick={() => setStep(step - 1)}>Retour</button>
            : <button class="link" onClick={() => finish(false)}>Passer</button>}
          {step < 3
            ? <button class="btn teal" onClick={() => setStep(step + 1)}>Continuer</button>
            : <button class="btn teal" onClick={() => finish(true)}>Autoriser les rappels</button>}
        </div>
      </div>
    </div>
  );
}
