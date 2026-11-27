import { useEffect, useState } from 'preact/hooks';
import { useStore, currentDay, endDate, formatDate, todayISO, addDays, groupPaused, requestKey } from '../store';
import type { Gender, GroupSlot } from '../store';
import { BUILT_IN, programmeById } from '../data/programmes';
import { dayLabel } from '../data/khatam';
import { ramadanEnd, ramadanStart, ramadanName, daysToRamadan, ramadanVisible, RAMADAN_KHATAM_DAYS } from '../config';
import { daysBetween } from '../store';
import { Moon, Stars, StarBurst } from './RamadanArt';
import { APP_NAME } from '../brand';
import { toast } from '../ui';
import { GenderChoice } from './Profile';
import { update } from '../store';
import {
  createGroup, findGroup, requestJoin, cancelRequest, acceptRequest, refuseRequest, removeMember, leaveGroup,
  joinBlock, cleanCode, inviteLink, useLive, MAX_MEMBERS, ramadanGroupsOpen, RAMADAN_GROUPS_DAYS_BEFORE,
} from '../group';
import type { GroupInfo, Member } from '../group';

/**
 * Deux places : un groupe de lecture (toute l'année) et un groupe du Ramadan (ouvert 3 jours avant le 1er jour).
 * Pendant le Ramadan, le groupe de lecture est en pause ; on peut faire le Ramadan seul ou en groupe du Ramadan.
 */
/** Jour du khatm du Ramadan (1 = 1er jour du Ramadan), pour tout le groupe. */
const ramadanDay = () => daysBetween(ramadanStart(), todayISO()) + 1;

/** Code reçu par un lien d'invitation (…/APPLIS/#K7M4QX), à proposer dans « Rejoindre ». */
let pendingCode = '';
export const setPendingCode = (c: string) => { pendingCode = c; };

const sectionWord = (g: Gender, plural = true) => (g === 'f' ? (plural ? 'sœurs' : 'sœur') : (plural ? 'frères' : 'frère'));
const kindLabel = (kind: 'classic' | 'guided', gender: Gender | null, adminName: string) =>
  kind === 'guided' ? `Groupe encadré par ${adminName}` : `Groupe de ${sectionWord(gender ?? 'f')}`;
const COLORS = ['#1F5C52', '#B8741F', '#7A5BA5', '#3C7EA6', '#A8503F', '#5E7A3A', '#8A6D3B', '#2F6F8F'];
const colorOf = (uid: string) => COLORS[[...uid].reduce((t, c) => t + c.charCodeAt(0), 0) % COLORS.length];

type Mode = null | { form: 'create' | 'guided' | 'join'; purpose: 'ramadan' | 'reading' };

export function Group() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>(pendingCode ? { form: 'join', purpose: 'reading' } : null);
  const [view, setView] = useState<GroupSlot>('rgroup');

  // Ouverture festive d'un groupe tout juste créé ou rejoint.
  if (s.rgroup && !s.rgroup.welcomed) return <GroupWelcome slot="rgroup" />;
  if (s.group && !s.group.welcomed) return <GroupWelcome slot="group" />;
  if (!s.gender) {
    return (
      <div class="card">
        <h3>Une question avant tout</h3>
        <p>Les groupes ne sont pas mixtes : un groupe de sœurs n'accueille que des sœurs, un groupe de frères que des frères. Vous êtes… (ce choix ne pourra pas être modifié)</p>
        <GenderChoice value={null} onChange={(g) => update({ gender: g })} />
      </div>
    );
  }
  if (mode?.form === 'create' || mode?.form === 'guided') return <CreateForm purpose={mode.purpose} kind={mode.form === 'guided' ? 'guided' : 'classic'} onCancel={() => setMode(null)} />;
  if (mode?.form === 'join') return <JoinForm onCancel={() => { setPendingCode(''); setMode(null); }} />;

  const reading = s.group ? <GroupView slot="group" /> : s.groupRequest ? <Pending slot="group" /> : <ReadingHome onMode={setMode} />;
  // Dans un groupe du Ramadan : deux onglets, le Ramadan et le groupe de lecture.
  if (s.rgroup) {
    return (
      <>
        <div class="seg slot-tabs" role="tablist">
          <button aria-pressed={view === 'rgroup'} onClick={() => setView('rgroup')}>🌙 Ramadan</button>
          <button aria-pressed={view === 'group'} onClick={() => setView('group')}>{s.group ? 'Groupe de lecture' : 'Lecture'}</button>
        </div>
        {view === 'rgroup' ? <GroupView slot="rgroup" /> : reading}
      </>
    );
  }
  return (
    <>
      {s.rgroupRequest ? <Pending slot="rgroup" /> : (ramadanGroupsOpen() || ramadanVisible()) && <RamadanIntro onMode={setMode} />}
      {reading}
    </>
  );
}

