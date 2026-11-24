import { useState } from 'preact/hooks';
import { useStore, update, setRamadanSetup, currentDay, endDate, formatDate, setKhatamStart, stopTrial, stopKhatam, resumeKhatam, resumeDay, deleteHistoryItem, hasProgress, isPaused, pauseEnd, leaveRamadan, addDays } from '../store';
import { ramadanEnd } from '../config';
import { ramadanStart } from '../config';
import { allProgrammes, sessionsFor, DEFAULT_CUSTOM, CUSTOM_ID, MAX_CUSTOM_SESSIONS, MOMENTS, customProgramme, sortByTime, CustomSession,
  RAMADAN_PROGRAMMES, RAMADAN_MOMENTS, RAMADAN_CUSTOM_ID, DEFAULT_RAMADAN_MOMENTS, ramadanCustom } from '../data/programmes';
import { portion, dayLabel, pagesLabel, portionPages, pageSpan, juzTitle } from '../data/khatam';
import { toast } from '../ui';
import { RamadanBanner } from './RamadanBanner';

export function Programme({ onNewKhatam }: { onNewKhatam: () => void }) {
  const s = useStore();
  const k = s.khatam;
  const N = k?.days ?? 30;
  const day = currentDay(s);
  const sample = portion(N, Math.min(Math.max(day, 1), N));
  const progs = allProgrammes();
  const trial = !!k?.plannedStart && k.plannedStart !== k.start;
  const finished = !!k?.finishedOn;
  /** Un khatam personnel en cours : on ne peut pas en commencer ou en reprendre un autre. */
  const active = !!k && !finished;
  const notStarted = !!k && day < 1;
  const [pending, setPending] = useState<{ id: string; action: 'resume' | 'delete' } | null>(null);
  const [stopping, setStopping] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const r = s.ramadan;
  const rDay = currentDay(s, 'ramadan');
  const paused = isPaused(s);
  /** Khatam du Ramadan rejoint et pas encore terminé : l'onglet montre d'abord son rythme et son calendrier. */
  const rOn = !!r && !r.khatam.finishedOn;
  const rSample = portion(29, Math.min(Math.max(rDay, 1), 29));
  const rMoments = r?.moments ?? DEFAULT_RAMADAN_MOMENTS;
  const rProgs = [...RAMADAN_PROGRAMMES, ramadanCustom(rMoments)];
  const rChosen = r?.programme ?? RAMADAN_PROGRAMMES[0].id;

  const chooseProgramme = (id: string) => {
    if (id === CUSTOM_ID && !s.customProgramme.length) update({ customProgramme: DEFAULT_CUSTOM.map((x) => ({ ...x })) });
    update({ programmeId: id });
    toast(id === CUSTOM_ID ? 'Programme personnalisé choisi' : `${progs.find((p) => p.id === id)?.name} choisi`);
  };

  const ramadanSummary = r && (
    <div class="card ramadan-card">
      <div class="row"><h3>🌙 {r.khatam.name}</h3><span class="pill">{r.khatam.finishedOn ? 'Terminé' : rDay < 1 ? 'À venir' : rDay > 29 ? 'Rattrapage' : `Jour ${rDay}/29`}</span></div>
      <p>29 jours · environ 21 pages par jour · {r.done.length}/29 jours lus</p>
      <p class="note">Du {formatDate(r.khatam.start)} au {formatDate(addDays(r.khatam.start, 28))}. Rattrapage possible jusqu'au {formatDate(ramadanEnd())}, dernier jour du Ramadan.</p>
    </div>
  );

  const ramadanRhythm = rOn && (<>
    <h2>Mon rythme du Ramadan</h2>
    <p class="note">La lecture du jour (environ 21 pages) est découpée en séances.</p>
    <div class="progs">
      {rProgs.map((p) => (
        <button class="prog" aria-pressed={p.id === rChosen} onClick={() => { setRamadanSetup({ programme: p.id, ...(p.id === RAMADAN_CUSTOM_ID && !r!.moments ? { moments: DEFAULT_RAMADAN_MOMENTS } : {}) }); toast(`${p.name} choisi`); }}>
          <b>{p.name}</b><small>{p.forWho}</small>
          <div class="chips">{sessionsFor(p, rSample).map((x) => <span>{x.label} · {pagesLabel(x.pages)}</span>)}</div>
        </button>
      ))}
    </div>
    {rChosen === RAMADAN_CUSTOM_ID && <RamadanEditor moments={rMoments} />}
  </>);

  const ramadanQuit = rOn && (
    <div class="card">
      {!leaving && <button class="link stop-link" onClick={() => setLeaving(true)}>Quitter le khatam du Ramadan</button>}
      {leaving && (
        <div class="confirm">
          <p><b>Votre progression sera perdue.</b> {r!.done.length > 0
            ? `Vous avez lu ${r!.done.length} jour${r!.done.length > 1 ? 's' : ''} sur 29, et ce khatam ne pourra pas être repris là où vous en êtes : seulement recommencé depuis le début.`
            : 'Il ne pourra pas être repris là où vous en êtes.'}{s.khatam && !s.khatam.finishedOn ? ' Votre khatam personnel reprendra dès demain.' : ''}</p>
          <div class="actions-row">
            <button class="btn danger-fill" onClick={() => { leaveRamadan(); setLeaving(false); toast('Khatam du Ramadan quitté'); }}>Quitter quand même</button>
            <button class="ghost" onClick={() => setLeaving(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );

  // Pendant le Ramadan (khatam rejoint, mois commencé) : seul le khatam du Ramadan est affiché.
  const ramadanMode = rOn && rDay >= 1;

  return (
    <>
      {!r && <RamadanBanner always />}
      {ramadanMode ? (<>
        <h2>Khatam du Ramadan</h2>
        {ramadanSummary}
        <h2>Calendrier du Ramadan · 29 jours</h2>
        <Calendar N={29} done={r!.done} day={rDay} />
        {active && (
          <div class="card">
            <h3>{k!.name} · en pause</h3>
            <p class="note">Votre khatam personnel est en pause pendant le Ramadan. Il reprendra le {formatDate(addDays(pauseEnd(s) ?? ramadanEnd(), 1))}, là où vous l'avez laissé.</p>
          </div>
        )}
        {ramadanRhythm}
        {ramadanQuit}
      </>) : (<>
        {r && (<>
          <h2>Khatam du Ramadan</h2>
          {ramadanSummary}
          {ramadanRhythm}
          {ramadanQuit}
        </>)}

        <h2>Mon khatam</h2>
        {!k ? (
          <div class="card">
            <h3>Aucun khatam en cours</h3>
            <p>Choisissez une durée et commencez à lire le Coran du début à la fin.</p>
            <button class="btn teal" onClick={onNewKhatam}>Commencer un khatam</button>
            {s.history.some((x) => x.status === 'stopped') && <p class="note">Vous pouvez aussi reprendre un khatam interrompu, dans l'historique plus bas.</p>}
          </div>
        ) : (<>
          <div class="card">
            <div class="row"><h3>{k.name}</h3><span class="pill">{finished ? 'Terminé' : paused ? 'En pause' : day < 1 ? 'À venir' : day > N ? 'Période finie' : `Jour ${day}/${N}`}</span></div>
            <p>{N} jours · {dayLabel(N)}</p>
            <p class="note">Du {formatDate(k.start)} au {formatDate(endDate(k))}{(k.pauses?.length || r) ? ' (pauses du Ramadan comprises)' : ''}</p>
            {paused && <p class="note">En pause pendant le Ramadan : il reprend le {formatDate(addDays(pauseEnd(s)!, 1))}.</p>}
          </div>
          <h2>Calendrier · {N} jours</h2>
          <Calendar N={N} done={s.done} day={day} />
        </>)}

        <h2>{rOn ? 'Mon programme habituel' : 'Mon programme de lecture'}</h2>
        {rOn && <p class="note">Il s'appliquera à votre khatam personnel après le Ramadan.</p>}
        <p class="note">La portion du jour ({pagesLabel(portionPages(sample[0], sample[1]))}) est découpée en séances. Changez de programme quand vous voulez.</p>
        <div class="progs">
          {progs.map((p) => (
            <button class="prog" aria-pressed={p.id === s.programmeId} onClick={() => chooseProgramme(p.id)}>
              <b>{p.name}</b><small>{p.forWho}</small>
              <div class="chips">{sessionsFor(p, sample).map((x) => <span>{x.label} · {pagesLabel(x.pages)}</span>)}</div>
            </button>
          ))}
        </div>
        {s.programmeId === CUSTOM_ID && <CustomEditor sample={sample} />}

        {k && (<>
          <h2>Gérer mon khatam</h2>
          <div class="card">
            {notStarted && !trial && (
              <div class="setting">
                <div>{k.kind === 'ramadan' ? '1er jour du Ramadan' : 'Date de début'}<small>{k.kind === 'ramadan' ? "Date estimée, à ajuster selon l'annonce de la lune" : 'Modifiable jusqu\'au premier jour'}</small></div>
                <input type="date" value={k.start} aria-label="Date de début" onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) { setKhatamStart(v); toast(`Début : ${formatDate(v)}`); } }} />
              </div>
            )}
            {notStarted && k.kind === 'ramadan' && k.start !== ramadanStart() && !trial && (
              <button class="link" onClick={() => { setKhatamStart(ramadanStart()); toast('Date annoncée remise'); }}>Remettre la date annoncée</button>
            )}
            {trial && !finished && (
              <div class="setting"><div>Mode essai<small>Commencé aujourd'hui, prévu le {formatDate(k.plannedStart!)}</small></div>
                <button class="ghost" onClick={() => { stopTrial(); toast('Retour à la date prévue'); }}>Arrêter l'essai</button></div>
            )}
            {finished && <button class="btn teal" onClick={onNewKhatam}>Commencer un nouveau khatam</button>}
            {active && !stopping && <button class="link stop-link" onClick={() => setStopping(true)}>Arrêter ce khatam</button>}
            {active && stopping && (
              <div class="confirm">
                <p>Arrêter « {k.name} » ? Vous pourrez ensuite commencer un nouveau khatam.</p>
                <div class="actions-row">
                  {hasProgress(s) && (
                    <button class="btn teal" onClick={() => { stopKhatam(true); setStopping(false); toast('Khatam gardé dans l\'historique'); }}>Garder dans l'historique</button>
                  )}
                  <button class="btn danger-fill" onClick={() => { stopKhatam(false); setStopping(false); toast('Khatam supprimé'); }}>Supprimer définitivement</button>
                  <button class="ghost" onClick={() => setStopping(false)}>Annuler</button>
                </div>
                {hasProgress(s) && <p class="note">Gardé dans l'historique, il pourra être repris là où vous vous êtes arrêté.</p>}
              </div>
            )}
          </div>
        </>)}
      </>)}

      {s.history.length > 0 && (
        <>
          <h2>Historique</h2>
          <div class="card">
            {s.history.map((h) => {
              const day = resumeDay(h);
              const asking = pending?.id === h.id ? pending.action : null;
              return (
                <div class="hist-item" key={h.id}>
                  <div class="hist">
                    <div><b>{h.name}</b><small>{h.days} jours · du {formatDate(h.start, false)}</small></div>
                    <span class={`pill ${h.status === 'done' ? '' : 'late'}`}>{h.status === 'done' ? `Terminé le ${formatDate(h.end, false)}` : `Interrompu · ${h.doneDays}/${h.days}`}</span>
                  </div>
                  {!asking && (
                    <div class="hist-actions">
                      {h.status === 'stopped' && !active && !h.id.startsWith('ramadan-') && <button class="ghost" onClick={() => setPending({ id: h.id, action: 'resume' })}>Reprendre</button>}
                      <button class="ghost danger" onClick={() => setPending({ id: h.id, action: 'delete' })}>Supprimer</button>
                    </div>
                  )}
                  {asking === 'resume' && (
                    <div class="confirm">
                      <p>{h.progress
                        ? `Vous reprenez au jour ${day} sur ${h.days}, à partir d'aujourd'hui. Les dates sont décalées et vos jours déjà lus sont conservés.`
                        : `Les jours déjà lus n'avaient pas été enregistrés pour ce khatam : il reprendra au jour 1, à partir d'aujourd'hui.`}
</p>
                      <div class="actions-row">
                        <button class="btn teal" onClick={() => { resumeKhatam(h.id); setPending(null); toast(`« ${h.name} » repris`); }}>Reprendre ce khatam</button>
                        <button class="ghost" onClick={() => setPending(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                  {asking === 'delete' && (
                    <div class="confirm">
                      <p>Supprimer « {h.name} » de l'historique ? {h.status === 'stopped' ? 'Sa progression sera perdue.' : 'Cette action est définitive.'}</p>
                      <div class="actions-row">
                        <button class="btn danger-fill" onClick={() => { deleteHistoryItem(h.id); setPending(null); toast('Supprimé de l\'historique'); }}>Supprimer</button>
                        <button class="ghost" onClick={() => setPending(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/** Calendrier d'un khatam : lu, aujourd'hui, en retard, à venir. */
function Calendar({ N, done: doneDays, day }: { N: number; done: number[]; day: number }) {
  return (<>
    <div class="legend"><span style="--c:var(--teal)">Lu</span><span style="--c:var(--saffron)">Aujourd'hui</span><span style="--c:var(--late)">En retard</span><span style="--c:var(--line)">À venir</span></div>
    <div class="gridN">
      {Array.from({ length: N }, (_, i) => {
        const d = i + 1, done = doneDays.includes(d);
        const cls = done ? 'done' : d === day ? 'now' : d < day ? 'late' : '';
        const [a, b] = portion(N, d);
        const [p1, p2] = pageSpan(a, b);
        const label = done ? 'lu' : d === day ? 'auj.' : d < day ? 'retard' : `p. ${p1}`;
        return <div class={`cell ${cls}`} title={`Jour ${d} · ${juzTitle(a, b) ?? ''} pages ${p1} à ${p2}`}><b>{d}</b><small>{label}</small></div>;
      })}
    </div>
  </>);
}

/** Rythme personnalisé du Ramadan : les moments choisis, à parts égales. Les heures se règlent dans l'onglet Rappels. */
function RamadanEditor({ moments }: { moments: string[] }) {
  const set = (next: string[]) => setRamadanSetup({ moments: next });
  return (
    <div class="card">
      <h3>Mes moments du Ramadan</h3>
      <p class="note">La lecture du jour est partagée à parts égales entre vos moments, rangés dans l'ordre de la journée. Les heures des rappels se règlent dans l'onglet Rappels.</p>
      {moments.map((m, i) => (
        <div class="crow crow-r" key={i}>
          <select class="cname" aria-label={`Moment ${i + 1}`} value={m} onChange={(e) => set(moments.map((x, j) => (j === i ? (e.target as HTMLSelectElement).value : x)))}>
            {RAMADAN_MOMENTS.map((o) => <option value={o.label} disabled={o.label !== m && moments.includes(o.label)}>{o.label}</option>)}
          </select>
          <small class="cpages" style="grid-column:auto;margin-top:0">{pagesLabel(21 / moments.length)}</small>
          <button class="rm-btn" aria-label={`Retirer le moment ${i + 1}`} disabled={moments.length <= 1} onClick={() => set(moments.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div class="actions-row">
        <button class="ghost" disabled={moments.length >= 6} onClick={() => { const o = RAMADAN_MOMENTS.find((x) => !moments.includes(x.label)); if (o) set([...moments, o.label]); }}>+ Ajouter un moment</button>
      </div>
    </div>
  );
}

/** Éditeur du programme personnalisé : un moment et une heure par séance. Les parts sont calculées. */
function CustomEditor({ sample }: { sample: [number, number] }) {
  const s = useStore();
  const list: CustomSession[] = s.customProgramme.length ? s.customProgramme : DEFAULT_CUSTOM;
  const set = (next: CustomSession[]) => update({ customProgramme: sortByTime(next) });
  const patch = (i: number, p: Partial<CustomSession>) => set(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const sizes = sessionsFor(customProgramme(), sample);
  const known = (label: string) => MOMENTS.some((m) => m.label === label);
  return (
    <div class="card">
      <h3>Mes séances</h3>
      <p class="note">Choisissez le moment et l'heure de chaque séance. La portion du jour est partagée automatiquement à parts égales, selon la durée de votre khatam.</p>
      {list.map((x, i) => (
        <div class="crow" key={i}>
          <select class="cname" aria-label={`Moment de la séance ${i + 1}`} value={known(x.label) ? x.label : '__autre'}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              if (v === '__autre') patch(i, { label: 'Ma séance' });
              else patch(i, { label: v, time: MOMENTS.find((m) => m.label === v)!.time });
            }}>
            {MOMENTS.map((m) => <option value={m.label}>{m.label}</option>)}
            <option value="__autre">Autre…</option>
          </select>
          <input type="time" value={x.time} aria-label={`Heure de rappel de la séance ${i + 1}`} onChange={(e) => patch(i, { time: (e.target as HTMLInputElement).value })} />
          <button class="rm-btn" aria-label={`Retirer la séance ${i + 1}`} disabled={list.length <= 1} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          {!known(x.label) && (
            <input type="text" class="cother" value={x.label} maxLength={32} aria-label={`Nom de la séance ${i + 1}`} placeholder="Nom de la séance"
              onInput={(e) => patch(i, { label: (e.target as HTMLInputElement).value })} />
          )}
          <small class="cpages">{sizes[i] ? `${pagesLabel(sizes[i].pages)} · ${Math.round(100 / list.length)} % de la portion` : ''}</small>
        </div>
      ))}
      <div class="actions-row">
        <button class="ghost" disabled={list.length >= MAX_CUSTOM_SESSIONS} onClick={() => {
          const used = new Set(list.map((x) => x.label));
          const m = MOMENTS.find((x) => !used.has(x.label)) ?? MOMENTS[MOMENTS.length - 1];
          set([...list, { label: m.label, time: m.time }]);
        }}>+ Ajouter une séance</button>
      </div>
      <p class="note">Les séances sont rangées dans l'ordre de la journée.</p>
    </div>
  );
}
