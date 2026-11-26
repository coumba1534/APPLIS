// Groupes : Firebase (connexion anonyme + Firestore). Chargé seulement quand on utilise les groupes.
//
// Données dans Firestore (les règles de sécurité sont dans firestore.rules) :
//   codes/{CODE}                     → { groupId }                       code d'invitation de 6 caractères
//   groups/{gid}                     → nom, type, genre, admin, calendrier, programme, memberCount
//   groups/{gid}/members/{uid}       → prénom, genre, section, rôle, jours lus, séances cochées
//   groups/{gid}/stats/{uid}         → section, jours lus (sans prénom : sert au chiffre global)
//   groups/{gid}/requests/{uid}      → demandes en attente (prénom, genre)
//   notices/{uid}/items/{id}         → messages pour un membre (accepté, refusé, retiré)
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore, Unsubscribe } from 'firebase/firestore';
import { useEffect, useState } from 'preact/hooks';
import { getState, update, subscribe, todayISO } from './store';
import type { Gender, GroupState } from './store';
import { currentRamadanId } from './store';
import { ramadanStart, RAMADAN_KHATAM_DAYS } from './config';
import { pushGroupMessage, linkPushToAccount } from './push';

export const firebaseConfig = {
  apiKey: 'AIzaSyDEoKtwujMNofsciYLoxzipw2-mrcWA6JU',
  authDomain: 'khatm-7bff3.firebaseapp.com',
  projectId: 'khatm-7bff3',
  storageBucket: 'khatm-7bff3.firebasestorage.app',
  messagingSenderId: '1018635404554',
  appId: '1:1018635404554:web:c920597417c547d09ba6f3',
};

/** Nombre maximum de membres : groupe classique, groupe encadré. */
export const MAX_MEMBERS = { classic: 15, guided: 40 } as const;

type Fb = { app: FirebaseApp; auth: Auth; db: Firestore; fs: typeof import('firebase/firestore'); uid: string };
let fbPromise: Promise<Fb> | null = null;

/** Firebase prêt et connecté (connexion anonyme, gardée sur le téléphone). */
export function fb(): Promise<Fb> {
  if (!fbPromise) {
    fbPromise = (async () => {
      const [{ initializeApp }, authMod, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
      // Tests : émulateur Firebase local (jamais utilisé par les vrais utilisateurs).
      const emu = (() => { try { return localStorage.getItem('khatm-emulateur'); } catch { return null; } })();
      const app = initializeApp(emu ? { ...firebaseConfig, projectId: 'demo-khatm' } : firebaseConfig);
      // Connexion gardée dans le téléphone ; une connexion retrouvée grâce au code personnel
      // (déposée par src/backup.ts) est reprise depuis le stockage local.
      const auth = authMod.initializeAuth(app, { persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence] });
      const db = fs.getFirestore(app);
      if (emu) { authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); fs.connectFirestoreEmulator(db, '127.0.0.1', 8085); }
      await auth.authStateReady();
      if (!auth.currentUser) await authMod.signInAnonymously(auth);
      // Les messages de groupe (demande acceptée, retrait…) arrivent aussi appli fermée.
      void auth.currentUser!.getIdToken().then(linkPushToAccount).catch(() => {});
      return { app, auth, db, fs, uid: auth.currentUser!.uid };
    })();
    fbPromise.catch(() => { fbPromise = null; });
  }
  return fbPromise;
}

// ---- Codes d'invitation ----

/** Lettres et chiffres sans confusion possible (pas de O/0, I/1, L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('');
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const inviteLink = (code: string) => `${location.origin}${location.pathname}#${code}`;

/** Ce qu'on sait d'un groupe avant d'y entrer. */
export interface GroupInfo {
  id: string; code: string; name: string; kind: 'classic' | 'guided'; gender: Gender | null;
  purpose: 'ramadan' | 'reading'; season: string;
  adminUid: string; adminName: string; days: number; start: string; programmeId: string; memberCount: number;
}

