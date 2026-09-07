/**
 * Editing the page on the page.
 *
 * The Worker only puts this file into the document when the proprietor's
 * session cookie is on the request, so no reader ever loads it. It adds a rule
 * along the foot of the page; while the rule says *setting*, every passage the
 * studio knows about can be clicked and typed into where it stands, and saved
 * without leaving the page.
 *
 * Structural work — adding a card, hanging a photograph, changing the password
 * — belongs in the composing room at `/admin`, which this links to.
 */

const changed = new Map();
const passages = [...document.querySelectorAll('[data-edit]')];

let setting = false;
let open = null;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* ---- The rule along the foot --------------------------------------------- */

const bar = el('div', 'compositor');
const count = el('span', 'compositor__count');
const status = el('span', 'compositor__status');

const toggle = el('button', 'compositor__toggle');
toggle.type = 'button';
toggle.setAttribute('aria-pressed', 'false');

const saveButton = el('button', 'compositor__btn compositor__btn--go', 'Save');
saveButton.type = 'button';
saveButton.disabled = true;

const dropButton = el('button', 'compositor__btn', 'Discard');
dropButton.type = 'button';
dropButton.disabled = true;

const room = el('a', 'compositor__btn', 'The composing room');
room.href = '/admin';

const paint = () => {
  toggle.textContent = setting ? 'Setting the type' : 'Set the type';
  toggle.setAttribute('aria-pressed', String(setting));
  count.textContent = changed.size
    ? `${changed.size} passage${changed.size > 1 ? 's' : ''} changed`
    : `${passages.length} passages on this page`;
  saveButton.disabled = changed.size === 0;
  dropButton.disabled = changed.size === 0;
};

bar.append(el('span', 'compositor__mark', 'AAH'), toggle, count, status, dropButton, saveButton, room);
document.body.append(bar);
document.body.dataset.setting = 'false';

/* ---- Setting ------------------------------------------------------------- */

const close = () => {
  if (!open) return;
  open.contentEditable = 'false';
  open.removeAttribute('data-setting');
  open = null;
};

/**
 * The typewriter's phrases live in an attribute rather than in the text, so
 * they are asked for rather than typed in place.
 */
function askForAttribute(node) {
  const key = node.dataset.edit;
  const name = node.dataset.editAttr;
  const answer = prompt(
    'One phrase per line.',
    (node.getAttribute(name) ?? '').split('|').join('\n'),
  );
  if (answer === null) return;

  const value = answer.split('\n').map((one) => one.trim()).filter(Boolean).join('|');
  node.setAttribute(name, value);
  changed.set(key, value);
  paint();
}

function begin(node) {
  if (node === open) return;
  close();

  if (node.dataset.editAttr) { askForAttribute(node); return; }

  open = node;
  node.contentEditable = 'true';
  node.dataset.setting = 'true';
  node.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  if (!setting) return;

  const node = event.target.closest('[data-edit]');
  if (!node) { close(); return; }

  /* While the type is being set, a link in the middle of a sentence is text. */
  if (event.target.closest('a')) event.preventDefault();
  begin(node);
}, true);

document.addEventListener('input', (event) => {
  const node = event.target.closest?.('[data-edit]');
  if (!setting || !node || node !== open) return;
  changed.set(node.dataset.edit, node.innerHTML.trim());
  paint();
});

document.addEventListener('keydown', (event) => {
  if (!setting || !open) return;

  if (event.key === 'Escape') { event.preventDefault(); close(); }

  /* A passage is one passage: a return would only break the setting. */
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); close(); }
});

toggle.addEventListener('click', () => {
  setting = !setting;
  document.body.dataset.setting = String(setting);
  for (const node of passages) node.dataset.editable = String(setting);
  if (!setting) close();
  paint();
});

dropButton.addEventListener('click', () => {
  if (!confirm('Throw away the changes on this page?')) return;
  location.reload();
});

saveButton.addEventListener('click', async () => {
  close();
  saveButton.disabled = true;
  status.textContent = 'Setting…';

  try {
    const response = await fetch('/api/content', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: Object.fromEntries(changed) }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error ?? 'that did not save');

    changed.clear();
    status.textContent = 'Set.';
    setTimeout(() => { status.textContent = ''; }, 2400);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    paint();
  }
});

addEventListener('beforeunload', (event) => {
  if (!changed.size) return;
  event.preventDefault();
  event.returnValue = '';
});

paint();
