import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, currentDay, update, syncRamadanStart, closeRamadanIfOver, ramadanActive, isCurrentSeason, canJoinRamadan, joinRamadan } from './store';
import { loadConfig, useConfig } from './config';
import { absOf, juzOf, pageOf } from './data/quran';
import { portion } from './data/khatam';
import { Toast, icons } from './ui';
import { Today, streak } from './screens/Today';
import { Reader, ReaderTarget } from './screens/Reader';
import { Programme } from './screens/Programme';
import { Group, setPendingCode } from './screens/Group';
import { startGroupSync, setNoticeHandler } from './group';
import { startPush } from './push';
import { startBackup } from './backup';
import type { Notice } from './group';

// Lien d'invitation …/APPLIS/#K7M4QX : on ouvre l'onglet Groupe sur ce code.
const inviteCode = (() => {
  const m = location.hash.match(/^#([A-Za-z0-9]{6})$/);
  if (!m) return '';
  history.replaceState(null, '', location.pathname + location.search);
  setPendingCode(m[1].toUpperCase());
  return m[1];
})();
import { Reminders } from './screens/Reminders';
import { Onboarding } from './screens/Onboarding';
import { Finale } from './screens/Finale';
import { RamadanWelcome } from './screens/RamadanWelcome';
import { RamadanFinale } from './screens/RamadanFinale';
import { NewKhatam } from './screens/NewKhatam';
import { startReminders } from './device';
import { isDark, toggleTheme } from './theme';

type Tab = 'today' | 'read' | 'plan' | 'group' | 'bell';
const TABS: [Tab, string][] = [['today', "Aujourd'hui"], ['read', 'Lire'], ['plan', 'Programme'], ['group', 'Groupe'], ['bell', 'Réglages']];

export function App() {
  const s = useStore();
  // À chaque ouverture, on arrive sur Aujourd'hui (sauf lien d'invitation : onglet Groupe). Lire garde la dernière lecture.
  const [tab, setTabState] = useState<Tab>(() => (inviteCode && s.onboarded ? 'group' : 'today'));
  /** Message d'un groupe (demande acceptée ou refusée, retrait), affiché en haut de l'écran. */
  const [notice, setNotice] = useState<Notice | null>(null);
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
  useEffect(() => { setNoticeHandler(setNotice); startGroupSync(); startPush(); startBackup(); }, []);
  // Lien d'invitation ouvert alors que l'appli l'est déjà : on va sur l'onglet Groupe avec ce code.
  const [inviteKey, setInviteKey] = useState(0);
  useEffect(() => {
    const onHash = () => {
      const m = location.hash.match(/^#([A-Za-z0-9]{6})$/);
      if (!m) return;
      history.replaceState(null, '', location.pathname + location.search);
      setPendingCode(m[1].toUpperCase());
      setInviteKey((k) => k + 1);
      setTab('group');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Dans un groupe du Ramadan, on fait le khatm du Ramadan : il démarre tout seul au 1er jour (puis l'accueil du Ramadan s'ouvre).
  useEffect(() => {
    if (s.group?.purpose === 'ramadan' && isCurrentSeason(s.group.season) && canJoinRamadan(s)) joinRamadan();
  });
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
  // Salam accordé : alayki pour une femme, alayka pour un homme.
  const hello = `Assalamou ${s.gender === 'f' ? 'alayki' : s.gender === 'm' ? 'alayka' : 'alaykoum'}${s.name ? `, ${s.name}` : ''}`;
  const titles: Record<Tab, [string, string]> = {
    today: [hello, ramadanActive(s) ? `Jour ${Math.min(currentDay(s, 'ramadan'), 29)} · ${s.ramadan!.khatam.name}` : !s.khatam ? 'Prêt pour un nouveau khatm' : day >= 1 && day <= N ? (s.khatam.kind === 'ramadan' ? `Jour ${day} du Ramadan` : `Jour ${day} sur ${N}`) : s.khatam.name],
    read: readerTitle,
    plan: ['Mon programme', 'Mon khatm, à mon rythme'],
    group: ['Mon groupe', 'On avance ensemble'],
    bell: ['Réglages', 'Rappels, profil et code personnel'],
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
        {notice && (
          <div class={`card notice-card ${notice.type}`}>
            <p>{notice.type === 'accepted' ? `Bienvenue dans le groupe « ${notice.groupName} », bismillah !`
              : notice.type === 'refused' ? `Votre demande pour rejoindre « ${notice.groupName} » n'a pas été acceptée.`
              : `Vous ne faites plus partie du groupe « ${notice.groupName} ». Votre khatm personnel continue.`}</p>
            <button class="ghost" style="justify-self:start" onClick={() => setNotice(null)}>Fermer</button>
          </div>
        )}
        {tab === 'today' && <Today openReader={openReader} onNewKhatam={() => setNewOpen(true)} />}
        {tab === 'read' && <Reader target={target} setTarget={setTarget} onTitle={setReaderTitle} start={start} />}
        {tab === 'plan' && <Programme onNewKhatam={() => setNewOpen(true)} />}
        {tab === 'group' && <Group key={inviteKey} />}
        {tab === 'bell' && <Reminders />}
      </main>
      <nav class="tabs" aria-label="Navigation">
        {TABS.map(([id, label]) => (
          <button aria-current={tab === id ? 'page' : undefined} onClick={() => { setStart('resume'); setTab(id); window.scrollTo(0, 0); }}>{icons[id]}{label}</button>
        ))}
      </nav>
      {!s.onboarded && <Onboarding onDone={() => setTab('today')} />}
      {[s.ramadan?.khatam, s.khatam].filter((k) => k?.finishedOn && !finaleSeen.includes(k.id)).slice(0, 1).map((k) => (k!.kind === 'ramadan' && k!.id === s.ramadan?.khatam.id
        ? <RamadanFinale khatam={k!} onClose={() => setFinaleSeen([...finaleSeen, k!.id])} onNewKhatam={() => setNewOpen(true)} />
        : <Finale khatam={k!} onClose={() => setFinaleSeen([...finaleSeen, k!.id])} />))}
      {s.onboarded && s.ramadan && !s.ramadan.welcomed && <RamadanWelcome />}
      {newOpen && <NewKhatam onClose={() => setNewOpen(false)} onStarted={() => { setTab('today'); window.scrollTo(0, 0); }} />}
      <Toast />
    </div>
  );
}