const toInfo = (id: string, d: Record<string, unknown>): GroupInfo => ({
  id, code: String(d.code), name: String(d.name), kind: d.kind === 'guided' ? 'guided' : 'classic', gender: (d.gender as Gender) ?? null,
  purpose: d.purpose === 'ramadan' ? 'ramadan' : 'reading', season: String(d.season ?? ''),
  adminUid: String(d.adminUid), adminName: String(d.adminName), days: Number(d.days), start: String(d.start),
  programmeId: String(d.programmeId), memberCount: Number(d.memberCount ?? 0),
});

function localGroup(info: GroupInfo, role: 'admin' | 'member', section: Gender, joinedOn: string): GroupState {
  return {
    id: info.id, code: info.code, name: info.name, kind: info.kind, gender: info.gender, purpose: info.purpose, season: info.season, welcomed: false, role, section,
    adminUid: info.adminUid, adminName: info.adminName, programmeId: info.programmeId,
    khatam: { id: `groupe-${info.id}`, kind: 'group', name: info.name, start: info.start, days: info.days },
    done: [], sessions: {}, catchPlan: null, joinedOn,
  };
}

// ---- Créer, chercher, demander ----

export async function createGroup(p: { name: string; kind: 'classic' | 'guided'; purpose: 'ramadan' | 'reading'; days: number; start: string; programmeId: string }) {
  // Groupe du Ramadan : le khatm du Ramadan, 29 jours, aux dates du Ramadan.
  if (p.purpose === 'ramadan') p = { ...p, days: RAMADAN_KHATAM_DAYS, start: ramadanStart() };
  const s = getState();
  if (!s.gender) throw new Error('genre');
  const { db, fs, uid } = await fb();
  const ref = fs.doc(fs.collection(db, 'groups'));
  let code = '';
  for (let i = 0; i < 5 && !code; i++) {
    const c = newCode();
    if (!(await fs.getDoc(fs.doc(db, 'codes', c))).exists()) code = c;
  }
  if (!code) throw new Error('code');
  const info: GroupInfo = {
    id: ref.id, code, name: p.name.trim(), kind: p.kind, gender: p.kind === 'classic' ? s.gender : null,
    purpose: p.purpose, season: p.purpose === 'ramadan' ? currentRamadanId() : '',
    adminUid: uid, adminName: s.name || 'Administrateur', days: p.days, start: p.start, programmeId: p.programmeId, memberCount: 1,
  };
  const batch = fs.writeBatch(db);
  const { id: _id, ...doc } = info;
  batch.set(ref, { ...doc, createdAt: fs.serverTimestamp() });
  batch.set(fs.doc(db, 'codes', code), { groupId: ref.id });
  batch.set(fs.doc(db, 'groups', ref.id, 'members', uid), { name: info.adminName, gender: s.gender, section: s.gender, role: 'admin', joinedOn: todayISO(), done: [], sessions: {} });
  batch.set(fs.doc(db, 'groups', ref.id, 'stats', uid), { section: s.gender, doneCount: 0, done: [] });
  await batch.commit();
  update({ group: localGroup(info, 'admin', s.gender, todayISO()), groupRequest: null });
  return info;
}

/** Le groupe qui correspond à un code, ou null. */
export async function findGroup(codeInput: string): Promise<GroupInfo | null> {
  const code = cleanCode(codeInput);
  if (code.length !== 6) return null;
  const { db, fs } = await fb();
  const c = await fs.getDoc(fs.doc(db, 'codes', code));
  if (!c.exists()) return null;
  const g = await fs.getDoc(fs.doc(db, 'groups', String(c.data().groupId)));
  return g.exists() ? toInfo(g.id, g.data()) : null;
}

/** Peut-on demander à entrer ? Pas de mixité dans les groupes classiques, et une limite de membres. */
export function joinBlock(info: GroupInfo, gender: Gender | null): string | null {
  if (!gender) return 'Indiquez d\'abord dans « Mon profil » (onglet Rappels) si vous êtes une femme ou un homme.';
  if (info.purpose === 'ramadan' && info.season !== currentRamadanId()) return 'Ce groupe était pour un autre Ramadan.';
  if (info.kind === 'classic' && info.gender && info.gender !== gender)
    return info.gender === 'f' ? 'Ce groupe est réservé aux sœurs.' : 'Ce groupe est réservé aux frères.';
  if (info.memberCount >= MAX_MEMBERS[info.kind]) return 'Ce groupe est complet.';
  return null;
}

