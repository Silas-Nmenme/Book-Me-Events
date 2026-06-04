import { initThemeToggle } from '../theme-toggle.js';

// MVP placeholder for now.
// Backend immutable audit log endpoints are not yet implemented.

function init() {
  initThemeToggle();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

init();

