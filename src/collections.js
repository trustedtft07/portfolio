/**
 * The lists the studio can add to, and how each one is set back into the page.
 *
 * Every renderer here prints exactly the markup that already stands in
 * `index.html` — the same classes, the same order, the same `data-field` hooks
 * the studio reads them back out of. The static page is therefore both the
 * default copy and the template: nothing is written down twice, and a
 * deployment with an empty store renders precisely what is in the repository.
 */

import { cleanHtml, cleanText, escapeHtml } from './sanitize.js';

/* ---- The engraver's icon case -------------------------------------------- */

export const ICONS = {
  web: '<rect x="5" y="9" width="38" height="30" rx="2"/><path d="M5 17h38"/>'
    + '<circle cx="10" cy="13" r="1.1" class="fill"/><circle cx="14.5" cy="13" r="1.1" class="fill"/>'
    + '<path d="M15 24l-4 4 4 4M27 22l-4 12M33 24l4 4-4 4"/>',
  mobile: '<rect x="14" y="5" width="20" height="38" rx="3"/><path d="M21 9.5h6"/>'
    + '<circle cx="24" cy="37.5" r="1.6" class="fill"/><path d="M18 17h12M18 22h12M18 27h7"/>',
  cloud: '<path d="M11 31a8 8 0 011.4-15.9A11 11 0 0133 17.5 7.6 7.6 0 0137 31z"/>'
    + '<path d="M24 23v15M19 33l5 5 5-5"/>',
  game: '<rect x="4" y="15" width="40" height="20" rx="7"/><path d="M14 21v8M10 25h8"/>'
    + '<circle cx="32" cy="23" r="2" class="fill"/><circle cx="37" cy="27.5" r="2" class="fill"/>',
  design: '<path d="M9 39l3.5-9.5 19-19 6 6-19 19z"/><path d="M29.5 13.5l6 6"/>'
    + '<path d="M9 39l6.5-2.5"/><path d="M20 40h19"/>',
  data: '<ellipse cx="24" cy="12" rx="14" ry="5"/>'
    + '<path d="M10 12v24c0 2.8 6.3 5 14 5s14-2.2 14-5V12"/>'
    + '<path d="M10 24c0 2.8 6.3 5 14 5s14-2.2 14-5"/>',
  photo: '<rect x="5" y="13" width="38" height="26" rx="3"/><path d="M17 13l3-5h8l3 5"/>'
    + '<circle cx="24" cy="26" r="7"/>',
  book: '<path d="M8 10h13a5 5 0 015 5v23a4 4 0 00-4-4H8z"/>'
    + '<path d="M40 10H27a5 5 0 00-5 5v23a4 4 0 014-4h14z"/>',
  compass: '<circle cx="24" cy="24" r="17"/><path d="M31.5 16.5l-4.5 10.5-10.5 4.5 4.5-10.5z"/>'
    + '<circle cx="24" cy="24" r="1.6" class="fill"/>',
};

const icon = (name) => ICONS[name] ?? ICONS.compass;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const two = (n) => String(n).padStart(2, '0');

const DEFAULT_PROMPT = 'This column is set, but nothing has been printed in it yet. If we have '
  + 'worked together &mdash; on coursework, on a client project, or on anything with a deadline '
  + '&mdash; I would be glad to run your words here.';

/* An image the studio uploaded, or nothing at all. */
const picture = (image, className, alt) => {
  if (!image || !image.src) return '';
  const size = image.w && image.h ? ' width="' + image.w + '" height="' + image.h + '"' : '';
  return '<img class="' + className + '" src="' + escapeHtml(image.src) + '"'
    + ' alt="' + escapeHtml(alt ?? '') + '"' + size + ' loading="lazy" decoding="async">';
};

/* ---- Renderers ----------------------------------------------------------- */

const renderCraft = (items) => items.map((item, index) => [
  '      <li class="craft__item card reveal" data-item data-icon="' + escapeHtml(item.iconName) + '">',
  '        <span class="card__index" aria-hidden="true">' + two(index + 1) + '</span>',
  '        <svg class="craft__icon" viewBox="0 0 48 48" aria-hidden="true">' + icon(item.iconName) + '</svg>',
  '        <h3 class="craft__title" data-field="title">' + item.title + '</h3>',
  '        <p data-field="body">' + item.body + '</p>',
  '        <p class="craft__meta" data-field="meta">' + item.meta + '</p>',
  '      </li>',
].join('\n')).join('\n');

const renderEducation = (items) => items.map((item) => [
  '      <li class="education__item card reveal" data-item>',
  '        <p class="education__period">',
  '          <time datetime="' + escapeHtml(item.fromISO) + '" data-field="from">' + item.from + '</time> &ndash;',
  '          <time datetime="' + escapeHtml(item.toISO) + '" data-field="to">' + item.to + '</time>',
  item.state ? '          <span class="education__state" data-field="state">' + item.state + '</span>' : '',
  '        </p>',
  '        <h3 class="education__school" data-field="school">' + item.school + '</h3>',
  '        <p class="education__degree" data-field="degree">' + item.degree + '</p>',
  '        <p data-field="body">' + item.body + '</p>',
  '      </li>',
].filter(Boolean).join('\n')).join('\n');

