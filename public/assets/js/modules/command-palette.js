/**
 * The Ctrl+K palette.
 *
 * Entries are read out of the document itself — the numbered sections — so the
 * palette can never list something that is not there.
 */

const KEY = 'k';

/** The numbered sections, in the order they appear in the document. */
function collectEntries() {
  const sections = [...document.querySelectorAll('.section[id]')].map((section) => ({
    kind: 'Section',
    label: section.querySelector('.section__title')?.textContent?.trim() ?? section.id,
    hint: section.querySelector('.section__numeral')?.textContent?.trim() ?? '',
    run: () => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' }),
  }));

  return [
    ...sections,
    {
      kind: 'Action',
      label: 'Print the résumé',
      hint: 'Ctrl+P',
      run: () => window.print(),
    },
    {
      kind: 'Action',
      label: 'Switch edition',
      hint: 'Day / night',
      run: () => document.getElementById('theme-toggle')?.click(),
    },
    {
      kind: 'Link',
      label: 'Message on WhatsApp',
      hint: '+62 822-8069-3457',
      run: () => open('https://wa.me/6282280693457', '_blank', 'noopener'),
    },
    {
      kind: 'Link',
      label: 'Instagram',
      hint: '@andhikaharirie7',
      run: () => open('https://www.instagram.com/andhikaharirie7/', '_blank', 'noopener'),
    },
    {
      kind: 'Link',
      label: 'LinkedIn profile',
      hint: 'ahmad-andhika-haririe',
      run: () => open('https://www.linkedin.com/in/ahmad-andhika-haririe/', '_blank', 'noopener'),
    },
    {
      kind: 'Link',
      label: 'GitHub profile',
      hint: 'trustedtft07',
      run: () => open('https://github.com/trustedtft07', '_blank', 'noopener'),
    },
    {
      kind: 'Link',
      label: 'Send an email',
      hint: 'Correspondence',
      run: () => { location.href = 'mailto:ahmadandhikaharirie@gmail.com'; },
    },
  ];
}

export function initCommandPalette() {
  const dialog = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-results');
  const empty = document.getElementById('palette-empty');
  if (!dialog || !input || !list) return;

  const entries = collectEntries();
  let matches = entries;
  let active = 0;

  const render = () => {
    const query = input.value.toLowerCase().trim();

    matches = query
      ? entries.filter((entry) =>
          `${entry.label} ${entry.kind} ${entry.hint} ${entry.keywords ?? ''}`
            .toLowerCase()
            .includes(query))
      : entries;

    active = 0;
    if (empty) empty.hidden = matches.length > 0;

    list.replaceChildren(
      ...matches.map((entry, index) => {
        const option = document.createElement('li');
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'palette__option';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(index === 0));
        button.innerHTML =
          `<span class="palette__kind"></span><span class="palette__label"></span><span class="palette__hint"></span>`;
        button.querySelector('.palette__kind').textContent = entry.kind;
        button.querySelector('.palette__label').textContent = entry.label;
        button.querySelector('.palette__hint').textContent = entry.hint ?? '';
        button.addEventListener('click', () => choose(index));

        option.append(button);
        return option;
      }),
    );
  };

  const highlight = (next) => {
    const options = list.querySelectorAll('.palette__option');
    if (!options.length) return;

    active = (next + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
    options[active].scrollIntoView({ block: 'nearest' });
  };

  const choose = (index) => {
    const entry = matches[index];
    dialog.close();
    /* Let the dialog finish closing before the page moves under it. */
    requestAnimationFrame(() => entry?.run());
  };

  const openPalette = () => {
    input.value = '';
    render();
    dialog.showModal();
    input.focus();
  };

  document.getElementById('palette-open')?.addEventListener('click', openPalette);

  addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === KEY) {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else openPalette();
    }
  });

  input.addEventListener('input', render);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(active - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(active);
    }
  });

  dialog.addEventListener('click', (event) => {
    if (!event.target.closest('.palette__sheet')) dialog.close();
  });
}
