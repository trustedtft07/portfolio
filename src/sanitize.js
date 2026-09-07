/**
 * A small allow-list scrubber for anything the studio sends back.
 *
 * Only one person can write here, so this is not a defence against a stranger —
 * it is a defence against a paste from a word processor bringing half a
 * stylesheet with it, and against the page ever being able to run something it
 * was handed. The parser is the platform's own: `HTMLRewriter`, the same one
 * that stamps the overrides into the page.
 */

const KEEP = new Set([
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'em', 'i', 'kbd', 'mark',
  'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u',
]);

/* Elements whose *content* must go with them, not be unwrapped into the page. */
const DROP = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta',
  'noscript', 'template', 'svg', 'math', 'form', 'input', 'button', 'textarea',
]);

const ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
  abbr: new Set(['title']),
  time: new Set(['datetime']),
  span: new Set(['class']),
};

/* The house classes a span is allowed to carry. */
const CLASSES = new Set(['dropcap', 'tag', 'numeral', 'education__state', 'sr-only']);

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

/** Rich text: keeps the handful of inline elements the page is set in. */
export async function cleanHtml(input, limit = 20_000) {
  if (typeof input !== 'string') return '';
  const source = input.slice(0, limit);

  const rewriter = new HTMLRewriter().on('*', {
    element(element) {
      const tag = element.tagName.toLowerCase();

      if (DROP.has(tag)) { element.remove(); return; }
      if (!KEEP.has(tag)) { element.removeAndKeepContent(); return; }

      const allowed = ATTRS[tag] ?? new Set();
      for (const [name, value] of [...element.attributes]) {
        const key = name.toLowerCase();

        if (!allowed.has(key)) { element.removeAttribute(name); continue; }

        if (key === 'href' && !SAFE_HREF.test(value.trim())) {
          element.removeAttribute(name);
        }

        if (key === 'class') {
          const kept = value.split(/\s+/).filter((one) => CLASSES.has(one));
          if (kept.length) element.setAttribute('class', kept.join(' '));
          else element.removeAttribute('class');
        }
      }

      /* A link that leaves the site should not hand the opener over with it. */
      if (tag === 'a' && element.getAttribute('target')) {
        element.setAttribute('rel', 'noopener');
      }
    },
  });

  return (await rewriter.transform(new Response(source)).text()).trim();
}

/** Plain text: everything else, with the markup taken out rather than escaped. */
export async function cleanText(input, limit = 400) {
  const html = await cleanHtml(input, limit * 4);
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/** Escapes a plain string on its way back into markup. */
export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** A slug safe to use as a KV key fragment or an id attribute. */
export const slug = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);
