import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, currentDay, update, syncRamadanStart, closeRamadanIfOver, ramadanActive } from './store';
import { loadConfig, useConfig } from './config';
import { absOf, juzOf, pageOf } from './data/quran';
import { portion } from './data/khatam';
import { Toast, icons } from './ui';
import { Today, streak } from './screens/Today';
import { Reader, ReaderTarget } from './screens/Reader';
import { Programme } from './screens/Programme';
import { Group } from './screens/Group';
import { Reminders } from './screens/Reminders';
import { Onboarding } from './screens/Onboarding';
import { Finale } from './screens/Finale';
import { NewKhatam } from './screens/NewKhatam';
import { startReminders } from './device';
import { isDark, toggleTheme } from './theme';

type Tab = 'today' | 'read' | 'plan' | 'group' | 'bell';
const TABS: [Tab, string][] = [['today', "Aujourd'hui"], ['read', 'Lire'], ['plan', 'Programme'], ['group', 'Groupe'], ['bell', 'Rappels']];

export function App() {
  const s = useStore();
  // À la réouverture, on revient sur le dernier onglet et la dernière lecture.
  const [tab, setTabState] = useState<Tab>(() => (s.onboarded && TABS.some(([id]) => id === s.lastTab) ? s.lastTab as Tab : 'today'));
  const dayStartJuz = () => (s.khatam ? juzOf(portion(s.khatam.days, Math.min(Math.max(currentDay(s), 1), s.khatam.days))[0]) : 1);
  const [target, setTargetState] = useState<ReaderTarget>(() => s.readerTarget ?? { mode: 'juz', juz: dayStartJuz() });
  const [newOpen, setNewOpen] = useState(false);
  const config = useConfig();
  /** 'bookmark' : on ouvre Lire depuis « Reprendre au marque-page » ; 'resume' : on reprend où on en était. */
  const [start, setStart] = useState<'resume' | 'bookmark'>('resume');
  const setTab = (t: Tab) => { setTabState(t); update({ lastTab: t }); };
  const setTarget = (t: ReaderTarget) => { setTargetState(t); update({ readerTarget: t }); };
  const [readerTitle, setReaderTitle] = useState<[string, string]>(['Lire', '']);
  const N = s.khatam?.days ?? 0;
  // Écran de fin : affiché une fois, quand on valide le dernier jour d'un khatam (personnel ou du Ramadan).
  const finishedIds = () => [s.khatam, s.ramadan?.khatam].filter((k) => k?.finishedOn).map((k) => k!.id);
  const [finaleSeen, setFinaleSeen] = useState<string[]>(finishedIds);

  useEffect(() => { const id = startReminders(); return () => clearInterval(id); }, []);
  // Réglages à distance : à l'ouverture et chaque fois qu'on revient dans l'appli.
  useEffect(() => {
    loadConfig();
    const onVisible = () => { if (document.visibilityState === 'visible') loadConfig(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  // La date du Ramadan peut changer (annonce de la lune) : les khatams concernés suivent.
  useEffect(() => { syncRamadanStart(); closeRamadanIfOver(); }, [config.ramadan.start, config.ramadan.days]);
  // Fin du Ramadan : vérifiée à l'ouverture et quand on revient dans l'appli.
  useEffect(() => {
    closeRamadanIfOver();
    const onVisible = () => { if (document.visibilityState === 'visible') closeRamadanIfOver(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  // Hauteur de l'en-tête, pour coller la barre d'outils de lecture juste en dessous.
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const day = currentDay(s);
  const hello = `Assalamou alaykoum${s.name ? `, ${s.name}` : ''}`;
  const titles: Record<Tab, [string, string]> = {
    today: [hello, ramadanActive(s) ? `Jour ${Math.min(currentDay(s, 'ramadan'), 29)} · ${s.ramadan!.khatam.name}` : !s.khatam ? 'Prêt pour un nouveau khatam' : day >= 1 && day <= N ? (s.khatam.kind === 'ramadan' ? `Jour ${day} du Ramadan` : `Jour ${day} sur ${N}`) : s.khatam.name],
    read: readerTitle,
    plan: ['Mon programme', 'Mon khatam, à mon rythme'],
    group: ['Mon groupe', 'On avance ensemble'],
    bell: ['Rappels', 'Notifications du khatam'],
  };

  /** Ouvre Lire : au verset demandé (début de la portion du jour), sinon au marque-page. */
  const openReader = (abs?: number) => {
    if (abs !== undefined) {
      update({ readerAbs: abs });
      setTarget(s.reader.layout === 'page' ? { mode: 'page', page: pageOf(abs) } : { mode: 'juz', juz: juzOf(abs) });
      setStart('resume');
    } else {
      const b = s.bookmark;
      setTarget(b ? { mode: 'juz', juz: juzOf(absOf(b.s, b.n)) } : { mode: 'juz', juz: dayStartJuz() });
      setStart('bookmark');
    }
    setTab('read');
  };

  const n = streak(s);
  return (
    <div class="app">
      <header class="top" ref={header}>
        <div><b>{titles[tab][0]}</b><small>{titles[tab][1]}</small></div>
        <div class="top-right">
          {n > 0 && <span class="streak">🔥 {n} jour{n > 1 ? 's' : ''}</span>}
          <button class="theme-btn" aria-label={isDark() ? 'Passer en mode clair' : 'Passer en mode sombre'} onClick={toggleTheme}>
            {isDark()
              ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
              : <svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>}
          </button>
        </div>
      </header>
      <main>
        {tab === 'today' && <Today openReader={openReader} onNewKhatam={() => setNewOpen(true)} />}
        {tab === 'read' && <Reader target={target} setTarget={setTarget} onTitle={setReaderTitle} start={start} />}
        {tab === 'plan' && <Programme onNewKhatam={() => setNewOpen(true)} />}
        {tab === 'group' && <Group />}
        {tab === 'bell' && <Reminders />}
      </main>
      <nav class="tabs" aria-label="Navigation">
        {TABS.map(([id, label]) => (
          <button aria-current={tab === id ? 'page' : undefined} onClick={() => { setStart('resume'); setTab(id); window.scrollTo(0, 0); }}>{icons[id]}{label}</button>
        ))}
      </nav>
      {!s.onboarded && <Onboarding onDone={() => setTab('today')} />}
      {[s.ramadan?.khatam, s.khatam].filter((k) => k?.finishedOn && !finaleSeen.includes(k.id)).slice(0, 1).map((k) => <Finale khatam={k!} onClose={() => setFinaleSeen([...finaleSeen, k!.id])} />)}
      {newOpen && <NewKhatam onClose={() => setNewOpen(false)} onStarted={() => { setTab('today'); window.scrollTo(0, 0); }} />}
      <Toast />
    </div>
  );
}

