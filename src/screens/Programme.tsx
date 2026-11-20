import { useState } from 'preact/hooks';
import { useStore, update, currentDay, endDate, formatDate, setKhatamStart, stopTrial, resumeKhatam, resumeDay, deleteHistoryItem, hasProgress } from '../store';
import { ramadanStart } from '../config';
import { allProgrammes, sessionsFor, DEFAULT_CUSTOM, CUSTOM_ID, MAX_CUSTOM_SESSIONS, MOMENTS, customProgramme, sortByTime, CustomSession } from '../data/programmes';
import { portion, dayLabel, pagesLabel, portionPages, pageSpan, juzTitle } from '../data/khatam';
import { toast } from '../ui';

export function Programme({ onNewKhatam }: { onNewKhatam: () => void }) {
  const s = useStore();
  const k = s.khatam;
  const N = k.days;
  const day = currentDay(s);
  const sample = portion(N, Math.min(Math.max(day, 1), N));
  const progs = allProgrammes();
  const trial = !!k.plannedStart && k.plannedStart !== k.start;
  const finished = !!k.finishedOn;
  const [pending, setPending] = useState<{ id: string; action: 'resume' | 'delete' } | null>(null);

  const chooseProgramme = (id: string) => {
    if (id === CUSTOM_ID && !s.customProgramme.length) update({ customProgramme: DEFAULT_CUSTOM.map((x) => ({ ...x })) });
    update({ programmeId: id });
    toast(id === CUSTOM_ID ? 'Programme personnalisé choisi' : `${progs.find((p) => p.id === id)?.name} choisi`);
  };

  return (
    <>
      <h2>Mon khatam</h2>
      <div class="card">
        <div class="row"><h3>{k.name}</h3><span class="pill">{finished ? 'Terminé' : day < 1 ? 'À venir' : day > N ? 'Période finie' : `Jour ${day}/${N}`}</span></div>
        <p>{N} jours · {dayLabel(N)}</p>
        <p class="note">Du {formatDate(k.start)} au {formatDate(endDate(k))}</p>
        <div class="setting">
          <div>{k.kind === 'ramadan' ? '1er jour du Ramadan' : 'Date de début'}<small>{k.kind === 'ramadan' ? "Date estimée, à ajuster selon l'annonce de la lune" : 'Vous pouvez la décaler'}</small></div>
          <input type="date" value={k.start} aria-label="Date de début" onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) { setKhatamStart(v); toast(`Début : ${formatDate(v)}`); } }} />
        </div>
        {trial && (
          <div class="setting"><div>Mode essai<small>Commencé aujourd'hui, prévu le {formatDate(k.plannedStart!)}</small></div>
            <button class="ghost" onClick={() => { stopTrial(); toast('Retour à la date prévue'); }}>Arrêter l'essai</button></div>
        )}
        {k.kind === 'ramadan' && k.start !== ramadanStart() && !trial && (
          <button class="link" onClick={() => { setKhatamStart(ramadanStart()); toast('Date annoncée remise'); }}>Remettre la date annoncée</button>
        )}
        <button class="btn teal" onClick={onNewKhatam}>Nouveau khatam</button>
        <p class="note">Un seul khatam à la fois. Le khatam en cours est gardé dans l'historique.</p>
      </div>

      <h2>Mon programme de lecture</h2>
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

      <h2>Calendrier · {N} jours</h2>
      <div class="legend"><span style="--c:var(--teal)">Lu</span><span style="--c:var(--saffron)">Aujourd'hui</span><span style="--c:var(--late)">En retard</span><span style="--c:var(--line)">À venir</span></div>
      <div class="gridN">
        {Array.from({ length: N }, (_, i) => {
          const d = i + 1, done = s.done.includes(d);
          const cls = done ? 'done' : d === day ? 'now' : d < day ? 'late' : '';
          const [a, b] = portion(N, d);
          const [p1, p2] = pageSpan(a, b);
          const label = done ? 'lu' : d === day ? 'auj.' : d < day ? 'retard' : `p. ${p1}`;
          return <div class={`cell ${cls}`} title={`Jour ${d} · ${juzTitle(a, b) ?? ''} pages ${p1} à ${p2}`}><b>{d}</b><small>{label}</small></div>;
        })}
      </div>

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
                      {h.status === 'stopped' && <button class="ghost" onClick={() => setPending({ id: h.id, action: 'resume' })}>Reprendre</button>}
                      <button class="ghost danger" onClick={() => setPending({ id: h.id, action: 'delete' })}>Supprimer</button>
                    </div>
                  )}
                  {asking === 'resume' && (
                    <div class="confirm">
                      <p>{h.progress
                        ? `Vous reprenez au jour ${day} sur ${h.days}, à partir d'aujourd'hui. Les dates sont décalées et vos jours déjà lus sont conservés.`
                        : `Les jours déjà lus n'avaient pas été enregistrés pour ce khatam : il reprendra au jour 1, à partir d'aujourd'hui.`}
                        {hasProgress(s) && !k.finishedOn ? ` Votre khatam en cours (${s.done.length}/${N} jours lus) sera gardé dans l'historique comme interrompu.` : ''}</p>
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