/** Pas encore de groupe de lecture : créer, rejoindre, ou groupe encadré. */
function ReadingHome({ onMode }: { onMode: (m: Mode) => void }) {
  const s = useStore();
  return (
    <>
      <div class="card">
        <h3>Faire son khatm à plusieurs</h3>
        <p>Lisez le Coran en entier en même temps que vos proches, au même rythme. Chacun voit où en sont les autres, pour s'encourager.</p>
        <p class="note">Groupe de {sectionWord(s.gender!)} : vous ne pouvez rejoindre que des groupes de {sectionWord(s.gender!)} ou des groupes encadrés.</p>
        <button class="btn" onClick={() => onMode({ form: 'create', purpose: 'reading' })}>Créer un groupe</button>
        <button class="ghost" onClick={() => onMode({ form: 'join', purpose: 'reading' })}>Rejoindre un groupe</button>
      </div>
      <div class="card guided-card">
        <h3>{s.gender === 'f' ? 'Vous êtes oustaza ?' : 'Vous êtes oustaz ?'}</h3>
        <p class="note">Créez un groupe pour vos auditeurs, sœurs et frères : chacun dans sa section, vous suivez tout le monde. Jusqu'à {MAX_MEMBERS.guided} membres.</p>
        <button class="btn teal" onClick={() => onMode({ form: 'guided', purpose: 'reading' })}>Créer un groupe encadré</button>
      </div>
    </>
  );
}

// ---- Créer ----

const DURATIONS = [30, 60, 90];

function CreateForm({ kind, purpose, onCancel }: { kind: 'classic' | 'guided'; purpose: 'ramadan' | 'reading'; onCancel: () => void }) {
  const isR = purpose === 'ramadan';
  const s = useStore();
  const [name, setName] = useState('');
  const [days, setDays] = useState(60);
  const [other, setOther] = useState(false);
  const [start, setStart] = useState(addDays(todayISO(), 1));
  const [prog, setProg] = useState(BUILT_IN[0].id);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && (isR || (days >= 1 && days <= 365 && start >= todayISO()));
  const submit = async () => {
    setBusy(true);
    try {
      await createGroup({ name, kind, purpose, days, start, programmeId: prog });
      onCancel(); // le formulaire se ferme : on arrive dans le groupe
    } catch (e) {
      console.error('Création du groupe', e);
      toast("Le groupe n'a pas pu être créé. Vérifiez la connexion et réessayez.");
    } finally { setBusy(false); }
  };
  return (
    <div class="card">
      <h3>{isR ? (kind === 'guided' ? 'Groupe du Ramadan encadré' : 'Créer un groupe du Ramadan') : kind === 'guided' ? 'Créer un groupe encadré' : 'Créer un groupe'}</h3>
      <p class="note">{kind === 'guided'
        ? `Vous en serez l'encadrant. Une section Sœurs et une section Frères : chaque auditeur est placé dans la sienne. ${MAX_MEMBERS.guided} membres au plus.`
        : `Vous en serez l'administrat${s.gender === 'f' ? 'rice' : 'eur'}. Groupe de ${sectionWord(s.gender!)}, ${MAX_MEMBERS.classic} membres au plus.`}</p>
      <label class="field">Nom du groupe
        <input type="text" value={name} maxLength={40} placeholder={kind === 'guided' ? (isR ? 'Ex. Cours du samedi · Ramadan' : 'Ex. Cours du samedi') : (isR ? 'Ex. Famille Diallo · Ramadan' : 'Ex. Famille Diallo')} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      {isR ? (
        <div class="card ramadan-info">
          <h3>Le khatm du {ramadanName()}</h3>
          <p class="note">{RAMADAN_KHATAM_DAYS} jours, du {formatDate(ramadanStart())} au {formatDate(addDays(ramadanStart(), RAMADAN_KHATAM_DAYS - 1))}, environ 21 pages par jour. Les dates suivent l'annonce de la lune. Chacun choisit son rythme (après le suhur, autour de l'iftar…).</p>
        </div>
      ) : (<>
      <div class="field">Durée du khatm
        <div class="chips">
          {DURATIONS.map((d) => <button class={`chip ${!other && days === d ? 'on' : ''}`} onClick={() => { setOther(false); setDays(d); }}>{d / 30} mois</button>)}
          <button class={`chip ${other ? 'on' : ''}`} onClick={() => setOther(true)}>Autre…</button>
        </div>
        {other && <input type="number" min={1} max={365} value={days} aria-label="Nombre de jours" onInput={(e) => setDays(Math.round(Number((e.target as HTMLInputElement).value) || 0))} />}
      </div>
      <label class="field">Date de début
        <input type="date" value={start} min={todayISO()} onInput={(e) => setStart((e.target as HTMLInputElement).value)} />
      </label>
      <div class="field">Programme de lecture
        <div class="chips">{BUILT_IN.map((p) => <button class={`chip ${prog === p.id ? 'on' : ''}`} onClick={() => setProg(p.id)}>{p.name}</button>)}</div>
      </div>
      {days >= 1 && days <= 365 && <p class="note">{days} jours · {dayLabel(days)}. La durée ne pourra plus changer une fois le groupe créé.</p>}
      </>)}
      <button class="btn" disabled={!valid || busy} onClick={submit}>{busy ? 'Création…' : kind === 'guided' ? 'Créer le groupe encadré' : 'Créer le groupe'}</button>
      <button class="link" onClick={onCancel}>Annuler</button>
    </div>
  );
}

