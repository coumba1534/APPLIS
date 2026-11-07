import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Chemins relatifs : l'appli marche à la racine d'un domaine comme dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [preact()],
  build: { target: 'es2020' },
});
