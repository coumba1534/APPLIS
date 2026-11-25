import { useEffect, useState } from 'preact/hooks';
import { useStore, currentDay, endDate, formatDate, todayISO, addDays, groupPaused } from '../store';
import type { Gender } from '../store';
import { BUILT_IN, programmeById } from '../data/programmes';
import { dayLabel } from '../data/khatam';
import { ramadanEnd } from '../config';
import { toast } from '../ui';
import { GenderChoice } from './Profile';
import { update } from '../store';
import {
  createGroup, findGroup, requestJoin, cancelRequest, acceptRequest, refuseRequest, removeMember, leaveGroup,
  joinBlock, cleanCode, inviteLink, useLive, MAX_MEMBERS,
} from '../group';
import type { GroupInfo, Member } from '../group';

/** Code reçu par un lien d'invitation (…/APPLIS/#K7M4QX), à proposer dans « Rejoindre ». */
let pendingCode = '';
export const setPendingCode = (c: string) => { pendingCode = c; };

const sectionWord = (g: Gender, plural = true) => (g === 'f' ? (plural ? 'sœurs' : 'sœur') : (plural ? 'frères' : 'frère'));
const kindLabel = (kind: 'classic' | 'guided', gender: Gender | null, adminName: string) =>
  kind === 'guided' ? `Groupe encadré par ${adminName}` : `Groupe de ${sectionWord(gender ?? 'f')}`;
const COLORS = ['#1F5C52', '#B8741F', '#7A5BA5', '#3C7EA6', '#A8503F', '#5E7A3A', '#8A6D3B', '#2F6F8F'];
const colorOf = (uid: string) => COLORS[[...uid].reduce((t, c) => t + c.charCodeAt(0), 0) % COLORS.length];

export function Group() {
  const s = useStore();
  const [mode, setMode] = useState<null | 'create' | 'guided' | 'join'>(pendingCode ? 'join' : null);

  if (s.group) return <GroupView />;
  if (s.groupRequest) return <Pending />;
  if (!s.gender) {
    return (
      <div class="card">
        <h3>Une question avant tout</h3>
        <p>Les groupes ne sont pas mixtes : un groupe de sœurs n'accueille que des sœurs, un groupe de frères que des frères. Vous êtes…</p>
        <GenderChoice value={null} onChange={(g) => update({ gender: g })} />
      </div>
    );
  }
  if (mode === 'create' || mode === 'guided') return <CreateForm kind={mode === 'guided' ? 'guided' : 'classic'} onCancel={() => setMode(null)} />;
  if (mode === 'join') return <JoinForm onCancel={() => { setPendingCode(''); setMode(null); }} />;
  return (
    <>
      <div class="card">
        <h3>Faire son khatm à plusieurs</h3>
        <p>Lisez le Coran en entier en même temps que vos proches, au même rythme. Chacun voit où en sont les autres, pour s'encourager.</p>
        <p class="note">Groupe de {sectionWord(s.gender)} : vous ne pouvez rejoindre que des groupes de {sectionWord(s.gender)} ou des groupes encadrés.</p>
        <button class="btn" onClick={() => setMode('create')}>Créer un groupe</button>
        <button class="ghost" onClick={() => setMode('join')}>Rejoindre un groupe</button>
      </div>
      <div class="card guided-card">
        <h3>Vous êtes oustaz ou oustaza ?</h3>
        <p class="note">Créez un groupe pour vos auditeurs, sœurs et frères : chacun dans sa section, vous suivez tout le monde. Jusqu'à {MAX_MEMBERS.guided} membres.</p>
        <button class="btn teal" onClick={() => setMode('guided')}>Créer un groupe encadré</button>
      </div>
    </>
  );
}

// ---- Créer ----

const DURATIONS = [30, 60, 90];

