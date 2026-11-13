import { useStore, update, currentDay, toggleSession, setDayDone, readCatchUp, startTrial, todayISO, formatDate, endDate, State } from '../store';
import { programmeById, sessionsFor } from '../data/programmes';
import { portion, portionPages, juzTitle, arabicName, pagesLabel, dayLabel, pageSpan, isPageStart, refShort, splitEqual, sectionEnd, pn, wholeJuz } from '../data/khatam';
import { TOTAL_PAGES } from '../data/quran';
import { toast } from '../ui';
import { InstallCard } from './InstallCard';

export function streak(s: State) {
  const day = Math.min(currentDay(s), s.khatam.days);
  let n = 0;
  for (let d = s.done.includes(day) ? day : day - 1; d > 0 && s.done.includes(d); d--) n++;
  return n;
}

function pagesRead(s: State, day: number) {
  const N = s.khatam.days;
  let pages = 0;
  for (const d of s.done) { const [a, b] = portion(N, d); pages += portionPages(a, b); }
  if (day >= 1 && day <= N && !s.done.includes(day)) {
    const checked = new Set(s.sessions[day] ?? []);
    for (const x of sessionsFor(programmeById(s.programmeId), portion(N, day))) if (checked.has(x.index)) pages += x.pages;
  }
  return Math.min(Math.round(pages), TOTAL_PAGES);
}

/** Nom d'un jour pour les messages : « juz 9 » ou « jour 9 ». */
function dayName(N: number, d: number) {
  const t = juzTitle(...portion(N, d));
  return t ? t.toLowerCase() : `jour ${d}`;
}

const pagesRange = (a: number, b: number) => { const [x, y] = pageSpan(a, b); return x === y ? `p. ${x}` : `p. ${x}–${y}`; };