const renderTimeline = (items) => items.map((item) => [
  '      <li class="timeline__item reveal" data-item' + (item.now ? ' data-now="true"' : '') + '>',
  '        <p class="timeline__date"><time datetime="' + escapeHtml(item.dateISO) + '"'
    + ' data-field="date">' + item.date + '</time></p>',
  '        <div class="timeline__card card' + (item.now ? ' timeline__card--now' : '') + '">',
  '          <h3 class="timeline__title" data-field="title">' + item.title + '</h3>',
  '          <p data-field="body">' + item.body + '</p>',
  item.image && item.image.src
    ? '          <figure class="timeline__figure" data-figure>'
      + picture(item.image, 'timeline__photo', item.image.alt) + '</figure>'
    : '',
  item.tags.length
    ? '          <p class="timeline__tags" data-field="tags">'
      + item.tags.map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join('')
      + '</p>'
    : '',
  '        </div>',
  '      </li>',
].filter(Boolean).join('\n')).join('\n');

const renderGamejams = (items) => items.map((item, index) => [
  '      <li class="landmark reveal" data-item>',
  '        <span class="seal" aria-hidden="true"><span class="seal__inner" data-field="numeral">'
    + escapeHtml(item.numeral || ROMAN[items.length - index] || String(items.length - index))
    + '</span></span>',
  '        <h3 class="landmark__title" data-field="title">' + item.title + '</h3>',
  '        <p data-field="body">' + item.body + '</p>',
  item.image && item.image.src
    ? '        <figure class="landmark__figure" data-figure>'
      + picture(item.image, 'landmark__photo', item.image.alt) + '</figure>'
    : '',
  '      </li>',
].filter(Boolean).join('\n')).join('\n');

/* An empty column keeps the invitation that stands in the page by default. */
const emptyLetters = (prompt) => [
  '      <li class="letter letter--empty card reveal" data-empty>',
  '        <svg class="quill" viewBox="0 0 64 64" aria-hidden="true">',
  '          <path d="M50 12C34 14 22 24 18 38c-1 4-3 7-6 10l4 4c3-3 6-5 10-6 14-4 24-16 24-34z"/>',
  '          <path d="M12 52l16-16"/>',
  '          <path d="M30 34h10"/>',
  '        </svg>',
  '        <p class="letter__prompt" data-edit="letters.prompt">' + (prompt ?? DEFAULT_PROMPT) + '</p>',
  '        <a class="btn btn--sm" href="mailto:ahmadandhikaharirie@gmail.com?subject=A%20letter%20for%20your%20portfolio">Write a letter</a>',
  '      </li>',
].join('\n');

const renderLetters = (items, extras) => (items.length ? items.map((item) => [
  '      <li class="letter card reveal" data-item>',
  '        <blockquote>',
  '          <p data-field="quote">' + item.quote + '</p>',
  '        </blockquote>',
  '        <footer class="letter__by">',
  '          <span class="letter__name" data-field="name">' + item.name + '</span>',
  '          <span class="letter__role" data-field="role">' + item.role + '</span>',
  '        </footer>',
  '      </li>',
].join('\n')).join('\n') : emptyLetters(extras && extras.prompt));

const renderGallery = (items) => items.map((item) => [
  '      <li class="plate reveal" data-item>',
  '        <figure class="plate__figure">',
  '          <span class="plate__frame">' + picture(item.image, 'plate__img', item.alt) + '</span>',
  '          <figcaption class="plate__caption" data-field="caption">' + item.caption + '</figcaption>',
  '        </figure>',
  '      </li>',
].join('\n')).join('\n');

const renderFacts = (items) => items.map((item) =>
  '            <div data-item><dt data-field="term">' + item.term + '</dt>'
  + '<dd data-field="detail">' + item.detail + '</dd></div>').join('\n');

const renderContact = (items) => items.map((item) => {
  const copy = item.copy
    ? '<button class="copy-btn" type="button" data-copy="' + escapeHtml(item.copy) + '"'
      + ' aria-label="Copy the ' + escapeHtml(item.label.toLowerCase()) + '">Copy</button>'
    : '';
  return [
    '            <li data-item' + (item.copy ? ' data-copy="' + escapeHtml(item.copy) + '"' : '') + '>',
    '              <span class="contact__label" data-field="label">' + item.label + '</span>',
    '              <span class="contact__value"><span data-field="value">' + item.value + '</span>'
      + copy + '</span>',
    '            </li>',
  ].join('\n');
}).join('\n');

