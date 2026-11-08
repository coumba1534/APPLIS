# Khatam entre sœurs

Application web installable (PWA) pour faire un **khatam du Coran pendant le Ramadan** : un juz par jour pendant 30 jours, chacune de son côté, à son rythme, et ensemble en groupe.

## Ce que fait l'appli (version 0.1)

- **Aujourd'hui** : le juz du jour découpé en séances selon le programme choisi, à cocher ; rattrapage d'un juz manqué sur 1, 2 ou 4 jours ; jours d'affilée.
- **Lire** : le Coran complet, par juz, par sourate ou par page.
  - **Mode Page** : les 604 pages du mushaf de Médine, 15 lignes par page comme le mushaf imprimé, dans l'écriture officielle du Complexe du Roi Fahd ; on tourne les pages en glissant.
  - **Mode Défilement** : verset par verset, avec la traduction française et 5 écritures au choix (Mushaf de Médine, Classique, Moderne posée, Ouest-africaine, Fine et aérée).
  - Un marque-page, dans les deux modes.
- **Programme** : les 4 programmes de lecture et le tableau des 30 jours ; date de début du Ramadan réglable ; mode essai pour tester avant le Ramadan.
- **Rappels** : un rappel par séance, à l'heure choisie.
- **Fin du khatam** : écran de célébration avec des dou'a du Coran.
- Fonctionne **hors connexion** une fois ouverte, et s'installe sur l'écran d'accueil (Android et iPhone).

### Pas encore disponible (étape 2, avec Firebase)

- Comptes, groupes partagés, progression des sœurs, encouragements.
- Espace administratrice : création des groupes, validation des demandes, message au groupe.
- Rappels quand l'appli est fermée (notifications push envoyées par un serveur).

Pour l'instant, la progression est enregistrée uniquement sur le téléphone.

## Lancer l'appli sur son ordinateur

Il faut [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée (par exemple http://localhost:5173).

Pour préparer la version à mettre en ligne :

```bash
npm run build
```

Le dossier `dist/` contient alors le site complet, à héberger tel quel (par exemple sur Firebase Hosting).

## Organisation du code

| Dossier / fichier | Rôle |
|---|---|
| `src/screens/` | Les écrans : Aujourd'hui, Lire, Programme, Groupe, Rappels, premier lancement, fin du khatam |
| `src/data/quran.ts` | Sourates, juz, hizb, pages du mushaf et chargement du texte |
| `src/data/programmes.ts` | Les 4 programmes de lecture et le découpage du juz en séances |
| `src/store.ts` | La progression, enregistrée sur le téléphone |
| `src/device.ts` | Installation et rappels |
| `public/data/` | Texte arabe, pages du mushaf et traduction française du Coran |
| `src/screens/PageView.tsx` | Le mode Page (mushaf de Médine ligne par ligne) |
| `src/fonts/` | Police officielle KFGQPC HAFS Uthmanic Script |
| `public/sw.js` | Fonctionnement hors connexion |
| `public/icons/` | Icône de l'appli (`npm run icons` pour régénérer les PNG, nécessite Playwright) |

## Sources du texte

- **Mushaf de Médine (pages, lignes, juz) et texte de l'écriture officielle** : édition Hafs du Complexe du Roi Fahd (KFGQPC, UthmanicHafs v3.0), via le paquet [@quran.ws/text](https://github.com/quran-ws/quran-text) (CC BY 4.0).
- **Police KFGQPC HAFS Uthmanic Script** : © Complexe du Roi Fahd pour l'impression du Saint Coran ([fonts.qurancomplex.gov.sa](https://fonts.qurancomplex.gov.sa/)), utilisée sans modification dans une appli gratuite.
- **Texte arabe pour les autres écritures** : The Noble Qur'an Encyclopedia ([quranenc.com](https://quranenc.com)), via le paquet [quran-json](https://github.com/risan/quran-json) (CC BY-SA 4.0).
- **Traduction française** : Muhammad Hamidullah, via [tanzil.net](https://tanzil.net/trans/fr.hamidullah).
- **Hizb** (découpage du programme 1) : paquet [quran-meta](https://www.npmjs.com/package/quran-meta) (MIT).

Les textes sont repris sans modification. Merci de garder ces mentions si vous réutilisez le projet.
