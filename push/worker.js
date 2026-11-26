// Khatm : programme d'envoi des notifications (Cloudflare Worker, offre gratuite).
//
// - L'appli enregistre l'adresse de notification du téléphone (/subscribe) et lui envoie la liste de ses
//   prochains rappels avec leur heure exacte (/schedule), à chaque changement (séance cochée, programme…).
// - Le programme se réveille chaque minute (cron) et envoie les rappels dont l'heure est arrivée.
// - Messages de groupe (/notify) : vérifiés avec la connexion Firebase de l'expéditeur
//   (seul l'administrateur peut prévenir un membre ; seul un demandeur peut prévenir l'administrateur).
//
// Données gardées (base D1) : l'adresse de notification, un identifiant anonyme du téléphone,
// l'identifiant Firebase anonyme pour les messages de groupe, et les rappels à venir (heure, titre, texte).
// Secrets (réglés chez Cloudflare, jamais dans ce fichier) : VAPID_PRIVATE_JWK.

const FIREBASE_PROJECT = 'khatm-7bff3';
const ORIGINS = ['https://coumba1534.github.io', 'http://localhost:4192'];
const MAX_ITEMS = 300;
const HORIZON = 16 * 24 * 3600 * 1000; // rappels acceptés jusqu'à 16 jours à l'avance

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method !== 'POST') return json({ ok: true, service: 'khatm-push' });
    let body;
    try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }
    const path = new URL(req.url).pathname;
    try {
      if (path === '/subscribe') return json(await subscribe(env, body));
      if (path === '/schedule') return json(await schedule(env, body));
      if (path === '/notify') return json(await notify(env, body));
      if (path === '/unsubscribe') return json(await unsubscribe(env, body));
      if (path === '/test') return json(await testPush(env, body));
      // Envoie tout de suite les rappels arrivés à l'heure (le même travail que le réveil de chaque minute).
      if (path === '/tick') { const n = await sendDue(env); return json({ ok: true, sent: n }); }
      return json({ error: 'route' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 400);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDue(env));
  },
};

// ---- Routes ----

const isId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);
const clip = (s, n) => String(s ?? '').slice(0, n);

async function subscribe(env, b) {
  if (!isId(b.id)) throw new Error('id');
  const s = b.sub || {};
  if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) throw new Error('sub');
  const uid = b.idToken ? (await verifyFirebase(b.idToken)).uid : null;
  await env.DB.prepare(
    'INSERT INTO subs (id, endpoint, p256dh, auth, uid, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
    'ON CONFLICT(id) DO UPDATE SET endpoint = ?2, p256dh = ?3, auth = ?4, uid = COALESCE(?5, uid), updated = ?6',
  ).bind(b.id, s.endpoint, s.keys.p256dh, s.keys.auth, uid, Date.now()).run();
  return { ok: true };
}

async function schedule(env, b) {
  if (!isId(b.id)) throw new Error('id');
  const sub = await env.DB.prepare('SELECT id FROM subs WHERE id = ?1').bind(b.id).first();
  if (!sub) return { ok: false, error: 'unknown' };
  const now = Date.now();
  const items = (Array.isArray(b.items) ? b.items : [])
    .filter((x) => x && Number.isFinite(x.at) && x.at > now - 60000 && x.at < now + HORIZON)
    .slice(0, MAX_ITEMS);
  // On remplace les rappels à venir ; ceux dont l'heure vient d'arriver restent, pour être envoyés au prochain réveil.
  const stmts = [env.DB.prepare('DELETE FROM items WHERE sub = ?1 AND at > ?2').bind(b.id, now)];
  for (const x of items) {
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO items (sub, at, title, body, tag) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(b.id, Math.round(x.at), clip(x.title, 80), clip(x.body, 200), clip(x.tag, 80)));
  }
  await env.DB.batch(stmts);
  return { ok: true, count: items.length };
}

async function unsubscribe(env, b) {
  if (!isId(b.id)) throw new Error('id');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE sub = ?1').bind(b.id),
    env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(b.id),
  ]);
  return { ok: true };
}

/** Rappel de test, envoyé tout de suite à ce téléphone (bouton « Envoyer un rappel de test »). */
async function testPush(env, b) {
  if (!isId(b.id)) throw new Error('id');
  const s = await env.DB.prepare('SELECT * FROM subs WHERE id = ?1').bind(b.id).first();
  if (!s) return { ok: false, error: 'unknown' };
  const delay = Math.min(Math.max(Number(b.delay) || 0, 0), 120);
  if (delay > 0) {
    // Rappel différé : il passera par le réveil de chaque minute, pour tester l'appli fermée.
    await env.DB.prepare('INSERT OR REPLACE INTO items (sub, at, title, body, tag) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(b.id, Date.now() + delay * 1000, 'Rappel de test 🌙', 'Les rappels arrivent même quand l\'appli est fermée. Bismillah !', 'test').run();
    return { ok: true, delayed: delay };
  }
  return { ok: await deliver(env, s, { title: 'Rappel de test 🌙', body: 'Ceci est un rappel de test. Bismillah !', tag: 'test' }) };
}