function CreateForm({ kind, onCancel }: { kind: 'classic' | 'guided'; onCancel: () => void }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [days, setDays] = useState(60);
  const [other, setOther] = useState(false);
  const [start, setStart] = useState(addDays(todayISO(), 1));
  const [prog, setProg] = useState(BUILT_IN[0].id);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && days >= 1 && days <= 365 && start >= todayISO();
  const submit = async () => {
    setBusy(true);
    try {
      await createGroup({ name, kind, days, start, programmeId: prog });
      toast('Groupe créé, bismillah ! Invitez vos proches avec le code.');
    } catch (e) {
      console.error('Création du groupe', e);
      toast("Le groupe n'a pas pu être créé. Vérifiez la connexion et réessayez.");
    } finally { setBusy(false); }
  };
  return (
    <div class="card">
      <h3>{kind === 'guided' ? 'Créer un groupe encadré' : 'Créer un groupe'}</h3>
      <p class="note">{kind === 'guided'
        ? `Vous en serez l'encadrant. Une section Sœurs et une section Frères : chaque auditeur est placé dans la sienne. ${MAX_MEMBERS.guided} membres au plus.`
        : `Vous en serez l'administrat${s.gender === 'f' ? 'rice' : 'eur'}. Groupe de ${sectionWord(s.gender!)}, ${MAX_MEMBERS.classic} membres au plus.`}</p>
      <label class="field">Nom du groupe
        <input type="text" value={name} maxLength={40} placeholder={kind === 'guided' ? 'Ex. Cours du samedi' : 'Ex. Famille Diallo'} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
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
          <p class="note">Khatm de {info.days} jours, à partir du {formatDate(info.start)} · Programme « {programmeById(info.programmeId).name} »</p>
          {block ? <p class="block-msg">{block}</p> : (
            <>
              <button class="btn" disabled={state === 'send'} onClick={async () => {
                setState('send');
                try { await requestJoin(info); setPendingCode(''); toast('Demande envoyée'); } catch (e) { toast((e as Error).message || 'La demande n\'a pas pu être envoyée'); setState('idle'); }
              }}>Demander à rejoindre</button>
              <p class="note">L'administrateur doit accepter votre demande. Vous ne pouvez être que dans un seul groupe à la fois ; votre khatm personnel continue à côté.</p>
            </>
          )}
        </div>
      )}
      <button class="link" onClick={onCancel}>Annuler</button>
    </div>
  );
}

function Pending() {
  const s = useStore();
  const r = s.groupRequest!;
  return (
    <div class="card pending-card">
      <h3>Demande envoyée</h3>
      <p>Votre demande pour rejoindre « {r.name} » attend la réponse de l'administrateur. Vous serez prévenu{s.gender === 'f' ? 'e' : ''} dès qu'elle est acceptée.</p>
      <button class="link" onClick={async () => { await cancelRequest(); toast('Demande annulée'); }}>Annuler la demande</button>
    </div>
  );
}

// ---- Le groupe ----

/** Où en est un membre : à jour (aujourd'hui lu), aujourd'hui à lire, ou en retard. */
function status(done: number, day: number, N: number): { cls: string; label: string } {
  const today = Math.min(Math.max(day, 0), N);
  if (done >= today) return { cls: 'ok', label: 'À jour' };
  if (done >= today - 1) return { cls: 'today', label: "Aujourd'hui" };
  return { cls: 'late', label: `${today - 1 - done} j de retard` };
}

