import { useStore, update, currentDay, endDate, formatDate, setKhatamStart, stopTrial, DEFAULT_RAMADAN_START } from '../store';
import { allProgrammes, sessionsFor, DEFAULT_CUSTOM, CUSTOM_ID, MAX_CUSTOM_SESSIONS, customProgramme, CustomSession } from '../data/programmes';
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
        {k.kind === 'ramadan' && k.start !== DEFAULT_RAMADAN_START && !trial && (
          <button class="link" onClick={() => { setKhatamStart(DEFAULT_RAMADAN_START); toast('Date estimée remise'); }}>Remettre la date estimée</button>
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
            {s.history.map((h) => (
              <div class="hist" key={h.id}>
                <div><b>{h.name}</b><small>{h.days} jours · du {formatDate(h.start, false)}</small></div>
                <span class={`pill ${h.status === 'done' ? '' : 'late'}`}>{h.status === 'done' ? `Terminé le ${formatDate(h.end, false)}` : `Interrompu · ${h.doneDays}/${h.days}`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Éditeur du programme personnalisé : des séances, chacune avec sa part de la portion et son heure de rappel. */
function CustomEditor({ sample }: { sample: [number, number] }) {
  const s = useStore();
  const list: CustomSession[] = s.customProgramme.length ? s.customProgramme : DEFAULT_CUSTOM;
  const total = list.reduce((t, x) => t + x.share, 0);
  const set = (next: CustomSession[]) => update({ customProgramme: next });
  const patch = (i: number, p: Partial<CustomSession>) => set(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const equalize = () => {
    const n = list.length, each = Math.floor(100 / n);
    set(list.map((x, i) => ({ ...x, share: i === n - 1 ? 100 - each * (n - 1) : each })));
    toast('Parts réparties également');
  };
  const sizes = sessionsFor(customProgramme(), sample);
  return (
    <div class="card">
      <h3>Mes séances</h3>
      <p class="note">Donnez un nom, une part de la portion du jour et une heure de rappel à chaque séance.</p>
      {list.map((x, i) => (
        <div class="crow" key={i}>
          <input type="text" class="cname" value={x.label} maxLength={32} aria-label={`Nom de la séance ${i + 1}`} placeholder="Nom"
            onInput={(e) => patch(i, { label: (e.target as HTMLInputElement).value })} />
          <label class="cshare"><input type="number" min={1} max={100} value={x.share} aria-label={`Part de la séance ${i + 1} en pourcentage`}
            onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10); if (v > 0) patch(i, { share: Math.min(100, v) }); }} />%</label>
          <input type="time" value={x.time} aria-label={`Heure de rappel de la séance ${i + 1}`} onChange={(e) => patch(i, { time: (e.target as HTMLInputElement).value })} />
          <button class="rm-btn" aria-label={`Retirer la séance ${i + 1}`} disabled={list.length <= 1} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          <small class="cpages">{sizes[i] ? pagesLabel(sizes[i].pages) : ''}</small>
        </div>
      ))}
      <div class="row">
        <span class={`pill ${total === 100 ? '' : 'late'}`}>Total : {total} %</span>
        <span class="note">{total === 100 ? 'Parfait' : 'Ajusté automatiquement à 100 %'}</span>
      </div>
      <div class="opts" style="margin-top:2px">
        <button class="ghost" disabled={list.length >= MAX_CUSTOM_SESSIONS} onClick={() => set([...list, { label: `Séance ${list.length + 1}`, share: Math.max(5, Math.round(100 / (list.length + 1))), time: '12:00' }])}>+ Ajouter une séance</button>
        <button class="ghost" onClick={equalize}>Répartir également</button>
      </div>
    </div>
  );
}

