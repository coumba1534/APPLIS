// Parcours d'accueil du khatam du Ramadan : il s'ouvre après « Rejoindre ».
// Accueil festif, le défi, le rythme, les rappels, l'intention, puis « Bismillah, je commence ».
import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, formatDate, setRamadanSetup, setReminderTime, daysBetween, todayISO } from '../store';
import { RAMADAN_PROGRAMMES, RAMADAN_MOMENTS, RAMADAN_CUSTOM_ID, DEFAULT_RAMADAN_MOMENTS, ramadanCustom, sessionsFor, Programme } from '../data/programmes';
import { portion, pagesLabel } from '../data/khatam';
import { Moon, Stars, Lantern, StarBurst } from './RamadanArt';

const STEPS = 6;
const icons: Record<string, string> = {
  'r-suhur': 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  'r-iftar': 'M3 18h18M6 18a6 6 0 0 1 12 0M12 6V3M5.2 9.2 3.5 7.5M18.8 9.2l1.7-1.7',
  'r-prieres': 'M4 20h16M6 20v-7a6 6 0 0 1 12 0v7M12 7V4M10 20v-4a2 2 0 0 1 4 0v4',
  [RAMADAN_CUSTOM_ID]: 'M12 3l2.4 5.6L20 9.3l-4.4 3.9 1.3 5.8L12 16l-4.9 3 1.3-5.8L4 9.3l5.6-.7z',
};
const SUGGESTIONS = ["me rapprocher d'Allah", 'mes parents', 'ma famille', "tenir jusqu'au bout", 'mieux comprendre le Coran'];

