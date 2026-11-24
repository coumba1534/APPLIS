import { useStore, update, currentDay, toggleSession, setDayDone, readCatchUp, setCatchPlan, startTrial, todayISO, formatDate, endDate, getTrack, isPaused, pauseEnd, ramadanActive, activeTrackId, addDays, State, TrackId } from '../store';
import { ramadanEnd, useConfig } from '../config';
import { programmeById, sessionsFor } from '../data/programmes';
import { portion, portionPages, juzTitle, arabicName, pagesLabel, dayLabel, pageSpan, isPageStart, refShort, splitEqual, sectionEnd, pn, wholeJuz } from '../data/khatam';
import { TOTAL_PAGES, juzOf } from '../data/quran';
import { toast } from '../ui';
import { InstallCard } from './InstallCard';
import { RamadanBanner } from './RamadanBanner';

export function streak(s: State, id: TrackId | null = activeTrackId(s)) {
  const t = id ? getTrack(s, id) : null;
  if (!t || !id) return 0;
  const day = Math.min(currentDay(s, id), t.khatam.days);
  let n = 0;
  for (let d = t.done.includes(day) ? day : day - 1; d > 0 && t.done.includes(d); d--) n++;
  return n;
}

function pagesRead(s: State, id: TrackId, day: number) {
  const t = getTrack(s, id);
  if (!t) return 0;
  const N = t.khatam.days;
  let pages = 0;
  for (const d of t.done) { const [a, b] = portion(N, d); pages += portionPages(a, b); }
  if (day >= 1 && day <= N && !t.done.includes(day)) {
    const checked = new Set(t.sessions[day] ?? []);
    for (const x of sessionsFor(programmeById(s.programmeId), portion(N, day))) if (checked.has(x.index)) pages += x.pages;
  }
  return Math.min(Math.round(pages), TOTAL_PAGES);
}

/** Nom d'un jour pour les messages : « juz 9 » ou « jour 9 ». */
function dayName(N: number, d: number) {
  const t = juzTitle(...portion(N, d));
  return t ? t.toLowerCase() : `jour ${d}`;
}

/** « juz 5 → 6 » ou « juz 5 » pour une portion. */
const juzSpan = (a: number, b: number) => { const x = juzOf(a), y = juzOf(b); return x === y ? `juz ${x}` : `juz ${x} → ${y}`; };

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

const pagesRange = (a: number, b: number) => { const [x, y] = pageSpan(a, b); return x === y ? `p. ${x}` : `p. ${x}–${y}`; };

type Props = { openReader: (abs?: number) => void; onNewKhatam: () => void };