export function Today({ openReader, onNewKhatam }: { openReader: (abs?: number) => void; onNewKhatam: () => void }) {
  const s = useStore();
  const k = s.khatam;
  const N = k.days;
  const day = currentDay(s);
  const finished = !!k.finishedOn || s.done.length >= N;

  // ---- Avant le début ----
  if (day < 1) {
    return (
      <>
        <div class="today">
          <span class="small">{k.name}</span>
          <span class="juz">J − {1 - day}</span>
          <p style="margin:0">
            {k.kind === 'ramadan'
              ? <>Le khatam commence le {formatDate(k.start)}, in shaa Allah. La date sera ajustée selon l'annonce de la lune.</>
              : <>Votre khatam commence le {formatDate(k.start)} et se termine le {formatDate(endDate(k))}.</>}
          </p>
          <p class="small" style="margin:0">{N} jours · {dayLabel(N)}</p>
          <button class="btn" onClick={() => { startTrial(); toast("C'est parti : jour 1 aujourd'hui"); }}>Commencer dès aujourd'hui</button>
        </div>
        <p class="note">Vous pourrez revenir à la date prévue dans l'onglet Programme.</p>
        <InstallCard />
      </>
    );
  }

  // ---- Khatam terminé ----
  if (finished) {
    return (
      <>
        <div class="card">
          <h3>Khatam terminé, machallah ✓</h3>
          <p>{k.name} · {N} jours{k.finishedOn ? `, terminé le ${formatDate(k.finishedOn)}` : ''}. Qu'Allah l'accepte de vous.</p>
          <button class="btn teal" onClick={onNewKhatam}>Commencer un nouveau khatam</button>
        </div>
        <button class="link" onClick={() => openReader()}>Relire le Coran</button>
        <InstallCard />
      </>
    );
  }

  const prog = programmeById(s.programmeId);
  const over = day > N;
  const cur = Math.min(day, N);
  const [a, b] = portion(N, cur);
  const sessions = over ? [] : sessionsFor(prog, [a, b]);
  const total = portionPages(a, b);
  const done = s.done.includes(cur);
  const checked = new Set(s.sessions[cur] ?? []);
  const readToday = done ? total : sessions.filter((x) => checked.has(x.index)).reduce((t, x) => t + x.pages, 0);
  const missed = Array.from({ length: Math.min(day - 1, N) }, (_, i) => i + 1).filter((d) => !s.done.includes(d));
  const plan = s.catchPlan;
  const catchDoneToday = plan?.lastDay === todayISO();
  const whole = wholeJuz(a, b);
  const showRange = !whole;

  const onSession = (index: number) => {
    const unchecking = done || checked.has(index);
    const completes = !unchecking && checked.size + 1 >= sessions.length;
    toggleSession(cur, index, sessions.length);
    toast(completes ? `Machallah ! ${dayName(N, cur)[0].toUpperCase() + dayName(N, cur).slice(1)} terminé` : unchecking ? 'Séance décochée' : 'Séance validée, barakallahou fiki');
  };

  // Rattrapage : la portion du jour manqué est lue en `parts` morceaux égaux.
  let catchRow = null;
  if (plan) {
    const [pa, pb] = portion(N, plan.day);
    const starts = splitEqual(pa, pb, plan.parts);
    const i = Math.min(plan.parts - 1, catchDoneToday ? plan.partsDone - 1 : plan.partsDone);
    const from = starts[i], to = sectionEnd(starts, i, pb);
    const onCatch = () => {
      if (catchDoneToday) { update({ catchPlan: { ...plan, partsDone: plan.partsDone - 1, lastDay: null } }); return; }
      const finishedDay = readCatchUp();
      toast(finishedDay ? `Machallah ! ${dayName(N, plan.day)} rattrapé` : `Rattrapage : ${plan.partsDone + 1}/${plan.parts} du ${dayName(N, plan.day)}`);
    };
    catchRow = (
      <li>
        <label class={`sess catch ${catchDoneToday ? 'ok' : ''}`}>
          <input type="checkbox" checked={catchDoneToday} onChange={onCatch} />
          <div><b>Rattrapage · {dayName(N, plan.day)}</b><small>{pagesLabel(portionPages(from, to))} · {pagesRange(from, to)} · {plan.partsDone - (catchDoneToday ? 1 : 0) + 1}/{plan.parts}</small></div>
        </label>
      </li>
    );
  }

  return (
    <>
      {over ? (
        <div class="card">
          <h3>La période est terminée</h3>
          <p>{s.done.length} jour{s.done.length > 1 ? 's' : ''} lu{s.done.length > 1 ? 's' : ''} sur {N}. Vous pouvez encore rattraper les jours manquants, ou commencer un nouveau khatam.</p>
          {catchRow && <ul class="sessions plain">{catchRow}</ul>}
          <button class="btn teal" onClick={onNewKhatam}>Commencer un nouveau khatam</button>
        </div>
      ) : (
        <div class="today">
          <div class="row"><span class="small">Jour {cur} sur {N}</span><span class="small">{pagesRange(a, b)}</span></div>
          <div class="row"><span class="juz">{juzTitle(a, b) ?? `Jour ${cur}`}</span><span class="ar">{arabicName(a, b)}</span></div>
          {showRange && <span class="small">De {refShort(a)} à {refShort(b)} · {pagesLabel(total)}</span>}
          <div>
            <div class="row small" style="margin-bottom:6px"><span>Pages lues aujourd'hui</span><span>{pn(readToday)}/{pn(total)}</span></div>
            <div class="bar"><i style={{ width: `${(readToday / total) * 100}%` }} /></div>
          </div>
          <ul class="sessions">
            {sessions.map((x) => {
              const ok = done || checked.has(x.index);
              const exact = isPageStart(x.a) && isPageStart(x.b + 1);
              return (
                <li key={x.index}>
                  <label class={`sess ${ok ? 'ok' : ''}`}>
                    <input type="checkbox" checked={ok} onChange={() => onSession(x.index)} />
                    <div>
                      <b>{x.label}</b>
                      <small>{x.detail ? `${x.detail} · ` : ''}{pagesLabel(x.pages)} · {pagesRange(x.a, x.b)}</small>
                      {!exact && <small>{refShort(x.a)} → {refShort(x.b)}</small>}
                    </div>
                  </label>
                </li>
              );
            })}
            {catchRow}
          </ul>
          <button class={done ? 'btn soft' : 'btn'} onClick={() => { setDayDone(cur, !done); if (!done) toast('Machallah ! Jour terminé'); }}>
            {done ? 'Annuler « jour terminé »' : 'Jour terminé'}
          </button>
          <div class="links">
            <button class="link" onClick={() => openReader(a)}>Lire la portion du jour</button>
            {s.bookmark && <button class="link" onClick={() => openReader()}>Reprendre au marque-page</button>}
          </div>
        </div>
      )}

      {plan ? (
        <div class="catchup on">
          <b>Rattrapage du {dayName(N, plan.day)}</b>
          <p>{plan.partsDone}/{plan.parts} morceaux lus · un morceau par jour en plus de la lecture normale</p>
          <div class="bar"><i style={{ width: `${(plan.partsDone / plan.parts) * 100}%` }} /></div>
          <div class="opts"><button onClick={() => { update({ catchPlan: null }); toast('Rattrapage arrêté'); }}>Arrêter le rattrapage</button></div>
        </div>
      ) : missed.length > 0 && (
        <div class="catchup">
          <b>{dayName(N, missed[0])[0].toUpperCase() + dayName(N, missed[0]).slice(1)} pas encore lu</b>
          <p>Pas d'inquiétude : rattrapez-le en ajoutant un morceau à vos journées. Sur combien de jours ?</p>
          <div class="opts">
            {[1, 2, 4].map((d) => {
              const [pa, pb] = portion(N, missed[0]);
              return (
                <button key={d} onClick={() => { update({ catchPlan: { day: missed[0], parts: d, partsDone: 0, lastDay: null } }); toast(`Rattrapage ajouté à vos séances (${d} jour${d > 1 ? 's' : ''})`); }}>
                  {d} jour{d > 1 ? 's' : ''} · +{pn(portionPages(pa, pb) / d)} p./jour
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div class="stats">
        <div class="stat"><b>{s.done.length}/{N}</b><span>jours lus</span></div>
        <div class="stat"><b>{pagesRead(s, day)}</b><span>pages sur {TOTAL_PAGES}</span></div>
        <div class="stat"><b>{streak(s)}</b><span>jours d'affilée</span></div>
      </div>
      <InstallCard />
    </>
  );
}
