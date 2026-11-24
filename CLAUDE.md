# Khatam entre sœurs : suivi du projet

Ce fichier est relu au début de chaque session de travail. Il garde les décisions prises avec la porteuse du projet (Coumba), pour que le travail continue sans rien perdre, même quand la conversation est résumée ou qu'une nouvelle session commence.

## Façon de travailler (à respecter)

- Échanger en **français**, simplement, sans jargon technique inutile.
- **Toujours discuter d'une idée avant de la coder** : proposer, expliquer les options et recommander, puis attendre son feu vert. Exception : les petits réglages visuels qu'elle demande explicitement.
- **Tester avant de mettre en ligne** (Playwright, iPhone 13 simulé, captures d'écran). Dire ce qui a été vérifié et ce qui ne peut l'être que sur son iPhone.
- Chaque modification est poussée sur `main` : GitHub Pages met l'appli en ligne en environ une minute (https://coumba1534.github.io/APPLIS/). Elle teste sur son iPhone (appli installée sur l'écran d'accueil). Pour voir une mise à jour : fermer complètement l'appli puis la rouvrir, deux fois si besoin.
- Ne jamais recopier de mémoire un texte religieux (Coran, dou'a) : utiliser des sources vérifiées.

## L'appli

PWA (Vite + Preact + TypeScript), hors connexion grâce au service worker (`public/sw.js`, changer `VERSION` quand les fichiers mis en cache changent). Voir `README.md` pour l'organisation du code et les sources du texte.

- **Lire** : mushaf de Médine officiel (KFGQPC, 604 pages, 15 lignes), mode Page (glissement des pages avec double trait, mode focus en touchant la page, marque-page par appui long) et mode Défilement (5 écritures, traduction Hamidullah, taille 1 à 9). Noms d'Allah et de Rabb en rouge, toujours (`src/data/divine.ts`, exceptions où Rabb désigne un humain ou un astre : liste à faire vérifier par elle).
- **Khatam personnel** (`src/store.ts`, `src/data/khatam.ts`) : un seul à la fois, durée libre (1 à 365 jours, découpe en quarts de hizb jusqu'à 240 jours, puis en pages), **durée non modifiable** (on s'engage), date de début modifiable seulement avant le premier jour, programme modifiable à tout moment. « Arrêter ce khatam » : le garder dans l'historique (reprise possible s'il n'y a pas de khatam en cours) ou le supprimer.
- **Programmes** (`src/data/programmes.ts`) : Matin et soir, Surtout le matin, Réparti sur la journée, Après chaque prière, et « Mon programme » (moments + heures ; parts égales calculées, pas de pourcentage saisi). Textes neutres (hommes et femmes).
- **Khatam du Ramadan** : 29 jours (comme les mosquées), 240 quarts répartis régulièrement. Annoncé 10 jours avant la date **estimée** (`public/config.json`), bandeau + notification, « Rejoindre ». Le khatam personnel est **en pause** pendant le Ramadan (et le khatam de groupe aussi, quand il existera). Rattrapage jusqu'au dernier jour du Ramadan ; à l'Aïd, les jours non lus disparaissent avec un message bienveillant, historique, reprise du personnel. Pas de reprise possible d'un khatam du Ramadan.
- **Réglages à distance** (`public/config.json`, `src/config.ts`) : date du Ramadan, durée du mois (29/30), nom, délai d'annonce, `enabled`, `testMode` (outils de test dans l'onglet Rappels). **Remettre `testMode` à `false` avant l'ouverture au public.**

## Parcours d'accueil du Ramadan (validé, à intégrer)

Maquette validée : https://claude.ai/artifact/N2red9a8keoGj6YJorP27n. Après « Rejoindre » : accueil festif (ciel étoilé, lanternes, croissant, « Ramadan Moubarak, prénom »), le défi (29 nuits, 30 juz, 604 pages, 29 lunes), le rythme du Ramadan (Suhur et Tarawih, Autour de l'iftar, Après chaque prière, **Rythme personnalisé**), les rappels (encouragement du soir, 10 dernières nuits), l'intention (facultative, **affichée chaque jour** sur la carte), « Bismillah, je commence » avec pluie d'étoiles. **Une lune qui grandit** avec la lecture sur la carte du Ramadan. Couleurs « nuit et or » **seulement sur la carte du Ramadan**. **Carte de fin à partager à l'Aïd** : idée validée.

## Décisions pour les groupes (étape Firebase, pas encore faite)

- **Un seul groupe à la fois.** Une fois dans un groupe, rien à l'écran ne permet d'en rejoindre un autre, jusqu'à la fin du khatam du groupe. On peut **quitter** un groupe (bouton discret, confirmation).
- Tout le monde peut **créer** un groupe (option A) ; l'administrateur du groupe choisit **seul** la durée et le programme. Le but à terme : ouvrir l'appli au plus grand nombre.
- Khatam de groupe en parallèle du khatam personnel ; en pause pendant le Ramadan si on suit le khatam du Ramadan.
- Firebase (offre gratuite Spark) : elle doit créer le projet (Web app, Authentication « Anonyme », Firestore en région européenne) et transmettre `firebaseConfig`. Les hôtes Firebase sont joignables depuis l'environnement de travail.
- Rappels appli fermée : plus tard (serveur d'envoi : GitHub Actions gratuit ou Firebase Blaze).

## Questions encore ouvertes

1. **Nom de l'appli** : « Khatam entre sœurs » ne convient plus à un public mixte (idées : « Khatam Ensemble », « Mon Khatam »). Le nom est centralisé dans `src/brand.ts` (+ manifeste, `index.html`, README).
2. **Connexion pour les groupes** : prénom seul (recommandé pour le test) ou Google.
3. **Visibilité dans un groupe** : tous les membres voient la progression de tous (proposé) ou seulement l'administrateur.
4. **Programme des mosquées** pour le Ramadan : si elle le trouve, l'ajouter dans `config.json` (29 versets de début de jour).
5. **Liste des exceptions de Rabb** (6:76-78, 12:23, 12:41, 12:42, 12:50, 79:24) : à faire vérifier par elle.
