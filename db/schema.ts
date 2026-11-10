// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('helpdesk_workspaces', {
  ownerId: text('owner_id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  role: text('role').notNull().default('employee'),
  active: integer('active').notNull().default(1),
  version: integer('version').notNull().default(0),
  legacyMigrated: integer('legacy_migrated').notNull().default(0),
  locale: text('locale').notNull().default('th'),
  theme: text('theme').notNull().default('system'),
  onboardingCompleted: integer('onboarding_completed').notNull().default(0),
});
export const sessions = sqliteTable('account_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const authLimits = sqliteTable('auth_rate_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const tickets = sqliteTable('it_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requesterId: text('requester_id')
    .notNull()
    .references(() => accounts.id),
  assigneeId: text('assignee_id').references(() => accounts.id),
  body: text('body').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  legacyKey: text('legacy_key').unique(),
});
export const roleAudit = sqliteTable('role_audit', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  targetId: text('target_id').notNull(),
  detail: text('detail').notNull(),
  createdAt: integer('created_at').notNull(),
});
