/**
 * What the studio knows about the page.
 *
 * The page itself is the schema. This module reads the served document back —
 * every `[data-edit]` passage and every `[data-collection]` list — so the
 * studio always starts from exactly what a reader would see, and nothing about
 * the copy is written down in two places. The tables below only name things:
 * which passage is called what, and which control suits which field.
 */

/* ---- The passages, by the part of the page they set ---------------------- */

export const WORD_GROUPS = [
  {
    id: 'front',
    title: 'The front page',
    keys: [
      ['front.kicker', 'Kicker above the name'],
      ['front.name', 'The name itself'],
      ['front.strapline', 'The word before the typewriter'],
      ['front.words', 'The typewriter, one phrase per line'],
      ['front.lede', 'Opening paragraph'],
      ['front.ledeSmall', 'The line under it'],
      ['front.portraitCaption', 'Caption under the portrait'],
    ],
  },
  {
    id: 'about',
    title: 'I — About the author',
    keys: [
      ['about.title', 'Section title'],
      ['about.standfirst', 'Standfirst'],
      ['about.p1', 'First paragraph'],
      ['about.p2', 'Second paragraph'],
      ['about.p3', 'Third paragraph'],
      ['about.signature', 'Note under the signature'],
      ['about.factsTitle', 'Title of the panel in the margin'],
    ],
  },
  {
    id: 'craft',
    title: 'II — The craft',
    keys: [['craft.title', 'Section title'], ['craft.standfirst', 'Standfirst']],
  },
  {
    id: 'education',
    title: 'III — Education',
    keys: [['education.title', 'Section title'], ['education.standfirst', 'Standfirst']],
  },
  {
    id: 'campus',
    title: 'IV — At the university',
    keys: [
      ['campus.title', 'Section title'],
      ['campus.standfirst', 'Standfirst'],
      ['campus.lede', 'The paragraph above the record'],
      ['campus.platesHeading', 'Heading over the photographs'],
    ],
  },
  {
    id: 'gamejams',
    title: 'V — Game jams',
    keys: [['gamejams.title', 'Section title'], ['gamejams.standfirst', 'Standfirst']],
  },
  {
    id: 'letters',
    title: 'VI — Letters',
    keys: [
      ['letters.title', 'Section title'],
      ['letters.standfirst', 'Standfirst'],
      ['letters.prompt', 'The invitation, while the column is empty'],
    ],
  },
  {
    id: 'contact',
    title: 'VII — Correspondence',
    keys: [
      ['contact.title', 'Section title'],
      ['contact.standfirst', 'Standfirst'],
      ['contact.note', 'The note above the form'],
      ['contact.directTitle', 'Title of the direct panel'],
      ['contact.currentlyTitle', 'Title of the currently panel'],
      ['contact.currently', 'What you are doing at the moment'],
      ['contact.availability', 'The line beside the pulsing dot'],
    ],
  },
  {
    id: 'colophon',
    title: 'The colophon',
    keys: [['colophon.tag', 'The line under the name'], ['colophon.note', 'The colophon itself']],
  },
];

/* ---- The lists ----------------------------------------------------------- */

export const ICON_NAMES = ['web', 'mobile', 'cloud', 'game', 'design', 'data', 'photo', 'book', 'compass'];

const line = (key, label) => ({ key, label, kind: 'line' });
const rich = (key, label) => ({ key, label, kind: 'rich' });

