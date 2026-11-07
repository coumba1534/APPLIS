import { useStore, update } from '../store';
import { toast } from '../ui';

/** Groupes : l'affichage arrive avec Firebase (comptes, groupes partagés, rôle d'administratrice). */
export function Group() {
  const s = useStore();
  return (
    <>
      <div class="card">
        <h3>Mon groupe</h3>
        <p>Bientôt, vous verrez ici la progression de vos sœurs et vous pourrez les encourager.</p>
        <label class="field">Code d'invitation du groupe
          <input type="text" value={s.groupCode} placeholder="Ex. BA-1448" autocapitalize="characters"
            onChange={(e) => { update({ groupCode: (e.target as HTMLInputElement).value.trim().toUpperCase() }); toast('Code enregistré'); }} />
        </label>
        <p class="note">Le code est gardé pour le moment où les groupes seront activés. Seule l'administratrice crée les groupes et valide les demandes.</p>
      </div>
      <div class="card">
        <h3>Ma progression</h3>
        <p>{s.done.length} juz lus sur 30.</p>
        <div class="bar" style="color:var(--teal)"><i style={{ width: `${(s.done.length / 30) * 100}%` }} /></div>
      </div>
    </>
  );
}
