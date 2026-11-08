// Mode clair / sombre : automatique (selon le téléphone) ou choisi dans l'appli.
import { getState, update } from './store';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export const isDark = () => {
  const t = getState().theme ?? 'auto';
  return t === 'dark' || (t === 'auto' && media.matches);
};

/** Applique le thème choisi à la page et à la barre d'état du téléphone. */
export function applyTheme() {
  const t = getState().theme ?? 'auto';
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#12201D' : '#1F5C52');
}

export function setTheme(theme: 'auto' | 'light' | 'dark') {
  update({ theme });
  applyTheme();
}

/** Passe du clair au sombre et inversement. */
export const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');

media.addEventListener('change', applyTheme);
