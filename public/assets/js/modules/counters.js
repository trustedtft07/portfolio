/**
 * Statistics that count up when they first scroll into view.
 */

const DURATION_MS = 1400;
const easeOut = (t) => 1 - (1 - t) ** 3;

function countUp(element) {
  const target = Number(element.dataset.countTo);
  if (!Number.isFinite(target)) return;

  const pad = Number(element.dataset.countPad) || 0;
  const format = (value) => String(value).padStart(pad, '0');
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / DURATION_MS, 1);
    element.textContent = format(Math.round(target * easeOut(progress)));
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export function initCounters() {
  const counters = document.querySelectorAll('[data-count-to]');
  if (!counters.length) return;

  const settle = (element) => {
    const pad = Number(element.dataset.countPad) || 0;
    element.textContent = String(element.dataset.countTo).padStart(pad, '0');
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counters.forEach(settle);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target);
        self.unobserve(entry.target);
      }
    },
    { threshold: 0.6 },
  );

  counters.forEach((element) => observer.observe(element));
}
