import { EspaceNav } from '@/components/EspaceNav';
import { AttentionPanel } from '@/components/AttentionPanel';
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/accounts';
import { isAssistantConfigured } from '@/lib/assistant';
import { requireAccount } from '@/lib/require-account';
import { getStore } from '@/lib/store';
import type { ChatMessage, Plan, Property } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Regroupe les questions identiques : trois voyageurs qui demandent la même
 *  chose signalent un manque dans l'annonce, pas trois curiosités. */
function topQuestions(messages: ChatMessage[]): { question: string; count: number }[] {
  const counts = new Map<string, { question: string; count: number }>();
  for (const message of messages) {
    const key = message.question.toLowerCase().replace(/[^a-zà-ÿ0-9 ]/gi, '').trim();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { question: message.question, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

export default async function EspaceDashboard() {
  const account = await requireAccount();
  const store = getStore();

  const properties = await store.list('properties', { accountId: account.id });
  const ids = new Set(properties.map((property) => property.id));
  const allMessages = await store.list('chatMessages');
  const messages = allMessages.filter((message) => ids.has(message.propertyId));

  const published = properties.filter((property) => property.status === 'published');
  const views = properties.reduce((total, property) => total + property.views, 0);
  const limit = PLAN_LIMITS[account.plan as Plan] ?? 1;
  const recent = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const byName = new Map(properties.map((property) => [property.id, property.name] as const));

  // Attention mesurée sur l'ensemble des biens du compte, et le nom des pièces
  // pour l'afficher — panoramas et pièces du plan confondus.
  const allAttention = await store.list('attention');
  const attention = allAttention.filter((row) => ids.has(row.propertyId));
  const [allScenes, allPlans] = await Promise.all([store.list('scenes'), store.list('plans')]);
  const attentionRooms = [
    ...allScenes.filter((scene) => ids.has(scene.propertyId)).map((scene) => ({ id: scene.id, name: scene.name })),
    ...allPlans
      .filter((plan) => ids.has(plan.propertyId) && plan.confirmed)
      .flatMap((plan) => plan.rooms.map((room) => ({ id: room.id, name: room.name }))),
  ];

  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const questionsThisWeek = messages.filter((message) => Date.parse(message.createdAt) > week).length;

  return (
    <div className="shell">
      <EspaceNav account={account} current="/espace" />

      <main className="page">
        <div className="page-head">
          <div>
            <h1>Bonjour {account.name.split(' ')[0]}</h1>
            <p>
              Formule {PLAN_LABELS[account.plan as Plan] ?? account.plan} ·{' '}
              {limit === Infinity ? 'logements illimités' : `${properties.length} / ${limit} logement${limit > 1 ? 's' : ''}`}
            </p>
          </div>
          <a className="btn btn-dark btn-sm" href="/espace/creation">
            + Créer un bien
          </a>
        </div>

        <div className="stats-grid">
          <Stat label="Vues des visites" value={views} hint="Depuis la mise en ligne" />
          <Stat label="Visites en ligne" value={published.length} hint={`${properties.length} bien${properties.length > 1 ? 's' : ''} au total`} />
          <Stat label="Questions posées" value={messages.length} hint={`${questionsThisWeek} cette semaine`} />
          <Stat
            label="Vues par visite"
            value={published.length > 0 ? Math.round(views / published.length) : 0}
            hint="Moyenne"
          />
        </div>

        {!isAssistantConfigured() && (
          <div className="note note-warn" style={{ marginBottom: 24 }}>
            L’assistant n’est pas activé sur cette installation : vos voyageurs ne peuvent pas encore poser de
            questions. Contactez-nous pour l’activer.
          </div>
        )}

        <AttentionPanel rows={attention} rooms={attentionRooms} />

        <section className="panel">
          <div className="panel-head">
            <h2>Ce que vos voyageurs demandent</h2>
            <small>Les questions posées à l’assistant sur vos visites</small>
          </div>

          {messages.length === 0 ? (
            <div className="empty">
              <strong>Aucune question pour l’instant</strong>
              Dès que vos visites seront consultées, les questions de vos voyageurs apparaîtront ici. C’est le
              meilleur indicateur de ce que votre annonce n’explique pas encore.
            </div>
          ) : (
            <>
              <div className="stack-sm" style={{ marginBottom: 24 }}>
                {topQuestions(messages).map((entry) => (
                  <div className="row row-between" key={entry.question}>
                    <span style={{ fontSize: 14 }}>{entry.question}</span>
                    <span className="tiny">
                      {entry.count} fois
                    </span>
                  </div>
                ))}
              </div>

              <div className="panel-head">
                <h2 style={{ fontSize: 16 }}>Dernières questions</h2>
              </div>
              {recent.map((message) => (
                <div className="qa" key={message.id}>
                  <p className="qa-q">{message.question}</p>
                  <p className="qa-a">{message.answer}</p>
                  <p className="tiny" style={{ marginTop: 6 }}>
                    {byName.get(message.propertyId) ?? 'Bien supprimé'} ·{' '}
                    {new Date(message.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Vues par bien</h2>
            <small>Ce que chaque visite génère</small>
          </div>
          {properties.length === 0 ? (
            <div className="empty">
              <strong>Aucun bien pour l’instant</strong>
              Commencez par <a href="/espace/creation">créer votre premier bien</a>.
            </div>
          ) : (
            <div className="stack-sm">
              {[...properties]
                .sort((a, b) => b.views - a.views)
                .map((property) => (
                  <ViewBar key={property.id} property={property} max={Math.max(1, views)} />
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString('fr-FR')}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

function ViewBar({ property, max }: { property: Property; max: number }) {
  const share = Math.round((property.views / max) * 100);
  return (
    <a href={`/espace/biens/${property.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="row row-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{property.name}</span>
        <span className="tiny">{property.views} vue{property.views > 1 ? 's' : ''}</span>
      </div>
      <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${share}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
    </a>
  );
}
