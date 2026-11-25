# Khatam entre sœurs

Application web installable (PWA) pour faire un **khatam du Coran pendant le Ramadan** : un juz par jour pendant 30 jours, chacune de son côté, à son rythme, et ensemble en groupe.

## Ce que fait l'appli (version 0.1)

- **Un khatam à la durée libre** : Ramadan (30 jours, 1 juz par jour), 1, 2 ou 3 mois, ou une durée personnalisée (de 1 à 365 jours, avec date de début et date de fin). Le Coran est découpé en parts égales, en **unités traditionnelles** : juz, hizb, ½ hizb, ¼ de hizb (jusqu'à 240 jours), puis en pages. **Un seul khatam personnel à la fois** : sa durée ne se modifie pas (on s'engage et on va au bout), sa date de début est modifiable jusqu'au premier jour, son programme à tout moment. On peut **l'arrêter** en le gardant dans l'historique (pour le reprendre plus tard) ou en le supprimant, puis en commencer un autre. Un khatam interrompu peut être **repris** s'il n'y a pas de khatam en cours (le calendrier est décalé à partir d'aujourd'hui), et tout élément de l'historique peut être **supprimé**.
- **Aujourd'hui** : la portion du jour découpée en séances selon le programme choisi, à cocher ; rattrapage d'un jour manqué sur 1, 2 ou 4 jours ; jours d'affilée ; fin du khatam.
- **Programmes** : 4 programmes prédéfinis (Matin et soir, Surtout le matin, Réparti sur la journée, Après chaque prière) qui s'adaptent à la portion du jour, et un **programme personnalisé** (le moment et l'heure de chaque séance ; les parts sont calculées automatiquement).
- **Lire** : le Coran complet, par juz, par sourate ou par page.
  - **Mode Page** : les 604 pages du mushaf de Médine, 15 lignes par page comme le mushaf imprimé, dans l'écriture officielle du Complexe du Roi Fahd ; on tourne les pages en glissant.
  - **Mode Défilement** : verset par verset, avec la traduction française et 3 écritures au choix (Mushaf de Médine, Classique, Moderne posée).
  - Un marque-page, dans les deux modes.
  - **Les noms d'Allah et de Rabb en rouge**, comme dans certains mushafs (`src/data/divine.ts`). Rabb n'est pas coloré là où il désigne un être humain ou un astre : 6:76, 6:77 (1re occurrence), 6:78, 12:23, 12:41, 12:42 (les deux), 12:50 (1re occurrence), 79:24.
- **Programme** : le khatam en cours, le choix du programme, le calendrier des jours et l'historique ; mode essai pour commencer avant la date prévue.
- **Rappels** : un rappel par séance, à l'heure choisie.
- **Fin du khatam** : écran de célébration avec des dou'a du Coran.
- Fonctionne **hors connexion** une fois ouverte, et s'installe sur l'écran d'accueil (Android et iPhone).

### Le khatam du Ramadan

L'appli sert toute l'année. À l'approche du Ramadan (10 jours avant la date estimée), un **khatam du Ramadan** est proposé : bandeau « Votre khatam du Ramadan est disponible », bouton **Rejoindre**, et une notification.

- **29 jours**, comme dans les mosquées : 240 quarts de hizb répartis régulièrement (8 ou 9 par jour, 18 à 23 pages). Le jour 1 est le juz 1, le jour 29 le juz 30.
- Pendant le Ramadan, le **khatam personnel est en pause** : son calendrier se décale, il reprend le lendemain du Ramadan là où on l'a laissé.
- Les jours manqués se **rattrapent jusqu'au dernier jour du Ramadan**. À l'Aïd, les jours non lus disparaissent, un message s'affiche (« qu'Allah vous permette de le compléter l'année prochaine ») et le khatam passe dans l'historique.
- Notifications : annonce du khatam, premier jour (« Ramadan Moubarak »), puis les rappels des séances.

Tout se règle dans `public/config.json`, sans mettre l'appli à jour :

```json
{
  "ramadan": {
    "start": "2027-02-08",
    "days": null,
    "name": "Ramadan 1448",
    "showDaysBefore": 10,
    "enabled": null
  },
  "testMode": true
}
```

| Réglage | Rôle |
|---|---|
| `start` | 1er jour du Ramadan, date estimée (calendrier astronomique). À corriger après l'annonce de la lune : les khatams du Ramadan pas encore commencés suivent la nouvelle date |
| `days` | Durée du mois, `29` ou `30` (`null` tant que ce n'est pas annoncé : 30 par prudence). Fixe le dernier jour de rattrapage et l'Aïd |
| `name` | Nom affiché, par exemple « Ramadan 1448 » |
| `showDaysBefore` | Nombre de jours avant le Ramadan où le khatam est annoncé |
| `enabled` | `null` : automatique · `true` : annoncé tout de suite · `false` : masqué |
| `testMode` | Affiche les **outils de test** (onglet Rappels) : simulation d'un Ramadan sur son propre téléphone (annonce, 1er jour, jour 27, dernier jour, Aïd) et envoi des notifications de test. À remettre à `false` pour le public |

Pour le modifier : GitHub → `public/config.json` → icône crayon → changer la valeur → *Commit changes*. La mise en ligne prend environ une minute. L'appli relit ce fichier à chaque ouverture ; hors connexion, elle garde le dernier réglage connu.

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
| `src/data/khatam.ts` | Le moteur du khatam : découpe du Coran en N jours (quarts de hizb ou pages) |
| `src/data/programmes.ts` | Les programmes de lecture (prédéfinis et personnalisé) et le découpage de la portion en séances |
| `src/screens/NewKhatam.tsx` | La fenêtre de création d'un khatam |
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
- **Noms des sourates calligraphiés** (en-têtes de sourate) : police `sura_names` de [quran.com](https://github.com/quran/quran.com-frontend-next) (dépôt sous licence MIT).
- **Traduction française** : Muhammad Hamidullah, via [tanzil.net](https://tanzil.net/trans/fr.hamidullah).
- **Hizb** (découpage du programme 1) : paquet [quran-meta](https://www.npmjs.com/package/quran-meta) (MIT).

Les textes sont repris sans modification, à une exception : dans le texte des écritures Classique et Moderne posée (`ar.json`), la séparation des mots de 5 versets (2:72, 27:20, 36:22, 37:164, 41:47) a été alignée sur le texte officiel du Complexe du Roi Fahd ; aucune lettre n'a changé. Merci de garder ces mentions si vous réutilisez le projet.
