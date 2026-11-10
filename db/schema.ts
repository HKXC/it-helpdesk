// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('helpdesk_workspaces',{
 ownerId:text('owner_id').primaryKey(),payload:text('payload').notNull(),
 revision:integer('revision').notNull().default(0),updatedAt:text('updated_at').notNull()
});
export const accounts=sqliteTable('accounts',{
 id:text('id').primaryKey(),email:text('email').notNull().unique(),
 name:text('name').notNull(),passwordHash:text('password_hash').notNull(),createdAt:integer('created_at').notNull()
});
export const sessions=sqliteTable('account_sessions',{
 tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),
 expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull()
});
export const authLimits=sqliteTable('auth_rate_limits',{
 key:text('key').primaryKey(),attempts:integer('attempts').notNull(),expiresAt:integer('expires_at').notNull()
});