function GroupView() {
  const s = useStore();
  const live = useLive();
  const g = s.group!;
  const N = g.khatam.days;
  const day = currentDay(s, 'group');
  const isAdmin = g.role === 'admin';
  const [tab, setTab] = useState<Gender>(g.section);
  const [menu, setMenu] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  const counted = live.stats.length;
  const upToDate = live.stats.filter((x) => x.doneCount >= Math.min(Math.max(day, 0), N)).length;
  const shown = live.members
    .filter((m) => g.kind !== 'guided' || !isAdmin || m.section === tab)
    .sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : a.name.localeCompare(b.name)));
  const sectionCount = (x: Gender) => live.stats.filter((m) => m.section === x).length;

  const share = async () => {
    const text = `Assalamou alaykoum ! Je lance un khatm du Coran avec « ${g.name} » : ${N} jours, à partir du ${formatDate(g.khatam.start)}. Rejoins-nous sur Khatm avec le code ${g.code}`;
    const url = inviteLink(g.code);
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text} : ${url}`); toast('Invitation copiée'); }
    } catch { /* partage annulé */ }
  };

  return (
    <>
      <div class="card group-head">
        <div class="row"><h3>{g.name}</h3>{isAdmin && <span class="pill">{g.kind === 'guided' ? 'Vous encadrez' : 'Admin'}</span>}</div>
        <p class="note">{kindLabel(g.kind, g.gender, g.adminName)} · {N} jours · {programmeById(g.programmeId).name}</p>
        <p>{day < 1 ? `Commence le ${formatDate(g.khatam.start)}` : day > N ? 'Période terminée' : `Jour ${day} sur ${N}`} · jusqu'au {formatDate(endDate(g.khatam))}</p>
        {groupPaused(s) && <p class="note">En pause pendant le Ramadan pour tout le groupe : reprise le {formatDate(addDays(ramadanEnd(), 1))}.</p>}
        {!live.online && <p class="note">Hors connexion : la liste se mettra à jour au retour du réseau.</p>}
      </div>

      {isAdmin && live.requests.length > 0 && (
        <div class="card requests-card">
          <h3>{live.requests.length} demande{live.requests.length > 1 ? 's' : ''} pour rejoindre</h3>
          {live.requests.map((r) => (
            <div class="mem" key={r.uid}>
              <span class="av" style={{ background: colorOf(r.uid) }}>{r.name.slice(0, 1).toUpperCase()}</span>
              <span><b>{r.name}</b>{g.kind === 'guided' && <small>{r.gender === 'f' ? 'Section Sœurs' : 'Section Frères'}</small>}</span>
              <span class="req-actions">
                <button class="ghost" onClick={async () => { try { await acceptRequest(r.uid, r); toast(`${r.name} a rejoint le groupe`); } catch { toast('Le groupe est complet ou la connexion manque.'); } }}>Accepter</button>
                <button class="ghost danger" onClick={async () => { await refuseRequest(r.uid); toast('Demande refusée'); }}>Refuser</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {counted > 0 && day >= 1 && (
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
          const st = status(m.done?.length ?? 0, day, N);
          const me = m.uid === live.me;
          return (
            <button class="mem" key={m.uid} disabled={!isAdmin || me} onClick={() => setMenu(m)}>
              <span class="av" style={{ background: colorOf(m.uid) }}>{m.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{m.name}{me ? ' (vous)' : ''}{m.role === 'admin' ? (g.kind === 'guided' ? ' · encadrant' : ' · admin') : ''}</b>
                <small>{m.done?.length ?? 0} jour{(m.done?.length ?? 0) > 1 ? 's' : ''} lu{(m.done?.length ?? 0) > 1 ? 's' : ''}</small>
                <span class="mb"><i style={{ width: `${((m.done?.length ?? 0) / N) * 100}%` }} /></span>
              </span>
              {day >= 1 && <span class={`pill ${st.cls}`}>{st.label}</span>}
            </button>
          );
        })}
      </div>

      <div class="card invite-card">
        <h3>Inviter</h3>
        <div class="code">{g.code}</div>
        <button class="btn teal" onClick={share}>Partager l'invitation</button>
        <p class="note">{isAdmin ? 'Vous recevrez une demande à accepter pour chaque personne.' : "L'administrateur accepte chaque nouvelle personne."} {g.kind === 'guided' ? `${MAX_MEMBERS.guided} membres au plus.` : `Groupe de ${sectionWord(g.gender ?? 'f')}, ${MAX_MEMBERS.classic} membres au plus.`}</p>
      </div>

      {!leaving ? <button class="link stop-link" onClick={() => setLeaving(true)}>Quitter le groupe</button> : (
        <div class="confirm">
          <p>Quitter « {g.name} » ? Votre progression dans ce groupe sera perdue.{isAdmin ? (live.members.length > 1 ? ' Le groupe sera confié au membre arrivé le plus tôt.' : ' Vous êtes seul : le groupe sera supprimé.') : ''}</p>
          <div class="actions-row">
            <button class="btn danger-fill" onClick={async () => {
              try { await leaveGroup(live.members.map((m) => ({ uid: m.uid, name: m.name, joinedOn: m.joinedOn }))); toast('Vous avez quitté le groupe'); }
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
              try { await removeMember(m.uid); toast(`${m.name} ne fait plus partie du groupe`); } catch { toast('Impossible pour le moment : vérifiez la connexion.'); }
            }}>Retirer du groupe</button>
            <p class="note">{menu.name} recevra une notification. Son khatm personnel n'est pas touché.</p>
          </div>
        </div>
      )}
    </>
  );
}
