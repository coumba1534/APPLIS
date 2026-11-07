import { useStore, update, currentDay, DEFAULT_RAMADAN_START, todayISO, formatDate } from '../store';
import { PROGRAMMES, describeSessions } from '../data/programmes';
import { juzPages } from '../data/quran';
import { toast } from '../ui';

export function Programme() {
  const s = useStore();
  const day = currentDay(s);
  return (
    <>
      <h2>Mon programme de lecture</h2>
      <p class="note">Le juz du jour (environ 20 pages, soit 2 hizb) est découpé en séances selon votre rythme. Vous pouvez changer de programme à tout moment.</p>
      <div class="progs">
        {PROGRAMMES.map((p) => (
          <button class="prog" aria-pressed={p.id === s.programmeId} onClick={() => { update({ programmeId: p.id }); toast(`${p.name} choisi`); }}>
            <b>{p.name}</b><small>{p.forWho}</small>
            <div class="chips">{p.sessions.map((x, i) => <span>{x.label} · {describeSessions(p)[i]}</span>)}</div>
          </button>
        ))}
      </div>

      <h2>30 juz en 30 jours</h2>
      <div class="legend"><span style="--c:var(--teal)">Lu</span><span style="--c:var(--saffron)">Aujourd'hui</span><span style="--c:var(--late)">En retard</span><span style="--c:var(--line)">À venir</span></div>
      <div class="grid30">
        {Array.from({ length: 30 }, (_, i) => {
          const d = i + 1, done = s.done.includes(d);
          const cls = done ? 'done' : d === day ? 'now' : d < day ? 'late' : '';
          const [a, b] = juzPages(d);
          return <div class={`cell ${cls}`} title={`Juz ${d} · pages ${a} à ${b}`}><b>{d}</b><small>{done ? 'lu' : d === day ? 'auj.' : d < day ? 'retard' : `p. ${a}`}</small></div>;
        })}
      </div>

      <h2>Calendrier</h2>
      <div class="card">
        <div class="setting">
          <div>1er jour du Ramadan<small>Date estimée, à ajuster selon l'annonce de la lune</small></div>
          <input type="date" value={s.ramadanStart} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) { update({ ramadanStart: v }); toast(`Début : ${formatDate(v)}`); } }} />
        </div>
        {s.trialStart
          ? <div class="setting"><div>Mode essai<small>Commencé le {formatDate(s.trialStart)}</small></div>
              <button class="ghost" onClick={() => { update({ trialStart: null, done: [], sessions: {}, catchPlan: null }); toast('Retour au calendrier du Ramadan'); }}>Arrêter l'essai</button></div>
          : <div class="setting"><div>Essayer avant le Ramadan<small>Le jour 1 commence aujourd'hui</small></div>
              <button class="ghost" onClick={() => { update({ trialStart: todayISO() }); toast('Essai lancé'); }}>Essayer</button></div>}
        {s.ramadanStart !== DEFAULT_RAMADAN_START && <button class="link" onClick={() => update({ ramadanStart: DEFAULT_RAMADAN_START })}>Remettre la date estimée</button>}
      </div>
    </>
  );
}