export async function requestJoin(info: GroupInfo) {
  const s = getState();
  const block = joinBlock(info, s.gender);
  if (block) throw new Error(block);
  const { db, fs, uid } = await fb();
  await fs.setDoc(fs.doc(db, 'groups', info.id, 'requests', uid), { name: s.name || 'Sans prénom', gender: s.gender, at: fs.serverTimestamp() });
  update({ groupRequest: { groupId: info.id, code: info.code, name: info.name, at: todayISO() } });
  // Prévenir l'administrateur qu'une demande l'attend.
  try {
    const { auth } = await fb();
    await pushGroupMessage({ idToken: await auth.currentUser!.getIdToken(), target: info.adminUid, type: 'request', groupId: info.id, from: s.name });
  } catch { /* sans réseau : il la verra à l'ouverture */ }
}

export async function cancelRequest() {
  const r = getState().groupRequest;
  if (!r) return;
  const { db, fs, uid } = await fb();
  await fs.deleteDoc(fs.doc(db, 'groups', r.groupId, 'requests', uid)).catch(() => {});
  update({ groupRequest: null });
}

// ---- Administration ----

async function notifyMember(memberUid: string, type: 'accepted' | 'refused' | 'removed', g: { id: string; name: string }) {
  const { db, fs, auth } = await fb();
  await fs.addDoc(fs.collection(db, 'notices', memberUid, 'items'), { type, groupId: g.id, groupName: g.name, at: fs.serverTimestamp() });
  // Et une vraie notification sur son téléphone, même appli fermée.
  try { await pushGroupMessage({ idToken: await auth.currentUser!.getIdToken(), target: memberUid, type, groupId: g.id }); } catch { /* sans réseau : le message s'affichera à l'ouverture */ }
}

export async function acceptRequest(reqUid: string, req: { name: string; gender: Gender }) {
  const g = getState().group;
  if (!g || g.role !== 'admin') return;
  const { db, fs } = await fb();
  await fs.runTransaction(db, async (tx) => {
    const gref = fs.doc(db, 'groups', g.id);
    const snap = await tx.get(gref);
    const count = Number(snap.data()?.memberCount ?? 0);
    if (count >= MAX_MEMBERS[g.kind]) throw new Error('complet');
    tx.set(fs.doc(db, 'groups', g.id, 'members', reqUid), { name: req.name, gender: req.gender, section: req.gender, role: 'member', joinedOn: todayISO(), done: [], sessions: {} });
    tx.set(fs.doc(db, 'groups', g.id, 'stats', reqUid), { section: req.gender, doneCount: 0, done: [] });
    tx.delete(fs.doc(db, 'groups', g.id, 'requests', reqUid));
    tx.update(gref, { memberCount: count + 1 });
  });
  await notifyMember(reqUid, 'accepted', g);
}

export async function refuseRequest(reqUid: string) {
  const g = getState().group;
  if (!g || g.role !== 'admin') return;
  const { db, fs } = await fb();
  await fs.deleteDoc(fs.doc(db, 'groups', g.id, 'requests', reqUid));
  await notifyMember(reqUid, 'refused', g);
}

export async function removeMember(memberUid: string) {
  const g = getState().group;
  if (!g || g.role !== 'admin') return;
  const { db, fs } = await fb();
  const batch = fs.writeBatch(db);
  batch.delete(fs.doc(db, 'groups', g.id, 'members', memberUid));
  batch.delete(fs.doc(db, 'groups', g.id, 'stats', memberUid));
  batch.update(fs.doc(db, 'groups', g.id), { memberCount: fs.increment(-1) });
  await batch.commit();
  await notifyMember(memberUid, 'removed', g);
}

/**
 * Quitter le groupe. L'administrateur qui part confie le groupe au membre arrivé le plus tôt ;
 * s'il était seul, le groupe et son code disparaissent.
 */
