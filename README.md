# EasyType

Un jeu d'entraînement à la frappe sur le thème de l'espace, conçu pour apprendre le clavier suisse-français QWERTZ. Les joueurs progressent à travers des niveaux qui introduisent graduellement de nouvelles touches, chaque niveau se débloquant uniquement après avoir atteint un score minimum.

## Fonctionnalités

- Niveaux progressifs chargés depuis un fichier XML — chaque niveau définit les touches autorisées et requises
- Clavier visuel qui met en évidence les nouvelles touches introduites (en vert) et toutes les touches actives
- Effets sonores et drone ambiant générés via l'API Web Audio — aucun fichier audio nécessaire
- Suivi des scores et de la progression sauvegardés dans un cookie (aucun backend)
- Génération de pseudo-mots pour les niveaux sans correspondances de mots réels

## Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- Un fichier XML de niveaux (voir [Données de niveaux](#données-de-niveaux) ci-dessous)

## Installation et lancement

```bash
npm install
npm run dev       # serveur de développement avec HMR sur http://localhost:5173
npm run build     # build de production → dist/
npm run preview   # prévisualisation du build de production en local
```

## Données de niveaux

Les niveaux proviennent d'un fichier XML fourni par l'utilisateur, à déposer dans l'application au démarrage. Générez-le avec le script Python inclus :

```bash
python filter_words.py wordlist.csv filters.txt output.xml
```

Format XML :

```xml
<filter level_name="Rangée de base" min_score_pct="0.6" mission_size="8">
  <allowed_chars>a s d f j k l</allowed_chars>   <!-- séparés par des espaces -->
  <required_chars>f j</required_chars>
  <matches><word>flask</word>…</matches>
  <pseudo_words><word>…</word>…</pseudo_words>
</filter>
```

## Calcul du score

| Événement | Points |
|---|---|
| Par caractère tapé | `nb_lettres × 20` |
| Par erreur | `−5` |
| Bonus de rapidité (< 3 s) | `+20` |
| Bonus de rapidité (< 6 s) | `+10` |

Un niveau est réussi lorsque `score total ≥ score maximum × min_score_pct`.

## Stack technique

React 19 · Vite · Web Audio API · persistance par cookie (aucun backend, aucune base de données)
