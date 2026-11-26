import { useState } from 'preact/hooks';
import { restore } from '../backup';
import { useStore, update } from '../store';
import type { Gender } from '../store';
import { toast } from '../ui';

/** Choix « Un homme / Une femme » : les groupes ne sont pas mixtes. */
export function GenderChoice({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  return (
    <div class="gchoice" role="radiogroup" aria-label="Vous êtes">
      <button role="radio" aria-checked={value === 'f'} onClick={() => onChange('f')}>Une femme</button>
      <button role="radio" aria-checked={value === 'm'} onClick={() => onChange('m')}>Un homme</button>
    </div>
  );
}

/** Question posée une fois aux personnes qui avaient déjà l'appli avant l'arrivée des groupes. */
export function GenderCard() {
  const s = useStore();
  if (!s.onboarded || s.gender) return null;
  return (
    <div class="card gender-card">
      <h3>Une question pour les groupes</h3>
      <p>Les groupes de lecture ne sont pas mixtes : un groupe de sœurs n'accueille que des sœurs, un groupe de frères que des frères. Vous êtes…</p>
      <GenderChoice value={null} onChange={(g) => { update({ gender: g }); toast('Merci, c\'est noté'); }} />
    </div>
  );
}

/** Mon profil (onglet Rappels) : prénom et genre. Le genre ne se change pas quand on est dans un groupe. */
export function ProfileCard({ inGroup = false }: { inGroup?: boolean }) {
  const s = useStore();
  return (
    <div class="card">
      <label class="field">Prénom<input type="text" value={s.name} autocomplete="given-name" maxLength={30}
        onChange={(e) => { update({ name: (e.target as HTMLInputElement).value.trim() }); toast('Prénom enregistré'); }} /></label>
      <div class="field">Vous êtes
        {inGroup
          ? <p class="note">{s.gender === 'f' ? 'Une femme' : 'Un homme'} · pour le changer, quittez d'abord votre groupe.</p>
          : <GenderChoice value={s.gender} onChange={(g) => { update({ gender: g }); toast('Enregistré'); }} />}
      </div>
    </div>
  );
}

// ---- Code personnel (sauvegarde) ----

/** Envoie le code à soi-même (WhatsApp, Notes…) ou le copie. */
async function sendCode(code: string) {
  const text = `Mon code personnel Khatm : ${code}\nIl permet de retrouver ma progression sur un nouveau téléphone (Mon profil > Retrouver ma progression).`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast('Code copié');
  } catch { /* partage annulé */ }
}

/** Le code personnel, dans « Mon profil ». */
export function BackupCard() {
  const s = useStore();
  const [restoring, setRestoring] = useState(false);
  return (
    <div class="card backup-card">
      <h3>Mon code personnel</h3>
      <p class="note">Votre progression est sauvegardée toute seule. Sur un nouveau téléphone, ou si vous réinstallez l'appli, ce code fait tout revenir : khatm, réglages et groupe.</p>
      {s.backupCode ? <div class="bcode">{s.backupCode}</div> : <p class="note">Code en préparation… (il faut une connexion internet)</p>}
      {s.backupCode && <button class="btn teal" onClick={() => sendCode(s.backupCode)}>Me l'envoyer</button>}
      <p class="note">Gardez-le pour vous, comme un mot de passe : sans lui, la progression ne peut pas être retrouvée.</p>
      {!restoring ? <button class="link" onClick={() => setRestoring(true)}>Retrouver une progression avec un code</button> : <RestoreForm onCancel={() => setRestoring(false)} replaceWarning />}
    </div>
  );
}

/** Une seule fois, sur l'écran Aujourd'hui : noter son code. */
export function BackupNoteCard() {
  const s = useStore();
  if (!s.onboarded || !s.backupCode || s.backupNoted) return null;
  return (
    <div class="card backup-card">
      <h3>Notez votre code personnel</h3>
      <p>Il permet de retrouver toute votre progression si vous changez de téléphone ou réinstallez l'appli.</p>
      <div class="bcode">{s.backupCode}</div>
      <div class="actions-row">
        <button class="btn teal" onClick={() => sendCode(s.backupCode)}>Me l'envoyer</button>
        <button class="ghost" onClick={() => update({ backupNoted: true })}>C'est noté</button>
      </div>
      <p class="note">Vous le retrouverez à tout moment dans « Mon profil » (onglet Rappels).</p>
    </div>
  );
}

/** Saisir un code pour retrouver sa progression. */
export function RestoreForm({ onCancel, replaceWarning = false }: { onCancel: () => void; replaceWarning?: boolean }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'code' | 'introuvable' | 'reseau'>('');
  return (
    <div class="restore">
      <label class="field">Votre code personnel
        <input type="text" value={code} placeholder="KHTM-XXXX-XXXX" autocapitalize="characters" autocomplete="off" spellcheck={false}
          onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
      </label>
      {replaceWarning && <p class="note">Attention : la progression de ce téléphone sera remplacée par celle du code.</p>}
      {state === 'code' && <p class="block-msg">Ce code n'a pas le bon format : il ressemble à KHTM-7Q4F-2MZX.</p>}
      {state === 'introuvable' && <p class="block-msg">Aucune sauvegarde ne correspond à ce code. Vérifiez-le, lettre par lettre.</p>}
      {state === 'reseau' && <p class="block-msg">Pas de connexion. Réessayez dans un instant.</p>}
      <div class="actions-row">
        <button class="btn teal" disabled={state === 'busy' || code.trim().length < 8} onClick={async () => { setState('busy'); const r = await restore(code); if (r !== 'ok') setState(r); }}>
          {state === 'busy' ? 'Recherche…' : 'Retrouver ma progression'}
        </button>
        <button class="ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
