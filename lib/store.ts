import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_DB, type Database } from './types';

type Table = keyof Database;
type Row<T extends Table> = Database[T][number];
type Where<T extends Table> = Partial<Record<keyof Row<T>, unknown>>;

/**
 * Couche d'accès aux données.
 *
 * Deux implémentations interchangeables :
 *  - `LocalStore`  : un fichier JSON dans .data/ — pour développer sans rien installer.
 *  - `SupabaseStore`: Postgres hébergé — pour la production sur Vercel.
 *
 * Le choix se fait tout seul selon la présence des variables d'environnement
 * Supabase, donc le même code tourne en local et en ligne.
 */
export interface Store {
  list<T extends Table>(table: T, where?: Where<T>): Promise<Row<T>[]>;
  get<T extends Table>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends Table>(table: T, row: Row<T>): Promise<Row<T>>;
  update<T extends Table>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null>;
  remove<T extends Table>(table: T, where: Where<T>): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function matches(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

export class LocalStore implements Store {
  /** Les écritures sont sérialisées : le fichier JSON n'est pas transactionnel. */
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Database> {
    try {
      const raw = await fs.readFile(DB_FILE, 'utf8');
      return { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) } as Database;
    } catch {
      return structuredClone(EMPTY_DB);
    }
  }

  private async write(db: Database): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  }

  /** Enchaîne les mutations pour éviter que deux écritures concurrentes s'écrasent. */
  private transaction<R>(fn: (db: Database) => Promise<R> | R): Promise<R> {
    const next = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.write(db);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async list<T extends Table>(table: T, where?: Where<T>): Promise<Row<T>[]> {
    const db = await this.read();
    const rows = db[table] as Row<T>[];
    return rows.filter((row) => matches(row as unknown as Record<string, unknown>, where as unknown as Record<string, unknown>));
  }

  async get<T extends Table>(table: T, id: string): Promise<Row<T> | null> {
    const rows = await this.list(table);
    return rows.find((row) => (row as { id: string }).id === id) ?? null;
  }

  insert<T extends Table>(table: T, row: Row<T>): Promise<Row<T>> {
    return this.transaction((db) => {
      (db[table] as Row<T>[]).push(row);
      return row;
    });
  }

  update<T extends Table>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null> {
    return this.transaction((db) => {
      const rows = db[table] as Row<T>[];
      const index = rows.findIndex((row) => (row as { id: string }).id === id);
      if (index === -1) return null;
      rows[index] = { ...rows[index], ...patch };
      return rows[index];
    });
  }

  remove<T extends Table>(table: T, where: Where<T>): Promise<void> {
    return this.transaction((db) => {
      const rows = db[table] as Row<T>[];
      const kept = rows.filter((row) => !matches(row as unknown as Record<string, unknown>, where as unknown as Record<string, unknown>));
      (db[table] as Row<T>[]) = kept;
    });
  }
}

export class SupabaseStore implements Store {
  constructor(private client: SupabaseClient) {}

  async list<T extends Table>(table: T, where?: Where<T>): Promise<Row<T>[]> {
    let query = this.client.from(table).select('*');
    for (const [key, value] of Object.entries(where ?? {})) query = query.eq(key, value as never);
    const { data, error } = await query;
    if (error) throw new Error(`Lecture ${table} impossible : ${error.message}`);
    return (data ?? []) as Row<T>[];
  }

  async get<T extends Table>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Lecture ${table}/${id} impossible : ${error.message}`);
    return (data as Row<T>) ?? null;
  }

  async insert<T extends Table>(table: T, row: Row<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(`Écriture ${table} impossible : ${error.message}`);
    return data as Row<T>;
  }

  async update<T extends Table>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).update(patch as never).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Mise à jour ${table}/${id} impossible : ${error.message}`);
    return (data as Row<T>) ?? null;
  }

  async remove<T extends Table>(table: T, where: Where<T>): Promise<void> {
    let query = this.client.from(table).delete();
    for (const [key, value] of Object.entries(where)) query = query.eq(key, value as never);
    const { error } = await query;
    if (error) throw new Error(`Suppression dans ${table} impossible : ${error.message}`);
  }
}

let cached: Store | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  // Clé "service_role" : elle contourne les règles RLS, donc elle ne doit jamais
  // être préfixée NEXT_PUBLIC_ ni atteindre le navigateur.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function getStore(): Store {
  if (cached) return cached;
  const client = supabaseAdmin();
  cached = client ? new SupabaseStore(client) : new LocalStore();
  return cached;
}

/** Vrai si l'application tourne sur le stockage de développement. */
export function isLocalStore(): boolean {
  return supabaseAdmin() === null;
}
