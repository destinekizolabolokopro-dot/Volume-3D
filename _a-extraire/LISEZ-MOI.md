# En transit — à sortir de ce dépôt

Ce dossier n'a pas vocation à rester ici. Il contient **une application
complète et autonome**, prête à devenir son propre dépôt : l'assistant
juridique en droit immobilier, avec ses pages, son corpus de 2 133 articles,
ses trois tables et ses 55 tests. Il ne dépend de rien de Volume3D — ni du
`package.json`, ni des composants, ni des types, ni de la base.

Il est ici pour une seule raison : le jeton GitHub de la session qui l'a
produit ne peut pas créer de dépôt (`403 Resource not accessible by
integration` — permission d'administration). Le laisser hors du dépôt l'aurait
fait disparaître avec le conteneur.

## Les trois commandes qui le sortent d'ici

Créez d'abord un dépôt vide `droit-immobilier` sur GitHub — sans README, sans
`.gitignore`, sans licence, sinon le premier `push` sera refusé. Puis :

```bash
cd _a-extraire/droit-immobilier
git init -b main && git add -A && git commit -m "L’assistant juridique, chez lui"
git remote add origin git@github.com:<vous>/droit-immobilier.git
git push -u origin main
```

Ensuite, et **seulement ensuite**, ce dossier et la zone `/juridique` du dépôt
Volume3D peuvent être supprimés : tant que le nouveau dépôt n'existe pas, ils
sont la seule copie.

## Ce qu'il reste à faire côté Volume3D

Retirer `app/juridique/`, `app/api/juridique/`, `components/juridique/`,
`lib/juridique/`, `corpus/`, `scripts/corpus.mjs`, la table
`comptesJuridiques` du schéma, les tests du droit, et la section correspondante
du README. Rien d'autre du site n'en dépend : `lib/sessions.ts` reste utile aux
comptes Volume3D, et `lib/accounts.ts` ne porte plus aucun champ juridique.

## L'espace de réglages

`/reglages` permet de coller la clé d'API depuis le site, sans redéployer. Il
faut poser `ADMIN_PASSWORD` (douze caractères au minimum) sur l'hébergeur ; la
clé, elle, est essayée auprès d'Anthropic avant d'être enregistrée, puis
chiffrée en base et jamais réaffichée. Voir la section correspondante du README.

## Vérifié avant d'être posé ici

```
npx tsc --noEmit     aucune erreur
npm test             62 tests, 62 passent
npm run build        12 routes, toutes à la racine
```

Les routes ont changé d'adresse : `/juridique/bail-habitation` est devenu
`/bail-habitation`, et `/api/juridique/consultation` est devenu
`/api/consultation`. Le site ne renvoie nulle part ailleurs, et le mot
« Volume3D » n'y apparaît pas une fois.
