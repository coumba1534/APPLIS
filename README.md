# Khatam entre sœurs

Application web installable (PWA) pour faire un **khatam du Coran pendant le Ramadan** : un juz par jour pendant 30 jours, chacune de son côté, à son rythme, et ensemble en groupe.

## Ce que fait l'appli (version 0.1)

- **Aujourd'hui** : le juz du jour découpé en séances selon le programme choisi, à cocher ; rattrapage d'un juz manqué sur 1, 2 ou 4 jours ; jours d'affilée.
- **Lire** : le Coran complet (texte uthmani), par juz ou par sourate, avec les numéros de page du mushaf de Médine, un marque-page, la traduction française et 4 écritures au choix (Classique, Moderne posée, Ouest-africaine, Fine et aérée).
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
| `public/data/` | Texte arabe et traduction française du Coran |
| `public/sw.js` | Fonctionnement hors connexion |
| `public/icons/` | Icône de l'appli (`npm run icons` pour régénérer les PNG, nécessite Playwright) |

## Sources du texte

- **Texte arabe uthmani** : The Noble Qur'an Encyclopedia ([quranenc.com](https://quranenc.com)), via le paquet [quran-json](https://github.com/risan/quran-json) (CC BY-SA 4.0).
- **Traduction française** : Muhammad Hamidullah, via [tanzil.net](https://tanzil.net/trans/fr.hamidullah).
- **Juz, hizb et pages du mushaf de Médine** : paquet [quran-meta](https://www.npmjs.com/package/quran-meta) (MIT), vérifiés par recoupement avec le texte.

Les textes sont repris sans modification. Merci de garder ces mentions si vous réutilisez le projet.
