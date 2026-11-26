import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Hors connexion : après la construction, on écrit dans le service worker la liste de tous les fichiers
 * de l'appli (scripts, styles, polices), pour qu'il les mette de côté dès son installation.
 */
function offlineAssets(): Plugin {
  return {
    name: 'khatm-offline-assets',
    apply: 'build',
    closeBundle() {
      const dist = join(__dirname, 'dist');
      const assets = readdirSync(join(dist, 'assets')).map((f) => `assets/${f}`);
      const sw = join(dist, 'sw.js');
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('self.__ASSETS__ = [];', `self.__ASSETS__ = ${JSON.stringify(assets)};`));
    },
  };
}

export default defineConfig({
  // Chemins relatifs : l'appli marche à la racine d'un domaine comme dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [preact(), offlineAssets()],
  build: { target: 'es2020' },
});
