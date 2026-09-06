/**
 * Skill meters.
 *
 * The markup carries only `data-level`; the five lozenges are built here so the
 * HTML never has to repeat them.
 */

const TOTAL = 5;

export function initPips() {
  for (const meter of document.querySelectorAll('.pips')) {
    const level = Math.max(0, Math.min(TOTAL, Number(meter.dataset.level) || 0));

    meter.replaceChildren(
      ...Array.from({ length: TOTAL }, (_, index) => {
        const pip = document.createElement('span');
        if (index < level) pip.className = 'is-on';
        return pip;
      }),
    );
  }
}