/** Message de groupe, vérifié : l'expéditeur est-il bien autorisé à prévenir ce membre ? */
async function notify(env, b) {
  const { uid } = await verifyFirebase(b.idToken);
  const gid = String(b.groupId || '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(gid)) throw new Error('groupe');
  const target = String(b.target || '');
  const doc = async (path) => {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`, {
      headers: { Authorization: `Bearer ${b.idToken}` },
    });
    return r.ok ? r.json() : null;
  };
  const group = await doc(`groups/${gid}`);
  if (!group) throw new Error('groupe introuvable');
  const adminUid = group.fields?.adminUid?.stringValue;
  const name = clip(group.fields?.name?.stringValue, 60);
  let msg;
  if (b.type === 'request') {
    // Un demandeur prévient l'administrateur : sa demande doit exister.
    if (target !== adminUid || !(await doc(`groups/${gid}/requests/${uid}`))) throw new Error('refusé');
    msg = { title: `Nouvelle demande · ${name}`, body: `${clip(b.from, 30) || 'Quelqu\'un'} demande à rejoindre le groupe.`, tag: `demande-${gid}` };
  } else if (['accepted', 'refused', 'removed'].includes(b.type)) {
    if (uid !== adminUid) throw new Error('refusé');
    msg = b.type === 'accepted'
      ? { title: 'Bienvenue dans le groupe 🌙', body: `Votre demande pour « ${name} » est acceptée. Bismillah !`, tag: `groupe-${gid}` }
      : b.type === 'refused'
        ? { title: name, body: `Votre demande pour rejoindre « ${name} » n'a pas été acceptée.`, tag: `groupe-${gid}` }
        : { title: name, body: `Vous ne faites plus partie du groupe « ${name} ». Votre khatm personnel continue.`, tag: `groupe-${gid}` };
  } else throw new Error('type');
  const subs = await env.DB.prepare('SELECT * FROM subs WHERE uid = ?1').bind(target).all();
  let sent = 0;
  for (const s of subs.results || []) if (await deliver(env, s, msg)) sent++;
  return { ok: true, sent };
}

/** Chaque minute : envoyer les rappels dont l'heure est arrivée. */
async function sendDue(env) {
  const now = Date.now();
  const due = await env.DB.prepare(
    'SELECT items.sub, items.at, items.title, items.body, items.tag, subs.endpoint, subs.p256dh, subs.auth, subs.id ' +
    'FROM items JOIN subs ON subs.id = items.sub WHERE items.at <= ?1 ORDER BY items.at LIMIT 400',
  ).bind(now).all();
  let n = 0;
  for (const r of due.results || []) {
    // Un rappel en retard de plus de 3 heures (téléphone éteint, panne) n'est plus utile.
    if (now - r.at < 3 * 3600 * 1000 && await deliver(env, r, { title: r.title, body: r.body, tag: r.tag })) n++;
    await env.DB.prepare('DELETE FROM items WHERE sub = ?1 AND tag = ?2').bind(r.sub, r.tag).run();
  }
  return n;
}

/** Envoie une notification ; supprime l'abonnement s'il n'existe plus chez Apple ou Google. */
async function deliver(env, s, msg) {
  try {
    const res = await webPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, JSON.stringify(msg));
    // Journal d'envoi (diagnostic) : on ne garde que les 7 derniers jours.
    const detail = res.ok ? '' : (await res.text()).slice(0, 200);
    await env.DB.prepare('INSERT INTO log (at, sub, tag, status, detail) VALUES (?1, ?2, ?3, ?4, ?5)').bind(Date.now(), String(s.id).slice(0, 6), msg.tag, res.status, detail).run();
    await env.DB.prepare('DELETE FROM log WHERE at < ?1').bind(Date.now() - 7 * 24 * 3600 * 1000).run();
    if (res.status === 404 || res.status === 410) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM items WHERE sub = ?1').bind(s.id),
        env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(s.id),
      ]);
      return false;
    }
    return res.ok;
  } catch (e) {
    try { await env.DB.prepare('INSERT INTO log (at, sub, tag, status, detail) VALUES (?1, ?2, ?3, ?4, ?5)').bind(Date.now(), String(s.id).slice(0, 6), msg.tag, 0, String(e).slice(0, 200)).run(); } catch { /* */ }
    return false;
  }
}

// ---- Web Push (RFC 8291 : chiffrement aes128gcm ; RFC 8292 : VAPID) ----

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...a) => { const out = new Uint8Array(a.reduce((t, x) => t + x.length, 0)); let i = 0; for (const x of a) { out.set(x, i); i += x.length; } return out; };

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const hkdfExtract = (salt, ikm) => hmac(salt, ikm);
const hkdfExpand = async (prk, info, len) => (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);

export async function encrypt(p256dh, authSecret, plaintext) {
  const uaPublic = unb64u(p256dh), auth = unb64u(authSecret);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const prkKey = await hkdfExtract(auth, ecdh);
  const ikm = await hkdfExpand(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(plaintext), new Uint8Array([2]))));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ct);
}

async function vapidJwt(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://coumba1534.github.io/APPLIS/',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `${head}.${claims}.${b64u(sig)}`;
}

async function webPush(env, sub, payload) {
  const body = await encrypt(sub.p256dh, sub.auth, payload);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await vapidJwt(env, sub.endpoint)}, k=${env.VAPID_PUBLIC}`,
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'high',
    },
    body,
  });
}

// ---- Connexion Firebase (jeton anonyme) ----

let jwks = null, jwksAt = 0;
async function verifyFirebase(token) {
  if (typeof token !== 'string') throw new Error('connexion');
  const [h, p, s] = token.split('.');
  const header = JSON.parse(new TextDecoder().decode(unb64u(h)));
  const claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
  const now = Date.now() / 1000;
  if (claims.aud !== FIREBASE_PROJECT || claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT}` || claims.exp < now || !claims.sub) throw new Error('connexion');
  if (!jwks || Date.now() - jwksAt > 3600 * 1000) {
    jwks = (await (await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')).json()).keys;
    jwksAt = Date.now();
  }
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('connexion');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('connexion');
  return { uid: claims.sub };
}
