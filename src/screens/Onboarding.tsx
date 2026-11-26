import { useState } from 'preact/hooks';
import { update, getState, newId, todayISO } from '../store';
import type { Gender } from '../store';
import { GenderChoice, RestoreForm } from './Profile';
import { ramadanStart } from '../config';
import { APP_NAME } from '../brand';
import { allProgrammes, sessionsFor } from '../data/programmes';
import { portion, dayLabel, pagesLabel } from '../data/khatam';
import { khatamName } from './NewKhatam';
import { askNotifications, notificationsSupported } from '../device';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const init = getState();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(init.name);
  const [gender, setGender] = useState<Gender | null>(init.gender ?? null);
  const [restoring, setRestoring] = useState(false);
  const [prog, setProg] = useState(init.programmeId);
  const [code, setCode] = useState(init.groupCode);
  const [dur, setDur] = useState<'ramadan' | '30' | '60' | '90'>('30');
  const days = dur === 'ramadan' ? 30 : Number(dur);
  const progs = allProgrammes().filter((p) => p.id !== 'custom');
  const chosen = progs.find((p) => p.id === prog) ?? progs[0];
  const sample = portion(days, 1);

  const finish = async (askNotif: boolean) => {
    update({
      onboarded: true, name: name.trim(), gender, programmeId: prog, groupCode: code.trim().toUpperCase(),
      khatam: { id: newId(), kind: dur === 'ramadan' ? 'ramadan' : 'custom', name: khatamName(dur, days), days, start: dur === 'ramadan' ? ramadanStart() : todayISO(), ...(dur === 'ramadan' ? { followsConfig: true } : {}) },
      done: [], sessions: {}, catchPlan: null,
    });
    if (askNotif && notificationsSupported()) await askNotifications();
    onDone();
  };

  const bodies = [
    <>
      <h1>Assalamou alaykoum 🌙</h1>
      <p>Bienvenue dans {APP_NAME} : lisez le Coran en entier, à votre rythme, et ensemble.</p>
      <label class="field">Votre prénom<input type="text" value={name} placeholder="Ex. Aminata ou Moussa" autocomplete="given-name" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
      <div class="field">Vous êtes<GenderChoice value={gender} onChange={setGender} /></div>
      {!restoring
        ? <button class="link" style="justify-self:start" onClick={() => setRestoring(true)}>Vous avez déjà utilisé Khatm ? Retrouver ma progression</button>
        : <RestoreForm onCancel={() => setRestoring(false)} />}
      <p class="note">Pour les groupes : ils ne sont pas mixtes. Un groupe de sœurs n'accueille que des sœurs, un groupe de frères que des frères. Ce choix ne pourra pas être modifié.</p>
    </>,
    <>
      <h1>Quelle durée pour votre khatm ?</h1>
      <p>Le Coran est découpé en parts égales, une par jour. Vous pourrez aussi choisir une durée personnalisée dans l'onglet Programme.</p>
      {([['ramadan', 'Ramadan', 30], ['30', '1 mois', 30], ['60', '2 mois', 60], ['90', '3 mois', 90]] as const).filter(([id]) => id !== 'ramadan').map(([id, title, d]) => (
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
      <p>Entrez le code d'invitation reçu de la personne qui gère le groupe, par exemple sur WhatsApp.</p>
      <label class="field">Code d'invitation<input type="text" value={code} placeholder="Ex. BA-1448" autocapitalize="characters" onInput={(e) => setCode((e.target as HTMLInputElement).value)} /></label>
      <p style="font-size:13px">Vous n'avez pas encore de code ? Continuez : vous pourrez l'ajouter plus tard dans l'onglet Groupe.</p>
    </>,
    <>
      <h1>Les rappels</h1>
      <p>Un rappel à l'heure de chaque séance de votre programme :</p>
      <div>{sessionsFor(chosen, sample).map((x) => <div class="setting"><div>{x.label}<small>{pagesLabel(x.pages)}</small></div><b>{x.defaultTime}</b></div>)}</div>
      <p style="font-size:13px">Vous pourrez changer les heures dans l'onglet Réglages.</p>
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
            ? <button class="btn teal" disabled={step === 0 && !gender} onClick={() => setStep(step + 1)}>Continuer</button>
            : <button class="btn teal" onClick={() => finish(true)}>Autoriser les rappels</button>}
        </div>
      </div>
    </div>
  );
}
