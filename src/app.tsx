import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, currentDay } from './store';
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

type Tab = 'today' | 'read' | 'plan' | 'group' | 'bell';
const TABS: [Tab, string][] = [['today', "Aujourd'hui"], ['read', 'Lire'], ['plan', 'Programme'], ['group', 'Groupe'], ['bell', 'Rappels']];

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [target, setTarget] = useState<ReaderTarget>({ mode: 'juz', juz: Math.min(Math.max(currentDay(s), 1), 30) });
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
    setTab('read');
  };

  const n = streak(s);
  return (
    <div class="app">
      <header class="top" ref={header}>
        <div><b>{titles[tab][0]}</b><small>{titles[tab][1]}</small></div>
        {n > 0 && <span class="streak">🔥 {n} jour{n > 1 ? 's' : ''}</span>}
      </header>
      <main>
        {tab === 'today' && <Today openReader={openReader} />}
        {tab === 'read' && <Reader target={target} setTarget={setTarget} onTitle={setReaderTitle} />}
        {tab === 'plan' && <Programme />}
        {tab === 'group' && <Group />}
        {tab === 'bell' && <Reminders />}
      </main>
      <nav class="tabs" aria-label="Navigation">
        {TABS.map(([id, label]) => (
          <button aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo(0, 0); }}>{icons[id]}{label}</button>
        ))}
      </nav>
      {!s.onboarded && <Onboarding onDone={() => setTab('today')} />}
      {s.done.length === 30 && !finaleSeen && <Finale days={Math.min(day, 30)} onClose={() => setFinaleSeen(true)} />}
      <Toast />
    </div>
  );
}

