/**
 * Navigation: the running head, the mobile drawer, section highlighting and
 * the back-to-top control.
 */

const SHOW_TOPBAR_AFTER = 260;

/** Reveals the top bar once the front page has scrolled out of the way. */
function trackTopbar(topbar, toTop) {
  const update = () => {
    const past = window.scrollY > SHOW_TOPBAR_AFTER;
    topbar.dataset.elevated = String(past);
    if (toTop) toTop.hidden = !past;
  };

  update();
  addEventListener('scroll', update, { passive: true });
}

/** Marks the section currently occupying the middle of the viewport. */
function trackCurrentSection(links) {
  const byId = new Map();
  const targets = [];

  for (const link of links) {
    const id = link.getAttribute('href')?.slice(1);
    const section = id && document.getElementById(id);
    if (!section) continue;
    byId.set(section, link);
    targets.push(section);
  }

  if (!targets.length) return;

  const visible = new Set();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }

      /* Documents read top to bottom, so the first visible section wins. */
      const current = targets.find((section) => visible.has(section));
      for (const [section, link] of byId) {
        if (section === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );

  targets.forEach((section) => observer.observe(section));
}

/** The off-canvas menu for narrow screens. */
function wireDrawer(drawer, toggle, close) {
  if (!drawer || !toggle) return;

  const setOpen = (open) => {
    drawer.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) drawer.querySelector('a')?.focus();
    else toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(drawer.hidden));
  close?.addEventListener('click', () => setOpen(false));

  /* Clicking the scrim, following a link, or pressing Escape all dismiss it. */
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer || event.target.closest('a')) setOpen(false);
  });

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !drawer.hidden) setOpen(false);
  });
}

export function initNavigation() {
  const topbar = document.getElementById('topbar');
  const toTop = document.getElementById('to-top');

  if (topbar) trackTopbar(topbar, toTop);

  toTop?.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: 'smooth' });
  });

  trackCurrentSection(document.querySelectorAll('#section-nav a'));

  wireDrawer(
    document.getElementById('drawer'),
    document.getElementById('menu-toggle'),
    document.getElementById('drawer-close'),
  );

  document.getElementById('print-cv')?.addEventListener('click', () => window.print());
}
