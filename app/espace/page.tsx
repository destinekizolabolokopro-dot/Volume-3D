import { EspaceNav } from '@/components/EspaceNav';
import { AttentionPanel } from '@/components/AttentionPanel';
import { Empty, Meter, ProHead, Section, Stat, StatBand } from '@/components/pro/Pro';
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/accounts';
import { isAssistantConfigured } from '@/lib/assistant';
import { formatDuration, summarize } from '@/lib/attention';
import { requireAccount } from '@/lib/require-account';
import { getStore } from '@/lib/store';
import type { ChatMessage, Plan } from '@/lib/types';

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

  /* Le même résumé que le panneau d'attention, pour la bande de chiffres. Il
     est recalculé plutôt que passé de l'un à l'autre : la fonction est pure et
     coûte moins qu'un aller-retour de props à travers deux composants. */
  const seen = summarize(attention, attentionRooms);

  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const questionsThisWeek = messages.filter((message) => Date.parse(message.createdAt) > week).length;

  return (
    <div className="pro">
      <EspaceNav account={account} current="/espace" />

      <main className="pro-page">
        <ProHead
          title={`Bonjour ${account.name.split(' ')[0]}`}
          sub={
            <>
              Formule {PLAN_LABELS[account.plan as Plan] ?? account.plan} ·{' '}
              {limit === Infinity
                ? 'logements illimités'
                : `${properties.length} / ${limit} logement${limit > 1 ? 's' : ''}`}
            </>
          }
          actions={
            <a className="btn btn-accent btn-sm" href="/espace/creation">
              Créer un bien
            </a>
          }
        />

        <StatBand>
          <Stat label="Vues des visites" value={views} hint="Depuis la mise en ligne" />
          <Stat label="Visites en ligne" value={published.length} hint={`${properties.length} bien${properties.length > 1 ? 's' : ''} au total`} />
          <Stat label="Questions posées" value={messages.length} hint={`${questionsThisWeek} cette semaine`} />
          {/*
            * Quatrième chiffre : la durée d'une visite, pas une moyenne de vues.
            *
            * On affichait ici `vues / visites en ligne`, sous l'intitulé « vues
            * par visite ». Deux défauts, et le second est le vrai : l'intitulé
            * ne décrivait pas le calcul — une visite *est* une vue, donc le
            * rapport n'avait pas de sens — et surtout, avec un seul bien en
            * ligne le quotient vaut le total. La bande affichait donc deux
            * fois 89 sur quatre cases, ce qui se lit comme une panne. Le
            * détail par bien existe déjà plus bas, dans « Vues par bien ».
            *
            * La durée moyenne, elle, dit quelque chose qu'aucun autre chiffre
            * de la page ne dit : si les voyageurs restent ou s'ils partent.
            */}
          <Stat
            label="Temps moyen par visite"
            value={seen.visits > 0 ? formatDuration(Math.round(seen.totalSeconds / seen.visits)) : '—'}
            hint={seen.visits > 0 ? `${seen.visits} visite${seen.visits > 1 ? 's' : ''} mesurée${seen.visits > 1 ? 's' : ''}` : 'Aucune mesure'}
          />
        </StatBand>

        {/* Ce n'est pas une erreur du propriétaire : c'est une fonction que
            l'installation n'a pas encore. Le rouge d'alerte laissait croire à
            une panne de son côté. */}
        {!isAssistantConfigured() && (
          <p className="pro-notice">
            <span>
              <strong>L’assistant n’est pas encore activé.</strong> Vos visites fonctionnent normalement,
              mais vos voyageurs ne peuvent pas y poser de questions. Écrivez-nous pour l’ouvrir sur votre
              compte.
            </span>
          </p>
        )}

        <AttentionPanel rows={attention} rooms={attentionRooms} />

        <Section title="Ce que vos voyageurs demandent" note="questions posées à l’assistant">
          {messages.length === 0 ? (
            <Empty title="Aucune question pour l’instant">
              Dès que vos visites seront consultées, les questions de vos voyageurs apparaîtront ici. C’est le
              meilleur indicateur de ce que votre annonce n’explique pas encore.
            </Empty>
          ) : (
            <div className="pro-panel pro-rows">
              {topQuestions(messages).map((entry) => (
                <div className="pro-ask" key={entry.question}>
                  <span className="pro-ask-q">{entry.question}</span>
                  <span className="pro-ask-count">{entry.count} fois</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {messages.length > 0 && (
          <Section title="Dernières questions" note="et ce que l’assistant a répondu">
            <div className="pro-panel">
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
            </div>
          </Section>
        )}

        <Section title="Vues par bien" note="ce que chaque visite génère">
          {properties.length === 0 ? (
            <Empty
              title="Aucun bien pour l’instant"
              action={
                <a className="btn btn-accent btn-sm" href="/espace/creation">
                  Créer mon premier bien
                </a>
              }
            >
              Envoyez le plan et les photos de chaque pièce : la visite se construit à partir de là.
            </Empty>
          ) : (
            <div className="pro-panel">
              {[...properties]
                .sort((a, b) => b.views - a.views)
                .map((property) => (
                  <Meter
                    key={property.id}
                    href={`/espace/biens/${property.id}`}
                    label={property.name}
                    note={`${property.views} vue${property.views > 1 ? 's' : ''}`}
                    share={property.views / Math.max(1, views)}
                  />
                ))}
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

