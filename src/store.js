/**
 * The store behind the page.
 *
 * One key in KV holds every override the studio has made — a map of text
 * fragments, a map of lists, and the photographs. Anything absent from it falls
 * back to what is written in `public/index.html`, so an empty store and a fresh
 * checkout render the same page.
 */

import { cleanCollection, SHAPES } from './collections.js';
import { cleanHtml, cleanText, escapeHtml } from './sanitize.js';

const KEY = 'content:v1';
const MAX_DOCUMENT = 512 * 1024;
const MAX_TEXT_KEYS = 400;

const EDIT_KEY = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/i;
const MEDIA = /^\/media\/[a-z0-9]{6,40}(\.[a-z0-9]{1,5})?$/i;

export const emptyContent = () => ({ text: {}, collections: {}, media: {}, updatedAt: null });

/** Reads the overrides. A store that cannot be reached is simply an empty one. */
export async function readContent(env) {
  try {
    const stored = await env.CONTENT.get(KEY, 'json');
    if (!stored || typeof stored !== 'object') return emptyContent();
    return {
      text: stored.text && typeof stored.text === 'object' ? stored.text : {},
      collections: stored.collections && typeof stored.collections === 'object' ? stored.collections : {},
      media: stored.media && typeof stored.media === 'object' ? stored.media : {},
      updatedAt: stored.updatedAt ?? null,
    };
  } catch {
    return emptyContent();
  }
}

async function cleanImage(given) {
  if (!given || typeof given !== 'object') return null;
  if (typeof given.src !== 'string' || !MEDIA.test(given.src)) return null;
  return {
    src: given.src,
    w: Number.isFinite(+given.w) ? Math.round(+given.w) : 0,
    h: Number.isFinite(+given.h) ? Math.round(+given.h) : 0,
    alt: escapeHtml(await cleanText(given.alt, 180)),
  };
}

/**
 * Applies a patch and writes it back.
 *
 * A key set to `null` is struck out rather than blanked, which is how the studio
 * says "put the printed wording back": the page falls through to the markup in
 * the repository again.
 */
export async function writeContent(env, patch) {
  if (!patch || typeof patch !== 'object') throw new Error('nothing to write');

  const content = await readContent(env);

  if (patch.text && typeof patch.text === 'object') {
    for (const [key, value] of Object.entries(patch.text)) {
      if (!EDIT_KEY.test(key)) continue;

      if (value === null) { delete content.text[key]; continue; }
      if (typeof value !== 'string') continue;
      if (Object.keys(content.text).length >= MAX_TEXT_KEYS && !(key in content.text)) continue;

      content.text[key] = await cleanHtml(value, 20_000);
    }
  }

  if (patch.collections && typeof patch.collections === 'object') {
    for (const [name, value] of Object.entries(patch.collections)) {
      if (!SHAPES[name]) continue;

      if (value === null) { delete content.collections[name]; continue; }

      const cleaned = await cleanCollection(name, value);
      if (cleaned) content.collections[name] = cleaned;
    }
  }

  if (patch.media && typeof patch.media === 'object') {
    for (const [slot, value] of Object.entries(patch.media)) {
      if (!EDIT_KEY.test(slot)) continue;

      if (value === null) { delete content.media[slot]; continue; }

      const image = await cleanImage(value);
      if (image) content.media[slot] = image;
    }
  }

  content.updatedAt = new Date().toISOString();

  const body = JSON.stringify(content);
  if (body.length > MAX_DOCUMENT) throw new Error('the record is too long to store');

  await env.CONTENT.put(KEY, body);
  return content;
}

/* ---- Photographs --------------------------------------------------------- */

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const MAX_UPLOAD = 4 * 1024 * 1024;

const digest = async (bytes) => {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Stores one photograph under the hash of its own bytes, so it never changes. */
export async function putMedia(env, bytes, type, meta = {}) {
  const extension = TYPES[type];
  if (!extension) throw new Error('that is not an image this site can print');
  if (bytes.byteLength > MAX_UPLOAD) throw new Error('that photograph is larger than 4 MB');

  const id = `${await digest(bytes)}.${extension}`;

  await env.CONTENT.put(`media:${id}`, bytes, {
    metadata: {
      type,
      size: bytes.byteLength,
      w: Number(meta.w) || 0,
      h: Number(meta.h) || 0,
      name: String(meta.name ?? '').slice(0, 80),
      at: new Date().toISOString(),
    },
  });

  return { id, src: `/media/${id}`, w: Number(meta.w) || 0, h: Number(meta.h) || 0 };
}

export async function getMedia(env, id) {
  const found = await env.CONTENT.getWithMetadata(`media:${id}`, { type: 'arrayBuffer' });
  if (!found || !found.value) return null;
  return { body: found.value, meta: found.metadata ?? {} };
}

export async function listMedia(env) {
  const listed = await env.CONTENT.list({ prefix: 'media:', limit: 500 });
  return listed.keys.map((key) => ({
    id: key.name.slice('media:'.length),
    src: `/media/${key.name.slice('media:'.length)}`,
    ...(key.metadata ?? {}),
  })).sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
}

export const deleteMedia = (env, id) => env.CONTENT.delete(`media:${id}`);