const renderTicker = (items) => {
  const group = items
    .map((word) => '<b>' + escapeHtml(word).replace(/ /g, '&nbsp;') + '</b><i>&#10022;</i>')
    .join('');
  return '\n    <span class="ticker__group" data-words>' + group + '</span>'
    + '\n    <span class="ticker__group" aria-hidden="true">' + group + '</span>\n  ';
};

/* ---- Shapes -------------------------------------------------------------- */

/**
 * One entry per list: how many items it will take, and how each field is
 * cleaned on the way in. `html` keeps the inline elements; `text` keeps none.
 */
export const SHAPES = {
  craft: {
    max: 12,
    render: renderCraft,
    fields: {
      iconName: { kind: 'name', fallback: 'compass' },
      title: { kind: 'text', limit: 90 },
      body: { kind: 'html', limit: 1200 },
      meta: { kind: 'html', limit: 240 },
    },
  },
  education: {
    max: 10,
    render: renderEducation,
    fields: {
      from: { kind: 'text', limit: 40 },
      fromISO: { kind: 'iso' },
      to: { kind: 'text', limit: 40 },
      toISO: { kind: 'iso' },
      state: { kind: 'text', limit: 40 },
      school: { kind: 'text', limit: 120 },
      degree: { kind: 'html', limit: 200 },
      body: { kind: 'html', limit: 1600 },
    },
  },
  timeline: {
    max: 40,
    render: renderTimeline,
    fields: {
      date: { kind: 'text', limit: 60 },
      dateISO: { kind: 'iso' },
      title: { kind: 'text', limit: 140 },
      body: { kind: 'html', limit: 1600 },
      tags: { kind: 'tags' },
      now: { kind: 'flag' },
      image: { kind: 'image' },
    },
  },
  gamejams: {
    max: 20,
    render: renderGamejams,
    fields: {
      numeral: { kind: 'text', limit: 8 },
      title: { kind: 'text', limit: 140 },
      body: { kind: 'html', limit: 900 },
      image: { kind: 'image' },
    },
  },
  letters: {
    max: 20,
    render: renderLetters,
    fields: {
      quote: { kind: 'html', limit: 1200 },
      name: { kind: 'text', limit: 90 },
      role: { kind: 'text', limit: 140 },
    },
  },
  gallery: {
    max: 60,
    render: renderGallery,
    fields: {
      image: { kind: 'image' },
      alt: { kind: 'text', limit: 180 },
      caption: { kind: 'html', limit: 240 },
    },
  },
  facts: {
    max: 16,
    render: renderFacts,
    fields: {
      term: { kind: 'text', limit: 40 },
      detail: { kind: 'html', limit: 180 },
    },
  },
  contact: {
    max: 16,
    render: renderContact,
    fields: {
      label: { kind: 'text', limit: 32 },
      value: { kind: 'html', limit: 400 },
      copy: { kind: 'text', limit: 160 },
    },
  },
  ticker: {
    max: 40,
    render: renderTicker,
    fields: {},
    /* A flat list of words rather than a list of records. */
    flat: { limit: 40, each: 40 },
  },
};

const ISO = /^[0-9]{4}(-[0-9]{2}){0,2}$/;
const MEDIA = /^\/media\/[a-z0-9]{6,40}(\.[a-z0-9]{1,5})?$/i;

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

/** Cleans one submitted list into something safe to print. */
export async function cleanCollection(name, value) {
  const shape = SHAPES[name];
  if (!shape || !Array.isArray(value)) return null;

  if (shape.flat) {
    const words = [];
    for (const entry of value.slice(0, shape.flat.limit)) {
      const word = await cleanText(entry, shape.flat.each);
      if (word) words.push(word);
    }
    return words;
  }

  const items = [];

  for (const raw of value.slice(0, shape.max)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = {};

    for (const [field, spec] of Object.entries(shape.fields)) {
      const given = raw[field];

      switch (spec.kind) {
        case 'html':
          item[field] = await cleanHtml(given, spec.limit);
          break;
        case 'text':
          item[field] = escapeHtml(await cleanText(given, spec.limit));
          break;
        case 'name':
          item[field] = ICONS[given] ? given : spec.fallback;
          break;
        case 'iso':
          item[field] = ISO.test(String(given ?? '')) ? String(given) : '';
          break;
        case 'flag':
          item[field] = given === true || given === 'true';
          break;
        case 'tags': {
          const tags = [];
          for (const tag of Array.isArray(given) ? given.slice(0, 8) : []) {
            const clean = await cleanText(tag, 40);
            if (clean) tags.push(clean);
          }
          item[field] = tags;
          break;
        }
        case 'image':
          item[field] = await cleanImage(given);
          break;
        default:
          break;
      }
    }

    items.push(item);
  }

  return items;
}

export const renderCollection = (name, items, extras) =>
  (SHAPES[name] ? SHAPES[name].render(items, extras) : '');
