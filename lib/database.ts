import { env } from 'cloudflare:workers';
import { identifier, type DataStore, type Filters, type Row } from './data-store';
import { createSupabaseStore } from './supabase-store';
function d1Store(): DataStore {
  const db = env.DB;
  if (!db) throw Error('D1 database unavailable');
  function filter(where: Filters = {}) {
    const values: unknown[] = [];
    const parts = Object.entries(where).map(([key, value]) => {
      identifier(key);
      if (value === null) return key + ' IS NULL';
      if (typeof value === 'object' && value && 'lt' in value) {
        values.push(value.lt);
        return key + ' < ?';
      }
      if (typeof value === 'object' && value && 'gt' in value) {
        values.push(value.gt);
        return key + ' > ?';
      }
      values.push(value);
      return key + ' = ?';
    });
    return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', values };
  }
  return {
    async select(table, where = {}, columns = ['*'], limit = 5000) {
      const f = filter(where),
        select = columns.map((c) => (c === '*' ? c : identifier(c))).join(',');
      const result = await db
        .prepare(`SELECT ${select} FROM ${identifier(table)}${f.sql} LIMIT ?`)
        .bind(...f.values, limit)
        .all<Row>();
      return result.results;
    },
    async insert(table, row, ignore = false) {
      const keys = Object.keys(row);
      keys.forEach(identifier);
      return await db
        .prepare(
          `INSERT INTO ${identifier(table)} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ${ignore ? 'ON CONFLICT DO NOTHING' : ''} RETURNING *`,
        )
        .bind(...Object.values(row))
        .first<Row>();
    },
    async patch(table, where, row) {
      if (!Object.keys(where).length) throw Error('Filtered update required');
      const f = filter(where),
        keys = Object.keys(row);
      keys.forEach(identifier);
      const result = await db
        .prepare(
          `UPDATE ${identifier(table)} SET ${keys.map((k) => k + ' = ?').join(',')}${f.sql} RETURNING *`,
        )
        .bind(...Object.values(row), ...f.values)
        .all<Row>();
      return result.results;
    },
    async remove(table, where) {
      if (!Object.keys(where).length) throw Error('Filtered delete required');
      const f = filter(where);
      await db
        .prepare(`DELETE FROM ${identifier(table)}${f.sql}`)
        .bind(...f.values)
        .run();
    },
    async incrementLimit(key, expires) {
      const row = await db
        .prepare(
          'INSERT INTO auth_rate_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts',
        )
        .bind(key, expires)
        .first<{ attempts: number }>();
      return row?.attempts ?? 999;
    },
    async changeAccount(p) {
      const results = await db.batch([
        db
          .prepare(
            "UPDATE accounts SET role = ?, active = ?, version = version + 1 WHERE id = ? AND version = ? AND id <> ? AND id <> ? AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = ? AND a.role = 'admin' AND a.active = 1)",
          )
          .bind(p.role, p.active, p.target, p.version, p.actor, p.root, p.actor),
        db
          .prepare(
            'INSERT INTO role_audit (id,actor_id,target_id,detail,created_at) SELECT ?,?,?,?,? WHERE changes() = 1',
          )
          .bind(p.auditId, p.actor, p.target, p.detail, p.now),
        db
          .prepare(
            'DELETE FROM account_sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM role_audit WHERE id = ?)',
          )
          .bind(p.target, p.auditId),
      ]);
      return Boolean(results[0].meta.changes);
    },
    async changePassword(p) {
      const results = await db.batch([
        db
          .prepare(
            'UPDATE accounts SET password_hash = ? WHERE id = ? AND password_hash = ? AND active = 1',
          )
          .bind(p.newHash, p.id, p.oldHash),
        db
          .prepare(
            'DELETE FROM account_sessions WHERE account_id = ? AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND password_hash = ?)',
          )
          .bind(p.id, p.id, p.newHash),
        db
          .prepare(
            'INSERT INTO account_sessions (token_hash,account_id,expires_at,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ? AND password_hash = ?)',
          )
          .bind(p.tokenHash, p.id, p.expires, p.now, p.id, p.newHash),
      ]);
      return Boolean(results[0].meta.changes);
    },
  };
}
export function databaseInfo() {
  const provider = env.DB_PROVIDER || 'd1';
  return {
    provider,
    configured:
      provider === 'supabase'
        ? Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY))
        : Boolean(env.DB),
  };
}
export function database(): DataStore {
  if (env.DB_PROVIDER === 'supabase') {
    const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.SUPABASE_URL || !secret) throw Error('Supabase configuration incomplete');
    return createSupabaseStore(env.SUPABASE_URL, secret);
  }
  if (env.DB_PROVIDER && env.DB_PROVIDER !== 'd1') throw Error('Unknown database provider');
  return d1Store();
}