export function Today(props: Props) {
  const s = useStore();
  useConfig();
  const r = s.ramadan;
  const rDay = currentDay(s, 'ramadan');
  const paused = isPaused(s);
  return (
    <>
      {s.ramadanEnded && (
        <div class="card ramadan-end">
          <h3>{s.ramadanEnded.finished ? `${s.ramadanEnded.name} : khatam terminé` : `${s.ramadanEnded.name} est terminé`}</h3>
          <p>{s.ramadanEnded.finished
            ? "Machallah, vous avez lu le Coran en entier pendant ce Ramadan. Qu'Allah l'accepte de vous."
            : `Vous avez lu ${s.ramadanEnded.doneDays} jour${s.ramadanEnded.doneDays > 1 ? 's' : ''} sur ${s.ramadanEnded.days}. Vous n'avez pas pu terminer ce khatam du Ramadan : qu'Allah vous permette de le compléter l'année prochaine.`}</p>
          {s.khatam && !s.khatam.finishedOn && <p class="note">Votre khatam personnel reprend là où vous l'aviez laissé.</p>}
          <button class="ghost" style="justify-self:start" onClick={() => update({ ramadanEnded: null })}>Fermer</button>
        </div>
      )}
      <RamadanBanner />
      {r && rDay < 1 && (
        <div class="card ramadan-soon">
          <h3>🌙 {r.khatam.name} · J − {1 - rDay}</h3>
          <p>Vous avez rejoint le khatam du Ramadan : le Coran en 29 jours, à partir du {formatDate(r.khatam.start)}, selon l'annonce de la lune.</p>
          {s.khatam && !s.khatam.finishedOn && <p class="note">Votre khatam personnel continue jusque-là, puis il sera en pause pendant le Ramadan.</p>}
        </div>
      )}
      {r && ramadanActive(s) && <TrackCard id="ramadan" {...props} />}
      {paused ? (
        <div class="card">
          <h3>{s.khatam!.name} · en pause</h3>
          <p>Votre khatam personnel est en pause pendant le Ramadan. Il reprendra le {formatDate(addDays(pauseEnd(s)!, 1))}, là où vous l'avez laissé.</p>
        </div>
      ) : (
        <TrackCard id="personal" {...props} />
      )}
      <InstallCard />
    </>
  );
}

function TrackCard({ id, openReader, onNewKhatam }: Props & { id: TrackId }) {
  const s = useStore();
  const t = getTrack(s, id);
  const k = t?.khatam ?? null;
  const isRamadan = id === 'ramadan';

  // ---- Pas de khatam en cours ----
  if (!k) {
    if (isRamadan) return null;
    const stopped = s.history.some((x) => x.status === 'stopped');
    return (
      <>
        <div class="today">
          <span class="small">Bismillah</span>
          <span class="juz">Prêt pour un khatam ?</span>
          <p style="margin:0">Choisissez une durée (1, 2, 3 mois ou personnalisée) et lisez le Coran du début à la fin, à votre rythme.</p>
          <button class="btn" onClick={() => onNewKhatam()}>Commencer un khatam</button>
        </div>
        {stopped && <p class="note">Vous pouvez aussi reprendre un khatam interrompu depuis l'onglet Programme, dans l'historique.</p>}
        {s.bookmark && <button class="link" onClick={() => openReader()}>Reprendre la lecture au marque-page</button>}
      </>
    );
  }

  const N = k.days;
  const day = currentDay(s, id);
  const tDone = t!.done, tSessions = t!.sessions;
  const finished = !!k.finishedOn || tDone.length >= N;

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
      </>
    );
  }

  // ---- Khatam terminé ----
  if (finished) {
    return (
      <>
        <div class="card">
          <h3>{isRamadan ? 'Khatam du Ramadan terminé, machallah ✓' : 'Khatam terminé, machallah ✓'}</h3>
          <p>{k.name} · {N} jours{k.finishedOn ? `, terminé le ${formatDate(k.finishedOn)}` : ''}. Qu'Allah l'accepte de vous.</p>
          {!isRamadan && <button class="btn teal" onClick={() => onNewKhatam()}>Commencer un nouveau khatam</button>}
        </div>
        {!isRamadan && <button class="link" onClick={() => openReader()}>Relire le Coran</button>}
      </>
    );
  }

  const prog = programmeById(s.programmeId);
  const over = day > N;
  const cur = Math.min(day, N);
  const [a, b] = portion(N, cur);
  const sessions = over ? [] : sessionsFor(prog, [a, b]);
  const total = portionPages(a, b);
  const done = tDone.includes(cur);
  const checked = new Set(tSessions[cur] ?? []);
  const readToday = done ? total : sessions.filter((x) => checked.has(x.index)).reduce((t, x) => t + x.pages, 0);
  const missed = Array.from({ length: Math.min(day - 1, N) }, (_, i) => i + 1).filter((d) => !tDone.includes(d));
  const plan = t!.catchPlan;
  // Jour manqué déjà commencé : on propose de cocher les séances qui restent.
  const missedSessions = missed.length ? sessionsFor(prog, portion(N, missed[0])) : [];
  const missedChecked = new Set(missed.length ? tSessions[missed[0]] ?? [] : []);
  const missedLeft = missedSessions.filter((x) => !missedChecked.has(x.index));
  const missedPartial = missedChecked.size > 0 && missedLeft.length > 0;
  const catchDoneToday = plan?.lastDay === todayISO();
  const whole = wholeJuz(a, b);
  const showRange = !whole;

  // Lien de lecture : au début de la portion, puis à la prochaine séance une fois qu'on a commencé.
  const next = done ? undefined : sessions.find((x) => !checked.has(x.index));
  const resume = done ? { label: 'Relire la portion du jour', from: a }
    : checked.size > 0 && next ? { label: `Continuer de lire · ${next.label}`, from: next.a }
    : { label: 'Lire la portion du jour', from: a };

  const onSession = (index: number) => {
    const unchecking = done || checked.has(index);
    const completes = !unchecking && checked.size + 1 >= sessions.length;
    toggleSession(cur, index, sessions.length, id);
    toast(completes ? `Machallah ! ${dayName(N, cur)[0].toUpperCase() + dayName(N, cur).slice(1)} terminé` : unchecking ? 'Séance décochée' : 'Séance validée, machallah !');
  };

  // Rattrapage : la portion du jour manqué est lue en `parts` morceaux égaux.
  let catchRow = null;
  if (plan) {
    const [pa, pb] = portion(N, plan.day);
    const starts = splitEqual(pa, pb, plan.parts);
    const i = Math.min(plan.parts - 1, catchDoneToday ? plan.partsDone - 1 : plan.partsDone);
    const from = starts[i], to = sectionEnd(starts, i, pb);
    const onCatch = () => {
      if (catchDoneToday) { setCatchPlan({ ...plan, partsDone: plan.partsDone - 1, lastDay: null }, id); return; }
      const finishedDay = readCatchUp(id);
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
          <h3>{isRamadan ? `${k.name} · dernier jour pour rattraper` : 'La période est terminée'}</h3>
          <p>{tDone.length} jour{tDone.length > 1 ? 's' : ''} lu{tDone.length > 1 ? 's' : ''} sur {N}. {isRamadan
            ? `Vous pouvez rattraper les jours manquants jusqu'au ${formatDate(ramadanEnd())}, dernier jour du Ramadan.`
            : 'Vous pouvez encore rattraper les jours manquants, ou commencer un nouveau khatam.'}</p>
          {catchRow && <ul class="sessions plain">{catchRow}</ul>}
          {!isRamadan && <button class="btn teal" onClick={() => onNewKhatam()}>Commencer un nouveau khatam</button>}
        </div>
      ) : (
        <div class={`today ${isRamadan ? 'ramadan' : ''}`}>
          {isRamadan && <span class="track-name">🌙 {k.name}</span>}
          <div class="row"><span class="small">Jour {cur} sur {N}</span><span class="small">{pagesRange(a, b)}</span></div>
          <div class="row"><span class="juz">{juzTitle(a, b) ?? `Jour ${cur}`}</span><span class="ar">{arabicName(a, b)}</span></div>
          {showRange && <span class="small">{juzSpan(a, b)} · de {refShort(a)} à {refShort(b)} · {pagesLabel(total)}</span>}
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
          <button class={done ? 'btn soft' : 'btn'} onClick={() => { setDayDone(cur, !done, id); if (!done) toast('Machallah ! Jour terminé'); }}>
            {done ? 'Annuler « jour terminé »' : 'Jour terminé'}
          </button>
          <div class="links">
            <button class="link" onClick={() => openReader(resume.from)}>{resume.label}</button>
            {s.bookmark && <button class="link" onClick={() => openReader()}>Reprendre au marque-page</button>}
          </div>
        </div>
      )}

      {plan ? (
        <div class="catchup on">
          <b>Rattrapage du {dayName(N, plan.day)}</b>
          <p>{plan.partsDone}/{plan.parts} morceaux lus · un morceau par jour en plus de la lecture normale</p>
          <div class="bar"><i style={{ width: `${(plan.partsDone / plan.parts) * 100}%` }} /></div>
          <div class="opts"><button onClick={() => { setCatchPlan(null, id); toast('Rattrapage arrêté'); }}>Arrêter le rattrapage</button></div>
        </div>
      ) : missedPartial ? (
        <div class="catchup on">
          <b>{cap(dayName(N, missed[0]))} : il reste {missedLeft.length === 1 ? 'une séance' : `${missedLeft.length} séances`}</b>
          <p>Vous l'avez commencé. Cochez ce qu'il reste dès que c'est lu.</p>
          <ul class="sessions plain">
            {missedLeft.map((x) => (
              <li key={x.index}>
                <label class="sess">
                  <input type="checkbox" checked={false} onChange={() => {
                    const last = missedLeft.length === 1;
                    toggleSession(missed[0], x.index, missedSessions.length, id);
                    toast(last ? `Machallah ! ${cap(dayName(N, missed[0]))} terminé` : 'Séance validée, machallah !');
                  }} />
                  <div><b>{x.label}</b><small>{pagesLabel(x.pages)} · {pagesRange(x.a, x.b)}</small></div>
                </label>
              </li>
            ))}
          </ul>
          <button class="link" onClick={() => openReader(missedLeft[0].a)}>Lire la suite du {dayName(N, missed[0])}</button>
        </div>
      ) : missed.length > 0 && (
        <div class="catchup">
          <b>{cap(dayName(N, missed[0]))} pas encore lu</b>
          <p>Pas d'inquiétude : rattrapez-le en ajoutant un morceau à vos journées. Sur combien de jours ?</p>
          <div class="opts">
            {[1, 2, 4].map((d) => {
              const [pa, pb] = portion(N, missed[0]);
              return (
                <button key={d} onClick={() => { setCatchPlan({ day: missed[0], parts: d, partsDone: 0, lastDay: null }, id); toast(`Rattrapage ajouté à vos séances (${d} jour${d > 1 ? 's' : ''})`); }}>
                  {d} jour{d > 1 ? 's' : ''} · +{pn(portionPages(pa, pb) / d)} p./jour
                </button>
              );
            })}
          </div>
          <button class="link" onClick={() => { setDayDone(missed[0], true, id); toast(`${cap(dayName(N, missed[0]))} marqué comme lu`); }}>Je l'ai déjà lu</button>
        </div>
      )}

      <div class="stats">
        <div class="stat"><b>{tDone.length}/{N}</b><span>jours lus</span></div>
        <div class="stat"><b>{pagesRead(s, id, day)}</b><span>pages sur {TOTAL_PAGES}</span></div>
        <div class="stat"><b>{streak(s, id)}</b><span>jours d'affilée</span></div>
      </div>
    </>
  );
}