export const LISTS = [
  {
    name: 'craft',
    title: 'The craft',
    note: 'The cards under section II.',
    each: 'card',
    name_of: (item) => item.title || 'A new card',
    fields: [
      line('title', 'Title'),
      rich('body', 'What it involves'),
      rich('meta', 'Tools, separated by ·'),
      { key: 'iconName', label: 'Icon', kind: 'icon' },
    ],
    blank: { title: 'A new kind of work', body: '', meta: '', iconName: 'compass' },
  },
  {
    name: 'education',
    title: 'Education',
    note: 'The schools under section III.',
    each: 'school',
    name_of: (item) => item.school || 'A new school',
    fields: [
      line('school', 'School'),
      line('degree', 'Degree or stream'),
      line('from', 'From, as printed'),
      { key: 'fromISO', label: 'From, as a date', kind: 'month' },
      line('to', 'To, as printed'),
      { key: 'toISO', label: 'To, as a date', kind: 'month' },
      line('state', 'Aside — “expected”, and the like'),
      rich('body', 'The account of it'),
    ],
    blank: { school: 'A new school', degree: '', from: '', fromISO: '', to: '', toISO: '', state: '', body: '' },
  },
  {
    name: 'timeline',
    title: 'At the university',
    note: 'The record under section IV, oldest first.',
    each: 'entry',
    name_of: (item) => item.title || 'A new entry',
    fields: [
      line('title', 'What happened'),
      line('date', 'Date, as printed'),
      { key: 'dateISO', label: 'Date, as a date', kind: 'month' },
      rich('body', 'The account of it'),
      { key: 'tags', label: 'Tags, separated by commas', kind: 'tags' },
      { key: 'now', label: 'Mark this one “Now”', kind: 'flag' },
      { key: 'image', label: 'Photograph', kind: 'image' },
    ],
    blank: { title: 'A new entry', date: '', dateISO: '', body: '', tags: [], now: false, image: null },
  },
  {
    name: 'gamejams',
    title: 'Game jams & certificates',
    note: 'The seals under section V.',
    each: 'certificate',
    name_of: (item) => item.title || 'A new certificate',
    fields: [
      line('title', 'Title'),
      rich('body', 'Who ran it, and what it was made in'),
      line('numeral', 'Numeral in the seal'),
      { key: 'image', label: 'Photograph', kind: 'image' },
    ],
    blank: { title: 'A new certificate', body: '', numeral: '', image: null },
  },
  {
    name: 'letters',
    title: 'Letters',
    note: 'Section VI. While this is empty the page prints the invitation instead.',
    each: 'letter',
    name_of: (item) => item.name || 'A new letter',
    fields: [
      rich('quote', 'What they wrote'),
      line('name', 'Who wrote it'),
      line('role', 'Their role and organisation'),
    ],
    blank: { quote: '', name: '', role: '' },
  },
  {
    name: 'gallery',
    title: 'Photographs',
    note: 'Hung at the foot of section IV.',
    each: 'photograph',
    name_of: (item) => item.alt || item.caption || 'A photograph',
    fields: [
      { key: 'image', label: 'The photograph', kind: 'image' },
      line('alt', 'What is in it, for a reader who cannot see it'),
      rich('caption', 'Caption'),
    ],
    blank: { image: null, alt: '', caption: '' },
  },
  {
    name: 'facts',
    title: 'In brief',
    note: 'The panel in the margin of section I.',
    each: 'fact',
    name_of: (item) => item.term || 'A new fact',
    fields: [line('term', 'Term'), rich('detail', 'Detail')],
    blank: { term: '', detail: '' },
  },
  {
    name: 'contact',
    title: 'Direct',
    note: 'The panel beside the correspondence form. A link belongs in the value.',
    each: 'line',
    name_of: (item) => item.label || 'A new line',
    fields: [
      line('label', 'Label'),
      rich('value', 'Value — a link is fine here'),
      line('copy', 'What the copy button copies, if any'),
    ],
    blank: { label: '', value: '', copy: '' },
  },
  {
    name: 'ticker',
    title: 'The ribbon of tools',
    note: 'The moving band under the front page.',
    flat: true,
  },
];

/* ---- Reading the served page back --------------------------------------- */

const inner = (node) => (node ? node.innerHTML.trim().replace(/\s+/g, ' ') : '');

