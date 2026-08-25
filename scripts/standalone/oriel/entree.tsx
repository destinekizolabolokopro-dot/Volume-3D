/**
 * Le point d'entrée du fichier unique.
 *
 * Il ne réécrit rien. Il monte **la page du site**, celle de
 * `app/residence/page.tsx`, dans un document vide — donc le fichier autonome
 * ne peut pas diverger du produit : il n'y a qu'une seule page, et elle est
 * ici comme elle est en ligne.
 *
 * C'est la différence avec l'autre fichier autonome du dépôt
 * (`scripts/standalone/app.js`), qui réimplémente à la main les interactions
 * d'un site à six écrans. Cette page-ci n'a ni routes, ni données de serveur,
 * ni formulaire : la porter revient à l'appeler.
 *
 * Seul `app/fonts.css` reste dehors, et pour une raison mesurée : il déclare
 * huit visages qui pointent tous vers les deux mêmes fichiers, et un
 * empaqueteur qui remplace chaque adresse par son contenu écrit donc huit fois
 * la même fonte. Cinq cent quatre-vingt-douze kilo-octets pour rien. Le
 * fichier unique les redéclare en deux visages — ce qu'Inter, qui est une
 * fonte variable, permettait depuis le début.
 */

import { createRoot } from 'react-dom/client';
import ResidencePage from '@/app/residence/page';
import '@/app/globals.css';

const racine = document.getElementById('racine');
if (racine) createRoot(racine).render(<ResidencePage />);
