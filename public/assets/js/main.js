/**
 * Entry point.
 *
 * Every module below exports a single `init` that is safe to call even when the
 * markup it looks for is absent, so the page degrades one feature at a time
 * rather than all at once.
 */

import { initTheme } from './modules/theme.js';
import { initNavigation } from './modules/navigation.js';
import { initScrollEffects } from './modules/scroll-effects.js';
import { initDateline } from './modules/dateline.js';
import { initTypewriter } from './modules/typewriter.js';
import { initCounters } from './modules/counters.js';
import { initPips } from './modules/pips.js';
import { initProjects } from './modules/projects.js';
import { initCommandPalette } from './modules/command-palette.js';
import { initContact } from './modules/contact.js';

document.documentElement.classList.remove('no-js');

const modules = [
  initTheme,
  initNavigation,
  initScrollEffects,
  initDateline,
  initTypewriter,
  initCounters,
  initPips,
  initProjects,
  initCommandPalette,
  initContact,
];

for (const init of modules) {
  try {
    init();
  } catch (error) {
    /* One broken feature should never take the rest of the page down. */
    console.error(`[portfolio] ${init.name} failed:`, error);
  }
}
