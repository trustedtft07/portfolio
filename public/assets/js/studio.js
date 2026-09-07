/**
 * The composing room.
 *
 * A single page behind one password that can reset anything printed on the
 * front of the house: the wording, the lists, the photographs. It starts by
 * reading the served document, so what it shows is always what a reader sees,
 * and it sends back only what has actually been changed.
 */

import {
  api, ICON_NAMES, LISTS, loadPage, save, upload, WORD_GROUPS,
} from './modules/studio-model.js';

document.documentElement.classList.remove('no-js');

const gate = document.getElementById('gate');
const studio = document.getElementById('studio');
const toast = document.getElementById('toast');

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let toastTimer = 0;

const say = (message, bad = false) => {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.bad = String(bad);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, bad ? 6000 : 3200);
};

/* What the page currently says, and what we mean to change about it. */
let page = null;
const patch = { text: {}, collections: {}, media: {} };
let draft = {};

const saveButton = document.getElementById('studio-save');

const touched = () => Object.keys(patch.text).length
  + Object.keys(patch.collections).length
  + Object.keys(patch.media).length;

const markDirty = () => { if (saveButton) saveButton.disabled = touched() === 0; };

/* ---- The door ------------------------------------------------------------ */

async function unlock(event) {
  event.preventDefault();

  const field = document.getElementById('gate-password');
  const status = document.getElementById('gate-status');
  const button = document.getElementById('gate-submit');

  status.textContent = '';
  button.disabled = true;

  try {
    await api('session', { method: 'POST', body: JSON.stringify({ password: field.value }) });
    field.value = '';
    await open();
  } catch (error) {
    status.textContent = error.message;
    field.select();
  } finally {
    button.disabled = false;
  }
}

document.getElementById('gate-form')?.addEventListener('submit', unlock);

/* ---- Fields -------------------------------------------------------------- */

/** A one-line plain field. */
function lineField(value, onChange) {
  const input = el('input', 'studio__line');
  input.type = 'text';
  input.value = value ?? '';
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

/**
 * A rich field: the handful of inline elements the page is set in, and nothing
 * else. A paste arrives as plain text, which is the only sane default when the
 * source is usually a word processor.
 */
function richField(value, onChange) {
  const wrap = el('div', 'editor');
  const bar = el('div', 'editor__bar');
  const body = el('div', 'editor__body');

  body.contentEditable = 'true';
  body.spellcheck = true;
  body.innerHTML = value ?? '';

  const command = (name, argument) => {
    body.focus();
    document.execCommand(name, false, argument);
    onChange(body.innerHTML);
  };

  const tools = [
    ['B', 'Bold', () => command('bold')],
    ['I', 'Italic', () => command('italic')],
    ['↗', 'Link', () => {
      const href = prompt('Where should this link go?', 'https://');
      if (href) command('createLink', href);
    }],
    ['⌫', 'Plain', () => command('removeFormat')],
  ];

  for (const [glyph, title, run] of tools) {
    const button = el('button', 'editor__tool', glyph);
    button.type = 'button';
    button.title = title;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', run);
    bar.append(button);
  }

  body.addEventListener('input', () => onChange(body.innerHTML));

  body.addEventListener('paste', (event) => {
    event.preventDefault();
    const plain = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, plain);
  });

  wrap.append(bar, body);
  return wrap;
}

