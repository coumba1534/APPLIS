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