export function RamadanWelcome() {
  const s = useStore();
  const r = s.ramadan!;
  const [step, setStep] = useState(0);
  const [prog, setProg] = useState(r.programme ?? 'r-suhur');
  const [moments, setMoments] = useState<string[]>(r.moments ?? DEFAULT_RAMADAN_MOMENTS);
  const [niyya, setNiyya] = useState(r.niyya ?? '');
  const [evening, setEvening] = useState(r.extras?.evening ?? true);
  const [last10, setLast10] = useState(r.extras?.last10 ?? true);
  const [times, setTimes] = useState<Record<number, string>>({});
  const [burst, setBurst] = useState(false);
  const touch = useRef<number | null>(null);

  const programme: Programme = prog === RAMADAN_CUSTOM_ID ? ramadanCustom(moments) : RAMADAN_PROGRAMMES.find((p) => p.id === prog)!;
  const day1 = sessionsFor(programme, portion(29, 1));
  const timeOf = (i: number) => times[i] ?? programme.sessions[i].time;
  const toStart = daysBetween(todayISO(), r.khatam.start);
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS - 1, n)));
  useEffect(() => setTimes({}), [prog, moments.join('|')]);

  const finish = () => {
    programme.sessions.forEach((_, i) => setReminderTime(programme.id, i, timeOf(i)));
    setRamadanSetup({ welcomed: true, programme: prog, moments, niyya: niyya.trim() || undefined, extras: { evening, last10 } });
  };
  const start = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    setBurst(true);
    window.setTimeout(finish, 1300);
  };

  const options = [...RAMADAN_PROGRAMMES, ramadanCustom(moments)];
  const foot = (label = 'Continuer') => (
    <div class="rw-foot">
      <button class="rw-back" onClick={() => go(step - 1)}>Retour</button>
      <div class="rw-dots">{Array.from({ length: STEPS }, (_, i) => <i class={i === step ? 'on' : ''} />)}</div>
      <button class="rw-btn" onClick={() => go(step + 1)}>{label}</button>
    </div>
  );

  return (
    <div class="overlay rw" role="dialog" aria-label="Accueil du khatm du Ramadan"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const x0 = touch.current; touch.current = null;
        if (x0 === null || (e.target as HTMLElement).closest('textarea, input, select')) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 70 && step < STEPS - 1) go(step + (dx < 0 ? 1 : -1));
      }}>
      <Stars />
      {burst && <StarBurst />}
      <div class="rw-track" style={{ transform: `translateX(${-step * 100}%)` }}>
        {/* 1. Accueil */}
        <section class="rw-slide" aria-hidden={step !== 0}>
          <div class="rw-lanterns" aria-hidden="true">
            <Lantern style="left:24px" size={44} />
            <Lantern style="right:40px" size={36} delay={-1.2} />
            <Lantern style="left:62%" size={28} delay={-2.4} />
          </div>
          <div class="rw-hero">
            <svg class="rw-crescent" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="rw-cres"><rect width="100" height="100" fill="#fff" /><circle cx="63" cy="40" r="36" fill="#000" /></mask></defs><circle cx="50" cy="50" r="40" fill="#F6DDB0" mask="url(#rw-cres)" /></svg>
            <div class="rw-ar">رمضان مبارك</div>
            <div class="rw-greet">Ramadan Moubarak{s.name ? `, ${s.name}` : ''}</div>
            <p class="rw-lead">Votre khatm du {r.khatam.name} vous attend : le Coran en entier, en 29 nuits.</p>
            <span class="rw-pill">{toStart > 0 ? `Début estimé : ${formatDate(r.khatam.start)}, selon la lune` : toStart === 0 ? "C'est aujourd'hui, bismillah !" : 'Le Ramadan a commencé'}</span>
          </div>
          <div class="grow" />
          <button class="rw-btn wide" onClick={() => go(1)}>Préparer mon Ramadan</button>
        </section>

        {/* 2. Le défi */}
        <section class="rw-slide" aria-hidden={step !== 1}>
          <span class="rw-eyebrow">Votre défi</span>
          <h2>29 nuits pour lire le Coran en entier</h2>
          <div class="rw-counters">
            <div><b>29</b><span>nuits</span></div><div><b>30</b><span>juz</span></div><div><b>604</b><span>pages</span></div>
          </div>
          <p class="rw-lead">Environ 21 pages par jour. Le jour 1 commence par le juz 1, la dernière nuit se termine avec le juz ʿAmma.</p>
          <div class={`rw-moons ${step === 1 ? 'play' : ''}`}>{Array.from({ length: 29 }, (_, i) => <Moon k={(i + 1) / 29} style={`animation-delay:${0.3 + i * 0.07}s`} />)}</div>
          <p class="rw-cap">La lune grandit avec votre lecture : chaque jour lu en éclaire une nouvelle phase.</p>
          <div class="grow" />
          {foot()}
        </section>

        {/* 3. Le rythme */}
        <section class="rw-slide" aria-hidden={step !== 2}>
          <span class="rw-eyebrow">Votre rythme</span>
          <h2>Quand lirez-vous pendant le Ramadan ?</h2>
          <p class="rw-lead">Les journées changent pendant le mois : choisissez un rythme fait pour elles. Votre programme habituel reste intact pour après.</p>
          <div class="rw-opts">
            {options.map((p) => (
              <button class="rw-opt" aria-pressed={prog === p.id} onClick={() => setProg(p.id)}>
                <span class="rw-ic"><svg viewBox="0 0 24 24"><path d={icons[p.id]} /></svg></span>
                <span><b>{p.name}</b><small>{p.id === RAMADAN_CUSTOM_ID ? 'Vos moments à vous : la lecture du jour est partagée à parts égales'
                  : sessionsFor(p, portion(29, 1)).map((x) => `${x.label} ${pagesLabel(x.pages)}`).join(' · ')}</small></span>
              </button>
            ))}
          </div>
          {prog === RAMADAN_CUSTOM_ID && (
            <div class="rw-perso">
              {moments.map((m, i) => (
                <div class="rw-prow">
                  <select aria-label={`Moment ${i + 1}`} value={m} onChange={(e) => setMoments(moments.map((x, j) => (j === i ? (e.target as HTMLSelectElement).value : x)))}>
                    {RAMADAN_MOMENTS.map((o) => <option value={o.label}>{o.label}</option>)}
                  </select>
                  <span>{pagesLabel(21 / moments.length)}</span>
                  <button aria-label="Retirer" disabled={moments.length < 2} onClick={() => setMoments(moments.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button class="rw-chip" disabled={moments.length >= 6} onClick={() => { const m = RAMADAN_MOMENTS.find((o) => !moments.includes(o.label)); if (m) setMoments([...moments, m.label]); }}>+ Ajouter un moment</button>
            </div>
          )}
          <div class="grow" />
          {foot()}
        </section>

        {/* 4. Les rappels */}
        <section class="rw-slide" aria-hidden={step !== 3}>
          <span class="rw-eyebrow">Vos rappels</span>
          <h2>On vous fait signe au bon moment</h2>
          <div class="rw-rem">
            {day1.map((x, i) => (
              <div class="rw-row"><div>{x.label}<small>Jour 1 : p. {x.pageFrom}–{x.pageTo}</small></div>
                <input type="time" value={timeOf(i)} aria-label={`Heure du rappel ${x.label}`} onChange={(e) => setTimes({ ...times, [i]: (e.target as HTMLInputElement).value })} /></div>
            ))}
            <div class="rw-row"><div>Encouragement du soir<small>Si la journée n'est pas finie, un petit mot le soir</small></div>
              <input type="checkbox" class="rw-switch" checked={evening} aria-label="Encouragement du soir" onChange={() => setEvening(!evening)} /></div>
            <div class="rw-row"><div>Les 10 dernières nuits<small>Un rappel spécial pour la dernière ligne droite</small></div>
              <input type="checkbox" class="rw-switch" checked={last10} aria-label="Rappel des 10 dernières nuits" onChange={() => setLast10(!last10)} /></div>
          </div>
          <div class="rw-notif"><span class="app">Khatm · {timeOf(0)}</span><b>🌙 {day1[0]?.label} · Juz 1</b><span>Pages {day1[0]?.pageFrom} à {day1[0]?.pageTo}. Bismillah !</span></div>
          <div class="grow" />
          {foot()}
        </section>

        {/* 5. L'intention */}
        <section class="rw-slide" aria-hidden={step !== 4}>
          <span class="rw-eyebrow">Votre intention · facultatif</span>
          <h2>Pour quoi faites-vous ce khatm ?</h2>
          <p class="rw-lead">Une phrase à garder en tête. Elle s'affichera discrètement chaque jour sur votre carte du Ramadan.</p>
          <textarea maxLength={120} placeholder="Je fais ce khatm pour…" value={niyya} onInput={(e) => setNiyya((e.target as HTMLTextAreaElement).value)} />
          <div class="rw-chips">{SUGGESTIONS.map((x) => <button class="rw-chip" onClick={() => setNiyya(`Je fais ce khatm pour ${x}`)}>{x}</button>)}</div>
          <div class="grow" />
          {foot()}
        </section>

        {/* 6. Bismillah */}
        <section class="rw-slide" aria-hidden={step !== 5}>
          <span class="rw-eyebrow">Tout est prêt</span>
          <h2>Votre {r.khatam.name}</h2>
          <div class="rw-recap">
            <div><span>Khatm</span><span>29 nuits · ≈ 21 pages par jour</span></div>
            <div><span>Rythme</span><span>{programme.name}</span></div>
            <div><span>Rappels</span><span>{programme.sessions.map((_, i) => timeOf(i)).join(' · ')}</span></div>
            <div><span>Intention</span><span>{niyya.trim() || '—'}</span></div>
            {s.khatam && !s.khatam.finishedOn && <div><span>Khatm personnel</span><span>en pause pendant le mois</span></div>}
          </div>
          <div class="grow" />
          <button class="rw-btn wide" onClick={start}>Bismillah, je commence</button>
          <div class="rw-foot"><button class="rw-back" onClick={() => go(step - 1)}>Retour</button><div class="rw-dots">{Array.from({ length: STEPS }, (_, i) => <i class={i === step ? 'on' : ''} />)}</div><span /></div>
        </section>
      </div>
    </div>
  );
}
