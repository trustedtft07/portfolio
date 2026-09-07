/**
 * Stamping the store into the page.
 *
 * The document that leaves the edge is the file in `public/`, streamed through
 * `HTMLRewriter` with whatever the studio has changed set into it. Nothing is
 * assembled in the browser, so a reader with scripting off — and a crawler —
 * sees the finished page, and the file in the repository stays the fallback for
 * every word that has never been touched.
 */

import { renderCollection } from './collections.js';
import { escapeHtml } from './sanitize.js';

/** One validator for the file, the store and who is reading. */
export const version = (fileTag, stamp, admin) => {
  const base = (fileTag ?? '0').replace(/^W\//, '').replace(/"/g, '');
  const at = String(stamp ?? '0').replace(/[^0-9A-Za-z]/g, '');
  return `W/"${base}-${at}${admin ? '-set' : ''}"`;
};

const portrait = (image) => {
  if (!image || !image.src) return '';
  const size = image.w && image.h ? ` width="${image.w}" height="${image.h}"` : '';
  return `<img class="portrait__photo" src="${escapeHtml(image.src)}"${size}`
    + ` alt="${escapeHtml(image.alt || 'Portrait of Ahmad Andhika Haririe')}">`;
};

/**
 * @param {Response} response  the static page, straight off the assets binding
 * @param {object}   content   the overrides
 * @param {boolean}  admin     whether the reader is signed in as the proprietor
 * @param {string}   tag       the validator for this document — see `version`
 */
export function decorate(response, content, admin, tag) {
  const text = content.text ?? {};
  const collections = content.collections ?? {};
  const media = content.media ?? {};

  const rewriter = new HTMLRewriter()

    /* The proprietor gets the editing bridge; nobody else is even told it exists. */
    .on('html', {
      element(element) {
        if (admin) element.setAttribute('data-admin', 'true');
      },
    })

    .on('head', {
      element(element) {
        if (!admin) return;
        element.append('<link rel="stylesheet" href="/assets/css/studio.css">', { html: true });
        element.append('<script type="module" src="/assets/js/studio-bridge.js"></script>', { html: true });
      },
    })

    /* A single passage of prose, a heading, a caption. */
    .on('[data-edit]', {
      element(element) {
        const key = element.getAttribute('data-edit');
        if (!key || !(key in text)) return;

        const attribute = element.getAttribute('data-edit-attr');
        if (attribute) element.setAttribute(attribute, text[key].replace(/<[^>]*>/g, ''));
        else element.setInnerContent(text[key], { html: true });

        element.setAttribute('data-edited', 'true');
      },
    })

    /* A whole list: the craft cards, the timeline, the certificates, the plates. */
    .on('[data-collection]', {
      element(element) {
        const name = element.getAttribute('data-collection');
        if (!name || !(name in collections)) return;

        element.setInnerContent(
          renderCollection(name, collections[name], { prompt: text['letters.prompt'] }),
          { html: true },
        );
        element.setAttribute('data-edited', 'true');
      },
    })

    /* The photograph in the frame on the front page, when one has been hung. */
    .on('[data-slot="portrait"]', {
      element(element) {
        if (!media.portrait) return;
        element.prepend(portrait(media.portrait), { html: true });
        element.setAttribute('data-edited', 'true');
      },
    });

  const decorated = rewriter.transform(response);
  const headers = new Headers(decorated.headers);

  /* The page differs for the one reader who is signed in, so it is never a
     shared cache entry while a session cookie is on the request. */
  headers.set('cache-control', admin ? 'private, no-store' : 'public, max-age=0, must-revalidate');
  headers.append('vary', 'Cookie');

  /* The file's own validator describes the file. What the reader is holding is
     the file *and* the store, so it gets a validator that covers both — or an
     edit would sit behind a 304 until the browser gave up on its copy. */
  headers.delete('last-modified');
  if (tag) headers.set('etag', tag);
  else headers.delete('etag');

  return new Response(decorated.body, {
    status: decorated.status,
    statusText: decorated.statusText,
    headers,
  });
}
