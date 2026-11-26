import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { applyTheme } from './theme';

applyTheme();

render(<App />, document.getElementById('app')!);

// Écran d'ouverture « Khatm al-Qur'an » : visible au moins 1,2 seconde, jamais plus de 2 (sécurité dans index.html).
declare global { interface Window { __splashAt?: number; hideSplash?: () => void } }
const shown = Date.now() - (window.__splashAt ?? Date.now());
window.setTimeout(() => window.hideSplash?.(), Math.max(0, 3000 - shown));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
