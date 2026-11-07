import { useStore, update, currentDay, toggleSession, setJuzDone, readCatchUp, todayISO, formatDate, State } from '../store';
import { programmeById, sessionsFor } from '../data/programmes';
import { JUZ_NAMES, TOTAL_PAGES, juzPages } from '../data/quran';
import { toast } from '../ui';
import { InstallCard } from './InstallCard';

const juzSize = (j: number) => { const [a, b] = juzPages(j); return b - a + 1; };

export function streak(s: State) {
  const day = Math.min(currentDay(s), 30);
  let n = 0;
  for (let d = s.done.includes(day) ? day : day - 1; d > 0 && s.done.includes(d); d--) n++;
  return n;
}

function pagesRead(s: State, day: number) {
  let pages = 0;
  for (const j of s.done) pages += juzSize(j);
  if (!s.done.includes(day)) {
    const checked = new Set(s.sessions[day] ?? []);
    for (const ses of sessionsFor(programmeById(s.programmeId), day)) if (checked.has(ses.index)) pages += ses.pages;
  }
  return Math.min(pages, TOTAL_PAGES);
}

export function Today({ openReader }: { openReader: () => void }) {
  const s = useStore();
  const day = currentDay(s);

  if (day < 1) {
    return (
      <>
        <div class="today">
          <span class="small">Ramadan 1448</span>
          <span class="juz">J − {1 - day}</span>
          <p style="margin:0">Le khatam commence le {formatDate(s.ramadanStart)}, in shaa Allah. La date sera ajustée selon l'annonce de la lune.</p>
          <button class="btn" onClick={() => { update({ trialStart: todayISO() }); toast('Essai lancé : jour 1 aujourd\'hui'); }}>Essayer maintenant</button>
        </div>
        <p class="note">L'essai vous fait commencer au jour 1 dès aujourd'hui. Vous pourrez revenir au calendrier du Ramadan dans l'onglet Programme.</p>
        <InstallCard />
      </>
    );
  }

  if (day > 30) {
    return (
      <div class="card">
        <h3>Ramadan terminé</h3>
        <p>Vous avez lu {s.done.length} juz sur 30. Qu'Allah accepte vos efforts.</p>
        <p class="note">Pour recommencer un khatam, changez la date de début dans l'onglet Programme.</p>
      </div>
    );
  }

  const prog = programmeById(s.programmeId);
  const sessions = sessionsFor(prog, day);
  const [first, last] = juzPages(day);
  const total = last - first + 1;
  const done = s.done.includes(day);
  const checked = new Set(s.sessions[day] ?? []);
  const readToday = done ? total : sessions.filter((x) => checked.has(x.index)).reduce((t, x) => t + x.pages, 0);
  const missed = Array.from({ length: day - 1 }, (_, i) => i + 1).filter((d) => !s.done.includes(d));
  const plan = s.catchPlan;
  const catchDoneToday = plan?.lastDay === todayISO();

  const onSession = (index: number) => {
    const unchecking = done || checked.has(index);
    const completes = !unchecking && checked.size + 1 >= sessions.length;
    toggleSession(day, index, sessions.length);
    toast(completes ? `Machallah ! Juz ${day} terminé` : unchecking ? 'Séance décochée' : 'Séance validée, barakallahou fiki');
  };

  const onCatch = () => {
    if (!plan) return;
    if (catchDoneToday) {
      update({ catchPlan: { ...plan, read: Math.max(0, plan.read - plan.perDay), lastDay: null } });
      return;
    }
    const size = juzSize(plan.juz);
    const finished = readCatchUp(size);
    toast(finished ? `Machallah ! Juz ${plan.juz} rattrapé` : `Rattrapage : ${Math.min(size, plan.read + plan.perDay)}/${size} pages du juz ${plan.juz}`);
  };

  let catchSession = null;
  if (plan) {
    const size = juzSize(plan.juz);
    const already = catchDoneToday ? plan.read - plan.perDay : plan.read;
    const from = juzPages(plan.juz)[0] + already;
    const to = Math.min(juzPages(plan.juz)[1], from + plan.perDay - 1);
    catchSession = (
      <li>
        <label class={`sess catch ${catchDoneToday ? 'ok' : ''}`}>
          <input type="checkbox" checked={catchDoneToday} onChange={onCatch} />
          <div><b>Rattrapage · juz {plan.juz}</b><small>{to - from + 1} pages · p. {from}–{to} · {plan.read}/{size}</small></div>
        </label>
      </li>
    );
  }

  return (
    <>
      <div class="today">
        <div class="row"><span class="small">Jour {day} sur 30</span><span class="small">Pages {first}–{last}</span></div>
        <div class="row"><span class="juz">Juz {day}</span><span class="ar">{JUZ_NAMES[day - 1]}</span></div>
        <div>
          <div class="row small" style="margin-bottom:6px"><span>Pages lues aujourd'hui</span><span>{readToday}/{total}</span></div>
          <div class="bar"><i style={{ width: `${(readToday / total) * 100}%` }} /></div>
        </div>
        <ul class="sessions">
          {sessions.map((x) => {
            const ok = done || checked.has(x.index);
            return (
              <li key={x.index}>
                <label class={`sess ${ok ? 'ok' : ''}`}>
                  <input type="checkbox" checked={ok} onChange={() => onSession(x.index)} />
                  <div><b>{x.label}</b><small>{x.detail ? `${x.detail} · ` : ''}{x.pages} pages · p. {x.from}–{x.to}</small></div>
                </label>
              </li>
            );
          })}
          {catchSession}
        </ul>
        <button class={done ? 'btn soft' : 'btn'} onClick={() => { setJuzDone(day, !done); if (!done) toast('Machallah ! Juz terminé'); }}>
          {done ? 'Annuler « juz terminé »' : 'Juz terminé'}
        </button>
        <button class="link" onClick={openReader}>{s.bookmark ? 'Reprendre la lecture au marque-page' : `Lire le juz ${day}`}</button>
      </div>

      {plan ? (
        <div class="catchup on">
          <b>Rattrapage du juz {plan.juz}</b>
          <p>{plan.read}/{juzSize(plan.juz)} pages · {plan.perDay} pages en plus par jour</p>
          <div class="bar"><i style={{ width: `${(plan.read / juzSize(plan.juz)) * 100}%` }} /></div>
          <div class="opts"><button onClick={() => { update({ catchPlan: null }); toast('Rattrapage arrêté'); }}>Arrêter le rattrapage</button></div>
        </div>
      ) : missed.length > 0 && (
        <div class="catchup">
          <b>Juz {missed[0]} pas encore lu</b>
          <p>Pas d'inquiétude : rattrapez-le en ajoutant quelques pages à vos journées. Sur combien de jours ?</p>
          <div class="opts">
            {[[1, 20], [2, 10], [4, 5]].map(([d, n]) => (
              <button key={d} onClick={() => { update({ catchPlan: { juz: missed[0], perDay: n, read: 0, lastDay: null } }); toast(`Rattrapage ajouté : +${n} pages par jour`); }}>
                {d} jour{d > 1 ? 's' : ''} · +{n} p.
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="stats">
        <div class="stat"><b>{s.done.length}/30</b><span>juz lus</span></div>
        <div class="stat"><b>{pagesRead(s, day)}</b><span>pages sur 604</span></div>
        <div class="stat"><b>{streak(s)}</b><span>jours d'affilée</span></div>
      </div>
      <InstallCard />
    </>
  );
}