const readItem = (name, node) => {
  const item = {};
  for (const field of node.querySelectorAll('[data-field]')) {
    item[field.dataset.field] = inner(field);
  }

  if (name === 'craft') item.iconName = node.dataset.icon || 'compass';

  if (name === 'education') {
    item.fromISO = node.querySelector('[data-field="from"]')?.getAttribute('datetime') ?? '';
    item.toISO = node.querySelector('[data-field="to"]')?.getAttribute('datetime') ?? '';
  }

  if (name === 'timeline') {
    item.dateISO = node.querySelector('[data-field="date"]')?.getAttribute('datetime') ?? '';
    item.now = node.dataset.now === 'true';
    item.tags = [...node.querySelectorAll('[data-field="tags"] .tag')].map((tag) => tag.textContent.trim());
  }

  if (name === 'contact') item.copy = node.dataset.copy ?? '';

  const picture = node.querySelector('img');
  if (picture) {
    item.image = {
      src: picture.getAttribute('src'),
      w: Number(picture.getAttribute('width')) || 0,
      h: Number(picture.getAttribute('height')) || 0,
      alt: picture.getAttribute('alt') ?? '',
    };
    if (name === 'gallery') item.alt = picture.getAttribute('alt') ?? '';
  } else if (name !== 'craft') {
    item.image = null;
  }

  return item;
};

/**
 * Everything the page is currently saying, read out of the document the Worker
 * actually served — so an override and a default look identical here.
 */
export function readPage(doc) {
  const text = {};
  const changed = new Set();

  for (const node of doc.querySelectorAll('[data-edit]')) {
    const key = node.dataset.edit;
    if (!key || key in text) continue;
    text[key] = node.dataset.editAttr ? node.getAttribute(node.dataset.editAttr) ?? '' : inner(node);
    if (node.dataset.edited === 'true') changed.add(key);
  }

  const collections = {};

  for (const node of doc.querySelectorAll('[data-collection]')) {
    const name = node.dataset.collection;
    if (!name) continue;

    collections[name] = name === 'ticker'
      ? [...node.querySelectorAll('[data-words] b')].map((word) => word.textContent.replace(/ /g, ' ').trim())
      : [...node.querySelectorAll('[data-item]')].map((item) => readItem(name, item));

    if (node.dataset.edited === 'true') changed.add(`list:${name}`);
  }

  const portrait = doc.querySelector('[data-slot="portrait"] .portrait__photo');

  return {
    text,
    collections,
    changed,
    portrait: portrait
      ? {
        src: portrait.getAttribute('src'),
        w: Number(portrait.getAttribute('width')) || 0,
        h: Number(portrait.getAttribute('height')) || 0,
        alt: portrait.getAttribute('alt') ?? '',
      }
      : null,
  };
}

/** Fetches the served page and reads it. */
export async function loadPage() {
  const response = await fetch('/', { credentials: 'same-origin', cache: 'no-store' });
  const html = await response.text();
  return readPage(new DOMParser().parseFromString(html, 'text/html'));
}

/* ---- Talking to the Worker ----------------------------------------------- */

export async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: options.body && !options.headers
      ? { 'content-type': 'application/json' }
      : options.headers,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error ?? 'that did not work');
  return body;
}

export const save = (patch) => api('content', { method: 'PUT', body: JSON.stringify(patch) });

/* ---- Photographs --------------------------------------------------------- */

const LONGEST = 1600;

/** Shrinks a photograph in the browser, so nothing enormous is ever sent. */
export async function shrink(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const ratio = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(Math.round(bitmap.width * ratio), 1);
  const h = Math.max(Math.round(bitmap.height * ratio), 1);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  /* Only a PNG can be carrying transparency worth keeping. */
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((done) => canvas.toBlob(done, type, 0.84));
  if (!blob) throw new Error('that photograph could not be read');

  return { blob, w, h };
}

export async function upload(file) {
  const { blob, w, h } = await shrink(file);
  const query = new URLSearchParams({ name: file.name ?? '', w: String(w), h: String(h) });

  const body = await api(`media?${query}`, {
    method: 'POST',
    headers: { 'content-type': blob.type },
    body: blob,
  });

  return { src: body.src, w, h, alt: '' };
}
