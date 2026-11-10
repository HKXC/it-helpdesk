// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('helpdesk_workspaces',{
 ownerId:text('owner_id').primaryKey(),payload:text('payload').notNull(),
 revision:integer('revision').notNull().default(0),updatedAt:text('updated_at').notNull()
});