export async function leaveGroup(others: { uid: string; name: string; joinedOn: string }[]) {
  const g = getState().group;
  if (!g) return;
  const { db, fs, uid } = await fb();
  const batch = fs.writeBatch(db);
  if (g.role === 'admin') {
    const next = [...others].filter((m) => m.uid !== uid).sort((a, b) => a.joinedOn.localeCompare(b.joinedOn))[0];
    if (next) {
      batch.update(fs.doc(db, 'groups', g.id), { adminUid: next.uid, adminName: next.name, memberCount: fs.increment(-1) });
      batch.update(fs.doc(db, 'groups', g.id, 'members', next.uid), { role: 'admin' });
    } else {
      batch.delete(fs.doc(db, 'codes', g.code));
      batch.delete(fs.doc(db, 'groups', g.id));
    }
  } else {
    batch.update(fs.doc(db, 'groups', g.id), { memberCount: fs.increment(-1) });
  }
  batch.delete(fs.doc(db, 'groups', g.id, 'members', uid));
  batch.delete(fs.doc(db, 'groups', g.id, 'stats', uid));
  await batch.commit();
  update({ group: null });
}

// ---- Synchronisation ----

export interface Member { uid: string; name: string; gender: Gender; section: Gender; role: 'admin' | 'member'; joinedOn: string; done: number[] }
export interface Stat { uid: string; section: Gender; doneCount: number; done?: number[] }
export interface Request { uid: string; name: string; gender: Gender }
export interface Live { members: Member[]; stats: Stat[]; requests: Request[]; online: boolean; me: string }

let live: Live = { members: [], stats: [], requests: [], online: false, me: '' };
const liveListeners = new Set<() => void>();
const setLive = (p: Partial<Live>) => { live = { ...live, ...p }; liveListeners.forEach((l) => l()); };

/** Membres, chiffres et demandes du groupe, mis à jour en direct. */
export function useLive(): Live {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((n) => n + 1); liveListeners.add(l); return () => { liveListeners.delete(l); }; }, []);
  return live;
}

/** Message à afficher à l'ouverture (accepté, refusé, retiré). */
export type Notice = { type: 'accepted' | 'refused' | 'removed'; groupName: string };
let onNotice: (n: Notice) => void = () => {};
export const setNoticeHandler = (f: (n: Notice) => void) => { onNotice = f; };

let watching = '';
let unsubs: Unsubscribe[] = [];
let pushTimer: number | undefined;
let lastPushed = '';

/** Démarre la synchronisation : à appeler une fois au lancement de l'appli. */
export function startGroupSync() {
  const run = () => { void sync(); };
  subscribe(run);
  run();
}