// ---- Rejoindre ----

function JoinForm({ onCancel }: { onCancel: () => void }) {
  const s = useStore();
  const [code, setCode] = useState(pendingCode);
  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [state, setState] = useState<'idle' | 'search' | 'none' | 'error' | 'send'>('idle');
  const search = async (c = code) => {
    setState('search'); setInfo(null);
    try {
      const g = await findGroup(c);
      setInfo(g); setState(g ? 'idle' : 'none');
    } catch { setState('error'); }
  };
  useEffect(() => { if (cleanCode(pendingCode).length === 6) void search(pendingCode); }, []);
  const block = info ? joinBlock(info, s.gender) : null;
  return (
    <div class="card">
      <h3>Rejoindre un groupe</h3>
      <label class="field">Code du groupe
        <input type="text" value={code} placeholder="Ex. K7M4QX" autocapitalize="characters" autocomplete="off" maxLength={8}
          onInput={(e) => setCode(cleanCode((e.target as HTMLInputElement).value))} />
      </label>
      <button class="btn teal" disabled={cleanCode(code).length !== 6 || state === 'search'} onClick={() => search()}>{state === 'search' ? 'Recherche…' : 'Chercher le groupe'}</button>
      {state === 'none' && <p class="note">Aucun groupe ne correspond à ce code. Vérifiez-le auprès de la personne qui vous l'a envoyé.</p>}
      {state === 'error' && <p class="note">Pas de connexion. Réessayez dans un instant.</p>}
      {info && (
        <div class="card join-preview">
          <h3>{info.name}</h3>
          <p>{kindLabel(info.kind, info.gender, info.adminName)} · {info.memberCount} membre{info.memberCount > 1 ? 's' : ''} sur {MAX_MEMBERS[info.kind]}</p>
          <p class="note">{info.purpose === 'ramadan'
            ? `Groupe du Ramadan · khatm du ${ramadanName()} : ${RAMADAN_KHATAM_DAYS} jours à partir du ${formatDate(ramadanStart())}, chacun à son rythme.`
            : `Khatm de ${info.days} jours, à partir du ${formatDate(info.start)} · Programme « ${programmeById(info.programmeId).name} »`}</p>
          {block ? <p class="block-msg">{block}</p> : (
            <>
              <button class="btn" disabled={state === 'send'} onClick={async () => {
                setState('send');
                try { await requestJoin(info); setPendingCode(''); toast('Demande envoyée'); onCancel(); } catch (e) { toast((e as Error).message || 'La demande n\'a pas pu être envoyée'); setState('idle'); }
              }}>Demander à rejoindre</button>
              <p class="note">{info.purpose === 'ramadan'
                ? "L'administrateur doit accepter votre demande. En rejoignant ce groupe, vous faites le khatm du Ramadan avec lui (votre khatm personnel est en pause pendant le mois)."
                : "L'administrateur doit accepter votre demande. Vous ne pouvez être que dans un seul groupe de lecture à la fois ; votre khatm personnel continue à côté."}</p>
            </>
          )}
        </div>
      )}
      <button class="link" onClick={onCancel}>Annuler</button>
    </div>
  );
}

function Pending({ slot }: { slot: GroupSlot }) {
  const s = useStore();
  const r = s[requestKey(slot)]!;
  return (
    <div class="card pending-card">
      <h3>Demande envoyée</h3>
      <p>Votre demande pour rejoindre « {r.name} » attend la réponse de l'administrateur. Vous serez prévenu{s.gender === 'f' ? 'e' : ''} dès qu'elle est acceptée.</p>
      <button class="link" onClick={async () => { await cancelRequest(slot); toast('Demande annulée'); }}>Annuler la demande</button>
    </div>
  );
}

// ---- Le groupe ----

/** Où en est un membre : à jour (aujourd'hui lu), aujourd'hui à lire, ou en retard. */
function status(done: number, day: number, N: number, ramadan = false, doneDays: number[] = []): { cls: string; label: string } {
  const today = Math.min(Math.max(day, 0), N);
  if (ramadan) {
    if (done >= N) return { cls: 'ok', label: 'Khatm terminé ✓' };
    // Nuits passées pas encore lues, et la nuit de ce soir.
    const missed = Array.from({ length: Math.max(today - 1, 0) }, (_, i) => i + 1).filter((d) => !doneDays.includes(d)).length;
    if (missed > 0) return { cls: 'late', label: `${missed} nuit${missed > 1 ? 's' : ''} à rattraper` };
    if (day > N || doneDays.includes(today)) return { cls: 'ok', label: day > N ? 'À jour' : `Nuit ${today} ✓` };
    return { cls: 'today', label: 'Ce soir' };
  }
  if (done >= today) return { cls: 'ok', label: 'À jour' };
  if (done >= today - 1) return { cls: 'today', label: "Aujourd'hui" };
  return { cls: 'late', label: `${today - 1 - done} j de retard` };
}

function GroupView({ slot }: { slot: GroupSlot }) {
  const s = useStore();
  const live = useLive(slot);
  const g = s[slot]!;
  const isR = g.purpose === 'ramadan';
  const N = isR ? RAMADAN_KHATAM_DAYS : g.khatam.days;
  const day = isR ? ramadanDay() : currentDay(s, 'group');
  /** Groupe du Ramadan : après le dernier jour du Ramadan, le groupe est terminé. */
  const ended = isR && todayISO() > ramadanEnd();
  const isAdmin = g.role === 'admin';
  const [tab, setTab] = useState<Gender>(g.section);
  const [menu, setMenu] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  const counted = live.stats.length;
  const upToDate = isR
    ? live.stats.filter((x) => (x.done ?? []).includes(Math.min(Math.max(day, 1), N))).length
    : live.stats.filter((x) => x.doneCount >= Math.min(Math.max(day, 0), N)).length;
  const shown = live.members
    .filter((m) => g.kind !== 'guided' || !isAdmin || m.section === tab)
    .sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : a.name.localeCompare(b.name)));
  const sectionCount = (x: Gender) => live.stats.filter((m) => m.section === x).length;

  const share = async () => {
    const text = isR
      ? `Assalamou alaykoum ! Faisons notre khatm du Ramadan ensemble avec « ${g.name} » : le Coran en entier en ${N} nuits, à partir du ${formatDate(ramadanStart())}.\n\nRejoins-nous sur l'appli ${APP_NAME} : dans l'onglet Groupe, touche « Rejoindre un groupe » et entre le code ${g.code}.\nPas encore l'appli ? Ouvre ce lien dans Safari, puis « Sur l'écran d'accueil »`
      : `Assalamou alaykoum ! Je lance un khatm du Coran avec « ${g.name} » : ${N} jours, à partir du ${formatDate(g.khatam.start)}.\n\nRejoins-nous sur l'appli ${APP_NAME} : dans l'onglet Groupe, touche « Rejoindre un groupe » et entre le code ${g.code}.\nPas encore l'appli ? Ouvre ce lien dans Safari, puis « Sur l'écran d'accueil »`;
    const url = inviteLink(g.code);
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text} : ${url}`); toast('Invitation copiée'); }
    } catch { /* partage annulé */ }
  };

  return (
    <>
      {isR ? <RamadanHead slot={slot} day={day} N={N} ended={ended} upToDate={upToDate} counted={counted} finished={live.stats.filter((x) => x.doneCount >= N).length} isAdmin={isAdmin} /> : (
      <div class="card group-head">
        <div class="row"><h3>{g.name}</h3>{isAdmin && <span class="pill">{g.kind === 'guided' ? 'Vous encadrez' : 'Admin'}</span>}</div>
        <p class="note">{kindLabel(g.kind, g.gender, g.adminName)} · {N} jours · {programmeById(g.programmeId).name}</p>
        <p>{day < 1 ? `Commence le ${formatDate(g.khatam.start)}` : day > N ? 'Période terminée' : `Jour ${day} sur ${N}`} · jusqu'au {formatDate(endDate(g.khatam))}</p>
        {!isR && groupPaused(s) && <p class="note">En pause pendant le Ramadan pour tout le groupe : reprise le {formatDate(addDays(ramadanEnd(), 1))}.</p>}
        {!live.online && <p class="note">Hors connexion : la liste se mettra à jour au retour du réseau.</p>}
      </div>)}

      {isAdmin && live.requests.length > 0 && (
        <div class="card requests-card">
          <h3>{live.requests.length} demande{live.requests.length > 1 ? 's' : ''} pour rejoindre</h3>
          {live.requests.map((r) => (
            <div class="mem" key={r.uid}>
              <span class="av" style={{ background: colorOf(r.uid) }}>{r.name.slice(0, 1).toUpperCase()}</span>
              <span><b>{r.name}</b>{g.kind === 'guided' && <small>{r.gender === 'f' ? 'Section Sœurs' : 'Section Frères'}</small>}</span>
              <span class="req-actions">
                <button class="ghost" onClick={async () => { try { await acceptRequest(slot, r.uid, r); toast(`${r.name} a rejoint le groupe`); } catch { toast('Le groupe est complet ou la connexion manque.'); } }}>Accepter</button>
                <button class="ghost danger" onClick={async () => { await refuseRequest(slot, r.uid); toast('Demande refusée'); }}>Refuser</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!isR && counted > 0 && day >= 1 && (
        <div class="card">
          <div class="row"><h3>{g.kind === 'guided' ? 'Tout le groupe' : 'Le groupe'}</h3><span class="note">{counted} membre{counted > 1 ? 's' : ''}</span></div>
          <div class="bar" style="color:var(--teal)"><i style={{ width: `${(upToDate / counted) * 100}%` }} /></div>
          <p class="note">{upToDate} sur {counted} {upToDate > 1 ? 'sont' : 'est'} à jour aujourd'hui.</p>
        </div>
      )}

      {g.kind === 'guided' && isAdmin && (
        <div class="seg section-tabs" role="tablist">
          <button aria-pressed={tab === 'f'} onClick={() => setTab('f')}>Sœurs · {sectionCount('f')}</button>
          <button aria-pressed={tab === 'm'} onClick={() => setTab('m')}>Frères · {sectionCount('m')}</button>
        </div>
      )}
      <div class="card members">
        {g.kind === 'guided' && !isAdmin && <h3>Section {g.section === 'f' ? 'Sœurs' : 'Frères'}</h3>}
        {shown.length === 0 && <p class="note">{live.online ? 'Personne pour le moment. Partagez le code pour inviter.' : 'Chargement…'}</p>}
        {shown.map((m) => {
          const st = status(m.done?.length ?? 0, day, N, isR, m.done ?? []);
          const nd = m.done?.length ?? 0;
          const me = m.uid === live.me;
          return (
            <button class="mem" key={m.uid} disabled={!isAdmin || me} onClick={() => setMenu(m)}>
              <span class="av" style={{ background: colorOf(m.uid) }}>{m.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{m.name}{me ? ' (vous)' : ''}{m.role === 'admin' ? (g.kind === 'guided' ? ' · encadrant' : ' · admin') : ''}</b>
                {isR
                  ? <small>{day < 1 ? `Prêt${m.gender === 'f' ? 'e' : ''} pour le 1er jour` : `${nd}/${N} nuits lues`}</small>
                  : <small>{nd} jour{nd > 1 ? 's' : ''} lu{nd > 1 ? 's' : ''}</small>}
                {!isR && <span class="mb"><i style={{ width: `${(nd / N) * 100}%` }} /></span>}
              </span>
              {isR && day >= 1 && <span class="mem-moon"><Moon k={Math.min(nd / N, 1)} size={26} /></span>}
              {day >= 1 && !ended && <span class={`pill ${st.cls}`}>{st.label}</span>}
            </button>
          );
        })}
      </div>

      {!ended && <div class="card invite-card">
        <h3>Inviter</h3>
        <div class="code">{g.code}</div>
        <button class="btn teal" onClick={share}>Partager l'invitation</button>
        <p class="note">{isAdmin ? 'Vous recevrez une demande à accepter pour chaque personne.' : "L'administrateur accepte chaque nouvelle personne."} {g.kind === 'guided' ? `${MAX_MEMBERS.guided} membres au plus.` : `Groupe de ${sectionWord(g.gender ?? 'f')}, ${MAX_MEMBERS.classic} membres au plus.`}</p>
      </div>}

      {ended ? null : !leaving ? <button class="link stop-link" onClick={() => setLeaving(true)}>Quitter le groupe</button> : (
        <div class="confirm">
          <p>Quitter « {g.name} » ? {isR ? 'Vous continuerez votre khatm du Ramadan seul, sans le groupe.' : 'Votre progression dans ce groupe sera perdue.'}{isAdmin ? (live.members.length > 1 ? ' Le groupe sera confié au membre arrivé le plus tôt.' : ' Vous êtes seul : le groupe sera supprimé.') : ''}</p>
          <div class="actions-row">
            <button class="btn danger-fill" onClick={async () => {
              try { await leaveGroup(slot, live.members.map((m) => ({ uid: m.uid, name: m.name, joinedOn: m.joinedOn }))); toast('Vous avez quitté le groupe'); }
              catch { toast("Impossible pour le moment : vérifiez la connexion."); }
            }}>Quitter</button>
            <button class="ghost" onClick={() => setLeaving(false)}>Annuler</button>
          </div>
        </div>
      )}

      {menu && (
        <div class="sheet-backdrop" onClick={() => setMenu(null)}>
          <div class="sheet vmenu" role="dialog" aria-label={menu.name} onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head"><b>{menu.name}</b><button class="close" aria-label="Fermer" onClick={() => setMenu(null)}>✕</button></div>
            <p class="note">{menu.done?.length ?? 0} jours lus sur {N} · dans le groupe depuis le {formatDate(menu.joinedOn, false)}</p>
            <button class="vact danger" onClick={async () => {
              const m = menu; setMenu(null);
              try { await removeMember(slot, m.uid); toast(`${m.name} ne fait plus partie du groupe`); } catch { toast('Impossible pour le moment : vérifiez la connexion.'); }
            }}>Retirer du groupe</button>
            <p class="note">{menu.name} recevra une notification. Son khatm personnel n'est pas touché.</p>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Groupes du Ramadan ----

/** Onglet Groupe avant d'avoir un groupe, au lancement (seulement des groupes du Ramadan). */
function RamadanIntro({ onMode }: { onMode: (m: Mode) => void }) {
  const s = useStore();
  const n = daysToRamadan();
  if (!ramadanGroupsOpen()) {
    const after = todayISO() > ramadanEnd();
    return (
      <>
        <div class="card night-card">
          <span class="nc-moon"><Moon k={0.15} size={40} /></span>
          <h3>{after ? 'Les groupes du Ramadan sont terminés' : 'Les groupes du Ramadan ouvrent bientôt'}</h3>
          {after
            ? <p>Qu'Allah accepte la lecture de chacun. Les groupes du prochain Ramadan ouvriront {RAMADAN_GROUPS_DAYS_BEFORE} jours avant le mois, in shaa Allah.</p>
            : <p>Faites votre khatm du Ramadan <b>seul{s.gender === 'f' ? 'e' : ''} ou en groupe</b>. À partir du <b>{formatDate(addDays(ramadanStart(), -RAMADAN_GROUPS_DAYS_BEFORE))}</b> in shaa Allah, vous pourrez créer un groupe du Ramadan ou rejoindre celui de vos proches{s.group ? ' (votre groupe de lecture sera en pause pendant le mois)' : ''}.</p>}
          {!after && n > 1 && <p class="note">{ramadanName()} commence dans {n} jours, selon l'annonce de la lune.</p>}
        </div>
      </>
    );
  }
  const started = daysToRamadan() <= 0;
  return (
    <>
      <div class="card night-card">
        <span class="nc-moon"><Moon k={started ? Math.min(ramadanDay() / RAMADAN_KHATAM_DAYS, 1) : 0.08} size={40} /></span>
        <h3>{started ? `${ramadanName()} : le khatm se fait aussi ensemble` : n === 1 ? `${ramadanName()} commence demain, in shaa Allah` : `${ramadanName()} commence dans ${n} jours`}</h3>
        <p>Faites votre khatm du Ramadan seul{s.gender === 'f' ? 'e' : ''} ou en groupe : chacun lit le Coran en entier en {RAMADAN_KHATAM_DAYS} nuits, et vous vous encouragez. Groupe de {sectionWord(s.gender!)}.{s.group ? ' Votre groupe de lecture sera en pause pendant le mois.' : ''}</p>
        <button class="rw-btn wide" onClick={() => onMode({ form: 'create', purpose: 'ramadan' })}>Créer un groupe du Ramadan</button>
        <button class="nc-ghost" onClick={() => onMode({ form: 'join', purpose: 'ramadan' })}>Rejoindre un groupe du Ramadan</button>
        <button class="nc-ghost" onClick={() => onMode({ form: 'guided', purpose: 'ramadan' })}>{s.gender === 'f' ? 'Oustaza' : 'Oustaz'} : créer un groupe encadré</button>
      </div>
    </>
  );
}

/** En-tête d'un groupe du Ramadan : compte à rebours, nuit en cours, puis fin commune à l'Aïd. */
function RamadanHead({ slot, day, N, ended, upToDate, counted, finished, isAdmin }: {
  slot: GroupSlot; day: number; N: number; ended: boolean; upToDate: number; counted: number; finished: number; isAdmin: boolean;
}) {
  const s = useStore();
  const g = s[slot]!;
  const night = Math.min(day, N);
  if (ended) return <RamadanGroupEnd slot={slot} finished={finished} counted={counted} />;
  return (
    <div class="card night-card group-head">
      <div class="row">
        <h3>{g.name}</h3>
        {isAdmin && <span class="pill nc-pill">{g.kind === 'guided' ? 'Vous encadrez' : 'Admin'}</span>}
      </div>
      <p class="note">{kindLabel(g.kind, g.gender, g.adminName)} · khatm du {ramadanName()}</p>
      {day < 1 ? (
        <div class="nc-count">
          <Moon k={0} size={44} />
          <b>{day === 0 ? 'Demain' : `Dans ${1 - day} jours`}</b>
          <p>Le khatm commence le {formatDate(ramadanStart())}, in shaa Allah. L'accueil du Ramadan s'ouvrira au 1er jour pour préparer votre rythme.</p>
        </div>
      ) : (
        <div class="nc-night">
          <span><b>{day > N ? 'Rattrapage' : `Nuit ${night}`}</b>
            <small>{day > N ? `Jusqu'au ${formatDate(ramadanEnd())}, dernier jour du Ramadan` : `${upToDate} sur ${counted} ${upToDate > 1 ? 'ont' : 'a'} déjà lu la nuit ${night}${upToDate === counted && counted > 1 ? '. Machallah !' : ''}`}</small>
          </span>
          <Moon k={night / N} size={44} />
        </div>
      )}
    </div>
  );
}

