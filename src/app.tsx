import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, currentDay, update } from './store';
import { absOf, juzOf } from './data/quran';
import { Toast, icons } from './ui';
import { Today, streak } from './screens/Today';
import { Reader, ReaderTarget } from './screens/Reader';
import { Programme } from './screens/Programme';
import { Group } from './screens/Group';
import { Reminders } from './screens/Reminders';
import { Onboarding } from './screens/Onboarding';
import { Finale } from './screens/Finale';
import { startReminders } from './device';
import { isDark, toggleTheme } from './theme';

type Tab = 'today' | 'read' | 'plan' | 'group' | 'bell';
const TABS: [Tab, string][] = [['today', "Aujourd'hui"], ['read', 'Lire'], ['plan', 'Programme'], ['group', 'Groupe'], ['bell', 'Rappels']];

export function App() {
  const s = useStore();
  // À la réouverture, on revient sur le dernier onglet et la dernière lecture.
  const [tab, setTabState] = useState<Tab>(() => (s.onboarded && TABS.some(([id]) => id === s.lastTab) ? s.lastTab as Tab : 'today'));
  const [target, setTargetState] = useState<ReaderTarget>(() => s.readerTarget ?? { mode: 'juz', juz: Math.min(Math.max(currentDay(s), 1), 30) });
  /** 'bookmark' : on ouvre Lire depuis « Reprendre au marque-page » ; 'resume' : on reprend où on en était. */
  const [start, setStart] = useState<'resume' | 'bookmark'>('resume');
  const setTab = (t: Tab) => { setTabState(t); update({ lastTab: t }); };
  const setTarget = (t: ReaderTarget) => { setTargetState(t); update({ readerTarget: t }); };
  const [readerTitle, setReaderTitle] = useState<[string, string]>(['Lire', '']);
  const [finaleSeen, setFinaleSeen] = useState(s.done.length === 30);

  useEffect(() => { const id = startReminders(); return () => clearInterval(id); }, []);
  // Hauteur de l'en-tête, pour coller la barre d'outils de lecture juste en dessous.
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (s.done.length < 30) setFinaleSeen(false); }, [s.done.length]);

  const day = currentDay(s);
  const hello = `Assalamou alaykoum${s.name ? `, ${s.name}` : ''}`;
  const titles: Record<Tab, [string, string]> = {
    today: [hello, day >= 1 && day <= 30 ? `Jour ${day} du Ramadan 1448` : 'Ramadan 1448'],
    read: readerTitle,
    plan: ['Mon programme', 'Un juz par jour, à mon rythme'],
    group: ['Mon groupe', 'On avance ensemble'],
    bell: ['Rappels', 'Notifications du khatam'],
  };

  const openReader = () => {
    const b = s.bookmark;
    setTarget(b ? { mode: 'juz', juz: juzOf(absOf(b.s, b.n)) } : { mode: 'juz', juz: Math.min(Math.max(day, 1), 30) });
    setStart('bookmark');
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
        {tab === 'today' && <Today openReader={openReader} />}
        {tab === 'read' && <Reader target={target} setTarget={setTarget} onTitle={setReaderTitle} start={start} />}
        {tab === 'plan' && <Programme />}
        {tab === 'group' && <Group />}
        {tab === 'bell' && <Reminders />}
      </main>
      <nav class="tabs" aria-label="Navigation">
        {TABS.map(([id, label]) => (
          <button aria-current={tab === id ? 'page' : undefined} onClick={() => { setStart('resume'); setTab(id); window.scrollTo(0, 0); }}>{icons[id]}{label}</button>
        ))}
      </nav>
      {!s.onboarded && <Onboarding onDone={() => setTab('today')} />}
      {s.done.length === 30 && !finaleSeen && <Finale days={Math.min(day, 30)} onClose={() => setFinaleSeen(true)} />}
      <Toast />
    </div>
  );
}

