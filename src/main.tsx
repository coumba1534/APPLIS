import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { applyTheme } from './theme';

applyTheme();

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
