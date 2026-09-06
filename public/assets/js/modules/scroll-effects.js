/**
 * Reading progress and the reveal-on-scroll effect.
 */

/** Fills the hairline under the top bar as the document is read. */
function trackProgress(bar) {
  const update = () => {
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    bar.style.setProperty('--progress', `${Math.min(ratio, 1) * 100}%`);
  };

  update();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
}

/**
 * Fades elements in once, the first time they come into view.
 *
 * Anything reached by a jump — an anchor link, a deep link, a flung scroll —
 * never changes intersection state and so never gets a callback of its own.
 * Revealing an element therefore also reveals everything before it in document
 * order, which is exactly the content the reader has just skipped past.
 */
function revealOnScroll(elements) {
  const pending = [...elements];

  const observer = new IntersectionObserver(
    (entries) => {
      const furthest = entries.reduce(
        (index, entry) => (entry.isIntersecting
          ? Math.max(index, pending.indexOf(entry.target))
          : index),
        -1,
      );

      if (furthest < 0) return;

      for (const element of pending.splice(0, furthest + 1)) {
        element.classList.add('is-visible');
        observer.unobserve(element);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  pending.forEach((element) => observer.observe(element));
}

export function initScrollEffects() {
  const bar = document.getElementById('read-progress');
  if (bar) trackProgress(bar);

  const revealable = document.querySelectorAll('.reveal');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealable.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  revealOnScroll(revealable);
}