function monthField(value, onChange) {
  const input = el('input', 'studio__line studio__line--short');
  input.type = 'month';
  input.value = /^\d{4}-\d{2}$/.test(value ?? '') ? value : '';
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function flagField(value, label, onChange) {
  const wrap = el('label', 'studio__flag');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = Boolean(value);
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(input, el('span', null, label));
  return wrap;
}

function iconField(value, onChange) {
  const select = el('select', 'studio__line studio__line--short');
  for (const name of ICON_NAMES) {
    const option = el('option', null, name);
    option.value = name;
    if (name === value) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

/* ---- Photographs --------------------------------------------------------- */

let shelf = [];

const refreshShelf = async () => {
  const body = await api('media');
  shelf = body.media ?? [];
};

/** The picker: everything already on the shelf, and a way to add to it. */
function imageField(value, onChange) {
  const wrap = el('div', 'picker');
  const preview = el('div', 'picker__preview');
  const tools = el('div', 'picker__tools');

  const paint = (image) => {
    preview.textContent = '';
    if (image?.src) {
      const picture = el('img');
      picture.src = image.src;
      picture.alt = '';
      preview.append(picture);
    } else {
      preview.append(el('span', 'picker__none', 'None'));
    }
  };

  const choose = el('button', 'btn btn--sm', 'Choose…');
  choose.type = 'button';
  choose.addEventListener('click', async () => {
    const picked = await openShelf();
    if (picked === undefined) return;
    paint(picked);
    onChange(picked);
  });

  const clear = el('button', 'btn btn--sm btn--ghost', 'Remove');
  clear.type = 'button';
  clear.addEventListener('click', () => { paint(null); onChange(null); });

  tools.append(choose, clear);
  paint(value);
  wrap.append(preview, tools);
  return wrap;
}

let shelfDialog = null;

/** Resolves to the chosen image, or `undefined` when the choice is abandoned. */
function openShelf() {
  return new Promise((resolve) => {
    if (!shelfDialog) {
      shelfDialog = el('dialog', 'shelf-dialog');
      document.body.append(shelfDialog);
    }

    shelfDialog.textContent = '';

    const head = el('div', 'shelf-dialog__head');
    head.append(el('p', 'panel__title', 'The shelf'));

    const add = el('label', 'btn btn--sm', 'Add a photograph');
    const input = el('input', 'sr-only');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.addEventListener('change', async () => {
      await take(input.files);
      shelfDialog.close();
      resolve(await openShelf());
    });
    add.append(input);

    const close = el('button', 'btn btn--sm btn--ghost', 'Cancel');
    close.type = 'button';
    close.addEventListener('click', () => { shelfDialog.close(); resolve(undefined); });

    head.append(add, close);

    const grid = el('ul', 'shelf');
    if (!shelf.length) grid.append(el('li', 'shelf__empty', 'Nothing on the shelf yet.'));

    for (const item of shelf) {
      const cell = el('li', 'shelf__item');
      const button = el('button', 'shelf__pick');
      button.type = 'button';
      const picture = el('img');
      picture.src = item.src;
      picture.alt = item.name ?? '';
      picture.loading = 'lazy';
      button.append(picture);
      button.addEventListener('click', () => {
        shelfDialog.close();
        resolve({ src: item.src, w: item.w ?? 0, h: item.h ?? 0, alt: '' });
      });
      cell.append(button);
      grid.append(cell);
    }

    shelfDialog.append(head, grid);
    shelfDialog.addEventListener('cancel', () => resolve(undefined), { once: true });
    shelfDialog.showModal();
  });
}

/** Shrinks and sends whatever was dropped or chosen. */
async function take(files) {
  const chosen = [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
  if (!chosen.length) return [];

  say(`Sending ${chosen.length} photograph${chosen.length > 1 ? 's' : ''}…`);
  const done = [];

  for (const file of chosen) {
    try {
      done.push(await upload(file));
    } catch (error) {
      say(`${file.name}: ${error.message}`, true);
    }
  }

  await refreshShelf();
  if (done.length) say(`${done.length} on the shelf.`);
  return done;
}

/* ---- The Words panel ----------------------------------------------------- */

/* The typewriter is a list of phrases kept in one attribute. */
const PIPE = 'front.words';

function buildWords() {
  const host = document.getElementById('words-list');
  if (!host) return;
  host.textContent = '';

  for (const group of WORD_GROUPS) {
    const known = group.keys.filter(([key]) => key in page.text);
    if (!known.length) continue;

    const block = el('section', 'studio__group');
    block.append(el('p', 'studio__group-title', group.title));

    for (const [key, label] of known) {
      const row = el('div', 'studio__field');
      const head = el('div', 'studio__field-head');
      head.append(el('label', 'studio__label', label));

      if (page.changed.has(key)) {
        const badge = el('span', 'studio__badge', 'changed');
        const restore = el('button', 'studio__restore', 'Restore');
        restore.type = 'button';
        restore.addEventListener('click', () => {
          patch.text[key] = null;
          delete draft[key];
          markDirty();
          say('Restored on save.');
          row.dataset.restoring = 'true';
        });
        head.append(badge, restore);
      }

      const onChange = (value) => {
        draft[key] = value;
        patch.text[key] = key === PIPE ? value.split('\n').map((one) => one.trim()).filter(Boolean).join('|') : value;
        delete row.dataset.restoring;
        markDirty();
      };

      row.append(head);

      if (key === PIPE) {
        const area = el('textarea', 'studio__area');
        area.rows = 5;
        area.value = (page.text[key] ?? '').split('|').join('\n');
        area.addEventListener('input', () => onChange(area.value));
        row.append(area);
      } else {
        row.append(richField(page.text[key], onChange));
      }

      block.append(row);
    }

    host.append(block);
  }
}

/* ---- The Lists panel ----------------------------------------------------- */

function fieldControl(spec, item, onChange) {
  const change = (value) => { item[spec.key] = value; onChange(); };

  switch (spec.kind) {
    case 'rich': return richField(item[spec.key], change);
    case 'month': return monthField(item[spec.key], change);
    case 'flag': return flagField(item[spec.key], spec.label, change);
    case 'icon': return iconField(item[spec.key], change);
    case 'image': return imageField(item[spec.key], change);
    case 'tags': return lineField(
      Array.isArray(item[spec.key]) ? item[spec.key].join(', ') : '',
      (value) => change(value.split(',').map((one) => one.trim()).filter(Boolean)),
    );
    default: return lineField(item[spec.key], change);
  }
}

function buildLists() {
  const host = document.getElementById('lists-list');
  if (!host) return;
  host.textContent = '';

  for (const list of LISTS) {
    if (!(list.name in page.collections)) continue;

    const items = draft.collections[list.name];
    const block = el('details', 'studio__list');
    block.open = list.name === 'craft';

    const summary = el('summary', 'studio__list-head');
    summary.append(el('span', 'studio__list-title', list.title));
    summary.append(el('span', 'studio__list-count', `${items.length}`));
    if (page.changed.has(`list:${list.name}`)) summary.append(el('span', 'studio__badge', 'changed'));
    block.append(summary);

    block.append(el('p', 'studio__list-note', list.note));

    const dirty = () => {
      patch.collections[list.name] = draft.collections[list.name];
      markDirty();
    };

    const redraw = () => { buildLists(); markDirty(); };

    if (list.flat) {
      const area = el('textarea', 'studio__area');
      area.rows = 6;
      area.value = items.join(', ');
      area.addEventListener('input', () => {
        draft.collections[list.name] = area.value.split(',').map((one) => one.trim()).filter(Boolean);
        dirty();
      });
      block.append(area);
      host.append(block);
      continue;
    }

    const body = el('div', 'studio__items');

    items.forEach((item, index) => {
      const entry = el('article', 'studio__item card');

      const head = el('header', 'studio__item-head');
      head.append(el('p', 'studio__item-name', `${index + 1}. ${list.name_of(item)}`));

      const tools = el('div', 'studio__item-tools');
      const move = (to) => {
        if (to < 0 || to >= items.length) return;
        const [taken] = items.splice(index, 1);
        items.splice(to, 0, taken);
        dirty();
        redraw();
      };

      for (const [glyph, title, run] of [
        ['↑', 'Move up', () => move(index - 1)],
        ['↓', 'Move down', () => move(index + 1)],
        ['⧉', 'Duplicate', () => { items.splice(index + 1, 0, structuredClone(item)); dirty(); redraw(); }],
        ['✕', `Remove this ${list.each}`, () => {
          if (!confirm(`Remove this ${list.each}?`)) return;
          items.splice(index, 1);
          dirty();
          redraw();
        }],
      ]) {
        const button = el('button', 'studio__icon', glyph);
        button.type = 'button';
        button.title = title;
        button.addEventListener('click', run);
        tools.append(button);
      }

      head.append(tools);
      entry.append(head);

      for (const spec of list.fields) {
        const row = el('div', 'studio__field');
        if (spec.kind !== 'flag') row.append(el('label', 'studio__label', spec.label));
        row.append(fieldControl(spec, item, dirty));
        entry.append(row);
      }

      body.append(entry);
    });

    block.append(body);

    const foot = el('div', 'studio__list-foot');

    const add = el('button', 'btn btn--sm btn--solid', `Add a ${list.each}`);
    add.type = 'button';
    add.addEventListener('click', () => {
      items.push(structuredClone(list.blank));
      dirty();
      redraw();
    });
    foot.append(add);

    if (page.changed.has(`list:${list.name}`)) {
      const restore = el('button', 'btn btn--sm btn--ghost', 'Restore the printed list');
      restore.type = 'button';
      restore.addEventListener('click', () => {
        patch.collections[list.name] = null;
        markDirty();
        say('Restored on save.');
      });
      foot.append(restore);
    }

    block.append(foot);
    host.append(block);
  }
}

/* ---- The Photographs panel ----------------------------------------------- */

function buildPlates() {
  const host = document.getElementById('shelf');
  const slot = document.getElementById('portrait-slot');
  if (!host || !slot) return;

  slot.textContent = '';
  slot.append(el('p', 'studio__label', 'The portrait on the front page'));
  slot.append(imageField(draft.portrait, (image) => {
    draft.portrait = image;
    patch.media.portrait = image;
    markDirty();
  }));

  host.textContent = '';
  if (!shelf.length) host.append(el('li', 'shelf__empty', 'Nothing on the shelf yet.'));

  for (const item of shelf) {
    const cell = el('li', 'shelf__item');

    const picture = el('img');
    picture.src = item.src;
    picture.alt = item.name ?? '';
    picture.loading = 'lazy';
    cell.append(picture);

    const foot = el('div', 'shelf__foot');
    foot.append(el('span', 'shelf__size', `${item.w || '?'}×${item.h || '?'}`));

    const remove = el('button', 'studio__icon', '✕');
    remove.type = 'button';
    remove.title = 'Remove from the shelf';
    remove.addEventListener('click', async () => {
      if (!confirm('Remove this photograph? Anything still pointing at it will lose its picture.')) return;
      try {
        await api(`media/${item.id}`, { method: 'DELETE' });
        await refreshShelf();
        buildPlates();
        say('Off the shelf.');
      } catch (error) {
        say(error.message, true);
      }
    });

    foot.append(remove);
    cell.append(foot);
    host.append(cell);
  }
}

function wireDropzone() {
  const zone = document.getElementById('dropzone');
  const input = document.getElementById('dropzone-input');
  if (!zone || !input) return;

  input.addEventListener('change', async () => {
    await take(input.files);
    input.value = '';
    buildPlates();
  });

  for (const name of ['dragenter', 'dragover']) {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.dataset.over = 'true';
    });
  }

  for (const name of ['dragleave', 'drop']) {
    zone.addEventListener(name, () => { delete zone.dataset.over; });
  }

  zone.addEventListener('drop', async (event) => {
    event.preventDefault();
    await take(event.dataTransfer?.files);
    buildPlates();
  });
}

/* ---- Saving -------------------------------------------------------------- */

async function commit() {
  if (!touched()) return;

  saveButton.disabled = true;
  say('Setting the type…');

  try {
    await save(patch);
    patch.text = {};
    patch.collections = {};
    patch.media = {};
    await reload();
    say('Set. The page is updated.');
  } catch (error) {
    say(error.message, true);
  } finally {
    markDirty();
  }
}

/* ---- Wiring -------------------------------------------------------------- */

function wireTabs() {
  const tabs = document.getElementById('studio-tabs');
  tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;

    for (const other of tabs.querySelectorAll('[data-tab]')) {
      const on = other === button;
      other.setAttribute('aria-selected', String(on));
      document.getElementById(`panel-${other.dataset.tab}`).hidden = !on;
    }
  });
}

