/**
 * The strapline that types itself.
 *
 * Words come from a pipe-separated `data-words` attribute so the copy stays in
 * the markup rather than in this file.
 */

const TYPE_MS = 58;
const ERASE_MS = 26;
const HOLD_MS = 1900;
const BETWEEN_MS = 420;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cycle(element, words) {
  for (let index = 0; ; index = (index + 1) % words.length) {
    const word = words[index];

    for (let length = 1; length <= word.length; length += 1) {
      element.textContent = word.slice(0, length);
      await wait(TYPE_MS);
    }

    await wait(HOLD_MS);

    for (let length = word.length; length >= 0; length -= 1) {
      element.textContent = word.slice(0, length);
      await wait(ERASE_MS);
    }

    await wait(BETWEEN_MS);
  }
}

export function initTypewriter() {
  const element = document.getElementById('typewriter');
  if (!element) return;

  const words = (element.dataset.words || '')
    .split('|')
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return;

  /* Animated text is a poor trade for anyone who asked for less motion. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = words[0];
    document.querySelector('.caret')?.remove();
    return;
  }

  cycle(element, words);
}