async function sync() {
  const s = getState();
  // Rien à suivre : pas de groupe, pas de demande. On ne charge même pas Firebase.
  if (!s.group && !s.groupRequest) { stopWatching(); return; }
  let f: Fb;
  try { f = await fb(); } catch { setLive({ online: false }); return; }
  const { db, fs, uid } = f;
  const g = getState().group;
  const key = g ? `g:${g.id}:${g.role}:${g.section}` : `r:${getState().groupRequest?.groupId}`;
  if (key !== watching) {
    stopWatching();
    watching = key;
    // Messages pour moi : demande acceptée ou refusée, retrait du groupe.
    unsubs.push(fs.onSnapshot(fs.collection(db, 'notices', uid, 'items'), (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== 'added') return;
        const d = ch.doc.data();
        void handleNotice({ type: d.type, groupName: String(d.groupName ?? '') }, String(d.groupId ?? ''));
        void fs.deleteDoc(ch.doc.ref);
      });
    }));
    if (g) {
      unsubs.push(fs.onSnapshot(fs.doc(db, 'groups', g.id), (d) => {
        if (!d.exists()) { if (getState().group?.id === g.id) update({ group: null }); return; }
        const info = toInfo(d.id, d.data());
        const cur = getState().group;
        if (!cur || cur.id !== g.id) return;
        const role = info.adminUid === uid ? 'admin' : 'member';
        update({ group: { ...cur, name: info.name, adminUid: info.adminUid, adminName: info.adminName, role, programmeId: info.programmeId, khatam: { ...cur.khatam, name: info.name, start: info.start, days: info.days } } });
      }));
      // Membres visibles : tout le groupe classique ; dans un groupe encadré, sa section (l'encadrant voit tout).
      const mcol = fs.collection(db, 'groups', g.id, 'members');
      const mq = g.kind === 'guided' && g.role !== 'admin' ? fs.query(mcol, fs.where('section', '==', g.section)) : mcol;
      unsubs.push(fs.onSnapshot(mq, (snap) => {
        const members = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Member, 'uid'>) }));
        setLive({ members, online: true, me: uid });
        // Retiré du groupe : ma fiche a disparu.
        if (snap.metadata.fromCache === false && !members.some((m) => m.uid === uid) && getState().group?.id === g.id) {
          update({ group: null });
        }
      }, () => setLive({ online: false })));
      unsubs.push(fs.onSnapshot(fs.collection(db, 'groups', g.id, 'stats'), (snap) => {
        setLive({ stats: snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Stat, 'uid'>) })) });
      }, () => {}));
      if (g.role === 'admin') {
        unsubs.push(fs.onSnapshot(fs.collection(db, 'groups', g.id, 'requests'), (snap) => {
          setLive({ requests: snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Request, 'uid'>) })) });
        }, () => {}));
      } else setLive({ requests: [] });
    }
  }
  // Envoyer ma progression (jours lus, séances cochées) quand elle change.
  if (g) {
    const prog = progressOf(getState());
    const payload = prog ? JSON.stringify([prog.done, prog.sessions]) : lastPushed;
    if (payload !== lastPushed) {
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(async () => {
        const cur = getState().group;
        if (!cur) return;
        const p = progressOf(getState());
        if (!p) return;
        try {
          const batch = fs.writeBatch(db);
          batch.update(fs.doc(db, 'groups', cur.id, 'members', uid), { done: p.done, sessions: p.sessions });
          batch.update(fs.doc(db, 'groups', cur.id, 'stats', uid), { doneCount: p.done.length, done: p.done });
          await batch.commit();
          lastPushed = JSON.stringify([p.done, p.sessions]);
        } catch { /* hors connexion : Firestore renverra plus tard */ }
      }, 800);
    }
  }
}

/** Ce qu'on partage avec le groupe : le khatm du Ramadan pour un groupe du Ramadan, le khatm du groupe sinon. */
function progressOf(s: ReturnType<typeof getState>): { done: number[]; sessions: Record<string, number[]> } | null {
  const g = s.group!;
  // Groupe du Ramadan : rien à envoyer avant d'avoir commencé, ni après l'Aïd (le khatm est alors rangé dans l'historique).
  if (g.purpose === 'ramadan') return s.ramadan ? { done: s.ramadan.done, sessions: s.ramadan.sessions } : null;
  return { done: g.done, sessions: g.sessions };
}

function stopWatching() {
  unsubs.forEach((u) => u());
  unsubs = [];
  watching = '';
}

/** Une demande acceptée : on entre dans le groupe (et on récupère sa progression si on l'avait déjà). */
async function handleNotice(n: Notice, groupId: string) {
  const s = getState();
  if (n.type === 'accepted' && s.groupRequest?.groupId === groupId) {
    const { db, fs, uid } = await fb();
    const g = await fs.getDoc(fs.doc(db, 'groups', groupId));
    const m = await fs.getDoc(fs.doc(db, 'groups', groupId, 'members', uid));
    if (g.exists() && m.exists()) {
      const md = m.data();
      const local = localGroup(toInfo(g.id, g.data()), 'member', md.section, String(md.joinedOn ?? todayISO()));
      update({ group: { ...local, done: md.done ?? [], sessions: md.sessions ?? {} }, groupRequest: null });
    }
  }
  if (n.type === 'refused' && s.groupRequest?.groupId === groupId) update({ groupRequest: null });
  if (n.type === 'removed' && s.group?.id === groupId) update({ group: null });
  onNotice(n);
}
