# En transit — à sortir de ce dépôt

Ce dossier n'a pas vocation à rester ici. Il contient **une application
complète et autonome**, prête à devenir son propre dépôt : l'assistant
juridique en droit immobilier, avec ses pages, son corpus de 2 133 articles,
ses trois tables et ses 245 tests. Il ne dépend de rien de Volume3D — ni du
`package.json`, ni des composants, ni des types, ni de la base.

Il est ici pour une seule raison : aucune session n'a pu créer de dépôt à sa
place — créer un dépôt public est une action qui revient à son propriétaire.
Le laisser hors du dépôt l'aurait fait disparaître avec le conteneur.

## L'extraction est préparée — il reste une étape, et elle vous revient

L'historique de cette application a été extrait dans une branche de ce même
dépôt : **`immolex-extrait`**. Elle porte les 29 commits qui ont touché ce
dossier, avec l'application à sa racine — plus de `_a-extraire/`. Elle a été
vérifiée seule, hors de ce dépôt : 245 tests passent, le site compile.

Il manque la seule chose qui ne peut pas être faite d'ici : créer le dépôt.
Créez-le **vide** sur GitHub — sans README, sans `.gitignore`, sans licence,
sinon le premier `push` sera refusé —, puis :

```bash
git clone --single-branch --branch immolex-extrait \
  https://github.com/destinekizolabolokopro-dot/Volume-3D.git immolex
cd immolex
git branch -m immolex-extrait main
git remote set-url origin git@github.com:<vous>/immolex.git
git push -u origin main
```

Vérifiez ensuite que le nouveau dépôt tient debout :

```bash
npm install && npm run verify && npm run avant-lancement
```

**Ensuite, et seulement ensuite**, ce dossier peut être supprimé de Volume3D :
tant que le nouveau dépôt n'existe pas, il en est la seule copie versionnée.
La branche `immolex-extrait` pourra l'être aussi, une fois le nouveau dépôt
confirmé.

Une précision qui compte : ce dépôt-ci est **public**. Le nouveau le sera ou
non selon ce que vous choisirez en le créant — mais ce qui est déjà ici
restera lisible dans l'historique de Volume3D, quelle que soit la visibilité
du nouveau.

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
