/**
 * Day and night editions.
 *
 * The choice is written to localStorage and applied to <html data-theme>. An
 * inline script in the document head applies it before first paint; this module
 * only handles switching afterwards.
 */

const STORAGE_KEY = 'theme';
const DAY = 'day';
const NIGHT = 'night';

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const write = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Private windows and blocked storage are fine; the choice just won't stick. */
  }
};

/**
 * Browsers use the first `theme-color` whose media query matches, so a
 * media-less tag placed first in <head> overrides the two static ones.
 */
const paintBrowserChrome = () => {
  const colour = getComputedStyle(document.documentElement)
    .getPropertyValue('--paper')
    .trim();
  if (!colour) return;

  let meta = document.head.querySelector('meta[name="theme-color"][data-dynamic]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.dataset.dynamic = '';
    document.head.prepend(meta);
  }
  meta.content = colour;
};

const apply = (theme, toggle) => {
  document.documentElement.dataset.theme = theme;
  paintBrowserChrome();

  if (!toggle) return;
  const next = theme === NIGHT ? 'day' : 'night';
  toggle.setAttribute('aria-pressed', String(theme === NIGHT));
  toggle.setAttribute('aria-label', `Switch to the ${next} edition`);
};

export function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  apply(document.documentElement.dataset.theme || DAY, toggle);

  toggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === NIGHT ? DAY : NIGHT;
    apply(next, toggle);
    write(next);
  });

  /* Follow the system only while the reader has expressed no preference. */
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (read()) return;
    apply(event.matches ? NIGHT : DAY, toggle);
  });
}