async function changePassword(event) {
  event.preventDefault();

  const current = document.getElementById('pw-current');
  const next = document.getElementById('pw-next');
  const again = document.getElementById('pw-again');
  const status = document.getElementById('password-status');

  if (next.value !== again.value) {
    status.textContent = 'The two new passwords are not the same.';
    return;
  }

  try {
    await api('password', {
      method: 'POST',
      body: JSON.stringify({ current: current.value, next: next.value }),
    });
    current.value = '';
    next.value = '';
    again.value = '';
    status.textContent = 'Changed. Every other device has been signed out.';
  } catch (error) {
    status.textContent = error.message;
  }
}

async function reload() {
  page = await loadPage();
  draft = {
    collections: structuredClone(page.collections),
    portrait: page.portrait ? structuredClone(page.portrait) : null,
  };
  buildWords();
  buildLists();
  buildPlates();
}

async function open() {
  gate.hidden = true;
  studio.hidden = false;

  const status = document.getElementById('studio-status');
  if (status) status.textContent = 'Reading the page…';

  await refreshShelf().catch(() => { shelf = []; });
  await reload();

  if (status) status.textContent = '';
  markDirty();
}

wireTabs();
wireDropzone();
document.getElementById('studio-save')?.addEventListener('click', commit);
document.getElementById('password-form')?.addEventListener('submit', changePassword);

document.getElementById('studio-out')?.addEventListener('click', async () => {
  await api('session', { method: 'DELETE' }).catch(() => {});
  location.reload();
});

addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    event.preventDefault();
    commit();
  }
});

addEventListener('beforeunload', (event) => {
  if (!touched()) return;
  event.preventDefault();
  event.returnValue = '';
});

/* Who is at the door. */
api('session')
  .then(async (body) => {
    if (body.signedIn) await open();
    else gate.hidden = false;
  })
  .catch(() => { gate.hidden = false; });
