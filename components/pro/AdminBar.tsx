import { ProBar } from '@/components/pro/Pro';
import { logout } from '@/app/admin/actions';

/**
 * La barre du back-office.
 *
 * Elle est montée ici et pas dans chaque page : les trois pages l'avaient
 * recopiée, et elles avaient fini par diverger — l'une gardait le lien vers le
 * site, l'autre non, et le compteur de rendez-vous n'apparaissait que sur le
 * tableau de bord.
 */
export function AdminBar({ current, toConfirm = 0 }: { current: string; toConfirm?: number }) {
  return (
    <ProBar
      current={current}
      tabs={[
        { href: '/admin', label: 'Tableau de bord' },
        { href: '/admin/rendez-vous', label: 'Rendez-vous', count: toConfirm },
        { href: '/admin/demarchage', label: 'Fiche de démarchage' },
      ]}
      side={
        <>
          <a className="pro-tab" href="/" target="_blank" rel="noopener noreferrer">
            Voir le site ↗
          </a>
          <form action={logout}>
            <button type="submit" className="btn btn-on-dark btn-sm">
              Déconnexion
            </button>
          </form>
        </>
      }
    />
  );
}
