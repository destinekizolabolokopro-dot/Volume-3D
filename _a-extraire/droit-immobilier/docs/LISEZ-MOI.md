# Ce dossier est le site public de démonstration

GitHub Pages sert ce dossier tel quel. `index.html` est produit par
`npm run artefact` : le site entier en un seul fichier, avec sa vraie feuille
de style, ses dix fiches, son catalogue de courriers et son mode mains libres.

## Ce qu'il sait faire

Tout ce qui ne demande pas de serveur. La navigation entre les cinq écrans, la
dictée et la lecture à voix haute — ce sont des fonctions du navigateur —, les
dix fiches de spécialité avec leurs délais et leurs vérifications, le tableau
des diagnostics, la table des majorités de copropriété.

## Ce qu'il ne sait pas faire, et pourquoi

**Répondre.** Il n'y a pas de modèle derrière un fichier statique. Poser une
question affiche un échange ENREGISTRÉ, annoncé comme tel en toutes lettres :
une démonstration qui laisse croire qu'elle répond en direct est un mensonge
qu'on découvre à la deuxième question, devant la personne qu'on voulait
convaincre.

**Tenir un compte.** Pas de serveur, donc pas de session, pas de base, pas de
courriel.

Et ce n'est pas une limite qu'on contourne : une clé d'API posée dans un
fichier statique est lisible par n'importe qui en trois clics, et serait
épuisée par des inconnus dans la journée.

## Le vrai site

Il lui faut un hébergeur qui exécute du Node — Vercel, Netlify, un VPS. Les
variables à poser sont listées par `npm run avant-lancement`, et
`npm run installer` les demande une par une.

## Le remettre à jour

```bash
npm run artefact && cp standalone/immolex-artefact.html docs/index.html
```

Le fichier `.nojekyll` est nécessaire : sans lui, GitHub Pages fait passer le
dossier par Jekyll, qui ignore tout ce qui commence par un souligné.
