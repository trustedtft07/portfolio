/**
 * The Worker in front of the page.
 *
 * The site is still a folder of static files; this only sits in front of it and
 * does three things:
 *
 *   1. streams `index.html` through `HTMLRewriter`, setting in whatever the
 *      studio has changed — so the served page is finished before it leaves the
 *      edge, with no flash of the old wording and nothing for a crawler to miss;
 *   2. answers `/api/*` for the studio itself: one session, one content
 *      document, and a shelf of photographs;
 *   3. serves those photographs back out of KV under `/media/`.
 *
 * Everything else is handed straight to the assets binding.
 */

import {
  clearedCookie, isLockedOut, isSignedIn, issueSession, noteFailure, noteSuccess,
  sessionCookie, setPassword, signOutEverywhere, verifyPassword,
} from './auth.js';
import { decorate, version } from './render.js';
import {
  deleteMedia, getMedia, listMedia, MAX_UPLOAD, putMedia, readContent, writeContent,
} from './store.js';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

const oops = (message, status = 400) => json({ ok: false, error: message }, status);

const isHtml = (response) =>
  (response.headers.get('content-type') ?? '').toLowerCase().includes('text/html');

/* The assets binding would answer a conditional request against the file alone,
   which is not what the reader is holding. We ask for the whole thing and
   settle the question here instead. */
const withoutValidators = (request) => {
  const headers = new Headers(request.headers);
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  return new Request(request, { headers });
};

const callerAddress = (request) =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';

/**
 * The studio is same-origin only. A cookie with `SameSite=Lax` already keeps a
 * cross-site form from carrying it, and this closes the gap for anything sent
 * as a simple request.
 */
const sameOrigin = (request, url) => {
  const origin = request.headers.get('origin');
  return !origin || origin === url.origin;
};

/* ---- The studio's API ---------------------------------------------------- */

async function handleApi(request, env, url) {
  const route = url.pathname.slice('/api/'.length);
  const method = request.method.toUpperCase();
  const secure = url.protocol === 'https:';

  if (method !== 'GET' && !sameOrigin(request, url)) return oops('cross-site request refused', 403);

  /* ---- Signing in ------------------------------------------------------- */

  if (route === 'session') {
    if (method === 'GET') return json({ ok: true, signedIn: await isSignedIn(request, env) });

    if (method === 'POST') {
      const address = callerAddress(request);
      if (await isLockedOut(env, address)) {
        return oops('Too many attempts. Try again in a quarter of an hour.', 429);
      }

      const body = await request.json().catch(() => ({}));
      if (!await verifyPassword(env, body.password)) {
        await noteFailure(env, address);
        return oops('That is not the password.', 401);
      }

      noteSuccess(address);
      return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await issueSession(env), secure) });
    }

    if (method === 'DELETE') {
      return json({ ok: true }, 200, { 'set-cookie': clearedCookie(secure) });
    }

    return oops('method not allowed', 405);
  }

  /* Everything past this point is the proprietor's alone. */
  if (!await isSignedIn(request, env)) return oops('Sign in first.', 401);

  /* ---- The content document --------------------------------------------- */

  if (route === 'content') {
    if (method === 'GET') return json({ ok: true, content: await readContent(env) });

    if (method === 'PUT' || method === 'POST') {
      const patch = await request.json().catch(() => null);
      if (!patch) return oops('that was not a patch');

      try {
        return json({ ok: true, content: await writeContent(env, patch) });
      } catch (error) {
        return oops(error.message ?? 'the record could not be written', 422);
      }
    }

    return oops('method not allowed', 405);
  }

  /* ---- Photographs ------------------------------------------------------ */

  if (route === 'media') {
    if (method === 'GET') return json({ ok: true, media: await listMedia(env) });

    if (method === 'POST') {
      const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const declared = Number(request.headers.get('content-length'));
      if (declared > MAX_UPLOAD) return oops('That photograph is larger than 4 MB.', 413);

      const bytes = await request.arrayBuffer();

      try {
        const stored = await putMedia(env, bytes, type, {
          name: url.searchParams.get('name') ?? '',
          w: url.searchParams.get('w'),
          h: url.searchParams.get('h'),
        });
        return json({ ok: true, ...stored });
      } catch (error) {
        return oops(error.message ?? 'the photograph could not be stored', 422);
      }
    }

    return oops('method not allowed', 405);
  }

  if (route.startsWith('media/') && method === 'DELETE') {
    await deleteMedia(env, decodeURIComponent(route.slice('media/'.length)));
    return json({ ok: true });
  }

  /* ---- The password ----------------------------------------------------- */

  if (route === 'password' && method === 'POST') {
    const body = await request.json().catch(() => ({}));

    if (!await verifyPassword(env, body.current)) return oops('The current password is wrong.', 401);
    if (typeof body.next !== 'string' || body.next.length < 10) {
      return oops('Choose a new password of at least ten characters.', 422);
    }

    await setPassword(env, body.next);
    await signOutEverywhere(env);

    /* The change signs every device out — including this one, which is then
       handed a fresh cookie so the studio does not close under the editor. */
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await issueSession(env), secure) });
  }

  return oops('no such endpoint', 404);
}

/* ---- Photographs, served ------------------------------------------------- */

async function handleMedia(env, url) {
  const id = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!/^[a-z0-9]{6,40}(\.[a-z0-9]{1,5})?$/i.test(id)) return new Response('Not found', { status: 404 });

  const found = await getMedia(env, id);
  if (!found) return new Response('Not found', { status: 404 });

  return new Response(found.body, {
    headers: {
      'content-type': found.meta.type ?? 'application/octet-stream',
      /* The name is the hash of the bytes, so this can never go stale. */
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

/* ---- The front door ------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    if (url.pathname.startsWith('/media/')) return handleMedia(env, url);

    const response = await env.ASSETS.fetch(withoutValidators(request));

    /* Only the document is rewritten; a stylesheet or a font goes straight out. */
    if (!isHtml(response)) return response;

    const [content, admin] = await Promise.all([readContent(env), isSignedIn(request, env)]);
    const tag = version(response.headers.get('etag'), content.updatedAt, admin);

    if (request.headers.get('if-none-match') === tag) {
      return new Response(null, {
        status: 304,
        headers: {
          etag: tag,
          'cache-control': admin ? 'private, no-store' : 'public, max-age=0, must-revalidate',
          vary: 'Cookie',
        },
      });
    }

    return decorate(response, content, admin, tag);
  },
};
