/**
 * The lock on the study door.
 *
 * One person may sign in — the proprietor. The password is checked against a
 * PBKDF2 record in KV if one has been set from the studio, and against the
 * `ADMIN_PASSWORD` secret otherwise, so the site is usable the moment it is
 * deployed and stops depending on the secret as soon as the password is changed.
 *
 * A session is a signed cookie and nothing else: no session table, no state to
 * clean up. The payload carries an epoch that lives in KV, so raising it signs
 * every device out at once.
 */

const PBKDF2_ROUNDS = 210_000;
const SESSION_DAYS = 30;
const COOKIE = 'aah_session';

const utf8 = new TextEncoder();

/* ---- base64url ----------------------------------------------------------- */

const toBase64Url = (bytes) => {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Constant-time comparison, so a wrong password leaks nothing by its timing. */
const sameBytes = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
};

/* ---- Passwords ----------------------------------------------------------- */

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ROUNDS },
    key,
    256,
  );
  return { v: 1, n: PBKDF2_ROUNDS, salt: toBase64Url(salt), hash: toBase64Url(bits) };
}

async function matchesRecord(password, record) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(record.salt), iterations: record.n },
    key,
    256,
  );
  return sameBytes(new Uint8Array(bits), fromBase64Url(record.hash));
}

/** True when this is the proprietor's password. */
export async function verifyPassword(env, password) {
  if (typeof password !== 'string' || !password) return false;

  const record = await env.CONTENT.get('auth:password', 'json');
  if (record) return matchesRecord(password, record);

  const secret = env.ADMIN_PASSWORD;
  if (!secret) return false;
  return sameBytes(utf8.encode(password), utf8.encode(secret));
}

export async function setPassword(env, password) {
  await env.CONTENT.put('auth:password', JSON.stringify(await hashPassword(password)));
}

/* ---- Sessions ------------------------------------------------------------ */

/**
 * The signing key. A deployment that never had `SESSION_SECRET` set still gets
 * a real random key — it is minted once and kept in KV.
 */
async function signingKey(env) {
  let secret = env.SESSION_SECRET;

  if (!secret) {
    secret = await env.CONTENT.get('auth:secret');
    if (!secret) {
      secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      await env.CONTENT.put('auth:secret', secret);
    }
  }

  return crypto.subtle.importKey(
    'raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

/** Raising the epoch invalidates every cookie already issued. */
async function epoch(env) {
  const stored = await env.CONTENT.get('auth:epoch');
  return Number(stored) || 1;
}

export async function signOutEverywhere(env) {
  await env.CONTENT.put('auth:epoch', String((await epoch(env)) + 1));
}

export async function issueSession(env) {
  const payload = toBase64Url(utf8.encode(JSON.stringify({
    sub: 'owner',
    e: await epoch(env),
    iat: Date.now(),
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  })));

  const mac = await crypto.subtle.sign('HMAC', await signingKey(env), utf8.encode(payload));
  return `${payload}.${toBase64Url(mac)}`;
}

const readCookie = (request, name) => {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
};

/** True when the request carries a live, untampered session. */
export async function isSignedIn(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return false;

  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;

  try {
    const ok = await crypto.subtle.verify(
      'HMAC', await signingKey(env), fromBase64Url(mac), utf8.encode(payload),
    );
    if (!ok) return false;

    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (claims.sub !== 'owner') return false;
    if (!claims.exp || claims.exp < Date.now()) return false;
    return claims.e === await epoch(env);
  } catch {
    return false;
  }
}

export const sessionCookie = (token, secure) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`
  + (secure ? '; Secure' : '');

export const clearedCookie = (secure) =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` + (secure ? '; Secure' : '');

/* ---- Throttling ---------------------------------------------------------- */

/**
 * Failed sign-ins are counted per address in the isolate that saw them, and the
 * lock-out itself is written to KV so it survives one. Reads are cheap; the
 * write only happens on the attempt that trips the lock.
 */
const recent = new Map();
const WINDOW_MS = 15 * 60_000;
const ALLOWED_TRIES = 8;

export async function isLockedOut(env, address) {
  const local = recent.get(address);
  if (local && local.until > Date.now()) return true;

  const until = Number(await env.CONTENT.get(`auth:lock:${address}`));
  return Boolean(until && until > Date.now());
}

export async function noteFailure(env, address) {
  const now = Date.now();
  const entry = recent.get(address);
  const tries = entry && now - entry.first < WINDOW_MS ? entry.tries + 1 : 1;
  const first = entry && now - entry.first < WINDOW_MS ? entry.first : now;

  if (tries >= ALLOWED_TRIES) {
    const until = now + WINDOW_MS;
    recent.set(address, { tries, first, until });
    await env.CONTENT.put(`auth:lock:${address}`, String(until), { expirationTtl: 900 });
    return;
  }

  recent.set(address, { tries, first, until: 0 });

  /* A deliberate pause: eight tries a quarter of an hour is slow going. */
  await new Promise((done) => setTimeout(done, 250));
}

export function noteSuccess(address) {
  recent.delete(address);
}
