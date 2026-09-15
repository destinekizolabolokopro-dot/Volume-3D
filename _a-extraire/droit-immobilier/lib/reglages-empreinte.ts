/**
 * L'empreinte d'une clé, seule.
 *
 * Ce fichier n'existe que parce que `lib/reglages.ts` porte `server-only` et
 * touche la base : impossible à charger dans un test. L'empreinte, elle, est
 * du calcul pur, et c'est la seule partie que la page affiche — donc la seule
 * qu'il faut vraiment vérifier.
 *
 * Les huit derniers caractères, et rien d'autre. Assez pour reconnaître la
 * sienne parmi plusieurs et vérifier qu'une rotation a eu lieu ; pas assez
 * pour s'en servir.
 */
export function empreinte(cle: string): string {
  const propre = cle.trim();
  if (propre.length <= 12) return '…';
  return `sk-ant-…${propre.slice(-8)}`;
}