/** Fin commune à l'Aïd : le nombre de khatms terminés, une lune par membre, et la carte à partager. */
function RamadanGroupEnd({ slot, finished, counted }: { slot: GroupSlot; finished: number; counted: number }) {
  const s = useStore();
  const live = useLive(slot);
  const g = s[slot]!;
  const [img, setImg] = useState<string | null>(null);
  const shareCard = async () => {
    const blob = await drawGroupCard(g.name, finished, counted);
    const file = new File([blob], 'khatm-ramadan-groupe.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch { return; }
    setImg(URL.createObjectURL(blob));
  };
  const close = () => {
    update((st) => ({
      [slot]: null,
      history: [{ id: `groupe-${g.id}`, name: `Groupe · ${g.name}`, kind: 'group' as const, start: ramadanStart(), days: RAMADAN_KHATAM_DAYS,
        doneDays: st.ramadanEnded?.doneDays ?? 0, end: ramadanEnd(), status: 'done' as const }, ...st.history.filter((h) => h.id !== `groupe-${g.id}`)],
    }));
  };
  return (
    <div class="card night-card group-end">
      <Moon k={1} size={64} />
      <b class="ge-title">{finished > 0 ? 'Machallah' : `${ramadanName()} est terminé`}</b>
      <p>{finished > 0
        ? <>Le groupe « {g.name} » a terminé : <b>{finished} khatm{finished > 1 ? 's' : ''} sur {counted}</b>. Qu'Allah accepte la lecture de chacun.</>
        : <>Le groupe « {g.name} » a lu ensemble pendant ce Ramadan. Qu'Allah accepte la lecture de chacun.</>}</p>
      <div class="ge-moons">{live.stats.map((x) => <Moon k={Math.min(x.doneCount / RAMADAN_KHATAM_DAYS, 1)} size={26} />)}</div>
      {finished > 0 && <button class="rw-btn wide" onClick={shareCard}>Partager la carte du groupe</button>}
      {img && <><img class="ge-img" src={img} alt="Carte du groupe" /><p class="note">Appui long sur l'image pour l'enregistrer.</p></>}
      <button class="nc-ghost" onClick={close}>Fermer le groupe</button>
      <p class="note">Le groupe sera gardé dans l'historique. Les nuits non lues ne sont plus à rattraper.</p>
    </div>
  );
}

/** Carte carrée à partager : le nom du groupe, le Ramadan, le nombre de khatms terminés. */
async function drawGroupCard(name: string, finished: number, total: number): Promise<Blob> {
  const W = 1080, cv = document.createElement('canvas');
  cv.width = W; cv.height = W;
  const ctx = cv.getContext('2d')!;
  try { await Promise.all(['700 64px "Bricolage Grotesque"', '96px Amiri', '28px "Atkinson Hyperlegible"'].map((f) => document.fonts.load(f))); } catch { /* polices de secours */ }
  const bg = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 400, 900);
  bg.addColorStop(0, '#17403A'); bg.addColorStop(1, '#071513');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.25 + Math.random() * 0.6; ctx.fillStyle = '#F7F0E1';
    ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * W * 0.5, Math.random() * 2.2 + 0.6, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Une pleine lune par khatm terminé (jusqu'à 15), les autres en croissant.
  const n = Math.min(total, 15), r = n > 8 ? 26 : 36, gap = r * 2.6, x0 = W / 2 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, y = 300;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#F6DDB0'; ctx.beginPath();
    if (i < finished) ctx.arc(x, y, r, 0, 6.28); else { ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2); ctx.ellipse(x, y, r * 0.5, r, 0, Math.PI / 2, -Math.PI / 2, true); }
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E9B45F'; ctx.font = '96px Amiri, serif'; ctx.direction = 'rtl';
  ctx.fillText('ما شاء الله', W / 2, 520);
  ctx.direction = 'ltr';
  ctx.fillStyle = '#F7F0E1'; ctx.font = '700 60px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`« ${name.length > 26 ? name.slice(0, 25) + '…' : name} »`, W / 2, 650);
  ctx.font = '700 48px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`a terminé le khatm du ${ramadanName()}`, W / 2, 730);
  ctx.fillStyle = '#E9B45F'; ctx.font = '700 44px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`${finished} khatm${finished > 1 ? 's' : ''} sur ${total}`, W / 2, 820);
  ctx.fillStyle = 'rgba(247,240,225,.45)'; ctx.font = '700 24px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText(APP_NAME.toUpperCase().split('').join(' '), W / 2, 1010);
  return new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'));
}

/** Ouverture festive quand on crée ou rejoint un groupe : ciel étoilé, lune, pluie d'étoiles. */
function GroupWelcome({ slot }: { slot: GroupSlot }) {
  const s = useStore();
  const g = s[slot]!;
  const isR = g.purpose === 'ramadan';
  const [burst, setBurst] = useState(false);
  const creator = g.role === 'admin';
  const done = () => { setBurst(true); window.setTimeout(() => update((st) => { const cur = st[slot]; return cur ? { [slot]: { ...cur, welcomed: true } } : {}; }), 1400); };
  const invite = async () => {
    const text = `Assalamou alaykoum ! Faisons notre khatm ${isR ? 'du Ramadan ' : ''}ensemble avec « ${g.name} ».\n\nRejoins-nous sur l'appli ${APP_NAME} : dans l'onglet Groupe, touche « Rejoindre un groupe » et entre le code ${g.code}.\nPas encore l'appli ? Ouvre ce lien dans Safari, puis « Sur l'écran d'accueil »`;
    try {
      if (navigator.share) await navigator.share({ text, url: inviteLink(g.code) });
      else { await navigator.clipboard.writeText(`${text} : ${inviteLink(g.code)}`); toast('Invitation copiée'); }
    } catch { /* partage annulé */ }
  };
  return (
    <div class="rw gw" role="dialog" aria-label={`Bienvenue dans ${g.name}`}>
      <Stars />
      {burst && <StarBurst />}
      <div class="gw-in">
        <div class="gw-moon"><Moon k={isR ? Math.max(0.08, Math.min(ramadanDay() / RAMADAN_KHATAM_DAYS, 1)) : 1} size={96} /></div>
        <p class="gw-kicker">{creator ? 'Votre groupe est prêt' : 'Vous avez rejoint le groupe'}</p>
        <h2 class="rw-greet">« {g.name} »</h2>
        <p class="gw-text">{isR
          ? `Ensemble pour le khatm du ${ramadanName()} : le Coran en entier en ${RAMADAN_KHATAM_DAYS} nuits, à partir du ${formatDate(ramadanStart())}, chacun à son rythme.`
          : `Ensemble pour un khatm de ${g.khatam.days} jours, à partir du ${formatDate(g.khatam.start)}.`}</p>
        {creator && (
          <div class="gw-code"><small>Code du groupe</small><b>{g.code}</b></div>
        )}
        {creator && <button class="rw-btn wide" onClick={invite}>Inviter mes proches</button>}
        <button class={creator ? 'gw-ghost' : 'rw-btn wide'} onClick={done}>Bismillah</button>
      </div>
    </div>
  );
}
