/**
 * The work section: filtering, searching, and the detail dialog.
 *
 * Every project is already in the markup — the cards are the data. Filtering
 * hides list items, and the dialog clones the <template> each card carries, so
 * there is exactly one copy of every fact on the page.
 */

const state = { category: 'all', query: '' };

const normalise = (value) => value.toLowerCase().trim();

/** Everything a card can be matched against, computed once. */
function indexCard(card) {
  const text = [
    card.querySelector('.project__title')?.textContent,
    card.querySelector('.project__summary')?.textContent,
    card.dataset.keywords,
    [...card.querySelectorAll('.project__stack li')].map((li) => li.textContent).join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  return { card, haystack: normalise(text), category: card.dataset.category || '' };
}

function createGallery(grid, status, empty) {
  const entries = [...grid.querySelectorAll('.project')].map(indexCard);

  const render = () => {
    const words = state.query.split(/\s+/).filter(Boolean);
    let shown = 0;

    for (const { card, haystack, category } of entries) {
      const matchesCategory = state.category === 'all' || category === state.category;
      const matchesQuery = words.every((word) => haystack.includes(word));
      const visible = matchesCategory && matchesQuery;

      card.hidden = !visible;
      if (visible) shown += 1;
    }

    if (empty) empty.hidden = shown > 0;

    if (status) {
      status.textContent = shown === entries.length
        ? `Showing all ${entries.length} plates`
        : `Showing ${shown} of ${entries.length} plates`;
    }
  };

  return { render, total: entries.length };
}

function wireFilters(gallery) {
  const buttons = document.querySelectorAll('.filter');

  for (const button of buttons) {
    button.addEventListener('click', () => {
      state.category = button.dataset.filter || 'all';

      for (const other of buttons) {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      }

      gallery.render();
    });
  }
}

function wireSearch(gallery) {
  const input = document.getElementById('work-search');
  const clear = document.getElementById('work-search-clear');
  if (!input) return;

  const sync = () => {
    state.query = normalise(input.value);
    if (clear) clear.hidden = input.value === '';
    gallery.render();
  };

  input.addEventListener('input', sync);

  clear?.addEventListener('click', () => {
    input.value = '';
    sync();
    input.focus();
  });

  document.getElementById('work-reset')?.addEventListener('click', () => {
    input.value = '';
    state.category = 'all';

    for (const button of document.querySelectorAll('.filter')) {
      const active = button.dataset.filter === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    sync();
  });
}

/** Builds the anchor list shown in the dialog footer from the card's own links. */
function cloneLinks(card) {
  return [...card.querySelectorAll('.project__actions a')].map((source) => {
    const link = source.cloneNode(true);
    link.className = 'btn btn--sm';
    return link;
  });
}

function createDialog() {
  const dialog = document.getElementById('project-modal');
  if (!dialog) return null;

  const parts = {
    eyebrow: document.getElementById('modal-eyebrow'),
    title: document.getElementById('modal-title'),
    body: document.getElementById('modal-body'),
    stack: document.getElementById('modal-stack'),
    links: document.getElementById('modal-links'),
  };

  let opener = null;

  const open = (card, trigger) => {
    const detail = card.querySelector('.project__detail');
    if (!detail) return;

    const category = card.querySelector('.tag--cat')?.textContent?.trim() ?? '';
    const year = card.querySelector('.project__year')?.textContent?.trim() ?? '';

    parts.eyebrow.textContent = [category, year].filter(Boolean).join(' \u00b7 ');
    parts.title.textContent = card.querySelector('.project__title')?.textContent?.trim() ?? '';
    parts.body.replaceChildren(detail.content.cloneNode(true));
    parts.stack.textContent = [...card.querySelectorAll('.project__stack li')]
      .map((li) => li.textContent.trim())
      .join(' \u00b7 ');
    parts.links.replaceChildren(...cloneLinks(card));

    opener = trigger ?? null;
    parts.body.scrollTop = 0;
    dialog.showModal();
  };

  dialog.addEventListener('close', () => {
    opener?.focus();
    opener = null;
  });

  /* The dialog element fills the viewport, so a click outside the sheet is a
     click on the backdrop. */
  dialog.addEventListener('click', (event) => {
    if (!event.target.closest('.modal__sheet')) dialog.close();
  });

  document.getElementById('modal-close')?.addEventListener('click', () => dialog.close());

  return { open };
}

export function initProjects() {
  const grid = document.getElementById('work-grid');
  const dialog = createDialog();

  if (grid) {
    const gallery = createGallery(
      grid,
      document.getElementById('work-status'),
      document.getElementById('work-empty'),
    );

    wireFilters(gallery);
    wireSearch(gallery);
    gallery.render();
  }

  if (!dialog) return;

  /* One listener for every "read the case" control on the page, wherever it is. */
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-project]');
    if (!trigger) return;

    const card = document.querySelector(`.project[data-id="${trigger.dataset.openProject}"]`);
    if (card) dialog.open(card, trigger);
  });
}
