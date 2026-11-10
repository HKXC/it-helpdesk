import { getAccount, response } from '../../../lib/account-auth';
import { database, databaseInfo } from '../../../lib/database';
import { migrateLegacy, ticketView } from '../../../lib/tickets';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await getAccount(request);
    if (!user) return response({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    await migrateLegacy(user);
    const db = database(),
      staff = user.role !== 'employee';
    if (staff) {
      const legacy = await db.select(
        'accounts',
        { legacy_migrated: 0 },
        ['id', 'email', 'name', 'role', 'version'],
        20,
      );
      for (const account of legacy)
        await migrateLegacy({
          id: String(account.id),
          email: String(account.email),
          name: String(account.name),
          role: account.role as 'admin' | 'it' | 'employee',
          version: Number(account.version),
        });
    }
    const rows = await db.select('it_tickets', staff ? {} : { requester_id: user.id });
    const names = new Map(
      (await db.select('accounts', {}, ['id', 'name'], 5000)).map((a) => [
        String(a.id),
        String(a.name),
      ]),
    );
    const jobs = await Promise.all(rows.map((row) => ticketView(row, names)));
    const accounts = staff
      ? await db.select('accounts', { active: 1 }, ['id', 'name', 'role'], 500)
      : [];
    return response({
      jobs,
      account: user.email,
      role: user.role,
      agents: accounts.filter((a) => ['admin', 'it'].includes(String(a.role))),
      database: user.role === 'admin' ? databaseInfo() : undefined,
    });
  } catch {
    return response({ error: 'โหลดคิวงานไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
export async function PUT() {
  return response({ error: 'กรุณารีเฟรชหน้าเพื่อใช้งาน API รุ่นใหม่' }, 405);
}
