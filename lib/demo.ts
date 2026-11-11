// Demo-data switch. Demo accounts are those with an @demo.test email (created by
// scripts/seed-demo.mjs). When demo mode is off, those accounts cannot sign in and
// their tickets are hidden everywhere, so the site behaves like a clean real install.
import { database } from './database';

export const DEMO_DOMAIN = '@demo.test';
const SETTINGS_ID = 'system:settings';

export const isDemoEmail = (email: unknown) =>
  typeof email === 'string' && email.toLowerCase().endsWith(DEMO_DOMAIN);

type Settings = { demoEnabled: boolean };

let cache: { value: Settings; at: number } | null = null;

export async function readSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  const row = (
    await database().select('helpdesk_workspaces', { owner_id: SETTINGS_ID }, ['payload'], 1)
  )[0];
  let value: Settings = { demoEnabled: true };
  try {
    if (row) value = { ...value, ...(JSON.parse(String(row.payload)) as Partial<Settings>) };
  } catch {}
  cache = { value, at: Date.now() };
  return value;
}

export async function demoEnabled() {
  return (await readSettings()).demoEnabled;
}

export async function writeSettings(next: Settings) {
  const db = database();
  const payload = JSON.stringify(next);
  const updated_at = new Date().toISOString();
  const changed = await db.patch(
    'helpdesk_workspaces',
    { owner_id: SETTINGS_ID },
    { payload, updated_at },
  );
  if (!changed.length)
    await db.insert(
      'helpdesk_workspaces',
      { owner_id: SETTINGS_ID, payload, revision: 0, updated_at },
      true,
    );
  cache = { value: next, at: Date.now() };
}

// IDs of demo accounts, used to hide their tickets when demo mode is off.
export async function demoAccountIds(): Promise<Set<string>> {
  const rows = await database().select('accounts', {}, ['id', 'email'], 5000);
  return new Set(rows.filter((r) => isDemoEmail(r.email)).map((r) => String(r.id)));
}

// True when this ticket row belongs to a demo account and demo mode is off.
export async function hiddenDemoTicket(row: { requester_id?: unknown }) {
  if (await demoEnabled()) return false;
  return (await demoAccountIds()).has(String(row.requester_id));
}
